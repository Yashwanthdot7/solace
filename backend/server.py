from fastapi import FastAPI, APIRouter, HTTPException, Depends, Body
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os, logging, uuid, jwt, bcrypt, random, smtplib, asyncio, secrets
from pathlib import Path
from pydantic import BaseModel, EmailStr
from typing import List, Optional, Literal
from datetime import datetime, timezone, timedelta
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

JWT_SECRET = os.environ['JWT_SECRET']
JWT_ALG = "HS256"
GEMINI_API_KEY = os.environ.get('GEMINI_API_KEY', '')

SMTP_HOST = os.environ.get('SMTP_HOST', 'smtp.gmail.com')
SMTP_PORT = int(os.environ.get('SMTP_PORT', 587))
SMTP_USER = os.environ.get('SMTP_USER', '')
SMTP_PASS = os.environ.get('SMTP_PASS', '')
SMTP_FROM = os.environ.get('SMTP_FROM', 'SOLACE <noreply@solace.in>')
FRONTEND_URL = os.environ.get('FRONTEND_URL', 'http://localhost:3000')

app = FastAPI(title="SOLACE API")
api = APIRouter(prefix="/api")
security = HTTPBearer(auto_error=False)


def now_iso():
    return datetime.now(timezone.utc).isoformat()


# ===== EMAIL =====

def _otp_email_html(name: str, otp: str) -> str:
    return f"""<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  body{{margin:0;padding:0;background:#080808;font-family:'DM Sans',Arial,sans-serif;color:#fff}}
  .wrap{{max-width:520px;margin:40px auto;padding:48px 40px;background:#0f0f0f;border:1px solid #1e1e1e;border-radius:4px}}
  .brand{{font-size:28px;font-weight:900;letter-spacing:0.04em;color:#fff;margin-bottom:32px}}
  .brand span{{color:#C8F04B}}
  h1{{font-size:36px;font-weight:900;text-transform:uppercase;line-height:1.1;margin:0 0 8px}}
  .sub{{color:#A0A0A0;font-size:14px;margin:0 0 36px}}
  .otp-wrap{{display:flex;gap:10px;justify-content:center;margin:0 0 36px}}
  .otp-d{{width:56px;height:72px;background:#181818;border:1px solid #C8F04B;border-radius:4px;
           font-size:32px;font-weight:700;line-height:72px;text-align:center;font-family:monospace;color:#C8F04B}}
  .note{{color:#666;font-size:13px;margin:0 0 32px;text-align:center}}
  .divider{{border:none;border-top:1px solid #1e1e1e;margin:32px 0}}
  .footer{{color:#444;font-size:12px;text-align:center}}
</style></head>
<body>
<div class="wrap">
  <div class="brand">SOLACE<span>.</span></div>
  <h1>Verify your email</h1>
  <p class="sub">Hello {name} — enter this code to activate your account</p>
  <div class="otp-wrap">
    {''.join(f'<div class="otp-d">{d}</div>' for d in otp)}
  </div>
  <p class="note">This code expires in <strong>10 minutes</strong>. Do not share it with anyone.</p>
  <hr class="divider">
  <p class="footer">SOLACE · Building real connection in Bengaluru · If you didn't request this, ignore this email.</p>
</div>
</body></html>"""


def _reset_email_html(name: str, reset_url: str) -> str:
    return f"""<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  body{{margin:0;padding:0;background:#080808;font-family:'DM Sans',Arial,sans-serif;color:#fff}}
  .wrap{{max-width:520px;margin:40px auto;padding:48px 40px;background:#0f0f0f;border:1px solid #1e1e1e;border-radius:4px}}
  .brand{{font-size:28px;font-weight:900;letter-spacing:0.04em;color:#fff;margin-bottom:32px}}
  .brand span{{color:#C8F04B}}
  h1{{font-size:36px;font-weight:900;text-transform:uppercase;line-height:1.1;margin:0 0 8px}}
  .sub{{color:#A0A0A0;font-size:14px;margin:0 0 36px}}
  .btn{{display:inline-block;background:#C8F04B;color:#080808;text-decoration:none;
        padding:16px 40px;font-weight:700;font-size:14px;letter-spacing:0.12em;
        text-transform:uppercase;border-radius:2px;margin-bottom:24px}}
  .link{{color:#666;font-size:12px;word-break:break-all;margin:0 0 32px}}
  .note{{color:#666;font-size:13px;margin:0 0 32px}}
  .divider{{border:none;border-top:1px solid #1e1e1e;margin:32px 0}}
  .footer{{color:#444;font-size:12px;text-align:center}}
</style></head>
<body>
<div class="wrap">
  <div class="brand">SOLACE<span>.</span></div>
  <h1>Reset your password</h1>
  <p class="sub">Hello {name} — click below to set a new password</p>
  <a href="{reset_url}" class="btn">Reset Password →</a>
  <p class="link">Or paste this link: {reset_url}</p>
  <p class="note">This link expires in <strong>30 minutes</strong>. If you didn't request a reset, ignore this email — your account is safe.</p>
  <hr class="divider">
  <p class="footer">SOLACE · Building real connection in Bengaluru</p>
</div>
</body></html>"""


