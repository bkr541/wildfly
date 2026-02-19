import { useState } from "react";
import DecorativeCircles from "./DecorativeCircles";

interface AuthPageProps {
  onSignIn: () => void;
}

interface FieldErrors {
  firstName?: string;
  lastName?: string;
  dob?: string;
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
  const [dob, setDob] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});

  const validateSignUp = (): boolean => {
    const newErrors: FieldErrors = {};

    if (!firstName.trim()) newErrors.firstName = "First name is required";
    if (!lastName.trim()) newErrors.lastName = "Last name is required";
    if (!dob) newErrors.dob = "Date of birth is required";
    if (!email.trim()) {
      newErrors.email = "Email is required";
    } else if (!emailRegex.test(email.trim())) {
      newErrors.email = "Please enter a valid email address";
    }
    if (!password) {
      newErrors.password = "Password is required";
    }
    if (!confirmPassword) {
      newErrors.confirmPassword = "Please confirm your password";
    } else if (password && confirmPassword && password !== confirmPassword) {
      newErrors.password = "Passwords do not match";
      newErrors.confirmPassword = "Passwords do not match";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isSignUp) {
      if (!validateSignUp()) return;
    }
    onSignIn();
  };

  const inputBase =
    "w-full px-4 py-3 rounded-lg bg-secondary text-foreground placeholder:text-muted-foreground outline-none transition-all";
  const inputNormal = `${inputBase} border border-transparent focus:ring-2 focus:ring-accent-blue`;
  const inputError = `${inputBase} border border-destructive bg-destructive/5 focus:ring-2 focus:ring-destructive`;

  return (
    <div className="relative flex flex-col min-h-screen bg-background overflow-hidden">
      <DecorativeCircles />

      <div className="pt-12 pb-4 text-center relative z-10">
        <p className="text-muted-foreground text-sm tracking-widest uppercase">Hearme</p>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-8 relative z-10">
        <h1 className="text-3xl font-bold text-foreground mb-8">
          {isSignUp ? "Sign Up" : "Sign In"}
        </h1>

        <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-5" noValidate>
          {isSignUp && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground tracking-widest uppercase mb-2">
                  First Name
                </label>
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => { setFirstName(e.target.value); setErrors(prev => ({ ...prev, firstName: undefined })); }}
                  placeholder="First"
                  className={errors.firstName ? inputError : inputNormal}
                />
                {errors.firstName && <p className="text-destructive text-xs mt-1">{errors.firstName}</p>}
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted-foreground tracking-widest uppercase mb-2">
                  Last Name
                </label>
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => { setLastName(e.target.value); setErrors(prev => ({ ...prev, lastName: undefined })); }}
                  placeholder="Last"
                  className={errors.lastName ? inputError : inputNormal}
                />
                {errors.lastName && <p className="text-destructive text-xs mt-1">{errors.lastName}</p>}
              </div>
            </div>
          )}

          {isSignUp && (
            <div>
              <label className="block text-xs font-semibold text-muted-foreground tracking-widest uppercase mb-2">
                Date of Birth
              </label>
              <input
                type="date"
                value={dob}
                onChange={(e) => { setDob(e.target.value); setErrors(prev => ({ ...prev, dob: undefined })); }}
                className={errors.dob ? inputError : inputNormal}
              />
              {errors.dob && <p className="text-destructive text-xs mt-1">{errors.dob}</p>}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-muted-foreground tracking-widest uppercase mb-2">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setErrors(prev => ({ ...prev, email: undefined })); }}
              placeholder="you@example.com"
              className={errors.email ? inputError : inputNormal}
            />
            {errors.email && <p className="text-destructive text-xs mt-1">{errors.email}</p>}
          </div>

          <div>
            <label className="block text-xs font-semibold text-muted-foreground tracking-widest uppercase mb-2">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setErrors(prev => ({ ...prev, password: undefined, confirmPassword: undefined })); }}
              placeholder="••••••••"
              className={errors.password ? inputError : inputNormal}
            />
            {errors.password && <p className="text-destructive text-xs mt-1">{errors.password}</p>}
          </div>

          {isSignUp && (
            <div>
              <label className="block text-xs font-semibold text-muted-foreground tracking-widest uppercase mb-2">
                Confirm Password
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => { setConfirmPassword(e.target.value); setErrors(prev => ({ ...prev, confirmPassword: undefined, password: undefined })); }}
                placeholder="••••••••"
                className={errors.confirmPassword ? inputError : inputNormal}
              />
              {errors.confirmPassword && <p className="text-destructive text-xs mt-1">{errors.confirmPassword}</p>}
            </div>
          )}

          <button
            type="submit"
            className="w-full py-3 mt-4 rounded-lg bg-foreground text-background font-bold text-sm tracking-widest uppercase hover:opacity-90 transition-opacity"
          >
            {isSignUp ? "Register" : "Sign In"}
          </button>
        </form>

        <p className="mt-8 text-muted-foreground text-sm">
          {isSignUp ? "Already have an account?" : "Don't have an account?"}{" "}
          <button
            onClick={() => { setIsSignUp(!isSignUp); setErrors({}); }}
            className="text-accent-blue font-semibold hover:underline"
          >
            {isSignUp ? "Sign In" : "Sign Up"}
          </button>
        </p>
      </div>
    </div>
  );
};

export default AuthPage;
