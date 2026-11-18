"""Guardian consent, what guardians can see, Gemini data, export and delete."""
import pytest

import server
from tests.conftest import auth_header, make_user


@pytest.fixture
def member(db):
    return make_user(db, email="amma@example.com", name="Lakshmi Devi", role="elder", password="member-pass")


@pytest.fixture
def guardian(db):
    return make_user(db, email="son@example.com", name="Ravi Devi", role="guardian")


def invite_and_accept(client, member, guardian, **opts):
    r = client.post("/api/guardian/invite", json={"guardian_email": guardian["email"], **opts},
                    headers=auth_header(member))
    assert r.status_code == 200, r.text
    link_id = r.json()["id"]
    r = client.post(f"/api/guardian/accept/{link_id}", headers=auth_header(guardian))
    assert r.status_code == 200
    return link_id


# ── Consent flow ─────────────────────────────────────────────────────────

def test_guardian_without_link_sees_nothing(client, member, guardian):
    gh = auth_header(guardian)
    assert client.get("/api/guardian/members", headers=gh).json() == []
    assert client.get(f"/api/guardian/report/{member['id']}", headers=gh).status_code == 404


def test_pending_invite_gives_no_access(client, member, guardian):
    r = client.post("/api/guardian/invite", json={"guardian_email": guardian["email"]}, headers=auth_header(member))
    assert r.json()["status"] == "pending"
    gh = auth_header(guardian)
    assert client.get("/api/guardian/members", headers=gh).json() == []
    assert client.get(f"/api/guardian/report/{member['id']}", headers=gh).status_code == 404
    invites = client.get("/api/guardian/invites", headers=gh).json()
    assert [i["member_name"] for i in invites] == ["Lakshmi Devi"]


def test_accepted_link_gives_access_and_revoke_cuts_it(client, member, guardian):
    link_id = invite_and_accept(client, member, guardian)
    gh = auth_header(guardian)
    members = client.get("/api/guardian/members", headers=gh).json()
    assert [m["id"] for m in members] == [member["id"]]
    assert client.get(f"/api/guardian/report/{member['id']}", headers=gh).status_code == 200

    # The member revokes: access stops immediately.
    r = client.post(f"/api/guardian/revoke/{link_id}", headers=auth_header(member))
    assert r.status_code == 200
    assert client.get("/api/guardian/members", headers=gh).json() == []
    assert client.get(f"/api/guardian/report/{member['id']}", headers=gh).status_code == 404


def test_guardian_can_also_revoke(client, member, guardian):
    link_id = invite_and_accept(client, member, guardian)
    client.post(f"/api/guardian/revoke/{link_id}", headers=auth_header(guardian))
    assert client.get("/api/guardian/members", headers=auth_header(guardian)).json() == []


def test_only_the_invited_email_can_accept(client, db, member, guardian):
    r = client.post("/api/guardian/invite", json={"guardian_email": guardian["email"]}, headers=auth_header(member))
    stranger = make_user(db, email="stranger@example.com")
    r = client.post(f"/api/guardian/accept/{r.json()['id']}", headers=auth_header(stranger))
    assert r.status_code == 403


def test_stranger_cannot_revoke_or_change_a_link(client, db, member, guardian):
    link_id = invite_and_accept(client, member, guardian)
    stranger = make_user(db, email="stranger@example.com")
    assert client.post(f"/api/guardian/revoke/{link_id}", headers=auth_header(stranger)).status_code == 403
    r = client.patch(f"/api/guardian/links/{link_id}", json={"share_level": "moods"}, headers=auth_header(guardian))
    assert r.status_code == 403  # only the member changes sharing


def test_cannot_invite_yourself_or_twice(client, member, guardian):
    mh = auth_header(member)
    assert client.post("/api/guardian/invite", json={"guardian_email": member["email"]}, headers=mh).status_code == 400
    client.post("/api/guardian/invite", json={"guardian_email": guardian["email"]}, headers=mh)
    assert client.post("/api/guardian/invite", json={"guardian_email": guardian["email"]}, headers=mh).status_code == 400


def test_member_sees_their_guardians(client, member, guardian):
    invite_and_accept(client, member, guardian)
    links = client.get("/api/me/guardians", headers=auth_header(member)).json()
    assert links[0]["guardian_email"] == guardian["email"] and links[0]["status"] == "active"


def test_onboarding_guardian_email_creates_pending_invite(client, db, member, guardian):
    r = client.post("/api/onboarding/complete", json={"goals": [], "guardian_email": guardian["email"]},
                    headers=auth_header(member))
    assert r.json()["guardian_invited"] is True
    assert db.tables["guardian_links"][0]["status"] == "pending"
    # No instant access the old way.
    assert client.get("/api/guardian/members", headers=auth_header(guardian)).json() == []


# ── What guardians see ───────────────────────────────────────────────────

def _add_activity(client, member):
    mh = auth_header(member)
    client.post("/api/journal", json={"text": "SECRET journal words", "mood": "heavy"}, headers=mh)
    client.post("/api/feed", json={"text": "SECRET post words"}, headers=mh)
    client.post("/api/mitra/chat", json={"message": "SECRET chat words"}, headers=mh)


def test_summary_level_never_shows_content_or_moods(client, member, guardian):
    invite_and_accept(client, member, guardian)
    _add_activity(client, member)
    r = client.get(f"/api/guardian/report/{member['id']}", headers=auth_header(guardian))
    text = r.text
    assert "SECRET" not in text
    assert "mood:" not in text
    assert "heavy" not in text
    assert member["email"] not in text
    assert "password" not in text


