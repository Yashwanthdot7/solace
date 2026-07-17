import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import MarqueeStrip from "@/components/MarqueeStrip";
import Onboarding from "@/components/Onboarding";
import { useAuth } from "@/contexts/AuthContext";
import MitraOrb from "@/components/MitraOrb";
import LaggingCursor from "@/components/Cursor";
import LoadingScreen from "@/components/LoadingScreen";
import HeroCarousel from "@/components/HeroCarousel";

// ── Login Modal ──────────────────────────────────────────────────────────────
function LoginModal({ onClose, onOpenRegister }) {
  const { login, sendOtp, forgotPassword } = useAuth();
  const [mode, setMode] = useState("login"); // "login" | "forgot" | "forgot-sent" | "unverified"
  const [creds, setCreds] = useState({ email: "", password: "" });
  const [forgotEmail, setForgotEmail] = useState("");
  const [unverifiedEmail, setUnverifiedEmail] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  const doLogin = async (e) => {
    e.preventDefault();
    setErr("");
    setLoading(true);
    try {
      await login(creds.email, creds.password);
      window.location.href = "/dashboard";
    } catch (e) {
      const detail = e.response?.data?.detail || "";
      if (detail === "EMAIL_NOT_VERIFIED") {
        setUnverifiedEmail(creds.email);
        setMode("unverified");
      } else {
        setErr("Invalid email or password");
      }
    } finally {
      setLoading(false);
    }
  };

  const doForgot = async (e) => {
    e.preventDefault();
    setErr("");
    setLoading(true);
    try {
      await forgotPassword(forgotEmail);
      setMode("forgot-sent");
    } catch (e) {
      setErr(e.response?.data?.detail || "Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (resendCooldown > 0) return;
    setErr("");
    try {
      await sendOtp(unverifiedEmail);
      setResendCooldown(60);
    } catch (e) {
      setErr(e.response?.data?.detail || "Failed to resend code");
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur flex items-center justify-center p-4" onClick={onClose}>
      <motion.div initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md bg-[#0F0F0F] border border-[#C8F04B]/20 p-8 rounded-sm relative overflow-hidden">

        {/* Subtle glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-px bg-gradient-to-r from-transparent via-[#C8F04B]/40 to-transparent" />

        <AnimatePresence mode="wait">
          {/* ── Login ── */}
          {mode === "login" && (
            <motion.form key="login" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
              onSubmit={doLogin}>
              <h2 className="font-display text-4xl mb-2">WELCOME BACK</h2>
              <p className="label-mono text-[#A0A0A0] mb-6">Sign in to your SOLACE account</p>

              <input
                className="w-full bg-transparent border border-[#333] rounded-sm px-4 py-3 mb-3 outline-none focus:border-[#C8F04B] transition"
                placeholder="Email address" type="email"
                value={creds.email} onChange={(e) => setCreds({ ...creds, email: e.target.value })}
                data-testid="login-email" />
              <input
                className="w-full bg-transparent border border-[#333] rounded-sm px-4 py-3 mb-2 outline-none focus:border-[#C8F04B] transition"
                placeholder="Password" type="password"
                value={creds.password} onChange={(e) => setCreds({ ...creds, password: e.target.value })}
                data-testid="login-password" />

              <button type="button" onClick={() => { setForgotEmail(creds.email); setMode("forgot"); setErr(""); }}
                className="label-mono text-[#A0A0A0] hover:text-[#C8F04B] text-xs mb-4 block transition">
                Forgot password?
              </button>

              {err && (
                <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
                  className="text-[#F2A68A] mb-3 label-mono text-sm">{err}</motion.p>
              )}

              <button type="submit" data-testid="login-submit" disabled={loading}
                className="w-full bg-[#C8F04B] text-black py-3 label-mono hover:bg-white transition disabled:opacity-60 flex items-center justify-center gap-2">
                {loading ? <><span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" /> Signing in…</> : "SIGN IN →"}
              </button>

              <p className="text-center mt-4 text-[#A0A0A0] text-sm">
                New here?{" "}
                <button type="button" onClick={() => { onClose(); onOpenRegister(); }}
                  className="text-[#C8F04B] hover:underline label-mono">Create account</button>
              </p>
            </motion.form>
          )}

          {/* ── Unverified Email ── */}
          {mode === "unverified" && (
            <motion.div key="unverified" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              <div className="w-12 h-12 rounded-full bg-[#F2A68A]/10 border border-[#F2A68A]/30 flex items-center justify-center mb-4">
                <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="#F2A68A" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <h2 className="font-display text-3xl mb-2">VERIFY YOUR EMAIL</h2>
              <p className="label-mono text-[#A0A0A0] mb-2">Your account is not yet verified.</p>
              <p className="text-[#C8F04B] font-mono text-sm mb-6 truncate">{unverifiedEmail}</p>
              <p className="text-[#A0A0A0] text-sm mb-6">
                We sent you a 6-digit code when you registered. Please complete the verification to continue.
              </p>

              {err && <p className="text-[#F2A68A] mb-3 label-mono text-sm">{err}</p>}

              <button onClick={handleResendOtp} disabled={resendCooldown > 0}
                className="w-full bg-[#C8F04B] text-black py-3 label-mono hover:bg-white transition disabled:opacity-60 mb-3">
                {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "RESEND VERIFICATION CODE"}
              </button>
              <button onClick={() => { onClose(); onOpenRegister(); }}
                className="w-full border border-[#333] py-3 label-mono text-[#A0A0A0] hover:border-white hover:text-white transition text-sm">
                Re-register with new details
              </button>
              <button onClick={() => setMode("login")}
                className="w-full mt-2 text-[#555] hover:text-[#A0A0A0] label-mono text-xs transition">
                ← Back to login
              </button>
            </motion.div>
          )}

          {/* ── Forgot Password ── */}
          {mode === "forgot" && (
            <motion.form key="forgot" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
              onSubmit={doForgot}>
              <button type="button" onClick={() => { setMode("login"); setErr(""); }}
                className="label-mono text-[#A0A0A0] hover:text-white text-xs mb-6 flex items-center gap-1 transition">
                ← Back
              </button>
              <h2 className="font-display text-4xl mb-2">RESET PASSWORD</h2>
              <p className="label-mono text-[#A0A0A0] mb-6">Enter your email — we'll send a reset link</p>

              <input
                className="w-full bg-transparent border border-[#333] rounded-sm px-4 py-3 mb-4 outline-none focus:border-[#C8F04B] transition"
                placeholder="Email address" type="email"
                value={forgotEmail} onChange={(e) => setForgotEmail(e.target.value)} />

              {err && <p className="text-[#F2A68A] mb-3 label-mono text-sm">{err}</p>}

              <button type="submit" disabled={!forgotEmail || loading}
                className="w-full bg-[#C8F04B] text-black py-3 label-mono hover:bg-white transition disabled:opacity-60 flex items-center justify-center gap-2">
                {loading ? <><span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" /> Sending…</> : "SEND RESET LINK →"}
              </button>
            </motion.form>
          )}

          {/* ── Reset link sent ── */}
          {mode === "forgot-sent" && (
            <motion.div key="forgot-sent" initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}>
              <div className="w-12 h-12 rounded-full bg-[#C8F04B]/10 border border-[#C8F04B]/30 flex items-center justify-center mb-4">
                <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="#C8F04B" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="font-display text-4xl mb-2">CHECK YOUR INBOX</h2>
              <p className="text-[#A0A0A0] mb-2">A reset link has been sent to</p>
              <p className="text-[#C8F04B] font-mono text-sm mb-6 truncate">{forgotEmail}</p>
              <p className="text-sm text-[#666] mb-6">The link expires in 30 minutes. Check your spam folder if you don't see it.</p>
              <button onClick={() => setMode("login")}
                className="w-full border border-[#333] py-3 label-mono text-[#A0A0A0] hover:border-white hover:text-white transition">
                ← Back to login
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}

// ── Landing Page ─────────────────────────────────────────────────────────────
export default function Landing() {
  const [showOnboard, setShowOnboard] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [booted, setBooted] = useState(false);

  useEffect(() => {
    const seen = sessionStorage.getItem("solace_booted");
    if (seen) setBooted(true);
  }, []);

  const onBoot = () => {
    sessionStorage.setItem("solace_booted", "1");
    setBooted(true);
  };

  return (
    <div className="min-h-screen bg-[#080808] text-white overflow-hidden">
      {!booted && <LoadingScreen onDone={onBoot} />}

      <header className="fixed top-0 inset-x-0 z-30 px-6 md:px-12 py-6 flex justify-between items-center bg-[#080808]/40 backdrop-blur-md">
        <motion.span initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          className="font-display text-3xl">SOLACE<span className="text-[#C8F04B]">.</span></motion.span>
        <motion.button initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}
          onClick={() => setShowLogin(true)} data-testid="header-login-btn" className="label-mono text-[#A0A0A0] hover:text-white transition">Login</motion.button>
      </header>

      <HeroCarousel onLaunch={(mode) => mode === "login" ? setShowLogin(true) : setShowOnboard(true)} />

      <MarqueeStrip color="lime" text="YOU ARE NOT ALONE * COMMUNITY FIRST * BENGALURU CARES" />

      <section className="px-6 md:px-12 py-24 md:py-32 max-w-7xl mx-auto">
        <motion.p initial={{ opacity: 0, x: -20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}
          className="label-mono text-[#A0A0A0]">/ what solace does</motion.p>
        <motion.h2 initial={{ y: 50, opacity: 0 }} whileInView={{ y: 0, opacity: 1 }} viewport={{ once: true }} transition={{ duration: 0.6 }}
          className="font-display text-5xl md:text-7xl mt-3 mb-12 leading-none">ELEVEN WAYS<br/>TO FEEL LESS ALONE.</motion.h2>
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          <Feature span="md:col-span-7" title="Social Health Score" body="A 0-100 number that tracks how connected you really are. Green, amber, red — and an invisible hand that nudges you exactly when you need it." color="#C8F04B"/>
          <Feature span="md:col-span-5" title="Mitra AI Voice" body="A warm Bengaluru voice in your pocket. Four moods. Speaks. Listens." color="#B8A8E8"/>
          <Feature span="md:col-span-5" title="Guardian Monitor" body="AI watches tone. Alerts family before silence becomes pain." color="#F2A68A"/>
          <Feature span="md:col-span-7" title="Neighbourhood Feed" body="Recipes, gully cricket, harmonium milestones. A local Instagram where elders and youth share equally." color="#8BBF7A"/>
          <Feature span="md:col-span-4" title="6 Connection Games" body="Bingo Saturday. Trivia Thursday. Daily riddles shared across the city." color="#E8854A"/>
          <Feature span="md:col-span-4" title="Mindfulness" body="Box breathing. Guided prayer. Three ambient sounds." color="#B8A8E8"/>
          <Feature span="md:col-span-4" title="Joy Challenge" body="One small human dare. Every day. 847 doing it with you today." color="#C8F04B"/>
        </div>
      </section>

      <MarqueeStrip color="lavender" text="✦ MITRA IS LISTENING ✦ YOU ARE SEEN ✦" speed={30} />

      <section className="px-6 md:px-12 py-24 max-w-7xl mx-auto">
        <div className="grid md:grid-cols-12 gap-10 items-start">
          {/* LEFT — Ready CTA */}
          <div className="md:col-span-6">
            <motion.p initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }}
              className="label-mono text-[#C8F04B] mb-4">/ final call</motion.p>
            <motion.h3 initial={{ y: 30, opacity: 0 }} whileInView={{ y: 0, opacity: 1 }} viewport={{ once: true }}
              className="font-display text-6xl md:text-8xl leading-[0.85]">
              READY TO<br/>FEEL<br/><span className="text-[#C8F04B]">SEEN?</span>
            </motion.h3>
            <p className="mt-6 max-w-md text-[#A0A0A0] text-lg">Join 14,302 neighbours already building real connection in Bengaluru. Free forever for elders. Always.</p>
            <motion.button initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }}
              onClick={() => setShowOnboard(true)}
              className="mt-8 group relative overflow-hidden bg-[#C8F04B] text-black px-10 py-5 font-display text-3xl tracking-wide">
              <span className="relative z-10">JOIN FREE →</span>
              <span className="absolute inset-0 bg-white scale-x-0 group-hover:scale-x-100 origin-left transition-transform duration-500"/>
            </motion.button>
            <div className="mt-8 flex items-center gap-4">
              <div className="flex -space-x-3">
                {["https://images.unsplash.com/photo-1556228720-195a672e8a03?w=120&q=70",
                  "https://images.unsplash.com/photo-1581579188871-45ea61f2a0c8?w=120&q=70",
                  "https://images.unsplash.com/photo-1581579438747-104c53e7c2c4?w=120&q=70",
                  "https://images.unsplash.com/photo-1559963110-71b394e7494d?w=120&q=70"].map((a, i) => (
                  <img key={i} src={a} alt="" className="w-10 h-10 rounded-full border-2 border-[#080808] object-cover"/>
                ))}
              </div>
              <p className="label-mono text-[#A0A0A0]">+ 14,298 others this week</p>
            </div>
          </div>

          {/* RIGHT — Stats + Quote + Newsletter */}
          <div className="md:col-span-6 space-y-5">
            <motion.div initial={{ x: 30, opacity: 0 }} whileInView={{ x: 0, opacity: 1 }} viewport={{ once: true }}
              className="grid grid-cols-2 gap-4">
              {[
                { n: "14,302", l: "neighbours", c: "#C8F04B" },
                { n: "847", l: "today's joy challenge", c: "#B8A8E8" },
                { n: "92%", l: "feel less alone", c: "#8BBF7A" },
                { n: "24/7", l: "Mitra is awake", c: "#F2A68A" },
              ].map((s) => (
                <div key={s.l} className="p-5 border border-[#1A1A1A] hover:border-white/30 rounded-sm transition">
                  <p className="font-mono text-4xl tabular-nums" style={{ color: s.c }}>{s.n}</p>
                  <p className="label-mono text-[#A0A0A0] mt-1">{s.l}</p>
                </div>
              ))}
            </motion.div>

            <motion.div initial={{ x: 30, opacity: 0 }} whileInView={{ x: 0, opacity: 1 }} viewport={{ once: true }} transition={{ delay: 0.1 }}
              className="p-6 border border-[#B8A8E8]/30 rounded-sm relative overflow-hidden"
              style={{ background: "linear-gradient(135deg, rgba(184,168,232,0.08), transparent)" }}>
              <p className="font-display text-6xl text-[#B8A8E8] leading-none">"</p>
              <p className="text-lg leading-relaxed -mt-4">After my husband passed, I went days without speaking. Mitra checks in every morning. The Bingo Saturdays got me out of the house. I'm 73 and I have friends again.</p>
              <div className="mt-4 flex items-center gap-3">
                <img src="https://images.unsplash.com/photo-1581579188871-45ea61f2a0c8?w=120&q=70" alt="" className="w-12 h-12 rounded-full object-cover"/>
                <div>
                  <p className="font-sans">Lakshmi Devi</p>
                  <p className="label-mono text-[#A0A0A0]">Jayanagar · Elder · Member since Jan</p>
                </div>
              </div>
            </motion.div>

            <motion.div initial={{ x: 30, opacity: 0 }} whileInView={{ x: 0, opacity: 1 }} viewport={{ once: true }} transition={{ delay: 0.2 }}
              className="p-5 border border-[#1A1A1A] rounded-sm">
              <p className="label-mono text-[#C8F04B] mb-3">/ weekly letter from Mitra</p>
              <form onClick={(e) => e.preventDefault()} className="flex gap-2">
                <input placeholder="your.email@neighbourhood.in"
                  className="flex-1 bg-transparent border border-[#222] rounded-sm px-3 py-2 outline-none focus:border-[#C8F04B] text-sm" />
                <button type="submit" className="bg-[#C8F04B] text-black px-4 label-mono">SUBSCRIBE</button>
              </form>
              <p className="text-xs text-[#666] mt-2">A short note every Sunday. No spam, ever.</p>
            </motion.div>
          </div>
        </div>

        {/* Footer strip */}
        <div className="mt-20 pt-8 border-t border-[#1A1A1A] grid md:grid-cols-4 gap-6">
          <div>
            <p className="font-display text-3xl">SOLACE<span className="text-[#C8F04B]">.</span></p>
            <p className="label-mono text-[#666] mt-2">© 2026 · Bengaluru</p>
          </div>
          <div>
            <p className="label-mono text-[#A0A0A0] mb-3">/ product</p>
            {["Mitra AI","Health Score","Wellness Studio","Joy Challenge"].map(x =>
              <p key={x} className="text-sm py-1 text-[#A0A0A0] hover:text-white">{x}</p>)}
          </div>
          <div>
            <p className="label-mono text-[#A0A0A0] mb-3">/ for</p>
            {["Elders","Youth","Guardians","Community Organisers"].map(x =>
              <p key={x} className="text-sm py-1 text-[#A0A0A0] hover:text-white">{x}</p>)}
          </div>
          <div>
            <p className="label-mono text-[#A0A0A0] mb-3">/ reach us</p>
            <p className="text-sm py-1 text-[#A0A0A0]">hello@solace.in</p>
            <p className="text-sm py-1 text-[#A0A0A0]">+91 80 4567 8910</p>
            <p className="text-sm py-1 text-[#A0A0A0]">Indiranagar, Bengaluru</p>
          </div>
        </div>
      </section>

      {showOnboard && <Onboarding onClose={() => setShowOnboard(false)} />}
      {showLogin && (
        <LoginModal
          onClose={() => setShowLogin(false)}
          onOpenRegister={() => setShowOnboard(true)}
        />
      )}

      <MitraOrb />
      <LaggingCursor />
    </div>
  );
}

const Feature = ({ span, title, body, color }) => (
  <motion.div initial={{ y: 50, opacity: 0 }} whileInView={{ y: 0, opacity: 1 }} viewport={{ once: true, margin: "-50px" }} transition={{ duration: 0.6 }}
    whileHover={{ y: -8 }}
    className={`${span} p-8 border border-[#1A1A1A] hover:border-white/30 transition-colors rounded-sm group`}>
    <p className="label-mono mb-4" style={{ color }}>/ {title}</p>
    <p className="font-display text-3xl md:text-4xl leading-tight group-hover:text-white transition">{title.toUpperCase()}</p>
    <p className="mt-4 text-[#A0A0A0]">{body}</p>
  </motion.div>
);
