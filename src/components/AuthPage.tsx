import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
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

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [errors, setErrors] = useState<FieldErrors>({});
  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [showPassword, setShowPassword] = useState(false);

  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);

  const [showLoginError, setShowLoginError] = useState(false);

  const validateSignIn = () => {
    const nextErrors: FieldErrors = {};
    if (!emailRegex.test(email.trim())) nextErrors.email = "Enter a valid email";
    if (!password || password.length < 6) nextErrors.password = "Password must be at least 6 characters";
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const validateSignUp = () => {
    const nextErrors: FieldErrors = {};
    if (!firstName.trim()) nextErrors.firstName = "First name is required";
    if (!lastName.trim()) nextErrors.lastName = "Last name is required";
    if (!emailRegex.test(email.trim())) nextErrors.email = "Enter a valid email";
    if (!password || password.length < 6) nextErrors.password = "Password must be at least 6 characters";
    if (!confirmPassword) nextErrors.confirmPassword = "Confirm your password";
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
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

      // ✅ Rule: if onboarding_complete !== "Yes", go to onboarding.
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

      // If email confirmations are enabled, Supabase may return no session here.
      // In that case, we can't proceed to onboarding because the user isn't signed in yet.
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

  return (
    <div className="min-h-screen w-full flex flex-col justify-center items-center relative overflow-hidden">
      <DecorativeCircles />

      <div className="w-full max-w-[480px] px-8">
        <div className="flex flex-col items-center mb-10">
          <img src={mainLogo} alt="logo" className="w-20 h-20 mb-5" />
          <h1 className="text-3xl font-bold text-foreground">{isSignUp ? "Create Account" : "Welcome Back"}</h1>
          <p className="text-muted-foreground mt-2">{isSignUp ? "Sign up to get started" : "Sign in to continue"}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {isSignUp && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-muted-foreground">First name</label>
                <input
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="w-full mt-1 px-4 py-3 rounded-xl bg-muted text-foreground outline-none"
                />
                {errors.firstName && <p className="text-xs text-red-500 mt-1">{errors.firstName}</p>}
              </div>

              <div>
                <label className="text-sm text-muted-foreground">Last name</label>
                <input
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="w-full mt-1 px-4 py-3 rounded-xl bg-muted text-foreground outline-none"
                />
                {errors.lastName && <p className="text-xs text-red-500 mt-1">{errors.lastName}</p>}
              </div>
            </div>
          )}

          <div>
            <label className="text-sm text-muted-foreground">Email</label>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full mt-1 px-4 py-3 rounded-xl bg-muted text-foreground outline-none"
              autoComplete="email"
            />
            {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email}</p>}
          </div>

          <div>
            <label className="text-sm text-muted-foreground">Password</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full mt-1 px-4 py-3 rounded-xl bg-muted text-foreground outline-none pr-12"
                autoComplete={isSignUp ? "new-password" : "current-password"}
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {errors.password && <p className="text-xs text-red-500 mt-1">{errors.password}</p>}
          </div>

          {isSignUp && (
            <div>
              <label className="text-sm text-muted-foreground">Confirm password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full mt-1 px-4 py-3 rounded-xl bg-muted text-foreground outline-none"
                autoComplete="new-password"
              />
              {errors.confirmPassword && <p className="text-xs text-red-500 mt-1">{errors.confirmPassword}</p>}
            </div>
          )}

          {submitError && <p className="text-sm text-red-500">{submitError}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-semibold disabled:opacity-60"
          >
            {loading ? "Loading..." : isSignUp ? "Sign Up" : "Sign In"}
          </button>

          <button
            type="button"
            onClick={() => {
              setIsSignUp((s) => !s);
              setErrors({});
              setSubmitError(null);
            }}
            className="w-full text-sm text-muted-foreground"
          >
            {isSignUp ? "Already have an account? Sign in" : "Don't have an account? Sign up"}
          </button>
        </form>
      </div>

      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm password</AlertDialogTitle>
            <AlertDialogDescription>Re-enter your password to finish creating your account.</AlertDialogDescription>
          </AlertDialogHeader>

          <div className="mt-4">
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-muted text-foreground outline-none"
            />
            {confirmError && <p className="text-xs text-red-500 mt-2">{confirmError}</p>}
          </div>

          <AlertDialogFooter>
            <AlertDialogAction onClick={handleConfirmSignUp} disabled={loading}>
              {loading ? "Creating..." : "Create Account"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showLoginError} onOpenChange={setShowLoginError}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Login failed</AlertDialogTitle>
            <AlertDialogDescription>Invalid email or password. Please try again.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setShowLoginError(false)}>OK</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AuthPage;