def _send_email_sync(to: str, subject: str, html: str):
    msg = MIMEMultipart('alternative')
    msg['Subject'] = subject
    msg['From'] = SMTP_FROM
    msg['To'] = to
    msg.attach(MIMEText(html, 'html'))
    with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=15) as server:
        server.ehlo()
        server.starttls()
        server.login(SMTP_USER, SMTP_PASS)
        server.sendmail(SMTP_USER, to, msg.as_string())


async def send_email(to: str, subject: str, html: str):
    if not SMTP_USER or not SMTP_PASS or 'your-gmail' in SMTP_USER:
        logging.warning(f"[EMAIL] SMTP not configured — would send to {to}: {subject}")
        return
    try:
        await asyncio.to_thread(_send_email_sync, to, subject, html)
        logging.info(f"[EMAIL] Sent to {to}: {subject}")
    except Exception as e:
        logging.error(f"[EMAIL] Failed to send to {to}: {e}")
        # In development, we don't block the flow if SMTP fails.
        # The OTP is logged to the console so you can still test it!
        pass


# ===== AUTH HELPERS =====

def hash_pw(pw: str) -> str:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()


def verify_pw(pw: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode(), hashed.encode())
    except Exception:
        return False


def make_token(uid: str) -> str:
    return jwt.encode({"sub": uid, "exp": datetime.now(timezone.utc) + timedelta(days=30)}, JWT_SECRET, algorithm=JWT_ALG)


async def get_user(creds: HTTPAuthorizationCredentials = Depends(security)):
    if not creds:
        raise HTTPException(401, "Not authenticated")
    try:
        uid = jwt.decode(creds.credentials, JWT_SECRET, algorithms=[JWT_ALG])["sub"]
    except Exception:
        raise HTTPException(401, "Invalid token")
    u = await db.users.find_one({"id": uid}, {"_id": 0, "password": 0})
    if not u:
        raise HTTPException(401, "User not found")
    return u


async def get_user_optional(creds: HTTPAuthorizationCredentials = Depends(security)):
    if not creds:
        return None
    try:
        uid = jwt.decode(creds.credentials, JWT_SECRET, algorithms=[JWT_ALG])["sub"]
        return await db.users.find_one({"id": uid}, {"_id": 0, "password": 0})
    except Exception:
        return None


def public_user(u):
    return {k: v for k, v in u.items() if k not in ("password", "_id")}


# ===== AUTH MODELS =====

class RegisterIn(BaseModel):
    email: EmailStr
    password: str
    name: str
    role: Literal["elder", "youth", "community", "guardian"] = "community"
    locality: Optional[str] = "Bengaluru"


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class OtpIn(BaseModel):
    email: EmailStr
    otp: str


class ForgotIn(BaseModel):
    email: EmailStr


class ResetIn(BaseModel):
    token: str
    new_password: str


# ===== AUTH ROUTES =====

@api.post("/auth/register")
async def register(d: RegisterIn):
    """Register account. Email NOT verified yet — OTP is sent to inbox."""
    if await db.users.find_one({"email": d.email}):
        existing = await db.users.find_one({"email": d.email})
        if not existing.get("email_verified"):
            # Allow resend for unverified accounts — delete old, recreate
            await db.users.delete_one({"email": d.email})
        else:
            raise HTTPException(400, "Email already registered")

    uid = str(uuid.uuid4())
    doc = {
        "id": uid, "email": d.email, "password": hash_pw(d.password),
        "name": d.name, "role": d.role, "locality": d.locality,
        "points": 0, "streak": 1, "score": 72, "goals": [],
        "created_at": now_iso(), "guardian_email": None,
        "email_verified": False,
    }
    await db.users.insert_one(doc)

    # Generate & store OTP
    otp = str(random.randint(100000, 999999))
    expires = (datetime.now(timezone.utc) + timedelta(minutes=10)).isoformat()
    await db.otps.delete_many({"email": d.email})
    await db.otps.insert_one({"email": d.email, "otp": otp, "expires": expires})

    print(f"\n===============================")
    print(f"\n===============================")
    print(f"OTP FOR {d.email}: {otp}")
    print(f"===============================\n")

    # Send OTP email
    await send_email(
        d.email,
        "Your SOLACE verification code",
        _otp_email_html(d.name, otp)
    )

    return {"sent": True, "email": d.email, "message": "OTP sent to your email inbox"}


@api.post("/auth/send-otp")
async def send_otp(email: EmailStr = Body(..., embed=True)):
    """Resend OTP for unverified accounts."""
    u = await db.users.find_one({"email": email})
    if not u:
        raise HTTPException(404, "No account found with this email")
    if u.get("email_verified"):
        raise HTTPException(400, "Email already verified — please log in")

    otp = str(random.randint(100000, 999999))
    expires = (datetime.now(timezone.utc) + timedelta(minutes=10)).isoformat()
    await db.otps.delete_many({"email": email})
    await db.otps.insert_one({"email": email, "otp": otp, "expires": expires})

    print(f"\n===============================")
    print(f"\n===============================")
    print(f"OTP FOR {email}: {otp}")
    print(f"===============================\n")

    await send_email(
        email,
        "Your SOLACE verification code",
        _otp_email_html(u["name"], otp)
    )
    return {"sent": True, "message": "OTP resent"}


