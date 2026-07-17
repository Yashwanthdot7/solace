import Marquee from "react-fast-marquee";

const COLORS = {
  lime: { bg: "#C8F04B", text: "#080808" },
  sage: { bg: "#8BBF7A", text: "#080808" },
  coral: { bg: "#F2A68A", text: "#080808" },
  lavender: { bg: "#B8A8E8", text: "#080808" },
  ember: { bg: "#E8854A", text: "#080808" },
};

export default function MarqueeStrip({ color = "lime", text = "YOU ARE NOT ALONE", speed = 40 }) {
  const c = COLORS[color];
  return (
    <div
      className="py-4 overflow-hidden border-y border-black/10"
      style={{ background: c.bg, color: c.text }}
      data-testid={`marquee-strip-${color}`}
    >
      <Marquee gradient={false} speed={speed}>
        {Array(8).fill(0).map((_, i) => (
          <span key={i} className="font-mono uppercase tracking-[0.3em] text-lg md:text-2xl mx-12">
            ✦ {text}
          </span>
        ))}
      </Marquee>
    </div>
  );
}
