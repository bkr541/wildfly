import { useState, useCallback, useEffect } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import type { Session } from "@supabase/supabase-js";
import SplashScreen from "./components/SplashScreen";
import AuthPage from "./components/AuthPage";
import Onboarding from "./components/Onboarding";
import ProfileSetup from "./components/ProfileSetup";
import HomePage from "./pages/Home";
import AccountHub from "./pages/AccountHub";
import FlightsPage from "./pages/Flights";
import DestinationsPage from "./pages/Destinations";
import AdminImport from "./pages/AdminImport";

const MainApp = () => {
  const [splashDone, setSplashDone] = useState(false);
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [showProfileSetup, setShowProfileSetup] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [currentPage, setCurrentPage] = useState<"home" | "account" | "flights" | "destinations">("home");

  const handleSplashComplete = useCallback(() => setSplashDone(true), []);

  useEffect(() => {
    let isMounted = true;
    let subscription: { unsubscribe: () => void } | null = null;

    const hydrateFromSession = async (session: Session | null) => {
      // No user -> show AuthPage
      if (!session?.user) {
        if (!isMounted) return;
        setIsSignedIn(false);
        setNeedsOnboarding(false);
        setShowProfileSetup(false);
        return;
      }

      const user = session.user;

      try {
        const { data: profile, error: profileError } = await supabase
          .from("user_info")
          .select("onboarding_complete")
          .eq("auth_user_id", user.id)
          .maybeSingle();

        if (!isMounted) return;

        // If profile lookup fails, send user through onboarding as a safe fallback.
        if (profileError) {
          setIsSignedIn(true);
          setNeedsOnboarding(true);
          return;
        }

        if (!profile) {
          // No user_info row -> create one
          await supabase.from("user_info").insert({
            auth_user_id: user.id,
            email: user.email ?? "",
            onboarding_complete: "No",
            image_file: "",
          });

          if (!isMounted) return;
          setIsSignedIn(true);
          setNeedsOnboarding(true);
          return;
        }

        setIsSignedIn(true);
        // Rule: if onboarding_complete !== "Yes", go to onboarding.
        setNeedsOnboarding(profile.onboarding_complete !== "Yes");
      } catch {
        if (!isMounted) return;
        setIsSignedIn(true);
        setNeedsOnboarding(true);
      }
    };

    const init = async () => {
      // ✅ FOR NOW: Always require AuthPage on every launch/refresh.
      // This clears any persisted Supabase session from storage.
      try {
        await supabase.auth.signOut({ scope: "local" });
      } catch {
        // ignore
      }

      if (!isMounted) return;

      // Known logged-out state after forcing sign-out.
      setIsSignedIn(false);
      setNeedsOnboarding(false);
      setShowProfileSetup(false);

      // Listen for sign-in events AFTER the forced sign-out.
      const sub = supabase.auth.onAuthStateChange((event, session) => {
        if (!isMounted) return;

        if (event === "SIGNED_OUT") {
          setIsSignedIn(false);
          setNeedsOnboarding(false);
          setShowProfileSetup(false);
          return;
        }

        if (["SIGNED_IN", "USER_UPDATED", "TOKEN_REFRESHED"].includes(event)) {
          hydrateFromSession(session);
        }
      });

      subscription = sub.data.subscription;

      // Session check is "done" once sign-out is forced + listeners attached.
      setCheckingSession(false);
    };

    init();

    return () => {
      isMounted = false;
      subscription?.unsubscribe();
    };
  }, []);

  const handleSignIn = (onboarding: boolean) => {
    setIsSignedIn(true);
    setNeedsOnboarding(onboarding);
    setShowProfileSetup(false);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut({ scope: "local" });
    setIsSignedIn(false);
    setNeedsOnboarding(false);
    setShowProfileSetup(false);
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
          <ProfileSetup
            onComplete={() => {
              setNeedsOnboarding(false);
              setShowProfileSetup(false);
            }}
          />
        )}

        {splashDone && !checkingSession && isSignedIn && !needsOnboarding && currentPage === "home" && (
          <HomePage onSignOut={handleSignOut} onNavigate={(page: string) => setCurrentPage(page as any)} />
        )}

        {splashDone && !checkingSession && isSignedIn && !needsOnboarding && currentPage === "account" && (
          <AccountHub onSignOut={handleSignOut} onBack={() => setCurrentPage("home")} />
        )}

        {splashDone && !checkingSession && isSignedIn && !needsOnboarding && currentPage === "flights" && (
          <FlightsPage onSignOut={handleSignOut} onNavigate={(page: string) => setCurrentPage(page as any)} />
        )}

        {splashDone && !checkingSession && isSignedIn && !needsOnboarding && currentPage === "destinations" && (
          <DestinationsPage onSignOut={handleSignOut} onNavigate={(page: string) => setCurrentPage(page as any)} />
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
