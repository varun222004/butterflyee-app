import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Copy, Check } from "lucide-react";
import Background from "@/components/atmosphere/Background";
import { useAuth } from "@/context/AuthContext";
import { api, formatApiError } from "@/lib/api";
import { magic } from "@/lib/magic";
import { ONBOARDING } from "@/constants/testIds";

export default function OnboardingPage() {
  const { user, fetchMe } = useAuth();
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState(user?.display_name || "");
  const [handle, setHandle] = useState(user?.handle || "");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  async function copyId() {
    try {
      await navigator.clipboard.writeText(user?.buddy_id || "");
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
      magic.whisper("Your Butterfly ID is on your clipboard.");
    } catch { /* noop */ }
  }

  async function save(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await api.put("/profile/me", {
        display_name: displayName || null,
        handle: handle || null,
      });
      await api.post("/profile/complete-onboarding");
      await fetchMe();
      magic.butterfly("Your world is ready.");
      navigate("/connect");
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setBusy(false);
    }
  }

  async function skip() {
    setBusy(true);
    try {
      await api.post("/profile/complete-onboarding");
      await fetchMe();
      navigate("/connect");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative min-h-screen text-[rgb(244,237,224)]">
      <Background />
      <div className="relative z-10 min-h-screen flex items-center justify-center px-4 py-16">
        <div className="w-full max-w-xl bf-glass rounded-3xl px-7 py-10 sm:px-12 sm:py-14 bf-fade-up">
          <div className="bf-eyebrow mb-6">A FEW QUIET DETAILS</div>
          <h1 className="bf-display text-4xl sm:text-5xl leading-[1.05] mb-3">
            Tell us <span className="bf-script text-[rgb(232,196,184)] text-5xl sm:text-6xl">who you are</span>
          </h1>
          <p className="text-sm text-[rgba(244,237,224,0.6)] mb-8 leading-relaxed">
            Your name is for your buddy. Your handle is so someone can find you.
            Your Butterfly ID will be with you forever.
          </p>

          {/* Buddy ID display */}
          <div className="mb-8 rounded-2xl bf-glass bf-glass-hover p-5">
            <div className="bf-eyebrow mb-2">Your Butterfly ID</div>
            <div className="flex items-center justify-between gap-3">
              <code
                data-testid={ONBOARDING.buddyId}
                className="bf-display text-2xl tracking-wider text-[rgb(232,196,184)]"
              >
                {user?.buddy_id}
              </code>
              <button
                type="button"
                onClick={copyId}
                className="bf-pill-btn !py-2 !px-4 text-xs flex items-center gap-2"
              >
                {copied ? <><Check size={14}/> Copied</> : <><Copy size={14}/> Copy</>}
              </button>
            </div>
            <p className="text-xs text-[rgba(244,237,224,0.5)] mt-3">
              Permanent. Unique. Yours forever.
            </p>
          </div>

          <form onSubmit={save} className="space-y-5">
            <div>
              <label className="bf-eyebrow block mb-2">Name</label>
              <input
                data-testid={ONBOARDING.displayNameInput}
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Sunshine"
                className="bf-input w-full rounded-xl px-4 py-3 text-sm"
              />
            </div>
            <div>
              <label className="bf-eyebrow block mb-2">Handle (changeable later)</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[rgba(244,237,224,0.4)]">@</span>
                <input
                  data-testid={ONBOARDING.handleInput}
                  value={handle}
                  onChange={(e) => setHandle(e.target.value.toLowerCase().replace(/^@/, "").replace(/[^a-z0-9_]/g, ""))}
                  placeholder="sunshine"
                  maxLength={20}
                  className="bf-input w-full rounded-xl pl-9 pr-4 py-3 text-sm"
                />
              </div>
              <p className="text-[11px] text-[rgba(244,237,224,0.4)] mt-2">3–20 lowercase letters, numbers, underscores.</p>
            </div>

            {error && <p className="text-xs text-[rgb(232,180,180)]">{error}</p>}

            <div className="flex flex-col sm:flex-row gap-3 pt-4">
              <button
                type="submit"
                disabled={busy}
                data-testid={ONBOARDING.saveButton}
                className="bf-pill-btn flex-1"
              >
                {busy ? "Saving…" : "Continue"}
              </button>
              <button
                type="button"
                onClick={skip}
                data-testid={ONBOARDING.skipButton}
                className="text-sm text-[rgba(244,237,224,0.55)] hover:text-[rgb(244,237,224)] py-3 transition-colors duration-500"
              >
                Skip for now
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
