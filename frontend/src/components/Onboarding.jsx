import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import confetti from "canvas-confetti";
import { useNavigate } from "react-router-dom";
import { DISCLAIMER } from "@/constants/helplines";
import { Link } from "react-router-dom";

const ROLES = [
  { id: "elder", label: "Elder (60+)", desc: "Feeling invisible after the kids moved away", color: "#F2A68A" },
  { id: "youth", label: "Youth (18-30)", desc: "New city, no real friends yet", color: "#C8F04B" },
  { id: "community", label: "Community Organiser", desc: "I bring people together", color: "#8BBF7A" },
  { id: "guardian", label: "Guardian", desc: "I worry about a parent or loved one", color: "#E8854A" },
];

const GOALS_BY_ROLE = {
  elder: ["Talk to someone daily", "Share a recipe", "Join a game", "Morning prayer", "Walk in the park"],
  youth: ["Meet new people", "Attend an event", "Pick up a hobby", "Daily mindfulness", "Help an elder"],
  community: ["Host an event", "Mentor someone", "Build neighbourhood pride", "Run a workshop"],
  guardian: ["Daily check-in with parent", "See their mood weekly", "Join their community"],
};

// ── OTP 6-digit input ────────────────────────────────────────────────────────
function OtpInput({ value, onChange, disabled }) {
  const refs = [useRef(), useRef(), useRef(), useRef(), useRef(), useRef()];

  const handleKey = (i, e) => {
    const digits = value.split("");
    if (e.key === "Backspace") {
      digits[i] = "";
      onChange(digits.join(""));
      if (i > 0) refs[i - 1].current?.focus();
      return;
    }
    if (!/^\d$/.test(e.key)) return;
    digits[i] = e.key;
    onChange(digits.join(""));
    if (i < 5) refs[i + 1].current?.focus();
  };

  const handlePaste = (e) => {
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    onChange(pasted.padEnd(6, "").slice(0, 6));
    refs[Math.min(pasted.length, 5)].current?.focus();
    e.preventDefault();
  };

  return (
    <div className="flex gap-3 justify-center" data-testid="onboarding-otp-input" onPaste={handlePaste}>
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <input
          key={i}
          ref={refs[i]}
          disabled={disabled}
          maxLength={1}
          value={value[i] || ""}
          onChange={() => {}}
          onKeyDown={(e) => handleKey(i, e)}
          className={`w-14 h-18 text-center font-mono text-3xl bg-[#0A0A0A] border rounded-sm outline-none transition-all
            ${value[i] ? "border-[#C8F04B] text-[#C8F04B]" : "border-[#333] text-white"}
            focus:border-[#C8F04B] focus:shadow-[0_0_12px_rgba(200,240,75,0.2)]
            disabled:opacity-40`}
          style={{ height: "4.5rem" }}
        />
      ))}
    </div>
  );
}