@api.post("/auth/verify-otp")
async def verify_otp(d: OtpIn):
    """Verify the OTP. On success, marks email as verified and returns JWT."""
    record = await db.otps.find_one({"email": d.email})
    if not record:
        raise HTTPException(400, "No OTP found for this email — request a new one")

    # Check expiry
    expires = datetime.fromisoformat(record["expires"])
    if datetime.now(timezone.utc) > expires:
        await db.otps.delete_many({"email": d.email})
        raise HTTPException(400, "OTP has expired — please request a new one")

    if record["otp"] != d.otp.strip():
        raise HTTPException(400, "Incorrect OTP — please try again")

    # Mark verified
    await db.users.update_one({"email": d.email}, {"$set": {"email_verified": True}})
    await db.otps.delete_many({"email": d.email})

    u = await db.users.find_one({"email": d.email}, {"_id": 0, "password": 0})
    return {"access_token": make_token(u["id"]), "user": u}


@api.post("/auth/login")
async def login(d: LoginIn):
    u = await db.users.find_one({"email": d.email})
    if not u or not verify_pw(d.password, u["password"]):
        raise HTTPException(401, "Invalid email or password")
    if not u.get("email_verified", False):
        raise HTTPException(403, "EMAIL_NOT_VERIFIED")
    return {"access_token": make_token(u["id"]), "user": public_user(u)}


@api.get("/auth/me")
async def me(u=Depends(get_user)):
    return u


@api.post("/auth/forgot-password")
async def forgot_password(d: ForgotIn):
    """Send a password-reset link to the user's inbox."""
    u = await db.users.find_one({"email": d.email})
    # Always return success to avoid email enumeration
    if not u:
        return {"sent": True, "message": "If an account exists, a reset link has been sent"}

    token = secrets.token_urlsafe(48)
    expires = (datetime.now(timezone.utc) + timedelta(minutes=30)).isoformat()
    await db.password_resets.delete_many({"email": d.email})
    await db.password_resets.insert_one({"email": d.email, "token": token, "expires": expires})

    reset_url = f"{FRONTEND_URL}/reset-password?token={token}"
    await send_email(
        d.email,
        "Reset your SOLACE password",
        _reset_email_html(u["name"], reset_url)
    )
    return {"sent": True, "message": "Reset link sent to your inbox"}


@api.post("/auth/reset-password")
async def reset_password(d: ResetIn):
    """Validate reset token and update password."""
    record = await db.password_resets.find_one({"token": d.token})
    if not record:
        raise HTTPException(400, "Invalid or already-used reset link")

    expires = datetime.fromisoformat(record["expires"])
    if datetime.now(timezone.utc) > expires:
        await db.password_resets.delete_many({"token": d.token})
        raise HTTPException(400, "Reset link has expired — please request a new one")

    if len(d.new_password) < 6:
        raise HTTPException(400, "Password must be at least 6 characters")

    await db.users.update_one(
        {"email": record["email"]},
        {"$set": {"password": hash_pw(d.new_password)}}
    )
    await db.password_resets.delete_many({"token": d.token})
    return {"success": True, "message": "Password updated — please log in"}


# ===== ONBOARDING =====
class OnboardingIn(BaseModel):
    goals: List[str] = []
    guardian_email: Optional[str] = None


@api.post("/onboarding/complete")
async def complete_onboarding(d: OnboardingIn, u=Depends(get_user)):
    pts = u["points"] + len(d.goals) * 5 + 25
    score = 60 + min(len(d.goals) * 4, 30)
    await db.users.update_one({"id": u["id"]}, {"$set": {
        "goals": d.goals, "guardian_email": d.guardian_email, "points": pts, "score": score}})
    return {"points": pts, "score": score, "streak": 1, "joy_challenge": _today_challenge("elder")}


# ===== GREETING =====
@api.get("/greeting")
async def greeting(u=Depends(get_user)):
    h = datetime.now(timezone.utc).hour + 5  # rough IST
    h = h % 24
    g = "Good morning" if h < 12 else "Good afternoon" if h < 17 else "Good evening"
    first = u["name"].split(" ")[0]
    s = u.get("score", 72)
    if s >= 70:
        mood = f"You're glowing today — {s} on the score."
    elif s >= 45:
        mood = f"Your score is at {s}, a soft amber. Let's add some light."
    else:
        mood = "I noticed you've been quieter. I'm here, take your time."
    streak = u.get("streak", 1)
    extra = f" Day {streak} of your streak — proud of you." if streak > 1 else " Welcome to Solace."
    return {"text": f"Hi, {g} {first}. How are you feeling today? {mood}{extra}"}


