import { useEffect, useRef, useState } from "react";

interface AltSplashScreenProps {
  onComplete: () => void;
}

const AltSplashScreen = ({ onComplete }: AltSplashScreenProps) => {
  const [opacity, setOpacity] = useState(0);
  const fallbackRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setOpacity(1), 50);
    fallbackRef.current = setTimeout(onComplete, 10000);
    return () => {
      clearTimeout(t);
      if (fallbackRef.current) clearTimeout(fallbackRef.current);
    };
  }, []);

  const handleEnded = () => {
    if (fallbackRef.current) clearTimeout(fallbackRef.current);
    setOpacity(0);
    setTimeout(onComplete, 650);
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black"
      style={{ opacity, transition: "opacity 0.6s ease-in-out" }}
    >
      <video
        src="/assets/authuser/bg_video.mp4"
        autoPlay
        muted
        playsInline
        onEnded={handleEnded}
        onError={onComplete}
        className="w-full h-full object-cover"
      />
    </div>
  );
};

export default AltSplashScreen;
