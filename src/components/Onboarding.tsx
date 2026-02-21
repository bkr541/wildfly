import { useState, forwardRef } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChevronLeft } from "@fortawesome/free-solid-svg-icons";

interface OnboardingProps {
  onComplete: () => void;
}

const slides = [
  {
    background: "/assets/onboarding/background1.png",
    title: "Less Headache, More Confidence",
    subtitle: "We understand that booking can be a wild ride sometimes. Wildfly was made to help that.",
  },
  {
    background: "/assets/onboarding/background2.png",
    title: "More Searches, More You",
    subtitle:
      "Wildfly has two unique Agents powering it - Stats and Curation. Our Stats Agent pulls from current and historical flight trends to always keep you updated, while our Curation Agent learns when and where you like to explore, then provides you the perfect way to get there.",
  },
  {
    background: "/assets/onboarding/background3.png",
    title: "Friends That Plan Together, Fly Together",
    subtitle: "Find other wild flyers, compare destinations, and sync trips without the endless group chat.",
  },
  {
    background: "/assets/onboarding/background4.png",
    title: "Plan Smarter, Fly Wilder",
    subtitle:
      "At the end of the day, Wildfly is here to help you have the information you need to get to the destination you're going.",
  },
];

const Onboarding = forwardRef<HTMLDivElement, OnboardingProps>(({ onComplete }, ref) => {
  const [current, setCurrent] = useState(0);
  const isLast = current === slides.length - 1;

  const prev = () => setCurrent((c) => Math.max(0, c - 1));
  const next = () => {
    if (isLast) return;
    setCurrent((c) => c + 1);
  };

  return (
    <div ref={ref} className="relative flex flex-col h-[100dvh] bg-white overflow-hidden">
      {/* Top 60% - Image Background */}
      <div
        className="relative h-[60%] w-full transition-all duration-500 ease-in-out"
        style={{
          backgroundImage: 'url("/lovable-uploads/6ac39ef2-1e8c-4c30-9ed1-969beac61a04.png")',
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
        }}
      >
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

          {/* Segmented Progress Steps */}
          <div className="flex-1 flex gap-2 mx-4 max-w-[180px]">
            {slides.map((_, i) => (
              <div
                key={i}
                className={`h-1.5 rounded-full flex-1 transition-colors duration-300 ${
                  i <= current ? "bg-white" : "bg-white/30"
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

      {/* Bottom 40% - White Content Card */}
      <div className="flex-1 bg-white rounded-t-[2rem] -mt-6 relative z-10 flex flex-col px-8 pt-10 pb-12 text-center shadow-sm">
        <div className="flex-1 flex flex-col justify-start animate-fade-in">
          <h1 className="text-2xl font-bold text-[#2E4A4A] mb-4">{slides[current].title}</h1>
          <p className="text-[15px] text-[#6B7B7B] leading-relaxed">{slides[current].subtitle}</p>
        </div>

        {/* Main Action Button */}
        <div className="mt-auto pt-6">
          <button
            onClick={isLast ? onComplete : next}
            className="w-full py-4 rounded-xl bg-[#345C5A] text-white font-bold text-sm tracking-widest uppercase hover:opacity-90 transition-opacity"
          >
            {isLast ? "Profile Setup" : "Let's Start!"}
          </button>
        </div>
      </div>
    </div>
  );
});

Onboarding.displayName = "Onboarding";

export default Onboarding;
