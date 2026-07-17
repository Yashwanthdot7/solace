import { motion } from "framer-motion";

export default function VoiceWaveform({ active, color = "#B8A8E8" }) {
  const bars = [0, 1, 2, 3, 4, 5, 6];
  return (
    <div className="flex items-center gap-1 h-8">
      {bars.map((i) => (
        <motion.span
          key={i}
          className="w-1 rounded-full"
          style={{ background: color }}
          animate={active ? { height: ["20%", "100%", "40%", "80%", "20%"] } : { height: "20%" }}
          transition={active ? { duration: 0.8, repeat: Infinity, delay: i * 0.08, ease: "easeInOut" } : {}}
        />
      ))}
    </div>
  );
}
