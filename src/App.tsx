import { useState, useCallback, useEffect } from "react";
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
        setIsSignedIn(true);
        setNeedsOnboarding(!profile || profile.onboarding_complete === "No");
      } catch {
        if (!isMounted) return;
        setIsSignedIn(true);
        setNeedsOnboarding(true);
      }
    };

    // Initial session check
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!isMounted) return;
      if (session?.user) {
        checkProfile(session.user.id);
      } else {
        setCheckingSession(false);
      }
    });

    // Listen for changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!isMounted) return;
      if (session?.user) {
        checkProfile(session.user.id);
      } else {
        setIsSignedIn(false);
        setNeedsOnboarding(false);
      }
      setCheckingSession(false);
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
