import { useState, useCallback, useEffect, useLayoutEffect, useRef } from "react";
import { CreditCardIcon, Timer02Icon, Alert01Icon, Notification01Icon } from "@hugeicons/core-free-icons";
import BetaFeedbackButton from "./components/BetaFeedbackButton";
import { AnnouncementPopup } from "./components/AnnouncementPopup";
import { useAnnouncements } from "@/hooks/useAnnouncements";

const BETA_FEEDBACK_FLOATING_BUTTON_ENABLED = false;

const PAGE_LABELS: Record<string, string> = {
  "home":                 "Home",
  "account":              "Account",
  "flights":              "Explore Flights",
  "destinations":         "Destinations",
  "flight-results":       "Flight Results",
  "flight-multi-results": "Flight Results",
  "day-trip-results":     "Day Trip Results",
  "flight-details":       "Flight Details",
  "itinerary":            "Itinerary",
  "routes":               "Routes",
  "design-system":        "Design System",
  "friends":              "Friends",
  "hubs":                 "Hubs",
  "explorer":             "Flight Explorer",
  "gowild-insights":      "GoWild Insights",
  "all-upcoming-flights": "Upcoming Flights",
  "all-watched-flights":  "Watched Flights",
  "radar":                "GoWild Radar",
  "notifications":        "Notifications",
};
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Session } from "@supabase/supabase-js";
import { ProfileProvider } from "@/contexts/ProfileContext";
import { AuthProvider } from "@/contexts/AuthContext";
import MainLayout from "./components/MainLayout";
import AltSplashScreen from "./components/AltSplashScreen";
import AccountPending from "./components/AccountPending";
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
import AdminBulkSearch from "./pages/AdminBulkSearch";
import AdminConsole from "./pages/AdminConsole";
import AdminDbPush from "./pages/AdminDbPush";
import ItineraryPage from "./pages/Itinerary";
import RoutesPage from "./pages/Routes";
import FriendsPage from "./pages/Friends";
import HubsPage from "./pages/Hubs";
import GoWildInsightsPage, { type PeriodKey } from "./pages/GoWildInsights";
import FlightExplorerPage from "./pages/FlightExplorer";
import GoWildRadarMap from "./components/admin/GoWildRadarMap";
import DesignSystemPage from "./pages/DesignSystemV2";
import FlightDetails from "./pages/FlightDetails";
import ResetPasswordPage from "./pages/ResetPassword";
import BillingSuccess from "./pages/BillingSuccess";
import BillingCancel from "./pages/BillingCancel";
import BillingPortalReturn from "./pages/BillingPortalReturn";
import AdminGate from "./components/AdminGate";
import PreviewPage from "./pages/Preview";
import AllUpcomingFlights from "./pages/AllUpcomingFlights";
import AllWatchedFlights from "./pages/AllWatchedFlights";
import NotificationsPage from "./pages/Notifications";
import BetaSignup from "./pages/BetaSignup";
import AdminBetaApplications from "./pages/AdminBetaApplications";
import PublicFlightSharePage from "./pages/PublicFlightSharePage";
import UnsubscribePage from "./pages/UnsubscribePage";
import GoWildGuidePage from "./pages/GoWildGuidePage";
import { resetViewportScroll } from "@/lib/viewportScroll";

const queryClient = new QueryClient();

