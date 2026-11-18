<div align="center">

# 🌿 SOLACE

**A wellbeing and community app for Bengaluru, with an AI companion called Mitra**

[![CI](https://github.com/Yashwanthdot7/solace/actions/workflows/ci.yml/badge.svg)](https://github.com/Yashwanthdot7/solace/actions/workflows/ci.yml)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react)](https://react.dev/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.110-009688?style=flat-square&logo=fastapi)](https://fastapi.tiangolo.com/)
[![Supabase](https://img.shields.io/badge/Supabase-Postgres-3FCF8E?style=flat-square&logo=supabase)](https://supabase.com/)
[![Gemini](https://img.shields.io/badge/Google-Gemini-4285F4?style=flat-square&logo=google)](https://ai.google.dev/)

</div>

> **Solace is not a medical service.** Mitra is an AI companion, not a doctor or therapist.
> In an emergency in India call **112**. For mental-health support call **Tele-MANAS 14416**
> (free, 24×7).

---

## What it does

Solace helps people stay connected and look after their wellbeing. There are four kinds of member, each with their own dashboard:

| Role | Who it is for | Highlights |
|---|---|---|
| **Elder** | People 60+ who may feel isolated | Mitra chat, daily joy challenge, journal, games, local events |
| **Youth** | Young adults, often stressed or new to the city | Mitra chat, feed, events, hobbies, mindfulness |
| **Community** (organiser) | People who run local groups | Issue tasks, create events, anonymised community health |
| **Guardian** | Family members who look out for someone | A wellbeing summary of a linked family member |

Main features: email sign-up with a one-time code, Mitra (Gemini-powered chat with a built-in fallback when Gemini is down), journal, community feed, events (live from Gemini with a 6-hour cache), games and riddles, hobbies, mindfulness sessions, joy challenges and a wellbeing score.

## Tech stack

- **Frontend:** React 19, React Router 7, Tailwind CSS + shadcn/Radix UI, Framer Motion, built with CRACO. Package manager: **Yarn**.
- **Backend:** Python FastAPI in a single file, `backend/server.py`.
- **Database:** [Supabase](https://supabase.com/) (hosted Postgres). Schema lives in `supabase/migrations/`.
- **AI:** Google Gemini 2.0 Flash over its REST API.
- **Email:** any SMTP account (Gmail App Password works for development).

## Project layout

```
solace/
├── backend/
│   ├── server.py              # the whole API
│   ├── requirements.txt       # runtime packages
│   ├── requirements-dev.txt   # test and lint tools
│   ├── tests/                 # pytest tests (use an in-memory fake database)
│   └── .env.example
├── frontend/
│   ├── src/                   # pages, components, contexts, lib
│   └── .env.example
├── supabase/
│   ├── migrations/            # SQL that creates the tables
│   └── seed.sql               # demo data for a development project
├── docs/IMPLEMENTATION_PLAN.md
└── .github/workflows/ci.yml   # runs tests + build on every PR
```

## Getting started

You need **Python 3.11+**, **Node.js 18+** with **Yarn 1.22**, a free **Supabase** project, a **Gemini API key** (optional, Mitra falls back to built-in replies without one) and optionally an SMTP account.

### 1. Create the database

1. Create a project at [supabase.com](https://supabase.com/dashboard).
2. Open **SQL Editor**, paste in each file from `supabase/migrations/` in number order, and press **Run** for each.
3. (Development only) paste in `supabase/seed.sql` and run it. This adds four demo accounts, one per role, all with the password `demo-password-123`. Never run the seed on a real production project.
4. Go to **Settings → API** and copy the **Project URL** and the **secret** (service role) key.

### 2. Run the backend

```bash
cd backend
python -m venv venv
source venv/bin/activate            # Windows: venv\Scripts\activate
pip install -r requirements.txt -r requirements-dev.txt
cp .env.example .env                # then fill in the values
uvicorn server:app --reload --port 8000
```

`backend/.env` needs at least `SUPABASE_URL`, `SUPABASE_SECRET_KEY` and `JWT_SECRET`. See `.env.example` for every option and how to get each value. If SMTP is not set up and `ENV=development`, sign-up codes are printed in the backend console. In production (the default) codes are never logged.

Check it works: open <http://localhost:8000/api/health>. API docs are at <http://localhost:8000/docs>.

### 3. Run the frontend

```bash
cd frontend
yarn install
cp .env.example .env                # REACT_APP_BACKEND_URL=http://localhost:8000
yarn start
```

The app opens at <http://localhost:3000>.

## Running the tests

```bash
cd backend
pytest
```

The tests use a fake in-memory database and never call Supabase, Gemini or email, so they need no `.env` and no internet. The same tests and a frontend build run automatically on every pull request (see the **Checks** tab on GitHub).

## Security notes

- Never commit `.env` files. They are in `.gitignore`.
- The backend uses the Supabase **secret** key, so keep it on the server only. Row Level Security is switched on for every table, so the public anon key cannot read data.
- If a key has ever been committed or shared, rotate it in the provider's dashboard.

## Roadmap

See [`docs/IMPLEMENTATION_PLAN.md`](docs/IMPLEMENTATION_PLAN.md) for the step-by-step plan to launch.
