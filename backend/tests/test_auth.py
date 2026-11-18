"""Sign-up, email verification and login."""
from tests.conftest import make_user

NEW_USER = {"email": "new@example.com", "password": "secret123", "name": "Ravi Kumar", "role": "youth"}


def test_register_verify_then_login(client, db):
    r = client.post("/api/auth/register", json=NEW_USER)
    assert r.status_code == 200
    assert r.json()["sent"] is True

    # The OTP is stored in the database (and would be emailed).
    otp = db.tables["otps"][0]["otp"]
    assert len(otp) == 6 and otp.isdigit()

    r = client.post("/api/auth/verify-otp", json={"email": NEW_USER["email"], "otp": otp})
    assert r.status_code == 200
    body = r.json()
    assert body["access_token"]
    assert body["user"]["email_verified"] is True
    assert "password" not in body["user"]
    assert db.tables["otps"] == []  # used codes are removed

    r = client.post("/api/auth/login", json={"email": NEW_USER["email"], "password": NEW_USER["password"]})
    assert r.status_code == 200
    token = r.json()["access_token"]

    r = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200
    assert r.json()["name"] == "Ravi Kumar"


def test_login_blocked_before_email_verified(client, db):
    client.post("/api/auth/register", json=NEW_USER)
    r = client.post("/api/auth/login", json={"email": NEW_USER["email"], "password": NEW_USER["password"]})
    assert r.status_code == 403
    assert r.json()["detail"] == "EMAIL_NOT_VERIFIED"


def test_wrong_password_is_rejected(client, db):
    make_user(db, email="asha@example.com", password="right-password")
    r = client.post("/api/auth/login", json={"email": "asha@example.com", "password": "wrong-password"})
    assert r.status_code == 401


def test_unknown_email_is_rejected(client):
    r = client.post("/api/auth/login", json={"email": "nobody@example.com", "password": "whatever1"})
    assert r.status_code == 401


def test_wrong_otp_is_rejected(client, db):
    client.post("/api/auth/register", json=NEW_USER)
    real = db.tables["otps"][0]["otp"]
    wrong = "000000" if real != "000000" else "111111"
    r = client.post("/api/auth/verify-otp", json={"email": NEW_USER["email"], "otp": wrong})
    assert r.status_code == 400


def test_cannot_register_a_verified_email_twice(client, db):
    make_user(db, email="new@example.com")
    r = client.post("/api/auth/register", json=NEW_USER)
    assert r.status_code == 400


def test_protected_route_needs_a_token(client):
    assert client.get("/api/auth/me").status_code == 401
    assert client.get("/api/auth/me", headers={"Authorization": "Bearer not-a-token"}).status_code == 401


def test_password_reset_flow(client, db):
    make_user(db, email="asha@example.com", password="old-password")
    r = client.post("/api/auth/forgot-password", json={"email": "asha@example.com"})
    assert r.status_code == 200
    token = db.tables["password_resets"][0]["token"]

    r = client.post("/api/auth/reset-password", json={"token": token, "new_password": "new-password"})
    assert r.status_code == 200
    r = client.post("/api/auth/login", json={"email": "asha@example.com", "password": "new-password"})
    assert r.status_code == 200


def test_forgot_password_does_not_reveal_unknown_emails(client):
    r = client.post("/api/auth/forgot-password", json={"email": "nobody@example.com"})
    assert r.status_code == 200
