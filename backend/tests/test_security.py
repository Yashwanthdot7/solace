"""Phase 3 security fixes."""
import logging

import pytest

import server
from tests.conftest import auth_header, make_user

NEW_USER = {"email": "new@example.com", "password": "secret123", "name": "Ravi Kumar", "role": "youth",
            "accept_terms": True}


def _otp(db):
    return db.tables["otps"][0]["otp"]


# 3.1 secure OTPs
def test_otps_are_six_digits_from_secrets(monkeypatch):
    calls = []
    real = server.secrets.randbelow
    monkeypatch.setattr(server.secrets, "randbelow", lambda n: calls.append(n) or real(n))
    code = server._new_otp()
    assert calls == [1_000_000]
    assert len(code) == 6 and code.isdigit()


def test_small_otp_numbers_keep_leading_zeros(monkeypatch):
    monkeypatch.setattr(server.secrets, "randbelow", lambda n: 42)
    assert server._new_otp() == "000042"


# 3.2 OTP attempt limit
def test_otp_is_deleted_after_five_wrong_guesses(client, db):
    client.post("/api/auth/register", json=NEW_USER)
    real = _otp(db)
    wrong = "000000" if real != "000000" else "111111"
    for i in range(4):
        r = client.post("/api/auth/verify-otp", json={"email": NEW_USER["email"], "otp": wrong})
        assert r.status_code == 400
        assert f"{4 - i} attempt" in r.json()["detail"]
    r = client.post("/api/auth/verify-otp", json={"email": NEW_USER["email"], "otp": wrong})
    assert "Too many" in r.json()["detail"]
    assert db.tables["otps"] == []
    # Even the right code no longer works.
    r = client.post("/api/auth/verify-otp", json={"email": NEW_USER["email"], "otp": real})
    assert r.status_code == 400


# 3.3 rate limits
def test_login_is_rate_limited(client, db):
    make_user(db, email="asha@example.com", password="right-password")
    codes = [client.post("/api/auth/login", json={"email": "asha@example.com", "password": "wrong-pass"}).status_code
             for _ in range(11)]
    assert codes[:10] == [401] * 10
    assert codes[10] == 429


def test_forgot_password_is_rate_limited(client):
    codes = [client.post("/api/auth/forgot-password", json={"email": "x@example.com"}).status_code for _ in range(4)]
    assert codes == [200, 200, 200, 429]


def test_mitra_chat_is_rate_limited(client, headers):
    codes = [client.post("/api/mitra/chat", json={"message": "hi"}, headers=headers).status_code for _ in range(21)]
    assert codes[-1] == 429 and codes[0] == 200


# 3.4 no codes in logs (unless ENV=development)
def test_otp_not_logged_in_production(client, db, caplog, monkeypatch):
    monkeypatch.setattr(server, "IS_DEV", False)
    with caplog.at_level(logging.DEBUG):
        client.post("/api/auth/register", json=NEW_USER)
    assert _otp(db) not in caplog.text


def test_otp_logged_only_in_development(client, db, caplog, monkeypatch):
    monkeypatch.setattr(server, "IS_DEV", True)
    with caplog.at_level(logging.INFO):
        client.post("/api/auth/register", json=NEW_USER)
    assert _otp(db) in caplog.text


def test_resend_does_not_reveal_which_emails_exist(client):
    r = client.post("/api/auth/send-otp", json={"email": "nobody@example.com"})
    assert r.status_code == 200


# 3.5 health reveals nothing sensitive
def test_health_only_reports_status_and_database(client):
    body = client.get("/api/health").json()
    assert body == {"status": "ok", "database": "ok"}


# 3.6 CORS
def test_cors_allows_frontend_and_blocks_others(client):
    ok = client.options("/api/health", headers={"Origin": "http://localhost:3000", "Access-Control-Request-Method": "GET"})
    assert ok.headers.get("access-control-allow-origin") == "http://localhost:3000"
    bad = client.options("/api/health", headers={"Origin": "https://evil.example", "Access-Control-Request-Method": "GET"})
    assert "access-control-allow-origin" not in bad.headers


