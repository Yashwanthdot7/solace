"""Shared test setup.

Everything here runs BEFORE server.py is imported, so the app starts with
fake settings, an in-memory database, no email and no Gemini.
"""
import os
import sys
from pathlib import Path

import pytest

BACKEND = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND))

# Fake settings (server.py reads these at import time).
os.environ["SUPABASE_URL"] = "https://test-project.supabase.co"
os.environ["SUPABASE_SECRET_KEY"] = "test-secret-key"
os.environ["JWT_SECRET"] = "test-jwt-secret-that-is-at-least-32-characters-long"
os.environ["GEMINI_API_KEY"] = ""
os.environ["SMTP_USER"] = ""
os.environ["SMTP_PASS"] = ""

from tests.fake_supabase import FakeSupabase  # noqa: E402

FAKE_DB = FakeSupabase()

import supabase as _supabase_pkg  # noqa: E402

_supabase_pkg.create_client = lambda url, key: FAKE_DB

import server  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402


@pytest.fixture(autouse=True)
def db():
    """A fresh, empty in-memory database for every test."""
    FAKE_DB.reset()
    yield FAKE_DB
    FAKE_DB.reset()


@pytest.fixture
def client():
    return TestClient(server.app)


def make_user(db, email="member@example.com", password="secret123", name="Asha Rao",
              role="elder", verified=True, **extra):
    """Put a user straight into the fake database and return the row."""
    import uuid

    row = {
        "id": str(uuid.uuid4()), "email": email, "password": server.hash_pw(password),
        "name": name, "role": role, "locality": "Bengaluru", "points": 0, "streak": 1,
        "score": 72, "goals": [], "created_at": server.now_iso(), "guardian_email": None,
        "email_verified": verified,
    }
    row.update(extra)
    db.tables.setdefault("users", []).append(row)
    return row


def auth_header(user):
    return {"Authorization": f"Bearer {server.make_token(user['id'])}"}


@pytest.fixture
def user(db):
    return make_user(db)


@pytest.fixture
def headers(user):
    return auth_header(user)
