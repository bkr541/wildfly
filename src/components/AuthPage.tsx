import { useState, useEffect, useRef } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Mail01Icon, UserIcon, LockPasswordIcon, LoginSquare01Icon, UserAdd01Icon, AlertCircleIcon } from "@hugeicons/core-free-icons";
import { AppInput } from "@/components/ui/app-input";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { isPasswordStrong, getPasswordStrengthScore } from "./PasswordStrengthInput";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";

interface AuthPageProps {
  onSignIn: (needsOnboarding: boolean) => void;
}

interface FieldErrors {
  firstName?: string;
  lastName?: string;
  email?: string;
  password?: string;
}

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const strengthLabels = ["Too weak", "Too weak", "Weak", "Medium", "Strong", "Very strong"];
const strengthColors = ["#f87171", "#f87171", "#f97316", "#facc15", "#a3e635", "#22c55e"];

const PasswordStrengthBar = ({ password }: { password: string }) => {
  const score = getPasswordStrengthScore(password);
  const total = 5;
  return (
    <div className="mt-2">
      <div className="flex gap-1.5">
        {Array.from({ length: total }).map((_, i) => (
          <span
            key={i}
            className="h-1.5 w-full rounded-full transition-colors"
            style={{ backgroundColor: i < score ? strengthColors[score] : "#e5e7eb" }}
          />
        ))}
      </div>
      <p className="text-[11px] mt-1 ml-0.5 font-medium" style={{ color: strengthColors[score] }}>
        {strengthLabels[score]}
      </p>
    </div>
  );
};

