import { useState, useCallback } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import SplashScreen from "./components/SplashScreen";
import AuthPage from "./components/AuthPage";
import Onboarding from "./components/Onboarding";
import HomePage from "./pages/Home";
import AdminImport from "./pages/AdminImport";

const MainApp = () => {
  const [splashDone, setSplashDone] = useState(false);
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);

  const handleSplashComplete = useCallback(() => setSplashDone(true), []);

  const handleSignIn = (onboarding: boolean) => {
    setIsSignedIn(true);
    setNeedsOnboarding(onboarding);
  };

  return (
    <div className="flex justify-center min-h-screen bg-background">
      <div className="w-full max-w-[768px] relative">
        {!splashDone && <SplashScreen onComplete={handleSplashComplete} />}
        {splashDone && !isSignedIn && <AuthPage onSignIn={handleSignIn} />}
        {splashDone && isSignedIn && needsOnboarding && (
          <Onboarding onComplete={() => setNeedsOnboarding(false)} />
        )}
        {splashDone && isSignedIn && !needsOnboarding && (
          <HomePage onSignOut={() => setIsSignedIn(false)} />
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
