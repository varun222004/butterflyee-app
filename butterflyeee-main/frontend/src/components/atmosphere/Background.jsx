import { useMemo } from "react";

function ButterflySvg() {
  return (
    <svg width="22" height="18" viewBox="0 0 22 18" fill="none" xmlns="http://www.w3.org/2000/svg">
      <g className="bf-wing-flutter">
        <path
          d="M11 9c-1.2-3-3.2-5-5.5-5.5C3 3 1.5 4.5 1.5 6.5S3 10 5 11c2 1 5 .5 6-2z"
          fill="currentColor" opacity="0.85"
        />
        <path
          d="M11 9c1.2-3 3.2-5 5.5-5.5C19 3 20.5 4.5 20.5 6.5S19 10 17 11c-2 1-5 .5-6-2z"
          fill="currentColor" opacity="0.85"
        />
        <path
          d="M11 9c-.9 2-2.4 3.5-4 4-1.5.5-2.5-.5-2.5-1.8 0-1.6 1.5-2.8 3.5-3 1.5-.2 2.5.3 3 .8z"
          fill="currentColor" opacity="0.6"
        />
        <path
          d="M11 9c.9 2 2.4 3.5 4 4 1.5.5 2.5-.5 2.5-1.8 0-1.6-1.5-2.8-3.5-3-1.5-.2-2.5.3-3 .8z"
          fill="currentColor" opacity="0.6"
        />
      </g>
      <rect x="10.6" y="2.5" width="0.8" height="12" rx="0.4" fill="currentColor" />
      <circle cx="11" cy="2.5" r="0.9" fill="currentColor" />
    </svg>
  );
}

const SEED_POSITIONS = [
  { top: "18%", left: "22%", dur: "26s", delay: "0s", size: 0.9 },
  { top: "32%", left: "78%", dur: "30s", delay: "-6s", size: 1.1 },
  { top: "58%", left: "44%", dur: "34s", delay: "-12s", size: 0.7 },
  { top: "70%", left: "82%", dur: "28s", delay: "-3s", size: 0.95 },
  { top: "12%", left: "65%", dur: "32s", delay: "-9s", size: 0.75 },
  { top: "82%", left: "18%", dur: "36s", delay: "-15s", size: 1.0 },
];

export default function Background({ showMoon = true, butterflyCount = 6 }) {
  const flies = useMemo(() => SEED_POSITIONS.slice(0, butterflyCount), [butterflyCount]);

  return (
    <>
      <div className="bf-sky" />
      <div className="bf-stars" />
      {showMoon && (
        <div
          className="bf-moon bf-glow-pulse"
          style={{ top: "8%", right: "10%" }}
          aria-hidden
        />
      )}
      {flies.map((f, i) => (
        <div
          key={i}
          className="bf-butterfly bf-butterfly-anim"
          style={{
            top: f.top,
            left: f.left,
            transform: `scale(${f.size})`,
            ["--dur"]: f.dur,
            animationDelay: f.delay,
          }}
          aria-hidden
        >
          <ButterflySvg />
        </div>
      ))}
      <div className="bf-grain" />
    </>
  );
}
