# Solace: Implementation Plan to Launch

_Written 18 Nov 2026 from a read of `main` at commit `e9a06b6`._

This is a step-by-step plan to take Solace from "works on my machine" (roughly 70–75% done) to something safe to put in front of real people. It is written for a beginner: every task names the files to touch, says what "done" looks like, and gives a rough effort estimate.

**Effort key:** S = an hour or two · M = half a day to a day · L = two to three days. Estimates assume one person learning as they go.

**Golden rule for the whole plan:** one task = one branch = one small pull request. Small PRs are easier to review, easier to undo, and much less scary.

---

## Where things stand today

What works well already:

- Sign up with email OTP, login, forgot/reset password (`backend/server.py` lines ~300–480).
- Mitra chat with Gemini plus a fallback reply bank when Gemini is down (`/api/mitra/chat`).
- Four role dashboards: elder, youth, community, guardian (`frontend/src/pages/Dashboard*.jsx`).
- Journal, feed, events (Gemini search with a 6‑hour cache), games, riddles, hobbies, mindfulness, joy challenges, wellbeing score.
- A strong visual identity (tokens in `frontend/src/index.css`, shadcn components in `frontend/src/components/ui/`).

What blocks a launch:

| Area | Problem | Why it matters |
|---|---|---|
| Safety | Mitra has no crisis or self‑harm handling. A message like "I want to end it" gets a normal chatty reply. | This is the single biggest risk in a mental‑wellness app. |
| Consent | Anyone can type any email as `guardian_email` during onboarding, and that guardian then sees chat moods, journal moods and post text. The guardian is never asked, and the member cannot see or revoke it later. | Members (often elders) need to understand and control who watches them. |
| Data sent to Gemini | Guardian insights send the member's real name and activity to Gemini. | Should be minimised and disclosed in a privacy policy. |
| Database | No schema in the repo. Nobody else can set up the 12 tables the code uses. | You cannot rebuild, test, or hand over the project. |
| Tests | Zero tests (`tests/` only has an empty `__init__.py`). | Every change risks breaking login or chat without you noticing. |
| Security | OTP has no attempt limit and uses `random`, OTPs are printed to logs, `/api/health` shows the SMTP username, CORS defaults to `*`, Gemini key goes in the URL. | Easy wins that attackers look for first. |
| Fake data | Guardian dashboard shows made‑up members when none are linked, `/chat/messages` and `/organiser/active` are hardcoded, `/guardian/add` saves nothing, group chat messages are never sent. | Real users will be confused, or misled into thinking a real person is struggling. |
| Code shape | All backend logic is in one 1,800‑line `server.py`. | Hard to find things, hard to test. |
| Docs | README says MongoDB; the app actually uses Supabase. | New contributors (and future you) get lost. |

---

## Phase overview

| # | Phase | Goal | Effort |
|---|---|---|---|
| 0 | Foundations | Anyone can set up the DB and run tests | ~3–4 days |
| 1 | Safety | Mitra and the feed respond correctly to crisis messages | ~3–4 days |
| 2 | Privacy & consent | Members control what guardians see; data use is disclosed | ~4–5 days |
| 3 | Security hardening | Close the obvious holes in auth and config | ~2–3 days |
| 4 | Backend restructure | Split `server.py` into small modules, protected by tests | ~3–4 days |
| 5 | Finish features | Replace fake/stub data with real behaviour | ~5–7 days |
| 6 | Design tidy & accessibility | Consistent UI, readable for elders | ~3–4 days |
| 7 | Deploy & launch | Live, monitored, backed up | ~3–4 days |

**Total: roughly 6–8 weeks part‑time.** Phases 0–3 are the launch‑critical core (about 2.5 weeks). Phases 4–6 can overlap. Do not launch publicly before Phases 0–3 and the Phase 7 checklist are done.

---

## Phase 0 — Foundations (do this first)

Everything later depends on being able to recreate the database and run tests.

### 0.1 Write the database schema · M

The code uses these Supabase tables: `users`, `otps`, `password_resets`, `mitra_messages`, `journal`, `joy_completions`, `posts`, `rsvps`, `events_cache`, `hobbies`, `organiser_tasks`, `wellness_log`.

