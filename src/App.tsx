import { useState, useCallback, useEffect, useRef } from "react";
import { CreditCardIcon } from "@hugeicons/core-free-icons";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Session } from "@supabase/supabase-js";
import { ProfileProvider } from "@/contexts/ProfileContext";
import { AuthProvider } from "@/contexts/AuthContext";
import MainLayout from "./components/MainLayout";
import AltSplashScreen from "./components/AltSplashScreen";
import AuthPage from "./components/AuthPage";
import Onboarding from "./components/Onboarding";
import ProfileSetup from "./components/ProfileSetup";
import HomePage from "./pages/Home";
import AccountHub from "./pages/AccountHub";
import FlightsPage from "./pages/Flights";
import DestinationsPage from "./pages/Destinations";
import FlightDestResults from "./pages/FlightDestResults";
import FlightMultiDestResults from "./pages/FlightMultiDestResults";
import DayTripResults from "./pages/DayTripResults";
import AdminImport from "./pages/AdminImport";
import ItineraryPage from "./pages/Itinerary";
import RoutesPage from "./pages/Routes";
import FriendsPage from "./pages/Friends";
import HubsPage from "./pages/Hubs";
import IOSInstallBanner from "./components/IOSInstallBanner";
import DesignSystemPage from "./pages/DesignSystemV2";
import ResetPasswordPage from "./pages/ResetPassword";
import BillingSuccess from "./pages/BillingSuccess";
import BillingCancel from "./pages/BillingCancel";

const queryClient = new QueryClient();

