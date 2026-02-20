import { useState, useCallback, useEffect, useRef } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import SplashScreen from "./components/SplashScreen";
import AuthPage from "./components/AuthPage";
import Onboarding from "./components/Onboarding";
import ProfileSetup from "./components/ProfileSetup";
import HomePage from "./pages/Home";
import AdminImport from "./pages/AdminImport";

const MainApp = () => {
  const [splashDone, setSplashDone] = useState(false);
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [showProfileSetup, setShowProfileSetup] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);

  const handleSplashComplete = useCallback(() => setSplashDone(true), []);

  // Track whether handleSignIn was called so the listener doesn't override it
  const signInHandledRef = useRef(false);

  useEffect(() => {
    let isMounted = true;

    const checkProfile = async (userId: string) => {
      try {
        const { data: profile } = await supabase
          .from("user_info")
          .select("onboarding_complete")
          .eq("auth_user_id", userId)
          .maybeSingle();

        if (!isMounted) return;

        if (profile) {
          setIsSignedIn(true);
          setNeedsOnboarding(profile.onboarding_complete === "No");
        } else {
          // No profile found — treat as not signed in
          setIsSignedIn(false);
          setNeedsOnboarding(false);
        }
      } catch {
        if (isMounted) {
          setIsSignedIn(false);
          setNeedsOnboarding(false);
        }
      }
    };

    // Set up listener FIRST (but don't do async work directly in callback)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!isMounted) return;

        // If handleSignIn already set the state, skip listener processing
        if (signInHandledRef.current) {
          signInHandledRef.current = false;
          return;
        }

        if (event === 'SIGNED_OUT' || !session?.user) {
          setIsSignedIn(false);
          setNeedsOnboarding(false);
          setCheckingSession(false);
          return;
        }

        // For other events (TOKEN_REFRESHED, etc.), re-check profile
        setTimeout(() => {
          if (isMounted) checkProfile(session.user.id);
        }, 0);
      }
    );

    // Initial session check — only place we sign out orphaned sessions
    const initializeAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!isMounted) return;

        if (session?.user) {
          const { data: profile } = await supabase
            .from("user_info")
            .select("onboarding_complete")
            .eq("auth_user_id", session.user.id)
            .maybeSingle();

          if (!isMounted) return;

          if (profile) {
            setIsSignedIn(true);
            setNeedsOnboarding(profile.onboarding_complete === "No");
          } else {
            // Orphaned auth session — sign out
            await supabase.auth.signOut();
            setIsSignedIn(false);
            setNeedsOnboarding(false);
          }
        } else {
          setIsSignedIn(false);
          setNeedsOnboarding(false);
        }
      } finally {
        if (isMounted) setCheckingSession(false);
      }
    };

    initializeAuth();

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const handleSignIn = (onboarding: boolean) => {
    signInHandledRef.current = true;
    setIsSignedIn(true);
    setNeedsOnboarding(onboarding);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setIsSignedIn(false);
    setNeedsOnboarding(false);
  };

  if (checkingSession && !splashDone) {
    // Splash handles the wait
  }

  return (
    <div className="flex justify-center min-h-screen bg-background">
      <div className="w-full max-w-[768px] relative">
        {!splashDone && <SplashScreen onComplete={handleSplashComplete} />}
        {splashDone && !isSignedIn && <AuthPage onSignIn={handleSignIn} />}
        {splashDone && isSignedIn && needsOnboarding && !showProfileSetup && (
          <Onboarding onComplete={() => setShowProfileSetup(true)} />
        )}
        {splashDone && isSignedIn && showProfileSetup && (
          <ProfileSetup onComplete={() => { setNeedsOnboarding(false); setShowProfileSetup(false); }} />
        )}
        {splashDone && isSignedIn && !needsOnboarding && (
          <HomePage onSignOut={handleSignOut} />
        )}
      </div>
    </div>
  );
};

const App = () => (
  <BrowserRouter>
    <Routes>
      <Route path="/admin/import" element={<AdminImport />} />
      <Route path="*" element={<MainApp />} />
    </Routes>
  </BrowserRouter>
);

export default App;
