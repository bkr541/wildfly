import { useEffect, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlane } from "@fortawesome/free-solid-svg-icons";

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
      className={`fixed inset-0 z-50 flex items-center justify-center bg-[#345C5A] transition-opacity duration-500 ${
        show ? "opacity-100" : "opacity-0"
      }`}
    >
      {/* Expanding Ripple Ring */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="w-40 h-40 rounded-full border-4 border-[#F2F3F3]/10 animate-ping" />
      </div>

      {/* Center Content */}
      <div className="relative z-10 text-center flex flex-col items-center">
        {/* --- OPTION: CUSTOM GIF --- */}
        {/* If you want to use a GIF, delete the airplane icon div below and uncomment this line: */}
        {/* <img src="/assets/your-animated-logo.gif" alt="Wildfly" className="w-24 h-24 mb-6" /> */}

        {/* --- OPTION: CSS ANIMATED ICON --- */}
        <div className="w-20 h-20 bg-white/10 rounded-full flex items-center justify-center mb-6 animate-bounce shadow-lg">
          <FontAwesomeIcon icon={faPlane} className="text-white w-8 h-8 -rotate-45" />
        </div>

        {/* App Title */}
        <h1 className="text-4xl font-bold text-white tracking-widest uppercase">Wildfly</h1>
        <p className="mt-3 text-[#F2F3F3]/70 text-sm tracking-widest uppercase font-medium">Taking off...</p>
      </div>
    </div>
  );
};

export default SplashScreen;
