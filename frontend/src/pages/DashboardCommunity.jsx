import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Link } from "react-router-dom";
import { TrendingDown, TrendingUp, Users, BarChart3, CheckCircle2 } from "lucide-react";

const ACCENT = "#8BBF7A";

const EVENT_TYPES = [
  { id: "bingo",      label: "Bingo Night",     icon: "🎱" },
  { id: "trivia",     label: "Trivia",          icon: "🧠" },
  { id: "skill_swap", label: "Skill Swap",      icon: "🤝" },
  { id: "cricket",    label: "Cricket",         icon: "🏏" },
  { id: "prayer",     label: "Prayer Session",  icon: "🙏" },
  { id: "general",    label: "Community Meet",  icon: "🌿" },
];

const AUDIENCES = [
  { id: "all",   label: "All ages" },
  { id: "elder", label: "Elders 60+" },
  { id: "youth", label: "Youth 18-35" },
];

export default function DashboardOrganiser() {
  const { user, refresh } = useAuth();
  const [tasks, setTasks]         = useState([]);
  const [active, setActive]       = useState([]);
  const [intelligence, setIntel]  = useState(null);
  const [impact, setImpact]       = useState([]);
  const [score, setScore]         = useState(null);

  // Event creation form
  const [title, setTitle]         = useState("");
  const [eventType, setEventType] = useState("bingo");
  const [dateStr, setDateStr]     = useState("");
  const [venue, setVenue]         = useState("");
  const [price, setPrice]         = useState("Free");
  const [audience, setAudience]   = useState("all");
  const [desc, setDesc]           = useState("");
  const [creating, setCreating]   = useState(false);
  const [created, setCreated]     = useState(null);

  useEffect(() => {
    api.get("/organiser/tasks").then(r => setTasks(r.data)).catch(() => {});
    api.get("/organiser/active").then(r => setActive(r.data)).catch(() => {});
    api.get("/community/intelligence").then(r => setIntel(r.data)).catch(() => {});
    api.get("/organiser/impact").then(r => setImpact(r.data)).catch(() => {});
    api.get("/score").then(r => setScore(r.data)).catch(() => {});
  }, []);

  const createTask = async (e) => {
    e.preventDefault();
    if (!title.trim()) return;
    const r = await api.post("/organiser/tasks", { title, audience: "all", points: 10 });
    setTasks([r.data, ...tasks]);
    setTitle("");
  };

  const createEvent = async (e) => {
    e.preventDefault();
    if (!title.trim() || !dateStr.trim() || !venue.trim()) return;
    setCreating(true);
    try {
      const r = await api.post("/organiser/events", {
        title, event_type: eventType, date_str: dateStr,
        venue, price, audience, description: desc,
      });
      setCreated(r.data);
      await refresh();
      // Reset form
      setTitle(""); setDateStr(""); setVenue(""); setDesc("");
    } catch {}
    setCreating(false);
  };

  const totalClaims = tasks.reduce((s, t) => s + (t.claims || 0), 0);
  const firstName   = user?.name?.split(" ")[0] || "Organiser";

  return (
    <div className="px-6 md:px-12 py-12 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-10">
        <div className="flex items-center gap-3 mb-2 flex-wrap">
          <span className="label-mono text-xs px-2 py-1 rounded-full border"
            style={{ color: ACCENT, borderColor: ACCENT + "40", background: ACCENT + "10" }}>
            COMMUNITY ORGANISER
          </span>
          <span className="label-mono text-xs text-[#A0A0A0]">
            {user?.points || 0} pts · {user?.streak || 1}-day streak
          </span>
        </div>
        <h1 className="font-display text-6xl md:text-8xl leading-none mt-2">
          RALLY<br/>
          <span style={{ color: ACCENT }}>YOUR NEIGHBOURHOOD.</span>
        </h1>
        <p className="label-mono text-[#A0A0A0] mt-3">
          {firstName}, your events bring people together. Here's your command centre.
        </p>
      </div>

      {/* Event created confirmation */}
      <AnimatePresence>
        {created && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="mb-6 p-5 border border-[#8BBF7A]/50 rounded-sm"
            style={{ background: "linear-gradient(90deg, rgba(139,191,122,0.12), transparent)" }}>
            <div className="flex items-center gap-3">
              <CheckCircle2 size={20} className="text-[#8BBF7A] shrink-0" />
              <div>
                <p className="label-mono text-[#8BBF7A] font-bold">Event Created — Posted to Feed ✓</p>
                <p className="text-sm text-[#A0A0A0] mt-0.5">
                  "{created.event_meta?.title}" · Mitra will mention it in conversations this week.
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { n: tasks.length,  l: "tasks issued",      c: ACCENT },
          { n: totalClaims,   l: "total completions", c: "#C8F04B" },
          { n: active.length, l: "active organisers", c: "#B8A8E8" },
          { n: user?.points || 0, l: "your points",   c: "#F2A68A" },
        ].map((s, i) => (
          <motion.div key={i} initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: i * 0.07 }}
            className="p-6 border border-[#1A1A1A] rounded-sm">
            <p className="font-mono text-4xl" style={{ color: s.c }}>{s.n}</p>
            <p className="label-mono text-[#A0A0A0] mt-1 text-xs">{s.l}</p>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">

        {/* === Audience Intelligence === */}
        <motion.div initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
          className="md:col-span-5 p-8 border rounded-sm"
          style={{ borderColor: "#F2A68A40", background: "linear-gradient(135deg, rgba(242,166,138,0.07), transparent)" }}>
          <div className="flex items-center gap-2 mb-2">
            <BarChart3 size={16} className="text-[#F2A68A]" />
            <p className="label-mono text-[#F2A68A]">/ audience intelligence · anonymised</p>
          </div>
          <h2 className="font-display text-3xl mb-6">WHO NEEDS YOU.</h2>

          {intelligence ? (
            <div className="space-y-4">
              {/* At-risk elders */}
              <div className="p-4 bg-[#0A0A0A] border border-[#1A1A1A] rounded-sm">
                <div className="flex items-center justify-between mb-1">
                  <p className="label-mono text-xs text-[#F2A68A]">Elders needing outreach</p>
                  <p className="font-mono text-2xl text-[#F2A68A]">{intelligence.elders_at_risk}</p>
                </div>
                <div className="h-1 bg-[#1A1A1A] rounded">
                  <div className="h-full bg-[#F2A68A] rounded transition-all duration-1000"
                    style={{ width: `${(intelligence.elders_at_risk / Math.max(1, intelligence.total_elders)) * 100}%` }} />
                </div>
                <p className="label-mono text-[#555] text-xs mt-1">
                  {intelligence.elders_at_risk} of {intelligence.total_elders} elders · score below {intelligence.low_score_threshold}
                </p>
              </div>

              {/* Participation trend */}
              <div className="p-4 bg-[#0A0A0A] border border-[#1A1A1A] rounded-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="label-mono text-xs text-[#A0A0A0]">Community participation this week</p>
                    <p className="font-mono text-3xl mt-1"
                      style={{ color: intelligence.participation_trend_pct >= 0 ? "#8BBF7A" : "#F2A68A" }}>
                      {intelligence.participation_this_week}
                    </p>
                    <p className="label-mono text-xs mt-1 flex items-center gap-1"
                      style={{ color: intelligence.participation_trend_pct >= 0 ? "#8BBF7A" : "#F2A68A" }}>
                      {intelligence.participation_trend_pct >= 0
                        ? <TrendingUp size={12} />
                        : <TrendingDown size={12} />
                      }
                      {Math.abs(intelligence.participation_trend_pct)}% vs last week
                    </p>
                  </div>
                  {intelligence.participation_trend_pct < -10 && (
                    <div className="text-right">
                      <p className="label-mono text-xs text-[#F2A68A] mb-1">⚠ Low week</p>
                      <p className="label-mono text-[10px] text-[#666]">Good time<br/>to run an event</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Top activity */}
              <div className="p-4 bg-[#0A0A0A] border border-[#1A1A1A] rounded-sm">
                <p className="label-mono text-xs text-[#A0A0A0] mb-1">Most popular activity type</p>
                <p className="font-display text-2xl capitalize">{intelligence.top_activity_type}</p>
                <p className="label-mono text-[#555] text-xs mt-1">Focus your next event here for max attendance</p>
              </div>

              <div className="p-4 bg-[#0A0A0A] border border-[#1A1A1A] rounded-sm flex items-center gap-3">
                <Users size={16} className="text-[#A0A0A0]" />
                <div>
                  <p className="label-mono text-xs text-[#A0A0A0]">{intelligence.total_members} total members</p>
                  <p className="label-mono text-xs text-[#555]">{intelligence.at_risk_count} below threshold</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {[1,2,3].map(i => (
                <div key={i} className="h-16 bg-[#1A1A1A] rounded-sm animate-pulse" />
              ))}
            </div>
          )}
        </motion.div>

        {/* === Event Creator === */}
        <motion.div initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.1 }}
          className="md:col-span-7 p-8 border rounded-sm"
          style={{ borderColor: ACCENT + "30", background: `linear-gradient(135deg, ${ACCENT}06, transparent)` }}>
          <p className="label-mono mb-2" style={{ color: ACCENT }}>/ create a community event</p>
          <h2 className="font-display text-3xl mb-5">RALLY THEM TOGETHER.</h2>

          <form onSubmit={createEvent} className="space-y-4">
            <div className="flex gap-3 flex-wrap">
              {EVENT_TYPES.map(t => (
                <button key={t.id} type="button" onClick={() => setEventType(t.id)}
                  className="px-3 py-2 label-mono text-xs border rounded-sm transition"
                  style={eventType === t.id
                    ? { background: ACCENT, color: "#000", borderColor: ACCENT }
                    : { borderColor: "#333", color: "#A0A0A0" }}>
                  {t.icon} {t.label}
                </button>
              ))}
            </div>

            <input value={title} onChange={e => setTitle(e.target.value)} required
              placeholder="Event title (e.g. Saturday Bingo Night)"
              className="w-full bg-transparent border border-[#333] rounded-sm px-4 py-3 text-sm outline-none focus:border-[#8BBF7A] transition" />

            <div className="grid grid-cols-2 gap-3">
              <input value={dateStr} onChange={e => setDateStr(e.target.value)} required
                placeholder="Date & time (e.g. Sat 26 Jul · 4 PM)"
                className="bg-transparent border border-[#333] rounded-sm px-4 py-3 text-sm outline-none focus:border-[#8BBF7A] transition" />
              <input value={venue} onChange={e => setVenue(e.target.value)} required
                placeholder="Venue (e.g. Koramangala Hall)"
                className="bg-transparent border border-[#333] rounded-sm px-4 py-3 text-sm outline-none focus:border-[#8BBF7A] transition" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <input value={price} onChange={e => setPrice(e.target.value)}
                placeholder="Price (e.g. Free / ₹100)"
                className="bg-transparent border border-[#333] rounded-sm px-4 py-3 text-sm outline-none focus:border-[#8BBF7A] transition" />
              <div className="flex gap-2">
                {AUDIENCES.map(a => (
                  <button key={a.id} type="button" onClick={() => setAudience(a.id)}
                    className="flex-1 py-3 label-mono text-xs border rounded-sm transition"
                    style={audience === a.id
                      ? { background: ACCENT, color: "#000", borderColor: ACCENT }
                      : { borderColor: "#333", color: "#A0A0A0" }}>
                    {a.label}
                  </button>
                ))}
              </div>
            </div>

            <textarea value={desc} onChange={e => setDesc(e.target.value)} rows={2}
              placeholder="Optional description…"
              className="w-full bg-transparent border border-[#333] rounded-sm px-4 py-3 text-sm outline-none focus:border-[#8BBF7A] transition resize-none" />

            <button type="submit" disabled={creating}
              className="w-full py-3 label-mono font-bold transition rounded-sm"
              style={{ background: creating ? "#333" : ACCENT, color: creating ? "#666" : "#000" }}>
              {creating ? "CREATING…" : "CREATE EVENT + POST TO FEED →"} {!creating && "+20 pts"}
            </button>
          </form>

          {/* Mitra briefing notice */}
          <p className="label-mono text-[#555] text-xs mt-4">
            ✨ Once created, Mitra will naturally mention your event to all members this week.
          </p>
        </motion.div>

        {/* === Post-Event Impact === */}
        {impact.length > 0 && (
          <motion.div initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2 }}
            className="md:col-span-7 p-8 border border-[#1A1A1A] rounded-sm">
            <p className="label-mono text-[#A0A0A0] mb-2">/ post-event impact · your events</p>
            <h2 className="font-display text-2xl mb-5">DID IT HELP? HERE'S THE DATA.</h2>
            <div className="space-y-4">
              {impact.map((ev, i) => (
                <motion.div key={ev.event_id || i} initial={{ x: -8, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: i * 0.08 }}
                  className="p-5 bg-[#0A0A0A] border border-[#1A1A1A] rounded-sm">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-semibold">{ev.title}</p>
                      <p className="label-mono text-[#666] text-xs mt-0.5">{ev.date}</p>
                    </div>
                    <span className="label-mono text-xs px-2 py-1 rounded-full shrink-0"
                      style={{ background: "#8BBF7A20", color: "#8BBF7A" }}>
                      +{ev.avg_score_change} avg pts
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-3 mt-4">
                    {[
                      { label: "RSVPd", val: ev.rsvp_count, color: "#B8A8E8" },
                      { label: "Attended", val: ev.attended_estimate, color: ACCENT },
                      { label: "High-concern attended", val: ev.high_concern_attended, color: "#F2A68A" },
                    ].map(({ label, val, color }) => (
                      <div key={label} className="text-center p-3 border border-[#1A1A1A] rounded-sm">
                        <p className="font-mono text-2xl" style={{ color }}>{val}</p>
                        <p className="label-mono text-[#666] text-xs mt-1">{label}</p>
                      </div>
                    ))}
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}

        {/* === Community Tasks + Active Organisers === */}
        <motion.div initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.25 }}
          className={`${impact.length > 0 ? "md:col-span-5" : "md:col-span-8"} space-y-5`}>

          {/* Task creator */}
          <div className="p-6 border border-[#1A1A1A] rounded-sm">
            <p className="label-mono text-[#A0A0A0] mb-3">/ issue a daily community task</p>
            <form onSubmit={createTask} className="flex gap-3">
              <input value={title} onChange={e => setTitle(e.target.value)}
                placeholder="E.g. Greet 3 neighbours by name…"
                className="flex-1 bg-transparent border border-[#333] rounded-sm px-4 py-2.5 text-sm outline-none focus:border-[#8BBF7A] transition" />
              <button type="submit"
                className="px-5 py-2.5 label-mono font-bold transition rounded-sm"
                style={{ background: ACCENT, color: "#000" }}>
                ISSUE →
              </button>
            </form>
            <div className="mt-3 space-y-2">
              {tasks.slice(0, 4).map(t => (
                <div key={t.id} className="flex justify-between items-center p-3 bg-[#0A0A0A] border border-[#1A1A1A] rounded-sm">
                  <p className="text-sm">{t.title}</p>
                  <span className="label-mono text-xs shrink-0 ml-3" style={{ color: ACCENT }}>{t.claims || 0} claims</span>
                </div>
              ))}
            </div>
          </div>

          {/* Active Organisers */}
          <div className="p-6 border border-[#1A1A1A] rounded-sm">
            <p className="label-mono text-[#A0A0A0] mb-4">/ active organisers in your area</p>
            <div className="space-y-3">
              {active.length > 0 ? active.map((o, i) => (
                <div key={o.name || i} className="flex items-center gap-3">
                  <img src={o.avatar} className="w-10 h-10 rounded-full object-cover border border-[#1A1A1A]" alt="" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate">{o.name}</p>
                    <p className="label-mono text-[#666] text-xs">{o.locality} · {o.tasks_issued} tasks</p>
                  </div>
                  <p className="label-mono text-xs shrink-0" style={{ color: i === 0 ? ACCENT : "#A0A0A0" }}>{o.score}</p>
                </div>
              )) : (
                <p className="label-mono text-[#444] text-xs">Loading organisers…</p>
              )}
            </div>
          </div>
        </motion.div>

        {/* Score strip */}
        <motion.div initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.35 }}
          className="md:col-span-12 p-6 border border-[#1A1A1A] rounded-sm flex items-center gap-8">
          <div>
            <p className="label-mono text-[#A0A0A0] text-xs">/ your social health · organiser weighted</p>
            <p className="font-mono text-5xl mt-1" style={{ color: ACCENT }}>{score?.score || 72}</p>
            <p className="label-mono text-[#555] text-xs mt-1">community participation weighted at 45%</p>
          </div>
          <div className="flex-1 space-y-2">
            {score && Object.entries(score.pillars).map(([k, v]) => (
              <div key={k} className="flex items-center gap-3">
                <p className="label-mono text-[#666] text-xs w-44 shrink-0 capitalize">{k.replace(/_/g, ' ')}</p>
                <div className="flex-1 h-0.5 bg-[#1A1A1A] rounded">
                  <motion.div initial={{ width: 0 }} animate={{ width: `${v}%` }} transition={{ duration: 1.2 }}
                    className="h-full rounded" style={{ background: ACCENT }} />
                </div>
                <p className="label-mono text-xs shrink-0" style={{ color: ACCENT }}>{v}</p>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
