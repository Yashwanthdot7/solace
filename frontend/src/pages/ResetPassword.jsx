import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

export default function ResetPassword() {
  const [params] = useSearchParams();
  const nav = useNavigate();
  const { resetPassword } = useAuth();

  const token = params.get("token") || "";
  const [step, setStep] = useState(token ? "form" : "invalid"); // "form" | "loading" | "success" | "error" | "invalid"
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [err, setErr] = useState("");
  const [show, setShow] = useState(false);

  const strength = (() => {
    if (password.length === 0) return 0;
    let s = 0;
    if (password.length >= 8) s++;
    if (password.length >= 10) s++;
    if (/[A-Z]/.test(password)) s++;
    if (/[0-9]/.test(password)) s++;
    if (/[^A-Za-z0-9]/.test(password)) s++;
    return s;
  })();

  const strengthLabel = ["", "Weak", "Fair", "Good", "Strong", "Very strong"][strength];
  const strengthColor = ["", "#F2A68A", "#E8854A", "#C8F04B", "#8BBF7A", "#8BBF7A"][strength];

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErr("");
    if (password.length < 8) { setErr("Password must be at least 8 characters"); return; }
    if (password !== confirm) { setErr("Passwords do not match"); return; }
    setStep("loading");
    try {
      await resetPassword(token, password);
      setStep("success");
    } catch (e) {
      setErr(e.response?.data?.detail || "Reset failed. The link may have expired.");
      setStep("error");
    }
  };

  return (
    <div className="min-h-screen bg-[#080808] text-white flex items-center justify-center p-4">
      {/* Background decoration */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full opacity-5"
          style={{ background: "radial-gradient(circle, #C8F04B, transparent)" }} />
        <div className="absolute bottom-1/4 right-1/4 w-64 h-64 rounded-full opacity-5"
          style={{ background: "radial-gradient(circle, #B8A8E8, transparent)" }} />
      </div>

      <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
        className="w-full max-w-md relative">

        {/* Brand */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}
          className="mb-10 text-center">
          <p className="font-display text-4xl">SOLACE<span className="text-[#C8F04B]">.</span></p>
        </motion.div>

        <div className="bg-[#0F0F0F] border border-[#1A1A1A] rounded-sm p-8 relative overflow-hidden">
          {/* Top accent line */}
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#C8F04B]/50 to-transparent" />

          <AnimatePresence mode="wait">
            {/* ── Invalid / no token ── */}
            {step === "invalid" && (
              <motion.div key="invalid" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-4">
                <div className="w-14 h-14 rounded-full bg-[#F2A68A]/10 border border-[#F2A68A]/30 flex items-center justify-center mx-auto mb-4">
                  <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="#F2A68A" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                  </svg>
                </div>
                <h2 className="font-display text-3xl mb-2">INVALID LINK</h2>
                <p className="text-[#A0A0A0] mb-6">This reset link is missing or malformed. Please request a new one.</p>
                <button onClick={() => nav("/")}
                  className="w-full bg-[#C8F04B] text-black py-3 label-mono hover:bg-white transition">
                  ← Back to Home
                </button>
              </motion.div>
            )}

            {/* ── Reset Form ── */}
            {step === "form" && (
              <motion.form key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                onSubmit={handleSubmit}>
                <h2 className="font-display text-4xl mb-2">SET NEW PASSWORD</h2>
                <p className="label-mono text-[#A0A0A0] mb-6">Choose a strong password for your account</p>

                <div className="relative mb-2">
                  <input
                    className="w-full bg-transparent border border-[#333] rounded-sm px-4 py-3 outline-none focus:border-[#C8F04B] transition pr-12"
                    placeholder="New password" type={show ? "text" : "password"}
                    value={password} onChange={(e) => setPassword(e.target.value)} />
                  <button type="button" onClick={() => setShow(!show)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#555] hover:text-[#A0A0A0] transition">
                    {show ? (
                      <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                        <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/>
                        <line x1="1" y1="1" x2="23" y2="23"/>
                      </svg>
                    ) : (
                      <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                        <circle cx="12" cy="12" r="3"/>
                      </svg>
                    )}
                  </button>
                </div>

                {/* Password strength bar */}
                {password.length > 0 && (
                  <div className="mb-4">
                    <div className="flex gap-1 mb-1">
                      {[1,2,3,4,5].map(i => (
                        <div key={i} className="flex-1 h-1 rounded-full transition-all duration-300"
                          style={{ background: i <= strength ? strengthColor : "#1A1A1A" }} />
                      ))}
                    </div>
                    <p className="label-mono text-xs" style={{ color: strengthColor }}>{strengthLabel}</p>
                  </div>
                )}

                <input
                  className="w-full bg-transparent border border-[#333] rounded-sm px-4 py-3 mb-4 outline-none focus:border-[#C8F04B] transition"
                  placeholder="Confirm password" type={show ? "text" : "password"}
                  value={confirm} onChange={(e) => setConfirm(e.target.value)} />

                {err && (
                  <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
                    className="text-[#F2A68A] mb-3 label-mono text-sm">{err}</motion.p>
                )}

                <button type="submit" disabled={!password || !confirm}
                  className="w-full bg-[#C8F04B] text-black py-3 label-mono hover:bg-white transition disabled:opacity-50">
                  SET PASSWORD →
                </button>
              </motion.form>
            )}

            {/* ── Loading ── */}
            {step === "loading" && (
              <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="text-center py-8">
                <div className="w-12 h-12 border-2 border-[#C8F04B]/20 border-t-[#C8F04B] rounded-full animate-spin mx-auto mb-4" />
                <p className="label-mono text-[#A0A0A0]">Updating password…</p>
              </motion.div>
            )}

            {/* ── Error ── */}
            {step === "error" && (
              <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-4">
                <div className="w-14 h-14 rounded-full bg-[#F2A68A]/10 border border-[#F2A68A]/30 flex items-center justify-center mx-auto mb-4">
                  <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="#F2A68A" strokeWidth="2">
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="15" y1="9" x2="9" y2="15"/>
                    <line x1="9" y1="9" x2="15" y2="15"/>
                  </svg>
                </div>
                <h2 className="font-display text-3xl mb-2">LINK EXPIRED</h2>
                <p className="text-[#A0A0A0] mb-2 text-sm">{err}</p>
                <button onClick={() => nav("/")}
                  className="w-full mt-4 bg-[#C8F04B] text-black py-3 label-mono hover:bg-white transition">
                  Request a New Reset Link
                </button>
              </motion.div>
            )}

            {/* ── Success ── */}
            {step === "success" && (
              <motion.div key="success" initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}
                className="text-center py-4">
                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", delay: 0.1 }}
                  className="w-16 h-16 rounded-full bg-[#C8F04B]/10 border border-[#C8F04B]/40 flex items-center justify-center mx-auto mb-4">
                  <svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="#C8F04B" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </motion.div>
                <h2 className="font-display text-4xl mb-2">PASSWORD UPDATED</h2>
                <p className="text-[#A0A0A0] mb-6">Your password has been reset. You can now sign in.</p>
                <button onClick={() => nav("/")}
                  className="w-full bg-[#C8F04B] text-black py-3 label-mono hover:bg-white transition">
                  SIGN IN →
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <p className="text-center mt-6 text-[#444] text-xs label-mono">
          SOLACE · Building real connection in Bengaluru
        </p>
      </motion.div>
    </div>
  );
}
