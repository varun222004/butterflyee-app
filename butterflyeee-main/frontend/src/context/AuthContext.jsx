import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api, formatApiError } from "@/lib/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  // user: undefined = loading, null = anonymous, object = signed in
  const [user, setUser] = useState(undefined);
  const [buddy, setBuddy] = useState(null);

  const fetchMe = useCallback(async () => {
    try {
      const { data } = await api.get("/auth/me");
      setUser(data);
      return data;
    } catch {
      setUser(null);
      setBuddy(null);
      return null;
    }
  }, []);

  const fetchBuddy = useCallback(async () => {
    try {
      const { data } = await api.get("/buddies/me");
      setBuddy(data);
      return data;
    } catch {
      setBuddy(null);
      return null;
    }
  }, []);

  const login = useCallback(async (email, password) => {
    try {
      const { data } = await api.post("/auth/login", { email, password });
      setUser(data);
      await fetchBuddy();
      return { ok: true, user: data };
    } catch (e) {
      return { ok: false, error: formatApiError(e) };
    }
  }, [fetchBuddy]);

  const register = useCallback(async (email, password, display_name) => {
    try {
      const { data } = await api.post("/auth/register", { email, password, display_name });
      setUser(data);
      return { ok: true, user: data };
    } catch (e) {
      return { ok: false, error: formatApiError(e) };
    }
  }, []);

  const logout = useCallback(async () => {
    try { await api.post("/auth/logout"); } catch { /* noop */ }
    setUser(null);
    setBuddy(null);
  }, []);

  useEffect(() => {
    fetchMe().then((u) => { if (u) fetchBuddy(); });
  }, [fetchMe, fetchBuddy]);

  const value = { user, buddy, setUser, setBuddy, fetchMe, fetchBuddy, login, register, logout };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