const AuthPage = ({ onSignIn }: AuthPageProps) => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [showLoginError, setShowLoginError] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotError, setForgotError] = useState<string | null>(null);
  const [forgotSuccess, setForgotSuccess] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<"google" | "apple" | null>(null);
  const [oauthError, setOauthError] = useState<string | null>(null);

  const validateSignUp = (): boolean => {
    const newErrors: FieldErrors = {};
    if (!firstName.trim()) newErrors.firstName = "Required";
    if (!lastName.trim()) newErrors.lastName = "Required";
    if (!email.trim()) {
      newErrors.email = "Email required";
    } else if (!emailRegex.test(email.trim())) {
      newErrors.email = "Invalid email";
    }
    if (!password) {
      newErrors.password = "Password required";
    } else if (!isPasswordStrong(password)) {
      newErrors.password = "Too weak";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateSignIn = (): boolean => {
    const newErrors: FieldErrors = {};
    if (!email.trim()) {
      newErrors.email = "Email or username required";
    }
    if (!password) newErrors.password = "Password required";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    if (isSignUp) {
      if (!validateSignUp()) return;
      setConfirmPassword("");
      setConfirmError(null);
      setShowConfirmDialog(true);
      return;
    }
    if (!validateSignIn()) return;
    setLoading(true);
    try {
      let loginEmail = email.trim();
      if (!emailRegex.test(loginEmail)) {
        const { data: userRow } = await supabase
          .from("user_info")
          .select("email")
          .eq("username", loginEmail)
          .maybeSingle();
        if (!userRow?.email) {
          setShowLoginError(true);
          setLoading(false);
          return;
        }
        loginEmail = userRow.email;
      }

      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: loginEmail,
        password,
      });
      if (authError || !authData.user) {
        setShowLoginError(true);
        return;
      }
      const { data: profile } = await supabase
        .from("user_info")
        .select("onboarding_complete")
        .eq("auth_user_id", authData.user.id)
        .maybeSingle();

      if (profile) {
        await supabase.from("user_info").update({ remember_me: rememberMe }).eq("auth_user_id", authData.user.id);
      }

      if (!profile) {
        await supabase.from("user_info").insert({
          auth_user_id: authData.user.id,
          email: email.trim(),
          onboarding_complete: "No",
          image_file: "",
          remember_me: rememberMe,
        });
        onSignIn(true);
        return;
      }
      onSignIn(profile.onboarding_complete !== "Yes");
    } catch {
      setSubmitError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmSignUp = async () => {
    if (!confirmPassword) {
      setConfirmError("Please confirm your password");
      return;
    }
    if (password !== confirmPassword) {
      setConfirmError("Passwords do not match");
      return;
    }
    setConfirmError(null);
    setShowConfirmDialog(false);
    setLoading(true);
    try {
      const normalizedEmail = email.trim().toLowerCase();
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: normalizedEmail,
        password,
      });
      if (authError) {
        setSubmitError(authError.message);
        return;
      }
      if (!authData.user) {
        setSubmitError("Sign up failed. Please try again.");
        return;
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: profileError } = await (supabase.from("user_info") as any).insert({
        auth_user_id: authData.user.id,
        email: normalizedEmail,
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        onboarding_complete: "No",
        image_file: "",
        signup_type: "Email",
      });
      if (profileError) {
        setSubmitError(profileError.message);
        return;
      }
      await supabase.from("user_homepage").insert([
        { user_id: authData.user.id, component_name: "upcoming_flights", order: 1, status: "active" },
        { user_id: authData.user.id, component_name: "recent_searches", order: 2, status: "active" },
      ]);
      if (!authData.session) {
        setSubmitError("Check your email to confirm your account.");
        return;
      }
      onSignIn(true);
    } catch {
      setSubmitError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleOAuth = async (provider: "google" | "apple") => {
    setOauthLoading(provider);
    setOauthError(null);
    try {
      const result = await lovable.auth.signInWithOAuth(provider, {
        redirect_uri: window.location.origin,
      });
      if (result?.error) {
        setOauthError(
          `${provider === "google" ? "Google" : "Apple"} sign-in failed: ${(result.error as Error).message ?? "Unknown error"}`,
        );
      }
      // On success, App.tsx onAuthStateChange will handle navigation
    } catch (e: unknown) {
      setOauthError(`${provider === "google" ? "Google" : "Apple"} sign-in failed. Please try again.`);
    } finally {
      setOauthLoading(null);
    }
  };

  const handleTryAgain = () => {
    setPassword("");
    setShowLoginError(false);
  };

  const handleForgotPassword = async () => {
    if (!forgotEmail.trim() || !emailRegex.test(forgotEmail.trim())) {
      setForgotError("Valid email required");
      return;
    }
    setForgotLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail.trim(), {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) {
        setForgotError(error.message);
        return;
      }
      setForgotSuccess(true);
    } catch {
      setForgotError("Error sending reset link.");
    } finally {
      setForgotLoading(false);
    }
  };

  // Split-flap animation state
  const CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 ";
  const fullTarget = isSignUp ? "___SIGNUP" : "LOGIN____";
  const greenStart = isSignUp ? 7 : 3;
  const [displayChars, setDisplayChars] = useState<string[]>(Array(9).fill(" "));
  const prevTargetRef = useRef<string | null>(null);

  const runScramble = (target: string[]) => {
    const timeouts: ReturnType<typeof setTimeout>[] = [];
    const intervals: ReturnType<typeof setInterval>[] = [];
    target.forEach((finalChar, idx) => {
      const to = setTimeout(() => {
        const steps = 5;
        let step = 0;
        const iv = setInterval(() => {
          step++;
          if (step >= steps) {
            clearInterval(iv);
            setDisplayChars((prev) => {
              const n = [...prev];
              n[idx] = finalChar;
              return n;
            });
          } else {
            const r = CHARS[Math.floor(Math.random() * CHARS.length)];
            setDisplayChars((prev) => {
              const n = [...prev];
              n[idx] = r;
              return n;
            });
          }
        }, 40);
        intervals.push(iv);
      }, idx * 55);
      timeouts.push(to);
    });
    return () => {
      timeouts.forEach(clearTimeout);
      intervals.forEach(clearInterval);
    };
  };

  useEffect(() => {
    if (prevTargetRef.current === fullTarget) return;
    prevTargetRef.current = fullTarget;
    return runScramble(fullTarget.split(""));
  }, [fullTarget]);

  return (
    <div
      className="relative flex flex-col min-h-screen bg-cover bg-center bg-no-repeat"
      style={{ backgroundImage: "url('/assets/authuser/wfbackground.png')" }}
    >
      {/* Top section with logo */}
      <div className="flex-1 flex flex-col items-center justify-center z-10 py-10">
        <img
          src="/assets/logo/logo_horizontal.png"
          alt="Logo"
          className="w-auto object-contain mx-auto p-[6px]"
          style={{ height: "clamp(90px, 22vw, 140px)" }}
        />
        <img
          src="/assets/logo/tag_noshadow.png"
          alt="Tag"
          className="w-auto object-contain mx-auto"
          style={{ height: "clamp(40px, 10vw, 72px)" }}
        />
      </div>

      {/* White card form */}
      <div className="flex flex-col items-center z-10">
        <div
          className="w-full max-w-md bg-white rounded-t-[2rem] px-7 pt-6 pb-[44px] flex flex-col"
          style={{ boxShadow: "0 -6px 16px rgba(0,0,0,0.18)", borderTop: "1px solid rgba(0,0,0,0.12)" }}
        >
          {/* Header label */}
          <div className="w-full mb-4">
            <div className="flex items-center gap-1.5 w-full">
              {displayChars.map((char, i) => {
                const isGreen = i >= greenStart;
                const isSpace = fullTarget[i] === " ";
                const isBlank = fullTarget[i] === "_";
                if (isSpace) return <div key={i} className="w-2 flex-shrink-0" />;
                const displayChar = char === "_" || char === " " ? "" : char;
                return (
                  <div
                    key={i}
                    className="relative flex flex-col items-center justify-center rounded-lg shadow-md border overflow-hidden flex-1 min-w-0"
                    style={{
                      height: 46,
                      background: isBlank
                        ? "#e8eaed"
                        : isGreen
                          ? "linear-gradient(135deg,#10B981 0%,#059669 50%,#065F46 100%)"
                          : "#e8eaed",
                      borderColor: isBlank ? "#d1d5db" : isGreen ? "#059669" : "#d1d5db",
                      opacity: isBlank ? 0.45 : 1,
                    }}
                  >
                    <div
                      className="absolute inset-x-0 top-1/2 -translate-y-px h-px z-10"
                      style={{ background: isBlank ? "#b0b5bdaa" : isGreen ? "#059669aa" : "#b0b5bdaa" }}
                    />
                    <div
                      className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1/2 w-2 h-2 rounded-full border z-20"
                      style={{
                        background: isBlank ? "#e8eaed" : isGreen ? "#d1fae5" : "#e8eaed",
                        borderColor: isBlank ? "#d1d5db" : isGreen ? "#059669" : "#d1d5db",
                      }}
                    />
                    <div
                      className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 w-2 h-2 rounded-full border z-20"
                      style={{
                        background: isBlank ? "#e8eaed" : isGreen ? "#d1fae5" : "#e8eaed",
                        borderColor: isBlank ? "#d1d5db" : isGreen ? "#059669" : "#d1d5db",
                      }}
                    />
                    {displayChar && (
                      <span
                        className="font-black text-xl leading-none select-none"
                        style={{ color: isGreen ? "#fff" : "#1f2937", letterSpacing: "0.04em" }}
                      >
                        {displayChar}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <form
            key={isSignUp ? "signup" : "signin"}
            onSubmit={handleSubmit}
            className="flex flex-col flex-1 animate-fade-in min-h-0 mt-3"
            noValidate
          >
            {/* Fields — no fixed height, let content flow naturally */}
            <div className="space-y-3 shrink-0">
              {/* First/Last Name for Sign Up (same line, no placeholder clipping) */}
              {isSignUp && (
                <div className="grid grid-cols-2 gap-4 min-w-0">
                  <div className="min-w-0">
                    <AppInput
                      icon={UserIcon}
                      label="First Name"
                      placeholder="First"
                      value={firstName}
                      onChange={(e) => {
                        setFirstName(e.target.value);
                        setErrors((prev) => ({ ...prev, firstName: undefined }));
                      }}
                      clearable
                      onClear={() => setFirstName("")}
                      error={errors.firstName}
                    />
                  </div>
                  <div className="min-w-0">
                    <AppInput
                      icon={UserIcon}
                      label="Last Name"
                      placeholder="Last"
                      value={lastName}
                      onChange={(e) => {
                        setLastName(e.target.value);
                        setErrors((prev) => ({ ...prev, lastName: undefined }));
                      }}
                      clearable
                      onClear={() => setLastName("")}
                      error={errors.lastName}
                    />
                  </div>
                </div>
              )}

              <AppInput
                icon={Mail01Icon}
                label={isSignUp ? "Email Address" : "Email or Username"}
                placeholder={isSignUp ? "Email Address" : "Email or Username"}
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setErrors((prev) => ({ ...prev, email: undefined }));
                }}
                clearable
                onClear={() => setEmail("")}
                error={errors.email}
              />

              <div>
                <AppInput
                  icon={LockPasswordIcon}
                  label="Password"
                  placeholder="Password"
                  isPassword
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setErrors((prev) => ({ ...prev, password: undefined }));
                  }}
                  borderColor={
                    isSignUp && password.length > 0 && !errors.password
                      ? strengthColors[getPasswordStrengthScore(password)]
                      : undefined
                  }
                  strengthLabel={
                    isSignUp && password.length > 0 ? strengthLabels[getPasswordStrengthScore(password)] : undefined
                  }
                  strengthColor={
                    isSignUp && password.length > 0 ? strengthColors[getPasswordStrengthScore(password)] : undefined
                  }
                  error={errors.password}
                />
                {false && isSignUp && password.length > 0 && <PasswordStrengthBar password={password} />}
              </div>

              {!isSignUp && (
                <div className="flex items-center justify-between text-sm text-[#6B7280] pt-[18px]">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <div className="relative inline-flex items-center">
                      <input
                        type="checkbox"
                        checked={rememberMe}
                        onChange={(e) => setRememberMe(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-gray-300 rounded-full peer peer-checked:bg-[#10B981] after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all after:shadow-sm peer-checked:after:translate-x-4"></div>
                    </div>
                    <span className="font-medium select-none text-[#374151]">Remember me</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowForgotPassword(true)}
                    className="font-semibold text-[#10B981] hover:underline"
                  >
                    Forgot password?
                  </button>
                </div>
              )}
            </div>

            <div className="mt-4">
              <button
                type="submit"
                disabled={loading}
                className="w-full h-12 rounded-full bg-gradient-to-r from-[#10B981] to-[#059669] text-white font-bold text-sm shadow-lg hover:shadow-xl transform active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2 px-6"
              >
                <span className="text-center uppercase tracking-[0.35em]">
                  {loading ? "Please wait..." : isSignUp ? "Sign Up" : "Log In"}
                </span>

                {!loading && (
                  <HugeiconsIcon
                    icon={isSignUp ? UserAdd01Icon : LoginSquare01Icon}
                    size={18}
                    color="white"
                    strokeWidth={2}
                  />
                )}
              </button>

              {submitError && <p className="text-red-500 text-xs text-center font-semibold mt-2">{submitError}</p>}

              {/* Divider */}
              <div className="flex items-center gap-3 my-4">
                <div className="flex-1 h-px bg-[#E5E7EB]" />
                <span className="text-xs text-[#9CA3AF] font-medium">or continue with</span>
                <div className="flex-1 h-px bg-[#E5E7EB]" />
              </div>

              {/* Social sign-in buttons */}
              <div className="flex gap-3">
                {/* Google */}
                <button
                  type="button"
                  disabled={oauthLoading !== null}
                  onClick={() => handleOAuth("google")}
                  className="flex-1 h-11 flex items-center justify-center gap-2 rounded-full border border-[#E5E7EB] bg-white hover:bg-gray-50 active:scale-[0.98] transition-all shadow-sm disabled:opacity-50"
                >
                  {oauthLoading === "google" ? (
                    <span className="text-xs text-[#6B7280]">Loading…</span>
                  ) : (
                    <>
                      <svg width="18" height="18" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path
                          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                          fill="#4285F4"
                        />
                        <path
                          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                          fill="#34A853"
                        />
                        <path
                          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                          fill="#FBBC05"
                        />
                        <path
                          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                          fill="#EA4335"
                        />
                      </svg>
                      <span className="text-xs font-semibold text-[#374151]">Google</span>
                    </>
                  )}
                </button>

                {/* Apple */}
                <button
                  type="button"
                  disabled={oauthLoading !== null}
                  onClick={() => handleOAuth("apple")}
                  className="flex-1 h-11 flex items-center justify-center gap-2 rounded-full border border-[#E5E7EB] bg-black hover:bg-gray-900 active:scale-[0.98] transition-all shadow-sm disabled:opacity-50"
                >
                  {oauthLoading === "apple" ? (
                    <span className="text-xs text-white">Loading…</span>
                  ) : (
                    <>
                      <svg width="16" height="16" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="white">
                        <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
                      </svg>
                      <span className="text-xs font-semibold text-white">Apple</span>
                    </>
                  )}
                </button>
              </div>

              {oauthError && <p className="text-red-500 text-xs text-center font-semibold mt-2">{oauthError}</p>}

              <p className="text-center text-sm text-[#6B7280] mt-[16px] mb-1">
                {isSignUp ? "Already have an account?" : "Don't have an account?"}{" "}
                <button
                  type="button"
                  onClick={() => {
                    setIsSignUp(!isSignUp);
                    setErrors({});
                    setSubmitError(null);
                  }}
                  className="text-[#10B981] font-bold hover:underline"
                >
                  {isSignUp ? "Sign In" : "Sign Up"}
                </button>
              </p>
            </div>
          </form>
        </div>
      </div>

      {/* --- ALL ALERT DIALOGS --- */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent className="max-w-xs rounded-xl bg-white p-4">
          <AlertDialogHeader className="space-y-1">
            <AlertDialogTitle className="text-lg font-bold text-[#2E4A4A]">Confirm Password</AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-[#6B7B7B]">
              Re-enter your password to finish.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-2">
            <div className="form-group">
              <AppInput
                isPassword
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                autoFocus
              />
            </div>
            {confirmError && <p className="text-red-500 text-[10px] mt-1 font-bold">{confirmError}</p>}
          </div>
          <AlertDialogFooter className="flex-row gap-2 mt-2">
            <AlertDialogAction
              onClick={handleConfirmSignUp}
              className="w-full bg-[#10B981] hover:bg-[#059669] text-xs py-1"
            >
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showLoginError} onOpenChange={setShowLoginError}>
        <AlertDialogContent className="max-w-xs rounded-xl bg-white p-4 pt-10 overflow-visible">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-[#FEE2E2] flex items-center justify-center shadow-sm">
            <HugeiconsIcon icon={AlertCircleIcon} size={18} color="#EF4444" strokeWidth={1.5} />
          </div>
          <AlertDialogHeader className="space-y-1 text-center">
            <AlertDialogTitle className="text-lg font-bold text-[#2E4A4A] text-center">Incorrect Credentials</AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-[#6B7B7B] text-center">
              Credentials didn't match. Please check your email and password and try again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row gap-2 mt-3">
            <AlertDialogAction onClick={handleTryAgain} className="w-full bg-[#EF4444] hover:bg-[#DC2626] text-xs py-1">
              Try Again
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showForgotPassword} onOpenChange={setShowForgotPassword}>
        <AlertDialogContent className="max-w-xs rounded-xl bg-white p-4">
          <AlertDialogHeader className="space-y-1">
            <AlertDialogTitle className="text-lg">{forgotSuccess ? "Success" : "Reset Password"}</AlertDialogTitle>
            <AlertDialogDescription className="text-xs">
              {forgotSuccess ? "Check your email for instructions." : "Enter your email to receive a reset link."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {!forgotSuccess && (
            <div className="py-2">
              <input
                type="email"
                value={forgotEmail}
                onChange={(e) => setForgotEmail(e.target.value)}
                placeholder="Email"
                className="w-full p-2 text-sm border rounded bg-gray-50 focus:outline-[#10B981]"
              />
              {forgotError && <p className="text-red-500 text-[10px] mt-1 font-bold">{forgotError}</p>}
            </div>
          )}
          <AlertDialogFooter className="mt-2 flex-row gap-2">
            {!forgotSuccess && (
              <button
                type="button"
                onClick={() => {
                  setShowForgotPassword(false);
                  setForgotEmail("");
                  setForgotError(null);
                }}
                className="flex-1 h-9 rounded-lg border border-[#E5E7EB] bg-white text-xs font-semibold text-[#374151] hover:bg-gray-50 active:scale-[0.98] transition-all"
              >
                Back
              </button>
            )}
            <AlertDialogAction
              onClick={
                forgotSuccess
                  ? () => {
                      setShowForgotPassword(false);
                      setForgotSuccess(false);
                      setForgotEmail("");
                    }
                  : handleForgotPassword
              }
              className="flex-1 bg-[#10B981] hover:bg-[#059669] text-xs py-1"
            >
              {forgotSuccess ? "Done" : forgotLoading ? "Sending..." : "Send Link"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AuthPage;
