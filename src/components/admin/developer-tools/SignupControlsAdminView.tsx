import { useState, useEffect, useCallback } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowReloadHorizontalIcon } from "@hugeicons/core-free-icons";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  DeveloperToolsAdminShell,
  AdminCard,
  AdminSectionLabel,
  AdminToggleRow,
  AdminSavingIndicator,
} from "./DeveloperToolsAdminShell";

// ── Config keys stored in app_config ─────────────────────────────────────────

export const SIGNUP_CONFIG_KEYS = {
  registration: "auth_registration_enabled",
  oauthLogin:   "auth_oauth_login",
  oauthSignup:  "auth_oauth_signup",
} as const;

export type OAuthProviders = { google: boolean; apple: boolean };

export type SignupControls = {
  registrationEnabled: boolean;
  oauthLoginEnabled:   boolean;
  oauthLoginGoogle:    boolean;
  oauthLoginApple:     boolean;
  oauthSignupEnabled:  boolean;
  oauthSignupGoogle:   boolean;
  oauthSignupApple:    boolean;
};

export const DEFAULT_SIGNUP_CONTROLS: SignupControls = {
  registrationEnabled: false,
  oauthLoginEnabled:   true,
  oauthLoginGoogle:    true,
  oauthLoginApple:     true,
  oauthSignupEnabled:  false,
  oauthSignupGoogle:   true,
  oauthSignupApple:    true,
};

// ── Shared loader (also used by AuthPage) ─────────────────────────────────────

export async function loadSignupControls(): Promise<SignupControls> {
  const { data } = await supabase
    .from("app_config")
    .select("config_key, config_value")
    .in("config_key", Object.values(SIGNUP_CONFIG_KEYS));

  const map: Record<string, any> = {};
  for (const row of data ?? []) {
    try {
      map[row.config_key] = typeof row.config_value === "string"
        ? JSON.parse(row.config_value)
        : row.config_value;
    } catch {
      map[row.config_key] = row.config_value;
    }
  }

  const reg  = map[SIGNUP_CONFIG_KEYS.registration] ?? { enabled: DEFAULT_SIGNUP_CONTROLS.registrationEnabled };
  const login = map[SIGNUP_CONFIG_KEYS.oauthLogin]  ?? { enabled: DEFAULT_SIGNUP_CONTROLS.oauthLoginEnabled, google: DEFAULT_SIGNUP_CONTROLS.oauthLoginGoogle, apple: DEFAULT_SIGNUP_CONTROLS.oauthLoginApple };
  const signup = map[SIGNUP_CONFIG_KEYS.oauthSignup] ?? { enabled: DEFAULT_SIGNUP_CONTROLS.oauthSignupEnabled, google: DEFAULT_SIGNUP_CONTROLS.oauthSignupGoogle, apple: DEFAULT_SIGNUP_CONTROLS.oauthSignupApple };

  return {
    registrationEnabled: reg?.enabled  ?? DEFAULT_SIGNUP_CONTROLS.registrationEnabled,
    oauthLoginEnabled:   login?.enabled ?? DEFAULT_SIGNUP_CONTROLS.oauthLoginEnabled,
    oauthLoginGoogle:    login?.google  ?? DEFAULT_SIGNUP_CONTROLS.oauthLoginGoogle,
    oauthLoginApple:     login?.apple   ?? DEFAULT_SIGNUP_CONTROLS.oauthLoginApple,
    oauthSignupEnabled:  signup?.enabled ?? DEFAULT_SIGNUP_CONTROLS.oauthSignupEnabled,
    oauthSignupGoogle:   signup?.google  ?? DEFAULT_SIGNUP_CONTROLS.oauthSignupGoogle,
    oauthSignupApple:    signup?.apple   ?? DEFAULT_SIGNUP_CONTROLS.oauthSignupApple,
  };
}

// ── Upsert helper ─────────────────────────────────────────────────────────────

async function saveConfigKey(key: string, value: object, userId: string): Promise<string | null> {
  const { data: existing } = await supabase
    .from("app_config")
    .select("id")
    .eq("config_key", key)
    .maybeSingle();

  const jsonValue = JSON.stringify(value);

  if (existing?.id) {
    const { error } = await supabase
      .from("app_config")
      .update({ config_value: jsonValue, updated_at: new Date().toISOString() })
      .eq("id", existing.id);
    return error?.message ?? null;
  } else {
    const { error } = await supabase
      .from("app_config")
      .insert({ config_key: key, config_value: jsonValue, user_id: userId });
    return error?.message ?? null;
  }
}

// ── Sub-component: OAuth provider toggles ────────────────────────────────────

