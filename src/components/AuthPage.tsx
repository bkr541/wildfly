import { useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faEye, faEyeSlash, faEnvelope, faUser } from "@fortawesome/free-regular-svg-icons";
import { faFingerprint } from "@fortawesome/free-solid-svg-icons";
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
      <style>{`
        .satyam-container button {
          border: none;
          background: none;
          color: #9ca3af;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        /* ✅ One single source of truth for input background */
        .satyam-container {
          --timing: 0.3s;
          --width-of-input: 100%;
          --min-height-of-input: 48px;
          --border-height: 2px;

          /* This is the First Name field color you're seeing */
          --input-bg: #eef0f3;

          --border-color: #10B981;
          --border-radius: 12px;
          --after-border-radius: 4px;
          position: relative;
          width: var(--width-of-input);
          min-height: var(--min-height-of-input);
          display: flex;
          align-items: center;
          padding-inline: 0.8em;
          border-radius: var(--border-radius);
          transition: border-radius 0.5s ease;
          background: var(--input-bg);
        }

        /* ✅ Force any nested input wrappers to not paint their own background */
        .satyam-container * {
          background-color: transparent !important;
        }

        .satyam-container.satyam-error {
          --border-color: #f87171;
          border-bottom: 2px solid #f87171;
        }
        .satyam-container.satyam-error > button {
          color: #f87171 !important;
        }
        .satyam-input {
          font-size: 0.875rem;
          background-color: transparent;
          width: 100%;
          height: 100%;
          padding-inline: 0.5em;
          padding-block: 0.7em;
          border: none;
          color: #1F2937;
        }
        .satyam-container:before {
          content: "";
          position: absolute;
          background: var(--border-color);
          transform: scaleX(0);
          transform-origin: center;
          width: 100%;
          height: var(--border-height);
          left: 0;
          bottom: 0;
          border-radius: 1px;
          transition: transform var(--timing) ease;
        }
        .satyam-container:focus-within {
          border-radius: var(--after-border-radius);
        }
        .satyam-input:focus {
          outline: none;
        }
        .satyam-container:focus-within:before {
          transform: scale(1);
        }
        .satyam-reset {
          border: none;
          background: none;
          opacity: 0;
          visibility: hidden;
          cursor: pointer;
        }
        .satyam-input:not(:placeholder-shown) ~ .satyam-reset {
          opacity: 1;
          visibility: visible;
        }
        .satyam-toggle {
          border: none;
          background: none;
          cursor: pointer;
        }
      `}</style>

      {/* Top section with logo */}
      <div className="flex-shrink-0 flex items-center justify-center pt-10 pb-4 z-10">
        <img src="/assets/logo/wflogo2.png" alt="Logo" className="h-24 md:h-28 w-auto object-contain" />
      </div>

      {/* White card form */}
      <div className="flex-1 flex flex-col items-center justify-end z-10">
        <div className="w-full max-w-md bg-white/95 backdrop-blur-md rounded-t-[2rem] px-7 pt-8 pb-10 shadow-2xl min-h-[480px]">
          <form
            key={isSignUp ? "signup" : "signin"}
            onSubmit={handleSubmit}
            className="space-y-4 animate-fade-in"
            noValidate
          >
            {/* First/Last Name for Sign Up */}
            {isSignUp && (
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-semibold text-[#10B981] ml-1 mb-1 block">First Name</label>
                  <div className={`satyam-container ${errors.firstName ? "satyam-error" : ""}`}>
                    <button type="button" tabIndex={-1}>
                      <FontAwesomeIcon icon={faUser} className="w-5 h-5" />
                    </button>
                    <input
                      type="text"
                      value={firstName}
                      onChange={(e) => {
                        setFirstName(e.target.value);
                        setErrors((prev) => ({ ...prev, firstName: undefined }));
                      }}
                      placeholder="First Name"
                      className="satyam-input"
                    />
                    <button
                      type="button"
                      className="satyam-reset hover:text-[#f87171] transition-colors"
                      onClick={() => setFirstName("")}
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-5 w-5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"></path>
                      </svg>
                    </button>
                  </div>
                  {errors.firstName && (
                    <p className="text-red-400 text-[10px] mt-0.5 ml-1 font-bold">{errors.firstName}</p>
                  )}
                </div>

                <div>
                  <label className="text-sm font-semibold text-[#10B981] ml-1 mb-1 block">Last Name</label>
                  <div className={`satyam-container ${errors.lastName ? "satyam-error" : ""}`}>
                    <button type="button" tabIndex={-1}>
                      <FontAwesomeIcon icon={faUser} className="w-5 h-5" />
                    </button>
                    <input
                      type="text"
                      value={lastName}
                      onChange={(e) => {
                        setLastName(e.target.value);
                        setErrors((prev) => ({ ...prev, lastName: undefined }));
                      }}
                      placeholder="Last Name"
                      className="satyam-input"
                    />
                    <button
                      type="button"
                      className="satyam-reset hover:text-[#f87171] transition-colors"
                      onClick={() => setLastName("")}
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-5 w-5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"></path>
                      </svg>
                    </button>
                  </div>
                  {errors.lastName && (
                    <p className="text-red-400 text-[10px] mt-0.5 ml-1 font-bold">{errors.lastName}</p>
                  )}
                </div>
              </div>
            )}

            {/* Email Input */}
            <div>
              <label className="text-sm font-semibold text-[#10B981] ml-1 mb-1 block">
                {isSignUp ? "Email Address" : "Email or Username"}
              </label>
              <div className={`satyam-container ${errors.email ? "satyam-error" : ""}`}>
                <button type="button" tabIndex={-1}>
                  <FontAwesomeIcon icon={faEnvelope} className="w-5 h-5" />
                </button>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setErrors((prev) => ({ ...prev, email: undefined }));
                  }}
                  placeholder={isSignUp ? "Enter Email Address" : "Enter Email or Username"}
                  className="satyam-input"
                />
                <button
                  type="button"
                  className="satyam-reset hover:text-[#f87171] transition-colors"
                  onClick={() => setEmail("")}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"></path>
                  </svg>
                </button>
              </div>
              {errors.email && <p className="text-red-400 text-[10px] mt-0.5 ml-1 font-bold">{errors.email}</p>}
            </div>

            {/* Password Input */}
            <div>
              <label className="text-sm font-semibold text-[#10B981] ml-1 mb-1 block">Password</label>
              <div
                className={`satyam-container ${errors.password ? "satyam-error" : ""}`}
                style={isSignUp && password.length > 0 && !errors.password ? { '--border-color': strengthColors[getPasswordStrengthScore(password)] } as React.CSSProperties : undefined}
              >
                <button type="button" tabIndex={-1}>
                  <FontAwesomeIcon icon={faFingerprint} className="w-5 h-5" />
                </button>

                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setErrors((prev) => ({ ...prev, password: undefined }));
                  }}
                  placeholder="Enter Password"
                  className="satyam-input flex-1"
                />

                <button
                  type="button"
                  className="satyam-toggle hover:text-[#10B981] transition-colors"
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex={-1}
                >
                  <FontAwesomeIcon icon={showPassword ? faEyeSlash : faEye} className="w-5 h-5" />
                </button>
              </div>

              {/* Password strength bar (Sign Up only) */}
              {isSignUp && password.length > 0 && (
                <PasswordStrengthBar password={password} />
              )}

              {errors.password && (
                <p className="text-red-400 text-[10px] mt-0.5 ml-1 font-bold">{errors.password}</p>
              )}
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
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-xl bg-gradient-to-r from-[#10B981] to-[#059669] text-white font-bold text-base shadow-lg hover:shadow-xl transform active:scale-[0.98] transition-all disabled:opacity-50"
            >
              {loading ? "Please wait..." : isSignUp ? "Sign Up" : "Login"}
            </button>

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
                <FontAwesomeIcon icon={showConfirmPassword ? faEyeSlash : faEye} className="w-3.5 h-3.5" />
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
