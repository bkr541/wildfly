import { useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ViewIcon,
  ViewOffSlashIcon,
  Mail01Icon,
  UserIcon,
  LockPasswordIcon,
  LoginCircle01Icon,
  UserAdd01Icon,
} from "@hugeicons/core-free-icons";
import { AppInput } from "@/components/ui/app-input";
import { supabase } from "@/integrations/supabase/client";
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
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: email.trim(),
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
      const { error: profileError } = await supabase.from("user_info").insert({
        auth_user_id: authData.user.id,
        email: email.trim(),
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        onboarding_complete: "No",
        image_file: "",
      });
      if (profileError) {
        setSubmitError(profileError.message);
        return;
      }
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

  const handleTryAgain = () => {
    setEmail("");
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

  return (
    <div
      className="relative flex flex-col min-h-screen bg-cover bg-center bg-no-repeat overflow-hidden"
      style={{ backgroundImage: "url('/assets/authuser/newbg3.png')" }}
    >
      {/* Top section with logo */}
      <div className="flex-shrink-0 flex items-center justify-center pt-10 pb-4 z-10">
        <img src="/assets/logo/wflogo2.png" alt="Logo" className="h-24 md:h-28 w-auto object-contain" />
      </div>

      {/* White card form */}
      <div className="flex-1 flex flex-col items-center justify-end z-10">
        <div className="w-full max-w-md bg-white/95 backdrop-blur-md rounded-t-[2rem] px-7 pt-8 pb-10 shadow-2xl min-h-[480px]">
          {/* LOGIN label (H1-style) */}
          <div className="w-full text-left mb-6">
            <h1 className="text-3xl leading-none text-[#111827] uppercase tracking-[0.12em]">
              <span className="font-[200]">LOG</span>
              <span className="font-[600]">IN</span>
            </h1>
          </div>

          <form
            key={isSignUp ? "signup" : "signin"}
            onSubmit={handleSubmit}
            className="space-y-4 animate-fade-in"
            noValidate
          >
            {/* First/Last Name for Sign Up */}
            {isSignUp && (
              <div className="space-y-4">
                <AppInput
                  icon={UserIcon}
                  label="First Name"
                  placeholder="First Name"
                  value={firstName}
                  onChange={(e) => {
                    setFirstName(e.target.value);
                    setErrors((prev) => ({ ...prev, firstName: undefined }));
                  }}
                  clearable
                  onClear={() => setFirstName("")}
                  error={errors.firstName}
                />
                <AppInput
                  icon={UserIcon}
                  label="Last Name"
                  placeholder="Last Name"
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
            )}

            {/* Email Input */}
            <AppInput
              icon={Mail01Icon}
              label={isSignUp ? "Email Address" : "Email or Username"}
              placeholder={isSignUp ? "Enter Email Address" : "Enter Email or Username"}
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

            {/* Password Input */}
            <div>
              <AppInput
                icon={LockPasswordIcon}
                label="Password"
                placeholder="Enter Password"
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
                error={errors.password}
              />
              {/* Password strength bar (Sign Up only) */}
              {isSignUp && password.length > 0 && <PasswordStrengthBar password={password} />}
            </div>

            {/* Remember Me & Forgot Password (Only on Sign In) */}
            {!isSignUp && (
              <div className="flex items-center justify-between text-sm text-[#6B7280]">
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

            {/* Submit Button */}
            <div className={!isSignUp ? "pt-2" : ""}>
              <button
                type="submit"
                disabled={loading}
                className="w-full h-12 rounded-full bg-gradient-to-r from-[#10B981] to-[#059669] text-white font-bold text-sm shadow-lg hover:shadow-xl transform active:scale-[0.98] transition-all disabled:opacity-50 flex items-center pl-6 pr-1"
              >
                <span className="flex-1 text-center uppercase tracking-[0.35em]">
                  {loading ? "Please wait..." : isSignUp ? "Sign Up" : "Log In"}
                </span>

                {!loading && (
                  <span className="inline-flex items-center justify-center w-11 h-11 rounded-full bg-white text-[#1a1a1a]">
                    <HugeiconsIcon
                      icon={isSignUp ? UserAdd01Icon : LoginCircle01Icon}
                      size={18}
                      color="currentColor"
                      strokeWidth={2}
                    />
                  </span>
                )}
              </button>
            </div>

            {submitError && <p className="text-red-500 text-xs text-center font-semibold">{submitError}</p>}
          </form>

          {/* Toggle Sign In / Sign Up - below form */}
          <p className="text-center text-sm text-[#6B7280] mt-5">
            {isSignUp ? "Already have an account?" : "Don't have an account?"}{" "}
            <button
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
      </div>

      {/* --- ALL ALERT DIALOGS --- */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent className="max-w-xs rounded-xl bg-white p-4">
          <AlertDialogHeader className="space-y-1">
            <AlertDialogTitle className="text-lg">Confirm Password</AlertDialogTitle>
            <AlertDialogDescription className="text-xs">Re-enter your password to finish.</AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-2">
            <div className="relative">
              <input
                type={showConfirmPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full p-2 text-sm border rounded bg-gray-50 focus:outline-[#10B981]"
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400"
              >
                <HugeiconsIcon
                  icon={showConfirmPassword ? ViewOffSlashIcon : ViewIcon}
                  size={14}
                  color="currentColor"
                  strokeWidth={1.5}
                />
              </button>
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
        <AlertDialogContent className="max-w-xs rounded-xl bg-white p-4 text-center">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-lg">Login Failed</AlertDialogTitle>
            <AlertDialogDescription className="text-xs">
              Credentials didn't match. Please try again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-2">
            <AlertDialogAction onClick={handleTryAgain} className="bg-[#10B981] w-full text-xs py-1">
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
          <AlertDialogFooter className="mt-2">
            <AlertDialogAction onClick={handleForgotPassword} className="bg-[#10B981] w-full text-xs py-1">
              {forgotSuccess ? "Done" : forgotLoading ? "Sending..." : "Send Link"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AuthPage;
