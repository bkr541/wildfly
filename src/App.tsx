import { useState, useCallback, useEffect, useRef } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import type { Session } from "@supabase/supabase-js";
import { ProfileProvider } from "@/contexts/ProfileContext";
import MainLayout from "./components/MainLayout";
import SplashScreen from "./components/SplashScreen";
import AuthPage from "./components/AuthPage";
import Onboarding from "./components/Onboarding";
import ProfileSetup from "./components/ProfileSetup";
import HomePage from "./pages/Home";
import AccountHub from "./pages/AccountHub";
import FlightsPage from "./pages/Flights";
import DestinationsPage from "./pages/Destinations";
import FlightDestResults from "./pages/FlightDestResults";
import AdminImport from "./pages/AdminImport";
import SubscriptionPage from "./pages/Subscription";
import ItineraryPage from "./pages/Itinerary";
import RoutesPage from "./pages/Routes";
import FlyAFriendPage from "./pages/FlyAFriend";
import IOSInstallBanner from "./components/IOSInstallBanner";

const MainApp = () => {
  const [splashDone, setSplashDone] = useState(false);
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [showProfileSetup, setShowProfileSetup] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [currentPage, setCurrentPage] = useState<"home" | "account" | "flights" | "destinations" | "flight-results" | "subscription" | "itinerary" | "routes" | "fly-a-friend">("home");
  const [flightResultsData, setFlightResultsData] = useState<string>("");
  const [subScreenTitle, setSubScreenTitle] = useState<string | null>(null);
  const accountBackRef = useRef<(() => void) | null>(null);

  const handleSplashComplete = useCallback(() => setSplashDone(true), []);

  useEffect(() => {
    let isMounted = true;
    let subscription: { unsubscribe: () => void } | null = null;

    const hydrateFromSession = async (session: Session | null) => {
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

        if (profileError) {
          setIsSignedIn(true);
          setNeedsOnboarding(true);
          return;
        }

        if (!profile) {
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
        setNeedsOnboarding(profile.onboarding_complete !== "Yes");
      } catch {
        if (!isMounted) return;
        setIsSignedIn(true);
        setNeedsOnboarding(true);
      }
    };

    const init = async () => {
      // Check if user has an existing session and remember_me is enabled
      let shouldKeepSession = false;
      try {
        const { data: { session: existingSession } } = await supabase.auth.getSession();
        if (existingSession?.user) {
          const { data: profile } = await supabase
            .from("user_info")
            .select("remember_me")
            .eq("auth_user_id", existingSession.user.id)
            .maybeSingle();

          shouldKeepSession = profile?.remember_me === true;
        }
      } catch {
        // ignore
      }

      if (!shouldKeepSession) {
        try {
          await supabase.auth.signOut({ scope: "local" });
        } catch {
          // ignore
        }

        if (!isMounted) return;

        setIsSignedIn(false);
        setNeedsOnboarding(false);
        setShowProfileSetup(false);
      } else {
        // Hydrate from existing session
        const { data: { session } } = await supabase.auth.getSession();
        if (isMounted) {
          await hydrateFromSession(session);
        }
      }

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
      setCheckingSession(false);
    };

    init();

    return () => {
      isMounted = false;
      subscription?.unsubscribe();
    };
  }, []);

  const handleSignIn = (onboarding: boolean) => {
    setCurrentPage("home");
    setIsSignedIn(true);
    setNeedsOnboarding(onboarding);
    setShowProfileSetup(false);
  };

  const handleSignOut = async () => {
    // Clear remember_me on explicit sign out
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from("user_info").update({ remember_me: false }).eq("auth_user_id", user.id);
    }
    await supabase.auth.signOut({ scope: "local" });
    setIsSignedIn(false);
    setNeedsOnboarding(false);
    setShowProfileSetup(false);
  };

  const handleNavigate = (page: string, data?: string) => {
    if (page === "flight-results" && data) setFlightResultsData(data);
    setSubScreenTitle(null);
    setCurrentPage(page as any);
  };

  // Determine if the current page should hide the right header icons
  const hideHeaderRight = currentPage === "subscription";

  // Pages that use the shared MainLayout
  const isMainLayoutPage = isSignedIn && !needsOnboarding && !showProfileSetup &&
    ["home", "account", "flights", "destinations", "subscription", "itinerary", "routes", "fly-a-friend"].includes(currentPage);

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

        {splashDone && !checkingSession && isMainLayoutPage && (
          <ProfileProvider>
            <MainLayout
              onSignOut={handleSignOut}
              onNavigate={handleNavigate}
              hideHeaderRight={hideHeaderRight || !!subScreenTitle}
              subScreenTitle={subScreenTitle}
              onSubScreenBack={() => accountBackRef.current?.()}
            >
              {currentPage === "home" && <HomePage />}
              {currentPage === "account" && <AccountHub onSubScreenChange={setSubScreenTitle} backRef={accountBackRef} />}
              {currentPage === "flights" && <FlightsPage onNavigate={handleNavigate} />}
              {currentPage === "destinations" && <DestinationsPage />}
              {currentPage === "subscription" && <SubscriptionPage />}
              {currentPage === "itinerary" && <ItineraryPage />}
              {currentPage === "routes" && <RoutesPage onNavigate={handleNavigate} />}
              {currentPage === "fly-a-friend" && <FlyAFriendPage />}
            </MainLayout>
          </ProfileProvider>
        )}

        {splashDone && !checkingSession && isSignedIn && !needsOnboarding && currentPage === "flight-results" && (
          <FlightDestResults onBack={() => setCurrentPage("flights")} responseData={flightResultsData} />
        )}
        <IOSInstallBanner />
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
