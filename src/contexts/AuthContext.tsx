import React, { createContext, useContext, useEffect, useState } from "react";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { AuthUser, mapSupabaseUser } from "@/lib/auth";

// ── Local Auth (khi không có Supabase) ───────────────────────────────────────
const LOCAL_USER_KEY = "examtouch_local_user";

export function getLocalUser(): AuthUser | null {
  try {
    const stored = localStorage.getItem(LOCAL_USER_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}

export function saveLocalUser(user: AuthUser): void {
  localStorage.setItem(LOCAL_USER_KEY, JSON.stringify(user));
}

export function clearLocalUser(): void {
  localStorage.removeItem(LOCAL_USER_KEY);
}

/** Tạo local user mặc định nếu chưa có */
function getOrCreateLocalUser(): AuthUser {
  const existing = getLocalUser();
  if (existing) return existing;
  const user: AuthUser = {
    id: `local-${Date.now()}`,
    email: "local@examtouch.app",
    username: "Người dùng",
  };
  saveLocalUser(user);
  return user;
}

// ── Context ───────────────────────────────────────────────────────────────────
interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  isLocalMode: boolean; // true = không có Supabase
  logout: () => Promise<void>;
  updateLocalUsername: (name: string) => void;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
  isLocalMode: !isSupabaseConfigured,
  logout: async () => {},
  updateLocalUsername: () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      // ── LOCAL MODE: tự động đăng nhập với local user ──
      setUser(getOrCreateLocalUser());
      setLoading(false);
      return;
    }

    // ── SUPABASE MODE ──
    let mounted = true;

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return;
      if (session?.user) setUser(mapSupabaseUser(session.user));
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      if (event === "SIGNED_IN" && session?.user) {
        setUser(mapSupabaseUser(session.user));
        setLoading(false);
      } else if (event === "SIGNED_OUT") {
        setUser(null);
        setLoading(false);
      } else if (event === "TOKEN_REFRESHED" && session?.user) {
        setUser(mapSupabaseUser(session.user));
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const logout = async () => {
    if (!isSupabaseConfigured) {
      // Local mode: chỉ xóa username, vẫn giữ dữ liệu
      clearLocalUser();
      setUser(getOrCreateLocalUser()); // tạo lại anonymous user
      return;
    }
    await supabase.auth.signOut();
  };

  const updateLocalUsername = (name: string) => {
    if (!user) return;
    const updated = { ...user, username: name };
    setUser(updated);
    if (!isSupabaseConfigured) saveLocalUser(updated);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isLocalMode: !isSupabaseConfigured,
        logout,
        updateLocalUsername,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
