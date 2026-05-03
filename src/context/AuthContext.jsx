import { createContext, useContext, useState, useEffect } from "react";
import { preloadFromCloud, clearCache } from "../utils/cloudStorage.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null);  // { userId, email, name, role }
  const [token, setToken]     = useState(null);
  const [loading, setLoading] = useState(true);
  const [dataReady, setDataReady] = useState(false);

  // Restore session on mount
  useEffect(() => {
    async function restoreSession() {
      const savedToken = localStorage.getItem("en2026_token");
      if (!savedToken) { setLoading(false); setDataReady(true); return; }
      try {
        const r = await fetch("/api/auth?action=verify", {
          headers: { Authorization: `Bearer ${savedToken}` },
        });
        const data = await r.json();
        if (data.ok) {
          setUser(data.user);
          setToken(savedToken);
          await preloadFromCloud(savedToken);
        } else {
          localStorage.removeItem("en2026_token");
        }
      } catch {
        localStorage.removeItem("en2026_token");
      } finally {
        setLoading(false);
        setDataReady(true);
      }
    }
    restoreSession();
  }, []);

  async function register(email, password, name) {
    const res = await fetch("/api/auth?action=register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, name }),
    });
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || "Eroare la înregistrare");
    localStorage.setItem("en2026_token", data.token);
    setToken(data.token);
    setUser(data.user);
    return data.user;
  }

  async function login(email, password) {
    const res = await fetch("/api/auth?action=login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || "Email sau parolă incorecte");
    localStorage.setItem("en2026_token", data.token);
    setToken(data.token);
    setUser(data.user);
    await preloadFromCloud(data.token);
    setDataReady(true);
    return data.user;
  }

  async function logout() {
    if (token) {
      fetch("/api/auth?action=logout", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => {});
    }
    localStorage.removeItem("en2026_token");
    clearCache();
    setToken(null);
    setUser(null);
    setDataReady(false);
  }

  return (
    <AuthContext.Provider value={{ user, token, loading, dataReady, register, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
