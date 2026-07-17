import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

const SLIDES = [
  {
    tag: "/ Bengaluru · 2026",
    eyebrow: "A LIVING NEIGHBOURHOOD",
    title: ["YOU DON'T", "HAVE TO BE", "ALONE."],
    sub: "Solace measures loneliness, builds real connection, and sends help before anyone has to ask.",
    cta: "LAUNCH JOURNEY",
    accent: "#C8F04B",
    bg: "#080808",
    glow: "rgba(200,240,75,0.18)",
    image: "https://images.unsplash.com/photo-1529390079861-591de354faf5?w=1400&q=80",
    chips: ["#community", "#realhumans", "#bengaluru"],
  },
  {
    tag: "/ feature one",
    eyebrow: "SOCIAL HEALTH SCORE",
    title: ["MEASURE", "WHAT MATTERS:", "CONNECTION."],
    sub: "A 0-100 number, three pillars, real-time. Green means thriving, amber at risk, red intervene.",
    cta: "SEE THE SCORE",
    accent: "#C8F04B",
    bg: "#0D1208",
    glow: "rgba(200,240,75,0.22)",
    image: "https://images.unsplash.com/photo-1551836022-deb4988cc6c0?w=1400&q=80",
    chips: ["0-100", "3 pillars", "real-time"],
  },
  {
    tag: "/ feature two",
    eyebrow: "MITRA · AI VOICE",
    title: ["A WARM", "BENGALURU", "VOICE."],
    sub: "Four moods. Speaks. Listens. Remembers. Lives as a floating orb on every screen.",
    cta: "MEET MITRA",
    accent: "#B8A8E8",
    bg: "#0F0B16",
    glow: "rgba(184,168,232,0.22)",
    image: "https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=1400&q=80",
    chips: ["voice", "memory", "4 moods"],
  },
  {
    tag: "/ feature three",
    eyebrow: "WELLNESS STUDIO",
    title: ["MOVE.", "BREATHE.", "GLOW."],
    sub: "Yoga, boxing, dance, gymnastics, aerobics, meditation. All guided, all in one place.",
    cta: "ENTER STUDIO",
    accent: "#E8854A",
    bg: "#160C08",
    glow: "rgba(232,133,74,0.24)",
    image: "https://images.unsplash.com/photo-1545205597-3d9d02c29597?w=1400&q=80",
    chips: ["8 sessions", "+10 pts each", "guided"],
  },
  {
    tag: "/ feature four",
    eyebrow: "JOY CHALLENGE",
    title: ["ONE SMALL", "HUMAN DARE.", "DAILY."],
    sub: "847 people doing today's challenge with you. Confetti, streaks, real-world warmth.",
    cta: "JOIN TODAY",
    accent: "#F2A68A",
    bg: "#160E0C",
    glow: "rgba(242,166,138,0.24)",
    image: "https://images.unsplash.com/photo-1469571486292-0ba58a3f068b?w=1400&q=80",
    chips: ["daily", "streak", "847 today"],
  },
];

const EASE = [0.25, 1, 0.5, 1];

