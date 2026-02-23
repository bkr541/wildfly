import { useProfile } from "@/contexts/ProfileContext";

const HomePage = () => {
  const { userName } = useProfile();

  return (
    <>
      {/* Title Group - Mirrored Spacing from Flights.tsx */}
      <div className="px-6 pt-0 pb-3 relative z-10 animate-fade-in">
        <h1 className="text-3xl font-bold text-[#2E4A4A] mb-1 tracking-tight">{userName}'s Home</h1>
        <p className="text-[#6B7B7B] leading-relaxed text-base">Feeling a little wild today? Let's go explore.</p>
      </div>

      {/* Main content area */}
      <div className="flex-1 flex flex-col items-center justify-center px-8 relative z-10">
        {/* Your dashboard or featured content goes here */}
      </div>
    </>
  );
};

export default HomePage;