# ===== SCORE =====
@api.get("/score")
async def score(u=Depends(get_user)):
    s = u.get("score", 72)
    band = "green" if s >= 70 else ("amber" if s >= 45 else "red")
    return {"score": s, "band": band, "points": u.get("points", 0), "streak": u.get("streak", 1),
            "pillars": {
                "social_interaction": min(100, s + random.randint(-5, 5)),
                "emotional_sentiment": min(100, s + random.randint(-8, 5)),
                "community_participation": min(100, s + random.randint(-3, 8))},
            "history": [s - 12, s - 8, s - 5, s - 3, s - 1, s + 1, s]}


# ===== MITRA =====
class ChatIn(BaseModel):
    message: str
    mood: Literal["playful", "warm", "hype", "gentle"] = "playful"


PERSONAS = {
    "playful": "You are Mitra, a playful, witty Indian English-speaking AI companion from Bengaluru. Use warm humor. Reply in under 60 words.",
    "warm": "You are Mitra, a warm Indian English-speaking AI companion from Bengaluru. Speak softly with empathy. Reply in under 60 words.",
    "hype": "You are Mitra, an energetic Indian English AI companion. Hype the user up. Reply in under 60 words.",
    "gentle": "You are Mitra, a soothing Indian English AI companion. Calm, reassuring. Reply in under 60 words.",
}


def fallback_reply(msg, mood):
    bank = {
        "playful": ["Arre! Tell me more, na. I'm all ears.", "Hehe, you crack me up! What else?", "Bengaluru chai is cold but I'm warm — go on!"],
        "warm": ["I hear you. Take your time, I'm right here.", "That sounds heavy. Want to talk it through?", "You're doing better than you think, truly."],
        "hype": ["YES! Let's GO! You've got this!", "Champion energy! What's next?", "I'm SO proud of you. Keep going!"],
        "gentle": ["Breathe with me. In… and out. You're safe.", "It's okay to feel this way. I'm here.", "One small step at a time."]}
    return random.choice(bank.get(mood, bank["warm"]))


@api.post("/mitra/chat")
async def mitra_chat(d: ChatIn, u=Depends(get_user_optional)):
    reply = None
    if GEMINI_API_KEY:
        try:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={GEMINI_API_KEY}"
            body = {"system_instruction": {"parts": [{"text": PERSONAS[d.mood]}]},
                    "contents": [{"role": "user", "parts": [{"text": d.message}]}]}
            async with httpx.AsyncClient(timeout=20) as cx:
                r = await cx.post(url, json=body)
                if r.status_code == 200:
                    reply = r.json()["candidates"][0]["content"]["parts"][0]["text"]
        except Exception as e:
            logging.warning(f"Gemini fail: {e}")
    if not reply:
        reply = fallback_reply(d.message, d.mood)
    await db.mitra_messages.insert_one({"id": str(uuid.uuid4()), "user_id": u["id"] if u else None,
        "message": d.message, "reply": reply, "mood": d.mood, "ts": now_iso()})
    if u:
        await db.users.update_one({"id": u["id"]}, {"$inc": {"points": 2}})
    return {"reply": reply, "mood": d.mood}


# ===== JOY CHALLENGE (role-based) =====
CHALLENGES_BY_ROLE = {
    "elder": [
        "Call a grandchild and ask about their week.",
        "Share a childhood recipe with one neighbour.",
        "Sit on your balcony for 15 minutes — wave at one person.",
        "Hum your favourite old song out loud today.",
        "Ask your watchman his first name and how his day is.",
        "Write down one happy memory from your 20s.",
        "Water a plant and tell it three good things.",
    ],
    "youth": [
        "Call a parent or grandparent — just to listen.",
        "Compliment a stranger today, specifically.",
        "Try a new coffee shop alone — observe for 20 mins.",
        "Send a voice note to a friend you've ghosted.",
        "Help an elder with their phone for 10 minutes.",
        "Go phone-free for one whole meal today.",
        "Smile at five strangers on your commute.",
    ],
    "community": [
        "Plan a small gathering for this weekend.",
        "Reach out to one quiet member of your group.",
        "Post a kind shoutout to a regular attendee.",
        "Organise a 30-min meet at a local park.",
    ],
    "guardian": [
        "Call your monitored elder/youth and just listen.",
        "Share one happy memory with them today.",
        "Send a photo from when they were younger.",
        "Plan a visit — even a short one matters.",
    ],
}


def _today_challenge(role="elder"):
    pool = CHALLENGES_BY_ROLE.get(role, CHALLENGES_BY_ROLE["elder"])
    idx = datetime.now(timezone.utc).day % len(pool)
    return {"day": 12, "text": pool[idx], "participants": random.randint(420, 980), "role": role}


@api.get("/joy/today")
async def joy_today(u=Depends(get_user)):
    completed = await db.joy_completions.find_one(
        {"user_id": u["id"], "date": datetime.now(timezone.utc).date().isoformat()})
    ch = _today_challenge(u.get("role", "elder"))
    return {**ch, "completed": bool(completed)}


