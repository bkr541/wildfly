import { useState } from "react";
import { BottomSheet } from "@/components/BottomSheet";

interface Props {
  pageLabel: string;
}

const BetaFeedbackButton = ({ pageLabel }: Props) => {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        aria-label="Submit beta feedback"
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-[9000] w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-transform duration-150 active:scale-95 hover:scale-105"
        style={{ background: "#10B981" }}
      >
        <img src="/assets/icons/feedback.svg" alt="" className="w-6 h-6" />
      </button>

      <BottomSheet open={open} onClose={() => setOpen(false)}>
        <div className="px-5 pb-8">
          <h2 className="text-lg font-semibold text-[#2E4A4A] mb-4">{pageLabel}</h2>
        </div>
      </BottomSheet>
    </>
  );
};

export default BetaFeedbackButton;
