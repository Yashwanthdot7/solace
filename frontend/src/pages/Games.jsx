import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { motion, AnimatePresence } from "framer-motion";
import confetti from "canvas-confetti";

export default function Games() {
  const [games, setGames] = useState([]);
  const [active, setActive] = useState(null);
  useEffect(() => { api.get("/games").then(r => setGames(r.data)); }, []);

  return (
    <div className="px-6 md:px-12 py-12 max-w-7xl mx-auto">
      <p className="label-mono text-[#E8854A]">/ games for connection</p>
      <h1 className="font-display text-6xl md:text-7xl mb-4 mt-2">PLAY TOGETHER.</h1>
      <motion.div animate={{ scale: [1, 1.04, 1] }} transition={{ duration: 1.5, repeat: Infinity }}
        className="mb-10 px-4 py-2 bg-[#E8854A] text-black inline-block label-mono">⚡ TRIVIA THURSDAY · LIVE NOW</motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {games.map((g, i) => (
          <motion.div key={g.id} initial={{ y: 30, opacity: 0 }} whileInView={{ y: 0, opacity: 1 }} viewport={{ once: true }}
            transition={{ delay: i * 0.06 }}
            whileHover={{ y: -8, rotate: i % 2 ? 0.5 : -0.5 }}
            data-testid={`game-card-${g.id}`}
            className="relative overflow-hidden rounded-sm border border-[#1A1A1A] hover:border-white/40 group cursor-pointer"
            onClick={() => setActive(g)}>
            <div className="relative h-48 overflow-hidden">
              <img src={g.image} alt={g.name}
                className="w-full h-full object-cover transition duration-500 group-hover:scale-110"
                style={{ filter: "brightness(0.6)" }} />
              <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent" />
              <p className="absolute bottom-3 left-4 font-display text-4xl text-white drop-shadow-lg">{g.name.toUpperCase()}</p>
            </div>
            <div className="p-5 bg-[#0F0F0F]">
              <div className="flex justify-between mb-3">
                <p className="label-mono text-[#A0A0A0]">{g.players} playing</p>
                {g.elder_friendly && <p className="label-mono text-[#C8F04B]">✓ Elder-friendly</p>}
                {g.shared && <p className="label-mono text-[#B8A8E8]">✦ City-wide</p>}
                {g.live_sat && <p className="label-mono text-[#F2A68A]">▶ Sat live</p>}
              </div>
              <button data-testid={`play-${g.id}`}
                className="w-full py-2.5 label-mono transition"
                style={{ background: g.color, color: "#080808" }}>
                PLAY NOW →
              </button>
            </div>
          </motion.div>
        ))}
      </div>

      <AnimatePresence>
        {active && <GameModal game={active} onClose={() => setActive(null)} />}
      </AnimatePresence>
    </div>
  );
}

