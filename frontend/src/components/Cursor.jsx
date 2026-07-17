import { useEffect, useRef } from "react";

export default function LaggingCursor() {
  const dot = useRef(null);
  const ring = useRef(null);
  const pos = useRef({ x: 0, y: 0, rx: 0, ry: 0 });

  useEffect(() => {
    const onMove = (e) => {
      pos.current.x = e.clientX;
      pos.current.y = e.clientY;
      if (dot.current) {
        dot.current.style.transform = `translate(${e.clientX - 3}px, ${e.clientY - 3}px)`;
      }
      const t = e.target;
      if (ring.current) {
        if (t.closest?.("[data-mitra]")) ring.current.classList.add("lavender");
        else ring.current.classList.remove("lavender");
      }
    };
    const animate = () => {
      pos.current.rx += (pos.current.x - pos.current.rx) * 0.15;
      pos.current.ry += (pos.current.y - pos.current.ry) * 0.15;
      if (ring.current) {
        ring.current.style.transform = `translate(${pos.current.rx - 16}px, ${pos.current.ry - 16}px)`;
      }
      requestAnimationFrame(animate);
    };
    window.addEventListener("mousemove", onMove);
    animate();
    return () => window.removeEventListener("mousemove", onMove);
  }, []);

  return (
    <>
      <div ref={dot} className="cursor-dot" data-testid="custom-lagging-cursor" />
      <div ref={ring} className="cursor-ring" />
    </>
  );
}
