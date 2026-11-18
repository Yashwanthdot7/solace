import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Link } from "react-router-dom";
import { Phone, AlertTriangle, Eye, CheckCircle, Clock } from "lucide-react";

const ACCENT = "#E8854A";

const BAND_CONFIG = {
  green: {
    color: "#8BBF7A", label: "THRIVING",    icon: "🟢",
    tier: 1, desc: "Active and engaged — no action needed.",
    border: "#8BBF7A40",
  },
  monitor: {
    color: "#C8F04B", label: "MONITORING",  icon: "🟡",
    tier: 2, desc: "Slight pattern shift. Watching closely.",
    border: "#C8F04B40",
  },
  amber: {
    color: "#E8854A", label: "AT RISK",     icon: "🟠",
    tier: 3, desc: "3+ signals detected. Reach out warmly.",
    border: "#E8854A40",
  },
  red: {
    color: "#F2A68A", label: "HIGH CONCERN", icon: "🔴",
    tier: 4, desc: "Significant drop. Action recommended now.",
    border: "#F2A68A60",
  },
};

function getBandKey(score) {
  if (score >= 80) return "green";
  if (score >= 60) return "monitor";
  if (score >= 40) return "amber";
  return "red";
}

export default function DashboardGuardian() {
  const { user } = useAuth();
  const [members, setMembers]   = useState([]);
  const [selected, setSelected] = useState(null);
  const [report, setReport]     = useState(null);
  const [loadingReport, setLoadingReport] = useState(false);
  const [mitraReminder, setMitraReminder] = useState(null);

  useEffect(() => {
    api.get("/guardian/members").then(r => {
      setMembers(r.data);
      // Auto-select highest concern
      const sorted = [...(r.data || [])].sort((a, b) => (getBandKey(a.score) > getBandKey(b.score) ? -1 : 1));
      if (sorted.length > 0) loadReport(sorted[0]);
    }).catch(() => {});
  }, []);

  const loadReport = async (member) => {
    setSelected(member);
    setReport(null);
    setLoadingReport(true);
    try {
      const r = await api.get(`/guardian/report/${member.id}`);
      setReport(r.data);
    } catch {}
    setLoadingReport(false);
  };

  const requestMitraReminder = (member) => {
    setMitraReminder(member.name);
    setTimeout(() => setMitraReminder(null), 4000);
  };

  const highConcern = members.filter(m => getBandKey(m.score) === "red");
  const atRisk      = members.filter(m => getBandKey(m.score) === "amber");
  const monitoring  = members.filter(m => getBandKey(m.score) === "monitor");
  const thriving    = members.filter(m => getBandKey(m.score) === "green");

  const firstName = user?.name?.split(" ")[0] || "Guardian";

  return (
    <div className="px-6 md:px-12 py-12 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-10">
        <div className="flex items-center gap-3 mb-2 flex-wrap">
          <span className="label-mono text-xs px-2 py-1 rounded-full border"
            style={{ color: ACCENT, borderColor: ACCENT + "40", background: ACCENT + "10" }}>
            GUARDIAN PANEL
          </span>
          {highConcern.length > 0 && (
            <motion.span animate={{ opacity: [1, 0.4, 1] }} transition={{ duration: 1.2, repeat: Infinity }}
              className="label-mono text-xs px-2 py-1 rounded-full border border-[#F2A68A]/40 bg-[#F2A68A]/10 text-[#F2A68A]">
              ⚠ {highConcern.length} HIGH CONCERN
            </motion.span>
          )}
          <span className="label-mono text-xs text-[#555] italic">
            · They chose to share a summary with you, and can stop at any time
          </span>
        </div>
        <h1 className="font-display text-6xl md:text-8xl leading-none mt-2">
          CARING FOR<br/>
          <span style={{ color: ACCENT }}>YOUR PEOPLE.</span>
        </h1>
        <p className="label-mono text-[#A0A0A0] mt-3">
          {firstName} · {members.length} member{members.length !== 1 ? "s" : ""} monitored
        </p>
      </div>

      {/* Mitra reminder confirmation */}
      <AnimatePresence>
        {mitraReminder && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="mb-4 p-4 border border-[#B8A8E8]/40 rounded-sm bg-[#B8A8E8]/08 label-mono text-sm text-[#B8A8E8]">
            ✓ Mitra will warmly mention the upcoming bingo night to {mitraReminder} next time they open the app.
          </motion.div>
        )}
      </AnimatePresence>

      {/* HIGH CONCERN alert banner */}
      {highConcern.length > 0 && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
          className="mb-6 p-5 border border-[#F2A68A]/50 rounded-sm"
          style={{ background: "linear-gradient(90deg, rgba(242,166,138,0.12), transparent)" }}>
          <p className="label-mono text-[#F2A68A] font-bold mb-3 flex items-center gap-2">
            <AlertTriangle size={16} /> HIGH CONCERN — RECOMMENDED ACTION NOW
          </p>
          {highConcern.map(m => (
            <div key={m.id} className="flex flex-col md:flex-row md:items-center justify-between gap-3 py-2 border-t border-[#F2A68A]/20">
              <p className="text-sm text-[#F2A68A]/90">{m.name} · {m.insight}</p>
              <div className="flex gap-2 shrink-0">
                <a href="tel:" className="flex items-center gap-1.5 px-3 py-1.5 label-mono text-xs rounded-sm"
                  style={{ background: "#F2A68A", color: "#000" }}>
                  <Phone size={12} /> Call Now
                </a>
                <button onClick={() => requestMitraReminder(m)}
                  className="flex items-center gap-1.5 px-3 py-1.5 label-mono text-xs border border-[#B8A8E8]/40 text-[#B8A8E8] rounded-sm hover:bg-[#B8A8E8]/10 transition">
                  Ask Mitra to remind
                </button>
              </div>
            </div>
          ))}
        </motion.div>
      )}

      {/* 4-tier summary strip */}
      <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
        className="grid grid-cols-4 gap-3 mb-6">
        {[
          { key: "green",   count: thriving.length,   ...BAND_CONFIG.green },
          { key: "monitor", count: monitoring.length,  ...BAND_CONFIG.monitor },
          { key: "amber",   count: atRisk.length,      ...BAND_CONFIG.amber },
          { key: "red",     count: highConcern.length, ...BAND_CONFIG.red },
        ].map(({ key, count, color, label, icon, desc }) => (
          <div key={key} className="p-4 border rounded-sm text-center"
            style={{ borderColor: color + "30", background: color + "08" }}>
            <p className="text-2xl">{icon}</p>
            <p className="font-mono text-3xl mt-1" style={{ color }}>{count}</p>
            <p className="label-mono text-xs mt-1" style={{ color }}>{label}</p>
            <p className="label-mono text-[10px] text-[#555] mt-1 leading-snug hidden md:block">{desc}</p>
          </div>
        ))}
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        {/* Members sidebar */}
        <div className="md:col-span-4 space-y-3">
          <p className="label-mono text-[#A0A0A0] text-xs mb-3">/ monitored members</p>
          {members.map(m => {
            const bk = getBandKey(m.score);
            const bc = BAND_CONFIG[bk];
            return (
              <motion.button key={m.id} onClick={() => loadReport(m)} whileHover={{ x: 4 }}
                className={`w-full text-left p-5 border rounded-sm transition ${selected?.id === m.id ? "border-[#E8854A]" : "border-[#1A1A1A] hover:border-white/20"}`}
                style={selected?.id === m.id ? { background: `${ACCENT}08` } : {}}>
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <img src={m.avatar} alt="" className="w-12 h-12 rounded-full object-cover" />
                    <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-[#080808]"
                      style={{ background: bc.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate">{m.name}</p>
                    <p className="label-mono text-[#666] text-xs">{m.relation} · {m.age} yrs</p>
                    <p className="label-mono text-xs mt-0.5" style={{ color: bc.color }}>{bc.icon} {bc.label}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-mono text-2xl" style={{ color: bc.color }}>{m.score}</p>
                    <p className="label-mono text-xs text-[#555]">/ 100</p>
                    <p className="label-mono text-[#555] text-xs">{m.last_seen}</p>
                  </div>
                </div>
                {bk !== "green" && (
                  <p className="label-mono text-[#666] text-xs mt-3 line-clamp-2 border-t border-[#1A1A1A] pt-2">
                    {m.insight}
                  </p>
                )}
              </motion.button>
            );
          })}

          {/* Add member CTA */}
          <Link to="/guardian"
            className="block w-full p-4 border border-dashed border-[#333] rounded-sm text-center label-mono text-[#666] hover:border-white/30 hover:text-white transition text-xs">
            + Link a new member
          </Link>
        </div>

        {/* Detail panel */}
        <div className="md:col-span-8 space-y-5">
          {selected ? (
            <>
              {(() => {
                const bk = getBandKey(selected.score);
                const bc = BAND_CONFIG[bk];
                return (
                  <>
                    {/* Member hero */}
                    <motion.div key={selected.id} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
                      className="p-8 border rounded-sm"
                      style={{ borderColor: bc.color + "40", background: `linear-gradient(135deg, ${bc.color}08, transparent)` }}>
                      <div className="flex items-start gap-5">
                        <img src={selected.avatar} alt="" className="w-20 h-20 rounded-full object-cover border-2"
                          style={{ borderColor: bc.color }} />
                        <div className="flex-1">
                          <div className="flex items-baseline gap-3 flex-wrap">
                            <h2 className="font-display text-4xl">{selected.name}</h2>
                            <span className="label-mono text-sm px-2 py-1 rounded-full"
                              style={{ color: bc.color, background: bc.color + "20" }}>
                              {bc.icon} {bc.label}
                            </span>
                          </div>
                          <p className="label-mono text-[#A0A0A0] mt-1">
                            {selected.relation} · {selected.age} yrs · last seen {selected.last_seen}
                          </p>
                          <p className="mt-3 text-sm text-[#A0A0A0]">{selected.insight}</p>

                          {/* Action buttons for AT RISK / HIGH CONCERN */}
                          {bk === "red" && (
                            <div className="flex gap-2 mt-4 flex-wrap">
                              <a href="tel:" className="flex items-center gap-1.5 px-4 py-2 label-mono text-xs rounded-sm"
                                style={{ background: bc.color, color: "#000" }}>
                                <Phone size={12} /> Call {selected.name.split(" ")[0]} Now
                              </a>
                              <button onClick={() => requestMitraReminder(selected)}
                                className="flex items-center gap-1.5 px-4 py-2 label-mono text-xs border border-[#B8A8E8]/40 text-[#B8A8E8] rounded-sm hover:bg-[#B8A8E8]/10 transition">
                                Ask Mitra to reach out
                              </button>
                              <button className="flex items-center gap-1.5 px-4 py-2 label-mono text-xs border border-[#E8854A]/40 text-[#E8854A] rounded-sm hover:bg-[#E8854A]/10 transition">
                                Alert family members
                              </button>
                            </div>
                          )}
                          {bk === "amber" && (
                            <div className="flex gap-2 mt-4">
                              <button onClick={() => requestMitraReminder(selected)}
                                className="flex items-center gap-1.5 px-4 py-2 label-mono text-xs border border-[#B8A8E8]/40 text-[#B8A8E8] rounded-sm hover:bg-[#B8A8E8]/10 transition">
                                Ask Mitra to check in
                              </button>
                            </div>
                          )}
                        </div>
                        <div className="text-right shrink-0">
                          <p className="font-mono text-6xl" style={{ color: bc.color }}>{selected.score}</p>
                          <p className="label-mono text-[#666] text-xs">/ 100</p>
                        </div>
                      </div>

                      {/* Sparkline */}
                      <div className="mt-5 pt-5 border-t border-[#1A1A1A]">
                        <p className="label-mono text-[#A0A0A0] text-xs mb-2">/ 7-day score trend</p>
                        <svg width="100%" height="50" viewBox="0 0 210 50" preserveAspectRatio="none">
                          {(() => {
                            const d = selected.weekly || []; if (!d.length) return null;
                            const max = Math.max(...d), min = Math.min(...d), range = max - min || 1;
                            const pts = d.map((v, i) => `${i * 35},${45 - ((v - min) / range) * 40}`).join(" ");
                            return (
                              <>
                                <polyline points={pts} fill="none" stroke={bc.color} strokeWidth="2" />
                                {d.map((v, i) => (
                                  <circle key={i} cx={i * 35} cy={45 - ((v - min) / range) * 40} r="3" fill={bc.color} />
                                ))}
                              </>
                            );
                          })()}
                        </svg>
                        <div className="flex justify-between label-mono text-[#444] text-xs mt-1">
                          {["Mon","Tue","Wed","Thu","Fri","Sat","Today"].map(d => <span key={d}>{d}</span>)}
                        </div>
                      </div>
                    </motion.div>

                    {/* Mitra briefing */}
                    {bk !== "green" && (
                      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.05 }}
                        className="p-5 border border-[#B8A8E8]/20 rounded-sm"
                        style={{ background: "rgba(184,168,232,0.05)" }}>
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full mitra-orb shrink-0" />
                          <div>
                            <p className="label-mono text-[#B8A8E8] text-xs mb-1">/ mitra is briefed</p>
                            <p className="text-sm text-[#A0A0A0]">
                              Mitra knows {selected.name.split(" ")[0]} needs extra warmth this week.
                              She'll naturally mention upcoming events and check on their mood each time they open the app.
                            </p>
                          </div>
                        </div>
                      </motion.div>
                    )}

                    {/* Weekly activity */}
                    {loadingReport ? (
                      <div className="p-6 border border-[#1A1A1A] rounded-sm flex items-center justify-center">
                        <p className="label-mono text-[#444]">Loading activity report…</p>
                      </div>
                    ) : report && (
                      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
                        className="p-6 border border-[#1A1A1A] rounded-sm">
                        <p className="label-mono text-[#A0A0A0] mb-4 text-xs">/ this week's activity log</p>
                        <div className="space-y-2">
                          {(report.events || []).map((ev, i) => {
                            const colors = { chat: "#C8F04B", journal: "#B8A8E8", joy: "#8BBF7A", event: "#E8854A", skip: "#F2A68A", rest: "#333" };
                            return (
                              <div key={i} className="flex items-center gap-4 py-2 border-b border-[#1A1A1A] last:border-0">
                                <span className="label-mono text-xs w-8 text-[#666]">{ev.date}</span>
                                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: colors[ev.type] || "#444" }} />
                                <span className="text-sm text-[#A0A0A0]">{ev.text}</span>
                              </div>
                            );
                          })}
                        </div>
                      </motion.div>
                    )}

                    {/* Recommendations */}
                    {report?.recommendations && (
                      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
                        className="p-6 border rounded-sm"
                        style={{ borderColor: ACCENT + "30", background: `${ACCENT}08` }}>
                        <p className="label-mono mb-3" style={{ color: ACCENT }}>/ Gemini-recommended actions</p>
                        <div className="space-y-2">
                          {report.recommendations.map((r, i) => (
                            <div key={i} className="flex items-start gap-3">
                              <span style={{ color: ACCENT }} className="mt-0.5 shrink-0">→</span>
                              <p className="text-sm">{r}</p>
                            </div>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </>
                );
              })()}
            </>
          ) : (
            <div className="p-12 border border-[#1A1A1A] rounded-sm flex items-center justify-center">
              <p className="label-mono text-[#444]">Select a member to view their report</p>
            </div>
          )}

          {/* Quick links */}
          <div className="grid grid-cols-3 gap-4">
            {[
              { to: "/chat", color: "#C8F04B", label: "/ message", title: "OPEN\nCHAT" },
              { to: "/events", color: "#B8A8E8", label: "/ plan together", title: "FIND\nEVENTS" },
              { to: "/feed", color: ACCENT, label: "/ community", title: "SHARED\nFEED" },
            ].map((item, i) => (
              <Link key={i} to={item.to}
                className="p-5 border border-[#1A1A1A] rounded-sm hover:border-white/30 transition group">
                <p className="label-mono text-xs mb-2" style={{ color: item.color }}>{item.label}</p>
                <p className="font-display text-xl leading-tight whitespace-pre-line group-hover:text-white transition">{item.title}</p>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
