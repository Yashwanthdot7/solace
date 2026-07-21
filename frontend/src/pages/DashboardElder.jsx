import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import ScoreGauge from "@/components/ScoreGauge";
import confetti from "canvas-confetti";
import { Link } from "react-router-dom";

const ACCENT = "#F2A68A";

// Days until next Saturday bingo
function daysUntilSaturday() {
  const d = new Date().getDay();
  return d === 6 ? 7 : (6 - d);
}

export default function DashboardElder() {
  const { user, refresh } = useAuth();
  const [score, setScore]   = useState(null);
  const [joy, setJoy]       = useState(null);
  const [greeted, setGreeted] = useState(false);
  const [greetText, setGreetText] = useState("");
  const [intergenerational, setIntergenerational] = useState(null);

  const firstName = user?.name?.split(" ")[0] || "Friend";

  useEffect(() => {
    api.get("/score").then(r => setScore(r.data)).catch(() => {});
    api.get("/joy/today").then(r => setJoy(r.data)).catch(() => {});

    // Morning greeting — speak once per session
    const seen = sessionStorage.getItem("solace_greeted");
    if (!seen) {
      api.get("/greeting").then(r => {
        sessionStorage.setItem("solace_greeted", "1");
        setGreeted(true);
        setGreetText(r.data.text || `Good morning, ${firstName}. I'm glad you're here today.`);
        if (!window.speechSynthesis) return;
        const utter = new SpeechSynthesisUtterance(r.data.text);
        utter.rate = 0.87; utter.pitch = 1.02;  // warm, slower for elders
        const voices = window.speechSynthesis.getVoices();
        const pick = voices.find(v => v.lang === "en-IN" && /female|woman|girl/i.test(v.name))
                  || voices.find(v => v.lang === "en-IN")
                  || voices.find(v => v.lang?.startsWith("en"));
        if (pick) utter.voice = pick;
        const speak = () => window.speechSynthesis.speak(utter);
        voices.length === 0 ? (window.speechSynthesis.onvoiceschanged = speak) : speak();
      }).catch(() => { setGreeted(true); });
    } else {
      setGreeted(true);
      setGreetText(`Welcome back, ${firstName}. Mitra is here whenever you need to talk.`);
    }

    // Simulated intergenerational offer (would come from real linking in prod)
    setIntergenerational({ youth: "Priya", offer: "help you explore WhatsApp video calls" });
  }, []);

  const completeJoy = async () => {
    await api.post("/joy/complete");
    confetti({ particleCount: 200, spread: 90, colors: ["#F2A68A","#C8F04B","#B8A8E8","#8BBF7A"] });
    setJoy({ ...joy, completed: true });
    await refresh();
  };

  const bingoDays = daysUntilSaturday();

  return (
    <div className="px-6 md:px-12 py-12 max-w-7xl mx-auto">
      {/* Role Header */}
      <div className="mb-10">
        <div className="flex items-center gap-3 mb-2 flex-wrap">
          <span className="label-mono text-xs px-2 py-1 rounded-full border"
            style={{ color: ACCENT, borderColor: ACCENT + "40", background: ACCENT + "10" }}>
            ELDER · COMMUNITY
          </span>
          {greeted && (
            <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="label-mono text-xs text-[#B8A8E8]">
              · Mitra greeted you 🎙
            </motion.span>
          )}
          {score?.data_source === "computed" && (
            <span className="label-mono text-xs text-[#8BBF7A]">· Score from your real activity ✓</span>
          )}
        </div>
        <h1 className="font-display text-6xl md:text-8xl leading-none mt-2">
          GOOD TO SEE<br/>
          <span style={{ color: ACCENT }}>YOU, {firstName.toUpperCase()}.</span>
        </h1>
      </div>

      {/* Mitra Morning Greeting Banner */}
      <AnimatePresence>
        {greetText && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="mb-6 p-6 border rounded-sm relative overflow-hidden"
            style={{ borderColor: "#B8A8E8" + "40", background: "linear-gradient(90deg, rgba(184,168,232,0.08), transparent)" }}>
            <div className="flex items-start gap-4">
              <motion.div animate={{ scale: [1, 1.08, 1] }} transition={{ duration: 2.5, repeat: Infinity }}
                className="w-10 h-10 rounded-full mitra-orb shrink-0 mt-0.5" />
              <div>
                <p className="label-mono text-[#B8A8E8] text-xs mb-1">/ mitra says · this morning</p>
                <p className="text-lg md:text-xl leading-relaxed text-white">
                  "{greetText}"
                </p>
                <p className="label-mono text-[#666] text-xs mt-2">Tap the orb (bottom right) to reply →</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Intervention banner */}
      {score?.intervention && (
        <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
          className="mb-6 p-4 border border-[#B8A8E8]/40 rounded-sm bg-[#B8A8E8]/06 label-mono text-sm text-[#B8A8E8]">
          💛 {score.intervention}
        </motion.div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">

        {/* Score Gauge */}
        <motion.div initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
          className="md:col-span-7 p-8 md:p-12 border rounded-sm flex flex-col md:flex-row gap-8 items-center"
          style={{ borderColor: ACCENT + "30", background: `linear-gradient(135deg, ${ACCENT}08, transparent)` }}>
          <ScoreGauge score={score?.score || 72} band={score?.band || "green"} />
          <div className="flex-1">
            <p className="label-mono mb-2" style={{ color: ACCENT }}>/ your community warmth score</p>
            <h2 className="font-display text-4xl mb-4">
              {(score?.score || 72) >= 70 ? "YOU'RE GLOWING." : (score?.score || 72) >= 45 ? "KEEP SHINING." : "LET'S ADD LIGHT."}
            </h2>
            <div className="space-y-3 mb-4">
              {score && Object.entries(score.pillars).map(([k, v]) => (
                <div key={k}>
                  <div className="flex justify-between label-mono mb-1">
                    <span className="text-[#A0A0A0] capitalize">
                      {k === "community_participation" ? "Attending things together"
                        : k === "social_interaction" ? "Conversations & sharing"
                        : "Emotional wellbeing"}
                    </span>
                    <span style={{ color: ACCENT }}>{v}</span>
                  </div>
                  <div className="h-1 bg-[#1A1A1A] rounded">
                    <motion.div initial={{ width: 0 }} animate={{ width: `${v}%` }} transition={{ duration: 1.2 }}
                      className="h-full rounded" style={{ background: ACCENT }} />
                  </div>
                </div>
              ))}
            </div>
            <div className="pt-3 border-t border-[#1A1A1A]">
              <p className="label-mono text-[#A0A0A0] text-xs mb-1">/ 7-day trend</p>
              <svg width="190" height="44" viewBox="0 0 190 44">
                {score?.history && (() => {
                  const d = score.history; const max = Math.max(...d), min = Math.min(...d), range = max - min || 1;
                  const pts = d.map((v, i) => `${i * 30},${40 - ((v - min) / range) * 35}`).join(" ");
                  return <polyline points={pts} fill="none" stroke={ACCENT} strokeWidth="2" />;
                })()}
              </svg>
            </div>
          </div>
        </motion.div>

        {/* Joy Challenge */}
        <motion.div initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.1 }}
          className="md:col-span-5 p-8 border rounded-sm relative overflow-hidden flex flex-col justify-between"
          style={{ borderColor: "#C8F04B40", background: "linear-gradient(135deg, rgba(200,240,75,0.08), transparent)" }}>
          <div>
            <p className="label-mono text-[#C8F04B] mb-2">/ today's joy challenge · for you</p>
            <p className="font-display text-3xl md:text-4xl leading-tight">{joy?.text || "—"}</p>
            <p className="mt-4 label-mono text-[#A0A0A0]">{joy?.participants || 847} elders doing this today</p>
          </div>
          <button onClick={completeJoy} disabled={joy?.completed}
            className="mt-6 w-full py-3 label-mono font-bold transition rounded-sm"
            style={{ background: joy?.completed ? "#333" : "#C8F04B", color: joy?.completed ? "#666" : "#000" }}>
            {joy?.completed ? "✓ DONE TODAY · +15 PTS" : "MARK DONE +15"}
          </button>
        </motion.div>

        {/* Bingo Social Anchor */}
        <motion.div initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.15 }}
          className="md:col-span-4 p-8 border rounded-sm relative overflow-hidden"
          style={{ borderColor: "#B8A8E8" + "40", background: "linear-gradient(135deg, rgba(184,168,232,0.07), transparent)" }}>
          <p className="label-mono text-[#B8A8E8] mb-2">/ your weekly anchor</p>
          <p className="font-display text-3xl mb-1">SATURDAY<br/>BINGO</p>
          <p className="label-mono text-[#A0A0A0] text-sm mt-2">
            {bingoDays === 0 ? "🎉 It's TODAY at 4 PM!" : `In ${bingoDays} day${bingoDays !== 1 ? "s" : ""} · 4 PM`}
          </p>
          <p className="label-mono text-[#666] text-xs mt-1">Radha is saving you a seat 💜</p>
          <Link to="/events" className="mt-4 inline-block label-mono text-xs px-4 py-2 rounded-sm transition"
            style={{ background: "#B8A8E8", color: "#000" }}>
            RSVP →
          </Link>
        </motion.div>

        {/* Intergenerational Offer */}
        {intergenerational && (
          <motion.div initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2 }}
            className="md:col-span-4 p-8 border border-[#8BBF7A]/30 rounded-sm"
            style={{ background: "linear-gradient(135deg, rgba(139,191,122,0.07), transparent)" }}>
            <p className="label-mono text-[#8BBF7A] mb-2">/ neighbour offer</p>
            <p className="font-display text-2xl mb-2">{intergenerational.youth} (Youth)</p>
            <p className="text-sm text-[#A0A0A0]">offered to {intergenerational.offer}</p>
            <div className="flex gap-2 mt-4">
              <button className="label-mono text-xs px-4 py-2 rounded-sm"
                style={{ background: "#8BBF7A", color: "#000" }}>Accept ✓</button>
              <button className="label-mono text-xs px-4 py-2 rounded-sm border border-[#333] text-[#666] hover:text-white transition">Later</button>
            </div>
          </motion.div>
        )}

        {/* Points & Streak */}
        <motion.div initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2 }}
          className="md:col-span-4 p-8 border border-[#1A1A1A] rounded-sm flex flex-col justify-between">
          <div>
            <p className="label-mono text-[#C8F04B] mb-2">/ points earned</p>
            <p className="font-mono text-6xl text-[#C8F04B]">{user?.points || 0}</p>
            <p className="label-mono text-[#A0A0A0] mt-2">🔥 {user?.streak || 1}-day streak</p>
          </div>
        </motion.div>

        {/* Quick Actions */}
        <motion.div initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.25 }}
          className="md:col-span-12 grid grid-cols-3 gap-4">
          {[
            { to: "/mindfulness", color: "#B8A8E8", label: "/ wellness", title: "YOGA &\nMEDITATION" },
            { to: "/journal", color: "#C8F04B", label: "/ gratitude journal", title: "WRITE\nTODAY" },
            { to: "/games", color: ACCENT, label: "/ large-print friendly", title: "MEMORY\nBINGO RIDDLES" },
          ].map((item, i) => (
            <Link key={i} to={item.to}
              className="p-6 border border-[#1A1A1A] rounded-sm hover:border-white/30 transition group">
              <p className="label-mono text-xs mb-2" style={{ color: item.color }}>{item.label}</p>
              <p className="font-display text-2xl leading-tight whitespace-pre-line group-hover:text-white transition">{item.title}</p>
            </Link>
          ))}
        </motion.div>

        {/* Community Feed + Events row */}
        <motion.div initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.3 }}
          className="md:col-span-6">
          <Link to="/feed" className="block p-8 border border-[#1A1A1A] hover:border-[#8BBF7A] rounded-sm transition group">
            <p className="label-mono text-[#8BBF7A] mb-2">/ neighbourhood feed</p>
            <p className="font-display text-3xl group-hover:text-white transition">RECIPES · STORIES · MOMENTS</p>
            <p className="text-[#A0A0A0] label-mono mt-3 text-xs">Priya posted about her chess lesson with you →</p>
          </Link>
        </motion.div>

        <motion.div initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.35 }}
          className="md:col-span-6">
          <Link to="/events" className="block p-8 border border-[#1A1A1A] hover:border-[#F2A68A] rounded-sm transition group h-full">
            <p className="label-mono mb-2" style={{ color: ACCENT }}>/ elder-friendly near you</p>
            <p className="font-display text-3xl group-hover:text-white transition">COMEDY NIGHT<br/>BINGO SAT 4 PM</p>
            <p className="text-[#A0A0A0] label-mono mt-3 text-xs">Ranga Shankara · Free for 60+ · Seated →</p>
          </Link>
        </motion.div>

        {/* Guardian linked status — subtle */}
        {user?.guardian_email && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}
            className="md:col-span-12 px-6 py-4 border border-[#1A1A1A] rounded-sm flex items-center gap-3">
            <span className="text-lg">💛</span>
            <p className="label-mono text-[#666] text-xs">
              Someone is quietly watching over you — you're never alone on Solace.
            </p>
          </motion.div>
        )}
      </div>
    </div>
  );
}
