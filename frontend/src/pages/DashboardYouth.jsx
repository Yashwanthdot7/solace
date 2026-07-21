import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import ScoreGauge from "@/components/ScoreGauge";
import confetti from "canvas-confetti";
import { Link } from "react-router-dom";

const ACCENT = "#C8F04B";

const INTERGENERATIONAL_REWARDS = [
  { action: "Visit an elder's home", pts: 30, icon: "🏠" },
  { action: "Teach an elder a digital skill", pts: 40, icon: "📱", badge: "Skill Swap" },
  { action: "Reply to an elder's community post", pts: 10, icon: "💬" },
  { action: "Attend a skill swap event together", pts: 25, icon: "🤝" },
];

export default function DashboardYouth() {
  const { user, refresh } = useAuth();
  const [score, setScore]   = useState(null);
  const [joy, setJoy]       = useState(null);
  const [tasks, setTasks]   = useState([]);
  const [events, setEvents] = useState([]);
  const [feed, setFeed]     = useState([]);

  const firstName = user?.name?.split(" ")[0] || "You";
  const hour = new Date().getHours();
  const timeGreet = hour < 12 ? "Morning" : hour < 17 ? "Afternoon" : "Evening";

  useEffect(() => {
    api.get("/score").then(r => setScore(r.data)).catch(() => {});
    api.get("/joy/today").then(r => setJoy(r.data)).catch(() => {});
    api.get("/organiser/tasks").then(r => setTasks(r.data.slice(0, 3))).catch(() => {});
    api.get("/events").then(r => setEvents(r.data.slice(0, 3))).catch(() => {});
    api.get("/feed").then(r => {
      // Prioritise elder posts for intergenerational connection
      const sorted = [...(r.data || [])].sort((a, b) =>
        (a.role === "elder" ? -1 : 0) - (b.role === "elder" ? -1 : 0)
      );
      setFeed(sorted.slice(0, 3));
    }).catch(() => {});
  }, []);

  const completeJoy = async () => {
    await api.post("/joy/complete");
    confetti({
      particleCount: 280, spread: 120,
      colors: ["#C8F04B", "#B8A8E8", "#F2A68A", "#8BBF7A", "#E8854A"],
    });
    setJoy({ ...joy, completed: true });
    await refresh();
  };

  const claimTask = async (id) => {
    await api.post(`/organiser/tasks/${id}/claim`);
    setTasks(tasks.map(t => t.id === id ? { ...t, claims: (t.claims || 0) + 1 } : t));
    await refresh();
  };

  return (
    <div className="px-6 md:px-12 py-12 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-10">
        <div className="flex items-center gap-3 mb-2 flex-wrap">
          <span className="label-mono text-xs px-2 py-1 rounded-full border"
            style={{ color: ACCENT, borderColor: ACCENT + "40", background: ACCENT + "10" }}>
            YOUTH · 18–35
          </span>
          <span className="label-mono text-xs text-[#A0A0A0]">
            🔥 {user?.streak || 1}-day streak · {user?.points || 0} pts
          </span>
        </div>
        <h1 className="font-display text-6xl md:text-8xl leading-none mt-2">
          {timeGreet.toUpperCase()},<br/>
          <span style={{ color: ACCENT }}>{firstName.toUpperCase()}! ⚡</span>
        </h1>
        <p className="label-mono text-[#A0A0A0] mt-3">Your feed, your city, your people.</p>
      </div>

      {/* Hype Mitra quote */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
        className="mb-6 p-6 border rounded-sm relative overflow-hidden"
        style={{ borderColor: ACCENT + "40", background: "linear-gradient(90deg, rgba(200,240,75,0.07), transparent)" }}>
        <div className="flex items-start gap-4">
          <motion.div animate={{ rotate: [0, -5, 5, 0] }} transition={{ duration: 2, repeat: Infinity }}
            className="w-10 h-10 rounded-full mitra-orb shrink-0 mt-0.5" />
          <div>
            <p className="label-mono text-[#C8F04B] text-xs mb-1">/ mitra says</p>
            <p className="text-lg md:text-xl leading-relaxed text-white">
              "Ayyyy {firstName}! You actually showed up 😄 Now spill — how was the day? Filter coffee or chai emergency today?"
            </p>
            <p className="label-mono text-[#666] text-xs mt-2">Tap the orb to reply →</p>
          </div>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">

        {/* HERO: Community Feed — Primary entry point */}
        <motion.div initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
          className="md:col-span-8 p-8 border rounded-sm"
          style={{ borderColor: "#8BBF7A40", background: "linear-gradient(135deg, rgba(139,191,122,0.07), transparent)" }}>
          <p className="label-mono text-[#8BBF7A] mb-2">/ what's happening · your neighbourhood</p>
          <h2 className="font-display text-3xl mb-5">THE FEED ⚡</h2>
          <div className="space-y-3 mb-4">
            {feed.length > 0 ? feed.map((post, i) => (
              <motion.div key={post.id || i} initial={{ x: -10, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: i * 0.07 }}
                className="flex items-start gap-3 p-4 bg-[#0A0A0A] border border-[#1A1A1A] rounded-sm">
                <div className="w-8 h-8 rounded-full bg-[#1A1A1A] flex items-center justify-center text-xs shrink-0">
                  {post.role === "elder" ? "🧓" : post.role === "community" ? "📋" : "⚡"}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="label-mono text-xs text-[#A0A0A0]">{post.author}</span>
                    {post.role === "elder" && (
                      <span className="label-mono text-[10px] px-1.5 py-0.5 rounded-full"
                        style={{ background: "#F2A68A20", color: "#F2A68A" }}>Elder</span>
                    )}
                  </div>
                  <p className="text-sm text-[#CCC] line-clamp-2">{post.text}</p>
                </div>
                <span className="label-mono text-[#444] text-xs shrink-0">{post.hearts || 0} ♥</span>
              </motion.div>
            )) : (
              <p className="label-mono text-[#444] text-sm">Loading neighbourhood feed…</p>
            )}
          </div>
          <Link to="/feed" className="label-mono text-xs px-5 py-2.5 rounded-sm inline-block transition"
            style={{ background: ACCENT, color: "#000" }}>
            SEE FULL FEED →
          </Link>
        </motion.div>

        {/* Joy Challenge + Streak */}
        <motion.div initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.1 }}
          className="md:col-span-4 p-8 border rounded-sm relative overflow-hidden flex flex-col justify-between"
          style={{ borderColor: "#E8854A40", background: "linear-gradient(135deg, rgba(232,133,74,0.08), transparent)" }}>
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="label-mono text-[#E8854A]">/ today's dare</p>
              <span className="label-mono text-xs text-[#E8854A]">🔥 {user?.streak || 1}</span>
            </div>
            <p className="font-display text-3xl leading-tight">{joy?.text || "—"}</p>
            <p className="mt-3 label-mono text-[#A0A0A0] text-xs">
              {joy?.participants || 892} people doing this right now
            </p>
          </div>
          <button onClick={completeJoy} disabled={joy?.completed}
            className="mt-6 w-full py-3 label-mono font-bold transition rounded-sm"
            style={{ background: joy?.completed ? "#1A1A1A" : "#E8854A", color: joy?.completed ? "#555" : "#000" }}>
            {joy?.completed ? "✓ CRUSHED IT · +15 PTS" : "I DID THIS +15"}
          </button>
        </motion.div>

        {/* Intergenerational Rewards Panel */}
        <motion.div initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.15 }}
          className="md:col-span-6 p-8 border border-[#F2A68A]/30 rounded-sm"
          style={{ background: "linear-gradient(135deg, rgba(242,166,138,0.06), transparent)" }}>
          <p className="label-mono text-[#F2A68A] mb-2">/ intergenerational · bonus points</p>
          <h2 className="font-display text-2xl mb-4">CONNECT · EARN · MATTER</h2>
          <div className="space-y-3">
            {INTERGENERATIONAL_REWARDS.map((r, i) => (
              <motion.div key={i} initial={{ x: -8, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: 0.2 + i * 0.07 }}
                className="flex items-center justify-between p-3 bg-[#0A0A0A] border border-[#1A1A1A] rounded-sm">
                <div className="flex items-center gap-3">
                  <span className="text-lg">{r.icon}</span>
                  <div>
                    <p className="text-sm">{r.action}</p>
                    {r.badge && (
                      <span className="label-mono text-[10px] px-1.5 py-0.5 rounded-full"
                        style={{ background: "#F2A68A20", color: "#F2A68A" }}>{r.badge}</span>
                    )}
                  </div>
                </div>
                <span className="label-mono text-xs font-bold shrink-0"
                  style={{ color: ACCENT }}>+{r.pts} pts</span>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Events — Youth filtered */}
        <motion.div initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2 }}
          className="md:col-span-6 p-8 border border-[#1A1A1A] rounded-sm">
          <p className="label-mono text-[#B8A8E8] mb-2">/ events near you · this week</p>
          <h2 className="font-display text-2xl mb-4">WHAT'S ON ⚡</h2>
          <div className="space-y-3">
            {events.filter(e => e.audience !== "elder").slice(0, 3).map((ev, i) => (
              <div key={ev.id || i} className="flex items-center justify-between p-3 bg-[#0A0A0A] border border-[#1A1A1A] rounded-sm">
                <div>
                  <p className="text-sm">{ev.title}</p>
                  <p className="label-mono text-[#666] text-xs mt-0.5">{ev.date} · {ev.venue} · {ev.price}</p>
                </div>
                <Link to="/events" className="label-mono text-xs px-3 py-1.5 rounded-sm shrink-0 ml-3 transition"
                  style={{ background: "#B8A8E820", color: "#B8A8E8" }}>
                  RSVP
                </Link>
              </div>
            ))}
            {events.length === 0 && <p className="label-mono text-[#444] text-sm">Fetching live events…</p>}
          </div>
          <Link to="/events" className="label-mono text-xs text-[#B8A8E8] mt-4 inline-block hover:text-white transition">
            See all events →
          </Link>
        </motion.div>

        {/* Community Tasks */}
        <motion.div initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.25 }}
          className="md:col-span-8 p-8 border border-[#1A1A1A] rounded-sm">
          <p className="label-mono text-[#8BBF7A] mb-2">/ community tasks · quick wins</p>
          <h2 className="font-display text-3xl mb-5">HELP YOUR NEIGHBOURHOOD.</h2>
          <div className="space-y-3">
            {tasks.map(t => (
              <div key={t.id} className="flex items-center justify-between p-4 bg-[#0F0F0F] border border-[#1A1A1A] rounded-sm">
                <div>
                  <p className="text-sm">{t.title}</p>
                  <p className="label-mono text-[#666] text-xs mt-1">for {t.audience} · {t.claims || 0} completed</p>
                </div>
                <button onClick={() => claimTask(t.id)}
                  className="ml-4 px-4 py-2 label-mono text-xs rounded-sm transition shrink-0"
                  style={{ background: "#8BBF7A", color: "#000" }}>
                  +{t.points} pts
                </button>
              </div>
            ))}
            {tasks.length === 0 && <p className="label-mono text-[#444] text-sm">No tasks right now — check back soon.</p>}
          </div>
        </motion.div>

        {/* Score — Secondary (bottom) */}
        <motion.div initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.3 }}
          className="md:col-span-4 p-8 border border-[#1A1A1A] rounded-sm flex flex-col items-center justify-center gap-4">
          <ScoreGauge score={score?.score || 72} band={score?.band || "green"} />
          <div className="text-center">
            <p className="label-mono text-xs mb-1" style={{ color: ACCENT }}>/ social energy score</p>
            <p className="font-mono text-4xl" style={{ color: ACCENT }}>{score?.score || 72}</p>
            <p className="label-mono text-[#666] text-xs mt-1">{user?.streak || 1}-day streak · {user?.points || 0} pts</p>
          </div>
          {/* Guardian offer */}
          {!user?.guardian_email && (
            <div className="w-full p-3 border border-[#333] rounded-sm text-center">
              <p className="label-mono text-[#666] text-xs mb-2">Watching over a parent?</p>
              <Link to="/guardian" className="label-mono text-xs text-[#E8854A] hover:text-white transition">
                Link as their Guardian →
              </Link>
            </div>
          )}
        </motion.div>

        {/* Mindfulness strip */}
        <motion.div initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.35 }}
          className="md:col-span-12">
          <Link to="/mindfulness"
            className="flex items-center justify-between p-8 border border-[#B8A8E8]/30 hover:border-[#B8A8E8] rounded-sm transition group"
            style={{ background: "linear-gradient(90deg, rgba(184,168,232,0.06), transparent)" }}>
            <div>
              <p className="label-mono text-[#B8A8E8] mb-1">/ 5 min reset</p>
              <p className="font-display text-4xl md:text-5xl group-hover:text-white transition">
                BOX BREATHING · MEDITATION · MOVEMENT
              </p>
            </div>
            <span className="text-[#B8A8E8] font-display text-4xl group-hover:translate-x-2 transition-transform">→</span>
          </Link>
        </motion.div>
      </div>
    </div>
  );
}
