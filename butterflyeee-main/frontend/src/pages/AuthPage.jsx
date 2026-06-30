import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import Background from "@/components/atmosphere/Background";
import { useAuth } from "@/context/AuthContext";
import { magic } from "@/lib/magic";
import { LOGIN, REGISTER } from "@/constants/testIds";

export default function AuthPage({ mode = "login" }) {
  const { login, register, fetchBuddy } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState(mode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleLogin(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    const r = await login(email, password);
    setBusy(false);
    if (!r.ok) { setError(r.error); return; }
    magic.butterfly("Welcome back.");
    await fetchBuddy();
    navigate(r.user?.onboarded ? "/" : "/onboarding");
  }

  async function handleRegister(e) {
    e.preventDefault();
    setError("");
    if (password.length < 6) { setError("Password should be at least 6 characters."); return; }
    if (password !== confirm) { setError("Passwords don't match."); return; }
    setBusy(true);
    const r = await register(email, password, displayName);
    setBusy(false);
    if (!r.ok) { setError(r.error); return; }
    magic.butterfly("Your quiet little world is open.");
    navigate("/onboarding");
  }

  return (
    <div className="relative min-h-screen text-[rgb(244,237,224)]">
      <Background showMoon butterflyCount={4} />

      <div className="relative z-10 min-h-screen flex items-center justify-center px-4 py-16">
        <div className="w-full max-w-md bf-glass rounded-3xl px-7 py-10 sm:px-10 sm:py-12 bf-fade-up">
          <div className="bf-eyebrow mb-6">A SMALL PRIVATE WORLD</div>
          <h1 className="bf-display text-4xl sm:text-5xl leading-[1.05] mb-2">
            {tab === "login" ? (
              <>Step <span className="bf-script text-[rgb(232,196,184)] text-5xl sm:text-6xl">inside.</span></>
            ) : (
              <>Begin <span className="bf-script text-[rgb(232,196,184)] text-5xl sm:text-6xl">quietly.</span></>
            )}
          </h1>
          <p className="text-sm text-[rgba(244,237,224,0.6)] mb-8 leading-relaxed">
            {tab === "login"
              ? "Welcome back. Sign in with the email you keep close."
              : "Create an account. We'll give you a Butterfly ID so someone can find you."}
          </p>

          <div className="flex gap-2 mb-8">
            <button
              type="button"
              onClick={() => { setTab("login"); setError(""); }}
              className="bf-world-tab flex-1 text-center"
              data-active={tab === "login"}
            >
              Sign in
            </button>
            <button
              type="button"
              onClick={() => { setTab("register"); setError(""); }}
              className="bf-world-tab flex-1 text-center"
              data-active={tab === "register"}
            >
              Create account
            </button>
          </div>

          {tab === "login" ? (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="bf-eyebrow block mb-2">Email</label>
                <input
                  data-testid={LOGIN.emailInput}
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="bf-input w-full rounded-xl px-4 py-3 text-sm"
                  placeholder="you@quiet.world"
                  autoComplete="email"
                />
              </div>
              <div>
                <label className="bf-eyebrow block mb-2">Password</label>
                <input
                  data-testid={LOGIN.passwordInput}
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="bf-input w-full rounded-xl px-4 py-3 text-sm"
                  placeholder="••••••••"
                  autoComplete="current-password"
                />
              </div>
              {error && <p className="text-xs text-[rgb(232,180,180)]">{error}</p>}
              <button
                type="submit"
                disabled={busy}
                data-testid={LOGIN.submitButton}
                className="bf-pill-btn w-full mt-2"
              >
                {busy ? "Opening…" : "Step inside"}
              </button>
              <p className="text-xs text-[rgba(244,237,224,0.5)] text-center pt-3">
                New here?{" "}
                <button
                  type="button"
                  onClick={() => setTab("register")}
                  data-testid={LOGIN.registerLink}
                  className="underline-offset-2 hover:underline text-[rgb(232,196,184)]"
                >
                  Create an account
                </button>
              </p>
            </form>
          ) : (
            <form onSubmit={handleRegister} className="space-y-4">
              <div>
                <label className="bf-eyebrow block mb-2">Name (optional)</label>
                <input
                  data-testid={REGISTER.nameInput}
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="bf-input w-full rounded-xl px-4 py-3 text-sm"
                  placeholder="What should we call you?"
                  autoComplete="name"
                />
              </div>
              <div>
                <label className="bf-eyebrow block mb-2">Email</label>
                <input
                  data-testid={REGISTER.emailInput}
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="bf-input w-full rounded-xl px-4 py-3 text-sm"
                  placeholder="you@quiet.world"
                  autoComplete="email"
                />
              </div>
              <div>
                <label className="bf-eyebrow block mb-2">Password</label>
                <input
                  data-testid={REGISTER.passwordInput}
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="bf-input w-full rounded-xl px-4 py-3 text-sm"
                  placeholder="At least 6 characters"
                  autoComplete="new-password"
                />
              </div>
              <div>
                <label className="bf-eyebrow block mb-2">Confirm password</label>
                <input
                  data-testid={REGISTER.passwordConfirmInput}
                  type="password"
                  required
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  className="bf-input w-full rounded-xl px-4 py-3 text-sm"
                  placeholder="Type it again"
                  autoComplete="new-password"
                />
              </div>
              {error && <p className="text-xs text-[rgb(232,180,180)]">{error}</p>}
              <button
                type="submit"
                disabled={busy}
                data-testid={REGISTER.submitButton}
                className="bf-pill-btn w-full mt-2"
              >
                {busy ? "Creating…" : "Open my world"}
              </button>
              <p className="text-xs text-[rgba(244,237,224,0.5)] text-center pt-3">
                Already here?{" "}
                <button
                  type="button"
                  onClick={() => setTab("login")}
                  data-testid={REGISTER.loginLink}
                  className="underline-offset-2 hover:underline text-[rgb(232,196,184)]"
                >
                  Sign in
                </button>
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
