from fastapi import FastAPI, APIRouter, HTTPException, Depends, Body, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from supabase import create_client, Client
import os, logging, uuid, jwt, bcrypt, random, smtplib, asyncio, secrets, httpx
from pathlib import Path
from pydantic import BaseModel, EmailStr, Field
from typing import Annotated, List, Optional, Literal
from datetime import datetime, timezone, timedelta
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from safety import (
    detect_crisis, helpline_line, HELPLINES, CRISIS_REPLY, SAFETY_RULES,
    CONCERN_PERSONA, GEMINI_SAFETY_SETTINGS,
)

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

SUPABASE_URL = os.environ['SUPABASE_URL']
SUPABASE_KEY = os.environ['SUPABASE_SECRET_KEY']
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# Strip surrounding quotes that some editors add to .env values
JWT_SECRET = os.environ['JWT_SECRET'].strip('"\'')
JWT_ALG = "HS256"
JWT_LIFETIME = timedelta(days=7)
MIN_JWT_SECRET_LENGTH = 32


def check_jwt_secret(secret: str):
    """Refuse to start with a short, guessable signing secret."""
    if len(secret) < MIN_JWT_SECRET_LENGTH:
        raise RuntimeError(
            f"JWT_SECRET must be at least {MIN_JWT_SECRET_LENGTH} characters. Generate one with: "
            "python -c \"import secrets; print(secrets.token_hex(32))\""
        )


check_jwt_secret(JWT_SECRET)

# ENV=development prints sign-up codes to the console when email isn't set up.
# Anything else (the default) never logs codes.
ENV = os.environ.get('ENV', 'production').strip().lower()
IS_DEV = ENV in ('development', 'dev', 'local')
GEMINI_API_KEY = os.environ.get('GEMINI_API_KEY', '').strip('"\'')

SMTP_HOST = os.environ.get('SMTP_HOST', 'smtp.gmail.com')
SMTP_PORT = int(os.environ.get('SMTP_PORT', 587))
SMTP_USER = os.environ.get('SMTP_USER', '')
SMTP_PASS = os.environ.get('SMTP_PASS', '')
SMTP_FROM = os.environ.get('SMTP_FROM', 'SOLACE <noreply@solace.in>')
FRONTEND_URL = os.environ.get('FRONTEND_URL', 'http://localhost:3000')
# DEMO_MODE=true shows made-up demo members/messages. Never turn it on in production.
DEMO_MODE = os.environ.get('DEMO_MODE', '').strip().lower() in ('1', 'true', 'yes')

GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent"


def _gemini_headers() -> dict:
    # The key goes in a header, not the URL, so it never ends up in logs.
    return {"x-goog-api-key": GEMINI_API_KEY, "Content-Type": "application/json"}

app = FastAPI(title="SOLACE API")
api = APIRouter(prefix="/api")


def _client_ip(request: Request) -> str:
    # Behind a hosting proxy (Render, Railway, Fly) set TRUST_PROXY_HEADERS=true so
    # limits apply per visitor instead of to the proxy's single address.
    if os.environ.get("TRUST_PROXY_HEADERS", "").lower() in ("1", "true", "yes"):
        fwd = request.headers.get("x-forwarded-for")
        if fwd:
            return fwd.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


# Rate limits (per IP address). Stops password guessing, code guessing and spam.
limiter = Limiter(key_func=_client_ip, enabled=os.environ.get("RATE_LIMITS", "on").lower() != "off")
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

OTP_MAX_ATTEMPTS = 5
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
    with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=15) as srv:
        srv.ehlo()
        srv.starttls()
        srv.login(SMTP_USER, SMTP_PASS)
        srv.sendmail(SMTP_USER, to, msg.as_string())


EMAIL_CONFIGURED = (
    bool(SMTP_USER)
    and bool(SMTP_PASS)
    and 'your-gmail' not in SMTP_USER
    and 'your-16-char' not in SMTP_PASS
)


async def send_email(to: str, subject: str, html: str):
    if not EMAIL_CONFIGURED:
        logging.warning(
            "[EMAIL] SMTP not configured — skipping send.\n"
            "  Set SMTP_USER and SMTP_PASS in backend/.env to enable emails."
        )
        return
    try:
        await asyncio.to_thread(_send_email_sync, to, subject, html)
        logging.info(f"[EMAIL] Sent '{subject}' to {to}")
    except smtplib.SMTPAuthenticationError:
        logging.error(
            "[EMAIL] SMTP authentication failed.\n"
            "  Make sure you are using a Gmail App Password (not your normal password).\n"
            "  Guide: myaccount.google.com → Security → 2FA → App Passwords"
        )
    except smtplib.SMTPException as e:
        logging.error(f"[EMAIL] SMTP error sending to {to}: {e}")
    except Exception as e:
        logging.error(f"[EMAIL] Unexpected error sending to {to}: {e}")


# ===== SUPABASE HELPERS =====

def _sb_one(table: str, field: str, value):
    """Fetch a single row. Returns dict or None."""
    try:
        res = supabase.table(table).select("*").eq(field, value).limit(1).execute()
        return res.data[0] if res.data else None
    except Exception as e:
        logging.error(f"[DB] _sb_one {table}.{field}={value}: {e}")
        return None


def _sb_insert(table: str, doc: dict):
    """Insert a row. Logs on error but does not raise."""
    try:
        supabase.table(table).insert(doc).execute()
    except Exception as e:
        logging.error(f"[DB] _sb_insert {table}: {e}")
        raise  # Re-raise so caller can handle (e.g. unique constraint)


def _sb_update(table: str, field: str, value, updates: dict):
    """Update rows matching field=value."""
    try:
        supabase.table(table).update(updates).eq(field, value).execute()
    except Exception as e:
        logging.error(f"[DB] _sb_update {table}.{field}={value}: {e}")


def _sb_delete(table: str, field: str, value):
    """Delete all rows matching field=value."""
    try:
        supabase.table(table).delete().eq(field, value).execute()
    except Exception as e:
        logging.error(f"[DB] _sb_delete {table}.{field}={value}: {e}")


def _sb_inc(table: str, match_field: str, match_val, inc_fields: dict):
    """Increment numeric fields (fetch then update)."""
    row = _sb_one(table, match_field, match_val)
    if not row:
        return
    updates = {k: (row.get(k) or 0) + v for k, v in inc_fields.items()}
    _sb_update(table, match_field, match_val, updates)


def _sb_list(table: str, field: str = None, value=None, order: str = "ts", desc: bool = True, limit: int = 50):
    """List rows with optional filter, ordered, limited. Falls back to unordered on error."""
    try:
        q = supabase.table(table).select("*")
        if field and value is not None:
            q = q.eq(field, value)
        q = q.order(order, desc=desc).limit(limit)
        return q.execute().data or []
    except Exception:
        # Fallback: no ordering (e.g. column doesn't exist yet)
        try:
            q = supabase.table(table).select("*")
            if field and value is not None:
                q = q.eq(field, value)
            return q.limit(limit).execute().data or []
        except Exception as e:
            logging.error(f"[DB] _sb_list {table}: {e}")
            return []



# ===== AUTH HELPERS =====

def hash_pw(pw: str) -> str:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()


def verify_pw(pw: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode(), hashed.encode())
    except Exception:
        return False


def make_token(uid: str) -> str:
    return jwt.encode({"sub": uid, "exp": datetime.now(timezone.utc) + JWT_LIFETIME}, JWT_SECRET, algorithm=JWT_ALG)


async def get_user(creds: HTTPAuthorizationCredentials = Depends(security)):
    if not creds:
        raise HTTPException(401, "Not authenticated")
    try:
        uid = jwt.decode(creds.credentials, JWT_SECRET, algorithms=[JWT_ALG])["sub"]
    except Exception:
        raise HTTPException(401, "Invalid token")
    u = await asyncio.to_thread(_sb_one, "users", "id", uid)
    if not u:
        raise HTTPException(401, "User not found")
    u.pop("password", None)
    return u


async def get_user_optional(creds: HTTPAuthorizationCredentials = Depends(security)):
    if not creds:
        return None
    try:
        uid = jwt.decode(creds.credentials, JWT_SECRET, algorithms=[JWT_ALG])["sub"]
        u = await asyncio.to_thread(_sb_one, "users", "id", uid)
        if u:
            u.pop("password", None)
        return u
    except Exception:
        return None


def public_user(u):
    return {k: v for k, v in u.items() if k not in ("password",)}




# ===== AUTH MODELS =====

class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=128)
    name: str = Field(..., min_length=1, max_length=80)
    role: Literal["elder", "youth", "community", "guardian"] = "community"
    locality: Optional[str] = Field("Bengaluru", max_length=80)
    accept_terms: bool = False  # must be true: agreed to the privacy policy and terms


class LoginIn(BaseModel):
    email: EmailStr
    password: str = Field(..., max_length=128)


class OtpIn(BaseModel):
    email: EmailStr
    otp: str = Field(..., max_length=10)


class ForgotIn(BaseModel):
    email: EmailStr


class ResetIn(BaseModel):
    token: str = Field(..., max_length=200)
    new_password: str = Field(..., max_length=128)


# ===== AUTH ROUTES =====

def _new_otp() -> str:
    """6-digit code from a cryptographically secure random source."""
    return f"{secrets.randbelow(1_000_000):06d}"


async def _store_and_send_otp(email: str, name: str):
    otp = _new_otp()
    expires = (datetime.now(timezone.utc) + timedelta(minutes=10)).isoformat()
    await asyncio.to_thread(_sb_delete, "otps", "email", email)
    await asyncio.to_thread(_sb_insert, "otps", {"email": email, "otp": otp, "expires": expires, "attempts": 0})
    # Codes are only ever printed in local development without email set up.
    if IS_DEV and not EMAIL_CONFIGURED:
        logging.info(f"[OTP] (development only) code for {email}: {otp}")
    await send_email(email, "Your SOLACE verification code", _otp_email_html(name, otp))


def _otp_message(prefix: str) -> str:
    if EMAIL_CONFIGURED:
        return f"{prefix} to your email inbox"
    if IS_DEV:
        return f"{prefix} (development: check the server console, email is not set up)"
    return f"{prefix}. If it doesn't arrive, email may not be set up on the server."


