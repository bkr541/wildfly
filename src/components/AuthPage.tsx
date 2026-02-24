import { useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faEye, faEyeSlash, faEnvelope, faLock } from "@fortawesome/free-solid-svg-icons"; // Added envelope/lock to match the image icons
import { supabase } from "@/integrations/supabase/client";
import mainLogo from "@/assets/mainlogo.png";
import PasswordStrengthInput, { isPasswordStrong } from "./PasswordStrengthInput";
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

  // LOGIC: Same as your original file
  const validateSignUp = (): boolean => {
    const newErrors: FieldErrors = {};
    if (!firstName.trim()) newErrors.firstName = "First name is required";
    if (!lastName.trim()) newErrors.lastName = "Last name is required";
    if (!email.trim()) {
      newErrors.email = "Email is required";
    } else if (!emailRegex.test(email.trim())) {
      newErrors.email = "Please enter a valid email address";
    }
    if (!password) {
      newErrors.password = "Password is required";
    } else if (!isPasswordStrong(password)) {
      newErrors.password = "Password does not meet all requirements";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateSignIn = (): boolean => {
    const newErrors: FieldErrors = {};
    if (!email.trim()) {
      newErrors.email = "Email is required";
    } else if (!emailRegex.test(email.trim())) {
      newErrors.email = "Please enter a valid email address";
    }
    if (!password) newErrors.password = "Password is required";
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
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
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
      if (!profile) {
        await supabase.from("user_info").insert({
          auth_user_id: authData.user.id,
          email: email.trim(),
          onboarding_complete: "No",
          image_file: "",
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
        setSubmitError("Check your email to confirm your account, then sign in.");
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
    if (!forgotEmail.trim()) {
      setForgotError("Email is required");
      return;
    }
    if (!emailRegex.test(forgotEmail.trim())) {
      setForgotError("Please enter a valid email address");
      return;
    }
    setForgotLoading(true);
    setForgotError(null);
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
      setForgotError("Something went wrong. Please try again.");
    } finally {
      setForgotLoading(false);
    }
  };

  // UI STYLING: Restored functionality + Image design
  const inputBase =
    "w-full px-10 py-3 rounded-lg bg-[#2D3748] text-white placeholder:text-gray-400 outline-none transition-all";
  const inputNormal = `${inputBase} border border-transparent focus:border-[#10B981]`;
  const inputErrorStyle = `${inputBase} border border-red-500 focus:border-red-500`;

  return (
    <div
      className="relative flex flex-col min-h-screen bg-cover bg-center bg-no-repeat overflow-hidden"
      style={{ backgroundImage: "url('/assets/authuser/authuser_background.png')" }}
    >
      <div className="flex-1 flex flex-col items-center justify-center px-8 z-10">
        {/* Welcome Text Section */}
        <div className="text-center mb-6">
          <img src="/assets/logo/wflogo1.png" alt="Logo" className="h-24 w-auto mx-auto mb-4 object-contain" />
          <h1 className="text-5xl font-semibold text-[#1F2937] mb-2">Welcome</h1>
          <p className="text-[#4B5563] text-lg">Sign In Your Account</p>
        </div>

        <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4" noValidate>
          {/* First/Last Name for Sign Up */}
          {isSignUp && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-500 uppercase ml-1">First Name</label>
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="First"
                  className={errors.firstName ? inputErrorStyle : inputNormal}
                />
                {errors.firstName && <p className="text-red-500 text-[10px] mt-1">{errors.firstName}</p>}
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-500 uppercase ml-1">Last Name</label>
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Last"
                  className={errors.lastName ? inputErrorStyle : inputNormal}
                />
                {errors.lastName && <p className="text-red-500 text-[10px] mt-1">{errors.lastName}</p>}
              </div>
            </div>
          )}

          {/* Email Input */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-500 uppercase ml-1">Email</label>
            <div className="relative">
              <FontAwesomeIcon
                icon={faEnvelope}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm"
              />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email"
                className={errors.email ? inputErrorStyle : inputNormal}
              />
            </div>
            {errors.email && <p className="text-red-500 text-[10px] mt-1">{errors.email}</p>}
          </div>

          {/* Password Input (Functionality Restored) */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-500 uppercase ml-1">Password</label>
            {isSignUp ? (
              <PasswordStrengthInput
                value={password}
                onChange={(val) => setPassword(val)}
                showPassword={showPassword}
                onToggleVisibility={() => setShowPassword(!showPassword)}
                error={errors.password}
                inputClassName={errors.password ? inputErrorStyle : inputNormal}
              />
            ) : (
              <div className="relative">
                <FontAwesomeIcon
                  icon={faLock}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm"
                />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password"
                  className={errors.password ? inputErrorStyle : inputNormal}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
                  tabIndex={-1}
                >
                  <FontAwesomeIcon icon={showPassword ? faEyeSlash : faEye} className="w-[16px] h-[16px]" />
                </button>
              </div>
            )}
            {errors.password && <p className="text-red-500 text-[10px] mt-1">{errors.password}</p>}
          </div>

          {/* Options Row */}
          <div className="flex items-center justify-between text-sm text-[#4B5563]">
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                className="w-4 h-4 rounded border-gray-300 text-[#10B981] focus:ring-[#10B981] bg-[#2D3748]"
              />
              <span className="font-medium">Keep Me Signed In</span>
            </label>
            {!isSignUp && (
              <button
                type="button"
                onClick={() => setShowForgotPassword(true)}
                className="font-medium hover:text-[#10B981] transition-colors"
              >
                Forgot Password?
              </button>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 mt-2 rounded-xl bg-[#10B981] text-white font-bold text-xl shadow-lg hover:bg-[#059669] transform hover:-translate-y-0.5 transition-all active:scale-[0.98] disabled:opacity-50"
          >
            {loading ? "Please wait..." : isSignUp ? "Sign Up" : "Sign In"}
          </button>

          {submitError && <p className="text-red-500 text-sm text-center mt-2">{submitError}</p>}
        </form>

        <p className="mt-8 text-gray-600 font-medium">
          {isSignUp ? "Already have an account?" : "Don't have an account?"}{" "}
          <button onClick={() => setIsSignUp(!isSignUp)} className="text-[#10B981] font-bold hover:underline">
            {isSignUp ? "Sign In" : "Sign Up"}
          </button>
        </p>
      </div>

      {/* ALERT DIALOGS: Full logic restored from original */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent className="max-w-xs rounded-2xl bg-white">
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Password</AlertDialogTitle>
            <AlertDialogDescription>Please re-enter your password to complete registration.</AlertDialogDescription>
          </AlertDialogHeader>
          <div className="px-6 pb-2">
            <div className="relative">
              <input
                type={showConfirmPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                className={confirmError ? "w-full p-2 border border-red-500 rounded" : "w-full p-2 border rounded"}
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
              >
                <FontAwesomeIcon icon={showConfirmPassword ? faEyeSlash : faEye} />
              </button>
            </div>
            {confirmError && <p className="text-red-500 text-xs mt-2">{confirmError}</p>}
          </div>
          <AlertDialogFooter>
            <AlertDialogAction onClick={handleConfirmSignUp} className="bg-[#10B981] hover:bg-[#059669]">
              Confirm & Sign Up
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Login Error Alert */}
      <AlertDialog open={showLoginError} onOpenChange={setShowLoginError}>
        <AlertDialogContent className="max-w-xs rounded-2xl bg-white text-center">
          <AlertDialogHeader>
            <AlertDialogTitle>Login Failed</AlertDialogTitle>
            <AlertDialogDescription>The email and password combination is not correct.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="sm:justify-center">
            <AlertDialogAction onClick={handleTryAgain} className="bg-[#10B981]">
              Try Again
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Forgot Password Dialog */}
      <AlertDialog open={showForgotPassword} onOpenChange={setShowForgotPassword}>
        <AlertDialogContent className="max-w-xs rounded-2xl bg-white">
          <AlertDialogHeader>
            <AlertDialogTitle>{forgotSuccess ? "Email Sent" : "Reset Password"}</AlertDialogTitle>
            <AlertDialogDescription>
              {forgotSuccess ? "Check your email for the reset link." : "Enter your email to reset your password."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {!forgotSuccess && (
            <div className="px-6 pb-2">
              <input
                type="email"
                value={forgotEmail}
                onChange={(e) => setForgotEmail(e.target.value)}
                placeholder="Email"
                className="w-full p-2 border rounded"
              />
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogAction onClick={handleForgotPassword} className="bg-[#10B981]">
              {forgotSuccess ? "Done" : "Send Link"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AuthPage;
