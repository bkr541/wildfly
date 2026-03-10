import { useState, type ReactNode, useRef, useEffect } from "react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Menu03Icon,
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
  Notification02Icon,
  Search02Icon,
} from "@hugeicons/core-free-icons";
import { useProfile } from "@/contexts/ProfileContext";
import { cn } from "@/lib/utils";

const menuItems = [
  { icon: Home01Icon, label: "Home" },
  { type: "heading", label: "Explore Flights" },
  { icon: Airplane01Icon, label: "Book a Flight", indent: true },
  { icon: Search01Icon, label: "Quick Search", indent: true },
  { icon: UserSharingIcon, label: "Fly-A-Friend", indent: true },
  { icon: RouteIcon, label: "Routes", indent: true },
  { type: "heading", label: "Trip Hub" },
  { icon: Calendar03Icon, label: "Itinerary", indent: true },
  { icon: UserGroupIcon, label: "Friends", indent: true },
  { type: "heading", label: "Explore Destinations" },
  { icon: Location01Icon, label: "Search Destinations", indent: true },
  { icon: Home01Icon, label: "Hubs", indent: true },
];

const pageMap: Record<string, string> = {
  Home: "home",
  "Book a Flight": "flights",
  "Quick Search": "quick-search",
  "Fly-A-Friend": "fly-a-friend",
  Itinerary: "itinerary",
  "Search Destinations": "destinations",
  Routes: "routes",
  Friends: "friends",
  Hubs: "hubs",
  Subscription: "subscription",
};

const DRAWER_WIDTH = 80; // percent of screen

interface MainLayoutProps {
  children: ReactNode;
  onSignOut: () => void;
  onNavigate: (page: string, data?: string) => void;
  hideHeaderRight?: boolean;
  subScreenTitle?: string | null;
  onSubScreenBack?: () => void;
  currentPage?: string;
}

