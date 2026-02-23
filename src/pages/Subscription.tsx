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
  faWallet,
} from "@fortawesome/free-solid-svg-icons";

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
  const [userName, setUserName] = useState("Explorer");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [fullName, setFullName] = useState("");

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
        setUserName(data.first_name || "Explorer");
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

      <div className="px-6 pt-2 pb-6 relative z-10 animate-fade-in">
        <h1 className="text-2xl font-bold text-[#2E4A4A] text-center tracking-tight">
          Subscribe and <br /> Make new Friends
        </h1>
        <p className="text-[#6B7B7B] leading-relaxed text-sm text-center mt-1">join to our community!</p>
      </div>

      <div className="flex-1 flex flex-col items-center px-6 relative z-10 w-full">
        {/* Yearly Toggle */}
        <div className="flex items-center justify-center mb-6">
          <label className="flex items-center cursor-pointer">
            <div className="relative">
              <input type="checkbox" className="sr-only" defaultChecked />
              <div className="w-10 h-6 bg-[#E3E6E6] rounded-full shadow-inner"></div>
              <div className="dot absolute w-4 h-4 bg-[#8B5CF6] rounded-full shadow -left-1 -top-1 transition"></div>
            </div>
            <div className="ml-3 text-[#8B5CF6] font-semibold">yearly</div>
          </label>
        </div>

        {/* Plan Cards */}
        <div className="flex justify-center gap-4 w-full max-w-md mb-8">
          {/* Plus+ Plan */}
          <div className="bg-white rounded-2xl p-4 border-2 border-[#8B5CF6] flex flex-col items-start w-1/2 relative">
            <div className="absolute top-0 right-0 bg-[#8B5CF6] text-white text-sm font-semibold py-1 px-4 rounded-bl-2xl rounded-tr-2xl">
              Plus+
            </div>
            <div className="mb-2 pt-6">
              <span className="text-3xl font-bold text-[#2E4A4A]">$25</span>
              <span className="text-[#6B7B7B]">/mo</span>
            </div>
            <ul className="space-y-2 text-sm text-[#6B7B7B]">
              <li className="flex items-center">
                <FontAwesomeIcon icon={faCheckCircle} className="text-[#8B5CF6] w-4 h-4 mr-2" />
                10 Matches
              </li>
              <li className="flex items-center">
                <FontAwesomeIcon icon={faCheckCircle} className="text-[#8B5CF6] w-4 h-4 mr-2" />
                Unlimited swipes
              </li>
            </ul>
          </div>

          {/* Gold Plan */}
          <div className="bg-white rounded-2xl p-4 border-2 border-[#FBBF24] flex flex-col items-start w-1/2 relative">
            <div className="absolute top-0 right-0 bg-[#FBBF24] text-white text-sm font-semibold py-1 px-4 rounded-bl-2xl rounded-tr-2xl">
              Gold
            </div>
            <div className="mb-2 pt-6">
              <span className="text-3xl font-bold text-[#2E4A4A]">$40</span>
              <span className="text-[#6B7B7B]">/mo</span>
            </div>
            <ul className="space-y-2 text-sm text-[#6B7B7B]">
              <li className="flex items-center">
                <FontAwesomeIcon icon={faCheckCircle} className="text-[#FBBF24] w-4 h-4 mr-2" />
                10 Matches
              </li>
              <li className="flex items-center">
                <FontAwesomeIcon icon={faCheckCircle} className="text-[#FBBF24] w-4 h-4 mr-2" />
                Unlimited swipes
              </li>
              <li className="flex items-center">
                <FontAwesomeIcon icon={faCheckCircle} className="text-[#FBBF24] w-4 h-4 mr-2" />
                Video Chat
              </li>
            </ul>
          </div>
        </div>

        {/* Payment Method */}
        <div className="w-full max-w-md">
          <h2 className="text-xl font-bold text-[#2E4A4A] mb-4">Payment Method</h2>
          <div className="space-y-4">
            {/* Wallet (Paypal Replacement) */}
            <button className="flex items-center justify-between w-full bg-white rounded-xl p-4 border border-[#E3E6E6] hover:border-[#8B5CF6] transition-colors">
              <div className="flex items-center">
                <FontAwesomeIcon icon={faWallet} className="text-[#003087] w-6 h-6 mr-4" />
                <div className="flex flex-col items-start">
                  <span className="text-[#6B7B7B] text-sm">Paypal</span>
                  <span className="text-[#2E4A4A] font-semibold">$480</span>
                </div>
              </div>
              <FontAwesomeIcon icon={faChevronLeft} className="text-[#8B5CF6] w-4 h-4 rotate-180" />
            </button>

            {/* Generic Credit Card */}
            <button className="flex items-center justify-between w-full bg-white rounded-xl p-4 border border-[#E3E6E6] hover:border-[#8B5CF6] transition-colors">
              <div className="flex items-center">
                <FontAwesomeIcon icon={faCreditCard} className="text-[#FBBF24] w-6 h-6 mr-4" />
                <div className="flex flex-col items-start">
                  <span className="text-[#6B7B7B] text-sm">Credit Card</span>
                  <span className="text-[#2E4A4A] font-semibold">$480</span>
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
