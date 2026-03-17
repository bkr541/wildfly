import { useState, forwardRef } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChevronLeft } from "@fortawesome/free-solid-svg-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowRight01Icon, AirplaneTakeOff01Icon } from "@hugeicons/core-free-icons";

interface OnboardingProps {
  onComplete: () => void;
}

const slides = [
  {
    background: "/assets/authuser/onboard_1.png",
    title: "Less Headache, More Confidence",
    subtitle:
      "We understand that sometimes booking a flight can be kind of wild, and not in a good way. Wildfly was made to take the worry out of booking and help you enjoy the experience of flying wild.",
  },
  {
    background: "/assets/authuser/onboard_2.png",
    title: "More Searches, More You",
    subtitle:
      "Wildfly has two unique Agents powering it - Stats and Curation. Our Stats Agent pulls from current and historical flight trends to always keep you updated, while our Curation Agent learns when and where you like to explore, then provides you the perfect way to get there.",
  },
  {
    background: "/assets/authuser/onboard_3.png",
    title: "Friends That Plan Together, Fly Together",
    subtitle: "Find other wild flyers, compare destinations, and sync trips without the endless group chat.",
  },
  {
    background: "/assets/authuser/onboard_4.png",
    title: "Plan Smarter, Fly Wilder",
    subtitle:
      "At the end of the day, Wildfly is here to help you have the information you need to get to the destination you're going.",
  },
];

const pillStyle: React.CSSProperties = {
  background: "rgba(255,255,255,0.80)",
  backdropFilter: "blur(12px)",
  WebkitBackdropFilter: "blur(12px)",
  border: "1px solid rgba(255,255,255,0.60)",
  boxShadow: "0 1px 6px 0 rgba(52,92,90,0.10)",
};

const Onboarding = forwardRef<HTMLDivElement, OnboardingProps>(({ onComplete }, ref) => {
  const [current, setCurrent] = useState(0);
  const [direction, setDirection] = useState<"forward" | "back">("forward");
  const isLast = current === slides.length - 1;

  const prev = () => {
    if (current === 0) return;
    setDirection("back");
    setCurrent((c) => c - 1);
  };

  const next = () => {
    if (isLast) return;
    setDirection("forward");
    setCurrent((c) => c + 1);
  };

  return (
    <div ref={ref} className="relative flex flex-col h-[100dvh] bg-white overflow-hidden">
      {/* Top 60% — stacked images that crossfade */}
      <div className="relative h-[60%] w-full overflow-hidden">
        {slides.map((slide, i) => (
          <div
            key={i}
            className="absolute inset-0 transition-opacity duration-700 ease-in-out"
            style={{
              backgroundImage: `url(${slide.background})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
              backgroundRepeat: "no-repeat",
              opacity: i === current ? 1 : 0,
            }}
          />
        ))}

        {/* Floating Top Navigation */}
        <div className="absolute top-12 left-6 right-6 flex items-center justify-between z-20">
          {/* Back Arrow */}
          <button
            onClick={prev}
            disabled={current === 0}
            className={`w-10 h-10 flex items-center justify-start text-white transition-opacity ${
              current === 0 ? "opacity-0 cursor-default" : "hover:opacity-80"
            }`}
          >
            <FontAwesomeIcon icon={faChevronLeft} className="w-6 h-6" />
          </button>

          {/* Segmented Progress Steps — glass pill matching ProfileSetup */}
          <div
            className="flex gap-1.5 flex-1 justify-center max-w-[200px] rounded-full px-3 py-2"
            style={pillStyle}
          >
            {slides.map((_, i) => (
              <div
                key={i}
                className={`h-1 rounded-full flex-1 transition-colors duration-300 ${
                  i <= current ? "bg-[#10B981]" : "bg-[#DDE0E0]"
                }`}
              />
            ))}
          </div>

          {/* Skip Button */}
          <button
            onClick={onComplete}
            className="w-10 text-right text-white text-sm font-bold tracking-wider hover:opacity-80 transition-opacity"
          >
            Skip
          </button>
        </div>
      </div>

      {/* Bottom 40% — white card stays still; only inner text animates */}
      <div className="flex-1 bg-white rounded-t-[2rem] -mt-6 relative z-10 flex flex-col px-8 pt-10 pb-12 text-center shadow-sm overflow-hidden">
        <div
          key={current}
          className={`flex-1 flex flex-col justify-start ${
            direction === "forward" ? "animate-slide-in-right" : "animate-slide-in-left"
          }`}
        >
          <h1 className="text-2xl font-bold text-[#2E4A4A] mb-4">{slides[current].title}</h1>
          <p className="text-[15px] text-[#6B7B7B] leading-relaxed">{slides[current].subtitle}</p>
        </div>

        {/* Main Action Button — gradient pill matching ProfileSetup */}
        <div className="mt-auto pt-6">
          <button
            onClick={isLast ? onComplete : next}
            className="w-full h-12 rounded-full bg-gradient-to-r from-[#10B981] to-[#059669] text-white font-bold text-sm shadow-lg hover:shadow-xl transform active:scale-[0.98] transition-all flex items-center justify-center gap-2 px-6"
          >
            <span>{isLast ? "Profile Setup" : "Let's Start!"}</span>
            <HugeiconsIcon
              icon={isLast ? AirplaneTakeOff01Icon : ArrowRight01Icon}
              size={18}
              color="white"
              strokeWidth={2}
            />
          </button>
        </div>
      </div>
    </div>
  );
});

Onboarding.displayName = "Onboarding";

export default Onboarding;
