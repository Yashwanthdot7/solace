import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { motion } from "framer-motion";

const BAND = { green: "#8BBF7A", amber: "#E8854A", red: "#F2A68A" };

export default function Guardian() {
  const [members, setMembers] = useState([]);
  const [tab, setTab] = useState("monitor");
  const [selected, setSelected] = useState(null);
  const [report, setReport] = useState(null);
  const [adding, setAdding] = useState({ name: "", relation: "", age: "" });

  useEffect(() => { api.get("/guardian/members").then(r => { setMembers(r.data); setSelected(r.data[0]); }); }, []);
  useEffect(() => {
    if (selected && tab === "report") api.get(`/guardian/report/${selected.id}`).then(r => setReport(r.data));
  }, [selected, tab]);

  const addMember = async () => {
    if (!adding.name) return;
    const r = await api.post("/guardian/add", { ...adding, age: parseInt(adding.age) || 30 });
    setMembers([...members, { ...r.data, insight: "Newly added. Score will populate over the next 48 hours.", last_seen: "just now", weekly: [70,70,70,70,72,72,72], avatar: "https://images.unsplash.com/photo-1599566150163-29194dcaad36?w=300&q=70" }]);
    setAdding({ name: "", relation: "", age: "" });
    setTab("monitor");
  };

  const sparkline = (data) => {
    if (!data) return null;
    const max = Math.max(...data), min = Math.min(...data), r = max - min || 1;
    return <polyline points={data.map((v, i) => `${i * 30},${40 - ((v - min) / r) * 35}`).join(" ")}
      fill="none" stroke="#F2A68A" strokeWidth="2.5" />;
  };

  return (
    <div className="px-6 md:px-12 py-12 max-w-7xl mx-auto">
      <p className="label-mono text-[#F2A68A]">/ guardian monitor</p>
      <h1 className="font-display text-6xl md:text-7xl mb-6 mt-2">EYES THAT CARE.</h1>

      <div className="flex gap-2 mb-8" data-testid="guardian-tabs">
        {["monitor", "report", "add"].map(t => (
          <button key={t} onClick={() => setTab(t)} data-testid={`tab-${t}`}
            className={`px-5 py-2 label-mono transition ${tab === t ? "bg-[#F2A68A] text-black" : "border border-[#222] text-[#A0A0A0] hover:border-white/30"}`}>
            {t.toUpperCase()}
          </button>
        ))}
      </div>

      {tab === "monitor" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {members.map((m) => (
            <motion.div key={m.id} initial={{ y: 20, opacity: 0 }} whileInView={{ y: 0, opacity: 1 }} viewport={{ once: true }}
              data-testid={`guardian-card-${m.id}`}
              onClick={() => { setSelected(m); setTab("report"); }}
              className="p-6 border rounded-sm cursor-pointer hover:bg-white/[0.02] transition" style={{ borderColor: BAND[m.band] + "40" }}>
              <div className="flex gap-4 mb-4">
                <img src={m.avatar} alt={m.name} className="w-16 h-16 rounded-full object-cover" />
                <div className="flex-1">
                  <p className="font-display text-2xl">{m.name}</p>
                  <p className="label-mono text-[#A0A0A0]">{m.relation} · age {m.age} · {m.last_seen}</p>
                </div>
                <div className="text-right">
                  <p className="font-mono text-4xl tabular-nums" style={{ color: BAND[m.band] }}>{m.score}</p>
                  <p className="label-mono" style={{ color: BAND[m.band] }}>{m.band.toUpperCase()}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 mb-3">
                <svg width="180" height="44" viewBox="0 0 180 44">{sparkline(m.weekly)}</svg>
                <p className="label-mono text-[#666] flex-1">7-day trend</p>
              </div>
              <div className="p-3 bg-[#0F0F0F] border border-[#1A1A1A] rounded-sm" data-testid="guardian-insight">
                <p className="label-mono text-[#B8A8E8] mb-1">/ ai insight</p>
                <p className="text-sm">{m.insight}</p>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {tab === "report" && report && (
        <div className="grid md:grid-cols-3 gap-6">
          <div className="md:col-span-1 p-6 border border-[#F2A68A]/30 rounded-sm">
            <img src={report.member.avatar} className="w-full aspect-square object-cover rounded-sm mb-4" alt=""/>
            <p className="font-display text-3xl">{report.member.name}</p>
            <p className="label-mono text-[#A0A0A0]">{report.member.relation} · age {report.member.age}</p>
            <div className="mt-4">
              <p className="label-mono text-[#A0A0A0] mb-2">/ select member</p>
              <select value={report.member.id} onChange={(e) => setSelected(members.find(m => m.id === e.target.value))}
                className="w-full bg-[#0F0F0F] border border-[#222] rounded-sm px-3 py-2 label-mono">
                {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>
          </div>
          <div className="md:col-span-2 p-6 border border-[#1A1A1A] rounded-sm">
            <p className="label-mono text-[#F2A68A] mb-3">/ weekly score trend</p>
            <svg viewBox="0 0 240 80" className="w-full h-32">
              <polyline points={report.weekly_score.map((v, i) => `${i*40},${80 - v*0.7}`).join(" ")} fill="none" stroke="#F2A68A" strokeWidth="3"/>
              {report.weekly_score.map((v, i) => <circle key={i} cx={i*40} cy={80-v*0.7} r="4" fill="#F2A68A"/>)}
            </svg>
            <div className="grid grid-cols-7 mt-1 text-center">
              {["M","T","W","T","F","S","S"].map((d, i) => <span key={i} className="label-mono text-[#666]">{d}</span>)}
            </div>
            <div className="mt-6 space-y-2">
              <p className="label-mono text-[#A0A0A0]">/ this week's activity log</p>
              {report.events.map((e, i) => (
                <div key={i} className="flex gap-3 py-2 border-b border-[#1A1A1A] last:border-0">
                  <span className="label-mono text-[#666] w-10">{e.date}</span>
                  <span className="label-mono w-16" style={{ color: e.type === "skip" ? "#F2A68A" : "#8BBF7A" }}>{e.type}</span>
                  <span className="text-sm flex-1">{e.text}</span>
                </div>
              ))}
            </div>
            <div className="mt-6">
              <p className="label-mono text-[#B8A8E8] mb-2">/ mitra's recommendations</p>
              {report.recommendations.map((r, i) => (
                <p key={i} className="text-sm py-1">→ {r}</p>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === "add" && (
        <div className="max-w-lg">
          <p className="label-mono text-[#A0A0A0] mb-4">/ add a person to monitor</p>
          <input className="w-full bg-transparent border border-[#222] rounded-sm px-4 py-3 mb-3 outline-none focus:border-[#F2A68A]"
            placeholder="Full name" value={adding.name} onChange={(e) => setAdding({...adding, name: e.target.value})} />
          <input className="w-full bg-transparent border border-[#222] rounded-sm px-4 py-3 mb-3 outline-none focus:border-[#F2A68A]"
            placeholder="Relation (e.g. Mother)" value={adding.relation} onChange={(e) => setAdding({...adding, relation: e.target.value})} />
          <input className="w-full bg-transparent border border-[#222] rounded-sm px-4 py-3 mb-4 outline-none focus:border-[#F2A68A]"
            placeholder="Age" type="number" value={adding.age} onChange={(e) => setAdding({...adding, age: e.target.value})} />
          <button onClick={addMember} data-testid="guardian-add-submit"
            className="w-full bg-[#F2A68A] text-black py-3 label-mono">ADD MEMBER →</button>
        </div>
      )}
    </div>
  );
}