- Create `supabase/migrations/0001_init.sql` with a `create table` for each one. Work out the columns by searching `server.py` for each table name (e.g. `grep -n '"journal"' backend/server.py`) and looking at the dicts that get inserted.
  - Tip: in the Supabase dashboard, **Database → Tables** shows your current columns. You can also run `supabase db dump --schema public` with the Supabase CLI to export what you already have, then tidy it.
- Add primary keys, `not null` where the code always sets a value, `unique` on `users.email`, and indexes on `user_id` and `ts` for the activity tables.
- Turn on Row Level Security (RLS) on every table. The backend uses the secret (service) key so it bypasses RLS, but RLS stops anyone using the public anon key from reading data directly.
- Add `supabase/seed.sql` with a few demo users (one per role) and some sample posts, clearly named "Demo …".

**Done when:** a brand‑new Supabase project + running the two SQL files gives a working app.

### 0.2 Clean up dependencies · S

- `backend/requirements.txt` includes many unused packages (`boto3`, `pandas`, `numpy`, `jq`, `typer`, `requests-oauthlib`, `python-jose`, `passlib`). Remove what `server.py` does not import, and pin versions (e.g. `supabase==2.x.y`).
- Move dev tools (`pytest`, `black`, `flake8`, `mypy`, `isort`) into `backend/requirements-dev.txt`.
- Delete the stray `backend/package.json` and `backend/package-lock.json` (a Node file in a Python folder).
- Pick one package manager for the frontend: there is both `package-lock.json` and `yarn.lock`. Keep one and delete the other.

### 0.3 Set up a backend test harness · M

- Create `backend/tests/conftest.py` with:
  - Fake env vars set **before** importing `server` (so `os.environ['SUPABASE_URL']` does not crash).
  - A tiny in‑memory fake for the `_sb_one / _sb_insert / _sb_update / _sb_delete / _sb_list / _sb_inc` helpers (monkeypatch them to read/write a Python dict). This lets tests run with no internet and no real database.
  - A FastAPI `TestClient` fixture and a helper that creates a verified user and returns an auth header.
  - Gemini turned off (`GEMINI_API_KEY=""`) so tests are fast and predictable.
- Keep the existing `backend/pytest.ini` (it runs tests with 2 parallel workers). Move or remove the root `tests/__init__.py` so there is one tests folder.
- First tests to write (`backend/tests/test_auth.py`, `test_health.py`):
  - register → OTP stored → verify → login works.
  - login fails before email is verified (403).
  - wrong password → 401.
  - `/api/health` returns `status: ok`.

**Done when:** `cd backend && pytest` passes locally.

### 0.4 Continuous integration · S

- Add `.github/workflows/ci.yml` that on every push and PR: installs Python deps and runs `pytest`; installs frontend deps and runs `npm run build` (catches broken imports).

**Done when:** PRs show a green tick or red cross automatically.

### 0.5 Rewrite the README · S

- `README.md`: replace MongoDB with Supabase, list the real roles and features, and give copy‑paste setup steps (create Supabase project → run migrations → fill `.env` from `.env.example` → `uvicorn server:app --reload` → `npm start`).
- Add a short "Not a medical service" note (wording finalised in Phase 1).

---

## Phase 1 — Safety (launch‑blocking)

Goal: if someone says they want to hurt themselves, Solace always responds with care **and** real help, every time, even if Gemini is down.

### 1.1 Crisis detection module · M

- New file `backend/safety.py` with `detect_crisis(text) -> "none" | "concern" | "crisis"`.
  - Start with a careful phrase list (English first, then Hindi/Hinglish and Kannada since the app targets Bengaluru: e.g. "kill myself", "end my life", "no reason to live", "marna chahta", "jeena nahi"). Match whole phrases, case‑insensitive.
  - "concern" for softer signals (hopeless, "everyone would be better off").
- Unit tests in `backend/tests/test_safety.py` with a table of example messages and expected levels, including tricky false positives ("this traffic is killing me").

### 1.2 Crisis response in Mitra · M

In `mitra_chat` (`server.py` ~line 805):