const MainApp = () => {
  const [splashDone, setSplashDone] = useState(true);
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [showProfileSetup, setShowProfileSetup] = useState(false);
  const [accountPending, setAccountPending] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [currentPage, setCurrentPage] = useState<"home" | "account" | "flights" | "destinations" | "flight-results" | "flight-multi-results" | "day-trip-results" | "flight-details" | "itinerary" | "routes" | "design-system" | "friends" | "hubs" | "explorer" | "gowild-insights" | "all-upcoming-flights" | "all-watched-flights" | "radar" | "notifications">("home");
  const [flightResultsData, setFlightResultsData] = useState<string>("");
  const [selectedFlight, setSelectedFlight] = useState<any>(null);
  /** When true, the flight-results back button returns to flight-multi-results */
  const [flightResultsFromMulti, setFlightResultsFromMulti] = useState(false);
  /** Saved multi-results data to restore when navigating back from single-dest drill-down */
  const [multiResultsData, setMultiResultsData] = useState<string>("");
  const [quickSearchData, setQuickSearchData] = useState<string | null>(null);
  const [subScreenTitle, setSubScreenTitle] = useState<string | null>(null);
  const [subScreenIcon, setSubScreenIcon] = useState<any>(null);
  const [homeRefreshTrigger, setHomeRefreshTrigger] = useState(0);
  const [insightsPeriod, setInsightsPeriod] = useState<PeriodKey>("7d");
  const accountBackRef = useRef<(() => void) | null>(null);
  const accountDevRef = useRef<(() => void) | null>(null);

  // Restore page from sessionStorage when returning from external routes
  useEffect(() => {
    const saved = sessionStorage.getItem("wf_returnPage");
    if (saved) {
      setCurrentPage(saved as any);
      sessionStorage.removeItem("wf_returnPage");
    }
  }, []);

  // React swaps whole application screens without a browser navigation. Reset
  // the document before paint so an iPhone cannot carry the Auth form's scroll
  // position into Home, search results, or another top-level screen.
  useLayoutEffect(() => {
    if (!checkingSession) resetViewportScroll();
  }, [accountPending, checkingSession, currentPage, isSignedIn, needsOnboarding, showProfileSetup]);

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
        setAccountPending(false);
        return;
      }

      const user = session.user;

      try {
        const { data: profile, error: profileError } = await supabase
          .from("user_info")
          .select("onboarding_complete, status")
          .eq("auth_user_id", user.id)
          .maybeSingle();

        if (!isMounted) return;

        if (profileError) {
          setIsSignedIn(true);
          setNeedsOnboarding(true);
          setAccountPending(false);
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
            status: "pending",
          });

          if (!isMounted) return;
          setIsSignedIn(true);
          setNeedsOnboarding(true);
          setAccountPending(false);
          return;
        }

        const isPending = profile.status === "pending";
        const needsOnboard = profile.onboarding_complete !== "Yes";
        setIsSignedIn(true);
        // Show onboarding first if incomplete, then pending gate after
        setAccountPending(!needsOnboard && isPending);
        setNeedsOnboarding(needsOnboard);
      } catch {
        if (!isMounted) return;
        setIsSignedIn(true);
        setNeedsOnboarding(true);
        setAccountPending(false);
      }
    };

    const init = async () => {
      // Check if user has an existing session and remember_me is enabled.
      // IMPORTANT: never sign out a PASSWORD_RECOVERY session — the user
      // must keep it alive to be able to set their new password on /reset-password.
      // If navigating back from the admin console, skip the remember_me sign-out check.
      const fromAdmin = sessionStorage.getItem("adminReturn") === "1";
      if (fromAdmin) sessionStorage.removeItem("adminReturn");

      // Capture BEFORE any await — the Supabase SDK clears window.location.hash
      // during its initialization (inside getSession/initializePromise), so reading
      // the hash after the first await always returns an empty string.
      const isOnResetPage = window.location.pathname.startsWith("/reset-password");
      const earlyRecoveryHash = window.location.hash.includes("type=recovery");

      let shouldKeepSession = false;
      try {
        const { data: { session: existingSession } } = await supabase.auth.getSession();
        if (existingSession?.user) {
          if (fromAdmin) {
            shouldKeepSession = true;
          } else {
            const isRecoverySession = isOnResetPage || earlyRecoveryHash;

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
          setAccountPending(false);
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

  const handleSignIn = async (onboarding: boolean) => {
    resetViewportScroll();
    setCurrentPage("home");
    setIsSignedIn(true);
    setShowProfileSetup(false);

    // New signups / incomplete profiles must finish onboarding + profile setup
    // before the pending gate is shown.
    if (onboarding) {
      setAccountPending(false);
      setNeedsOnboarding(true);
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase
        .from("user_info")
        .select("status")
        .eq("auth_user_id", user.id)
        .maybeSingle();

      if (profile?.status === "pending") {
        setAccountPending(true);
        setNeedsOnboarding(false);
        return;
      }
    }

    setAccountPending(false);
    setNeedsOnboarding(false);
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
    setAccountPending(false);
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
      // - arrivalAirport is "All" / empty (no specific destination chosen)
      // - OR the response has flights going to multiple different destinations
      // NOTE: A city-area departure (CITY:...) paired with a specific arrival
      // is still a single-destination view (rendered with origin-airport grouping
      // inside FlightDestResults), so we do NOT force multi-results in that case.
      try {
        const parsed = JSON.parse(data);
        const arrAirport: string = parsed.arrivalAirport ?? "";
        // Raw API format: parsed.response.flights[] with top-level `destination`
        // Normalized format: parsed.response.flights[] with `legs[last].destination`
        const responseFlights: any[] = parsed.response?.flights ?? [];

        const isMulti =
          arrAirport === "All" ||
          arrAirport === "";

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
    } else if (page === "all-upcoming-flights") {
      setSubScreenTitle("Upcoming Flights");
      setSubScreenIcon(Timer02Icon);
    } else if (page === "all-watched-flights") {
      setSubScreenTitle("Watched Flights");
      setSubScreenIcon(Alert01Icon);
    } else if (page === "notifications") {
      setSubScreenTitle("Notifications");
      setSubScreenIcon(Notification01Icon);
    } else {
      setSubScreenTitle(null);
      setSubScreenIcon(null);
    }
    setCurrentPage(page as any);
  };

  // Determine if the current page should hide the right header icons
  const hideHeaderRight = false;

  // Pages that use the shared MainLayout
  const isMainLayoutPage = isSignedIn && !needsOnboarding && !showProfileSetup && !accountPending &&
    ["home", "account", "flights", "destinations", "itinerary", "routes", "design-system", "friends", "hubs", "explorer", "gowild-insights", "all-upcoming-flights", "all-watched-flights", "radar", "notifications"].includes(currentPage);

  const usesViewportShell =
    splashDone &&
    !checkingSession &&
    isSignedIn &&
    !needsOnboarding &&
    !showProfileSetup &&
    !accountPending;

  const feedbackAudienceReady =
    splashDone &&
    !checkingSession &&
    isSignedIn &&
    !needsOnboarding &&
    !showProfileSetup &&
    !accountPending;
  const showFeedbackButton = BETA_FEEDBACK_FLOATING_BUTTON_ENABLED && feedbackAudienceReady;

  const feedbackPageLabel = subScreenTitle ?? PAGE_LABELS[currentPage] ?? currentPage;

  const { current: announcement, dismiss: dismissAnnouncement } = useAnnouncements(feedbackAudienceReady);

  return (
    <div className="viewport-min-height flex justify-center overflow-x-hidden">
      {showFeedbackButton && <BetaFeedbackButton pageLabel={feedbackPageLabel} />}
      {announcement && (
        <AnnouncementPopup announcement={announcement} onDismiss={dismissAnnouncement} />
      )}
      <div
        className={`w-full max-w-[1320px] flex flex-col ${
          usesViewportShell ? "viewport-height min-h-0 overflow-hidden" : "viewport-min-height"
        }`}
      >
        {/* Splash video removed */}

        {splashDone && checkingSession && (
          <div className="viewport-min-height flex items-center justify-center bg-background" />
        )}

        {splashDone && !checkingSession && !isSignedIn && <AuthPage onSignIn={handleSignIn} />}

        {splashDone && !checkingSession && isSignedIn && accountPending && (
          <AccountPending onSignOut={handleSignOut} />
        )}

        {splashDone && !checkingSession && isSignedIn && !accountPending && needsOnboarding && !showProfileSetup && (
          <Onboarding onComplete={() => setShowProfileSetup(true)} />
        )}

        {splashDone && !checkingSession && isSignedIn && !accountPending && showProfileSetup && (
          <ProfileSetup
            onComplete={async () => {
              // Re-check pending status after onboarding/profile setup
              const { data: { user } } = await supabase.auth.getUser();
              if (user) {
                const { data: profile } = await supabase
                  .from("user_info")
                  .select("status")
                  .eq("auth_user_id", user.id)
                  .maybeSingle();
                if (profile?.status === "pending") {
                  setAccountPending(true);
                  setNeedsOnboarding(false);
                  setShowProfileSetup(false);
                  return;
                }
              }
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
                  setCurrentPage("account");
                  accountDevRef.current?.();
                } else if (currentPage === "all-upcoming-flights" || currentPage === "all-watched-flights" || currentPage === "notifications") {
                  setCurrentPage("home");
                  setSubScreenTitle(null);
                  setSubScreenIcon(null);
                } else {
                  accountBackRef.current?.();
                }
              }}
              currentPage={currentPage}
              onHomeLayoutSaved={() => setHomeRefreshTrigger(t => t + 1)}
              onAccountDevPress={() => accountDevRef.current?.()}
            >

              {currentPage === "home" && <HomePage onNavigate={handleNavigate} refreshTrigger={homeRefreshTrigger} onFlightClick={(flight) => { setSelectedFlight(flight); setCurrentPage("flight-details"); }} />}
              {currentPage === "account" && <AccountHub onSubScreenChange={(title, icon) => { setSubScreenTitle(title); if (icon !== undefined) setSubScreenIcon(icon); }} backRef={accountBackRef} devRef={accountDevRef} onNavigate={handleNavigate} onHomepageConfigChanged={() => setHomeRefreshTrigger(t => t + 1)} />}
              {currentPage === "flights" && <FlightsPage onNavigate={handleNavigate} quickSearchData={quickSearchData} />}
              {currentPage === "destinations" && <DestinationsPage />}
              {currentPage === "itinerary" && <ItineraryPage />}
              {currentPage === "routes" && <RoutesPage onNavigate={handleNavigate} />}
              {currentPage === "friends" && <FriendsPage />}
              {currentPage === "hubs" && <HubsPage />}
              {currentPage === "gowild-insights" && <GoWildInsightsPage period={insightsPeriod} setPeriod={setInsightsPeriod} />}
              {currentPage === "explorer" && <FlightExplorerPage onNavigate={handleNavigate} />}
              {currentPage === "radar" && <div className="p-4"><GoWildRadarMap simplified /></div>}
              {currentPage === "design-system" && <DesignSystemPage />}
              {currentPage === "all-upcoming-flights" && <AllUpcomingFlights />}
              {currentPage === "all-watched-flights" && <AllWatchedFlights />}
              {currentPage === "notifications" && <NotificationsPage />}
            </MainLayout>
          </ProfileProvider>
        )}

        {splashDone && !checkingSession && isSignedIn && !needsOnboarding && currentPage === "flight-details" && selectedFlight && (
          <div className="h-full min-h-0 flex flex-col overflow-hidden">
            <FlightDetails
              flight={selectedFlight}
              onBack={() => { setCurrentPage("home"); setSelectedFlight(null); }}
            />
          </div>
        )}
        {splashDone && !checkingSession && isSignedIn && !needsOnboarding && currentPage === "flight-results" && (
          <div className="h-full min-h-0 flex flex-col overflow-hidden">
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
          <div className="h-full min-h-0 flex flex-col overflow-hidden">
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
          <div className="h-full min-h-0 flex flex-col overflow-hidden">
            <DayTripResults
              onBack={() => setCurrentPage("flights")}
              responseData={flightResultsData}
            />
          </div>
        )}
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
          <Route path="/admin/bulk-search" element={<AdminGate><ProfileProvider><AdminBulkSearch /></ProfileProvider></AdminGate>} />
          <Route path="/admin/console" element={<AdminGate><ProfileProvider><AdminConsole /></ProfileProvider></AdminGate>} />
          <Route path="/admin/db-push" element={<AdminGate><AdminDbPush /></AdminGate>} />
          <Route path="/admin/beta-applications" element={<AdminGate><ProfileProvider><AdminBetaApplications /></ProfileProvider></AdminGate>} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/preview" element={<PreviewPage />} />
          <Route path="/billing/success" element={<BillingSuccess />} />
          <Route path="/billing/cancel" element={<BillingCancel />} />
          <Route path="/billing/portal-return" element={<BillingPortalReturn />} />
          <Route path="/beta" element={<BetaSignup />} />
          <Route path="/beta-testers" element={<BetaSignup />} />
          <Route path="/betapreview" element={<BetaSignup />} />
          <Route path="/betasignup" element={<BetaSignup />} />
          <Route path="/share/flights/:token" element={<PublicFlightSharePage />} />
          <Route path="/unsubscribe" element={<UnsubscribePage />} />
          <Route path="/gowild-guide" element={<GoWildGuidePage />} />
          <Route path="*" element={<MainApp />} />

        </Routes>
      </BrowserRouter>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
