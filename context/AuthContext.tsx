"use client";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { getMe, logout as logoutApi, type AuthUser } from "@/lib/auth-client";

type AuthCtx = {
  user:    AuthUser | null;
  loading: boolean;
  setUser: (u: AuthUser | null) => void;
  logout:  () => Promise<void>;
};

const AuthContext = createContext<AuthCtx>({
  user: null, loading: true,
  setUser: () => {}, logout: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user,    setUser]    = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getMe().then(u => { setUser(u); setLoading(false); });
  }, []);

  const logout = async () => { await logoutApi(); setUser(null); };

  return (
    <AuthContext.Provider value={{ user, loading, setUser, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);