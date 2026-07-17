import { useEffect, useState, useRef } from "react";
import { motion } from "framer-motion";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import ScoreGauge from "@/components/ScoreGauge";
import MarqueeStrip from "@/components/MarqueeStrip";
import confetti from "canvas-confetti";
import { Link } from "react-router-dom";

export default function Dashboard() {
  const { user, refresh } = useAuth();
  const [score, setScore] = useState(null);
  const [joy, setJoy] = useState(null);
  const [guardian, setGuardian] = useState([]);
  const [greeted, setGreeted] = useState(false);
  const greetRef = useRef(false);

  useEffect(() => {
    api.get("/score").then(r => setScore(r.data));
    api.get("/joy/today").then(r => setJoy(r.data));
    api.get("/guardian/members").then(r => setGuardian(r.data));
  }, []);

  // Mitra voice greeting on first visit per session
  useEffect(() => {
    if (greetRef.current) return;
    if (sessionStorage.getItem("solace_greeted")) { setGreeted(true); return; }
    greetRef.current = true;
    api.get("/greeting").then(r => {
      sessionStorage.setItem("solace_greeted", "1");
      setGreeted(true);
      if (!window.speechSynthesis) return;
      const speakIt = () => {
        const u = new SpeechSynthesisUtterance(r.data.text);
        u.rate = 0.95; u.pitch = 1.08;
        const v = window.speechSynthesis.getVoices();
        const pick = v.find(x => x.lang === "en-IN" && /female|fem|woman/i.test(x.name))
                  || v.find(x => x.lang === "en-IN")
                  || v.find(x => /female|samantha|google.*female/i.test(x.name))
                  || v.find(x => x.lang?.startsWith("en"));
        if (pick) u.voice = pick;
        window.speechSynthesis.speak(u);
      };
      if (window.speechSynthesis.getVoices().length === 0) {
        window.speechSynthesis.onvoiceschanged = () => speakIt();
      } else { speakIt(); }
    }).catch(() => {});
  }, []);

  const completeJoy = async () => {
    await api.post("/joy/complete");
    confetti({ particleCount: 200, spread: 100, colors: ["#C8F04B","#B8A8E8","#F2A68A","#8BBF7A","#E8854A"] });
    setJoy({ ...joy, completed: true });
    await refresh();
  };

  const sparkline = (data) => {
    if (!data) return null;
    const max = Math.max(...data), min = Math.min(...data);
    const range = max - min || 1;
    const points = data.map((v, i) => `${i * 30},${40 - ((v - min) / range) * 35}`).join(" ");
    return <polyline points={points} fill="none" stroke="#C8F04B" strokeWidth="2" />;
  };

  return (
    <div className="px-6 md:px-12 py-12 max-w-7xl mx-auto">
      <div className="mb-8">
        <p className="label-mono text-[#A0A0A0]">/ welcome back, {user?.name?.split(" ")[0]} {greeted && <span className="text-[#B8A8E8]">· Mitra greeted you 🎙</span>}</p>
        <h1 className="font-display text-6xl md:text-8xl leading-none mt-2">HOW ARE WE<br/>TODAY?</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        <motion.div initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
          className="md:col-span-7 p-8 md:p-12 border border-[#1A1A1A] rounded-sm flex flex-col md:flex-row gap-8 items-center" data-testid="social-health-score-card">
          <ScoreGauge score={score?.score || 72} band={score?.band || "green"} />
          <div className="flex-1">
            <p className="label-mono text-[#A0A0A0] mb-2">/ social health score</p>
            <h2 className="font-display text-4xl mb-4">YOU'RE THRIVING.</h2>
            <div className="space-y-3 mb-4">
              {score && Object.entries(score.pillars).map(([k, v]) => (
                <div key={k}>
                  <div className="flex justify-between label-mono mb-1">
                    <span>{k.replace(/_/g, ' ')}</span><span className="text-[#C8F04B]">{v}</span>
                  </div>
                  <div className="h-1 bg-[#1A1A1A] rounded">
                    <motion.div initial={{ width: 0 }} animate={{ width: `${v}%` }} transition={{ duration: 1.2 }}
                      className="h-full bg-[#C8F04B] rounded" />
                  </div>
                </div>
              ))}
            </div>
            <div className="pt-3 border-t border-[#1A1A1A]">
              <p className="label-mono text-[#A0A0A0] mb-2">/ last 7 days</p>
              <svg width="190" height="44" viewBox="0 0 190 44">{sparkline(score?.history)}</svg>
            </div>
          </div>
        </motion.div>

        <div className="md:col-span-5 p-8 border border-[#E8854A]/30 rounded-sm relative overflow-hidden"
          style={{ background: "linear-gradient(135deg, rgba(232,133,74,0.15), transparent)" }} data-testid="joy-challenge-card">
          <p className="label-mono text-[#E8854A] mb-2">/ joy challenge · day {joy?.day || 12}/30 · for {joy?.role || "you"}</p>
          <p className="font-display text-3xl md:text-4xl leading-tight">{joy?.text || "—"}</p>
          <p className="mt-6 label-mono text-[#A0A0A0]">{joy?.participants || 847} people doing this today</p>
          <button onClick={completeJoy} disabled={joy?.completed} data-testid="joy-challenge-confetti-btn"
            className="mt-6 w-full bg-[#E8854A] text-black py-3 label-mono disabled:opacity-40 hover:bg-[#C8F04B] transition">
            {joy?.completed ? "✓ DONE TODAY · +15 PTS" : "MARK DONE +15"}
          </button>
        </div>

        <div className="md:col-span-4 p-8 border border-[#1A1A1A] rounded-sm">
          <p className="label-mono text-[#C8F04B] mb-2">/ points</p>
          <p className="font-mono text-6xl text-[#C8F04B]">{user?.points || 0}</p>
          <p className="label-mono text-[#A0A0A0] mt-2">streak · {user?.streak || 1} days</p>
        </div>

        <Link to="/guardian" className="md:col-span-8 p-8 border border-[#F2A68A]/30 rounded-sm hover:border-[#F2A68A] transition block">
          <p className="label-mono text-[#F2A68A] mb-3">/ guardian quick view</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {guardian.slice(0, 4).map((m, i) => (
              <div key={m.id} data-testid={`guardian-mini-${i+1}`} className="p-3 bg-[#0F0F0F] rounded-sm">
                <div className="flex items-center gap-2">
                  <img src={m.avatar} alt="" className="w-8 h-8 rounded-full object-cover" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate">{m.name}</p>
                    <p className="label-mono text-[10px]" style={{ color: m.band === 'green' ? '#8BBF7A' : m.band === 'amber' ? '#E8854A' : '#F2A68A' }}>
                      {m.score} · {m.band}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Link>

        <div className="md:col-span-12">
          <MarqueeStrip color="sage" text="✦ TRIVIA THURSDAY 6 PM ✦ BINGO SATURDAY 5 PM ✦ MITRA IS LISTENING ✦" speed={25} />
        </div>

        {user?.role === "community" && <OrganiserPanel />}

        <Link to="/mindfulness" className="md:col-span-4 p-8 border border-[#1A1A1A] hover:border-[#B8A8E8] rounded-sm transition">
          <p className="label-mono text-[#B8A8E8]">/ wellness studio</p>
          <p className="font-display text-3xl mt-2">YOGA · BOXING · DANCE</p>
        </Link>
        <Link to="/games" className="md:col-span-4 p-8 border border-[#1A1A1A] hover:border-[#E8854A] rounded-sm transition">
          <p className="label-mono text-[#E8854A]">/ play today</p>
          <p className="font-display text-3xl mt-2">DAILY RIDDLE +12 PTS</p>
        </Link>
        <Link to="/journal" className="md:col-span-4 p-8 border border-[#1A1A1A] hover:border-[#C8F04B] rounded-sm transition">
          <p className="label-mono text-[#C8F04B]">/ gratitude</p>
          <p className="font-display text-3xl mt-2">WRITE TODAY</p>
        </Link>
      </div>
    </div>
  );
}

function OrganiserPanel() {
  const [tasks, setTasks] = useState([]);
  const [active, setActive] = useState([]);
  const [title, setTitle] = useState("");
  const [audience, setAudience] = useState("all");

  useEffect(() => {
    api.get("/organiser/tasks").then(r => setTasks(r.data));
    api.get("/organiser/active").then(r => setActive(r.data));
  }, []);

  const create = async () => {
    if (!title.trim()) return;
    const r = await api.post("/organiser/tasks", { title, audience, points: 10 });
    setTasks([r.data, ...tasks]);
    setTitle("");
  };

  return (
    <div className="md:col-span-12 p-8 border border-[#8BBF7A]/30 rounded-sm" data-testid="organiser-panel">
      <p className="label-mono text-[#8BBF7A] mb-2">/ community organiser · controls</p>
      <h2 className="font-display text-4xl mb-6">RALLY YOUR NEIGHBOURHOOD.</h2>
      <div className="grid md:grid-cols-3 gap-6">
        <div className="md:col-span-2">
          <div className="flex gap-2 mb-4">
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Issue a new task…"
              className="flex-1 bg-transparent border border-[#222] rounded-sm px-3 py-2 outline-none focus:border-[#8BBF7A]" />
            <select value={audience} onChange={(e) => setAudience(e.target.value)}
              className="bg-[#0F0F0F] border border-[#222] rounded-sm px-3 py-2 label-mono">
              <option value="all">ALL</option><option value="elder">ELDERS</option><option value="youth">YOUTH</option>
            </select>
            <button onClick={create} className="bg-[#8BBF7A] text-black px-4 label-mono">ISSUE →</button>
          </div>
          <div className="space-y-2">
            {tasks.slice(0, 5).map(t => (
              <div key={t.id} className="p-3 border border-[#1A1A1A] rounded-sm flex justify-between items-center" data-testid="organiser-task-row">
                <div>
                  <p>{t.title}</p>
                  <p className="label-mono text-[#666]">by {t.issued_by} · {t.audience} · +{t.points} pts</p>
                </div>
                <span className="label-mono text-[#8BBF7A]">{t.claims} claims</span>
              </div>
            ))}
          </div>
        </div>
        <div>
          <p className="label-mono text-[#A0A0A0] mb-3">/ active organisers</p>
          {active.map(o => (
            <div key={o.name} className="flex items-center gap-3 py-2">
              <img src={o.avatar} className="w-9 h-9 rounded-full object-cover" alt=""/>
              <div>
                <p>{o.name}</p>
                <p className="label-mono text-[#666]">{o.locality} · {o.tasks_issued} tasks</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
