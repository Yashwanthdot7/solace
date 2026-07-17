<div align="center">

# 🌿 SOLACE

**Your personal mental-wellness companion — powered by AI**

*A full-stack web application that provides a safe, compassionate space for emotional support, mood tracking, and self-care.*

---

[![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react)](https://react.dev/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.110-009688?style=flat-square&logo=fastapi)](https://fastapi.tiangolo.com/)
[![MongoDB](https://img.shields.io/badge/MongoDB-Motor-47A248?style=flat-square&logo=mongodb)](https://motor.readthedocs.io/)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-3.4-38B2AC?style=flat-square&logo=tailwindcss)](https://tailwindcss.com/)
[![Gemini](https://img.shields.io/badge/Google-Gemini_AI-4285F4?style=flat-square&logo=google)](https://ai.google.dev/)

</div>

---

## ✨ Overview

**SOLACE** is a mental-wellness platform designed to help users reflect, track their emotional health, and receive empathetic AI-guided support. Built with a modern React frontend and a FastAPI backend, SOLACE combines intelligent conversation with structured well-being features.

---

## 🚀 Features

| Feature | Description |
|---|---|
| 🔐 **Authentication** | Secure sign-up / login with JWT + OTP email verification |
| 🧠 **AI Companion** | Conversational support powered by Google Gemini AI |
| 📊 **Mood Tracking** | Log and visualise your emotional patterns over time |
| 📓 **Journaling** | Private, encrypted personal journal entries |
| 🎯 **Onboarding** | Personalised onboarding flow to tailor the experience |
| 📧 **Email Notifications** | OTP verification and well-being reminders via SMTP |
| 🌙 **Dark-first UI** | Sleek, minimal dark interface built with Radix UI + Tailwind |

---

## 🗂️ Project Structure

```
solace/
├── backend/                  # FastAPI Python backend
│   ├── server.py             # Main API server (routes, auth, AI, DB)
│   ├── requirements.txt      # Python dependencies
│   ├── pytest.ini            # Test configuration
│   └── .env.example          # Environment variable template
│
├── frontend/                 # React 19 frontend
│   ├── src/
│   │   ├── components/       # Reusable UI components (Onboarding, etc.)
│   │   ├── contexts/         # React context providers (AuthContext)
│   │   ├── pages/            # Page-level components
│   │   ├── hooks/            # Custom React hooks
│   │   ├── lib/              # Utility helpers
│   │   └── constants/        # App-wide constants
│   ├── public/               # Static assets
│   ├── package.json          # Node dependencies
│   └── tailwind.config.js    # Tailwind configuration
│
└── tests/                    # Integration / end-to-end tests
```

---

## 🛠️ Tech Stack

### Backend
- **[FastAPI](https://fastapi.tiangolo.com/)** — High-performance Python web framework
- **[Motor](https://motor.readthedocs.io/)** — Async MongoDB driver
- **[PyJWT](https://pyjwt.readthedocs.io/)** + **[bcrypt](https://pypi.org/project/bcrypt/)** — Authentication & password hashing
- **[Google Gemini AI](https://ai.google.dev/)** — Conversational AI engine
- **SMTP** — Email delivery for OTP verification

### Frontend
- **[React 19](https://react.dev/)** + **[React Router v7](https://reactrouter.com/)** — UI framework & routing
- **[TailwindCSS 3](https://tailwindcss.com/)** + **[Radix UI](https://www.radix-ui.com/)** — Styling & accessible components
- **[Framer Motion](https://www.framer.com/motion/)** — Animations
- **[Recharts](https://recharts.org/)** — Data visualisation
- **[React Hook Form](https://react-hook-form.com/)** + **[Zod](https://zod.dev/)** — Form handling & validation
- **[Axios](https://axios-http.com/)** — HTTP client

---

## ⚙️ Getting Started

### Prerequisites

- **Python** ≥ 3.11
- **Node.js** ≥ 18 & **Yarn** ≥ 1.22
- A running **MongoDB** instance (local or Atlas)
- A **Google Gemini API** key
- An SMTP email account (e.g. Gmail with App Password)

---

### 1. Clone the Repository

```bash
git clone https://github.com/<your-username>/solace.git
cd solace
```

---

### 2. Backend Setup

```bash
cd backend

# Create & activate a virtual environment
python -m venv venv
# Windows
venv\Scripts\activate
# macOS / Linux
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Copy the env template and fill in your values
cp .env.example .env
```

**`backend/.env` variables:**

```env
MONGO_URL=mongodb://localhost:27017
DB_NAME=solace
JWT_SECRET=your_super_secret_jwt_key

GEMINI_API_KEY=your_gemini_api_key

SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your@email.com
SMTP_PASS=your_app_password
SMTP_FROM=SOLACE <noreply@solace.in>

FRONTEND_URL=http://localhost:3000
```

**Start the backend server:**

```bash
uvicorn server:app --reload --port 8000
```

The API will be available at `http://localhost:8000`. Interactive docs at `http://localhost:8000/docs`.

---

### 3. Frontend Setup

```bash
cd frontend

# Install dependencies
yarn install

# Copy the env template and fill in your values
cp .env.example .env
```

**`frontend/.env` variables:**

```env
REACT_APP_BACKEND_URL=http://localhost:8000
```

**Start the development server:**

```bash
yarn start
```

The app will open at `http://localhost:3000`.

---

## 🧪 Running Tests

```bash
cd backend
pytest
```

---

## 🔒 Security Notes

> **Never commit your `.env` files.** They are listed in `.gitignore` and contain secrets such as API keys, JWT secrets, and SMTP credentials.

Before pushing, ensure you have created `.env.example` files in both `backend/` and `frontend/` with placeholder values — these **are** safe to commit.

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Commit your changes: `git commit -m 'feat: add your feature'`
4. Push to your branch: `git push origin feature/your-feature`
5. Open a Pull Request

---

## 📄 License

This project is licensed under the **MIT License**. See [LICENSE](LICENSE) for details.

---

<div align="center">
  Made with 💚 — <em>because mental health matters</em>
</div>