const MainApp = () => {
  const [splashDone, setSplashDone] = useState(false);
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [showProfileSetup, setShowProfileSetup] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [currentPage, setCurrentPage] = useState<"home" | "account" | "flights" | "destinations" | "flight-results" | "flight-multi-results" | "day-trip-results" | "itinerary" | "routes" | "design-system" | "friends" | "hubs">("home");
  const [flightResultsData, setFlightResultsData] = useState<string>("");
  /** When true, the flight-results back button returns to flight-multi-results */
  const [flightResultsFromMulti, setFlightResultsFromMulti] = useState(false);
  /** Saved multi-results data to restore when navigating back from single-dest drill-down */
  const [multiResultsData, setMultiResultsData] = useState<string>("");
  const [quickSearchData, setQuickSearchData] = useState<string | null>(null);
  const [subScreenTitle, setSubScreenTitle] = useState<string | null>(null);
  const [subScreenIcon, setSubScreenIcon] = useState<any>(null);
  const [homeRefreshTrigger, setHomeRefreshTrigger] = useState(0);
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
          const provider = user.app_metadata?.provider;
          const signupType = provider === "google" ? "Google" : provider === "apple" ? "Apple" : "Email";
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (supabase.from("user_info") as any).insert({
            auth_user_id: user.id,
            email: user.email ?? "",
            onboarding_complete: "No",
            image_file: "",
            signup_type: signupType,
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
      // Check if user has an existing session and remember_me is enabled.
      // IMPORTANT: never sign out a PASSWORD_RECOVERY session — the user
      // must keep it alive to be able to set their new password on /reset-password.
      let shouldKeepSession = false;
      let isRecoverySession = false;
      try {
        const { data: { session: existingSession } } = await supabase.auth.getSession();
        if (existingSession?.user) {
          // Detect recovery sessions from the URL hash (present on first load)
          // or from the session's AMR claim set by Supabase on recovery links.
          const hash = window.location.hash;
          isRecoverySession = hash.includes("type=recovery");

          if (!isRecoverySession) {
            const { data: profile } = await supabase
              .from("user_info")
              .select("remember_me")
              .eq("auth_user_id", existingSession.user.id)
              .maybeSingle();
            shouldKeepSession = profile?.remember_me === true;
          } else {
            shouldKeepSession = true; // keep recovery session intact
          }
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
        // Hydrate from existing session (includes recovery sessions —
        // App.tsx will just show the auth page, which is fine because
        // the user will be on /reset-password handled by the router).
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
    if (page === "flight-results" && data) {
      // Detect if this is a day-trip result
      try {
        const parsed = JSON.parse(data);
        if (parsed.tripType === "Day Trip") {
          setFlightResultsData(data);
          setCurrentPage("day-trip-results");
          return;
        }
      } catch {
        // fall through
      }

      // Detect if this is a multi-destination result:
      // - arrivalAirport is "All"
      // - OR departureAirport starts with "CITY:" (city-area airports = multiple origins → all dests)
      // - OR the response has flights going to multiple different destinations
      try {
        const parsed = JSON.parse(data);
        const arrAirport: string = parsed.arrivalAirport ?? "";
        const depAirport: string = parsed.departureAirport ?? "";
        // Raw API format: parsed.response.flights[] with top-level `destination`
        // Normalized format: parsed.response.flights[] with `legs[last].destination`
        const responseFlights: any[] = parsed.response?.flights ?? [];

        const isMulti =
          arrAirport === "All" ||
          arrAirport === "" ||
          depAirport.startsWith("CITY:");

        // Check for multiple unique destinations - raw API uses top-level `destination`
        const destSet = new Set<string>();
        for (const f of responseFlights) {
          // Raw API format
          if (f.destination) {
            destSet.add(f.destination);
          // Normalized format
          } else if (Array.isArray(f.legs) && f.legs.length > 0) {
            destSet.add(f.legs[f.legs.length - 1]?.destination ?? "");
          }
        }
        const hasMultipleDests = destSet.size > 1;

        setFlightResultsData(data);
        if (isMulti || hasMultipleDests) {
          setMultiResultsData(data);
          setFlightResultsFromMulti(false);
          setCurrentPage("flight-multi-results");
        } else {
          setCurrentPage("flight-results");
        }
        return;
      } catch {
        setFlightResultsData(data);
        setCurrentPage("flight-results");
        return;
      }
    }
    if (page === "flights" && data) {
      try {
        const parsed = JSON.parse(data);
        if (parsed?.quickSearch || parsed?.recentSearch) setQuickSearchData(data);
        else setQuickSearchData(null);
      } catch {
        setQuickSearchData(null);
      }
    } else if (page !== "flights") {
      setQuickSearchData(null);
    }
    if (page === "design-system") {
      setSubScreenTitle("Design System");
      setSubScreenIcon(CreditCardIcon);
    } else {
      setSubScreenTitle(null);
      setSubScreenIcon(null);
    }
    setCurrentPage(page as any);
  };

  // Determine if the current page should hide the right header icons
  const hideHeaderRight = false;

  // Pages that use the shared MainLayout
  const isMainLayoutPage = isSignedIn && !needsOnboarding && !showProfileSetup &&
    ["home", "account", "flights", "destinations", "itinerary", "routes", "design-system", "friends", "hubs"].includes(currentPage);

  return (
    <div className={`fixed inset-0 flex justify-center ${isMainLayoutPage ? "bg-[#E8EEEE]" : "bg-white"}`}>
      <div className="w-full max-w-[768px] h-full flex flex-col">
        {!splashDone && <AltSplashScreen onComplete={handleSplashComplete} />}

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
              subScreenIcon={subScreenIcon}
              onSubScreenBack={() => {
                if (currentPage === "design-system") {
                  setSubScreenTitle(null);
                  setSubScreenIcon(null);
                  setCurrentPage("account");
                } else {
                  accountBackRef.current?.();
                }
              }}
              currentPage={currentPage}
              onHomeLayoutSaved={() => setHomeRefreshTrigger(t => t + 1)}
            >
              {currentPage === "home" && <HomePage onNavigate={handleNavigate} refreshTrigger={homeRefreshTrigger} />}
              {currentPage === "account" && <AccountHub onSubScreenChange={(title, icon) => { setSubScreenTitle(title); if (icon !== undefined) setSubScreenIcon(icon); }} backRef={accountBackRef} onNavigate={handleNavigate} onHomepageConfigChanged={() => setHomeRefreshTrigger(t => t + 1)} />}
              {currentPage === "flights" && <FlightsPage onNavigate={handleNavigate} quickSearchData={quickSearchData} />}
              {currentPage === "destinations" && <DestinationsPage />}
              {currentPage === "itinerary" && <ItineraryPage />}
              {currentPage === "routes" && <RoutesPage onNavigate={handleNavigate} />}
              {currentPage === "friends" && <FriendsPage />}
              {currentPage === "hubs" && <HubsPage />}
              {currentPage === "design-system" && <DesignSystemPage />}
            </MainLayout>
          </ProfileProvider>
        )}

        {splashDone && !checkingSession && isSignedIn && !needsOnboarding && currentPage === "flight-results" && (
          <div className="h-full flex flex-col overflow-hidden">
            <FlightDestResults
              onBack={() => setCurrentPage("flights")}
              responseData={flightResultsData}
              onBackOverride={flightResultsFromMulti ? () => {
                setFlightResultsFromMulti(false);
                setFlightResultsData(multiResultsData);
                setCurrentPage("flight-multi-results");
              } : undefined}
            />
          </div>
        )}
        {splashDone && !checkingSession && isSignedIn && !needsOnboarding && currentPage === "flight-multi-results" && (
          <div className="h-full flex flex-col overflow-hidden">
            <FlightMultiDestResults
              onBack={() => setCurrentPage("flights")}
              responseData={flightResultsData}
              onViewDest={(destData) => {
                setMultiResultsData(flightResultsData);
                setFlightResultsData(destData);
                setFlightResultsFromMulti(true);
                setCurrentPage("flight-results");
              }}
            />
          </div>
        )}
        {splashDone && !checkingSession && isSignedIn && !needsOnboarding && currentPage === "day-trip-results" && (
          <div className="h-full flex flex-col overflow-hidden">
            <DayTripResults
              onBack={() => setCurrentPage("flights")}
              responseData={flightResultsData}
            />
          </div>
        )}
        <IOSInstallBanner />
      </div>
    </div>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/admin/import" element={<AdminImport />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/billing/success" element={<BillingSuccess />} />
          <Route path="/billing/cancel" element={<BillingCancel />} />
          <Route path="*" element={<MainApp />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
