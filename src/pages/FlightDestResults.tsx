import { useMemo } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChevronLeft } from "@fortawesome/free-solid-svg-icons";

const FlightDestResults = ({ onBack, responseData }: { onBack: () => void; responseData: string }) => {
  const { requestBodyText, responseText } = useMemo(() => {
    try {
      const parsed = JSON.parse(responseData);
      if (parsed && typeof parsed === "object" && "firecrawlRequestBody" in parsed && "response" in parsed) {
        return {
          requestBodyText: JSON.stringify(parsed.firecrawlRequestBody, null, 2),
          responseText: JSON.stringify(parsed.response, null, 2),
        };
      }
    } catch { /* fallback */ }
    return { requestBodyText: "(not available)", responseText: responseData };
  }, [responseData]);

  return (
    <div className="relative flex flex-col min-h-screen bg-[#F2F3F3] overflow-hidden">
      {/* Decorative circles */}
      <div className="absolute bottom-20 left-8 w-16 h-16 rounded-full bg-[#345C5A]/10 animate-float" />
      <div className="absolute top-20 right-8 w-10 h-10 rounded-full bg-[#345C5A]/10 animate-float-delay" />

      {/* Header */}
      <header className="relative z-10 grid grid-cols-[40px_1fr_40px] items-center px-6 pt-10 pb-4">
        <button
          type="button"
          onClick={onBack}
          className="h-12 w-10 flex items-center justify-start text-[#2E4A4A] hover:opacity-80 transition-opacity"
        >
          <FontAwesomeIcon icon={faChevronLeft} className="block w-6 h-6" />
        </button>

        {/* Match the button height so optical centering lines up */}
        <h1 className="h-12 flex items-center justify-center text-xl font-bold text-[#2E4A4A] tracking-tight leading-none whitespace-nowrap">
          Flight Results
        </h1>

        {/* Right spacer to keep title truly centered */}
        <div className="h-12 w-10" />
      </header>

      {/* Main content */}
      <div className="flex-1 flex flex-col px-6 pt-2 pb-6 gap-4 relative z-10">
        {/* Request body */}
        <div>
          <h2 className="text-sm font-semibold text-[#2E4A4A] mb-1">Request Body</h2>
          <textarea
            readOnly
            value={requestBodyText}
            className="w-full min-h-[120px] rounded-2xl border border-[#345C5A]/20 bg-white p-4 text-sm font-mono text-[#2E4A4A] resize-none focus:outline-none"
          />
        </div>

        {/* Response payload */}
        <div className="flex-1 flex flex-col">
          <h2 className="text-sm font-semibold text-[#2E4A4A] mb-1">Response Payload</h2>
          <textarea
            readOnly
            value={responseText}
            className="w-full flex-1 min-h-[300px] rounded-2xl border border-[#345C5A]/20 bg-white p-4 text-sm font-mono text-[#2E4A4A] resize-none focus:outline-none"
          />
        </div>
      </div>
    </div>
  );
};

export default FlightDestResults;