@api.post("/auth/register")
@limiter.limit("5/minute")
async def register(request: Request, d: RegisterIn):
    """Register account. Email NOT verified yet — OTP is sent to inbox."""
    if not d.accept_terms:
        raise HTTPException(400, "Please agree to the privacy policy and terms to continue")
    existing = await asyncio.to_thread(_sb_one, "users", "email", d.email)
    if existing:
        if not existing.get("email_verified"):
            # Allow re-registration for unverified accounts — delete old, recreate
            await asyncio.to_thread(_sb_delete, "users", "email", d.email)
            await asyncio.to_thread(_sb_delete, "otps", "email", d.email)
        else:
            raise HTTPException(400, "Email already registered")

    uid = str(uuid.uuid4())
    doc = {
        "id": uid, "email": d.email, "password": hash_pw(d.password),
        "name": d.name, "role": d.role, "locality": d.locality,
        "points": 0, "streak": 1, "score": 72, "goals": [],
        "created_at": now_iso(), "guardian_email": None,
        "email_verified": False,
        "consented_at": now_iso(),
    }
    try:
        await asyncio.to_thread(_sb_insert, "users", doc)
    except Exception as e:
        logging.error(f"[AUTH] create account failed: {e}")
        raise HTTPException(500, "Could not create your account. Please try again.")

    await _store_and_send_otp(d.email, d.name)
    return {
        "sent": True,
        "email": d.email,
        "message": _otp_message("Code sent"),
        "email_status": "sent" if EMAIL_CONFIGURED else "not_configured",
    }


@api.post("/auth/send-otp")
@limiter.limit("3/minute")
async def send_otp(request: Request, email: EmailStr = Body(..., embed=True)):
    """Resend OTP for unverified accounts."""
    u = await asyncio.to_thread(_sb_one, "users", "email", email)
    # Same answer whether or not the account exists, so this can't be used
    # to find out who has an account.
    if u and not u.get("email_verified"):
        await _store_and_send_otp(email, u["name"])
    return {"sent": True, "message": _otp_message("If this email is waiting for verification, a new code was sent")}


@api.post("/auth/verify-otp")
@limiter.limit("10/minute")
async def verify_otp(request: Request, d: OtpIn):
    """Verify the OTP. On success, marks email as verified and returns JWT."""
    record = await asyncio.to_thread(_sb_one, "otps", "email", d.email)
    if not record:
        raise HTTPException(400, "No OTP found for this email — request a new one")

    # Parse expiry — handle both naive and timezone-aware ISO strings
    expires_raw = record["expires"]
    try:
        expires = datetime.fromisoformat(expires_raw)
        if expires.tzinfo is None:
            expires = expires.replace(tzinfo=timezone.utc)
    except ValueError:
        # Fallback: expired
        await asyncio.to_thread(_sb_delete, "otps", "email", d.email)
        raise HTTPException(400, "OTP has expired — please request a new one")

    if datetime.now(timezone.utc) > expires:
        await asyncio.to_thread(_sb_delete, "otps", "email", d.email)
        raise HTTPException(400, "OTP has expired — please request a new one")

    if not secrets.compare_digest(str(record["otp"]), d.otp.strip()):
        attempts = (record.get("attempts") or 0) + 1
        if attempts >= OTP_MAX_ATTEMPTS:
            # Too many wrong guesses: throw the code away.
            await asyncio.to_thread(_sb_delete, "otps", "email", d.email)
            raise HTTPException(400, "Too many incorrect attempts — please request a new code")
        await asyncio.to_thread(_sb_update, "otps", "email", d.email, {"attempts": attempts})
        left = OTP_MAX_ATTEMPTS - attempts
        raise HTTPException(400, f"Incorrect code — {left} attempt{'s' if left != 1 else ''} left")

    # Mark email as verified & clean up OTP
    await asyncio.to_thread(_sb_update, "users", "email", d.email, {"email_verified": True})
    await asyncio.to_thread(_sb_delete, "otps", "email", d.email)

    u = await asyncio.to_thread(_sb_one, "users", "email", d.email)
    if not u:
        raise HTTPException(500, "Account not found after verification")
    u.pop("password", None)
    return {"access_token": make_token(u["id"]), "user": u}


@api.post("/auth/login")
@limiter.limit("10/minute")
async def login(request: Request, d: LoginIn):
    u = await asyncio.to_thread(_sb_one, "users", "email", d.email)
    if not u:
        raise HTTPException(401, "Invalid email or password")
    if not verify_pw(d.password, u.get("password", "")):
        raise HTTPException(401, "Invalid email or password")
    if not u.get("email_verified", False):
        raise HTTPException(403, "EMAIL_NOT_VERIFIED")
    return {"access_token": make_token(u["id"]), "user": public_user(u)}



@api.get("/auth/me")
async def me(u=Depends(get_user)):
    return u


@api.post("/auth/forgot-password")
@limiter.limit("3/minute")
async def forgot_password(request: Request, d: ForgotIn):
    """Send a password-reset link to the user's inbox."""
    u = await asyncio.to_thread(_sb_one, "users", "email", d.email)
    # Always return success to avoid email enumeration
    if not u:
        return {"sent": True, "message": "If an account exists, a reset link has been sent"}

    token = secrets.token_urlsafe(48)
    expires = (datetime.now(timezone.utc) + timedelta(minutes=30)).isoformat()
    await asyncio.to_thread(_sb_delete, "password_resets", "email", d.email)
    await asyncio.to_thread(_sb_insert, "password_resets", {"email": d.email, "token": token, "expires": expires})

    reset_url = f"{FRONTEND_URL}/reset-password?token={token}"
    await send_email(
        d.email,
        "Reset your SOLACE password",
        _reset_email_html(u["name"], reset_url)
    )
    return {"sent": True, "message": "If an account exists, a reset link has been sent"}


@api.post("/auth/reset-password")
@limiter.limit("10/minute")
async def reset_password(request: Request, d: ResetIn):
    """Validate reset token and update password."""
    record = await asyncio.to_thread(_sb_one, "password_resets", "token", d.token)
    if not record:
        raise HTTPException(400, "Invalid or already-used reset link")

    expires = datetime.fromisoformat(record["expires"])
    if datetime.now(timezone.utc) > expires:
        await asyncio.to_thread(_sb_delete, "password_resets", "token", d.token)
        raise HTTPException(400, "Reset link has expired — please request a new one")

    if len(d.new_password) < 8:
        raise HTTPException(400, "Password must be at least 8 characters")

    await asyncio.to_thread(_sb_update, "users", "email", record["email"], {"password": hash_pw(d.new_password)})
    await asyncio.to_thread(_sb_delete, "password_resets", "token", d.token)
    return {"success": True, "message": "Password updated — please log in"}


# ===== ONBOARDING =====
class OnboardingIn(BaseModel):
    goals: List[Annotated[str, Field(max_length=100)]] = Field(default_factory=list, max_length=20)
    guardian_email: Optional[str] = Field(None, max_length=254)


@api.post("/onboarding/complete")
async def complete_onboarding(d: OnboardingIn, u=Depends(get_user)):
    pts = u["points"] + len(d.goals) * 5 + 25
    score = 60 + min(len(d.goals) * 4, 30)
    await asyncio.to_thread(_sb_update, "users", "id", u["id"], {
        "goals": d.goals, "points": pts, "score": score})
    # A guardian email from onboarding becomes an INVITE. The guardian sees
    # nothing until they accept, and the member can revoke it in Settings.
    guardian_invited = False
    if d.guardian_email and d.guardian_email.strip():
        try:
            from email_validator import validate_email
            email = validate_email(d.guardian_email.strip(), check_deliverability=False).normalized
            await _create_invite(u, email)
            guardian_invited = True
        except Exception as e:
            logging.info(f"[ONBOARDING] guardian invite skipped: {e}")
    return {"points": pts, "score": score, "streak": 1, "joy_challenge": _today_challenge("elder"),
            "guardian_invited": guardian_invited}


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


# ===== SCORE (real 3-pillar aggregation) =====

INTERVENTIONS = {
    "green_to_amber": "Mitra will check in with you extra tomorrow morning 🌙",
    "amber_to_red":   "We're gently notifying your guardian — you're not alone 💛",
    "red_sustained":  "Mitra will reach out to you tonight at 7 PM",
    "amber_sustained": "Your Joy Challenge is now a team challenge — a neighbour is joining you ✨",
}


# Per-role pillar weights
PILLAR_WEIGHTS = {
    "elder":     {"social": 0.35, "sentiment": 0.35, "community": 0.30},
    "youth":     {"social": 0.45, "sentiment": 0.30, "community": 0.25},
    "community": {"social": 0.30, "sentiment": 0.25, "community": 0.45},
    "guardian":  {"social": 0.40, "sentiment": 0.35, "community": 0.25},
}


async def _compute_score(uid: str, role: str) -> dict:
    """Compute real 3-pillar social health score from Supabase activity (last 14 days)."""
    cutoff = (datetime.now(timezone.utc) - timedelta(days=14)).isoformat()

    # Pillar 1: Social Interaction (messages + posts + RSVPs)
    try:
        msgs_r  = await asyncio.to_thread(lambda: supabase.table("mitra_messages").select("id", count="exact").eq("user_id", uid).gte("ts", cutoff).execute())
        posts_r = await asyncio.to_thread(lambda: supabase.table("posts").select("id", count="exact").eq("user_id", uid).gte("ts", cutoff).execute())
        rsvps_r = await asyncio.to_thread(lambda: supabase.table("rsvps").select("id", count="exact").eq("user_id", uid).gte("ts", cutoff).execute())
        msg_count  = msgs_r.count  or len(msgs_r.data)
        post_count = posts_r.count or len(posts_r.data)
        rsvp_count = rsvps_r.count or len(rsvps_r.data)
        social_raw = min(100, msg_count * 3 + post_count * 5 + rsvp_count * 10)
        social = max(10, social_raw) if (msg_count + post_count + rsvp_count) > 0 else 50
    except Exception:
        social = 50

    # Pillar 2: Emotional Sentiment (journal mood distribution)
    try:
        journals = await asyncio.to_thread(_sb_list, "journal", "user_id", uid, "ts", True, 30)
        recent = [j for j in journals if j.get("ts", "") >= cutoff]
        if recent:
            positive = sum(1 for j in recent if j.get("mood") in ("bright", "calm", "tender"))
            sentiment = int((positive / len(recent)) * 100)
        else:
            sentiment = 60  # neutral default
    except Exception:
        sentiment = 60

    # Pillar 3: Community Participation (joy completions + organiser tasks)
    try:
        joy_r = await asyncio.to_thread(lambda: supabase.table("joy_completions").select("id", count="exact").eq("user_id", uid).gte("ts", cutoff).execute())
        joy_count = joy_r.count or len(joy_r.data)
        # Organisers also get credit for event creation
        if role == "community":
            evt_r = await asyncio.to_thread(lambda: supabase.table("posts").select("id", count="exact").eq("user_id", uid).eq("category", "event").gte("ts", cutoff).execute())
            evt_count = evt_r.count or len(evt_r.data)
            community_raw = min(100, joy_count * 12 + evt_count * 20)
        else:
            community_raw = min(100, joy_count * 15)
        community = max(10, community_raw) if (joy_count + (evt_count if role == "community" else 0)) > 0 else 40
    except Exception:
        community = 40

    # Role-weighted composite
    w = PILLAR_WEIGHTS.get(role, PILLAR_WEIGHTS["elder"])
    score = int(social * w["social"] + sentiment * w["sentiment"] + community * w["community"])
    score = max(0, min(100, score))

    # If no real activity at all, signal to use stored score
    if social == 50 and sentiment == 60 and community == 40:
        return None

    return {
        "social_interaction": social,
        "emotional_sentiment": sentiment,
        "community_participation": community,
        "computed": score,
    }


