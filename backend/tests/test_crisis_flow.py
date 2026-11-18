"""Crisis handling in Mitra chat, the feed and the journal."""
import pytest

import server
from tests.conftest import auth_header, make_user

CRISIS_MSG = "I want to end my life"
CONCERN_MSG = "I feel hopeless and everyone would be better off without me"


@pytest.fixture
def gemini_on(monkeypatch):
    """Pretend Gemini is configured and record every call made to it."""
    calls = []

    async def fake_gemini(persona, history, message):
        calls.append({"persona": persona, "message": message})
        return "Gemini says hello."

    monkeypatch.setattr(server, "GEMINI_API_KEY", "fake-key")
    monkeypatch.setattr(server, "_call_gemini_chat", fake_gemini)
    return calls


# ── Mitra ────────────────────────────────────────────────────────────────

def test_chat_requires_login(client):
    r = client.post("/api/mitra/chat", json={"message": "hello"})
    assert r.status_code == 401


def test_crisis_reply_with_gemini_off(client, headers, db):
    r = client.post("/api/mitra/chat", json={"message": CRISIS_MSG, "mood": "playful"}, headers=headers)
    assert r.status_code == 200
    body = r.json()
    assert body["crisis"] is True
    assert body["risk_level"] == "crisis"
    assert "14416" in body["reply"] and "112" in body["reply"]
    assert {h["number"] for h in body["helplines"]} >= {"14416", "112"}
    assert db.tables["mitra_messages"][0]["risk_level"] == "crisis"


def test_crisis_message_is_never_sent_to_gemini(client, headers, gemini_on):
    r = client.post("/api/mitra/chat", json={"message": CRISIS_MSG, "mood": "playful"}, headers=headers)
    body = r.json()
    assert body["crisis"] is True
    assert "14416" in body["reply"]
    assert gemini_on == []  # Gemini was not called at all


def test_concern_uses_calm_persona_and_adds_helpline(client, headers, gemini_on):
    r = client.post("/api/mitra/chat", json={"message": CONCERN_MSG, "mood": "hype"}, headers=headers)
    body = r.json()
    assert body["crisis"] is False
    assert body["risk_level"] == "concern"
    assert body["show_helpline"] is True
    assert body["mood"] == "gentle"
    assert "14416" in body["reply"]
    assert "Do not joke" in gemini_on[0]["persona"]


def test_concern_with_gemini_off_still_adds_helpline(client, headers):
    body = client.post("/api/mitra/chat", json={"message": CONCERN_MSG}, headers=headers).json()
    assert body["risk_level"] == "concern"
    assert "14416" in body["reply"]


def test_normal_chat_has_safety_rules_in_persona(client, headers, gemini_on):
    body = client.post("/api/mitra/chat", json={"message": "Had a lovely day!"}, headers=headers).json()
    assert body["crisis"] is False and body["show_helpline"] is False
    assert body["reply"] == "Gemini says hello."
    assert "Never give information about methods" in gemini_on[0]["persona"]


def test_gemini_request_includes_safety_settings(monkeypatch):
    sent = {}

    class FakeResponse:
        status_code = 200

        def json(self):
            return {"candidates": [{"content": {"parts": [{"text": "hi"}]}}]}

    class FakeClient:
        def __init__(self, *a, **k):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *a):
            return False

        async def post(self, url, json=None, **kwargs):
            sent["body"] = json
            return FakeResponse()

    import asyncio
    monkeypatch.setattr(server, "GEMINI_API_KEY", "fake-key")
    monkeypatch.setattr(server.httpx, "AsyncClient", FakeClient)
    reply = asyncio.run(server._call_gemini_chat("persona", [], "hello"))
    assert reply == "hi"
    cats = {s["category"] for s in sent["body"]["safetySettings"]}
    assert "HARM_CATEGORY_DANGEROUS_CONTENT" in cats


# ── Feed ─────────────────────────────────────────────────────────────────

def test_crisis_post_is_held_from_public_feed(client, headers, db):
    r = client.post("/api/feed", json={"text": "I don't want to live anymore"}, headers=headers)
    body = r.json()
    assert body["held"] is True and body["crisis"] is True
    assert body["helplines"]

    other = make_user(db, email="other@example.com")
    feed = client.get("/api/feed", headers=auth_header(other)).json()
    assert all(p.get("text") != "I don't want to live anymore" for p in feed)


def test_normal_post_is_visible(client, headers):
    body = client.post("/api/feed", json={"text": "Lovely sunset today"}, headers=headers).json()
    assert body["held"] is False and body["show_helpline"] is False
    feed = client.get("/api/feed", headers=headers).json()
    assert any(p["text"] == "Lovely sunset today" for p in feed)


def test_post_length_is_limited(client, headers):
    r = client.post("/api/feed", json={"text": "x" * 1001}, headers=headers)
    assert r.status_code == 422
    r = client.post("/api/feed", json={"text": ""}, headers=headers)
    assert r.status_code == 422


def test_reported_post_is_hidden_after_three_reports(client, headers, db):
    post = client.post("/api/feed", json={"text": "Something unkind"}, headers=headers).json()
    reporters = [make_user(db, email=f"r{i}@example.com") for i in range(3)]

    # The same person reporting twice only counts once.
    client.post(f"/api/feed/{post['id']}/report", json={"reason": "rude"}, headers=auth_header(reporters[0]))
    client.post(f"/api/feed/{post['id']}/report", json={"reason": "rude"}, headers=auth_header(reporters[0]))
    client.post(f"/api/feed/{post['id']}/report", json={}, headers=auth_header(reporters[1]))
    feed = client.get("/api/feed", headers=headers).json()
    assert any(p["id"] == post["id"] for p in feed)

    r = client.post(f"/api/feed/{post['id']}/report", headers=auth_header(reporters[2]))
    assert r.status_code == 200
    feed = client.get("/api/feed", headers=headers).json()
    assert all(p["id"] != post["id"] for p in feed)


def test_report_unknown_post(client, headers):
    assert client.post("/api/feed/nope/report", json={}, headers=headers).status_code == 404


# ── Journal ──────────────────────────────────────────────────────────────

def test_crisis_journal_entry_is_saved_privately_and_shows_helpline(client, headers):
    body = client.post("/api/journal", json={"text": "I keep thinking about suicide", "mood": "blue"},
                       headers=headers).json()
    assert body["crisis"] is True and body["helplines"]
    entries = client.get("/api/journal", headers=headers).json()
    assert len(entries) == 1