def test_moods_level_shows_mood_labels_but_never_content(client, member, guardian):
    link_id = invite_and_accept(client, member, guardian)
    client.patch(f"/api/guardian/links/{link_id}", json={"share_level": "moods"}, headers=auth_header(member))
    _add_activity(client, member)
    text = client.get(f"/api/guardian/report/{member['id']}", headers=auth_header(guardian)).text
    assert "mood: heavy" in text
    assert "SECRET" not in text


def test_member_card_only_has_safe_fields(client, member, guardian):
    invite_and_accept(client, member, guardian)
    card = client.get("/api/guardian/members", headers=auth_header(guardian)).json()[0]
    assert set(card) <= {"id", "name", "relation", "age", "score", "band", "insight", "last_seen",
                         "avatar", "weekly", "share_level"}


def test_gemini_gets_no_names_or_text(client, monkeypatch, member, guardian):
    prompts = []

    async def fake_generate(prompt, max_tokens, timeout=15):
        prompts.append(prompt)
        return None

    monkeypatch.setattr(server, "GEMINI_API_KEY", "fake-key")
    monkeypatch.setattr(server, "_gemini_generate", fake_generate)
    monkeypatch.setattr(server, "_call_gemini_chat", lambda *a: _none())
    invite_and_accept(client, member, guardian)
    _add_activity(client, member)
    client.get(f"/api/guardian/report/{member['id']}", headers=auth_header(guardian))
    assert prompts
    joined = " ".join(prompts)
    assert "Lakshmi" not in joined and "SECRET" not in joined


async def _none():
    return None


def test_gemini_key_is_sent_in_header_not_url(monkeypatch):
    seen = {}

    class FakeResponse:
        status_code = 200

        def json(self):
            return {"candidates": [{"content": {"parts": [{"text": "ok"}]}}]}

    class FakeClient:
        def __init__(self, *a, **k):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *a):
            return False

        async def post(self, url, json=None, headers=None):
            seen["url"], seen["headers"] = url, headers
            return FakeResponse()

    import asyncio
    monkeypatch.setattr(server, "GEMINI_API_KEY", "fake-key")
    monkeypatch.setattr(server.httpx, "AsyncClient", FakeClient)
    asyncio.run(server._gemini_generate("hi", 10))
    assert "fake-key" not in seen["url"]
    assert seen["headers"]["x-goog-api-key"] == "fake-key"


def test_no_fake_members_or_chat_notice_without_demo_mode(client, guardian, headers):
    assert client.get("/api/guardian/members", headers=auth_header(guardian)).json() == []
    assert client.get("/api/chat/messages").json() == []


def test_demo_members_only_in_demo_mode(client, guardian, monkeypatch):
    monkeypatch.setattr(server, "DEMO_MODE", True)
    members = client.get("/api/guardian/members", headers=auth_header(guardian)).json()
    assert members and all(m["name"].startswith("Demo") for m in members)


# ── Crisis alert to guardian (only with consent) ─────────────────────────

def test_crisis_alert_only_when_member_opted_in(client, monkeypatch, member, guardian):
    sent = []

    async def fake_send(to, subject, html):
        sent.append((to, subject, html))

    monkeypatch.setattr(server, "send_email", fake_send)
    link_id = invite_and_accept(client, member, guardian)
    sent.clear()
    mh = auth_header(member)
    client.post("/api/mitra/chat", json={"message": "I want to end my life"}, headers=mh)
    assert sent == []  # not opted in

    client.patch(f"/api/guardian/links/{link_id}", json={"alert_on_crisis": True}, headers=mh)
    client.post("/api/mitra/chat", json={"message": "I want to end my life"}, headers=mh)
    assert len(sent) == 1
    to, subject, html = sent[0]
    assert to == guardian["email"]
    assert "end my life" not in html  # no message content
    assert "14416" in html

    # Not repeated within 12 hours.
    client.post("/api/mitra/chat", json={"message": "I want to end my life"}, headers=mh)
    assert len(sent) == 1


# ── Export and delete ────────────────────────────────────────────────────

def test_export_contains_my_data_without_password(client, member, guardian):
    invite_and_accept(client, member, guardian)
    _add_activity(client, member)
    data = client.get("/api/me/export", headers=auth_header(member)).json()
    assert data["account"]["email"] == member["email"]
    assert "password" not in data["account"]
    assert data["journal"][0]["text"] == "SECRET journal words"
    assert data["mitra_messages"] and data["posts"]
    assert data["my_guardians"][0]["guardian_email"] == guardian["email"]


def test_delete_needs_correct_password(client, member):
    r = client.request("DELETE", "/api/me", json={"password": "wrong"}, headers=auth_header(member))
    assert r.status_code == 401


def test_delete_removes_account_and_all_linked_rows(client, db, member, guardian):
    invite_and_accept(client, member, guardian)
    _add_activity(client, member)
    other = make_user(db, email="other@example.com")
    client.post("/api/journal", json={"text": "other's entry"}, headers=auth_header(other))

    r = client.request("DELETE", "/api/me", json={"password": "member-pass"}, headers=auth_header(member))
    assert r.status_code == 200

    for table, rows in db.tables.items():
        for row in rows:
            assert member["id"] not in (row.get("id"), row.get("user_id"), row.get("member_id"),
                                        row.get("reporter_id")), (table, row)
    assert client.get("/api/auth/me", headers=auth_header(member)).status_code == 401
    assert client.get("/api/guardian/members", headers=auth_header(guardian)).json() == []
    assert len(db.tables["journal"]) == 1  # other people's data untouched
