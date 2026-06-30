import { useEffect, useRef, useState, useCallback } from "react";

/**
 * A glittery butterfly cursor that follows the mouse with a soft sparkle trail.
 * - Disabled on touch devices (no cursor concept).
 * - Respects prefers-reduced-motion.
 * - Toggleable via localStorage 'butterfly-cursor' ('on'|'off').
 */
export default function ButterflyCursor() {
  const [enabled, setEnabled] = useState(() => {
    if (typeof window === "undefined") return false;
    if (window.matchMedia("(pointer: coarse)").matches) return false;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return false;
    const saved = localStorage.getItem("butterfly-cursor");
    return saved !== "off";
  });

  // Listen for cross-component toggles
  useEffect(() => {
    function onStorage(e) {
      if (e.key === "butterfly-cursor") {
        setEnabled(e.newValue !== "off");
      }
    }
    function onCustom() {
      const saved = localStorage.getItem("butterfly-cursor");
      setEnabled(saved !== "off");
    }
    window.addEventListener("storage", onStorage);
    window.addEventListener("butterfly-cursor-toggle", onCustom);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("butterfly-cursor-toggle", onCustom);
    };
  }, []);

  const butterflyRef = useRef(null);
  const target = useRef({ x: -100, y: -100 });
  const current = useRef({ x: -100, y: -100 });
  const lastSpawn = useRef(0);
  const angleRef = useRef(0);
  const sparkleRoot = useRef(null);

  const spawnSparkle = useCallback((x, y) => {
    const root = sparkleRoot.current;
    if (!root) return;
    const el = document.createElement("span");
    el.className = "bf-sparkle";
    const dx = (Math.random() - 0.5) * 26;
    const dy = (Math.random() - 0.5) * 26 + 6;
    const rot = (Math.random() - 0.5) * 90;
    const size = 4 + Math.random() * 4;
    el.style.setProperty("--dx", `${dx}px`);
    el.style.setProperty("--dy", `${dy}px`);
    el.style.setProperty("--rot", `${rot}deg`);
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    el.style.width = `${size}px`;
    el.style.height = `${size}px`;
    root.appendChild(el);
    setTimeout(() => el.remove(), 900);
  }, []);

  useEffect(() => {
    if (!enabled) {
      document.documentElement.classList.remove("bf-cursor-on");
      return;
    }
    document.documentElement.classList.add("bf-cursor-on");

    let raf;
    function onMove(e) {
      target.current.x = e.clientX;
      target.current.y = e.clientY;
    }

    function tick(now) {
      // Smooth follow with critically-damped lerp
      const dx = target.current.x - current.current.x;
      const dy = target.current.y - current.current.y;
      current.current.x += dx * 0.18;
      current.current.y += dy * 0.18;

      // Rotate the butterfly slightly towards travel direction
      if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) {
        const targetAngle = Math.atan2(dy, dx) * (180 / Math.PI) + 90;
        // shortest-path interpolation
        let diff = targetAngle - angleRef.current;
        while (diff > 180) diff -= 360;
        while (diff < -180) diff += 360;
        angleRef.current += diff * 0.12;
      }

      const el = butterflyRef.current;
      if (el) {
        el.style.transform = `translate3d(${current.current.x - 14}px, ${current.current.y - 12}px, 0) rotate(${angleRef.current}deg)`;
      }

      // Sparkle spawning
      const speed = Math.hypot(dx, dy);
      const interval = speed > 4 ? 36 : 120;
      if (now - lastSpawn.current > interval) {
        lastSpawn.current = now;
        spawnSparkle(current.current.x, current.current.y);
      }

      raf = requestAnimationFrame(tick);
    }

    window.addEventListener("mousemove", onMove, { passive: true });
    raf = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener("mousemove", onMove);
      cancelAnimationFrame(raf);
      document.documentElement.classList.remove("bf-cursor-on");
    };
  }, [enabled, spawnSparkle]);

  if (!enabled) return null;

  return (
    <>
      <div ref={sparkleRoot} className="bf-sparkle-root" aria-hidden />
      <div ref={butterflyRef} className="bf-cursor-butterfly" aria-hidden>
        <svg width="28" height="26" viewBox="0 0 28 26" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <radialGradient id="bfwing" cx="50%" cy="40%" r="65%">
              <stop offset="0%" stopColor="rgba(255, 230, 240, 0.95)"/>
              <stop offset="50%" stopColor="rgba(232, 196, 184, 0.85)"/>
              <stop offset="100%" stopColor="rgba(180, 140, 170, 0.55)"/>
            </radialGradient>
            <filter id="bfglow">
              <feGaussianBlur stdDeviation="0.8" result="b"/>
              <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
            </filter>
          </defs>
          <g filter="url(#bfglow)" className="bf-cursor-wings">
            <path d="M14 13c-1.6-4-4.4-6.6-7.4-7.2C3.6 5.2 1.8 6.8 1.8 9S3.4 12.8 5.8 13.8c2.4 1.2 6 .6 8.2-1z" fill="url(#bfwing)"/>
            <path d="M14 13c1.6-4 4.4-6.6 7.4-7.2 3-.6 4.8 1 4.8 3.2s-1.6 3.8-4 4.8c-2.4 1.2-6 .6-8.2-.8z" fill="url(#bfwing)"/>
            <path d="M14 13c-1.2 2.6-3.2 4.6-5.4 5.2-1.8.6-3-.6-3-2.2 0-2 2-3.4 4.4-3.6 1.8-.2 3 .2 4 .6z" fill="url(#bfwing)" opacity="0.85"/>
            <path d="M14 13c1.2 2.6 3.2 4.6 5.4 5.2 1.8.6 3-.6 3-2.2 0-2-2-3.4-4.4-3.6-1.8-.2-3 .2-4 .6z" fill="url(#bfwing)" opacity="0.85"/>
          </g>
          <rect x="13.5" y="3.5" width="1" height="16" rx="0.5" fill="rgba(120,80,90,0.85)"/>
          <circle cx="14" cy="3.6" r="1.2" fill="rgba(180,120,140,0.95)"/>
        </svg>
      </div>
    </>
  );
}