function GameModal({ game, onClose }) {
  const close = (e) => { e?.stopPropagation?.(); onClose(); };
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={close}
      className="fixed inset-0 z-50 bg-black/85 backdrop-blur-xl flex items-center justify-center p-4">
      <motion.div initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 30, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl bg-[#0F0F0F] border rounded-sm overflow-hidden" style={{ borderColor: game.color + "60" }}>
        <div className="p-6 border-b border-white/5 flex justify-between items-center" style={{ background: game.color + "22" }}>
          <p className="font-display text-4xl" style={{ color: game.color }}>{game.name.toUpperCase()}</p>
          <button onClick={close} className="label-mono text-[#A0A0A0] hover:text-white">CLOSE ✕</button>
        </div>
        <div className="p-8">
          {game.id === "daily-riddle" && <Riddle />}
          {game.id === "word-scramble" && <Scramble />}
          {game.id === "memory-match" && <Memory />}
          {!["daily-riddle","word-scramble","memory-match"].includes(game.id) && (
            <div className="text-center py-12">
              <p className="text-[#A0A0A0] mb-6">This live session opens with the community.</p>
              <button onClick={async () => { await api.post(`/games/${game.id}/play`); confetti({ particleCount: 80, spread: 60 }); }}
                className="px-8 py-3 label-mono" style={{ background: game.color, color: "#080808" }}>JOIN +8 PTS</button>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

function Riddle() {
  const [r, setR] = useState(null);
  const [ans, setAns] = useState("");
  const [res, setRes] = useState(null);
  useEffect(() => { api.get("/games/riddle/today").then(x => setR(x.data)); }, []);
  const submit = async () => {
    const x = await api.post("/games/riddle/answer", { id: r.id, answer: ans });
    setRes(x.data);
    if (x.data.correct) confetti({ particleCount: 150, spread: 80, colors: ["#F2A68A","#C8F04B"] });
  };
  return (
    <div>
      <p className="label-mono text-[#A0A0A0] mb-3">/ riddle of the day</p>
      <p className="font-display text-3xl mb-6">{r?.q || "Loading…"}</p>
      <input value={ans} onChange={(e) => setAns(e.target.value)} placeholder="Your answer…"
        data-testid="riddle-answer-input"
        className="w-full bg-transparent border border-[#333] rounded-sm px-4 py-3 outline-none focus:border-[#F2A68A] mb-3" />
      <button onClick={submit} data-testid="riddle-submit" className="w-full py-3 bg-[#F2A68A] text-black label-mono">SUBMIT →</button>
      {res && <p className={`mt-4 label-mono ${res.correct ? "text-[#8BBF7A]" : "text-[#F2A68A]"}`}>
        {res.already_answered ? `You've answered today's riddle. Answer: ${res.answer}. Come back tomorrow!`
          : res.correct ? "✓ Correct! +12 pts" : `× Not quite. Answer: ${res.answer}`}
      </p>}
    </div>
  );
}

function Scramble() {
  const words = ["BENGALURU", "FRIEND", "CHAI", "SUNRISE", "NEIGHBOUR"];
  const [w] = useState(words[Math.floor(Math.random()*words.length)]);
  const [scrambled] = useState(w.split("").sort(() => Math.random() - 0.5).join(""));
  const [guess, setGuess] = useState("");
  const [ok, setOk] = useState(null);
  const check = () => {
    const c = guess.toUpperCase() === w;
    setOk(c);
    if (c) { confetti({ particleCount: 120, spread: 80, colors: ["#C8F04B"] }); api.post("/games/word-scramble/play"); }
  };
  return (
    <div>
      <p className="label-mono text-[#A0A0A0] mb-3">/ unscramble the word</p>
      <p className="font-display text-6xl tracking-widest mb-6 text-[#C8F04B]">{scrambled}</p>
      <input value={guess} onChange={(e) => setGuess(e.target.value)} placeholder="Your guess…"
        className="w-full bg-transparent border border-[#333] rounded-sm px-4 py-3 outline-none focus:border-[#C8F04B] mb-3 uppercase" />
      <button onClick={check} className="w-full py-3 bg-[#C8F04B] text-black label-mono">CHECK →</button>
      {ok !== null && <p className={`mt-4 label-mono ${ok ? "text-[#8BBF7A]" : "text-[#F2A68A]"}`}>{ok ? "✓ Brilliant! +8 pts" : `× Try again`}</p>}
    </div>
  );
}

function Memory() {
  const ICONS = ["🌸","🪷","☕","🎵","🪔","🧡"];
  const [cards, setCards] = useState(() => {
    const d = [...ICONS, ...ICONS].sort(() => Math.random() - 0.5).map((i, idx) => ({ i, idx, flipped: false, matched: false }));
    return d;
  });
  const [flipped, setFlipped] = useState([]);
  const click = (idx) => {
    if (flipped.length === 2 || cards[idx].flipped || cards[idx].matched) return;
    const nc = cards.map((c, i) => i === idx ? { ...c, flipped: true } : c);
    setCards(nc);
    const nf = [...flipped, idx];
    setFlipped(nf);
    if (nf.length === 2) {
      setTimeout(() => {
        if (nc[nf[0]].i === nc[nf[1]].i) {
          const m = nc.map((c, i) => nf.includes(i) ? { ...c, matched: true } : c);
          setCards(m);
          if (m.every(c => c.matched)) { confetti({ particleCount: 200, spread: 100 }); api.post("/games/memory-match/play"); }
        } else {
          setCards(nc.map((c, i) => nf.includes(i) ? { ...c, flipped: false } : c));
        }
        setFlipped([]);
      }, 700);
    }
  };
  return (
    <div>
      <p className="label-mono text-[#A0A0A0] mb-4">/ match the pairs</p>
      <div className="grid grid-cols-4 gap-3">
        {cards.map((c, i) => (
          <button key={i} onClick={() => click(i)}
            className={`aspect-square text-4xl flex items-center justify-center rounded-sm transition ${c.flipped || c.matched ? "bg-[#B8A8E8] text-black" : "bg-[#1A1A1A] hover:bg-[#222]"}`}>
            {(c.flipped || c.matched) ? c.i : "?"}
          </button>
        ))}
      </div>
    </div>
  );
}
