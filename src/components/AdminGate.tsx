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
  const [checking, setChecking] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let active = true;
    if (loading) return;
    if (!user) {
      setChecking(false);
      setIsAdmin(false);
      return;
    }
    setChecking(true);
    supabase
      .from("developer_allowlist")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!active) return;
        setIsAdmin(!!data);
        setChecking(false);
      });
    return () => {
      active = false;
    };
  }, [user, loading]);

  if (loading || (user && checking)) {
    return <div className="min-h-screen" />;
  }

  if (!user) {
    return <AuthPage onAuthSuccess={() => { /* re-render via auth state */ }} />;
  }

  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

export default AdminGate;
