import { useState, useCallback, useEffect } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import SplashScreen from "./components/SplashScreen";
import AuthPage from "./components/AuthPage";
import Onboarding from "./components/Onboarding";
import ProfileSetup from "./components/ProfileSetup";
import HomePage from "./pages/Home";
import AdminImport from "./pages/AdminImport";
import UserHub from "./pages/userhub/UserHub";
import Account from "./pages/userhub/Account";
import EditProfile from "./pages/userhub/EditProfile";
import HomeCity from "./pages/userhub/HomeCity";
import FavoriteDestinations from "./pages/userhub/FavoriteDestinations";
import Notifications from "./pages/userhub/Notifications";
import Appearance from "./pages/userhub/Appearance";
import SecurityPrivacy from "./pages/userhub/SecurityPrivacy";
import ChangePassword from "./pages/userhub/ChangePassword";
import { Toaster } from "@/components/ui/toaster";

const MainApp = () => {
  const [splashDone, setSplashDone] = useState(false);
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [showProfileSetup, setShowProfileSetup] = useState(false);
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

  // If signed in and onboarding complete, show routed content
  if (splashDone && isSignedIn && !needsOnboarding) {
    return (
      <Routes>
        <Route path="/user-hub" element={<UserHub />} />
        <Route path="/user-hub/account" element={<Account />} />
        <Route path="/user-hub/account/edit-profile" element={<EditProfile />} />
        <Route path="/user-hub/account/home-city" element={<HomeCity />} />
        <Route path="/user-hub/account/favorite-destinations" element={<FavoriteDestinations />} />
        <Route path="/user-hub/notifications" element={<Notifications />} />
        <Route path="/user-hub/appearance" element={<Appearance />} />
        <Route path="/user-hub/security-privacy" element={<SecurityPrivacy />} />
        <Route path="/user-hub/security-privacy/change-password" element={<ChangePassword />} />
        <Route path="*" element={<HomePage onSignOut={handleSignOut} />} />
      </Routes>
    );
  }

  return (
    <>
      {!splashDone && <SplashScreen onComplete={handleSplashComplete} />}
      {splashDone && !isSignedIn && <AuthPage onSignIn={handleSignIn} />}
      {splashDone && isSignedIn && needsOnboarding && !showProfileSetup && (
        <Onboarding onComplete={() => setShowProfileSetup(true)} />
      )}
      {splashDone && isSignedIn && showProfileSetup && (
        <ProfileSetup onComplete={() => { setNeedsOnboarding(false); setShowProfileSetup(false); }} />
      )}
    </>
  );
};

const App = () => (
  <BrowserRouter>
    <div className="flex justify-center min-h-screen bg-background">
      <div className="w-full max-w-[768px] relative">
        <Routes>
          <Route path="/admin/import" element={<AdminImport />} />
          <Route path="*" element={<MainApp />} />
        </Routes>
        <Toaster />
      </div>
    </div>
  </BrowserRouter>
);

export default App;
