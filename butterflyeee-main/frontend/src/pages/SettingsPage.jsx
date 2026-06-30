import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { api, formatApiError } from "@/lib/api";
import { magic } from "@/lib/magic";
import { SETTINGS, LOGOUT } from "@/constants/testIds";

export default function SettingsPage() {
  const { user, buddy, fetchMe, fetchBuddy, logout } = useAuth();
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState(user?.display_name || "");
  const [handle, setHandle] = useState(user?.handle || "");
  const [cursorOn, setCursorOn] = useState(
    typeof window !== "undefined" && localStorage.getItem("butterfly-cursor") !== "off"
  );

  function toggleCursor(next) {
    setCursorOn(next);
    localStorage.setItem("butterfly-cursor", next ? "on" : "off");
    window.dispatchEvent(new Event("butterfly-cursor-toggle"));
    magic.whisper(next ? "The butterfly is following you." : "The cursor is quiet again.");
  }
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api.put("/profile/me", {
        display_name: displayName || null,
        handle: handle || null,
      });
      magic.success("Quietly saved.");
      await fetchMe();
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setBusy(false);
    }
  }

  async function unpair() {
    if (!confirm("Disconnect from your buddy? Your shared world will stop here.")) return;
    try {
      await api.delete("/buddies/me");
      magic.whisper("You are no longer connected.");
      await fetchBuddy();
      navigate("/connect");
    } catch (err) {
      magic.error(formatApiError(err));
    }
  }

  return (
    <section data-testid={SETTINGS.page} className="relative min-h-screen px-6 sm:px-16 lg:px-32 py-20 sm:py-28">
      <div className="max-w-xl bf-fade-up">
        <div className="bf-eyebrow mb-6">SETTINGS</div>
        <h1 className="bf-display text-4xl sm:text-5xl leading-[1.05] mb-3">
          A few <span className="bf-script text-[rgb(232,196,184)] text-5xl sm:text-6xl">small details.</span>
        </h1>
        <p className="text-sm text-[rgba(244,237,224,0.6)] mb-10 leading-relaxed">
          Your handle is changeable. Your Butterfly ID is not.
        </p>

        <div className="bf-glass rounded-2xl p-6 mb-8">
          <div className="bf-eyebrow mb-2">Your Butterfly ID</div>
          <code className="bf-display text-2xl tracking-wider text-[rgb(232,196,184)]">{user?.buddy_id}</code>
          <div className="text-xs text-[rgba(244,237,224,0.5)] mt-2">{user?.email}</div>
        </div>

        <form onSubmit={save} className="space-y-5">
          <div>
            <label className="bf-eyebrow block mb-2">Name</label>
            <input
              data-testid={SETTINGS.displayNameInput}
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="bf-input w-full rounded-xl px-4 py-3 text-sm"
            />
          </div>
          <div>
            <label className="bf-eyebrow block mb-2">Handle</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[rgba(244,237,224,0.4)]">@</span>
              <input
                data-testid={SETTINGS.handleInput}
                value={handle}
                onChange={(e) => setHandle(e.target.value.toLowerCase().replace(/^@/, "").replace(/[^a-z0-9_]/g, ""))}
                className="bf-input w-full rounded-xl pl-9 pr-4 py-3 text-sm"
                maxLength={20}
              />
            </div>
          </div>
          {error && <p className="text-xs text-[rgb(232,180,180)]">{error}</p>}
          <button type="submit" disabled={busy} data-testid={SETTINGS.saveButton} className="bf-pill-btn">
            {busy ? "Saving…" : "Save"}
          </button>
        </form>

        <div className="bf-glass rounded-2xl p-6 mt-10">
          <div className="bf-eyebrow mb-3">A small atmosphere</div>
          <label className="flex items-center justify-between gap-4 cursor-pointer">
            <div>
              <div className="bf-display text-xl leading-tight">Glittery butterfly cursor</div>
              <div className="text-xs text-[rgba(244,237,224,0.55)] mt-1">A small butterfly follows your cursor, with a soft glitter trail.</div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={cursorOn}
              data-testid="settings-cursor-toggle"
              onClick={() => toggleCursor(!cursorOn)}
              className={`relative w-11 h-6 rounded-full transition-colors duration-500 flex-shrink-0 ${cursorOn ? "bg-[rgba(232,196,184,0.65)]" : "bg-[rgba(244,237,224,0.15)]"}`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-[rgb(244,237,224)] transition-transform duration-500 ${cursorOn ? "translate-x-5" : "translate-x-0"}`}
              />
            </button>
          </label>
        </div>

        {buddy?.buddy && (
          <div className="bf-glass rounded-2xl p-6 mt-10">
            <div className="bf-eyebrow mb-2">Your buddy</div>
            <div className="bf-display text-2xl mb-1">{buddy.buddy.display_name || `@${buddy.buddy.handle}` || buddy.buddy.buddy_id}</div>
            <div className="text-xs text-[rgba(244,237,224,0.5)] mb-4">{buddy.buddy.buddy_id}</div>
            <button onClick={unpair} className="text-xs text-[rgba(232,180,180,0.85)] hover:text-[rgb(232,180,180)] transition-colors duration-500">
              disconnect quietly
            </button>
          </div>
        )}

        <div className="mt-12">
          <button
            onClick={() => logout().then(() => navigate("/auth/login"))}
            data-testid={LOGOUT.button}
            className="text-xs text-[rgba(244,237,224,0.5)] hover:text-[rgb(244,237,224)] transition-colors duration-500"
          >
            sign out
          </button>
        </div>
      </div>
    </section>
  );
}
