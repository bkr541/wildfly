import { useState, type ReactNode, useRef, useEffect } from "react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Menu01Icon,
  Search01Icon,
  Home01Icon,
  Airplane01Icon,
  Location01Icon,
  UserGroupIcon,
  CreditCardIcon,
  Calendar03Icon,
  Logout01Icon,
  ArrowLeft01Icon,
  RouteIcon,
  Notification01Icon,
  UserSharingIcon,
} from "@hugeicons/core-free-icons";
import { useProfile } from "@/contexts/ProfileContext";
import { cn } from "@/lib/utils";

const menuItems = [
  { icon: Home01Icon, label: "Home" },
  { icon: Airplane01Icon, label: "Flights" },
  { icon: UserSharingIcon, label: "Fly-A-Friend", indent: true },
  { icon: Calendar03Icon, label: "Itinerary" },
  { icon: Location01Icon, label: "Destinations" },
  { icon: RouteIcon, label: "Routes" },
  { icon: UserGroupIcon, label: "Friends" },
  { icon: CreditCardIcon, label: "Subscription" },
];

const pageMap: Record<string, string> = {
  Home: "home",
  Flights: "flights",
  "Fly-A-Friend": "fly-a-friend",
  Itinerary: "itinerary",
  Destinations: "destinations",
  Routes: "routes",
  Subscription: "subscription",
};

interface MainLayoutProps {
  children: ReactNode;
  onSignOut: () => void;
  onNavigate: (page: string, data?: string) => void;
  hideHeaderRight?: boolean;
  subScreenTitle?: string | null;
  onSubScreenBack?: () => void;
}

const MainLayout = ({ children, onSignOut, onNavigate, hideHeaderRight = false, subScreenTitle, onSubScreenBack }: MainLayoutProps) => {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const { avatarUrl, initials, fullName } = useProfile();

  const handleMenuClick = (label: string) => {
    setSheetOpen(false);
    const target = pageMap[label];
    if (target) setTimeout(() => onNavigate(target), 300);
  };

  useEffect(() => {
    if (isSearchOpen) {
      searchInputRef.current?.focus();
    }
  }, [isSearchOpen]);

  return (
    <div className="relative flex flex-col min-h-screen bg-[#F2F3F3] overflow-hidden">
      {/* Background image */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-[0.07] pointer-events-none"
        style={{ backgroundImage: "url('/assets/authuser/newbg3.png')" }}
      />
      {/* Decorative circles */}
      <div className="absolute bottom-20 left-8 w-16 h-16 rounded-full bg-[#345C5A]/10 animate-float" />
      <div className="absolute top-20 right-8 w-10 h-10 rounded-full bg-[#345C5A]/10 animate-float-delay" />

      {/* Header */}
      {subScreenTitle ? (
        <header className="flex items-center justify-between px-[18px] pt-4 pb-2 relative z-10">
          <button
            type="button"
            onClick={onSubScreenBack}
            className="h-12 w-10 flex items-center justify-start text-[#2E4A4A] hover:opacity-70 transition-opacity"
          >
            <HugeiconsIcon icon={ArrowLeft01Icon} size={22} color="currentColor" strokeWidth={1.5} />
          </button>
          <h1 className="text-lg font-bold text-[#345C5A] tracking-tight">{subScreenTitle}</h1>
          <div className="w-10" />
        </header>
      ) : (
        <header className="flex items-center justify-between px-[18px] pt-4 pb-2 relative z-10">
          {/* Left: hamburger + sidebar */}
          <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
            <SheetTrigger asChild>
              <button
                type="button"
                className="h-12 w-10 flex items-center justify-start text-[#2E4A4A] hover:opacity-80 transition-opacity"
              >
                <HugeiconsIcon icon={Menu01Icon} size={24} color="currentColor" strokeWidth={1.5} />
              </button>
            </SheetTrigger>

            <SheetContent
              side="left"
              className="w-[85%] sm:max-w-sm p-0 bg-white border-none rounded-r-3xl flex flex-col"
            >
              {/* Sidebar profile header */}
              <div className="flex items-center gap-3 px-6 pt-6 pb-2">
                <Avatar className="h-12 w-12 border-2 border-[#E3E6E6] shadow-sm">
                  <AvatarImage src={avatarUrl ?? undefined} alt="Profile" />
                  <AvatarFallback className="bg-[#E3E6E6] text-[#345C5A] text-base font-bold">{initials}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-[#9CA3AF] text-sm font-medium">Hello,</p>
                  <p className="text-[#2E4A4A] text-lg font-semibold truncate leading-tight">{fullName}</p>
                </div>
                <button
                  onClick={() => setSheetOpen(false)}
                  className="text-[#9CA3AF] hover:text-[#2E4A4A] transition-colors"
                  type="button"
                >
                  <HugeiconsIcon icon={ArrowLeft01Icon} size={20} color="currentColor" strokeWidth={1.5} />
                </button>
              </div>

              <div className="h-px bg-[#E5E7EB] mx-6" />

              <nav className="flex-1 px-6 pt-2 flex flex-col justify-start gap-1">
                {menuItems.map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => handleMenuClick(item.label)}
                    className={cn(
                      "flex items-center gap-4 py-2.5 text-[#2E4A4A] hover:text-[#345C5A] hover:bg-[#F2F3F3] rounded-xl px-2 transition-colors w-full",
                      item.indent && "pl-8 text-sm",
                    )}
                  >
                    <HugeiconsIcon icon={item.icon} size={item.indent ? 17 : 20} color="currentColor" strokeWidth={1.5} />
                    <span className={cn("font-semibold", item.indent ? "text-sm" : "text-base")}>{item.label}</span>
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
                  <HugeiconsIcon icon={Logout01Icon} size={20} color="currentColor" strokeWidth={1.5} />
                  <span className="text-base font-semibold">Logout</span>
                </button>
              </div>
            </SheetContent>
          </Sheet>

          {/* Right: search, bell, avatar */}
          {!hideHeaderRight && (
            <div className="flex items-center gap-5 h-12">
              <div className="relative flex items-center h-12">
                <div
                  className={cn(
                    "flex items-center bg-white border border-[#E3E6E6] rounded-full transition-all duration-300 ease-in-out h-9 overflow-hidden relative",
                    isSearchOpen ? "w-56 opacity-100 shadow-sm pr-9" : "w-0 opacity-0 border-transparent px-0",
                  )}
                >
                  <input
                    ref={searchInputRef}
                    type="text"
                    placeholder="Search..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="bg-transparent outline-none text-xs text-[#2E4A4A] w-full pl-4 placeholder:text-[#9CA3AF]"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => setIsSearchOpen(!isSearchOpen)}
                  className={cn(
                    "flex items-center justify-center text-[#2E4A4A] hover:opacity-80 transition-all duration-300 ease-in-out",
                    isSearchOpen ? "absolute right-2.5 h-6 w-6" : "h-12 w-10",
                  )}
                >
                  <HugeiconsIcon icon={Search01Icon} size={22} color="currentColor" strokeWidth={1.5} />
                </button>
              </div>

              <div
                className={cn(
                  "flex items-center justify-center transition-all duration-300 ease-in-out overflow-hidden",
                  isSearchOpen ? "w-0 opacity-0 -mr-5" : "w-6 opacity-100",
                )}
              >
                <button
                  type="button"
                  className="h-full flex items-center justify-center text-[#2E4A4A] hover:opacity-80 transition-opacity relative"
                >
                  <HugeiconsIcon icon={Notification01Icon} size={24} color="currentColor" strokeWidth={1.5} />
                </button>
              </div>

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
      )}

      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  );
};

export default MainLayout;
