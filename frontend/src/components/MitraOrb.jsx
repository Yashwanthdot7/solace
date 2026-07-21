import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "@/lib/api";
import { detectMood, MOOD_LABELS, MOOD_TO_UI } from "@/lib/moodDetect";
import { X, Send, Mic, MicOff, Volume2, VolumeX } from "lucide-react";
import VoiceWaveform from "@/components/VoiceWaveform";

const MAX_HISTORY = 8; // turns to send to backend

const UI_MOODS = [
  { id: "playful", label: "Playful", color: "#C8F04B" },
  { id: "warm",    label: "Warm",    color: "#F2A68A" },
  { id: "hype",    label: "Hype",    color: "#E8854A" },
  { id: "gentle",  label: "Gentle",  color: "#B8A8E8" },
];

export default function MitraOrb() {
  const [open, setOpen]           = useState(false);
  const [uiMood, setUiMood]       = useState("playful");  // manual override
  const [detectedMood, setDetected] = useState(null);     // auto-detected
  const [messages, setMessages]   = useState([
    { role: "mitra", text: "Hi, I'm Mitra. Tap the orb anytime. How are you feeling today?" },
  ]);
  const [input, setInput]   = useState("");
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking]   = useState(false);
  const [muted, setMuted]         = useState(false);
  const scroll = useRef(null);
  const rec    = useRef(null);

  // Auto-scroll chat
  useEffect(() => {
    if (scroll.current) scroll.current.scrollTop = scroll.current.scrollHeight;
  }, [messages]);

  // Initialise SpeechRecognition
  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;
    const r = new SR();
    r.lang = "en-IN";
    r.continuous = false;
    r.interimResults = true;
    r.onresult = (e) => {
      const t = Array.from(e.results).map(x => x[0].transcript).join("");
      setInput(t);
      if (e.results[0].isFinal) {
        setListening(false);
        setTimeout(() => sendMessage(t), 150);
      }
    };
    r.onerror = () => setListening(false);
    r.onend   = () => setListening(false);
    rec.current = r;
  }, []);

  /** Speak Mitra's reply using voice params from API response */
  const speak = useCallback((text, voiceParams = {}) => {
    if (muted || !window.speechSynthesis) return;
    const u = new SpeechSynthesisUtterance(text);
    u.rate  = voiceParams.rate  ?? 0.96;
    u.pitch = voiceParams.pitch ?? 1.08;

    const voices = window.speechSynthesis.getVoices();
    const pick = voices.find(v => v.lang === "en-IN" && /female|fem|woman|girl/i.test(v.name))
              || voices.find(v => v.lang === "en-IN")
              || voices.find(v => /samantha|google uk english female/i.test(v.name))
              || voices.find(v => v.lang?.startsWith("en"));
    if (pick) u.voice = pick;

    u.onstart = () => setSpeaking(true);
    u.onend   = () => setSpeaking(false);
    u.onerror = () => setSpeaking(false);
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  }, [muted]);

  const toggleMic = () => {
    if (!rec.current) {
      setMessages(m => [...m, { role: "mitra", text: "Your browser doesn't support voice input — please type instead." }]);
      return;
    }
    if (listening) { rec.current.stop(); setListening(false); }
    else {
      setInput("");
      try { rec.current.start(); setListening(true); }
      catch { setListening(false); }
    }
  };

  const sendMessage = async (overrideText) => {
    const msg = (overrideText ?? input).trim();
    if (!msg || loading) return;

    // ── Client-side mood detection ──────────────────────────────
    const detection = detectMood(msg);
    setDetected(detection);
    // Auto-update UI mood if confidence is reasonable
    if (detection.confidence > 0.2 && detection.mood !== "neutral") {
      setUiMood(MOOD_TO_UI[detection.mood] || uiMood);
    }

    const userMsg = { role: "user", text: msg, detectedMood: detection.mood };
    setMessages(m => [...m, userMsg]);
    setInput("");
    setLoading(true);

    // Build history for backend (last MAX_HISTORY turns, alternating user/mitra)
    const history = messages
      .slice(-MAX_HISTORY)
      .map(m => ({ role: m.role === "user" ? "user" : "model", text: m.text }));

    try {
      const r = await api.post("/mitra/chat", {
        message: msg,
        mood: uiMood,
        detected_mood: detection.mood,
        history,
      });

      const reply      = r.data.reply;
      const voiceParams = r.data.voice_params || detection.voice;

      setMessages(m => [...m, { role: "mitra", text: reply, mood: r.data.mood }]);
      speak(reply, voiceParams);
    } catch {
      setMessages(m => [...m, { role: "mitra", text: "I'm here, but lost connection for a moment. Try again?" }]);
    } finally {
      setLoading(false);
    }
  };

  const stopSpeak = () => {
    window.speechSynthesis?.cancel();
    setSpeaking(false);
  };

  // Resolved effective mood for display
  const effectiveMood = detectedMood?.mood && detectedMood.mood !== "neutral"
    ? detectedMood
    : null;

  return (
    <>
      {/* Floating orb */}
      <motion.button
        data-mitra
        data-testid="mitra-floating-orb"
        onClick={() => setOpen(true)}
        className="fixed bottom-8 right-8 z-40 w-16 h-16 md:w-20 md:h-20 rounded-full mitra-orb"
        animate={{ y: [0, -8, 0], scale: [1, 1.04, 1] }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        whileHover={{ scale: 1.12 }}
      >
        <span className="sr-only">Mitra</span>
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xl flex items-end md:items-center justify-center p-4"
            data-mitra data-testid="mitra-chat-overlay"
          >
            <motion.div
              initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 60, opacity: 0 }}
              className="w-full max-w-2xl bg-[#0F0D14] border border-[#B8A8E8]/30 rounded-sm overflow-hidden"
              data-mitra
            >
              {/* Header */}
              <div className="flex items-center justify-between p-5 border-b border-[#B8A8E8]/20">
                <div className="flex items-center gap-3">
                  <motion.div
                    animate={speaking ? { scale: [1, 1.15, 1] } : { scale: 1 }}
                    transition={{ duration: 0.6, repeat: speaking ? Infinity : 0 }}
                    className="w-10 h-10 rounded-full mitra-orb"
                  />
                  <div>
                    <p className="font-display text-2xl text-[#B8A8E8] leading-none">MITRA</p>
                    <div className="flex items-center gap-2 mt-1">
                      <p className="label-mono text-[#A0A0A0] text-xs">
                        {speaking ? "speaking…" : listening ? "listening…" : `en-IN · ${uiMood}`}
                      </p>
                      <VoiceWaveform active={speaking || listening} color={listening ? "#C8F04B" : "#B8A8E8"} />
                    </div>
                  </div>
                </div>

                {/* Auto-detected mood badge */}
                <AnimatePresence>
                  {effectiveMood && (
                    <motion.div
                      key={effectiveMood.mood}
                      initial={{ opacity: 0, scale: 0.8, y: -4 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border label-mono text-xs"
                      style={{
                        color: MOOD_LABELS[effectiveMood.mood]?.color,
                        borderColor: MOOD_LABELS[effectiveMood.mood]?.color + "40",
                        background: MOOD_LABELS[effectiveMood.mood]?.color + "12",
                      }}
                    >
                      <span>{MOOD_LABELS[effectiveMood.mood]?.emoji}</span>
                      <span>Mitra senses: {MOOD_LABELS[effectiveMood.mood]?.label}</span>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="flex items-center gap-2">
                  <button onClick={() => setMuted(!muted)} title={muted ? "Unmute" : "Mute"} data-testid="mitra-mute-btn"
                    className="text-[#A0A0A0] hover:text-white p-2">
                    {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
                  </button>
                  <button onClick={() => { stopSpeak(); setOpen(false); }} data-testid="mitra-close-btn" className="text-[#A0A0A0] hover:text-white p-2">
                    <X size={20} />
                  </button>
                </div>
              </div>

              {/* Manual mood selector */}
              <div className="flex gap-2 px-5 pt-4 overflow-x-auto no-scrollbar">
                <span className="label-mono text-[#444] text-xs self-center shrink-0">override:</span>
                {UI_MOODS.map((m) => (
                  <button key={m.id} onClick={() => { setUiMood(m.id); setDetected(null); }}
                    data-testid={`mitra-mood-${m.id}`}
                    className="label-mono px-3 py-1.5 border rounded-full whitespace-nowrap transition text-xs"
                    style={uiMood === m.id ? { background: m.color, color: "#080808", borderColor: m.color } : { borderColor: "#333", color: "#A0A0A0" }}>
                    {m.label}
                  </button>
                ))}
              </div>

              {/* Message thread */}
              <div ref={scroll} className="px-5 py-4 h-[50vh] overflow-y-auto no-scrollbar space-y-3">
                {messages.map((m, i) => (
                  <motion.div key={i} initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
                    className={`flex flex-col ${m.role === "user" ? "items-end" : "items-start"}`}>
                    <div className={`max-w-[80%] px-4 py-3 rounded-sm ${
                      m.role === "user"
                        ? "bg-[#C8F04B] text-black"
                        : "bg-[#1A1622] text-white border border-[#B8A8E8]/20"
                    }`}>
                      <p className="text-sm md:text-base leading-relaxed">{m.text}</p>
                    </div>
                    {/* Show detected mood tag on user messages */}
                    {m.role === "user" && m.detectedMood && m.detectedMood !== "neutral" && (
                      <span className="label-mono text-[10px] mt-1 px-2 py-0.5 rounded-full"
                        style={{
                          color: MOOD_LABELS[m.detectedMood]?.color,
                          background: MOOD_LABELS[m.detectedMood]?.color + "15",
                        }}>
                        {MOOD_LABELS[m.detectedMood]?.emoji} {MOOD_LABELS[m.detectedMood]?.label}
                      </span>
                    )}
                  </motion.div>
                ))}
                {loading && (
                  <div className="flex items-center gap-2 px-4 py-3 bg-[#1A1622] border border-[#B8A8E8]/20 rounded-sm w-fit">
                    {[0, 0.15, 0.3].map((d, i) => (
                      <motion.div key={i} className="w-2 h-2 bg-[#B8A8E8] rounded-full"
                        animate={{ y: [0, -6, 0] }} transition={{ duration: 0.7, delay: d, repeat: Infinity }} />
                    ))}
                  </div>
                )}
              </div>

              {/* Input bar */}
              <div className="p-5 border-t border-[#B8A8E8]/20 flex gap-2">
                <button onClick={toggleMic} data-testid="mitra-mic-btn"
                  className={`px-3 rounded-sm border transition ${listening ? "bg-[#C8F04B] text-black border-[#C8F04B]" : "border-[#333] text-[#B8A8E8] hover:border-[#B8A8E8]"}`}
                  title={listening ? "Stop" : "Hold to speak"}>
                  {listening ? <Mic size={18} className="animate-pulse" /> : <MicOff size={18} />}
                </button>
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                  placeholder={listening ? "Listening…" : "Tell Mitra anything…"}
                  data-testid="mitra-chat-input"
                  className="flex-1 bg-transparent border border-[#333] rounded-sm px-4 py-3 text-white placeholder:text-[#666] focus:outline-none focus:border-[#B8A8E8]"
                />
                <button onClick={() => sendMessage()} data-testid="mitra-send" id="mitra-send"
                  className="bg-[#B8A8E8] text-black px-4 rounded-sm hover:opacity-90 transition">
                  <Send size={18} />
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