const MainLayout = ({ children, onSignOut, onNavigate, hideHeaderRight = false, subScreenTitle, onSubScreenBack, currentPage }: MainLayoutProps) => {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const { avatarUrl, initials, fullName } = useProfile();

  const handleMenuClick = (label: string) => {
    setDrawerOpen(false);
    const target = pageMap[label];
    if (target) setTimeout(() => onNavigate(target), 300);
  };

  useEffect(() => {
    if (isSearchOpen) {
      searchInputRef.current?.focus();
    }
  }, [isSearchOpen]);

  // Prevent body scroll when drawer is open
  useEffect(() => {
    document.body.style.overflow = drawerOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [drawerOpen]);

  return (
    <div className="relative flex min-h-screen bg-[#F2F3F3] overflow-hidden">

      {/* ── Sidebar drawer panel ── */}
      <div
        className="fixed inset-y-0 left-0 z-40 flex flex-col bg-white"
        style={{
          width: `${DRAWER_WIDTH}%`,
          transform: drawerOpen ? "translateX(0)" : `translateX(-100%)`,
          transition: "transform 0.32s cubic-bezier(0.4,0,0.2,1)",
          willChange: "transform",
        }}
      >
        {/* Sidebar profile header */}
        <div className="flex items-center gap-3 px-6 pt-10 pb-2">
          <Avatar
            className="h-12 w-12 border-2 border-[#E3E6E6] shadow-sm cursor-pointer hover:opacity-90 transition-opacity"
            onClick={() => { setDrawerOpen(false); setTimeout(() => onNavigate("account"), 300); }}
          >
            <AvatarImage src={avatarUrl ?? undefined} alt="Profile" />
            <AvatarFallback className="bg-[#E3E6E6] text-[#345C5A] text-base font-bold">{initials}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-[#9CA3AF] text-sm font-medium">Hello,</p>
            <p className="text-[#2E4A4A] text-lg font-semibold truncate leading-tight">{fullName}</p>
          </div>
          <button
            onClick={() => setDrawerOpen(false)}
            className="text-[#9CA3AF] hover:text-[#2E4A4A] transition-colors"
            type="button"
          >
            <HugeiconsIcon icon={ArrowLeft01Icon} size={20} color="currentColor" strokeWidth={1.5} />
          </button>
        </div>

        <div className="h-px bg-[#E5E7EB] mx-6" />

        <nav className="flex-1 px-6 pt-2 flex flex-col justify-start gap-0 overflow-y-auto">
          {menuItems.map((item) => {
            if ((item as any).type === "heading") {
              return (
                <p key={item.label} className="text-[10px] font-bold uppercase tracking-widest text-[#059669] px-2 pt-3 pb-0.5">
                  {item.label}
                </p>
              );
            }
            const pageKey = pageMap[item.label];
            const isActive = pageKey === currentPage || (item.label === "Home" && currentPage === "home");
            return (
              <button
                key={item.label}
                type="button"
                onClick={() => handleMenuClick(item.label)}
                className={cn(
                  "flex items-center gap-2.5 py-1.5 rounded-xl px-2 transition-colors w-full hover:bg-[#F2F3F3]",
                  (item as any).indent && "pl-5",
                  isActive ? "text-[#059669]" : "text-[#2E4A4A] hover:text-[#345C5A]",
                )}
              >
                <HugeiconsIcon icon={(item as any).icon} size={20} color="currentColor" strokeWidth={isActive ? 2 : 1.5} />
                <span className={cn("text-base", isActive ? "font-extrabold" : "font-semibold")}>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="mt-auto">
          <div className="h-px bg-[#E5E7EB] mx-6" />
          <button
            onClick={() => {
              setDrawerOpen(false);
              setTimeout(() => onSignOut(), 300);
            }}
            type="button"
            className="flex items-center gap-4 px-8 py-5 text-[#2E4A4A] hover:text-red-600 transition-colors w-full"
          >
            <HugeiconsIcon icon={Logout01Icon} size={20} color="currentColor" strokeWidth={1.5} />
            <span className="text-base font-semibold">Logout</span>
          </button>
        </div>
      </div>

      {/* ── Scrim ── */}
      <div
        className="fixed inset-0 z-30 bg-black/30 backdrop-blur-[1px]"
        style={{
          opacity: drawerOpen ? 1 : 0,
          pointerEvents: drawerOpen ? "auto" : "none",
          transition: "opacity 0.32s cubic-bezier(0.4,0,0.2,1)",
        }}
        onClick={() => setDrawerOpen(false)}
        aria-hidden="true"
      />

      {/* ── Main content panel (push + card effect) ── */}
      <div
        className="relative flex flex-col min-h-screen w-full bg-[#F2F3F3]"
        style={{
          transform: drawerOpen ? `translateX(${DRAWER_WIDTH * 0.55}%)` : "translateX(0)",
          borderRadius: drawerOpen ? "20px" : "0px",
          boxShadow: drawerOpen
            ? "0 8px 40px 0 rgba(0,0,0,0.22), 0 2px 8px 0 rgba(0,0,0,0.10)"
            : "none",
          transition: "transform 0.32s cubic-bezier(0.4,0,0.2,1), border-radius 0.32s cubic-bezier(0.4,0,0.2,1), box-shadow 0.32s cubic-bezier(0.4,0,0.2,1)",
          willChange: "transform",
          overflow: drawerOpen ? "hidden" : "visible",
        }}
      >
        {/* Header */}
        {subScreenTitle ? (
          <header className="flex items-center justify-between px-5 pt-4 pb-2 relative z-10">
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
        <header
            className="flex items-center gap-3 px-6 pt-10 pb-6 relative z-10"
            style={{
              background: "linear-gradient(160deg, #07444a 0%, #0a6b5e 55%, #10b981 100%)",
              borderBottomLeftRadius: "28px",
              borderBottomRightRadius: "28px",
              boxShadow: "0 8px 32px 0 rgba(5,150,105,0.18)",
            }}
          >
            {/* Left: hamburger */}
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              className="h-12 w-10 flex items-center justify-start text-white hover:opacity-80 transition-opacity"
            >
              <HugeiconsIcon icon={Menu03Icon} size={24} color="currentColor" strokeWidth={2} />
            </button>

            {currentPage && (() => {
              const labelMap: Record<string, string> = {
                home: fullName ?? "HOME",
                flights: "FLIGHTS",
                "quick-search": "QUICK SEARCH",
                destinations: "DESTINATIONS",
                itinerary: "ITINERARY",
                routes: "ROUTES",
                "fly-a-friend": "FLY A FRIEND",
                account: "ACCOUNT",
              };
              const label = labelMap[currentPage] ?? currentPage.toUpperCase();
              return (
                <span className="flex-1 text-xl font-black tracking-widest uppercase select-none text-[#10B981]">
                  {label}
                </span>
              );
            })()}

            {currentPage === "home" && (
              <div className="flex items-center gap-1 ml-auto">
                <button
                  type="button"
                  className="h-10 w-10 flex items-center justify-center text-white/80 hover:text-white transition-colors rounded-full hover:bg-white/10"
                >
                  <HugeiconsIcon icon={Search02Icon} size={22} color="currentColor" strokeWidth={2} />
                </button>
                <button
                  type="button"
                  className="h-10 w-10 flex items-center justify-center text-white/80 hover:text-white transition-colors rounded-full hover:bg-white/10"
                >
                  <HugeiconsIcon icon={Notification02Icon} size={22} color="currentColor" strokeWidth={2} />
                </button>
              </div>
            )}
          </header>
        )}

        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
};

export default MainLayout;
