import { useState } from "react";
import DecorativeCircles from "./DecorativeCircles";

interface AuthPageProps {
  onSignIn: () => void;
}

const AuthPage = ({ onSignIn }: AuthPageProps) => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSignIn();
  };

  return (
    <div className="relative flex flex-col min-h-screen bg-background overflow-hidden">
      <DecorativeCircles />

      {/* Header */}
      <div className="pt-12 pb-4 text-center relative z-10">
        <p className="text-muted-foreground text-sm tracking-widest uppercase">Hearme</p>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col items-center justify-center px-8 relative z-10">
        <h1 className="text-3xl font-bold text-foreground mb-8">
          {isSignUp ? "Sign Up" : "Sign In"}
        </h1>

        <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-5">
          <div>
            <label className="block text-xs font-semibold text-muted-foreground tracking-widest uppercase mb-2">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full px-4 py-3 rounded-lg bg-secondary text-foreground placeholder:text-muted-foreground border-none outline-none focus:ring-2 focus:ring-accent-blue transition-all"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-muted-foreground tracking-widest uppercase mb-2">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-4 py-3 rounded-lg bg-secondary text-foreground placeholder:text-muted-foreground border-none outline-none focus:ring-2 focus:ring-accent-blue transition-all"
              required
            />
          </div>

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
            onClick={() => setIsSignUp(!isSignUp)}
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
