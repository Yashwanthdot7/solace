import { useEffect, useState } from "react";
import { api } from "@/lib/api";

const MOODS = [
  { id: "bright", color: "#C8F04B" },
  { id: "calm", color: "#8BBF7A" },
  { id: "tender", color: "#B8A8E8" },
  { id: "heavy", color: "#E8854A" },
  { id: "blue", color: "#F2A68A" },
];

export default function Journal() {
  const [entries, setEntries] = useState([]);
  const [text, setText] = useState("");
  const [mood, setMood] = useState("calm");

  const load = () => api.get("/journal").then(r => setEntries(r.data));
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!text.trim()) return;
    await api.post("/journal", { text, mood });
    setText("");
    load();
  };

  return (
    <div className="px-6 md:px-12 py-12 max-w-7xl mx-auto">
      <p className="label-mono text-[#A0A0A0]">/ gratitude journal · private</p>
      <h1 className="font-display text-6xl md:text-7xl mb-4 mt-2">YOUR WORDS<br/>HOLD WEIGHT.</h1>
      <p className="text-[#A0A0A0] mb-8">Mitra's prompt today: <span className="text-white italic">"What is one small thing today that made you smile?"</span></p>

      <div className="grid md:grid-cols-2 gap-8">
        <div className="p-6 border border-[#1A1A1A] rounded-sm">
          <textarea value={text} onChange={(e) => setText(e.target.value)}
            placeholder="Write freely…" rows="8"
            data-testid="mindfulness-gratitude-journal-entry"
            className="w-full bg-transparent border border-[#222] rounded-sm p-4 outline-none focus:border-[#C8F04B] resize-none" />
          <div className="mt-4">
            <p className="label-mono text-[#A0A0A0] mb-2">/ how does this feel?</p>
            <div className="flex gap-2">
              {MOODS.map(m => (
                <button key={m.id} onClick={() => setMood(m.id)}
                  className={`px-4 py-2 label-mono rounded-sm transition ${mood === m.id ? "" : "border border-[#222]"}`}
                  style={mood === m.id ? { background: m.color, color: "#080808" } : { color: m.color }}>
                  {m.id}
                </button>
              ))}
            </div>
          </div>
          <button onClick={save} data-testid="journal-save-btn" className="mt-4 w-full py-3 bg-[#C8F04B] text-black label-mono">SAVE +5</button>
        </div>

        <div className="space-y-3">
          <p className="label-mono text-[#A0A0A0]">/ past entries · {entries.length}</p>
          {entries.length === 0 && <p className="text-[#666]">No entries yet. Start above.</p>}
          {entries.map((e) => {
            const m = MOODS.find(x => x.id === e.mood) || MOODS[1];
            return (
              <div key={e.id} className="p-5 border border-[#1A1A1A] rounded-sm flex gap-4">
                <div className="w-3 h-3 rounded-full mt-2 shrink-0" style={{ background: m.color }} />
                <div className="flex-1">
                  <p className="text-sm">{e.text}</p>
                  <p className="label-mono text-[#666] mt-2">{e.mood} · {new Date(e.ts).toLocaleDateString()}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
