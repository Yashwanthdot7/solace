import { useEffect, useState } from "react";
import { api } from "@/lib/api";

const COLORS = { lime: "#C8F04B", coral: "#F2A68A", sage: "#8BBF7A", ember: "#E8854A", lavender: "#B8A8E8" };

export default function Events() {
  const [events, setEvents] = useState([]);
  const [rsvped, setRsvped] = useState({});
  useEffect(() => { api.get("/events").then(r => setEvents(r.data)); }, []);

  const rsvp = async (id) => {
    await api.post(`/events/${id}/rsvp`);
    setRsvped((r) => ({ ...r, [id]: true }));
  };

  return (
    <div className="px-6 md:px-12 py-12 max-w-7xl mx-auto">
      <p className="label-mono text-[#A0A0A0]">/ neighbourhood noticeboard</p>
      <h1 className="font-display text-6xl md:text-7xl mb-10 mt-2">WHAT'S HAPPENING.</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {events.map((e, i) => {
          const c = COLORS[e.color] || COLORS.lime;
          return (
            <div key={e.id} data-testid="event-noticeboard-poster"
              className="p-6 rounded-sm flex flex-col"
              style={{ background: c, color: "#080808", transform: `rotate(${(i % 2 ? -1 : 1) * 0.5}deg)` }}>
              <p className="label-mono">{e.audience.toUpperCase()}</p>
              <p className="font-display text-3xl md:text-4xl mt-3 leading-tight">{e.title.toUpperCase()}</p>
              <div className="mt-auto pt-6 space-y-1">
                <p className="label-mono">📍 {e.venue}</p>
                <p className="label-mono">🗓 {e.date}</p>
                <p className="label-mono">💸 {e.price}</p>
              </div>
              <button onClick={() => rsvp(e.id)} data-testid={`rsvp-${e.id}`}
                className="mt-4 py-2 bg-black text-white label-mono hover:bg-[#080808]">
                {rsvped[e.id] ? "✓ RSVP'D +10" : "RSVP →"}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