@api.post("/joy/complete")
async def joy_complete(u=Depends(get_user)):
    today = datetime.now(timezone.utc).date().isoformat()
    if await db.joy_completions.find_one({"user_id": u["id"], "date": today}):
        return {"already": True, "points": u["points"]}
    await db.joy_completions.insert_one({"id": str(uuid.uuid4()), "user_id": u["id"], "date": today, "ts": now_iso()})
    await db.users.update_one({"id": u["id"]}, {"$inc": {"points": 15, "streak": 1}})
    return {"points": u["points"] + 15, "streak": u.get("streak", 1) + 1, "celebrated": True}


# ===== JOURNAL =====
class JournalIn(BaseModel):
    text: str
    mood: Literal["bright", "calm", "tender", "heavy", "blue"] = "calm"


@api.post("/journal")
async def journal_add(d: JournalIn, u=Depends(get_user)):
    e = {"id": str(uuid.uuid4()), "user_id": u["id"], "text": d.text, "mood": d.mood, "ts": now_iso()}
    await db.journal.insert_one(e)
    await db.users.update_one({"id": u["id"]}, {"$inc": {"points": 5}})
    return {k: v for k, v in e.items() if k != "_id"}


@api.get("/journal")
async def journal_list(u=Depends(get_user)):
    return await db.journal.find({"user_id": u["id"]}, {"_id": 0}).sort("ts", -1).to_list(50)


# ===== FEED =====
FEED_IMAGES = {
    "recipe": "https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=900&q=70",
    "event": "https://images.unsplash.com/photo-1529390079861-591de354faf5?w=900&q=70",
    "hobby": "https://images.unsplash.com/photo-1493612276216-ee3925520721?w=900&q=70",
    "general": "https://images.unsplash.com/photo-1528605248644-14dd04022da1?w=900&q=70",
    "fitness": "https://images.unsplash.com/photo-1518611012118-696072aa579a?w=900&q=70",
}


class PostIn(BaseModel):
    text: str
    category: Optional[str] = "general"
    image: Optional[str] = None


@api.post("/feed")
async def feed_post(d: PostIn, u=Depends(get_user)):
    post = {"id": str(uuid.uuid4()), "user_id": u["id"], "author": u["name"], "role": u["role"],
            "text": d.text, "category": d.category, "image": d.image or FEED_IMAGES.get(d.category, FEED_IMAGES["general"]),
            "hearts": 0, "ts": now_iso()}
    await db.posts.insert_one(post)
    await db.users.update_one({"id": u["id"]}, {"$inc": {"points": 3}})
    return {k: v for k, v in post.items() if k != "_id"}


@api.get("/feed")
async def feed_list(u=Depends(get_user)):
    items = await db.posts.find({}, {"_id": 0}).sort("ts", -1).to_list(50)
    if not items:
        items = _seed_posts()
    return items


@api.post("/feed/{post_id}/heart")
async def feed_heart(post_id: str, u=Depends(get_user)):
    await db.posts.update_one({"id": post_id}, {"$inc": {"hearts": 1}})
    await db.users.update_one({"id": u["id"]}, {"$inc": {"points": 1}})
    return {"ok": True}


def _seed_posts():
    return [
        {"id": "s1", "author": "Lakshmi Auntie", "role": "elder", "text": "Made fresh ragi dosas this morning. Anyone in Jayanagar want to swap recipes?", "category": "recipe", "image": FEED_IMAGES["recipe"], "hearts": 23, "ts": now_iso()},
        {"id": "s2", "author": "Arjun K", "role": "youth", "text": "Just moved to Indiranagar. Anyone up for a Cubbon Park run this Sunday?", "category": "fitness", "image": FEED_IMAGES["fitness"], "hearts": 41, "ts": now_iso()},
        {"id": "s3", "author": "Venkatesh Sir", "role": "elder", "text": "Day 14 of harmonium practice. Slowly but surely.", "category": "hobby", "image": FEED_IMAGES["hobby"], "hearts": 67, "ts": now_iso()},
        {"id": "s4", "author": "Priya M", "role": "community", "text": "Trivia Thursday at Koramangala community hall starts at 6 PM. All ages welcome!", "category": "event", "image": FEED_IMAGES["event"], "hearts": 89, "ts": now_iso()},
    ]


# ===== GUARDIAN =====
GUARDIAN_AVATARS = [
    "https://images.unsplash.com/photo-1556228720-195a672e8a03?w=300&q=70",
    "https://images.unsplash.com/photo-1581579438747-104c53e7c2c4?w=300&q=70",
    "https://images.unsplash.com/photo-1581579188871-45ea61f2a0c8?w=300&q=70",
    "https://images.unsplash.com/photo-1559963110-71b394e7494d?w=300&q=70",
]


