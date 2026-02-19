import { useState, useCallback, useEffect } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import SplashScreen from "./components/SplashScreen";
import AuthPage from "./components/AuthPage";
import Onboarding from "./components/Onboarding";
import HomePage from "./pages/Home";
import AdminImport from "./pages/AdminImport";

const MainApp = () => {
  const [splashDone, setSplashDone] = useState(false);
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);

  const handleSplashComplete = useCallback(() => setSplashDone(true), []);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        const { data: profile } = await supabase
          .from("users")
          .select("onboarding_complete")
          .eq("auth_user_id", session.user.id)
          .maybeSingle();

        setIsSignedIn(true);
        setNeedsOnboarding(!profile || profile.onboarding_complete === "No");
      } else {
        setIsSignedIn(false);
        setNeedsOnboarding(false);
      }
      setCheckingSession(false);
    });

    return () => subscription.unsubscribe();
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
        {splashDone && isSignedIn && needsOnboarding && (
          <Onboarding onComplete={() => setNeedsOnboarding(false)} />
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
