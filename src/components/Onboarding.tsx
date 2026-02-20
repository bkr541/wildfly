import { useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChevronLeft, faChevronRight } from "@fortawesome/free-solid-svg-icons";

interface OnboardingProps {
  onComplete: () => void;
}

const slides = [
  {
    background: "/assets/onboarding/background1.png",
    title: "Discover Live Music",
    subtitle: "Find events, artists, and festivals tailored to your taste.",
  },
  {
    background: "/assets/onboarding/background2.png",
    title: "Plan Your Trip",
    subtitle: "Book flights and build your perfect festival itinerary.",
  },
  {
    background: "/assets/onboarding/background3.png",
    title: "Friends That Plan Together, Fly Together",
    subtitle:
      "See what your friends are planning, compare destinations, and sync trips without the endless group chat spiral.",
  },
  {
    background: "/assets/onboarding/background4.png",
    title: "Make It Yours",
    subtitle: "Set up your profile and let us personalize your experience.",
  },
];

const Onboarding = ({ onComplete }: OnboardingProps) => {
  const [current, setCurrent] = useState(0);
  const isLast = current === slides.length - 1;

  const prev = () => setCurrent((c) => Math.max(0, c - 1));
  const next = () => {
    if (isLast) return;
    setCurrent((c) => c + 1);
  };

  return (
    <div className="relative flex flex-col min-h-screen overflow-hidden">
      {/* Background image */}
      <div
        className="absolute inset-0 transition-all duration-500 bg-background"
        style={{
          backgroundImage: `url(${slides[current].background})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
        }}
      />
      {/* Overlay for readability */}
      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/70 to-transparent" />

      {/* Content pinned to bottom */}
      <div className="relative z-10 flex-1 flex flex-col justify-end px-8 pb-16">
        <h1 className="text-3xl font-bold text-foreground mb-3">{slides[current].title}</h1>
        <p className="text-muted-foreground text-base mb-10">{slides[current].subtitle}</p>

        {/* Navigation row */}
        <div className="flex items-center justify-between">
          {/* Left arrow */}
          <button
            onClick={prev}
            disabled={current === 0}
            className="w-10 h-10 rounded-full flex items-center justify-center text-foreground disabled:opacity-20 transition-opacity"
          >
            <FontAwesomeIcon icon={faChevronLeft} className="w-6 h-6" />
          </button>

          {/* Dots */}
          <div className="flex gap-2">
            {slides.map((_, i) => (
              <span
                key={i}
                className={`w-2.5 h-2.5 rounded-full transition-colors ${
                  i === current ? "bg-foreground" : "bg-foreground/30"
                }`}
              />
            ))}
          </div>

          {/* Right arrow or Profile Setup button */}
          {isLast ? (
            <button
              onClick={onComplete}
              className="px-5 py-2.5 rounded-lg bg-foreground text-background font-bold text-sm tracking-widest uppercase hover:opacity-90 transition-opacity"
            >
              Profile Setup
            </button>
          ) : (
            <button
              onClick={next}
              className="w-10 h-10 rounded-full flex items-center justify-center text-foreground hover:opacity-80 transition-opacity"
            >
              <FontAwesomeIcon icon={faChevronRight} className="w-6 h-6" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default Onboarding;
