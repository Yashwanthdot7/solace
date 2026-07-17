import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const WORDS = ["SOLACE", "BENGALURU", "TOGETHER", "BREATHE", "YOU MATTER"];

export default function LoadingScreen({ onDone }) {
  const [idx, setIdx] = useState(0);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const t = setInterval(() => setIdx((i) => i + 1), 380);
    const finish = setTimeout(() => {
      clearInterval(t);
      setDone(true);
      setTimeout(() => onDone?.(), 900);
    }, WORDS.length * 380 + 400);
    return () => { clearInterval(t); clearTimeout(finish); };
  }, [onDone]);

  return (
    <AnimatePresence>
      {!done && (
        <motion.div
          exit={{ y: "-100%" }}
          transition={{ duration: 0.8, ease: [0.76, 0, 0.24, 1] }}
          className="fixed inset-0 z-[100] bg-[#080808] flex flex-col items-center justify-center overflow-hidden"
        >
          {/* big rolling word */}
          <div className="relative h-[18vw] md:h-[14vw] overflow-hidden flex items-center px-6 w-full justify-center">
            <AnimatePresence mode="wait">
              <motion.span
                key={idx}
                initial={{ y: "100%", opacity: 0 }}
                animate={{ y: "0%", opacity: 1 }}
                exit={{ y: "-100%", opacity: 0 }}
                transition={{ duration: 0.4, ease: [0.76, 0, 0.24, 1] }}
                className="font-display text-[18vw] md:text-[14vw] leading-none tracking-tight text-white whitespace-nowrap"
              >
                {WORDS[idx % WORDS.length]}
              </motion.span>
            </AnimatePresence>
          </div>

          {/* progress dash */}
          <motion.div
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ duration: WORDS.length * 0.38, ease: "linear" }}
            style={{ originX: 0 }}
            className="mt-12 h-[2px] w-64 bg-[#C8F04B]"
          />

          <motion.p
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}
            className="mt-6 label-mono text-[#A0A0A0]">
            / Bengaluru · Loading your neighbourhood
          </motion.p>

          {/* corner stamps */}
          <div className="absolute top-6 left-6 label-mono text-[#C8F04B]">SOLACE/v1.0</div>
          <div className="absolute top-6 right-6 label-mono text-[#A0A0A0]">EST. 2026</div>
          <div className="absolute bottom-6 left-6 label-mono text-[#A0A0A0]">↗ YOU ARE NOT ALONE</div>
          <div className="absolute bottom-6 right-6 label-mono text-[#A0A0A0]">©</div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