// ── Main Onboarding ──────────────────────────────────────────────────────────
export default function Onboarding({ onClose }) {
  const { register, sendOtp, verifyOtp, refresh } = useAuth();
  const nav = useNavigate();
  const [step, setStep] = useState(0);
  const [data, setData] = useState({
    role: "elder", name: "", email: "", password: "",
    locality: "Bengaluru", goals: [], guardian_email: "",
  });
  const [otp, setOtp] = useState("");
  const [points, setPoints] = useState(0);
  const [revealedScore, setRevealedScore] = useState(null);
  const [err, setErr] = useState("");
  const [otpLoading, setOtpLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [registeredEmail, setRegisteredEmail] = useState("");
  const [agreed, setAgreed] = useState(false);

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  const next = () => setStep((s) => s + 1);
  const back = () => setStep((s) => Math.max(0, s - 1));

  const toggleGoal = (g) => {
    setData((d) => {
      const has = d.goals.includes(g);
      const next = has ? d.goals.filter((x) => x !== g) : [...d.goals, g];
      setPoints(next.length * 5);
      return { ...d, goals: next };
    });
  };

  // Step 1 → 2: Register account + send OTP
  const submitAccount = async () => {
    setErr("");
    try {
      await register({
        email: data.email, password: data.password,
        name: data.name, role: data.role, locality: data.locality,
        accept_terms: agreed,
      });
      setRegisteredEmail(data.email);
      setPoints((p) => p + 10);
      setResendCooldown(60);
      setOtp("");
      next();
    } catch (e) {
      const detail = e.response?.data?.detail;
      if (e.response?.status === 429) setErr("Too many attempts. Please wait a minute and try again.");
      else if (Array.isArray(detail)) setErr("Please check your details: name, a valid email, and a password of at least 8 characters.");
      else setErr(detail || "Registration failed. Please try again.");
    }
  };

  // Step 2: Verify OTP
  const submitOtp = async () => {
    if (otp.length < 6) { setErr("Please enter the full 6-digit code"); return; }
    setErr("");
    setOtpLoading(true);
    try {
      await verifyOtp(registeredEmail, otp);
      setPoints((p) => p + 15);
      next();
    } catch (e) {
      setErr(e.response?.data?.detail || "Incorrect code — please try again");
    } finally {
      setOtpLoading(false);
    }
  };

  // Resend OTP
  const handleResend = async () => {
    if (resendCooldown > 0) return;
    setErr("");
    try {
      await sendOtp(registeredEmail);
      setOtp("");
      setResendCooldown(60);
    } catch (e) {
      setErr(e.response?.data?.detail || "Failed to resend code");
    }
  };

  const finishOnboarding = async () => {
    try {
      const r = await api.post("/onboarding/complete", {
        goals: data.goals,
        guardian_email: data.role === "guardian" ? null : (data.guardian_email.trim() || null),
      });
      setRevealedScore(r.data.score);
      setPoints(r.data.points);
      await refresh();
      next();
    } catch (e) { setErr("Could not save. Try again."); }
  };

  const celebrate = () => {
    confetti({ particleCount: 120, spread: 80, origin: { y: 0.4 }, colors: ["#C8F04B", "#B8A8E8", "#F2A68A", "#8BBF7A"] });
    onClose?.();
    nav("/dashboard");
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4" data-testid="onboarding-modal">
      <motion.div initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
        className="w-full max-w-2xl bg-[#0F0F0F] border border-[#C8F04B]/20 rounded-sm overflow-hidden">

        {/* Progress bar */}
        <div className="h-0.5 bg-[#1A1A1A]">
          <motion.div className="h-full bg-[#C8F04B]"
            animate={{ width: `${((step + 1) / 6) * 100}%` }}
            transition={{ duration: 0.4, ease: "easeOut" }} />
        </div>

        <div className="p-6 border-b border-white/5 flex items-center justify-between">
          <p className="label-mono text-[#C8F04B]">Step {step + 1} of 6</p>
          <p className="label-mono text-[#C8F04B]">+{points} pts earned</p>
        </div>

        <div className="p-8 md:p-12 min-h-[400px]">
          <AnimatePresence mode="wait">
            <motion.div key={step} initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -20, opacity: 0 }}>

              {/* Step 0 — Role */}
              {step === 0 && (
                <>
                  <h2 className="font-display text-5xl md:text-6xl mb-2">WHO ARE YOU?</h2>
                  <p className="label-mono text-[#A0A0A0] mb-4">Pick the one that feels closest</p>
                  <p className="text-sm text-[#F5F1E8] bg-[#1A1A1A] border border-[#333] rounded-sm p-3 mb-6" data-testid="onboarding-disclaimer">
                    {DISCLAIMER} For mental-health support call Tele-MANAS on 14416 (free, 24x7).
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3" data-testid="onboarding-role-select">
                    {ROLES.map((r) => (
                      <button key={r.id} onClick={() => setData({ ...data, role: r.id })}
                        data-testid={`onboarding-role-${r.id}`}
                        className={`text-left p-5 border rounded-sm transition ${data.role === r.id ? "border-white" : "border-[#222] hover:border-[#444]"}`}
                        style={data.role === r.id ? { background: r.color, color: "#080808" } : {}}>
                        <p className="font-display text-2xl">{r.label}</p>
                        <p className="text-sm mt-1 opacity-80">{r.desc}</p>
                      </button>
                    ))}
                  </div>
                </>
              )}

              {/* Step 1 — Create Account */}
              {step === 1 && (
                <>
                  <h2 className="font-display text-5xl mb-2">CREATE ACCOUNT</h2>
                  <p className="label-mono text-[#A0A0A0] mb-8">A verification code will be sent to your email</p>
                  <div className="space-y-3">
                    <input className="w-full bg-transparent border border-[#333] rounded-sm px-4 py-3 focus:border-[#C8F04B] outline-none transition"
                      placeholder="Your name" value={data.name} onChange={(e) => setData({ ...data, name: e.target.value })} data-testid="onboarding-name" />
                    <input className="w-full bg-transparent border border-[#333] rounded-sm px-4 py-3 focus:border-[#C8F04B] outline-none transition"
                      placeholder="email@you.com" type="email" value={data.email} onChange={(e) => setData({ ...data, email: e.target.value })} data-testid="onboarding-email" />
                    <input className="w-full bg-transparent border border-[#333] rounded-sm px-4 py-3 focus:border-[#C8F04B] outline-none transition"
                      placeholder="Password (min 8 characters)" type="password" value={data.password} onChange={(e) => setData({ ...data, password: e.target.value })} data-testid="onboarding-password" />
                    <input className="w-full bg-transparent border border-[#333] rounded-sm px-4 py-3 focus:border-[#C8F04B] outline-none transition"
                      placeholder="Locality (e.g. Indiranagar)" value={data.locality} onChange={(e) => setData({ ...data, locality: e.target.value })} />
                    <label className="flex items-start gap-3 text-sm text-[#D0D0D0] pt-2" data-testid="onboarding-consent">
                      <input type="checkbox" className="mt-1" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
                      <span>
                        I am 18 or older and I agree to the{" "}
                        <Link to="/privacy" target="_blank" className="underline text-white">privacy policy</Link> and{" "}
                        <Link to="/terms" target="_blank" className="underline text-white">terms</Link>. I understand my
                        messages to Mitra are processed by Google Gemini.
                      </span>
                    </label>
                  </div>
                  {err && <p className="text-[#F2A68A] mt-3 label-mono">{err}</p>}
                </>
              )}

              {/* Step 2 — Verify Email (REAL OTP) */}
              {step === 2 && (
                <>
                  <h2 className="font-display text-5xl mb-2">CHECK YOUR INBOX</h2>
                  <p className="label-mono text-[#A0A0A0] mb-2">
                    We sent a 6-digit code to
                  </p>
                  <p className="text-[#C8F04B] font-mono mb-8 truncate">{registeredEmail}</p>

                  <OtpInput value={otp} onChange={setOtp} disabled={otpLoading} />

                  {err && (
                    <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
                      className="text-[#F2A68A] mt-4 label-mono text-center">{err}</motion.p>
                  )}

                  <div className="mt-6 flex flex-col items-center gap-2">
                    <button
                      onClick={handleResend}
                      disabled={resendCooldown > 0}
                      className={`label-mono text-sm transition ${resendCooldown > 0 ? "text-[#444]" : "text-[#A0A0A0] hover:text-[#C8F04B]"}`}>
                      {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Didn't get it? Resend code"}
                    </button>
                    <p className="text-xs text-[#555]">Code expires in 10 minutes · Check spam folder</p>
                  </div>
                </>
              )}

              {/* Step 3 — Goals */}
              {step === 3 && (
                <>
                  <h2 className="font-display text-5xl mb-2">YOUR GOALS</h2>
                  <p className="label-mono text-[#A0A0A0] mb-8">+5 pts each — pick at least 3</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {(GOALS_BY_ROLE[data.role] || []).map((g) => (
                      <button key={g} onClick={() => toggleGoal(g)} data-testid={`onboarding-goal-${g.replace(/\s+/g, '-').toLowerCase()}`}
                        className={`p-4 border rounded-sm text-left transition ${data.goals.includes(g) ? "bg-[#C8F04B] text-black border-[#C8F04B]" : "border-[#222] hover:border-[#444]"}`}>
                        <span className="font-sans">{g}</span>
                        {data.goals.includes(g) && <span className="float-right label-mono">+5</span>}
                      </button>
                    ))}
                  </div>
                </>
              )}

              {/* Step 4 — Guardian */}
              {step === 4 && (
                <>
                  {data.role === "guardian" ? (
                    <>
                      <h2 className="font-display text-5xl mb-2">LINKING WITH FAMILY</h2>
                      <p className="text-[#D0D0D0] mt-4">
                        To look after someone, ask them to invite you from <strong>Settings</strong> in their Solace app,
                        using this email address. You'll see the invitation in your Settings to accept.
                      </p>
                      <p className="text-sm text-[#A0A0A0] mt-4">
                        You'll see a wellbeing summary only. Their journal and chats always stay private.
                      </p>
                    </>
                  ) : (
                    <>
                      <h2 className="font-display text-5xl mb-2">INVITE A GUARDIAN</h2>
                      <p className="label-mono text-[#A0A0A0] mb-6">Optional · a family member or friend who looks out for you</p>
                      <input className="w-full bg-transparent border border-[#333] rounded-sm px-4 py-3 focus:border-[#F2A68A] outline-none transition"
                        placeholder="guardian@email.com" value={data.guardian_email} onChange={(e) => setData({ ...data, guardian_email: e.target.value })} />
                      <p className="text-sm text-[#A0A0A0] mt-4">
                        They'll get an email and must accept first. They'll see a short wellbeing summary only,
                        never your journal or chats with Mitra. You can stop sharing any time in Settings, or skip this now.
                      </p>
                    </>
                  )}
                </>
              )}

              {/* Step 5 — Score Reveal */}
              {step === 5 && (
                <>
                  <h2 className="font-display text-5xl mb-2">YOUR SOCIAL HEALTH SCORE</h2>
                  <p className="label-mono text-[#A0A0A0] mb-8">Mitra calculated this from your goals & role</p>
                  <div className="flex flex-col items-center" data-testid="onboarding-score-reveal">
                    <motion.p initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring" }}
                      className="font-mono text-9xl text-[#C8F04B] tabular-nums">{revealedScore || "—"}</motion.p>
                    <p className="label-mono text-[#8BBF7A]">GREEN · THRIVING</p>
                    <div className="mt-8 grid grid-cols-3 gap-4 w-full max-w-md text-center">
                      <div><p className="font-mono text-2xl text-[#C8F04B]">{points}</p><p className="label-mono text-[#A0A0A0]">Points</p></div>
                      <div><p className="font-mono text-2xl text-[#C8F04B]">1</p><p className="label-mono text-[#A0A0A0]">Streak</p></div>
                      <div><p className="font-mono text-2xl text-[#C8F04B]">{data.goals.length}</p><p className="label-mono text-[#A0A0A0]">Goals</p></div>
                    </div>
                  </div>
                </>
              )}

            </motion.div>
          </AnimatePresence>
        </div>

        <div className="p-6 border-t border-white/5 flex justify-between items-center">
          <button onClick={back} disabled={step === 0 || step === 2} className="label-mono text-[#A0A0A0] disabled:opacity-30 hover:text-white transition">
            ← Back
          </button>
          {step === 1 ? (
            <button onClick={submitAccount} disabled={!data.email || data.password.length < 8 || !data.name || !agreed}
              className="bg-[#C8F04B] text-black px-6 py-2 label-mono disabled:opacity-30 hover:bg-white transition">
              Send Code →
            </button>
          ) : step === 2 ? (
            <button onClick={submitOtp} disabled={otp.length < 6 || otpLoading}
              className="bg-[#C8F04B] text-black px-6 py-2 label-mono disabled:opacity-30 hover:bg-white transition flex items-center gap-2">
              {otpLoading ? (
                <><span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin inline-block" /> Verifying…</>
              ) : "Verify →"}
            </button>
          ) : step === 4 ? (
            <button onClick={finishOnboarding} className="bg-[#C8F04B] text-black px-6 py-2 label-mono hover:bg-white transition">
              Reveal score →
            </button>
          ) : step === 5 ? (
            <button onClick={celebrate} data-testid="onboarding-finish"
              className="bg-[#C8F04B] text-black px-6 py-2 label-mono hover:bg-white transition">
              Enter Solace ✨
            </button>
          ) : (
            <button onClick={next} className="bg-[#C8F04B] text-black px-6 py-2 label-mono hover:bg-white transition">
              Next →
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
}
