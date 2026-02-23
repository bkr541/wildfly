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
} from "@fortawesome/free-solid-svg-icons";

const menuItems = [
  { icon: faHouse, label: "Home" },
  { icon: faPlane, label: "Flights" },
  { icon: faLocationDot, label: "Destinations" },
  { icon: faUserGroup, label: "Friends" },
  { icon: faCreditCard, label: "Subscription" },
];

const SubscriptionPage = ({
  onSignOut,
  onNavigate,
}: {
  onSignOut: () => void;
  onNavigate: (page: string) => void;
}) => {
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
        <h1 className="text-3xl font-bold text-[#2E4A4A] mb-2 tracking-tight">Subscription</h1>
        <p className="text-[#6B7B7B] leading-relaxed text-base">Manage your subscription and plan details.</p>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-8 relative z-10">
        {/* Add subscription content here */}
      </div>
    </div>
  );
};

export default SubscriptionPage;