- Run `detect_crisis` on the user's message **before** calling Gemini.
- On `crisis`: skip the playful persona entirely. Return a fixed, reviewed message that acknowledges the feeling, encourages reaching out now, and lists Indian helplines (e.g. **Tele‑MANAS 14416** / 1‑800‑891‑4416, and local emergency **112**). Verify the numbers are current before launch. Add `"crisis": true` to the response.
- On `concern`: still call Gemini, but with a calmer persona and a gentle check‑in, plus the helpline line at the end.
- Add safety rules to every persona in `PERSONAS` (~line 663): never give advice on methods, never claim to be a therapist, always encourage professional help for serious distress.
- Pass Gemini `safetySettings` in the request body in `_call_gemini_chat`.
- Store a `risk_level` column on `mitra_messages` (add to the migration).
- Require login for `/mitra/chat` (it currently allows anonymous use through `get_user_optional`), so a follow‑up is possible.

### 1.3 Crisis UI · M

- In `frontend/src/components/MitraOrb.jsx`, when the response has `crisis: true`: show a calm, high‑contrast card with tap‑to‑call buttons (`tel:14416`, `tel:112`), and do not play the upbeat voice.
- Add a permanent small "Need help now?" link in `AppLayout.jsx` that opens the same helpline card from any page.
- Write `frontend/src/constants/helplines.js` so the numbers live in one place.

### 1.4 Feed and journal safety · S

- Run `detect_crisis` on `/feed` posts and `/journal` entries. For the feed: hold crisis posts from public view and show the poster the helpline card. For the journal: keep the entry private but show the helpline card.
- Add a "Report post" button and a max length on posts.

### 1.5 Guardian alert (only with consent) · S

- If a member has consented in Phase 2 to "alert my guardian if I seem in crisis", email the guardian a short notice (no message content). Build this after 2.1 exists.

### 1.6 Disclaimers · S

- First‑run screen in `Onboarding.jsx` and footer in `Landing.jsx`: "Mitra is an AI companion, not a doctor or therapist. In an emergency call 112."

**Done when:** tests cover crisis detection and the chat endpoint returns the helpline response for crisis messages with Gemini switched off and on.

---

## Phase 2 — Privacy & consent (launch‑blocking)

Goal: members decide who sees what, and the app tells them plainly what happens to their data.

### 2.1 Real guardian linking with two‑sided consent · L

Today, `guardian_email` is just typed in during onboarding (`OnboardingIn`, ~line 484) and the guardian immediately sees data.

- New table `guardian_links` (`id, member_id, guardian_email, guardian_id, status: pending|active|revoked, share_level, created_at`).
- Flow: member invites guardian by email → guardian gets an email and accepts in the app → link becomes `active`. Either side can revoke.
- Replace the stub `/guardian/add` (~line 1443, currently saves nothing) with real invite endpoints: `POST /guardian/invite`, `POST /guardian/accept/{id}`, `POST /guardian/revoke/{id}`, `GET /me/guardians`.
- Change `/guardian/members` and `/guardian/report/{id}` to only read `active` links.
- Add a "Who can see my wellbeing" section in settings for the member.

### 2.2 Share less by default · M

In `guardian_report` (~line 1361) the guardian currently sees the first 40 characters of feed posts and mood labels.

- Default share level = **summary only**: score band, activity counts, trend. No post text, no journal content, no chat content, ever.
- Optional higher level the member can turn on: mood labels.
- Journals and Mitra conversations are never shown to guardians. Say so in the UI.

### 2.3 Minimise what goes to Gemini · S

- In `_gemini_guardian_insight` and `_gemini_guardian_recommendations` (~lines 1153–1215), send a first name or "your family member" instead of the full name, and only counts/bands, not text.
- Move the Gemini key from the URL query string to the `x-goog-api-key` header (keys in URLs end up in logs).

### 2.4 Remove fake people from real dashboards · S

- `_FALLBACK_MEMBERS` (~line 1137) is shown to any guardian with no linked members. Replace with an empty state: "No one has linked you yet. Ask your family member to invite you." Keep demo data only behind a `DEMO_MODE=true` env flag.
- Same for the hardcoded `/chat/messages` notice that says a named person "mentioned feeling low… guardian quietly notified".

### 2.5 User data rights · M

- `GET /me/export` returns all the user's data as JSON. `DELETE /me` deletes the account and all rows linked to `user_id`.
- Add both buttons to a simple settings page.

### 2.6 Privacy policy and terms · M

