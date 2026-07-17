import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Send } from "lucide-react";

export default function Chat() {
  const { user } = useAuth();
  const [msgs, setMsgs] = useState([]);
  const [text, setText] = useState("");
  useEffect(() => { api.get("/chat/messages").then(r => setMsgs(r.data)); }, []);

  const send = () => {
    if (!text.trim()) return;
    setMsgs((m) => [...m, { id: Date.now()+"", author: user?.name || "You", text, ts: new Date().toISOString() }]);
    setText("");
  };

  return (
    <div className="px-6 md:px-12 py-12 max-w-4xl mx-auto">
      <p className="label-mono text-[#A0A0A0]">/ neighbourhood chat · Indiranagar · 60+</p>
      <h1 className="font-display text-5xl md:text-6xl mb-6 mt-2">THE GROUP CHAT.</h1>

      <div className="border border-[#1A1A1A] rounded-sm" data-testid="chat-window">
        <div className="p-5 space-y-4 h-[60vh] overflow-y-auto no-scrollbar">
          {msgs.map((m) => (
            <div key={m.id}>
              {m.ai_notice && (
                <div className="mb-2 p-3 border border-[#B8A8E8]/30 bg-[#B8A8E8]/5 rounded-sm" data-testid="chat-inline-ai-notice">
                  <p className="label-mono text-[#B8A8E8]">⟡ mitra notice</p>
                  <p className="text-sm mt-1 text-[#B8A8E8]">{m.author} has mentioned feeling low 3 times this week. A warm response from the group could help — guardian quietly notified.</p>
                </div>
              )}
              <div className="flex gap-3">
                <div className="w-10 h-10 rounded-full bg-[#C8F04B]/20 flex items-center justify-center font-display">{m.author?.[0]}</div>
                <div>
                  <p className="label-mono text-[#A0A0A0]">{m.author}</p>
                  <p className="mt-1">{m.text}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="p-4 border-t border-[#1A1A1A] flex gap-2">
          <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key==='Enter' && send()}
            placeholder="Type a message…"
            className="flex-1 bg-transparent border border-[#333] rounded-sm px-4 py-2 outline-none focus:border-[#C8F04B]" />
          <button onClick={send} className="bg-[#C8F04B] text-black px-4 rounded-sm"><Send size={16} /></button>
        </div>
      </div>
    </div>
  );
}
