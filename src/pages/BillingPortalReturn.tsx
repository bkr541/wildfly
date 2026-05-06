/**
 * BillingPortalReturn
 *
 * Shown when the user returns from the Stripe Billing Portal.
 * Neutral messaging — they may have updated a card, changed a plan,
 * canceled a subscription, or just browsed without making any changes.
 */

import { useNavigate } from "react-router-dom";
import { HugeiconsIcon } from "@hugeicons/react";
import { CheckmarkCircle01Icon, ArrowLeft01Icon } from "@hugeicons/core-free-icons";

export default function BillingPortalReturn() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F7F9F9] px-6">
      <div className="w-full max-w-sm text-center flex flex-col items-center gap-5">
        <div
          className="w-20 h-20 rounded-full flex items-center justify-center"
          style={{ background: "#D1FAE5" }}
        >
          <HugeiconsIcon icon={CheckmarkCircle01Icon} size={36} color="#059669" strokeWidth={1.5} />
        </div>

        <h1 className="text-xl font-bold text-[#2E4A4A]">All Done</h1>
        <p className="text-sm text-[#6B7B7B] leading-relaxed">
          Your billing settings have been updated. Any changes may take a moment to reflect in the app.
        </p>

        <button
          onClick={() => navigate("/")}
          className="mt-2 w-full py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2"
          style={{ background: "#345C5A", color: "white" }}
        >
          <HugeiconsIcon icon={ArrowLeft01Icon} size={16} color="white" strokeWidth={2} />
          Back to App
        </button>
      </div>
    </div>
  );
}