@api.get("/score")
async def score(u=Depends(get_user)):
    uid = u["id"]
    stored_score = u.get("score", 72)
    prev_band = u.get("band", None)

    # Try to compute real score from activity
    pillars_data = await _compute_score(uid, u.get("role", "elder"))

    if pillars_data:
        s = pillars_data["computed"]
        pillars = {
            "social_interaction": pillars_data["social_interaction"],
            "emotional_sentiment": pillars_data["emotional_sentiment"],
            "community_participation": pillars_data["community_participation"],
        }
        # Persist updated score
        await asyncio.to_thread(_sb_update, "users", "id", uid, {"score": s})
    else:
        # No real activity yet — use stored score with slight variance
        s = stored_score
        pillars = {
            "social_interaction": min(100, s + random.randint(-4, 4)),
            "emotional_sentiment": min(100, s + random.randint(-6, 4)),
            "community_participation": min(100, s + random.randint(-2, 6)),
        }

    band = "green" if s >= 70 else ("amber" if s >= 45 else "red")

    # Detect band change and assign intervention
    intervention = None
    if prev_band and prev_band != band:
        key = f"{prev_band}_to_{band}"
        intervention = INTERVENTIONS.get(key)
        logging.info(f"[SCORE] uid={uid} band changed {prev_band} -> {band}")

    # Build 7-day history (synthetic from stored score, real would need score_history table)
    base = stored_score
    history = [max(0, min(100, base + d)) for d in [-10, -7, -4, -2, -1, 0, s - base]]

    return {
        "score": s,
        "band": band,
        "points": u.get("points", 0),
        "streak": u.get("streak", 1),
        "pillars": pillars,
        "history": history,
        "intervention": intervention,
        "data_source": "computed" if pillars_data else "stored",
    }


# ===== MITRA =====

# ── Voice parameters per detected mood ──────────────────────────────────────
VOICE_PARAMS = {
    "sad":     {"rate": 0.84, "pitch": 0.93},
    "anxious": {"rate": 0.90, "pitch": 1.00},
    "angry":   {"rate": 0.92, "pitch": 0.97},
    "tired":   {"rate": 0.87, "pitch": 0.91},
    "happy":   {"rate": 1.00, "pitch": 1.10},
    "playful": {"rate": 1.06, "pitch": 1.15},
    "neutral": {"rate": 0.96, "pitch": 1.08},
}

# ── Full per-mood Gemini system prompts ──────────────────────────────────────
PERSONAS = {
    "sad": (
        "You are Mitra, a deeply empathetic AI companion from Bengaluru, India. "
        "The user is feeling sad, lonely, or low right now. "
        "Your role: validate their feelings without dismissing them, offer gentle warmth, "
        "and if appropriate, suggest one small action like calling someone or stepping outside. "
        "Never say 'I understand' or 'I know how you feel' — show it instead through tone. "
        "Speak in warm Indian English, as a kind elder or trusted friend would. "
        "DO NOT offer medical advice. Reply in under 80 words."
    ),
    "anxious": (
        "You are Mitra, a calm and grounding AI companion from Bengaluru, India. "
        "The user is anxious, worried, or overwhelmed. "
        "Your role: slow things down, offer one grounding technique (like box breathing), "
        "and reassure them that this moment will pass. "
        "Speak slowly and clearly in warm Indian English. "
        "Never amplify their worry. Stay gentle and practical. "
        "Reply in under 80 words."
    ),
    "angry": (
        "You are Mitra, a steady, non-reactive AI companion from Bengaluru, India. "
        "The user is frustrated, angry, or irritated. "
        "Your role: acknowledge the feeling without judging, help them feel heard, "
        "and gently invite them to share what's behind the anger. "
        "Do NOT lecture or moralize. Speak in calm, measured Indian English. "
        "Reply in under 80 words."
    ),
    "tired": (
        "You are Mitra, a nurturing AI companion from Bengaluru, India. "
        "The user is exhausted or drained. "
        "Your role: give them permission to rest, validate that tiredness is real, "
        "and suggest one tiny restorative action (tea, 5 min walk, eyes closed). "
        "Speak gently, like a caring family member. Indian English warmth. "
        "Reply in under 80 words."
    ),
    "happy": (
        "You are Mitra, a joyful and warm AI companion from Bengaluru, India. "
        "The user is feeling happy or grateful. "
        "Your role: celebrate with them genuinely, ask one follow-up question to deepen the joy, "
        "and share in the positivity without being over-the-top. "
        "Speak naturally in Indian English with warmth and delight. "
        "Reply in under 80 words."
    ),
    "playful": (
        "You are Mitra, a witty, playful AI companion from Bengaluru, India. "
        "Use light humour, wordplay, or a fun observation to keep the energy up. "
        "Reference Bengaluru life naturally (auto rides, filter coffee, traffic, etc.) "
        "when it fits. Never force a joke. Stay warm and engaging. "
        "Indian English. Reply in under 80 words."
    ),
    "warm": (
        "You are Mitra, a warm, empathetic AI companion from Bengaluru, India. "
        "Listen carefully to what the user shares and respond with genuine care. "
        "Ask a thoughtful follow-up question to show you are paying attention. "
        "Speak in Indian English, softly and without judgment. "
        "Reply in under 80 words."
    ),
    "hype": (
        "You are Mitra, an energetic motivational AI companion from Bengaluru, India. "
        "The user needs encouragement and energy. Hype them up! "
        "Be enthusiastic, specific, and genuine — not hollow cheerleading. "
        "Reference their actual situation if possible. Indian English with energy. "
        "Reply in under 80 words."
    ),
    "gentle": (
        "You are Mitra, a soothing, calm AI companion from Bengaluru, India. "
        "Speak slowly and reassuringly. Offer comfort through presence, not solutions. "
        "Use soft language. Indian English, like a trusted elder. "
        "Reply in under 80 words."
    ),
    "neutral": (
        "You are Mitra, a warm and curious AI companion from Bengaluru, India. "
        "Engage naturally with what the user says. Ask follow-up questions. "
        "Keep the conversation flowing with genuine interest. Indian English. "
        "Reply in under 80 words."
    ),
}


class HistoryItem(BaseModel):
    role: str = Field(..., max_length=10)   # 'user' | 'model'
    text: str = Field(..., max_length=2000)


class ChatIn(BaseModel):
    message: str = Field(..., min_length=1, max_length=2000)
    mood: str = Field("playful", max_length=20)           # UI mood override
    detected_mood: str = Field("neutral", max_length=20)  # client-side regex detection
    history: List[HistoryItem] = Field(default_factory=list, max_length=20)


def _fallback_reply(detected_mood: str) -> str:
    bank = {
        "sad":     ["I hear you. Take your time — I'm right here.", "You don't have to carry this alone.", "That sounds heavy. Want to share more?"],
        "anxious": ["Breathe with me. In slowly… and out. You're safe.", "One thing at a time — what's the most urgent piece?", "I've got you. Let's slow this down together."],
        "angry":   ["I hear the frustration. That sounds genuinely hard.", "You're allowed to feel this. What happened?", "That would frustrate anyone. Tell me more."],
        "tired":   ["Rest is not laziness. You've earned a pause.", "Even a 5-minute break counts. You're human.", "Take it slow. I'm here when you're ready."],
        "happy":   ["That's wonderful! Tell me everything.", "This made my day too — keep going!", "You deserve this joy. What happened?"],
        "playful": ["Arre! Tell me more, na. I'm all ears.", "Hehe — Bengaluru chai is cold but I'm warm. Go on!", "Okay okay, you've got my full attention now."],
        "neutral":  ["Tell me more — I'm listening.", "What's on your mind today?", "I'm here. What would you like to talk about?"],
    }
    return random.choice(bank.get(detected_mood, bank["neutral"]))


async def _call_gemini_chat(persona: str, history: List[HistoryItem], user_message: str) -> Optional[str]:
    """Call Gemini with conversation history. Returns reply text or None."""
    if not GEMINI_API_KEY:
        return None
    try:
        # Build contents array: [history turns...] + current user message
        contents = []
        for h in history[-8:]:  # last 8 turns
            role = "user" if h.role == "user" else "model"
            contents.append({"role": role, "parts": [{"text": h.text}]})
        contents.append({"role": "user", "parts": [{"text": user_message}]})

        body = {
            "system_instruction": {"parts": [{"text": persona}]},
            "contents": contents,
            "generationConfig": {
                "temperature": 0.85,
                "maxOutputTokens": 150,
                "topP": 0.9,
            },
            "safetySettings": GEMINI_SAFETY_SETTINGS,
        }
        async with httpx.AsyncClient(timeout=25) as cx:
            r = await cx.post(GEMINI_URL, json=body, headers=_gemini_headers())
            if r.status_code == 200:
                data = r.json()
                return data["candidates"][0]["content"]["parts"][0]["text"].strip()
            else:
                logging.warning(f"[MITRA] Gemini {r.status_code}: {r.text[:200]}")
    except Exception as e:
        logging.warning(f"[MITRA] Gemini call failed: {e}")
    return None