# 3.7 JWT
def test_short_jwt_secret_is_refused():
    with pytest.raises(RuntimeError):
        server.check_jwt_secret("too-short")
    server.check_jwt_secret("x" * 32)


def test_tokens_last_seven_days():
    import jwt
    from datetime import datetime, timezone
    token = server.make_token("abc")
    exp = jwt.decode(token, server.JWT_SECRET, algorithms=["HS256"])["exp"]
    days = (exp - datetime.now(timezone.utc).timestamp()) / 86400
    assert 6.9 < days <= 7.0


# 3.8 input limits
@pytest.mark.parametrize("payload", [
    {**NEW_USER, "password": "short"},
    {**NEW_USER, "name": "x" * 81},
    {**NEW_USER, "name": ""},
])
def test_register_input_limits(client, payload):
    assert client.post("/api/auth/register", json=payload).status_code == 422


def test_task_points_are_capped(client, db):
    org = make_user(db, email="org@example.com", role="community")
    r = client.post("/api/organiser/tasks", json={"title": "Big", "points": 1000000}, headers=auth_header(org))
    assert r.status_code == 422


def test_chat_message_length_limit(client, headers):
    r = client.post("/api/mitra/chat", json={"message": "x" * 2001}, headers=headers)
    assert r.status_code == 422


def test_feed_image_must_be_https(client, headers):
    r = client.post("/api/feed", json={"text": "hi", "image": "javascript:alert(1)"}, headers=headers)
    assert r.status_code == 422


# 3.9 points farming
def _points(db, user):
    return next(u for u in db.tables["users"] if u["id"] == user["id"])["points"]


def test_one_heart_per_person_per_post(client, db, user, headers):
    author = make_user(db, email="author@example.com")
    post = client.post("/api/feed", json={"text": "hello"}, headers=auth_header(author)).json()
    before = _points(db, user)
    for _ in range(5):
        client.post(f"/api/feed/{post['id']}/heart", headers=headers)
    stored = next(p for p in db.tables["posts"] if p["id"] == post["id"])
    assert stored["hearts"] == 1
    assert _points(db, user) == before + 1


def test_one_claim_per_person_per_task(client, db, user, headers):
    org = make_user(db, email="org@example.com", role="community")
    task = client.post("/api/organiser/tasks", json={"title": "Wave", "points": 20}, headers=auth_header(org)).json()
    first = client.post(f"/api/organiser/tasks/{task['id']}/claim", headers=headers).json()
    second = client.post(f"/api/organiser/tasks/{task['id']}/claim", headers=headers).json()
    assert first["points_earned"] == 20 and second["points_earned"] == 0
    assert _points(db, user) == 20


def test_one_riddle_answer_per_day(client, db, user, headers):
    q = client.get("/api/games/riddle/today").json()
    answer = server.RIDDLES[q["id"]]["a"]
    assert client.post("/api/games/riddle/answer", json={"id": q["id"], "answer": answer}, headers=headers).json()["correct"]
    again = client.post("/api/games/riddle/answer", json={"id": q["id"], "answer": answer}, headers=headers).json()
    assert again["already_answered"] is True
    assert _points(db, user) == 12


def test_one_rsvp_per_event(client, db, user, headers):
    client.post("/api/events/e1/rsvp", headers=headers)
    r = client.post("/api/events/e1/rsvp", headers=headers).json()
    assert r["already"] is True
    assert len(db.tables["rsvps"]) == 1


def test_cannot_log_someone_elses_hobby(client, db, headers):
    other = make_user(db, email="other@example.com")
    hobby = client.post("/api/hobbies", json={"name": "Harmonium"}, headers=auth_header(other)).json()
    assert client.post(f"/api/hobbies/{hobby['id']}/log", headers=headers).status_code == 404


# 3.10 organiser events
def test_only_organisers_create_events(client, db, headers):
    event = {"title": "Bingo", "date_str": "Sat 4 PM", "venue": "Hall"}
    assert client.post("/api/organiser/events", json=event, headers=headers).status_code == 403
    org = make_user(db, email="org@example.com", role="community")
    assert client.post("/api/organiser/events", json=event, headers=auth_header(org)).status_code == 200
