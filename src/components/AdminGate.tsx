import { useEffect, useState, type ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import AuthPage from "@/components/AuthPage";

/**
 * Gate for admin-only routes.
 * - Not signed in -> render the AuthPage (sign-in screen)
 * - Signed in but not in developer_allowlist -> redirect to "/"
 * - Signed in admin -> render children
 *
 * Note: developer_allowlist is the project's existing admin source of truth
 * (treated as "is_admin = true").
 */
const AdminGate = ({ children }: { children: ReactNode }) => {
  const { user, loading } = useAuth();
  const userId = user?.id;
  // checkState: 'idle' before we've verified, 'admin' once verified, 'denied' if not admin.
  // We deliberately do NOT flip back to a loading placeholder on subsequent
  // auth events (e.g. TOKEN_REFRESHED) — that would unmount children mid-task.
  const [checkState, setCheckState] = useState<"idle" | "admin" | "denied">("idle");

  useEffect(() => {
    let active = true;
    if (loading) return;
    if (!userId) {
      setCheckState("idle");
      return;
    }
    // Only verify once per signed-in user id.
    supabase
      .from("developer_allowlist")
      .select("user_id")
      .eq("user_id", userId)
      .maybeSingle()
      .then(({ data }) => {
        if (!active) return;
        setCheckState(data ? "admin" : "denied");
      });
    return () => {
      active = false;
    };
  }, [userId, loading]);

  if (loading) {
    return <div className="min-h-screen" />;
  }

  if (!userId) {
    return <AuthPage onSignIn={() => { /* re-render via auth state */ }} />;
  }

  if (checkState === "denied") {
    return <Navigate to="/" replace />;
  }

  if (checkState === "idle") {
    return <div className="min-h-screen" />;
  }

  return <>{children}</>;
};

export default AdminGate;