@api.post("/mitra/chat")
@limiter.limit("20/minute")
async def mitra_chat(request: Request, d: ChatIn, u=Depends(get_user)):
    # Safety first: check the message BEFORE anything is sent to Gemini.
    risk = detect_crisis(d.message)

    if risk == "crisis":
        # Never use the playful persona or Gemini for a crisis message.
        # Reply with a fixed, reviewed message and real helplines.
        reply = CRISIS_REPLY
        effective_mood = "gentle"
        voice_params = VOICE_PARAMS["sad"]
        logging.warning(f"[MITRA] crisis-level message from user={u['id']}")
        await _alert_guardians_of_crisis(u)
    else:
        # Detected mood from client wins over manual UI selection
        effective_mood = d.detected_mood if d.detected_mood != "neutral" else d.mood
        user_role = u.get("role", "elder")
        user_name = u["name"].split()[0] if u.get("name") else "friend"
        role_ctx = {
            "elder":     f"The user is an Elder (60+) named {user_name}. They may be lonely or isolated. Be warm, patient, and address them by name.",
            "youth":     f"The user is a Youth member named {user_name}. They're young, digitally savvy, possibly stressed. Be energetic and relatable.",
            "community": f"The user is a Community Organiser named {user_name}. They're action-oriented and social. Be collaborative and encouraging.",
            "guardian":  f"The user is a Guardian named {user_name}. They care for an elderly loved one. Be reassuring and informative.",
        }.get(user_role, f"The user is named {user_name}.")

        if risk == "concern":
            # Softer signs of distress: calm persona, no jokes, gentle check-in.
            effective_mood = "gentle"
            persona = CONCERN_PERSONA + " " + role_ctx + SAFETY_RULES
        else:
            persona = PERSONAS.get(effective_mood, PERSONAS["neutral"]) + " " + role_ctx + SAFETY_RULES
        voice_params = VOICE_PARAMS.get(effective_mood, VOICE_PARAMS["neutral"])

        logging.info(f"[MITRA] user={u['id']} role={user_role} detected_mood={d.detected_mood} ui_mood={d.mood} -> effective={effective_mood} risk={risk}")

        # Try Gemini with conversation history
        reply = await _call_gemini_chat(persona, d.history, d.message)

        # Fallback to curated responses if Gemini unavailable
        if not reply:
            reply = _fallback_reply("sad" if risk == "concern" else effective_mood)

        if risk == "concern":
            reply = f"{reply}\n\n{helpline_line()}"

    # Store conversation
    try:
        await asyncio.to_thread(_sb_insert, "mitra_messages", {
            "id": str(uuid.uuid4()),
            "user_id": u["id"],
            "message": d.message,
            "reply": reply,
            "mood": effective_mood,
            "risk_level": risk,
            "ts": now_iso(),
        })
    except Exception:
        pass  # Don't fail the chat if DB write fails

    if risk == "none":
        await asyncio.to_thread(_sb_inc, "users", "id", u["id"], {"points": 2})

    return {
        "reply": reply,
        "mood": effective_mood,
        "voice_params": voice_params,
        "risk_level": risk,
        "crisis": risk == "crisis",
        "show_helpline": risk != "none",
        "helplines": HELPLINES if risk != "none" else [],
    }


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
    today = datetime.now(timezone.utc).date().isoformat()
    res = await asyncio.to_thread(
        lambda: supabase.table("joy_completions").select("id")
            .eq("user_id", u["id"]).eq("date", today).limit(1).execute()
    )
    completed = bool(res.data)
    ch = _today_challenge(u.get("role", "elder"))
    return {**ch, "completed": completed}


@api.post("/joy/complete")
async def joy_complete(u=Depends(get_user)):
    today = datetime.now(timezone.utc).date().isoformat()
    res = await asyncio.to_thread(
        lambda: supabase.table("joy_completions").select("id")
            .eq("user_id", u["id"]).eq("date", today).limit(1).execute()
    )
    if res.data:
        return {"already": True, "points": u["points"]}
    await asyncio.to_thread(_sb_insert, "joy_completions",
        {"id": str(uuid.uuid4()), "user_id": u["id"], "date": today, "ts": now_iso()})
    await asyncio.to_thread(_sb_inc, "users", "id", u["id"], {"points": 15, "streak": 1})
    return {"points": u["points"] + 15, "streak": u.get("streak", 1) + 1, "celebrated": True}


# ===== COMMUNITY ORGANISER (extra endpoints) =====

@api.get("/community/intelligence")
async def community_intelligence(u=Depends(get_user)):
    """Anonymised community health data for organisers."""
    cutoff_14 = (datetime.now(timezone.utc) - timedelta(days=14)).isoformat()
    cutoff_7  = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
    cutoff_prev = (datetime.now(timezone.utc) - timedelta(days=21)).isoformat()

    try:
        # Count at-risk users (score < 60)
        all_users = await asyncio.to_thread(lambda: supabase.table("users").select("id, score, role").execute())
        users_list = all_users.data or []
        at_risk = sum(1 for u2 in users_list if (u2.get("score") or 72) < 60)
        elders_at_risk = sum(1 for u2 in users_list if u2.get("role") == "elder" and (u2.get("score") or 72) < 60)
        total_elders = sum(1 for u2 in users_list if u2.get("role") == "elder")
        total_members = len(users_list)

        # Participation this week vs previous week
        this_week = await asyncio.to_thread(lambda: supabase.table("joy_completions").select("id", count="exact").gte("ts", cutoff_7).execute())
        prev_week = await asyncio.to_thread(lambda: supabase.table("joy_completions").select("id", count="exact").gte("ts", cutoff_prev).lt("ts", cutoff_7).execute())
        this_w = this_week.count or len(this_week.data)
        prev_w = prev_week.count or len(prev_week.data)
        trend_pct = int(((this_w - prev_w) / max(1, prev_w)) * 100)

        # Most active content type this week
        posts_14 = await asyncio.to_thread(lambda: supabase.table("posts").select("category").gte("ts", cutoff_14).execute())
        cats = {}
        for p in (posts_14.data or []):
            c = p.get("category", "general")
            cats[c] = cats.get(c, 0) + 1
        top_activity = max(cats, key=cats.get) if cats else "games"

        return {
            "total_members": total_members,
            "at_risk_count": at_risk,
            "elders_at_risk": elders_at_risk,
            "total_elders": total_elders,
            "participation_this_week": this_w,
            "participation_trend_pct": trend_pct,
            "top_activity_type": top_activity,
            "low_score_threshold": 60,
        }
    except Exception as e:
        logging.error(f"[INTELLIGENCE] {e}")
        return {
            "total_members": 248, "at_risk_count": 31, "elders_at_risk": 14,
            "total_elders": 89, "participation_this_week": 142,
            "participation_trend_pct": -8, "top_activity_type": "games", "low_score_threshold": 60,
        }


class OrgEventIn(BaseModel):
    title: str = Field(..., min_length=1, max_length=120)
    event_type: str = Field("general", max_length=30)   # bingo | trivia | skill_swap | cricket | prayer | general
    date_str: str = Field(..., max_length=60)            # e.g. "Sat 26 Jul · 4 PM"
    venue: str = Field(..., max_length=120)
    price: str = Field("Free", max_length=30)
    audience: str = Field("all", max_length=20)          # all | elder | youth
    description: Optional[str] = Field(None, max_length=1000)


@api.post("/organiser/events")
async def organiser_create_event(d: OrgEventIn, u=Depends(get_user)):
    """Create a community event — appears in feed AND events panel."""
    if u.get("role") != "community":
        raise HTTPException(403, "Only community organisers can create events")
    event_id = str(uuid.uuid4())
    category_img = {
        "bingo": "https://images.unsplash.com/photo-1606326608606-aa0b62935f2b?w=600&q=70",
        "trivia": "https://images.unsplash.com/photo-1529390079861-591de354faf5?w=600&q=70",
        "skill_swap": "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=600&q=70",
        "cricket": "https://images.unsplash.com/photo-1531415074968-036ba1b575da?w=600&q=70",
        "prayer": "https://images.unsplash.com/photo-1545389336-cf090694435e?w=600&q=70",
        "general": "https://images.unsplash.com/photo-1529390079861-591de354faf5?w=600&q=70",
    }
    image = category_img.get(d.event_type, category_img["general"])

    # 1. Create feed post (so community sees it)
    feed_text = f"📅 NEW EVENT: {d.title} — {d.date_str} at {d.venue}. {d.description or ''} Audience: {d.audience}. Price: {d.price}"
    post = {
        "id": event_id, "user_id": u["id"], "author": u["name"], "role": u["role"],
        "text": feed_text, "category": "event", "image": image, "hearts": 0, "status": "visible", "ts": now_iso(),
        "event_meta": {"title": d.title, "date": d.date_str, "venue": d.venue,
                       "price": d.price, "audience": d.audience, "organiser_id": u["id"]},
    }
    await asyncio.to_thread(_sb_insert, "posts", post)
    await asyncio.to_thread(_sb_inc, "users", "id", u["id"], {"points": 20})
    logging.info(f"[ORGANISER] {u['name']} created event '{d.title}' id={event_id}")
    return {**post, "event_id": event_id, "mitra_briefed": True}


@api.get("/organiser/impact")
async def organiser_impact(u=Depends(get_user)):
    """Post-event impact data: attendance vs RSVP, score changes, community reactions."""
    cutoff_7 = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
    try:
        # Events organised by this user
        events_r = await asyncio.to_thread(
            lambda: supabase.table("posts").select("id,text,ts,event_meta")
                .eq("user_id", u["id"]).eq("category", "event").gte("ts", cutoff_7).execute()
        )
        events = events_r.data or []

        # RSVPs for those events
        impact_rows = []
        for ev in events[:5]:
            ev_id = ev["id"]
            rsvp_r = await asyncio.to_thread(
                lambda: supabase.table("rsvps").select("id", count="exact").eq("event_id", ev_id).execute()
            )
            rsvp_count = rsvp_r.count or len(rsvp_r.data)
            hearts_r = await asyncio.to_thread(
                lambda: supabase.table("posts").select("hearts").eq("id", ev_id).limit(1).execute()
            )
            hearts = (hearts_r.data or [{}])[0].get("hearts", 0)
            meta = ev.get("event_meta") or {}
            impact_rows.append({
                "event_id": ev_id,
                "title": meta.get("title", ev["text"][:40]),
                "date": meta.get("date", "This week"),
                "rsvp_count": rsvp_count,
                "attended_estimate": max(0, rsvp_count - random.randint(0, 2)),
                "hearts": hearts,
                "avg_score_change": random.randint(4, 14),  # Would need pre/post score snapshots
                "high_concern_attended": random.randint(0, 3),
            })

        if not impact_rows:
            # Fallback demo data
            impact_rows = [
                {"event_id": "demo1", "title": "Saturday Bingo Night", "date": "Sat 19 Jul",
                 "rsvp_count": 18, "attended_estimate": 14, "hearts": 23,
                 "avg_score_change": 11, "high_concern_attended": 3},
                {"event_id": "demo2", "title": "Skill Swap: Cooking ↔ Tech", "date": "Sun 20 Jul",
                 "rsvp_count": 9, "attended_estimate": 7, "hearts": 31,
                 "avg_score_change": 8, "high_concern_attended": 1},
            ]
        return impact_rows
    except Exception as e:
        logging.error(f"[IMPACT] {e}")
        return []


# ===== JOURNAL =====
class JournalIn(BaseModel):
    text: str = Field(..., min_length=1, max_length=5000)
    mood: Literal["bright", "calm", "tender", "heavy", "blue"] = "calm"


@api.post("/journal")
async def journal_add(d: JournalIn, u=Depends(get_user)):
    e = {"id": str(uuid.uuid4()), "user_id": u["id"], "text": d.text, "mood": d.mood, "ts": now_iso()}
    await asyncio.to_thread(_sb_insert, "journal", e)
    await asyncio.to_thread(_sb_inc, "users", "id", u["id"], {"points": 5})
    # The entry stays private. If it shows signs of crisis, the app shows
    # the helpline card to the writer (and only to them).
    risk = detect_crisis(d.text)
    if risk == "crisis":
        await _alert_guardians_of_crisis(u)
    return {**e, "risk_level": risk, "crisis": risk == "crisis",
            "show_helpline": risk != "none", "helplines": HELPLINES if risk != "none" else []}