@api.get("/guardian/members")
async def guardian_members(u=Depends(get_user)):
    return [
        {"id": "m1", "name": "Lakshmi Devi", "relation": "Mother", "age": 71, "score": 82, "band": "green",
         "insight": "Active in community feed. Shared 3 recipes this week. Mood trending positive.",
         "last_seen": "2 min ago", "avatar": GUARDIAN_AVATARS[0],
         "weekly": [70, 74, 78, 80, 82, 82, 82]},
        {"id": "m2", "name": "Venkatesh Rao", "relation": "Father", "age": 68, "score": 54, "band": "amber",
         "insight": "Tone shorter in 3 recent messages. Skipped 2 morning rituals. Suggest a check-in call.",
         "last_seen": "1 hr ago", "avatar": GUARDIAN_AVATARS[1],
         "weekly": [68, 65, 60, 58, 56, 55, 54]},
        {"id": "m3", "name": "Saroja Aunty", "relation": "Aunt", "age": 76, "score": 91, "band": "green",
         "insight": "Hosted Bingo Saturday. Great energy in journal entries.",
         "last_seen": "12 min ago", "avatar": GUARDIAN_AVATARS[2],
         "weekly": [85, 87, 89, 90, 91, 91, 91]},
        {"id": "m4", "name": "Raghavan Uncle", "relation": "Father-in-law", "age": 79, "score": 38, "band": "red",
         "insight": "⚠ No journal entries for 5 days. Last journal mood: heavy. Recommend a visit today.",
         "last_seen": "8 hrs ago", "avatar": GUARDIAN_AVATARS[3],
         "weekly": [55, 50, 45, 42, 40, 39, 38]},
    ]


@api.get("/guardian/report/{member_id}")
async def guardian_report(member_id: str, u=Depends(get_user)):
    members = await guardian_members(u)
    m = next((x for x in members if x["id"] == member_id), members[0])
    return {
        "member": m,
        "weekly_score": m["weekly"],
        "events": [
            {"date": "Mon", "type": "chat", "text": "Replied warmly to 4 messages"},
            {"date": "Tue", "type": "journal", "text": "Wrote 1 entry · mood: tender"},
            {"date": "Wed", "type": "skip", "text": "Skipped morning ritual"},
            {"date": "Thu", "type": "chat", "text": "Mentioned 'tired' twice"},
            {"date": "Fri", "type": "joy", "text": "Completed joy challenge"},
            {"date": "Sat", "type": "event", "text": "Attended bingo session"},
            {"date": "Sun", "type": "rest", "text": "Quiet day"},
        ],
        "recommendations": [
            "Call them this evening — even 5 minutes helps",
            "Share an old family photo over chat",
            "Suggest they join Monday's group prayer",
        ],
    }


class AddMemberIn(BaseModel):
    name: str
    relation: str
    age: int


@api.post("/guardian/add")
async def guardian_add(d: AddMemberIn, u=Depends(get_user)):
    return {"id": str(uuid.uuid4()), "name": d.name, "relation": d.relation, "age": d.age,
            "score": 72, "band": "green", "added": True}


# ===== EVENTS =====
@api.get("/events")
async def events_list():
    return [
        {"id": "e1", "title": "Stand-up Comedy for the 60+ Club", "venue": "Ranga Shankara", "date": "Sat 22 Feb · 7 PM", "audience": "Elders 60+", "price": "Free", "color": "lime", "image": "https://images.unsplash.com/photo-1527224538127-2104bb71c51b?w=600&q=70"},
        {"id": "e2", "title": "Open Mic — Cubbon Park", "venue": "Cubbon Park Bandstand", "date": "Sun 23 Feb · 5 PM", "audience": "Youth 18-30", "price": "₹100", "color": "coral", "image": "https://images.unsplash.com/photo-1501281668745-f7f57925c3b4?w=600&q=70"},
        {"id": "e3", "title": "Skill Swap: Cooking ↔ Coding", "venue": "Koramangala Hall", "date": "Sat 1 Mar · 4 PM", "audience": "All ages", "price": "Free", "color": "sage", "image": "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=600&q=70"},
        {"id": "e4", "title": "Sunday Gully Cricket", "venue": "Indiranagar Park", "date": "Sun 23 Feb · 8 AM", "audience": "All ages", "price": "Free", "color": "ember", "image": "https://images.unsplash.com/photo-1531415074968-036ba1b575da?w=600&q=70"},
        {"id": "e5", "title": "Group Prayer & Reflection", "venue": "Online · Mitra Room", "date": "Mon/Wed/Fri · 7 AM", "audience": "All faiths", "price": "Free", "color": "lavender", "image": "https://images.unsplash.com/photo-1545389336-cf090694435e?w=600&q=70"},
        {"id": "e6", "title": "Trivia Thursday — LIVE", "venue": "App-wide", "date": "Thu 20 Feb · 6 PM", "audience": "All ages", "price": "Free", "color": "lime", "image": "https://images.unsplash.com/photo-1606326608606-aa0b62935f2b?w=600&q=70"},
    ]


@api.post("/events/{event_id}/rsvp")
async def event_rsvp(event_id: str, u=Depends(get_user)):
    await db.rsvps.insert_one({"id": str(uuid.uuid4()), "user_id": u["id"], "event_id": event_id, "ts": now_iso()})
    await db.users.update_one({"id": u["id"]}, {"$inc": {"points": 10}})
    return {"ok": True, "points_earned": 10}


