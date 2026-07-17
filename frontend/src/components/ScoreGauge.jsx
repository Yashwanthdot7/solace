import { motion } from "framer-motion";

export default function ScoreGauge({ score = 72, band = "green", size = 240 }) {
  const colors = { green: "#8BBF7A", amber: "#E8854A", red: "#F2A68A" };
  const stroke = colors[band] || "#8BBF7A";
  const r = (size - 20) / 2;
  const c = 2 * Math.PI * r;
  const dash = c * (score / 100);
  return (
    <div className="relative inline-block" data-testid="social-health-score-gauge">
      <svg width={size} height={size} className="score-ring">
        <circle cx={size/2} cy={size/2} r={r} stroke="#1A1A1A" strokeWidth="10" fill="none" />
        <motion.circle
          cx={size/2} cy={size/2} r={r} stroke={stroke} strokeWidth="10" fill="none"
          strokeLinecap="round" strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c - dash }}
          transition={{ duration: 1.4, ease: "easeOut" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <p className="font-mono text-7xl tabular-nums" style={{ color: stroke }} data-testid="social-health-score-value">{score}</p>
        <p className="label-mono mt-1" style={{ color: stroke }}>{band.toUpperCase()}</p>
      </div>
    </div>
  );
}