function OAuthProviderGroup({
  google,
  apple,
  saving,
  onToggle,
}: {
  google: boolean;
  apple: boolean;
  saving: boolean;
  onToggle: (provider: "google" | "apple") => void;
}) {
  return (
    <div className="mt-3 ml-4 pl-4 border-l-2 border-[#E8EBEB] flex flex-col gap-3">
      {/* Google */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2.5 flex-1 min-w-0">
          <div className="w-5 h-5 flex-shrink-0">
            <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold text-[#1A2E2E]">Google</p>
            <p className="text-xs text-[#6B7280]">Sign in with Google</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => onToggle("google")}
          disabled={saving}
          className="disabled:opacity-60 disabled:cursor-not-allowed"
        >
          <div className={`relative h-6 w-11 rounded-full flex-shrink-0 transition-colors duration-200 ${google ? "bg-[#059669]" : "bg-[#D1D5DB]"}`}>
            <span className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${google ? "translate-x-5" : "translate-x-0"}`} />
          </div>
        </button>
      </div>

      {/* Apple */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2.5 flex-1 min-w-0">
          <div className="w-5 h-5 flex-shrink-0 bg-black rounded-full flex items-center justify-center">
            <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" className="w-3 h-3" fill="white">
              <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold text-[#1A2E2E]">Apple</p>
            <p className="text-xs text-[#6B7280]">Sign in with Apple</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => onToggle("apple")}
          disabled={saving}
          className="disabled:opacity-60 disabled:cursor-not-allowed"
        >
          <div className={`relative h-6 w-11 rounded-full flex-shrink-0 transition-colors duration-200 ${apple ? "bg-[#059669]" : "bg-[#D1D5DB]"}`}>
            <span className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${apple ? "translate-x-5" : "translate-x-0"}`} />
          </div>
        </button>
      </div>
    </div>
  );
}

// ── View ──────────────────────────────────────────────────────────────────────

export function SignupControlsAdminView() {
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const [saving, setSaving]     = useState(false);
  const [userId, setUserId]     = useState<string | null>(null);
  const [controls, setControls] = useState<SignupControls>(DEFAULT_SIGNUP_CONTROLS);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      setUserId(user?.id ?? null);
      const result = await loadSignupControls();
      setControls(result);
    } catch (err: any) {
      setError(err?.message ?? "Failed to load signup controls.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = async (next: SignupControls) => {
    if (!userId || saving) return;
    setSaving(true);
    const errs: string[] = [];

    const e1 = await saveConfigKey(
      SIGNUP_CONFIG_KEYS.registration,
      { enabled: next.registrationEnabled },
      userId,
    );
    if (e1) errs.push(e1);

    const e2 = await saveConfigKey(
      SIGNUP_CONFIG_KEYS.oauthLogin,
      { enabled: next.oauthLoginEnabled, google: next.oauthLoginGoogle, apple: next.oauthLoginApple },
      userId,
    );
    if (e2) errs.push(e2);

    const e3 = await saveConfigKey(
      SIGNUP_CONFIG_KEYS.oauthSignup,
      { enabled: next.oauthSignupEnabled, google: next.oauthSignupGoogle, apple: next.oauthSignupApple },
      userId,
    );
    if (e3) errs.push(e3);

    if (errs.length > 0) {
      toast.error(errs[0]);
    } else {
      toast.success("Signup controls updated");
      setControls(next);
    }
    setSaving(false);
  };

  const toggle = (key: keyof SignupControls) => {
    const next = { ...controls, [key]: !controls[key] };
    save(next);
  };

  return (
    <DeveloperToolsAdminShell
      title="Signup Controls"
      description="Control user registration, OAuth login, and OAuth signup availability across the app."
      loading={loading}
      error={error}
      actions={
        <div className="flex items-center gap-2">
          {saving && <AdminSavingIndicator />}
          <button
            onClick={load}
            disabled={loading || saving}
            title="Refresh"
            className="flex items-center justify-center w-8 h-8 rounded-xl text-[#9CA3AF] hover:text-[#2E4A4A] hover:bg-[#F2F3F3] transition-colors disabled:opacity-40"
          >
            <HugeiconsIcon icon={ArrowReloadHorizontalIcon} size={15} color="currentColor" strokeWidth={2} />
          </button>
        </div>
      }
    >
      {/* ── New User Registration ─────────────────────────────────── */}
      <AdminCard>
        <AdminSectionLabel>User Registration</AdminSectionLabel>
        <AdminToggleRow
          label="Enable New User Registration"
          description="When enabled, the login screen will show a sign-up option for new users. When disabled, sign-up is hidden and new registrations are blocked."
          checked={controls.registrationEnabled}
          disabled={saving}
          onChange={() => toggle("registrationEnabled")}
        />
      </AdminCard>

      {/* ── OAuth Login ───────────────────────────────────────────── */}
      <AdminCard>
        <AdminSectionLabel>OAuth Login</AdminSectionLabel>
        <AdminToggleRow
          label="Enable OAuth Login"
          description="Allow existing users to sign in using third-party OAuth providers."
          checked={controls.oauthLoginEnabled}
          disabled={saving}
          onChange={() => toggle("oauthLoginEnabled")}
        />
        {controls.oauthLoginEnabled && (
          <OAuthProviderGroup
            google={controls.oauthLoginGoogle}
            apple={controls.oauthLoginApple}
            saving={saving}
            onToggle={(provider) =>
              toggle(provider === "google" ? "oauthLoginGoogle" : "oauthLoginApple")
            }
          />
        )}
      </AdminCard>

      {/* ── OAuth Signup ──────────────────────────────────────────── */}
      <AdminCard>
        <AdminSectionLabel>OAuth Signup</AdminSectionLabel>
        <AdminToggleRow
          label="Enable OAuth Signup"
          description="Allow new users to create an account using third-party OAuth providers."
          checked={controls.oauthSignupEnabled}
          disabled={saving}
          onChange={() => toggle("oauthSignupEnabled")}
        />
        {controls.oauthSignupEnabled && (
          <OAuthProviderGroup
            google={controls.oauthSignupGoogle}
            apple={controls.oauthSignupApple}
            saving={saving}
            onToggle={(provider) =>
              toggle(provider === "google" ? "oauthSignupGoogle" : "oauthSignupApple")
            }
          />
        )}
      </AdminCard>
    </DeveloperToolsAdminShell>
  );
}
