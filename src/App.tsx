import { useState, useCallback, useEffect } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import type { Session } from "@supabase/supabase-js";
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

  useEffect(() => {
    let isMounted = true;

    const hydrateFromSession = async (session: Session | null) => {
      if (!session?.user) {
        if (!isMounted) return;
        setIsSignedIn(false);
        setNeedsOnboarding(false);
        setShowProfileSetup(false);
        setCheckingSession(false);
        return;
      }

      const user = session.user;

      try {
        const { data: profile } = await supabase
          .from("user_info")
          .select("onboarding_complete")
          .eq("auth_user_id", user.id)
          .maybeSingle();

        if (!isMounted) return;

        if (!profile) {
          // No user_info row — create one so the user isn't stuck
          await supabase.from("user_info").insert({
            auth_user_id: user.id,
            email: user.email ?? "",
            onboarding_complete: "No",
            image_file: "",
          });
          setIsSignedIn(true);
          setNeedsOnboarding(true);
        } else {
          setIsSignedIn(true);
          setNeedsOnboarding(profile.onboarding_complete === "No");
        }
      } catch {
        if (!isMounted) return;
        setIsSignedIn(true);
        setNeedsOnboarding(true);
      } finally {
        if (isMounted) setCheckingSession(false);
      }
    };

    // 1. Initial session check
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (isMounted) hydrateFromSession(session);
    });

    // 2. Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!isMounted) return;
      if (["SIGNED_IN", "SIGNED_OUT", "USER_UPDATED", "INITIAL_SESSION"].includes(event)) {
        hydrateFromSession(session);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const handleSignIn = (onboarding: boolean) => {
    setIsSignedIn(true);
    setNeedsOnboarding(onboarding);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setIsSignedIn(false);
    setNeedsOnboarding(false);
  };

  return (
    <div className="flex justify-center min-h-screen bg-background">
      <div className="w-full max-w-[768px] relative">
        {!splashDone && <SplashScreen onComplete={handleSplashComplete} />}
        {splashDone && checkingSession && (
          <div className="flex items-center justify-center min-h-screen bg-background" />
        )}
        {splashDone && !checkingSession && !isSignedIn && <AuthPage onSignIn={handleSignIn} />}
        {splashDone && !checkingSession && isSignedIn && needsOnboarding && !showProfileSetup && (
          <Onboarding onComplete={() => setShowProfileSetup(true)} />
        )}
        {splashDone && !checkingSession && isSignedIn && showProfileSetup && (
          <ProfileSetup onComplete={() => { setNeedsOnboarding(false); setShowProfileSetup(false); }} />
        )}
        {splashDone && !checkingSession && isSignedIn && !needsOnboarding && (
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
