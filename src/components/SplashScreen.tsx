import { useEffect, useState } from "react";

interface SplashScreenProps {
  onComplete: () => void;
}

const SplashScreen = ({ onComplete }: SplashScreenProps) => {
  const [show, setShow] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShow(false);
      setTimeout(onComplete, 500);
    }, 2500);
    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center gradient-splash transition-opacity duration-500 ${
        show ? "opacity-100" : "opacity-0"
      }`}
    >
      {/* Ripple rings */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="w-24 h-24 rounded-full border-2 border-accent-blue/40 animate-ripple" />
      </div>
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="w-24 h-24 rounded-full border-2 border-accent-pink/30 animate-ripple-delay-1" />
      </div>
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="w-24 h-24 rounded-full border-2 border-accent-yellow/20 animate-ripple-delay-2" />
      </div>

      {/* Center logo */}
      <div className="relative z-10 text-center">
        <h1 className="text-4xl font-bold text-foreground tracking-widest uppercase">Wildfly</h1>
      </div>

      {/* Decorative circles */}
      <div className="absolute top-1/4 left-1/4 w-10 h-10 rounded-full bg-accent-pink/40 animate-float" />
      <div className="absolute bottom-1/3 right-1/4 w-6 h-6 rounded-full bg-accent-yellow/50 animate-float-delay" />
      <div className="absolute top-1/3 right-1/3 w-8 h-8 rounded-full bg-accent-blue/40 animate-float-delay-2" />
    </div>
  );
};

export default SplashScreen;
