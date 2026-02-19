import { useState, useCallback } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import SplashScreen from "./components/SplashScreen";
import AuthPage from "./components/AuthPage";
import HomePage from "./pages/Home";
import AdminImport from "./pages/AdminImport";

const MainApp = () => {
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

const App = () => (
  <BrowserRouter>
    <Routes>
      <Route path="/admin/import" element={<AdminImport />} />
      <Route path="*" element={<MainApp />} />
    </Routes>
  </BrowserRouter>
);

export default App;
