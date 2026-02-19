import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface OnboardingProps {
  onComplete: () => void;
}

const slides = [
  {
    background: "/onboarding/background1.png",
    title: "Fly Wild, Travel Smart",
    subtitle:
      "Trust us, we get that it can be a wild ride navigating the GoWild! Pass at times - that's why we're here",
  },
  {
    background: "/onboarding/background2.png",
    title: "Fly With The Odds In Your Favor",
    subtitle:
      "Our Insights Model fuses real-time network changes with past flight behavior to create predictive stats and clearer booking confidence",
  },
  {
    background: "/onboarding/background3.png",
    title: "Smarter Results, Flight After Flight",
    subtitle:
      "Every trip, destination, and event teaches your personal Curation Engine your style, so your recommendations get sharper and more relevant over time.",
  },
  {
    background: "/onboarding/background4.png",
    title: "Never Miss A Deal",
    subtitle:
      "Get real-time alerts on flight availability and price drops so you can book with confidence and never miss an opportunity.",
  },
  {
    background: "/onboarding/background5.png",
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
        className="absolute inset-0 bg-cover bg-center transition-all duration-500"
        style={{ backgroundImage: `url(${slides[current].background})` }}
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
            <ChevronLeft className="w-6 h-6" />
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
              <ChevronRight className="w-6 h-6" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default Onboarding;
