import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "@/lib/api";
import { X, Send, Mic, MicOff, Volume2, VolumeX } from "lucide-react";
import VoiceWaveform from "@/components/VoiceWaveform";

const MOODS = [
  { id: "playful", label: "Playful", color: "#C8F04B" },
  { id: "warm", label: "Warm", color: "#F2A68A" },
  { id: "hype", label: "Hype", color: "#E8854A" },
  { id: "gentle", label: "Gentle", color: "#B8A8E8" },
];

export default function MitraOrb() {
  const [open, setOpen] = useState(false);
  const [mood, setMood] = useState("playful");
  const [messages, setMessages] = useState([
    { role: "mitra", text: "Hi, I'm Mitra. Tap the orb anytime. How are you feeling today?" },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [muted, setMuted] = useState(false);
  const scroll = useRef(null);
  const rec = useRef(null);

  useEffect(() => {
    if (scroll.current) scroll.current.scrollTop = scroll.current.scrollHeight;
  }, [messages]);

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
    r.onend = () => setListening(false);
    rec.current = r;
  }, []);

  const speak = (text) => {
    if (muted || !window.speechSynthesis) return;
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 0.96; u.pitch = 1.08;
    const voices = window.speechSynthesis.getVoices();
    const ind = voices.find(v => v.lang === "en-IN" && /female|fem|woman|girl/i.test(v.name))
             || voices.find(v => v.lang === "en-IN")
             || voices.find(v => /female|samantha|google.*female|google uk english female/i.test(v.name))
             || voices.find(v => v.lang?.startsWith("en"));
    if (ind) u.voice = ind;
    u.onstart = () => setSpeaking(true);
    u.onend = () => setSpeaking(false);
    u.onerror = () => setSpeaking(false);
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  };

  const toggleMic = () => {
    if (!rec.current) {
      setMessages((m) => [...m, { role: "mitra", text: "Your browser doesn't support voice input — please type instead." }]);
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
    setMessages((m) => [...m, { role: "user", text: msg }]);
    setInput("");
    setLoading(true);
    try {
      const r = await api.post("/mitra/chat", { message: msg, mood });
      setMessages((m) => [...m, { role: "mitra", text: r.data.reply }]);
      speak(r.data.reply);
    } catch {
      setMessages((m) => [...m, { role: "mitra", text: "I'm here, but lost connection for a moment. Try again?" }]);
    } finally { setLoading(false); }
  };

  const stopSpeak = () => {
    window.speechSynthesis?.cancel();
    setSpeaking(false);
  };

  return (
    <>
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
              <div className="flex items-center justify-between p-5 border-b border-[#B8A8E8]/20">
                <div className="flex items-center gap-3">
                  <motion.div
                    animate={speaking ? { scale: [1, 1.15, 1] } : { scale: 1 }}
                    transition={{ duration: 0.6, repeat: speaking ? Infinity : 0 }}
                    className="w-10 h-10 rounded-full mitra-orb" />
                  <div>
                    <p className="font-display text-2xl text-[#B8A8E8] leading-none">MITRA</p>
                    <div className="flex items-center gap-2 mt-1">
                      <p className="label-mono text-[#A0A0A0]">{speaking ? "speaking…" : listening ? "listening…" : `en-IN · ${mood}`}</p>
                      <VoiceWaveform active={speaking || listening} color={listening ? "#C8F04B" : "#B8A8E8"} />
                    </div>
                  </div>
                </div>
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

              <div className="flex gap-2 px-5 pt-4 overflow-x-auto no-scrollbar">
                {MOODS.map((m) => (
                  <button key={m.id} onClick={() => setMood(m.id)}
                    data-testid={`mitra-mood-${m.id}`}
                    className={`label-mono px-3 py-1.5 border rounded-full whitespace-nowrap transition ${mood === m.id ? "border-white text-white" : "border-[#333] text-[#A0A0A0]"}`}
                    style={mood === m.id ? { background: m.color, color: "#080808", borderColor: m.color } : {}}>
                    {m.label}
                  </button>
                ))}
              </div>

              <div ref={scroll} className="px-5 py-4 h-[50vh] overflow-y-auto no-scrollbar space-y-3">
                {messages.map((m, i) => (
                  <motion.div key={i} initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
                    className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[80%] px-4 py-3 rounded-sm ${m.role === "user" ? "bg-[#C8F04B] text-black" : "bg-[#1A1622] text-white border border-[#B8A8E8]/20"}`}>
                      <p className="text-sm md:text-base leading-relaxed">{m.text}</p>
                    </div>
                  </motion.div>
                ))}
                {loading && <p className="label-mono text-[#B8A8E8]">Mitra is thinking…</p>}
              </div>

              <div className="p-5 border-t border-[#B8A8E8]/20 flex gap-2">
                <button onClick={toggleMic} data-testid="mitra-mic-btn"
                  className={`px-3 rounded-sm border transition ${listening ? "bg-[#C8F04B] text-black border-[#C8F04B]" : "border-[#333] text-[#B8A8E8] hover:border-[#B8A8E8]"}`}
                  title={listening ? "Stop" : "Hold to speak"}>
                  {listening ? <Mic size={18} className="animate-pulse" /> : <MicOff size={18} />}
                </button>
                <input
                  value={input} onChange={(e) => setInput(e.target.value)}
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