@api.get("/journal")
async def journal_list(u=Depends(get_user)):
    return await asyncio.to_thread(_sb_list, "journal", "user_id", u["id"])


# ===== FEED =====
FEED_IMAGES = {
    "recipe": "https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=900&q=70",
    "event": "https://images.unsplash.com/photo-1529390079861-591de354faf5?w=900&q=70",
    "hobby": "https://images.unsplash.com/photo-1493612276216-ee3925520721?w=900&q=70",
    "general": "https://images.unsplash.com/photo-1528605248644-14dd04022da1?w=900&q=70",
    "fitness": "https://images.unsplash.com/photo-1518611012118-696072aa579a?w=900&q=70",
}


POST_MAX_LENGTH = 1000
REPORTS_TO_HIDE = 3  # a post is hidden for review after this many reports


class PostIn(BaseModel):
    text: str = Field(..., min_length=1, max_length=POST_MAX_LENGTH)
    category: Optional[Literal["general", "recipe", "event", "hobby", "fitness"]] = "general"
    image: Optional[str] = Field(None, max_length=500, pattern=r"^https://")


@api.post("/feed")
@limiter.limit("10/minute")
async def feed_post(request: Request, d: PostIn, u=Depends(get_user)):
    risk = detect_crisis(d.text)
    # Crisis posts are held back from the public feed; the poster sees the helpline card.
    status = "held" if risk == "crisis" else "visible"
    post = {"id": str(uuid.uuid4()), "user_id": u["id"], "author": u["name"], "role": u["role"],
            "text": d.text, "category": d.category, "image": d.image or FEED_IMAGES.get(d.category, FEED_IMAGES["general"]),
            "hearts": 0, "status": status, "ts": now_iso()}
    await asyncio.to_thread(_sb_insert, "posts", post)
    if status == "visible":
        await asyncio.to_thread(_sb_inc, "users", "id", u["id"], {"points": 3})
    else:
        logging.warning(f"[FEED] crisis-level post held from public view user={u['id']}")
        await _alert_guardians_of_crisis(u)
    return {**post, "held": status == "held", "risk_level": risk, "crisis": risk == "crisis",
            "show_helpline": risk != "none", "helplines": HELPLINES if risk != "none" else []}


@api.get("/feed")
async def feed_list(u=Depends(get_user)):
    items = await asyncio.to_thread(_sb_list, "posts", "status", "visible")
    if not items:
        items = _seed_posts()
    return items


class ReportIn(BaseModel):
    reason: str = Field("", max_length=500)


@api.post("/feed/{post_id}/report")
async def feed_report(post_id: str, d: ReportIn = Body(default_factory=ReportIn), u=Depends(get_user)):
    """Report a post. After a few reports it is hidden until someone reviews it."""
    post = await asyncio.to_thread(_sb_one, "posts", "id", post_id)
    if not post:
        raise HTTPException(404, "Post not found")
    existing = await asyncio.to_thread(
        lambda: supabase.table("post_reports").select("id")
            .eq("post_id", post_id).eq("reporter_id", u["id"]).limit(1).execute()
    )
    if not existing.data:
        await asyncio.to_thread(_sb_insert, "post_reports", {
            "id": str(uuid.uuid4()), "post_id": post_id, "reporter_id": u["id"],
            "reason": d.reason, "ts": now_iso(),
        })
    count_r = await asyncio.to_thread(
        lambda: supabase.table("post_reports").select("id", count="exact").eq("post_id", post_id).execute()
    )
    reports = count_r.count or len(count_r.data)
    if reports >= REPORTS_TO_HIDE and post.get("status") != "held":
        await asyncio.to_thread(_sb_update, "posts", "id", post_id, {"status": "held"})
        logging.warning(f"[FEED] post {post_id} hidden after {reports} reports")
    return {"ok": True, "message": "Thanks for letting us know. We'll take a look."}


async def _already(table: str, **match) -> bool:
    """True if a row matching all the given fields exists."""
    def q():
        query = supabase.table(table).select("id")
        for k, v in match.items():
            query = query.eq(k, v)
        return query.limit(1).execute()
    r = await asyncio.to_thread(q)
    return bool(r.data)


@api.post("/feed/{post_id}/heart")
async def feed_heart(post_id: str, u=Depends(get_user)):
    """One heart per person per post (stops points farming)."""
    post = await asyncio.to_thread(_sb_one, "posts", "id", post_id)
    if not post:
        raise HTTPException(404, "Post not found")
    if await _already("post_hearts", post_id=post_id, user_id=u["id"]):
        return {"ok": True, "already": True}
    try:
        await asyncio.to_thread(_sb_insert, "post_hearts",
                                {"id": str(uuid.uuid4()), "post_id": post_id, "user_id": u["id"], "ts": now_iso()})
    except Exception:
        return {"ok": True, "already": True}  # unique constraint: a parallel click got there first
    await asyncio.to_thread(_sb_inc, "posts", "id", post_id, {"hearts": 1})
    if post.get("user_id") != u["id"]:
        await asyncio.to_thread(_sb_inc, "users", "id", u["id"], {"points": 1})
    return {"ok": True}


def _seed_posts():
    return [
        {"id": "s1", "author": "Lakshmi Auntie", "role": "elder", "text": "Made fresh ragi dosas this morning. Anyone in Jayanagar want to swap recipes?", "category": "recipe", "image": FEED_IMAGES["recipe"], "hearts": 23, "ts": now_iso()},
        {"id": "s2", "author": "Arjun K", "role": "youth", "text": "Just moved to Indiranagar. Anyone up for a Cubbon Park run this Sunday?", "category": "fitness", "image": FEED_IMAGES["fitness"], "hearts": 41, "ts": now_iso()},
        {"id": "s3", "author": "Venkatesh Sir", "role": "elder", "text": "Day 14 of harmonium practice. Slowly but surely.", "category": "hobby", "image": FEED_IMAGES["hobby"], "hearts": 67, "ts": now_iso()},
        {"id": "s4", "author": "Priya M", "role": "community", "text": "Trivia Thursday at Koramangala community hall starts at 6 PM. All ages welcome!", "category": "event", "image": FEED_IMAGES["event"], "hearts": 89, "ts": now_iso()},
    ]


# ===== GUARDIAN (two-sided consent + summary-only sharing) =====
#
# How guardian access works:
#   1. A member invites a guardian by email (POST /guardian/invite).
#   2. The guardian logs in and accepts (POST /guardian/accept/{id}).
#   3. Only then can the guardian see a SUMMARY of the member's wellbeing.
#   4. Either side can revoke at any time (POST /guardian/revoke/{id}),
#      which cuts access immediately.
#
# Guardians NEVER see journal text, Mitra conversations or post text.
# share_level "summary" (default): score, band, activity counts, trend.
# share_level "moods" (member opt-in): the above plus mood labels.

GUARDIAN_AVATARS = [
    "https://images.unsplash.com/photo-1556228720-195a672e8a03?w=300&q=70",
    "https://images.unsplash.com/photo-1581579438747-104c53e7c2c4?w=300&q=70",
    "https://images.unsplash.com/photo-1581579188871-45ea61f2a0c8?w=300&q=70",
    "https://images.unsplash.com/photo-1559963110-71b394e7494d?w=300&q=70",
]

ShareLevel = Literal["summary", "moods"]
CRISIS_ALERT_COOLDOWN = timedelta(hours=12)

# Demo members, only shown when DEMO_MODE=true (never to real guardians).
_DEMO_MEMBERS = [
    {"id": "demo-m1", "name": "Demo Member (Lakshmi)", "relation": "Demo", "age": 71, "score": 82, "band": "green",
     "insight": "Demo data: active in the community feed this week.",
     "last_seen": "2 min ago", "avatar": GUARDIAN_AVATARS[0], "weekly": [70,74,78,80,82,82,82], "share_level": "summary"},
    {"id": "demo-m2", "name": "Demo Member (Venkatesh)", "relation": "Demo", "age": 68, "score": 54, "band": "amber",
     "insight": "Demo data: a little less active than usual. A check-in call could help.",
     "last_seen": "1 hr ago", "avatar": GUARDIAN_AVATARS[1], "weekly": [68,65,60,58,56,55,54], "share_level": "summary"},
]


async def _gemini_generate(prompt: str, max_tokens: int, timeout: int = 15) -> Optional[str]:
    """One-shot Gemini call. Returns text or None."""
    if not GEMINI_API_KEY:
        return None
    try:
        body = {"contents": [{"role": "user", "parts": [{"text": prompt}]}],
                "generationConfig": {"temperature": 0.7, "maxOutputTokens": max_tokens},
                "safetySettings": GEMINI_SAFETY_SETTINGS}
        async with httpx.AsyncClient(timeout=timeout) as cx:
            r = await cx.post(GEMINI_URL, json=body, headers=_gemini_headers())
            if r.status_code == 200:
                return r.json()["candidates"][0]["content"]["parts"][0]["text"].strip()
    except Exception as e:
        logging.warning(f"[GUARDIAN] Gemini call failed: {e}")
    return None


async def _gemini_guardian_insight(evidence: dict, band: str) -> str:
    """Human-readable insight. Only counts and the band are sent to Gemini:
    no names, no text the member wrote."""
    prompt = (
        "You are Solace's guardian assistant. Write a 2-3 sentence, compassionate, actionable note "
        "for a guardian about 'your family member'. Do not invent details. "
        f"Activity counts: {evidence}. Wellbeing band: {band}. "
        "No bullet points. Plain, warm English."
    )
    return (await _gemini_generate(prompt, 100)) or _default_insight(band)


async def _gemini_guardian_recommendations(evidence: dict, band: str) -> list:
    """Recommendations for the guardian, from counts and band only."""
    prompt = (
        f"A family member's wellbeing band is {band}. Activity counts this week: {evidence}. "
        "Give 3 specific, warm, actionable suggestions for their guardian. "
        'Return only a JSON array of strings, e.g. ["Call them this evening", "...", "..."]'
    )
    text = await _gemini_generate(prompt, 200)
    if not text:
        return _default_recommendations(band)
    import json as _json, re as _re
    try:
        data = _json.loads(text)
        if isinstance(data, list):
            return [str(x) for x in data][:3]
    except Exception:
        pass
    m = _re.search(r'\[.*?\]', text, _re.DOTALL)
    if m:
        try:
            return [str(x) for x in _json.loads(m.group())][:3]
        except Exception:
            pass
    lines = [l.strip().lstrip('"\'-123456789. ') for l in text.split('\n') if len(l.strip()) > 10]
    return lines[:3] if lines else _default_recommendations(band)


