import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChevronLeft } from "@fortawesome/free-solid-svg-icons";

const FlightDestResults = ({ onBack, responseData }: { onBack: () => void; responseData: string }) => {
  return (
    <div className="relative flex flex-col min-h-screen bg-[#F2F3F3] overflow-hidden">
      {/* Decorative circles */}
      <div className="absolute bottom-20 left-8 w-16 h-16 rounded-full bg-[#345C5A]/10 animate-float" />
      <div className="absolute top-20 right-8 w-10 h-10 rounded-full bg-[#345C5A]/10 animate-float-delay" />

      {/* Header */}
      <header className="relative flex items-center px-6 pt-10 pb-4 z-10">
        <button
          type="button"
          onClick={onBack}
          className="h-12 w-10 flex items-center justify-start text-[#2E4A4A] hover:opacity-80 transition-opacity"
        >
          <FontAwesomeIcon icon={faChevronLeft} className="w-6 h-6" />
        </button>

        {/* Centered title across full header width (no wrap) */}
        <h1 className="absolute inset-0 flex items-center justify-center text-xl font-bold text-[#2E4A4A] tracking-tight leading-none whitespace-nowrap pointer-events-none">
          Flight Results
        </h1>
      </header>

      {/* Main content */}
      <div className="flex-1 flex flex-col px-6 pt-2 pb-6 relative z-10">
        <textarea
          readOnly
          value={responseData}
          className="w-full flex-1 min-h-[300px] rounded-2xl border border-[#345C5A]/20 bg-white p-4 text-sm font-mono text-[#2E4A4A] resize-none focus:outline-none"
        />
      </div>
    </div>
  );
};

export default FlightDestResults;
