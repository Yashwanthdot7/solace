"""Quick checks that the main logged-in features respond."""


def test_journal_add_and_list(client, headers):
    r = client.post("/api/journal", json={"text": "Had a quiet, good day.", "mood": "calm"}, headers=headers)
    assert r.status_code == 200
    r = client.get("/api/journal", headers=headers)
    assert r.status_code == 200
    assert [e["text"] for e in r.json()] == ["Had a quiet, good day."]


def test_feed_post_and_list(client, headers):
    r = client.post("/api/feed", json={"text": "Anyone for a walk?", "category": "fitness"}, headers=headers)
    assert r.status_code == 200
    r = client.get("/api/feed", headers=headers)
    assert any(p["text"] == "Anyone for a walk?" for p in r.json())


def test_mitra_chat_works_without_gemini(client, headers):
    r = client.post("/api/mitra/chat", json={"message": "Hello Mitra"}, headers=headers)
    assert r.status_code == 200
    assert r.json()["reply"]


def test_score_and_joy(client, headers):
    assert client.get("/api/score", headers=headers).status_code == 200
    assert client.get("/api/joy/today", headers=headers).status_code == 200
    r = client.post("/api/joy/complete", headers=headers)
    assert r.json().get("celebrated") is True
    r = client.post("/api/joy/complete", headers=headers)
    assert r.json().get("already") is True