- New pages `frontend/src/pages/Privacy.jsx` and `Terms.jsx`, linked from the landing footer and onboarding.
- Plain language: what is stored, that chat messages are processed by Google Gemini, what guardians can see, how to delete. If you will launch in India, read up on the DPDP Act 2023 basics (consent, purpose, deletion). Consider a short review by someone with legal knowledge before launch.
- Onboarding gets an explicit consent checkbox that links to the policy; store `consented_at` on `users`.

**Done when:** tests prove a guardian without an `active` link gets nothing, and a revoked link cuts access immediately.

---

## Phase 3 — Security hardening (launch‑blocking)

Each item is small. Write a test for each where you can.

| # | Task | Where | Effort |
|---|---|---|---|
| 3.1 | Generate OTPs with `secrets.randbelow` instead of `random.randint` | register, `send_otp` (~lines 327, 366) | S |
| 3.2 | Limit OTP attempts (e.g. 5 tries then the code is deleted) and add `attempts` to `otps` | `verify_otp` (~line 388) | S |
| 3.3 | Rate‑limit login, OTP, forgot‑password and Mitra chat (library: `slowapi`) | auth routes, chat | M |
| 3.4 | Only print OTPs to the console when `ENV=development` | register, `send_otp` | S |
| 3.5 | `/api/health` should return only `status` and DB ok/fail; drop SMTP username and secret length | ~line 1765 | S |
| 3.6 | Default `CORS_ORIGINS` to your real frontend URL, never `*` with credentials | ~line 1757, `.env.example` | S |
| 3.7 | Shorten JWT lifetime (30 days → 7) and validate `JWT_SECRET` is at least 32 chars at startup | `make_token` | S |
| 3.8 | Input limits on Pydantic models (`max_length` on text, `ge/le` on points) | all `*In` models | S |
| 3.9 | Stop points farming: one heart per user per post, one claim per user per task, one riddle answer per day | `feed_heart`, `task_claim`, `riddle_answer` | M |
| 3.10 | Only community role can create organiser events (check is missing on `/organiser/events`) | ~line 979 | S |
| 3.11 | Consider storing the token in memory + httpOnly cookie instead of `localStorage` (optional, can wait) | `frontend/src/lib/api.js`, `AuthContext.jsx` | M |

**Done when:** each fix has a test and CI is green.

---

## Phase 4 — Backend restructure

Only start this once Phase 0 tests exist, because the tests are what tell you nothing broke.

Split `backend/server.py` into a package, moving one section at a time (one PR each):

```
backend/
  app/
    main.py          # create FastAPI app, CORS, include routers
    config.py        # env vars
    db.py            # supabase client + _sb_* helpers
    auth.py          # hashing, JWT, get_user
    email.py         # SMTP + templates
    gemini.py        # one shared Gemini client function
    safety.py        # from Phase 1
    routers/
      auth.py  mitra.py  journal.py  feed.py  guardian.py
      events.py  games.py  wellness.py  organiser.py  score.py
    content/         # static lists: PERSONAS, CHALLENGES, RIDDLES, WELLNESS…
  tests/
```

- Keep `server.py` as a one‑line shim (`from app.main import app`) so the run command does not change.
- Merge the three copies of the Gemini call into `gemini.py`.
- Replace `@app.on_event("startup")` with FastAPI's lifespan handler (the old one is deprecated).

Effort: L overall, but each router move is S.

---

## Phase 5 — Finish features

Replace stubs and hardcoded data with real behaviour. Prioritise by how many users see it.

| # | Feature | Current state | Task | Effort |
|---|---|---|---|---|
| 5.1 | Neighbourhood group chat | `Chat.jsx` messages are never sent; `/chat/messages` is hardcoded | New `chat_messages` table, `POST /chat/messages`, poll every few seconds (or Supabase Realtime later). Run crisis check on messages. | L |
| 5.2 | Organiser events | `/organiser/events` saves as a feed post | Real `events` table; show organiser events next to Gemini events in `/events`. | M |
| 5.3 | Active organisers | `/organiser/active` hardcoded | Query users with role `community` ordered by tasks issued. | S |
| 5.4 | Feed seed posts | `_seed_posts()` shown when DB empty | Move to `seed.sql`; show a friendly empty state instead. | S |
| 5.5 | Event dates | Static fallback events | Make sure past events are hidden; show "last updated" time. | S |
| 5.6 | Duplicate guardian pages | Both `Guardian.jsx` and `DashboardGuardian.jsx` exist | Decide which one is real, delete or merge the other. | S |
| 5.7 | Mood history | Mood is stored but not charted | Simple 30‑day mood chart on dashboards (reuse `ScoreGauge` style). | M |
| 5.8 | Error and loading states | Many pages assume API success | Add loading skeletons and error toasts on every `api.get` call. | M |
| 5.9 | Frontend tests | None | React Testing Library smoke tests: each page renders, login form submits, crisis card shows. | M |

