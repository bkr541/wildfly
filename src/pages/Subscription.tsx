import { useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCheckCircle,
  faPlus,
  faCreditCard,
  faChevronLeft,
} from "@fortawesome/free-solid-svg-icons";
import { cn } from "@/lib/utils";

const SubscriptionPage = () => {
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("yearly");

  return (
    <>
      {/* Title */}
      <div className="px-6 pt-0 pb-3 relative z-10 animate-fade-in">
        <h1 className="text-3xl font-bold text-[#2E4A4A] mb-0 tracking-tight">Subscription</h1>
        <p className="text-[#6B7B7B] leading-relaxed text-base">Manage your subscription and plan details.</p>
      </div>

      <div className="flex-1 flex flex-col items-center px-6 relative z-10 w-full animate-fade-in">
        {/* Monthly / Yearly Toggle Switch */}
        <div className="bg-white rounded-xl p-1 flex shadow-sm border border-[#E3E6E6] relative w-full max-w-[200px] mb-5">
          <div
            className="absolute top-1 bottom-1 rounded-lg bg-[#345C5A] shadow-sm transition-all duration-300 ease-in-out"
            style={{
              width: "calc(50% - 4px)",
              left: billingCycle === "monthly" ? "4px" : "calc(50% + 0px)",
            }}
          />
          <button
            type="button"
            onClick={() => setBillingCycle("monthly")}
            className={cn(
              "py-1.5 px-2 text-xs font-semibold rounded-lg transition-all duration-300 relative z-10 flex-1",
              billingCycle === "monthly" ? "text-white" : "text-[#9CA3AF] hover:text-[#6B7B7B]",
            )}
          >
            Monthly
          </button>
          <button
            type="button"
            onClick={() => setBillingCycle("yearly")}
            className={cn(
              "py-1.5 px-2 text-xs font-semibold rounded-lg transition-all duration-300 relative z-10 flex-1",
              billingCycle === "yearly" ? "text-white" : "text-[#9CA3AF] hover:text-[#6B7B7B]",
            )}
          >
            Yearly
          </button>
        </div>

        {/* Plan Cards */}
        <div className="flex justify-center gap-3 w-full max-w-md mb-5">
          {/* Free Plan */}
          <div className="bg-white rounded-2xl p-3 border-2 border-[#345C5A] flex flex-col items-start w-1/2 relative shadow-sm">
            <div className="absolute top-0 right-0 bg-[#345C5A] text-white text-[10px] uppercase font-bold py-0.5 px-2.5 rounded-bl-xl rounded-tr-xl">
              Free
            </div>
            <div className="mb-2 pt-3">
              <span className="text-2xl font-bold text-[#2E4A4A]">$0</span>
              <span className="text-[#6B7B7B] text-xs ml-1">{billingCycle === "yearly" ? "/yr" : "/mo"}</span>
            </div>
            <ul className="space-y-1.5 text-xs text-[#6B7B7B]">
              <li className="flex items-start">
                <FontAwesomeIcon icon={faCheckCircle} className="text-[#345C5A] w-3.5 h-3.5 mr-1.5 mt-0.5 shrink-0" />
                <span>10 Matches</span>
              </li>
              <li className="flex items-start">
                <FontAwesomeIcon icon={faCheckCircle} className="text-[#345C5A] w-3.5 h-3.5 mr-1.5 mt-0.5 shrink-0" />
                <span>Unlimited swipes</span>
              </li>
            </ul>
          </div>

          {/* Gold Plan */}
          <div className="bg-white rounded-2xl p-3 border-2 border-[#FBBF24] flex flex-col items-start w-1/2 relative shadow-sm">
            <div className="absolute top-0 right-0 bg-[#FBBF24] text-white text-[10px] uppercase font-bold py-0.5 px-2.5 rounded-bl-xl rounded-tr-xl">
              Gold
            </div>
            <div className="mb-2 pt-3">
              <span className="text-2xl font-bold text-[#2E4A4A]">{billingCycle === "yearly" ? "$400" : "$40"}</span>
              <span className="text-[#6B7B7B] text-xs ml-1">{billingCycle === "yearly" ? "/yr" : "/mo"}</span>
            </div>
            <ul className="space-y-1.5 text-xs text-[#6B7B7B]">
              <li className="flex items-start">
                <FontAwesomeIcon icon={faCheckCircle} className="text-[#FBBF24] w-3.5 h-3.5 mr-1.5 mt-0.5 shrink-0" />
                <span>10 Matches</span>
              </li>
              <li className="flex items-start">
                <FontAwesomeIcon icon={faCheckCircle} className="text-[#FBBF24] w-3.5 h-3.5 mr-1.5 mt-0.5 shrink-0" />
                <span>Unlimited swipes</span>
              </li>
              <li className="flex items-start">
                <FontAwesomeIcon icon={faCheckCircle} className="text-[#FBBF24] w-3.5 h-3.5 mr-1.5 mt-0.5 shrink-0" />
                <span>Video Chat</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Payment Method */}
        <div className="w-full max-w-md">
          <h2 className="text-base font-bold text-[#2E4A4A] mb-2">Payment Method</h2>
          <div className="space-y-2">
            <button className="flex items-center justify-between w-full bg-white rounded-xl p-3 border border-[#E3E6E6] hover:border-[#345C5A] transition-colors shadow-sm">
              <div className="flex items-center">
                <div className="w-8 h-8 rounded-full bg-[#F2F3F3] flex items-center justify-center mr-3">
                  <FontAwesomeIcon icon={faCreditCard} className="text-[#FBBF24] w-4 h-4" />
                </div>
                <div className="flex flex-col items-start">
                  <span className="text-[#6B7B7B] text-xs mb-0.5">Credit Card</span>
                  <span className="text-[#2E4A4A] font-bold text-sm">{billingCycle === "yearly" ? "$400" : "$40"}</span>
                </div>
              </div>
              <FontAwesomeIcon icon={faChevronLeft} className="text-[#345C5A] w-3.5 h-3.5 rotate-180" />
            </button>

            <button className="flex items-center justify-between w-full bg-white rounded-xl p-3 border border-[#E3E6E6] border-dashed hover:border-[#345C5A] transition-colors shadow-sm">
              <div className="flex items-center">
                <div className="w-8 h-8 rounded-full bg-[#F2F3F3] flex items-center justify-center mr-3">
                  <FontAwesomeIcon icon={faPlus} className="text-[#9CA3AF] w-4 h-4" />
                </div>
                <span className="text-[#2E4A4A] font-semibold text-sm">Add Payment Method</span>
              </div>
              <FontAwesomeIcon icon={faChevronLeft} className="text-[#9CA3AF] w-3.5 h-3.5 rotate-180" />
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default SubscriptionPage;