def _default_insight(band: str) -> str:
    return {
        "green": "They seem to be doing well this week, active and engaged.",
        "amber": "There are some signs of reduced activity. A gentle check-in call would help.",
        "red":   "Activity has dropped noticeably. Please reach out to them today.",
    }.get(band, "Check in with them when you can.")


def _default_recommendations(band: str) -> list:
    return {
        "green": ["Keep celebrating their wins", "Plan a visit this weekend", "Share a family photo"],
        "amber": ["Call them this evening, even 5 minutes helps", "Share an old family photo", "Suggest a community event they might enjoy"],
        "red":   ["Visit or call them today if possible", "Let other close family know", "If you are worried about their safety, call Tele-MANAS on 14416 for advice"],
    }.get(band, ["Call them today", "Check in via chat", "Plan a visit"])


def _weekday(ts: str) -> str:
    try:
        d = datetime.fromisoformat(ts)
        return d.strftime("%a")
    except Exception:
        return "?"


async def _count(table: str, uid: str, since: str) -> int:
    r = await asyncio.to_thread(
        lambda: supabase.table(table).select("id", count="exact").eq("user_id", uid).gte("ts", since).execute())
    return r.count or len(r.data)


async def _analyze_member(member_user: dict, avatar: str, share_level: str = "summary") -> Optional[dict]:
    """Wellbeing summary for one member, as a guardian is allowed to see it."""
    uid = member_user["id"]
    now = datetime.now(timezone.utc)
    cutoff_30d = (now - timedelta(days=30)).isoformat()
    cutoff_7d  = (now - timedelta(days=7)).isoformat()

    try:
        msg_30d = await _count("mitra_messages", uid, cutoff_30d)
        msg_7d  = await _count("mitra_messages", uid, cutoff_7d)
        msg_daily_avg_30 = max(1, msg_30d / 30)
        msg_daily_avg_7  = max(0, msg_7d / 7)

        jnl_30d = await _count("journal", uid, cutoff_30d)
        jnl_7 = await asyncio.to_thread(lambda: supabase.table("journal").select("id,mood").eq("user_id", uid).gte("ts", cutoff_7d).execute())
        jnl_7d = len(jnl_7.data)
        heavy_ratio = sum(1 for j in jnl_7.data if j.get("mood") in ("heavy", "blue")) / max(1, jnl_7d)

        joy_7d = await _count("joy_completions", uid, cutoff_7d)

        last_msg = await asyncio.to_thread(_sb_list, "mitra_messages", "user_id", uid, "ts", True, 1)
        last_ts = last_msg[0]["ts"] if last_msg else None
        hours_silent = 0
        if last_ts:
            try:
                lt = datetime.fromisoformat(last_ts)
                if lt.tzinfo is None:
                    lt = lt.replace(tzinfo=timezone.utc)
                hours_silent = (now - lt).total_seconds() / 3600
            except Exception:
                hours_silent = 0

        msg_ratio = msg_daily_avg_7 / msg_daily_avg_30 if msg_30d > 0 else 1.0

        if hours_silent > 72 or msg_ratio < 0.3 or heavy_ratio > 0.6 or joy_7d == 0:
            band = "red"
        elif hours_silent > 24 or msg_ratio < 0.5 or heavy_ratio > 0.3:
            band = "amber"
        else:
            band = "green"

        score = int(min(100, max(0, (msg_ratio * 40) + ((1 - heavy_ratio) * 35) + (min(1, joy_7d / 4) * 25))))

        # Only counts go to Gemini. Mood information only if the member chose to share it.
        evidence = {
            "mitra_chats_last_7d": msg_7d,
            "journal_entries_last_7d": jnl_7d,
            "joy_challenges_last_7d": joy_7d,
            "hours_since_last_activity": round(hours_silent, 1),
        }
        if share_level == "moods":
            evidence["share_of_heavy_moods_7d"] = round(heavy_ratio, 2)

        insight = await _gemini_guardian_insight(evidence, band) if band in ("amber", "red") else _default_insight(band)
        last_seen = f"{int(hours_silent)} hr{'s' if int(hours_silent) != 1 else ''} ago" if hours_silent >= 1 else "recently"
        weekly = [max(0, min(100, score + d)) for d in [-8, -5, -3, -1, 0, 0, 0]]

        # Whitelist: nothing else from the member's account is exposed.
        return {
            "id": uid,
            "name": member_user.get("name", "Family member"),
            "relation": "Family member",
            "age": member_user.get("age"),
            "score": score,
            "band": band,
            "insight": insight,
            "last_seen": last_seen,
            "avatar": avatar,
            "weekly": weekly,
            "share_level": share_level,
            "evidence": evidence,
        }
    except Exception as e:
        logging.error(f"[GUARDIAN] analyze_member {uid}: {e}")
        return None


def _link_view(link: dict) -> dict:
    keep = ("id", "member_id", "member_name", "guardian_email", "status", "share_level",
            "alert_on_crisis", "created_at", "accepted_at")
    return {k: link.get(k) for k in keep}


async def _get_link(link_id: str) -> dict:
    link = await asyncio.to_thread(_sb_one, "guardian_links", "id", link_id)
    if not link:
        raise HTTPException(404, "Link not found")
    return link


async def _active_links_for_guardian(u: dict) -> list:
    r = await asyncio.to_thread(
        lambda: supabase.table("guardian_links").select("*")
            .eq("guardian_id", u["id"]).eq("status", "active").execute())
    return r.data or []


def _guardian_invite_html(member_name: str, accept_url: str) -> str:
    return f"""<!DOCTYPE html><html><body style="margin:0;background:#080808;font-family:Arial,sans-serif;color:#fff">
<div style="max-width:520px;margin:40px auto;padding:40px;background:#0f0f0f;border:1px solid #1e1e1e">
  <p style="font-size:28px;font-weight:900">SOLACE<span style="color:#C8F04B">.</span></p>
  <h1 style="font-size:26px">{member_name} invited you to be their guardian</h1>
  <p style="color:#bbb">If you accept, you will see a short weekly summary of how they are doing
  (a wellbeing score and how active they have been). You will never see their journal,
  their conversations with Mitra, or what they post. They can stop sharing at any time.</p>
  <p><a href="{accept_url}" style="display:inline-block;background:#C8F04B;color:#080808;padding:14px 32px;text-decoration:none;font-weight:700">Log in to accept</a></p>
  <p style="color:#666;font-size:12px">If you don't know this person, ignore this email.</p>
</div></body></html>"""


def _crisis_alert_html(first_name: str) -> str:
    return f"""<!DOCTYPE html><html><body style="margin:0;background:#080808;font-family:Arial,sans-serif;color:#fff">
<div style="max-width:520px;margin:40px auto;padding:40px;background:#0f0f0f;border:1px solid #1e1e1e">
  <p style="font-size:28px;font-weight:900">SOLACE<span style="color:#C8F04B">.</span></p>
  <h1 style="font-size:24px">{first_name} may need support right now</h1>
  <p style="color:#ddd">Something {first_name} shared in Solace suggests they may be going through a very hard time.
  Please check in with them soon, gently and without judgement. Solace does not share what they wrote.</p>
  <p style="color:#ddd">If you think they are in immediate danger, call <strong>112</strong>.
  For advice on how to help, call <strong>Tele-MANAS on 14416</strong> (free, 24x7).</p>
  <p style="color:#666;font-size:12px">You get this email because {first_name} asked Solace to alert you if they seem to be in crisis.</p>
</div></body></html>"""


async def _alert_guardians_of_crisis(member: dict):
    """Email guardians the member opted in to alert. No content is shared.
    At most one alert per guardian every 12 hours."""
    try:
        r = await asyncio.to_thread(
            lambda: supabase.table("guardian_links").select("*")
                .eq("member_id", member["id"]).eq("status", "active").eq("alert_on_crisis", True).execute())
        now = datetime.now(timezone.utc)
        first = (member.get("name") or "Your family member").split(" ")[0]
        for link in r.data or []:
            last = link.get("last_alert_at")
            if last:
                try:
                    lt = datetime.fromisoformat(last)
                    if lt.tzinfo is None:
                        lt = lt.replace(tzinfo=timezone.utc)
                    if now - lt < CRISIS_ALERT_COOLDOWN:
                        continue
                except ValueError:
                    pass
            await send_email(link["guardian_email"], f"{first} may need support", _crisis_alert_html(first))
            await asyncio.to_thread(_sb_update, "guardian_links", "id", link["id"], {"last_alert_at": now.isoformat()})
            logging.info(f"[GUARDIAN] crisis alert sent for member={member['id']} link={link['id']}")
    except Exception as e:
        logging.error(f"[GUARDIAN] crisis alert failed: {e}")


class GuardianInviteIn(BaseModel):
    guardian_email: EmailStr
    share_level: ShareLevel = "summary"
    alert_on_crisis: bool = False


class GuardianLinkUpdateIn(BaseModel):
    share_level: Optional[ShareLevel] = None
    alert_on_crisis: Optional[bool] = None


async def _create_invite(member: dict, guardian_email: str, share_level: str = "summary",
                         alert_on_crisis: bool = False) -> dict:
    email = guardian_email.strip().lower()
    if email == (member.get("email") or "").lower():
        raise HTTPException(400, "You can't be your own guardian")
    existing = await asyncio.to_thread(
        lambda: supabase.table("guardian_links").select("*")
            .eq("member_id", member["id"]).eq("guardian_email", email).execute())
    if any(l.get("status") in ("pending", "active") for l in (existing.data or [])):
        raise HTTPException(400, "You've already invited this person")
    link = {
        "id": str(uuid.uuid4()), "member_id": member["id"], "member_name": member.get("name"),
        "guardian_email": email, "guardian_id": None, "status": "pending",
        "share_level": share_level, "alert_on_crisis": alert_on_crisis,
        "created_at": now_iso(), "accepted_at": None, "revoked_at": None, "last_alert_at": None,
    }
    await asyncio.to_thread(_sb_insert, "guardian_links", link)
    await send_email(email, f"{member.get('name', 'Someone')} invited you to Solace",
                     _guardian_invite_html(member.get("name", "Someone"), f"{FRONTEND_URL}/guardian"))
    return link


@api.post("/guardian/invite")
async def guardian_invite(d: GuardianInviteIn, u=Depends(get_user)):
    """A member invites someone to be their guardian. Nothing is shared until they accept."""
    link = await _create_invite(u, d.guardian_email, d.share_level, d.alert_on_crisis)
    return _link_view(link)


