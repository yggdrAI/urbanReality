import { createContext, useContext, useState, useEffect } from "react";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem("token"));
  const [user, setUser] = useState(null);

  useEffect(() => {
    // Optionally fetch profile when token changes
    async function fetchProfile() {
      if (!token) return setUser(null);
      try {
        const res = await fetch((import.meta.env.VITE_BACKEND_URL || "http://localhost:5000") + "/api/user/profile", {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!res.ok) return setUser(null);
        const data = await res.json();
        setUser(data);
      } catch {
        setUser(null);
      }
    }
    fetchProfile();
  }, [token]);

  const login = (newToken) => {
    localStorage.setItem("token", newToken);
    setToken(newToken);
  };

  const logout = () => {
    localStorage.removeItem("token");
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ token, user, setUser, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
};