# ===== GAMES =====
@api.get("/games")
async def games_list():
    return [
        {"id": "word-scramble", "name": "Word Scramble", "icon": "shuffle", "players": 1284, "color": "#C8F04B", "image": "https://images.unsplash.com/photo-1632501641765-e568d28b0015?w=600&q=70"},
        {"id": "memory-match", "name": "Memory Match", "icon": "brain", "players": 892, "elder_friendly": True, "color": "#B8A8E8", "image": "https://images.unsplash.com/photo-1606503153255-59d8b8b82176?w=600&q=70"},
        {"id": "daily-riddle", "name": "Daily Riddle", "icon": "help-circle", "players": 2103, "shared": True, "color": "#F2A68A", "image": "https://images.unsplash.com/photo-1611996575749-79a3a250f948?w=600&q=70"},
        {"id": "community-bingo", "name": "Community Bingo", "icon": "grid", "players": 412, "live_sat": True, "color": "#E8854A", "image": "https://images.unsplash.com/photo-1606326608690-4e0281b1e588?w=600&q=70"},
        {"id": "two-truths", "name": "Two Truths One Lie", "icon": "users", "players": 678, "color": "#8BBF7A", "image": "https://images.unsplash.com/photo-1543269865-cbf427effbad?w=600&q=70"},
        {"id": "recipe-swap", "name": "Recipe Swap", "icon": "chef-hat", "players": 521, "color": "#C8F04B", "image": "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=600&q=70"},
    ]


@api.post("/games/{game_id}/play")
async def game_play(game_id: str, u=Depends(get_user)):
    await db.users.update_one({"id": u["id"]}, {"$inc": {"points": 8}})
    return {"ok": True, "points_earned": 8}


RIDDLES = [
    {"q": "I speak without a mouth and hear without ears. What am I?", "a": "echo"},
    {"q": "What has cities but no houses, mountains but no trees?", "a": "map"},
    {"q": "The more you take, the more you leave behind. What am I?", "a": "footsteps"},
    {"q": "I'm tall when I'm young and short when I'm old. What am I?", "a": "candle"},
]


@api.get("/games/riddle/today")
async def riddle_today():
    idx = datetime.now(timezone.utc).day % len(RIDDLES)
    return {"q": RIDDLES[idx]["q"], "hint": "Think simply.", "id": idx}


class RiddleAnswer(BaseModel):
    id: int
    answer: str


@api.post("/games/riddle/answer")
async def riddle_answer(d: RiddleAnswer, u=Depends(get_user)):
    correct = RIDDLES[d.id % len(RIDDLES)]["a"].lower() in d.answer.lower().strip()
    if correct:
        await db.users.update_one({"id": u["id"]}, {"$inc": {"points": 12}})
    return {"correct": correct, "answer": RIDDLES[d.id % len(RIDDLES)]["a"]}


# ===== HOBBIES =====
class HobbyIn(BaseModel):
    name: str
    goal_per_week: int = 3


@api.get("/hobbies")
async def hobbies_list(u=Depends(get_user)):
    return await db.hobbies.find({"user_id": u["id"]}, {"_id": 0}).to_list(20)


@api.post("/hobbies")
async def hobby_add(d: HobbyIn, u=Depends(get_user)):
    h = {"id": str(uuid.uuid4()), "user_id": u["id"], "name": d.name,
         "goal_per_week": d.goal_per_week, "done_this_week": 0, "ts": now_iso()}
    await db.hobbies.insert_one(h)
    return {k: v for k, v in h.items() if k != "_id"}


@api.post("/hobbies/{hobby_id}/log")
async def hobby_log(hobby_id: str, u=Depends(get_user)):
    await db.hobbies.update_one({"id": hobby_id, "user_id": u["id"]}, {"$inc": {"done_this_week": 1}})
    await db.users.update_one({"id": u["id"]}, {"$inc": {"points": 4}})
    return {"ok": True}


# ===== MINDFULNESS / WELLNESS STUDIO =====
WELLNESS = [
    {"id": "yoga", "label": "Yoga", "color": "#B8A8E8", "duration": "20 min", "level": "All levels",
     "image": "https://images.unsplash.com/photo-1545205597-3d9d02c29597?w=900&q=70",
     "desc": "Surya Namaskar + 5 calming asanas, guided by Mitra."},
    {"id": "boxing", "label": "Boxing", "color": "#E8854A", "duration": "15 min", "level": "Intermediate",
     "image": "https://images.unsplash.com/photo-1549824845-7d6abd0eedaa?w=900&q=70",
     "desc": "Shadow boxing drills — release frustration, build strength."},
    {"id": "dance", "label": "Dance", "color": "#F2A68A", "duration": "12 min", "level": "Beginner",
     "image": "https://images.unsplash.com/photo-1547153760-18fc86324498?w=900&q=70",
     "desc": "Bollywood, classical, freestyle — move your body, lift your mood."},
    {"id": "aerobics", "label": "Aerobics", "color": "#C8F04B", "duration": "18 min", "level": "Beginner",
     "image": "https://images.unsplash.com/photo-1518611012118-696072aa579a?w=900&q=70",
     "desc": "Cardio session that gets your heart smiling."},
    {"id": "gymnastics", "label": "Gymnastics", "color": "#8BBF7A", "duration": "25 min", "level": "Advanced",
     "image": "https://images.unsplash.com/photo-1583473848882-f9a5bc7fd2ee?w=900&q=70",
     "desc": "Flexibility, balance, and core work."},
    {"id": "meditation", "label": "Meditation", "color": "#B8A8E8", "duration": "10 min", "level": "All",
     "image": "https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=900&q=70",
     "desc": "Guided sit, 10 minutes. Mitra's voice walks you through."},
    {"id": "breathing", "label": "Breathwork", "color": "#C8F04B", "duration": "5 min", "level": "All",
     "image": "https://images.unsplash.com/photo-1474418397713-d501e6f1e0ed?w=900&q=70",
     "desc": "4-4-4-4 box breathing with live visual ring."},
    {"id": "prayer", "label": "Group Prayer", "color": "#E8854A", "duration": "30 min", "level": "All",
     "image": "https://images.unsplash.com/photo-1545389336-cf090694435e?w=900&q=70",
     "desc": "Mon/Wed/Fri · 7 AM · All faiths welcome."},
]