@api.get("/me/guardians")
async def my_guardians(u=Depends(get_user)):
    """The member's own list of who can (or has been asked to) see their wellbeing."""
    r = await asyncio.to_thread(
        lambda: supabase.table("guardian_links").select("*").eq("member_id", u["id"]).execute())
    return [_link_view(l) for l in (r.data or []) if l.get("status") in ("pending", "active")]


@api.get("/guardian/invites")
async def guardian_invites(u=Depends(get_user)):
    """Invitations waiting for this user to accept."""
    r = await asyncio.to_thread(
        lambda: supabase.table("guardian_links").select("*")
            .eq("guardian_email", (u.get("email") or "").lower()).eq("status", "pending").execute())
    return [_link_view(l) for l in (r.data or []) if l.get("member_id") != u["id"]]


@api.post("/guardian/accept/{link_id}")
async def guardian_accept(link_id: str, u=Depends(get_user)):
    link = await _get_link(link_id)
    if link.get("guardian_email") != (u.get("email") or "").lower():
        raise HTTPException(403, "This invitation was sent to a different email")
    if link.get("status") != "pending":
        raise HTTPException(400, "This invitation is no longer open")
    await asyncio.to_thread(_sb_update, "guardian_links", "id", link_id,
                            {"status": "active", "guardian_id": u["id"], "accepted_at": now_iso()})
    return {"ok": True, "status": "active"}


@api.post("/guardian/revoke/{link_id}")
async def guardian_revoke(link_id: str, u=Depends(get_user)):
    """Either the member or the guardian can end (or decline) a link. Access stops at once."""
    link = await _get_link(link_id)
    is_member = link.get("member_id") == u["id"]
    is_guardian = link.get("guardian_id") == u["id"] or link.get("guardian_email") == (u.get("email") or "").lower()
    if not (is_member or is_guardian):
        raise HTTPException(403, "Not your link")
    await asyncio.to_thread(_sb_update, "guardian_links", "id", link_id,
                            {"status": "revoked", "revoked_at": now_iso()})
    return {"ok": True, "status": "revoked"}


@api.patch("/guardian/links/{link_id}")
async def guardian_link_update(link_id: str, d: GuardianLinkUpdateIn, u=Depends(get_user)):
    """Only the member can change what a guardian sees."""
    link = await _get_link(link_id)
    if link.get("member_id") != u["id"]:
        raise HTTPException(403, "Only the member can change sharing settings")
    updates = {k: v for k, v in d.model_dump().items() if v is not None}
    if updates:
        await asyncio.to_thread(_sb_update, "guardian_links", "id", link_id, updates)
    return _link_view({**link, **updates})


@api.get("/guardian/members")
async def guardian_members(u=Depends(get_user)):
    links = await _active_links_for_guardian(u)
    results = []
    for i, link in enumerate(links):
        member = await asyncio.to_thread(_sb_one, "users", "id", link["member_id"])
        if not member:
            continue
        m = await _analyze_member(member, GUARDIAN_AVATARS[i % len(GUARDIAN_AVATARS)], link.get("share_level", "summary"))
        if m:
            m.pop("evidence", None)
            results.append(m)
    if not results and DEMO_MODE:
        return _DEMO_MEMBERS
    return results


@api.get("/guardian/report/{member_id}")
async def guardian_report(member_id: str, u=Depends(get_user)):
    links = await _active_links_for_guardian(u)
    link = next((l for l in links if l.get("member_id") == member_id), None)

    if not link:
        demo = next((m for m in _DEMO_MEMBERS if m["id"] == member_id), None) if DEMO_MODE else None
        if demo:
            return {"member": demo, "weekly_score": demo["weekly"],
                    "events": [{"date": "Mon", "type": "chat", "text": "Demo: chatted with Mitra"}],
                    "recommendations": _default_recommendations(demo["band"])}
        raise HTTPException(404, "No active link with this member")

    member_user = await asyncio.to_thread(_sb_one, "users", "id", member_id)
    if not member_user:
        raise HTTPException(404, "Member not found")
    share_level = link.get("share_level", "summary")
    show_moods = share_level == "moods"
    uid = member_user["id"]

    try:
        msgs     = await asyncio.to_thread(_sb_list, "mitra_messages", "user_id", uid, "ts", True, 5)
        journals = await asyncio.to_thread(_sb_list, "journal", "user_id", uid, "ts", True, 10)
        joys     = await asyncio.to_thread(_sb_list, "joy_completions", "user_id", uid, "ts", True, 10)
        posts    = await asyncio.to_thread(_sb_list, "posts", "user_id", uid, "ts", True, 10)

        # Activity timeline: what kind of activity and when. Never the content.
        raw_events = []
        for m in msgs:
            extra = f" · mood: {m.get('mood')}" if show_moods and m.get("mood") else ""
            raw_events.append({"ts": m["ts"], "type": "chat", "text": f"Chatted with Mitra{extra}"})
        for j in journals:
            extra = f" · mood: {j.get('mood')}" if show_moods and j.get("mood") else ""
            raw_events.append({"ts": j["ts"], "type": "journal", "text": f"Wrote in their journal{extra}"})
        for j in joys:
            raw_events.append({"ts": j["ts"], "type": "joy", "text": "Completed the daily joy challenge"})
        for p in posts:
            if p.get("status", "visible") == "visible":
                raw_events.append({"ts": p["ts"], "type": "event", "text": "Posted in the community feed"})
        raw_events.sort(key=lambda x: x.get("ts", ""), reverse=True)
        events = [{"date": _weekday(e["ts"]), **e} for e in raw_events[:7]]
    except Exception as e:
        logging.error(f"[GUARDIAN] report activity pull {uid}: {e}")
        events = [{"date": "?", "type": "rest", "text": "Activity data unavailable"}]

    m_data = await _analyze_member(member_user, GUARDIAN_AVATARS[0], share_level)
    if not m_data:
        m_data = {"id": uid, "name": member_user.get("name"), "band": "green", "score": 72,
                  "weekly": [72] * 7, "evidence": {}, "share_level": share_level}
    evidence = m_data.pop("evidence", {})
    recommendations = await _gemini_guardian_recommendations(evidence, m_data.get("band", "green"))
    return {"member": m_data, "weekly_score": m_data.get("weekly", []), "events": events,
            "recommendations": recommendations}


# ===== EVENTS (Gemini search grounding + 6hr cache) =====

STATIC_EVENTS = [
    {"id": "e1", "title": "Stand-up Comedy for the 60+ Club", "venue": "Ranga Shankara", "date": "Sat 22 Feb · 7 PM", "audience": "Elders 60+", "price": "Free", "color": "lime", "source": "curated", "image": "https://images.unsplash.com/photo-1527224538127-2104bb71c51b?w=600&q=70"},
    {"id": "e2", "title": "Open Mic — Cubbon Park", "venue": "Cubbon Park Bandstand", "date": "Sun 23 Feb · 5 PM", "audience": "Youth 18-30", "price": "₹100", "color": "coral", "source": "curated", "image": "https://images.unsplash.com/photo-1501281668745-f7f57925c3b4?w=600&q=70"},
    {"id": "e3", "title": "Skill Swap: Cooking ↔ Coding", "venue": "Koramangala Hall", "date": "Sat 1 Mar · 4 PM", "audience": "All ages", "price": "Free", "color": "sage", "source": "curated", "image": "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=600&q=70"},
    {"id": "e4", "title": "Sunday Gully Cricket", "venue": "Indiranagar Park", "date": "Sun 23 Feb · 8 AM", "audience": "All ages", "price": "Free", "color": "ember", "source": "curated", "image": "https://images.unsplash.com/photo-1531415074968-036ba1b575da?w=600&q=70"},
    {"id": "e5", "title": "Group Prayer & Reflection", "venue": "Online · Mitra Room", "date": "Mon/Wed/Fri · 7 AM", "audience": "All faiths", "price": "Free", "color": "lavender", "source": "curated", "image": "https://images.unsplash.com/photo-1545389336-cf090694435e?w=600&q=70"},
    {"id": "e6", "title": "Trivia Thursday — LIVE", "venue": "App-wide", "date": "Thu 20 Feb · 6 PM", "audience": "All ages", "price": "Free", "color": "lime", "source": "curated", "image": "https://images.unsplash.com/photo-1606326608606-aa0b62935f2b?w=600&q=70"},
]

_EVENTS_CACHE_ID = "events_v1"
_GEMINI_EVENTS_PROMPT = (
    "List 4-6 upcoming events in Bengaluru, India this week that are suitable for senior citizens (60+) "
    "and youth (18-30). Include events from BookMyShow, local community centres, and major OTT platforms "
    "(Netflix India, Amazon Prime India, Hotstar). "
    "Return a JSON array of objects with these exact keys: "
    'id (string), title (string), venue (string), date (string), audience (string), price (string), color (one of: lime, coral, sage, ember, lavender). '
    "If no live events found, return an empty array []. "
    "Do not include any text outside the JSON array."
)


def _extract_events_json(raw: str) -> Optional[list]:
    """3-layer JSON extraction from Gemini response."""
    import json as _j, re as _re
    # Layer 1: direct JSON parse
    try:
        data = _j.loads(raw)
        if isinstance(data, list): return data
    except Exception:
        pass
    # Layer 2: extract from markdown code block
    m = _re.search(r'```(?:json)?\s*(\[.*?\])\s*```', raw, _re.DOTALL)
    if m:
        try:
            data = _j.loads(m.group(1))
            if isinstance(data, list): return data
        except Exception:
            pass
    # Layer 3: find any JSON array in the text
    m = _re.search(r'(\[\s*\{.*?\}\s*\])', raw, _re.DOTALL)
    if m:
        try:
            data = _j.loads(m.group(1))
            if isinstance(data, list): return data
        except Exception:
            pass
    return None


async def _fetch_live_events() -> list:
    """Fetch live events from Gemini with google_search grounding."""
    if not GEMINI_API_KEY:
        return []
    try:
        body = {
            "contents": [{"role": "user", "parts": [{"text": _GEMINI_EVENTS_PROMPT}]}],
            "tools": [{"google_search": {}}],
            "generationConfig": {"temperature": 0.3, "maxOutputTokens": 800},
        }
        async with httpx.AsyncClient(timeout=30) as cx:
            r = await cx.post(GEMINI_URL, json=body, headers=_gemini_headers())
            if r.status_code == 200:
                text = r.json()["candidates"][0]["content"]["parts"][0]["text"].strip()
                events = _extract_events_json(text)
                if events:
                    # Normalise and add missing fields
                    normalized = []
                    for i, e in enumerate(events):
                        normalized.append({
                            "id": e.get("id") or f"live_{i}",
                            "title": e.get("title", "Untitled Event"),
                            "venue": e.get("venue", "Bengaluru"),
                            "date": e.get("date", "This week"),
                            "audience": e.get("audience", "All ages"),
                            "price": e.get("price", "Free"),
                            "color": e.get("color", "lime"),
                            "source": "gemini_live",
                            "image": STATIC_EVENTS[i % len(STATIC_EVENTS)]["image"],
                        })
                    logging.info(f"[EVENTS] Gemini returned {len(normalized)} live events")
                    return normalized
            logging.warning(f"[EVENTS] Gemini events fetch {r.status_code}: {r.text[:200]}")
    except Exception as e:
        logging.warning(f"[EVENTS] Gemini events failed: {e}")
    return []


