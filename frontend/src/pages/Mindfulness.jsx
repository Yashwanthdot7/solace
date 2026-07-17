import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { motion } from "framer-motion";
import { Play } from "lucide-react";

export default function Mindfulness() {
  const [sessions, setSessions] = useState([]);
  const [active, setActive] = useState(null);
  const [done, setDone] = useState({});

  useEffect(() => { api.get("/wellness/sessions").then(r => setSessions(r.data)); }, []);

  const begin = async (s) => {
    setActive(s);
    setTimeout(async () => {
      await api.post(`/wellness/${s.id}/complete`);
      setDone((d) => ({ ...d, [s.id]: true }));
    }, 1200);
  };

  return (
    <div className="px-6 md:px-12 py-12 max-w-7xl mx-auto">
      <p className="label-mono text-[#B8A8E8]">/ wellness studio</p>
      <h1 className="font-display text-6xl md:text-7xl mb-3 mt-2">MOVE · BREATHE · GLOW.</h1>
      <p className="text-[#A0A0A0] mb-10 max-w-2xl">Yoga, boxing, dance, gymnastics, aerobics, meditation and breathwork — all guided, all in one place. Pick what your body needs today.</p>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {sessions.map((s, i) => (
          <motion.div key={s.id} initial={{ y: 30, opacity: 0 }} whileInView={{ y: 0, opacity: 1 }} viewport={{ once: true }}
            transition={{ delay: i * 0.05 }}
            whileHover={{ y: -6 }}
            data-testid={`wellness-${s.id}`}
            className="group relative overflow-hidden rounded-sm border border-[#1A1A1A] hover:border-white/40 transition">
            <div className="relative h-56 overflow-hidden">
              <img src={s.image} alt={s.label}
                className="w-full h-full object-cover transition duration-700 group-hover:scale-110"
                style={{ filter: "brightness(0.55)" }} />
              <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent" />
              <div className="absolute top-3 left-3 px-2 py-1 label-mono" style={{ background: s.color, color: "#080808" }}>{s.level}</div>
              <div className="absolute bottom-3 left-4">
                <p className="font-display text-5xl text-white drop-shadow-lg">{s.label.toUpperCase()}</p>
                <p className="label-mono text-white/80">⏱ {s.duration}</p>
              </div>
            </div>
            <div className="p-5 bg-[#0F0F0F]">
              <p className="text-sm text-[#A0A0A0] mb-4">{s.desc}</p>
              <button onClick={() => begin(s)}
                className="w-full py-2.5 border label-mono flex items-center justify-center gap-2 transition"
                style={done[s.id] ? { background: s.color, color: "#080808", borderColor: s.color } : { borderColor: s.color, color: s.color }}>
                <Play size={14} fill="currentColor" />
                {done[s.id] ? "✓ COMPLETED +10" : active?.id === s.id ? "STARTING…" : "BEGIN SESSION"}
              </button>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
