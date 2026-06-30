import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Copy, Check, X, Heart } from "lucide-react";
import Background from "@/components/atmosphere/Background";
import { useAuth } from "@/context/AuthContext";
import { api, formatApiError } from "@/lib/api";
import { magic } from "@/lib/magic";
import { CONNECT } from "@/constants/testIds";

export default function ConnectPage() {
  const { user, buddy, fetchBuddy, logout } = useAuth();
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [requests, setRequests] = useState({ incoming: [], outgoing: [] });

  async function loadRequests() {
    try {
      const { data } = await api.get("/buddies/requests");
      setRequests(data);
    } catch { /* noop */ }
  }

  useEffect(() => {
    fetchBuddy();
    loadRequests();
  }, [fetchBuddy]);

  // If already paired, jump to home
  useEffect(() => {
    if (buddy?.buddy) {
      navigate("/");
    }
  }, [buddy, navigate]);

  async function sendRequest(e) {
    e.preventDefault();
    setError("");
    if (!identifier.trim()) return;
    setBusy(true);
    try {
      await api.post("/buddies/request", { identifier: identifier.trim() });
      magic.butterfly("A butterfly is on its way to them.");
      setIdentifier("");
      await loadRequests();
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setBusy(false);
    }
  }

  async function accept(id) {
    try {
      await api.post(`/buddies/requests/${id}/accept`);
      magic.butterfly("You are now Butterfly Buddies.");
      await fetchBuddy();
      await loadRequests();
      navigate("/");
    } catch (err) {
      magic.error(formatApiError(err));
    }
  }

  async function decline(id) {
    try {
      await api.post(`/buddies/requests/${id}/decline`);
      await loadRequests();
    } catch (err) {
      magic.error(formatApiError(err));
    }
  }

  async function cancel(id) {
    try {
      await api.delete(`/buddies/requests/${id}`);
      await loadRequests();
    } catch (err) {
      magic.error(formatApiError(err));
    }
  }

  async function copyId() {
    try {
      await navigator.clipboard.writeText(user?.buddy_id || "");
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* noop */ }
  }

  return (
    <div className="relative min-h-screen text-[rgb(244,237,224)]">
      <Background butterflyCount={5} />
      <div className="relative z-10 min-h-screen flex items-start justify-center px-4 py-16 sm:py-24">
        <div className="w-full max-w-2xl bf-fade-up">
          <div className="bf-eyebrow mb-6 text-center">CONNECT WITH BUDDY</div>
          <h1 className="bf-display text-4xl sm:text-6xl leading-[1.05] mb-3 text-center">
            Find <span className="bf-script text-[rgb(232,196,184)] text-5xl sm:text-7xl">your person.</span>
          </h1>
          <p className="text-sm text-[rgba(244,237,224,0.6)] mb-12 text-center max-w-lg mx-auto leading-relaxed">
            Enter their handle or their Butterfly ID. Once they accept, your two
            worlds become quietly linked.
          </p>

          {/* My ID card */}
          <div className="bf-glass rounded-3xl p-6 sm:p-8 mb-8">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <div className="bf-eyebrow mb-2">Your invite code</div>
                <code className="bf-display text-2xl sm:text-3xl tracking-wider text-[rgb(232,196,184)] block">
                  {user?.buddy_id}
                </code>
                {user?.handle && (
                  <div className="text-sm text-[rgba(244,237,224,0.6)] mt-2 bf-script">
                    or simply <span className="text-[rgb(232,196,184)]">@{user.handle}</span>
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={copyId}
                data-testid={CONNECT.copyBuddyIdButton}
                className="bf-pill-btn flex items-center gap-2 self-start"
              >
                {copied ? <><Check size={14}/> Copied</> : <><Copy size={14}/> Copy</>}
              </button>
            </div>
          </div>

          {/* Send a request */}
          <form onSubmit={sendRequest} className="bf-glass rounded-3xl p-6 sm:p-8 mb-8">
            <div className="bf-eyebrow mb-4">Send a quiet request</div>
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                data-testid={CONNECT.identifierInput}
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="@their_handle  or  BTF-XXXX-XXXX"
                className="bf-input flex-1 rounded-xl px-4 py-3 text-sm"
              />
              <button
                type="submit"
                disabled={busy || !identifier.trim()}
                data-testid={CONNECT.sendRequestButton}
                className="bf-pill-btn whitespace-nowrap"
              >
                <Heart size={14} className="inline -mt-0.5 mr-2" strokeWidth={1.5} />
                Send butterfly
              </button>
            </div>
            {error && <p className="text-xs text-[rgb(232,180,180)] mt-3">{error}</p>}
          </form>

          {/* Incoming */}
          {requests.incoming.length > 0 && (
            <div className="mb-8">
              <div className="bf-eyebrow mb-4">A butterfly arrived</div>
              <div className="space-y-3">
                {requests.incoming.map((r) => (
                  <div key={r.id} className="bf-glass rounded-2xl p-5 flex items-center justify-between gap-4">
                    <div>
                      <p className="bf-display text-xl">
                        {r.user?.display_name || r.user?.handle || r.user?.buddy_id}
                      </p>
                      <p className="text-xs text-[rgba(244,237,224,0.55)] mt-1 bf-script text-base">
                        wants to become your Butterfly Buddy.
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => accept(r.id)}
                        data-testid={CONNECT.incomingAcceptButton}
                        className="bf-pill-btn !py-2 !px-4 text-xs"
                      >
                        Accept
                      </button>
                      <button
                        onClick={() => decline(r.id)}
                        data-testid={CONNECT.incomingDeclineButton}
                        className="text-xs text-[rgba(244,237,224,0.5)] hover:text-[rgb(244,237,224)] px-3 py-2 transition-colors duration-500"
                      >
                        Decline
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Outgoing */}
          {requests.outgoing.length > 0 && (
            <div>
              <div className="bf-eyebrow mb-4">A butterfly is in flight</div>
              <div className="space-y-3">
                {requests.outgoing.map((r) => (
                  <div key={r.id} className="bf-glass rounded-2xl p-5 flex items-center justify-between gap-4">
                    <div>
                      <p className="bf-display text-xl">
                        {r.user?.display_name || r.user?.handle || r.user?.buddy_id}
                      </p>
                      <p className="text-xs text-[rgba(244,237,224,0.5)] mt-1 bf-script text-base">
                        waiting quietly for their answer.
                      </p>
                    </div>
                    <button
                      onClick={() => cancel(r.id)}
                      data-testid={CONNECT.outgoingCancelButton}
                      className="text-[rgba(244,237,224,0.5)] hover:text-[rgb(244,237,224)] p-2 transition-colors duration-500"
                      aria-label="Cancel"
                    >
                      <X size={16}/>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="text-center mt-12">
            <button
              onClick={() => logout().then(() => navigate("/auth/login"))}
              className="text-xs text-[rgba(244,237,224,0.4)] hover:text-[rgb(244,237,224)] transition-colors duration-500"
            >
              sign out
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