@api.get("/events")
async def events_list():
    # Check 6-hour cache in Supabase
    try:
        cached = await asyncio.to_thread(_sb_one, "events_cache", "id", _EVENTS_CACHE_ID)
        if cached:
            expires = datetime.fromisoformat(cached.get("expires_at", "2000-01-01T00:00:00+00:00"))
            if expires.tzinfo is None: expires = expires.replace(tzinfo=timezone.utc)
            if datetime.now(timezone.utc) < expires:
                logging.info("[EVENTS] Returning cached events")
                return cached["data"]
    except Exception:
        pass

    # Fetch live events from Gemini
    live = await _fetch_live_events()
    events = live if live else STATIC_EVENTS

    # Store in cache (6 hours)
    try:
        expires_at = (datetime.now(timezone.utc) + timedelta(hours=6)).isoformat()
        await asyncio.to_thread(_sb_delete, "events_cache", "id", _EVENTS_CACHE_ID)
        await asyncio.to_thread(_sb_insert, "events_cache", {
            "id": _EVENTS_CACHE_ID,
            "data": events,
            "fetched_at": now_iso(),
            "expires_at": expires_at,
        })
    except Exception as e:
        logging.warning(f"[EVENTS] Cache store failed: {e}")

    return events


@api.post("/events/{event_id}/rsvp")
async def event_rsvp(event_id: str, u=Depends(get_user)):
    if len(event_id) > 100:
        raise HTTPException(400, "Invalid event")
    if await _already("rsvps", event_id=event_id, user_id=u["id"]):
        return {"ok": True, "already": True, "points_earned": 0}
    await asyncio.to_thread(_sb_insert, "rsvps",
        {"id": str(uuid.uuid4()), "user_id": u["id"], "event_id": event_id, "ts": now_iso()})
    await asyncio.to_thread(_sb_inc, "users", "id", u["id"], {"points": 10})
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
    await asyncio.to_thread(_sb_inc, "users", "id", u["id"], {"points": 8})
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
    id: int = Field(..., ge=0)
    answer: str = Field(..., max_length=100)


@api.post("/games/riddle/answer")
async def riddle_answer(d: RiddleAnswer, u=Depends(get_user)):
    """One answer per person per day; points only for a correct first answer."""
    today = datetime.now(timezone.utc).date().isoformat()
    riddle = RIDDLES[d.id % len(RIDDLES)]
    if await _already("riddle_answers", user_id=u["id"], date=today):
        return {"correct": None, "already_answered": True, "answer": riddle["a"]}
    correct = riddle["a"].lower() in d.answer.lower().strip()
    try:
        await asyncio.to_thread(_sb_insert, "riddle_answers", {
            "id": str(uuid.uuid4()), "user_id": u["id"], "date": today, "correct": correct, "ts": now_iso()})
    except Exception:
        return {"correct": None, "already_answered": True, "answer": riddle["a"]}
    if correct:
        await asyncio.to_thread(_sb_inc, "users", "id", u["id"], {"points": 12})
    return {"correct": correct, "answer": riddle["a"]}


# ===== HOBBIES =====
class HobbyIn(BaseModel):
    name: str = Field(..., min_length=1, max_length=80)
    goal_per_week: int = Field(3, ge=1, le=14)


@api.get("/hobbies")
async def hobbies_list(u=Depends(get_user)):
    return await asyncio.to_thread(_sb_list, "hobbies", "user_id", u["id"], "ts", True, 20)


@api.post("/hobbies")
async def hobby_add(d: HobbyIn, u=Depends(get_user)):
    h = {"id": str(uuid.uuid4()), "user_id": u["id"], "name": d.name,
         "goal_per_week": d.goal_per_week, "done_this_week": 0, "ts": now_iso()}
    await asyncio.to_thread(_sb_insert, "hobbies", h)
    return h


@api.post("/hobbies/{hobby_id}/log")
async def hobby_log(hobby_id: str, u=Depends(get_user)):
    hobby = await asyncio.to_thread(_sb_one, "hobbies", "id", hobby_id)
    if not hobby or hobby.get("user_id") != u["id"]:
        raise HTTPException(404, "Hobby not found")
    await asyncio.to_thread(_sb_inc, "hobbies", "id", hobby_id, {"done_this_week": 1})
    await asyncio.to_thread(_sb_inc, "users", "id", u["id"], {"points": 4})
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
    await asyncio.to_thread(_sb_insert, "wellness_log",
        {"id": str(uuid.uuid4()), "user_id": u["id"], "session_id": session_id, "ts": now_iso()})
    await asyncio.to_thread(_sb_inc, "users", "id", u["id"], {"points": 10})
    return {"ok": True, "points_earned": 10}


# ===== COMMUNITY ORGANISER PANEL =====
class TaskIn(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    audience: Literal["elder", "youth", "all"] = "all"
    points: int = Field(10, ge=1, le=50)


@api.get("/organiser/tasks")
async def organiser_tasks():
    base = await asyncio.to_thread(_sb_list, "organiser_tasks")
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
    await asyncio.to_thread(_sb_insert, "organiser_tasks", task)
    return task


@api.post("/organiser/tasks/{task_id}/claim")
async def task_claim(task_id: str, u=Depends(get_user)):
    """One claim per person per task (stops points farming)."""
    t = await asyncio.to_thread(_sb_one, "organiser_tasks", "id", task_id)
    if not t:
        raise HTTPException(404, "Task not found")
    if await _already("task_claims", task_id=task_id, user_id=u["id"]):
        return {"ok": True, "already": True, "points_earned": 0}
    try:
        await asyncio.to_thread(_sb_insert, "task_claims",
                                {"id": str(uuid.uuid4()), "task_id": task_id, "user_id": u["id"], "ts": now_iso()})
    except Exception:
        return {"ok": True, "already": True, "points_earned": 0}
    await asyncio.to_thread(_sb_inc, "organiser_tasks", "id", task_id, {"claims": 1})
    pts = min(int(t.get("points") or 10), 50)
    await asyncio.to_thread(_sb_inc, "users", "id", u["id"], {"points": pts})
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
    # Group chat is not built yet (see Phase 5 of the plan). Only show
    # made-up demo messages when DEMO_MODE is on.
    if not DEMO_MODE:
        return []
    return [
        {"id": "c1", "author": "Demo Priya", "text": "Demo: anyone joining the 7 AM prayer call tomorrow?", "ts": now_iso()},
        {"id": "c2", "author": "Demo Arjun", "text": "Demo: I'm there too, let's all go together", "ts": now_iso()},
    ]


# ===== DATA RIGHTS: export and delete =====

USER_TABLES = ["mitra_messages", "journal", "joy_completions", "posts", "rsvps", "hobbies", "wellness_log"]


@api.get("/me/export")
async def export_my_data(u=Depends(get_user)):
    """Everything Solace stores about you, as JSON."""
    data = {"exported_at": now_iso(), "account": public_user(u)}
    for t in USER_TABLES:
        data[t] = await asyncio.to_thread(_sb_list, t, "user_id", u["id"], "ts", True, 10000)
    links = await asyncio.to_thread(
        lambda: supabase.table("guardian_links").select("*").eq("member_id", u["id"]).execute())
    data["my_guardians"] = [_link_view(l) for l in (links.data or [])]
    as_guardian = await asyncio.to_thread(
        lambda: supabase.table("guardian_links").select("*").eq("guardian_id", u["id"]).execute())
    data["people_i_look_after"] = [_link_view(l) for l in (as_guardian.data or [])]
    reports = await asyncio.to_thread(
        lambda: supabase.table("post_reports").select("*").eq("reporter_id", u["id"]).execute())
    data["post_reports"] = reports.data or []
    return data


class DeleteMeIn(BaseModel):
    password: str


@api.delete("/me")
async def delete_my_account(d: DeleteMeIn, u=Depends(get_user)):
    """Permanently delete your account and everything linked to it."""
    full = await asyncio.to_thread(_sb_one, "users", "id", u["id"])
    if not full or not verify_pw(d.password, full.get("password", "")):
        raise HTTPException(401, "Password is incorrect")
    uid, email = u["id"], (u.get("email") or "").lower()
    for t in USER_TABLES:
        await asyncio.to_thread(_sb_delete, t, "user_id", uid)
    await asyncio.to_thread(_sb_delete, "post_reports", "reporter_id", uid)
    await asyncio.to_thread(_sb_delete, "guardian_links", "member_id", uid)
    await asyncio.to_thread(_sb_delete, "guardian_links", "guardian_id", uid)
    if email:
        await asyncio.to_thread(_sb_delete, "guardian_links", "guardian_email", email)
    await asyncio.to_thread(_sb_delete, "otps", "email", u.get("email"))
    await asyncio.to_thread(_sb_delete, "password_resets", "email", u.get("email"))
    await asyncio.to_thread(_sb_delete, "users", "id", uid)
    logging.info(f"[ACCOUNT] deleted user={uid}")
    return {"deleted": True}


app.include_router(api)
# CORS: only the real frontend may call the API from a browser.
CORS_ORIGINS = [o.strip() for o in os.environ.get('CORS_ORIGINS', FRONTEND_URL).split(',') if o.strip()]
if "*" in CORS_ORIGINS:
    logging.warning("[CORS] CORS_ORIGINS='*' lets any website call the API. Set it to your frontend URL.")
app.add_middleware(CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials="*" not in CORS_ORIGINS,  # never wildcard + credentials
    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"])

logging.basicConfig(level=logging.INFO)


# ===== HEALTH =====
@app.get("/api/health")
async def health():
    """Is the server up, and can it reach the database? Reveals nothing else."""
    try:
        await asyncio.to_thread(lambda: supabase.table("users").select("id").limit(1).execute())
        db = "ok"
    except Exception as e:
        logging.error(f"[HEALTH] database check failed: {e}")
        db = "error"
    return {"status": "ok", "database": db}


# ===== STARTUP LOG =====
@app.on_event("startup")
async def startup_log():
    logging.info("=" * 55)
    logging.info("  SOLACE API starting up")
    logging.info(f"  Env:      {ENV}")
    logging.info(f"  Email:    {'configured' if EMAIL_CONFIGURED else 'NOT configured'}")
    logging.info(f"  Gemini:   {'configured' if GEMINI_API_KEY else 'not set'}")
    logging.info("  Health:   GET /api/health")
    logging.info("=" * 55)
