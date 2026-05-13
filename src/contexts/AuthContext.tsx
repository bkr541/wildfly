import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

interface AuthContextValue {
  user: User | null;
  userId: string | undefined;
  loading: boolean;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  userId: undefined,
  loading: true,
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Seed from local session (no network call)
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Keep in sync with auth state changes (reads from memory/storage).
    // IMPORTANT: only swap the user object when the identity actually changes.
    // TOKEN_REFRESHED / USER_UPDATED fire frequently and would otherwise
    // produce a new `user` reference on every refresh, causing any consumer
    // with `[user]` in a useEffect dep array (e.g. AdminGate) to re-run and
    // potentially unmount its children mid-operation.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      const nextUser = session?.user ?? null;
      setUser((prev) => {
        if (prev?.id === nextUser?.id) return prev;
        return nextUser;
      });
      if (event === "SIGNED_IN" && session?.user) {
        // Fire-and-forget: stamp last_login in UTC. Defer to avoid deadlocks in the auth callback.
        const uid = session.user.id;
        setTimeout(() => {
          supabase
            .from("user_info")
            .update({ last_login: new Date().toISOString() })
            .eq("auth_user_id", uid)
            .then(() => {});
        }, 0);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, userId: user?.id, loading }}>
      {children}
    </AuthContext.Provider>
  );
};
