import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faBars,
  faMagnifyingGlass,
  faHouse,
  faPlane,
  faLocationDot,
  faUserGroup,
  faCreditCard,
  faRightFromBracket,
} from "@fortawesome/free-solid-svg-icons";
import { faBell } from "@fortawesome/free-regular-svg-icons";

const menuItems = [
  { icon: faHouse, label: "Home" },
  { icon: faPlane, label: "Flights" },
  { icon: faLocationDot, label: "Destinations" },
  { icon: faUserGroup, label: "Friends" },
  { icon: faCreditCard, label: "Subscription" },
];

const HomePage = ({ onSignOut, onNavigateAccount }: { onSignOut: () => void; onNavigateAccount: () => void }) => {
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [initials, setInitials] = useState("U");
  const [userName, setUserName] = useState("Explorer");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [fullName, setFullName] = useState("");

  useEffect(() => {
    const loadAvatar = async () => {
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
    loadAvatar();
  }, []);

  return (
    <div className="relative flex flex-col min-h-screen bg-[#F2F3F3] overflow-hidden">
      {/* Decorative circles */}
      <div className="absolute bottom-20 left-8 w-16 h-16 rounded-full bg-[#345C5A]/10 animate-float" />
      <div className="absolute top-20 right-8 w-10 h-10 rounded-full bg-[#345C5A]/10 animate-float-delay" />

      {/* Header layout */}
      <header className="flex items-center justify-between px-6 pt-10 pb-4 relative z-10">
        {/* Left Side: Menu Icon → opens Sheet */}
        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetTrigger asChild>
            <button className="h-12 w-10 flex items-center justify-start text-[#2E4A4A] hover:opacity-80 transition-opacity">
              <FontAwesomeIcon icon={faBars} className="w-6 h-6" />
            </button>
          </SheetTrigger>
          <SheetContent
            side="left"
            // The [&>button]:hidden class removes the default shadcn "X" close button
            className="w-[85%] sm:max-w-sm p-0 bg-[#345C5A] border-none rounded-r-3xl flex flex-col [&>button]:hidden"
          >
            {/* Profile header */}
            <div className="flex items-center gap-4 px-6 pt-10 pb-4">
              <Avatar className="h-12 w-12 border-2 border-[#E3E6E6] shadow-sm">
                <AvatarImage src={avatarUrl ?? undefined} alt="Profile" />
                <AvatarFallback className="bg-[#E3E6E6] text-[#345C5A] text-base font-bold">{initials}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-[#F2F3F3]/70 text-sm font-medium">Hello,</p>
                <p className="text-white text-lg font-semibold truncate">{fullName}</p>
              </div>
            </div>

            <div className="h-px bg-white/10 mx-6" />

            {/* Nav items */}
            <nav className="flex-1 px-6 pt-4 flex flex-col gap-1">
              {menuItems.map((item) => (
                <button
                  key={item.label}
                  className="flex items-center gap-5 py-3 text-[#F2F3F3] hover:text-white hover:bg-white/10 rounded-xl px-2 transition-colors"
                >
                  <FontAwesomeIcon icon={item.icon} className="w-5 h-5" />
                  <span className="text-base font-semibold">{item.label}</span>
                </button>
              ))}
            </nav>

            {/* Logout at bottom */}
            <div className="mt-auto pb-6">
              <div className="h-px bg-white/10 mx-6" />
              <button
                onClick={() => {
                  setSheetOpen(false);
                  onSignOut();
                }}
                className="flex items-center gap-5 px-8 pt-6 pb-2 text-[#F2F3F3] hover:text-red-400 transition-colors w-full"
              >
                <FontAwesomeIcon icon={faRightFromBracket} className="w-5 h-5" />
                <span className="text-base font-semibold">Logout</span>
              </button>
            </div>
          </SheetContent>
        </Sheet>

        {/* Right Side: Search, Notifications & Avatar */}
        <div className="flex items-center gap-5 h-12">
          {/* Search Icon */}
          <button className="h-full flex items-center justify-center text-[#2E4A4A] hover:opacity-80 transition-opacity relative">
            <FontAwesomeIcon icon={faMagnifyingGlass} className="w-[22px] h-[22px]" />
          </button>

          {/* Notification Icon (Outline) */}
          <button className="h-full flex items-center justify-center text-[#2E4A4A] hover:opacity-80 transition-opacity relative">
            <FontAwesomeIcon icon={faBell} className="w-6 h-6" />
          </button>

          {/* Avatar */}
          <Avatar
            className="h-12 w-12 border-2 border-[#E3E6E6] shadow-sm cursor-pointer hover:opacity-90 transition-opacity"
            onClick={onNavigateAccount}
          >
            <AvatarImage src={avatarUrl ?? undefined} alt="Profile" />
            <AvatarFallback className="bg-[#E3E6E6] text-[#345C5A] text-base font-bold">{initials}</AvatarFallback>
          </Avatar>
        </div>
      </header>

      {/* Title Group */}
      <div className="px-6 pt-2 pb-6 relative z-10 animate-fade-in">
        <h1 className="text-3xl font-bold text-[#2E4A4A] mb-1 tracking-tight">Welcome, {userName}!</h1>
        <p className="text-[#6B7B7B] leading-relaxed text-base">Feeling a little wild today? Let's go explore.</p>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col items-center justify-center px-8 relative z-10">
        {/* We can drop upcoming trips or flight cards right in here */}
      </div>
    </div>
  );
};

export default HomePage;
