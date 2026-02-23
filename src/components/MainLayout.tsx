import { useState, type ReactNode } from "react";
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
  faChevronLeft,
} from "@fortawesome/free-solid-svg-icons";
import { faBell } from "@fortawesome/free-regular-svg-icons";
import { useProfile } from "@/contexts/ProfileContext";

const menuItems = [
  { icon: faHouse, label: "Home" },
  { icon: faPlane, label: "Flights" },
  { icon: faLocationDot, label: "Destinations" },
  { icon: faUserGroup, label: "Friends" },
  { icon: faCreditCard, label: "Subscription" },
];

const pageMap: Record<string, string> = {
  Home: "home",
  Flights: "flights",
  Destinations: "destinations",
  Subscription: "subscription",
};

interface MainLayoutProps {
  children: ReactNode;
  onSignOut: () => void;
  onNavigate: (page: string, data?: string) => void;
  /** Hide the right-side header icons (search, bell, avatar). Default false. */
  hideHeaderRight?: boolean;
}

const MainLayout = ({ children, onSignOut, onNavigate, hideHeaderRight = false }: MainLayoutProps) => {
  const [sheetOpen, setSheetOpen] = useState(false);
  const { avatarUrl, initials, fullName } = useProfile();

  const handleMenuClick = (label: string) => {
    setSheetOpen(false);
    const target = pageMap[label];
    if (target) setTimeout(() => onNavigate(target), 300);
  };

  return (
    <div className="relative flex flex-col min-h-screen bg-[#F2F3F3] overflow-hidden">
      {/* Decorative circles */}
      <div className="absolute bottom-20 left-8 w-16 h-16 rounded-full bg-[#345C5A]/10 animate-float" />
      <div className="absolute top-20 right-8 w-10 h-10 rounded-full bg-[#345C5A]/10 animate-float-delay" />

      {/* Header */}
      <header className="flex items-center justify-between px-6 pt-10 pb-4 relative z-10">
        {/* Left: hamburger + sidebar */}
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
            {/* Sidebar profile header */}
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
                  onClick={() => handleMenuClick(item.label)}
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

        {/* Right: search, bell, avatar (conditionally hidden) */}
        {!hideHeaderRight && (
          <div className="flex items-center gap-5 h-12">
            <button
              type="button"
              className="h-full flex items-center justify-center text-[#2E4A4A] hover:opacity-80 transition-opacity relative"
            >
              <FontAwesomeIcon icon={faMagnifyingGlass} className="w-[22px] h-[22px]" />
            </button>
            <button
              type="button"
              className="h-full flex items-center justify-center text-[#2E4A4A] hover:opacity-80 transition-opacity relative"
            >
              <FontAwesomeIcon icon={faBell} className="w-6 h-6" />
            </button>
            <Avatar
              className="h-12 w-12 border-2 border-[#E3E6E6] shadow-sm cursor-pointer hover:opacity-90 transition-opacity"
              onClick={() => onNavigate("account")}
            >
              <AvatarImage src={avatarUrl ?? undefined} alt="Profile" />
              <AvatarFallback className="bg-[#E3E6E6] text-[#345C5A] text-base font-bold">{initials}</AvatarFallback>
            </Avatar>
          </div>
        )}
      </header>

      {/* Page content */}
      {children}
    </div>
  );
};

export default MainLayout;
