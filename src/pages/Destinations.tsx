import { SplitFlapHeader } from "@/components/SplitFlapHeader";

const DestinationsPage = () => {
  return (
    <>
      <div className="px-6 pt-4 pb-4 relative z-10 animate-fade-in">
        <SplitFlapHeader word="DESTINAT" />
        <p className="text-[#6B7B7B] leading-relaxed text-base mt-2">Discover new places to explore.</p>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-8 relative z-10">
        {/* Destinations content goes here */}
      </div>
    </>
  );
};

export default DestinationsPage;