export default function HeroCarousel({ onLaunch }) {
  const [i, setI] = useState(0);
  const [dir, setDir] = useState(1);
  const auto = useRef(null);
  const mouse = useRef({ x: 0, y: 0 });
  const [parallax, setParallax] = useState({ x: 0, y: 0 });

  useEffect(() => {
    auto.current = setInterval(() => { setDir(1); setI((p) => (p + 1) % SLIDES.length); }, 5500);
    return () => clearInterval(auto.current);
  }, []);

  useEffect(() => {
    const onMove = (e) => {
      const x = (e.clientX / window.innerWidth - 0.5) * 2;
      const y = (e.clientY / window.innerHeight - 0.5) * 2;
      mouse.current = { x, y };
      setParallax({ x: x * 18, y: y * 12 });
    };
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, []);

  const go = (n) => {
    setDir(n > i ? 1 : -1);
    setI(n);
    clearInterval(auto.current);
    auto.current = setInterval(() => { setDir(1); setI((p) => (p + 1) % SLIDES.length); }, 5500);
  };

  const s = SLIDES[i];

  return (
    <section className="relative min-h-screen overflow-hidden" style={{ background: s.bg, perspective: "1600px" }} data-testid="hero-carousel">
      {/* Animated bg glow */}
      <motion.div
        key={`glow-${i}`}
        initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 1.2, ease: EASE }}
        className="absolute -right-32 -top-32 w-[80vw] h-[80vw] rounded-full pointer-events-none"
        style={{ background: `radial-gradient(circle, ${s.glow}, transparent 60%)` }}
      />
      {/* Faint grid */}
      <div className="absolute inset-0 opacity-[0.04]" style={{
        backgroundImage: "linear-gradient(white 1px, transparent 1px), linear-gradient(90deg, white 1px, transparent 1px)",
        backgroundSize: "80px 80px",
        transform: `translate(${parallax.x * 0.4}px, ${parallax.y * 0.4}px)`,
      }}/>

      <div className="relative max-w-7xl mx-auto px-6 md:px-12 pt-32 pb-24 min-h-screen grid grid-cols-1 md:grid-cols-12 items-center gap-8">

        {/* LEFT — Typography */}
        <div className="md:col-span-7 relative z-10">
          <AnimatePresence mode="wait" custom={dir}>
            <motion.div key={i} custom={dir}
              initial={(d) => ({ x: d * 80, opacity: 0, rotateY: d * -12, skewX: d * -4 })}
              animate={{ x: 0, opacity: 1, rotateY: 0, skewX: 0 }}
              exit={(d) => ({ x: d * -80, opacity: 0, rotateY: d * 12, skewX: d * 4 })}
              transition={{ duration: 0.85, ease: EASE }}
              style={{ transformStyle: "preserve-3d" }}>
              <p className="label-mono mb-3" style={{ color: s.accent }}>{s.tag}</p>
              <p className="label-mono text-[#A0A0A0] mb-6">{s.eyebrow}</p>
              <h1 data-testid="hero-heading" className="font-display text-[13vw] md:text-[8.5vw] lg:text-[7.5vw] leading-[0.85] tracking-tight">
                {s.title.map((line, k) => (
                  <span key={k} className="block overflow-hidden">
                    <motion.span
                      initial={{ y: "100%" }} animate={{ y: 0 }}
                      transition={{ delay: 0.15 + k * 0.08, duration: 0.7, ease: EASE }}
                      className="block"
                      style={k === s.title.length - 1 ? { color: s.accent } : {}}>
                      {line}
                    </motion.span>
                  </span>
                ))}
              </h1>
              <motion.p initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.55, duration: 0.6, ease: EASE }}
                className="mt-8 max-w-lg text-lg text-[#A0A0A0]">{s.sub}</motion.p>

              <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.7, duration: 0.5 }}
                className="mt-6 flex flex-wrap gap-2">
                {s.chips.map((c) => (
                  <span key={c} className="label-mono px-3 py-1 border rounded-full" style={{ borderColor: s.accent + "70", color: s.accent }}>
                    {c}
                  </span>
                ))}
              </motion.div>

              <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.85, duration: 0.5 }}
                className="mt-10 flex gap-3 flex-wrap">
                <button onClick={onLaunch} data-testid="join-free-btn"
                  className="group relative overflow-hidden font-display text-2xl tracking-wide px-8 py-4 transition"
                  style={{ background: s.accent, color: "#080808" }}>
                  <span className="relative z-10">{s.cta} →</span>
                  <span className="absolute inset-0 bg-white scale-x-0 group-hover:scale-x-100 origin-left transition-transform duration-500" />
                </button>
                <button onClick={() => onLaunch?.("login")} className="border border-white/20 px-8 py-4 font-display text-2xl hover:border-white hover:bg-white/5">
                  EXPLORE
                </button>
              </motion.div>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* RIGHT — 3D card */}
        <div className="md:col-span-5 relative" style={{ perspective: "1400px" }}>
          <AnimatePresence mode="wait" custom={dir}>
            <motion.div key={`img-${i}`} custom={dir}
              initial={(d) => ({ x: d * 200, opacity: 0, rotateY: d * 28, scale: 0.85 })}
              animate={{ x: 0, opacity: 1, rotateY: 0, scale: 1 }}
              exit={(d) => ({ x: d * -200, opacity: 0, rotateY: d * -28, scale: 0.85 })}
              transition={{ duration: 1.0, ease: EASE }}
              style={{
                transformStyle: "preserve-3d",
                transform: `rotateY(${parallax.x * 0.3}deg) rotateX(${-parallax.y * 0.3}deg)`,
              }}
              className="relative">
              {/* Glow plate behind */}
              <div className="absolute inset-0 rounded-sm blur-3xl opacity-60" style={{ background: s.accent, transform: "translateZ(-100px) scale(0.85)" }}/>
              {/* Frame */}
              <div className="relative rounded-sm overflow-hidden border-2" style={{ borderColor: s.accent + "70", boxShadow: `0 30px 80px -20px ${s.accent}40, inset 0 0 0 1px rgba(255,255,255,0.05)` }}>
                <img src={s.image} alt="" className="w-full h-[60vh] object-cover" style={{ filter: "brightness(0.78) saturate(1.1)" }} />
                <div className="absolute inset-0 bg-gradient-to-tr from-black/60 via-transparent to-transparent"/>
                {/* Floating data card */}
                <motion.div
                  animate={{ y: [0, -10, 0] }} transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                  className="absolute top-5 left-5 px-3 py-2 backdrop-blur-md border rounded-sm"
                  style={{ background: "rgba(8,8,8,0.6)", borderColor: s.accent + "60" }}>
                  <p className="label-mono text-[10px]" style={{ color: s.accent }}>● LIVE</p>
                  <p className="font-mono text-2xl" style={{ color: s.accent }}>{i+1}/{SLIDES.length}</p>
                </motion.div>
                <div className="absolute bottom-5 left-5 right-5">
                  <p className="label-mono text-white/80">{s.eyebrow}</p>
                </div>
              </div>
              {/* Offset accent card */}
              <motion.div
                animate={{ y: [0, 10, 0] }} transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
                className="absolute -bottom-6 -right-6 w-32 h-32 rounded-sm flex items-center justify-center font-display text-5xl"
                style={{ background: s.accent, color: "#080808", transform: "rotate(-6deg)" }}>
                {String(i+1).padStart(2,"0")}
              </motion.div>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Carousel controls */}
        <div className="absolute bottom-10 left-6 md:left-12 right-6 md:right-12 flex items-center justify-between z-20">
          <div className="flex gap-2" data-testid="hero-carousel-nav">
            {SLIDES.map((sl, k) => (
              <button key={k} onClick={() => go(k)} data-testid={`hero-slide-${k}`}
                className="group flex flex-col gap-2 transition"
                style={{ opacity: k === i ? 1 : 0.4 }}>
                <span className="h-[2px] w-12 md:w-16 transition-all" style={{ background: k === i ? sl.accent : "#fff", width: k === i ? 64 : 32 }}/>
                <span className="label-mono text-[10px]" style={{ color: k === i ? sl.accent : "#A0A0A0" }}>0{k+1}</span>
              </button>
            ))}
          </div>
          <div className="hidden md:flex gap-3">
            <button onClick={() => go((i - 1 + SLIDES.length) % SLIDES.length)} className="w-12 h-12 border border-white/20 hover:border-white flex items-center justify-center label-mono">←</button>
            <button onClick={() => go((i + 1) % SLIDES.length)} className="w-12 h-12 border border-white/20 hover:border-white flex items-center justify-center label-mono">→</button>
          </div>
        </div>
      </div>
    </section>
  );
}
