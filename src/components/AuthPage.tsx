import { useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faEye, faEyeSlash } from "@fortawesome/free-solid-svg-icons";
import { supabase } from "@/integrations/supabase/client";
import DecorativeCircles from "./DecorativeCircles";
import mainLogo from "@/assets/mainlogo.png";
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
  confirmPassword?: string;
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

      onSignIn(profile.onboarding_complete === "No");
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

      // If user already exists in auth, try signing in instead
      if (authError && (authError.message.toLowerCase().includes("already") || authError.message.toLowerCase().includes("registered"))) {
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

        if (signInError) {
          setSubmitError("An account with this email already exists. Please sign in instead.");
          return;
        }

        if (signInData.user) {
          // Check if profile exists, create if missing
          const { data: existingProfile } = await supabase
            .from("user_info")
            .select("id")
            .eq("auth_user_id", signInData.user.id)
            .maybeSingle();

          if (!existingProfile) {
            await supabase.from("user_info").insert({
              auth_user_id: signInData.user.id,
              email: email.trim(),
              first_name: firstName.trim(),
              last_name: lastName.trim(),
              onboarding_complete: "No",
              image_file: "",
            });
          }

          onSignIn(true);
          return;
        }
      }

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

  const inputBase =
    "w-full px-4 py-3 rounded-lg bg-[#1A4E54] text-foreground placeholder:text-muted-foreground outline-none transition-all";
  const inputNormal = `${inputBase} border border-border focus:ring-2 focus:ring-accent-blue`;
  const inputError = `${inputBase} border border-destructive focus:ring-2 focus:ring-destructive`;

  return (
    <div className="relative flex flex-col min-h-screen bg-background overflow-hidden">
      <DecorativeCircles />

      {/* Logo: larger + less padding so it doesn't feel tiny or distant */}
      <div className="w-full flex justify-center pt-8 pb-2 relative z-10">
        <img src={mainLogo} alt="WildFly logo" className="h-32 md:h-36 w-auto max-w-[280px] object-contain" />
      </div>

      {/* Main: remove vertical centering to eliminate giant gap */}
      <div className="flex-1 flex flex-col items-center justify-start px-8 pt-2 pb-10 relative z-10">
        <h1 className="text-3xl font-bold text-foreground mb-6">{isSignUp ? "Sign Up" : "Sign In"}</h1>

        <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-5" noValidate>
          {isSignUp && (
            <div className="grid grid-cols-2 gap-3">
              <div className="form-group">
                <label className="block text-xs font-semibold text-muted-foreground tracking-widest uppercase mb-2">
                  First Name
                </label>
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => {
                    setFirstName(e.target.value);
                    setErrors((prev) => ({ ...prev, firstName: undefined }));
                  }}
                  placeholder="First"
                  className={errors.firstName ? inputError : inputNormal}
                />
                {errors.firstName && <p className="text-destructive text-xs mt-1">{errors.firstName}</p>}
              </div>

              <div className="form-group">
                <label className="block text-xs font-semibold text-muted-foreground tracking-widest uppercase mb-2">
                  Last Name
                </label>
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => {
                    setLastName(e.target.value);
                    setErrors((prev) => ({ ...prev, lastName: undefined }));
                  }}
                  placeholder="Last"
                  className={errors.lastName ? inputError : inputNormal}
                />
                {errors.lastName && <p className="text-destructive text-xs mt-1">{errors.lastName}</p>}
              </div>
            </div>
          )}

          <div className="form-group">
            <label className="block text-xs font-semibold text-muted-foreground tracking-widest uppercase mb-2">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setErrors((prev) => ({ ...prev, email: undefined }));
              }}
              placeholder="you@example.com"
              className={errors.email ? inputError : inputNormal}
            />
            {errors.email && <p className="text-destructive text-xs mt-1">{errors.email}</p>}
          </div>

          <div className="form-group">
            <label className="block text-xs font-semibold text-muted-foreground tracking-widest uppercase mb-2">
              Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setErrors((prev) => ({ ...prev, password: undefined }));
                }}
                placeholder="••••••••"
                className={errors.password ? inputError : inputNormal}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                tabIndex={-1}
              >
                {showPassword ? <FontAwesomeIcon icon={faEyeSlash} className="w-[18px] h-[18px]" /> : <FontAwesomeIcon icon={faEye} className="w-[18px] h-[18px]" />}
              </button>
            </div>
            {errors.password && <p className="text-destructive text-xs mt-1">{errors.password}</p>}
          </div>

          {!isSignUp && (
            <div className="flex justify-end mt-1">
              <button
                type="button"
                onClick={() => {
                  setForgotEmail(email);
                  setForgotError(null);
                  setForgotSuccess(false);
                  setShowForgotPassword(true);
                }}
                className="text-xs text-accent-blue font-semibold hover:underline"
              >
                Forgot My Password
              </button>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 mt-4 rounded-lg bg-foreground text-background font-bold text-sm tracking-widest uppercase hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {loading ? "Please wait..." : isSignUp ? "Sign Up" : "Sign In"}
          </button>

          {submitError && <p className="text-destructive text-sm text-center mt-2">{submitError}</p>}
        </form>

        <p className="mt-8 text-muted-foreground text-sm">
          {isSignUp ? "Already have an account?" : "Don't have an account?"}{" "}
          <button
            onClick={() => {
              setIsSignUp(!isSignUp);
              setErrors({});
            }}
            className="text-accent-blue font-semibold hover:underline"
          >
            {isSignUp ? "Sign In" : "Sign Up"}
          </button>
        </p>
      </div>

      {/* Confirm Password Dialog */}
      {showConfirmDialog && (
        <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
          <AlertDialogContent className="max-w-xs rounded-2xl">
            <AlertDialogHeader>
              <AlertDialogTitle>Confirm Password</AlertDialogTitle>
              <AlertDialogDescription>Please re-enter your password to complete registration.</AlertDialogDescription>
            </AlertDialogHeader>
            <div className="px-6 pb-2">
              <div className="relative">
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    setConfirmError(null);
                  }}
                  placeholder="••••••••"
                  className={confirmError ? inputError : inputNormal}
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  tabIndex={-1}
                >
                  {showConfirmPassword ? <FontAwesomeIcon icon={faEyeSlash} className="w-[18px] h-[18px]" /> : <FontAwesomeIcon icon={faEye} className="w-[18px] h-[18px]" />}
                </button>
              </div>
              {confirmError && <p className="text-destructive text-xs mt-2">{confirmError}</p>}
            </div>
            <AlertDialogFooter>
              <AlertDialogAction onClick={handleConfirmSignUp}>Confirm & Sign Up</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {showLoginError && (
        <AlertDialog open={showLoginError} onOpenChange={setShowLoginError}>
          <AlertDialogContent className="max-w-xs rounded-2xl">
            <AlertDialogHeader>
              <AlertDialogTitle>Login Failed</AlertDialogTitle>
              <AlertDialogDescription>
                The email and password combination is not correct. Please try again.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogAction onClick={handleTryAgain}>Try Again</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {/* Forgot Password Dialog */}
      {showForgotPassword && (
        <AlertDialog
          open={showForgotPassword}
          onOpenChange={(open) => {
            setShowForgotPassword(open);
            if (!open) setForgotSuccess(false);
          }}
        >
          <AlertDialogContent className="max-w-xs rounded-2xl">
            <AlertDialogHeader>
              <AlertDialogTitle>{forgotSuccess ? "Email Sent" : "Reset Password"}</AlertDialogTitle>
              <AlertDialogDescription>
                {forgotSuccess
                  ? "If an account exists with that email, a password reset link has been sent."
                  : "Enter your email address and we'll send you a link to reset your password."}
              </AlertDialogDescription>
            </AlertDialogHeader>

            {!forgotSuccess && (
              <div className="px-6 pb-2">
                <div className="form-group">
                  <input
                    type="email"
                    value={forgotEmail}
                    onChange={(e) => {
                      setForgotEmail(e.target.value);
                      setForgotError(null);
                    }}
                    placeholder="you@example.com"
                    className={forgotError ? inputError : inputNormal}
                    autoFocus
                  />
                </div>
                {forgotError && <p className="text-destructive text-xs mt-2">{forgotError}</p>}
              </div>
            )}

            <AlertDialogFooter>
              {forgotSuccess ? (
                <AlertDialogAction onClick={() => setShowForgotPassword(false)}>Done</AlertDialogAction>
              ) : (
                <AlertDialogAction onClick={handleForgotPassword} disabled={forgotLoading}>
                  {forgotLoading ? "Sending..." : "Send Reset Link"}
                </AlertDialogAction>
              )}
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
};

export default AuthPage;
