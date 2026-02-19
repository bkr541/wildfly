import { useState, useCallback } from "react";
import SplashScreen from "./components/SplashScreen";
import AuthPage from "./components/AuthPage";
import HomePage from "./pages/Home";

const App = () => {
  const [splashDone, setSplashDone] = useState(false);
  const [isSignedIn, setIsSignedIn] = useState(false);

  const handleSplashComplete = useCallback(() => setSplashDone(true), []);

  return (
    <div className="flex justify-center min-h-screen bg-background">
      <div className="w-full max-w-[768px] relative">
        {!splashDone && <SplashScreen onComplete={handleSplashComplete} />}
        {splashDone && !isSignedIn && <AuthPage onSignIn={() => setIsSignedIn(true)} />}
        {splashDone && isSignedIn && <HomePage onSignOut={() => setIsSignedIn(false)} />}
      </div>
    </div>
  );
};

export default App;
