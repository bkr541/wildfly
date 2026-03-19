/**
 * BillingCancel
 *
 * Shown when the user cancels on the Stripe Checkout page,
 * or returns from the Stripe Billing Portal.
 */

import { useNavigate } from "react-router-dom";
import { HugeiconsIcon } from "@hugeicons/react";
import { CreditCardIcon, ArrowLeft01Icon } from "@hugeicons/core-free-icons";

export default function BillingCancel() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F7F9F9] px-6">
      <div className="w-full max-w-sm text-center flex flex-col items-center gap-5">
        <div
          className="w-20 h-20 rounded-full flex items-center justify-center"
          style={{ background: "#F3F4F6" }}
        >
          <HugeiconsIcon icon={CreditCardIcon} size={36} color="#9CA3AF" strokeWidth={1.5} />
        </div>

        <h1 className="text-xl font-bold text-[#2E4A4A]">Purchase Canceled</h1>
        <p className="text-sm text-[#6B7B7B] leading-relaxed">
          Your checkout was canceled and you have not been charged.
          You can upgrade your plan or purchase credits any time from the Subscription screen.
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
