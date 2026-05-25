"use client";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { getMe, logout as logoutApi, type AuthUser } from "@/lib/auth-client";

type AuthCtx = {
  user:    AuthUser | null;
  loading: boolean;
  setUser: (u: AuthUser | null) => void;
  logout:  () => Promise<void>;
  bookmarks: string[] | null;
  setBookmarks: (newBookmarks: string[] | null) => void;
};

const AuthContext = createContext<AuthCtx>({
  user: null, loading: true,
  setUser: () => {}, logout: async () => {},
  bookmarks: [],
  setBookmarks: () => {}
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user,    setUser]    = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [bookmarks, setBookmarks] = useState<string[] | null>([]);

  useEffect(() => {
    getMe().then(u => { 
      setUser(u); 
      setLoading(false); 
      u && setBookmarks(u.bookmarks.split(','));
    });
  }, []);

  const logout = async () => { await logoutApi(); setUser(null); };

  return (
    <AuthContext.Provider value={{ user, loading, setUser, logout, bookmarks, setBookmarks }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);