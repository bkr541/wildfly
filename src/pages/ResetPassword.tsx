import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppInput } from "@/components/ui/app-input";
import { LockPasswordIcon } from "@hugeicons/core-free-icons";
import { toast } from "sonner";

/**
 * Handles the /reset-password route.
 * Supabase appends #access_token=...&type=recovery to this URL.
 * We detect that fragment, let the SDK exchange it for a session,
 * then let the user set a new password.
 */
const ResetPasswordPage = () => {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // The SDK fires PASSWORD_RECOVERY when it detects type=recovery in the hash.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setReady(true);
      }
    });

    // Also check if a session is already active (user navigated back/refreshed).
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setReady(true);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 6) { setError("Password must be at least 6 characters"); return; }
    if (password !== confirm) { setError("Passwords do not match"); return; }
    setSaving(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setSaving(false);
    if (updateError) {
      setError(updateError.message);
    } else {
      setDone(true);
      toast.success("Password updated! You can now sign in.");
      // Give user a moment, then redirect to root so App.tsx handles auth state.
      setTimeout(() => {
        window.location.replace("/");
      }, 2000);
    }
  };

  return (
    <div
      className="relative flex flex-col min-h-screen bg-cover bg-center bg-no-repeat items-center justify-center"
      style={{ backgroundImage: "url('/assets/authuser/newbg3.png')" }}
    >
      <div className="w-full max-w-md mx-auto px-4">
        <div className="bg-white/95 backdrop-blur-md rounded-2xl px-7 pt-8 pb-8 shadow-2xl flex flex-col gap-6">
          {/* Logo */}
          <div className="flex justify-center">
            <img src="/assets/logo/wflogo2.png" alt="Logo" className="h-16 w-auto object-contain" />
          </div>

          <div>
            <h1 className="text-xl font-black text-[#1A2E2E] mb-1">Set new password</h1>
            <p className="text-sm text-[#6B7B7B]">
              {ready
                ? "Enter your new password below."
                : "Loading your reset session…"}
            </p>
          </div>

          {done ? (
            <div className="text-center py-4">
              <p className="text-[#10B981] font-semibold text-sm">✓ Password updated — redirecting…</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <AppInput
                icon={LockPasswordIcon}
                label="New Password"
                placeholder="New password"
                isPassword
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={!ready}
              />
              <AppInput
                icon={LockPasswordIcon}
                label="Confirm Password"
                placeholder="Confirm new password"
                isPassword
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                disabled={!ready}
              />
              {error && (
                <p className="text-xs text-red-500 font-medium">{error}</p>
              )}
              <button
                type="submit"
                disabled={saving || !ready}
                className="w-full h-11 rounded-full bg-gradient-to-r from-[#10B981] to-[#059669] text-white font-bold text-xs tracking-widest uppercase shadow-lg hover:shadow-xl active:scale-[0.98] transition-all disabled:opacity-50"
              >
                {saving ? "Updating…" : "Update Password"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default ResetPasswordPage;