@api.get("/wellness/sessions")
async def wellness_sessions():
    return WELLNESS


@api.post("/wellness/{session_id}/complete")
async def wellness_complete(session_id: str, u=Depends(get_user)):
    await db.wellness_log.insert_one({"id": str(uuid.uuid4()), "user_id": u["id"],
        "session_id": session_id, "ts": now_iso()})
    await db.users.update_one({"id": u["id"]}, {"$inc": {"points": 10}})
    return {"ok": True, "points_earned": 10}


# ===== COMMUNITY ORGANISER PANEL =====
class TaskIn(BaseModel):
    title: str
    audience: Literal["elder", "youth", "all"] = "all"
    points: int = 10


@api.get("/organiser/tasks")
async def organiser_tasks():
    base = await db.organiser_tasks.find({}, {"_id": 0}).sort("ts", -1).to_list(50)
    if not base:
        base = [
            {"id": "ot1", "title": "Greet 3 neighbours by name today", "audience": "all", "points": 10, "issued_by": "Priya M", "ts": now_iso(), "claims": 47},
            {"id": "ot2", "title": "Share one home remedy with the group", "audience": "elder", "points": 15, "issued_by": "Suresh K", "ts": now_iso(), "claims": 12},
            {"id": "ot3", "title": "Help one elder set up WhatsApp", "audience": "youth", "points": 20, "issued_by": "Priya M", "ts": now_iso(), "claims": 9},
        ]
    return base


@api.post("/organiser/tasks")
async def organiser_create_task(d: TaskIn, u=Depends(get_user)):
    if u.get("role") != "community":
        raise HTTPException(403, "Only community organisers can issue tasks")
    task = {"id": str(uuid.uuid4()), "title": d.title, "audience": d.audience, "points": d.points,
            "issued_by": u["name"], "ts": now_iso(), "claims": 0}
    await db.organiser_tasks.insert_one(task)
    return {k: v for k, v in task.items() if k != "_id"}


@api.post("/organiser/tasks/{task_id}/claim")
async def task_claim(task_id: str, u=Depends(get_user)):
    await db.organiser_tasks.update_one({"id": task_id}, {"$inc": {"claims": 1}})
    t = await db.organiser_tasks.find_one({"id": task_id}, {"_id": 0})
    pts = t["points"] if t else 10
    await db.users.update_one({"id": u["id"]}, {"$inc": {"points": pts}})
    return {"ok": True, "points_earned": pts}


@api.get("/organiser/active")
async def organiser_active():
    return [
        {"name": "Priya M", "locality": "Koramangala", "tasks_issued": 18, "score": 94, "avatar": GUARDIAN_AVATARS[2]},
        {"name": "Suresh K", "locality": "Jayanagar", "tasks_issued": 12, "score": 89, "avatar": GUARDIAN_AVATARS[1]},
        {"name": "Anita R", "locality": "Indiranagar", "tasks_issued": 9, "score": 87, "avatar": GUARDIAN_AVATARS[0]},
    ]


# ===== CHAT =====
@api.get("/chat/messages")
async def chat_messages():
    return [
        {"id": "c1", "author": "Venkat Uncle", "text": "Feeling a bit low today, again.", "ts": now_iso(), "ai_notice": True},
        {"id": "c2", "author": "Priya M", "text": "Sending love, Venkat ji. Want to join the 7 AM prayer call tomorrow?", "ts": now_iso()},
        {"id": "c3", "author": "Arjun K", "text": "I'm there too uncle, let's all go together", "ts": now_iso()},
        {"id": "c4", "author": "Lakshmi Auntie", "text": "I'll bring my idlis for breakfast after 🌸", "ts": now_iso()},
    ]


app.include_router(api)
app.add_middleware(CORSMiddleware, allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"], allow_headers=["*"])

logging.basicConfig(level=logging.INFO)


@app.on_event("shutdown")
async def shutdown():
    client.close()
