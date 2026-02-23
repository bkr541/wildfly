import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faBars,
  faHouse,
  faPlane,
  faLocationDot,
  faUserGroup,
  faCreditCard,
  faRightFromBracket,
  faChevronLeft,
  faCheckCircle,
} from "@fortawesome/free-solid-svg-icons";
import { cn } from "@/lib/utils";

const menuItems = [
  { icon: faHouse, label: "Home" },
  { icon: faPlane, label: "Flights" },
  { icon: faLocationDot, label: "Destinations" },
  { icon: faUserGroup, label: "Friends" },
  { icon: faCreditCard, label: "Subscription" },
];

const SubscriptionPage = ({ onSignOut, onNavigate }: { onSignOut: () => void; onNavigate: (page: string) => void }) => {
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [initials, setInitials] = useState("U");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [fullName, setFullName] = useState("");
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("yearly");

  useEffect(() => {
    const loadProfile = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from("user_info")
        .select("image_file, first_name, last_name")
        .eq("auth_user_id", user.id)
        .maybeSingle();

      if (data) {
        if (data.image_file && data.image_file.startsWith("http")) {
          setAvatarUrl(data.image_file);
        }
        const fi = (data.first_name?.[0] || "").toUpperCase();
        const li = (data.last_name?.[0] || "").toUpperCase();
        setInitials(fi + li || "U");
        setFullName([data.first_name, data.last_name].filter(Boolean).join(" ") || "Explorer");
      }
    };

    loadProfile();
  }, []);

  return (
    <div className="relative flex flex-col min-h-screen bg-[#F2F3F3] overflow-hidden">
      <div className="absolute bottom-20 left-8 w-16 h-16 rounded-full bg-[#345C5A]/10 animate-float" />
      <div className="absolute top-20 right-8 w-10 h-10 rounded-full bg-[#345C5A]/10 animate-float-delay" />

      <header className="flex items-center justify-between px-6 pt-10 pb-4 relative z-10">
        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetTrigger asChild>
            <button
              type="button"
              className="h-12 w-10 flex items-center justify-start text-[#2E4A4A] hover:opacity-80 transition-opacity"
            >
              <FontAwesomeIcon icon={faBars} className="w-6 h-6" />
            </button>
          </SheetTrigger>

          <SheetContent
            side="left"
            className="w-[85%] sm:max-w-sm p-0 bg-white border-none rounded-r-3xl flex flex-col"
          >
            <div className="flex items-center gap-4 px-6 pt-10 pb-6">
              <Avatar className="h-12 w-12 border-2 border-[#E3E6E6] shadow-sm">
                <AvatarImage src={avatarUrl ?? undefined} alt="Profile" />
                <AvatarFallback className="bg-[#E3E6E6] text-[#345C5A] text-base font-bold">{initials}</AvatarFallback>
              </Avatar>

              <div className="flex-1 min-w-0">
                <p className="text-[#9CA3AF] text-sm font-medium">Hello,</p>
                <p className="text-[#2E4A4A] text-lg font-semibold truncate">{fullName}</p>
              </div>

              <button
                onClick={() => setSheetOpen(false)}
                className="text-[#9CA3AF] hover:text-[#2E4A4A] transition-colors"
                type="button"
              >
                <FontAwesomeIcon icon={faChevronLeft} className="w-5 h-5" />
              </button>
            </div>

            <div className="h-px bg-[#E5E7EB] mx-6" />

            <nav className="flex-1 px-6 pt-4 flex flex-col justify-start gap-1">
              {menuItems.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => {
                    setSheetOpen(false);
                    const pageMap: Record<string, string> = {
                      Home: "home",
                      Flights: "flights",
                      Destinations: "destinations",
                      Subscription: "subscription",
                    };
                    const target = pageMap[item.label];
                    if (target) setTimeout(() => onNavigate(target), 300);
                  }}
                  className="flex items-center gap-4 py-2.5 text-[#2E4A4A] hover:text-[#345C5A] hover:bg-[#F2F3F3] rounded-xl px-2 transition-colors"
                >
                  <FontAwesomeIcon icon={item.icon} className="w-5 h-5" />
                  <span className="text-base font-semibold">{item.label}</span>
                </button>
              ))}
            </nav>

            <div className="mt-auto">
              <div className="h-px bg-[#E5E7EB] mx-6" />
              <button
                onClick={() => {
                  setSheetOpen(false);
                  setTimeout(() => onSignOut(), 300);
                }}
                type="button"
                className="flex items-center gap-4 px-8 py-5 text-[#2E4A4A] hover:text-red-600 transition-colors w-full"
              >
                <FontAwesomeIcon icon={faRightFromBracket} className="w-5 h-5" />
                <span className="text-base font-semibold">Logout</span>
              </button>
            </div>
          </SheetContent>
        </Sheet>
      </header>

      {/* Header section styled like Home/Flights */}
      <div className="px-6 pt-2 pb-4 relative z-10 animate-fade-in">
        <h1 className="text-3xl font-bold text-[#2E4A4A] mb-2 tracking-tight">Subscription</h1>
        <p className="text-[#6B7B7B] leading-relaxed text-base">Manage your subscription and plan details.</p>
      </div>

      <div className="flex-1 flex flex-col items-center px-6 relative z-10 w-full animate-fade-in">
        {/* Monthly / Yearly Toggle Switch - Compact */}
        <div className="bg-white rounded-2xl p-1 flex shadow-sm border border-[#E3E6E6] relative w-full max-w-[220px] mb-6">
          <div
            className="absolute top-1 bottom-1 rounded-xl bg-[#345C5A] shadow-sm transition-all duration-300 ease-in-out"
            style={{
              width: "calc(50% - 4px)",
              left: billingCycle === "monthly" ? "4px" : "calc(50% + 0px)",
            }}
          />
          <button
            type="button"
            onClick={() => setBillingCycle("monthly")}
            className={cn(
              "py-1.5 px-3 text-sm font-semibold rounded-xl transition-all duration-300 relative z-10 flex-1",
              billingCycle === "monthly" ? "text-white" : "text-[#9CA3AF] hover:text-[#6B7B7B]",
            )}
          >
            Monthly
          </button>
          <button
            type="button"
            onClick={() => setBillingCycle("yearly")}
            className={cn(
              "py-1.5 px-3 text-sm font-semibold rounded-xl transition-all duration-300 relative z-10 flex-1",
              billingCycle === "yearly" ? "text-white" : "text-[#9CA3AF] hover:text-[#6B7B7B]",
            )}
          >
            Yearly
          </button>
        </div>

        {/* Plan Cards - Tighter spacing */}
        <div className="flex justify-center gap-4 w-full max-w-md mb-6">
          {/* Free Plan */}
          <div className="bg-white rounded-2xl p-4 border-2 border-[#8B5CF6] flex flex-col items-start w-1/2 relative shadow-sm">
            <div className="absolute top-0 right-0 bg-[#8B5CF6] text-white text-xs font-bold py-1 px-3 rounded-bl-2xl rounded-tr-xl">
              Free
            </div>
            <div className="mb-3 pt-4">
              <span className="text-3xl font-bold text-[#2E4A4A]">$0</span>
              <span className="text-[#6B7B7B] ml-1">{billingCycle === "yearly" ? "/yr" : "/mo"}</span>
            </div>
            <ul className="space-y-2 text-sm text-[#6B7B7B]">
              <li className="flex items-start">
                <FontAwesomeIcon icon={faCheckCircle} className="text-[#8B5CF6] w-4 h-4 mr-2 mt-0.5 shrink-0" />
                <span>10 Matches</span>
              </li>
              <li className="flex items-start">
                <FontAwesomeIcon icon={faCheckCircle} className="text-[#8B5CF6] w-4 h-4 mr-2 mt-0.5 shrink-0" />
                <span>Unlimited swipes</span>
              </li>
            </ul>
          </div>

          {/* Gold Plan */}
          <div className="bg-white rounded-2xl p-4 border-2 border-[#FBBF24] flex flex-col items-start w-1/2 relative shadow-sm">
            <div className="absolute top-0 right-0 bg-[#FBBF24] text-white text-xs font-bold py-1 px-3 rounded-bl-2xl rounded-tr-xl">
              Gold
            </div>
            <div className="mb-3 pt-4">
              <span className="text-3xl font-bold text-[#2E4A4A]">{billingCycle === "yearly" ? "$400" : "$40"}</span>
              <span className="text-[#6B7B7B] ml-1">{billingCycle === "yearly" ? "/yr" : "/mo"}</span>
            </div>
            <ul className="space-y-2 text-sm text-[#6B7B7B]">
              <li className="flex items-start">
                <FontAwesomeIcon icon={faCheckCircle} className="text-[#FBBF24] w-4 h-4 mr-2 mt-0.5 shrink-0" />
                <span>10 Matches</span>
              </li>
              <li className="flex items-start">
                <FontAwesomeIcon icon={faCheckCircle} className="text-[#FBBF24] w-4 h-4 mr-2 mt-0.5 shrink-0" />
                <span>Unlimited swipes</span>
              </li>
              <li className="flex items-start">
                <FontAwesomeIcon icon={faCheckCircle} className="text-[#FBBF24] w-4 h-4 mr-2 mt-0.5 shrink-0" />
                <span>Video Chat</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Payment Method - Compact layout */}
        <div className="w-full max-w-md">
          <h2 className="text-lg font-bold text-[#2E4A4A] mb-3">Payment Method</h2>
          <div className="space-y-3">
            {/* Credit Card Only */}
            <button className="flex items-center justify-between w-full bg-white rounded-xl p-4 border border-[#E3E6E6] hover:border-[#8B5CF6] transition-colors shadow-sm">
              <div className="flex items-center">
                <div className="w-8 h-8 rounded-full bg-[#F2F3F3] flex items-center justify-center mr-3">
                  <FontAwesomeIcon icon={faCreditCard} className="text-[#FBBF24] w-4 h-4" />
                </div>
                <div className="flex flex-col items-start">
                  <span className="text-[#6B7B7B] text-xs mb-0.5">Credit Card</span>
                  <span className="text-[#2E4A4A] font-bold text-sm">{billingCycle === "yearly" ? "$400" : "$40"}</span>
                </div>
              </div>
              <FontAwesomeIcon icon={faChevronLeft} className="text-[#8B5CF6] w-4 h-4 rotate-180" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SubscriptionPage;
