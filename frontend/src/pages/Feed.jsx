import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Heart, Flag } from "lucide-react";
import { toast } from "sonner";
import { HelplineDialog } from "@/components/HelplineCard";
import { motion } from "framer-motion";

const ROLE_COLOR = { elder: "#F2A68A", youth: "#C8F04B", community: "#8BBF7A", guardian: "#E8854A" };
const CATEGORIES = ["general", "recipe", "event", "hobby", "fitness"];
const MAX_LEN = 1000;

export default function Feed() {
  const [posts, setPosts] = useState([]);
  const [text, setText] = useState("");
  const [cat, setCat] = useState("general");
  const [help, setHelp] = useState(null); // helpline dialog after a post
  const [reported, setReported] = useState({});

  const load = () => api.get("/feed").then((r) => setPosts(r.data));
  useEffect(() => { load(); }, []);

  const submit = async () => {
    if (!text.trim()) return;
    try {
      const r = await api.post("/feed", { text: text.slice(0, MAX_LEN), category: cat });
      setText(""); load();
      if (r.data.held) {
        setHelp({
          title: "We're here for you",
          message: "Your post has been kept private for now. It sounds like you're going through a lot. Please reach out to someone who can help.",
        });
      } else if (r.data.show_helpline) {
        setHelp({ title: "Thank you for sharing", message: "If things feel heavy, support is a call away." });
      }
    } catch {
      toast.error("Could not post. Please try again.");
    }
  };

  const report = async (id) => {
    if (reported[id]) return;
    try {
      await api.post(`/feed/${id}/report`, { reason: "" });
      setReported((r) => ({ ...r, [id]: true }));
      toast.success("Thanks for letting us know. We'll take a look.");
    } catch {
      toast.error("Could not send the report. Please try again.");
    }
  };

  const heart = async (id) => {
    await api.post(`/feed/${id}/heart`);
    setPosts((p) => p.map(x => x.id === id ? { ...x, hearts: (x.hearts||0)+1 } : x));
  };

  return (
    <div className="px-6 md:px-12 py-12 max-w-7xl mx-auto">
      <p className="label-mono text-[#A0A0A0]">/ community feed</p>
      <h1 className="font-display text-6xl md:text-7xl mb-10 mt-2">THE NEIGHBOURHOOD.</h1>

      <div className="grid md:grid-cols-12 gap-6">
        <div className="md:col-span-8 space-y-5">
          <div className="p-5 border border-[#1A1A1A] rounded-sm">
            <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Share something kind…" maxLength={MAX_LEN}
              data-testid="feed-new-post-input"
              className="w-full bg-transparent border border-[#222] rounded-sm p-3 outline-none focus:border-[#C8F04B] resize-none" rows="2"/>
            <p className="text-right text-xs text-[#666] mt-1">{text.length}/{MAX_LEN}</p>
            <div className="flex justify-between mt-2 gap-2 flex-wrap">
              <div className="flex gap-1.5">
                {CATEGORIES.map(c => (
                  <button key={c} onClick={() => setCat(c)}
                    className={`label-mono px-2.5 py-1 rounded-sm ${cat === c ? "bg-[#C8F04B] text-black" : "border border-[#222] text-[#A0A0A0]"}`}>
                    {c}
                  </button>
                ))}
              </div>
              <button onClick={submit} data-testid="feed-post-btn" className="bg-[#C8F04B] text-black px-4 py-1 label-mono">POST +3</button>
            </div>
          </div>

          {posts.map((p, i) => (
            <motion.div key={p.id} initial={{ y: 20, opacity: 0 }} whileInView={{ y: 0, opacity: 1 }} viewport={{ once: true }}
              data-testid="community-feed-post"
              whileHover={{ y: -3 }}
              className={`relative overflow-hidden border border-[#1A1A1A] hover:border-white/30 rounded-sm transition ${i % 3 === 0 ? 'md:ml-8' : i % 3 === 1 ? '' : 'md:mr-8'}`}>
              {p.image && (
                <div className="relative h-44 overflow-hidden">
                  <img src={p.image} alt="" className="w-full h-full object-cover" style={{ filter: "brightness(0.7)" }}/>
                  <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent"/>
                  <span className="absolute top-3 right-3 label-mono px-2 py-1" style={{ background: ROLE_COLOR[p.role] || "#C8F04B", color: "#080808" }}>{p.category}</span>
                </div>
              )}
              <div className="p-6">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center font-display text-xl"
                    style={{ background: ROLE_COLOR[p.role] || "#C8F04B", color: "#080808" }}>{p.author?.[0]}</div>
                  <div>
                    <p className="font-sans">{p.author}</p>
                    <p className="label-mono text-[10px]" style={{ color: ROLE_COLOR[p.role] }}>{p.role}</p>
                  </div>
                </div>
                <p className="text-lg leading-relaxed">{p.text}</p>
                <div className="mt-4 flex items-center gap-4">
                  <button onClick={() => heart(p.id)} data-testid="community-post-heart-btn"
                    className="flex items-center gap-2 label-mono text-[#A0A0A0] hover:text-[#F2A68A] transition">
                    <Heart size={16} fill={(p.hearts||0) > 0 ? "#F2A68A" : "none"} stroke={(p.hearts||0) > 0 ? "#F2A68A" : "currentColor"} /> {p.hearts || 0}
                  </button>
                  <span className="label-mono text-[#666]">+3 pts to {p.author?.split(" ")[0]}</span>
                  {p.user_id && (
                    <button onClick={() => report(p.id)} data-testid="community-post-report-btn"
                      disabled={reported[p.id]}
                      className="ml-auto flex items-center gap-1.5 label-mono text-[#666] hover:text-[#F2A68A] transition disabled:opacity-50">
                      <Flag size={14} /> {reported[p.id] ? "Reported" : "Report"}
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        <HelplineDialog open={!!help} onClose={() => setHelp(null)} title={help?.title} message={help?.message} />

        <aside className="md:col-span-4 space-y-4">
          <div className="p-6 border border-[#1A1A1A] rounded-sm" data-testid="online-now">
            <p className="label-mono text-[#8BBF7A] mb-3">/ online now · 142</p>
            {["Lakshmi A.", "Arjun K.", "Venkat Sir", "Priya M.", "Saroja Aunty"].map((n) => (
              <div key={n} className="flex items-center gap-2 py-1.5">
                <span className="w-2 h-2 rounded-full bg-[#8BBF7A] animate-pulse" />
                <span className="text-sm">{n}</span>
              </div>
            ))}
          </div>
          <div className="p-6 border border-[#1A1A1A] rounded-sm" data-testid="trending-sidebar">
            <p className="label-mono text-[#C8F04B] mb-3">/ trending</p>
            {["#TriviaThursday", "#RagiRecipes", "#CubbonRun", "#HarmoniumDaily", "#BingoSaturday"].map((t) => (
              <p key={t} className="py-1 text-sm hover:text-[#C8F04B]">{t}</p>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}
