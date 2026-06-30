/**
 * A small magical toast: "🦋 A butterfly brought you something."
 * Wraps sonner so we always speak in the same emotional tone.
 */
import { toast as sonnerToast } from "sonner";

const QUIET_OPTS = {
  position: "top-center",
  duration: 3800,
  className: "bf-toast",
  style: {
    background: "rgba(16, 22, 44, 0.85)",
    backdropFilter: "blur(18px)",
    border: "1px solid rgba(244, 237, 224, 0.12)",
    color: "rgb(244, 237, 224)",
    fontFamily: "'Manrope', sans-serif",
    fontWeight: 300,
    letterSpacing: "0.02em",
  },
};

export const magic = {
  whisper(message) {
    sonnerToast(message, QUIET_OPTS);
  },
  butterfly(message = "A butterfly brought you something.") {
    sonnerToast(`🦋  ${message}`, QUIET_OPTS);
  },
  success(message) {
    sonnerToast(`🦋  ${message}`, QUIET_OPTS);
  },
  error(message) {
    sonnerToast(message, { ...QUIET_OPTS, style: { ...QUIET_OPTS.style, borderColor: "rgba(220, 160, 160, 0.35)" } });
  },
};