---

## Phase 6 — Design tidy & accessibility

Coordinate with the separate design‑system extraction work so this phase uses the same tokens.

- **Tokens:** replace hardcoded hex values in JSX (e.g. `bg-[#080808]`, `text-[#C8F04B]` in `App.js`, `Chat.jsx`) with the Tailwind theme names from `tailwind.config.js` / CSS variables in `index.css`. One page per PR. · M
- **Elder‑friendly mode:** larger base font (18px+), higher contrast, bigger tap targets, and turn off the custom cursor (`Cursor.jsx`), grain and marquee animations. Add a toggle and default it on for the elder role. · M
- **Reduced motion:** respect `prefers-reduced-motion` for Framer Motion page transitions and the loading screen. · S
- **Accessibility pass:** labels on all inputs, `alt` text on images, keyboard navigation for the Mitra orb, colour contrast check on lavender/coral text. Use the Lighthouse tab in Chrome. · M
- **Remove unused shadcn components** in `components/ui/` you never import (smaller bundle). · S
- **Mobile check:** test every page at phone width. · S

---

## Phase 7 — Deploy & launch

### 7.1 Environments · M

- Two Supabase projects: `solace-dev` and `solace-prod`. Apply migrations to both.
- Backend hosting: Render, Railway or Fly.io (all have free/cheap tiers for FastAPI). Start command `uvicorn server:app --host 0.0.0.0 --port $PORT`.
- Frontend hosting: Vercel or Netlify. Set `REACT_APP_BACKEND_URL` to the production API.
- Set all secrets in the host's dashboard, never in Git. Rotate any key that has ever been committed or shared.
- Use a real sending service (Resend, Brevo, Amazon SES) instead of a personal Gmail for OTP email, with a domain you own.

### 7.2 Monitoring & backups · S

- Error tracking: Sentry free tier for both frontend and backend.
- Uptime ping on `/api/health` (UptimeRobot or Better Stack).
- Turn on Supabase daily backups; test restoring once.
- Make sure logs never contain OTPs, passwords, journal text or chat text.

### 7.3 Launch checklist

- [ ] Phases 0–3 complete, CI green
- [ ] Crisis flow tested by hand on phone and desktop, helpline numbers re‑verified
- [ ] Privacy policy and terms live, consent checkbox working
- [ ] A guardian can only see a member who accepted, and the member can revoke
- [ ] No demo/fake data visible with `DEMO_MODE` off
- [ ] Account delete and data export tested
- [ ] Rate limits on auth and chat working
- [ ] Backups on, Sentry and uptime alerts reach your phone/email
- [ ] Soft launch with 5–10 friendly testers (including at least one elder) before a public launch

---

## Suggested order of pull requests

1. `0.2` dependency cleanup
2. `0.1` schema + seed
3. `0.3` test harness + auth tests, `0.4` CI
4. `0.5` README
5. `1.1` safety module + tests
6. `1.2` + `1.3` Mitra crisis response and UI
7. `1.4` + `1.6` feed/journal checks and disclaimers
8. `3.1`–`3.8` security fixes (2–3 small PRs)
9. `2.1` guardian consent links
10. `2.2`–`2.4` share less, minimise Gemini data, remove fake members
11. `1.5` guardian crisis alert (needs 2.1)
12. `2.5` + `2.6` data rights and privacy policy
13. `3.9`–`3.10` points farming and organiser checks
14. Phase 4 router moves, one per PR
15. Phase 5 features in table order
16. Phase 6 design passes
17. Phase 7 deploy, then launch checklist

## Tips for working through this

- Before each task, write the test first if you can, watch it fail, then make it pass.
- Run `pytest` and `npm run build` before every PR.
- If a task feels bigger than its estimate, split it into two PRs instead of pushing through.
- Keep this file up to date: tick tasks off or add notes as you learn things.
