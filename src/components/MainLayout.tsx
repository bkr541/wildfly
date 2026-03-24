import { useState, type ReactNode, useRef, useEffect } from "react";
import { BottomSheet } from "@/components/BottomSheet";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Menu03Icon,
  Search01Icon,
  Home01Icon,
  Airplane01Icon,
  Location01Icon,
  UserGroupIcon,
  Calendar03Icon,
  Logout01Icon,
  ArrowLeft01Icon,
  RouteIcon,
  Notification01Icon,
  AddCircleIcon,
  Cancel01Icon,
  Layout04Icon,
} from "@hugeicons/core-free-icons";
import { useProfile } from "@/contexts/ProfileContext";
import { cn } from "@/lib/utils";
import { NotificationsSheet } from "@/components/NotificationsSheet";
import { useUnreadNotificationCount } from "@/hooks/useNotifications";
import { HomeLayoutSheet } from "@/components/home/HomeLayoutSheet";

const menuItems = [
  { icon: Home01Icon, label: "Home" },
  { type: "heading", label: "Book" },
  { icon: Airplane01Icon, label: "Flights", indent: true },
  { icon: Location01Icon, label: "Destinations", indent: true },
  { type: "heading", label: "Trip Hub" },
  { icon: Calendar03Icon, label: "Itinerary", indent: true },
  { icon: RouteIcon, label: "Routes", indent: true },
  { icon: Home01Icon, label: "Hubs", indent: true },
  { icon: UserGroupIcon, label: "Friends", indent: true },
];

const pageMap: Record<string, string> = {
  Home: "home",
  Flights: "flights",
  Destinations: "destinations",
  Itinerary: "itinerary",
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
  onHomeLayoutSaved?: () => void;
}

const MainLayout = ({
  children,
  onSignOut,
  onNavigate,
  hideHeaderRight = false,
  subScreenTitle,
  onSubScreenBack,
  currentPage,
  onHomeLayoutSaved,
}: MainLayoutProps) => {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [homeLayoutOpen, setHomeLayoutOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const { avatarUrl, initials, fullName, userName } = useProfile();
  const unreadCount = useUnreadNotificationCount();

  const handleMenuClick = (label: string) => {
    setDrawerOpen(false);
    const target = pageMap[label];
    if (target) setTimeout(() => onNavigate(target), 300);
  };

  useEffect(() => {
    if (isSearchOpen) {
      setSearchQuery("");
      requestAnimationFrame(() => {
        setTimeout(() => {
          searchInputRef.current?.focus();
        }, 50);
      });
    }
  }, [isSearchOpen]);

  // Prevent body scroll when drawer is open
  useEffect(() => {
    document.body.style.overflow = drawerOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [drawerOpen]);

  return (
    <div
      className="relative flex h-full overflow-hidden"
      style={{ background: "linear-gradient(160deg, #F2F3F3 0%, #E8EEEE 100%)" }}
    >
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
            onClick={() => {
              setDrawerOpen(false);
              setTimeout(() => onNavigate("account"), 300);
            }}
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
                <p
                  key={item.label}
                  className="text-[10px] font-bold uppercase tracking-widest text-[#059669] px-2 pt-3 pb-0.5"
                >
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
                <HugeiconsIcon
                  icon={(item as any).icon}
                  size={20}
                  color="currentColor"
                  strokeWidth={isActive ? 2 : 1.5}
                />
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
        className="relative flex flex-col h-full w-full"
        style={{
          background: "linear-gradient(160deg, #F2F3F3 0%, #E8EEEE 100%)",
          transform: drawerOpen ? `translateX(${DRAWER_WIDTH * 0.55}%)` : "translateX(0)",
          borderRadius: drawerOpen ? "20px" : "0px",
          boxShadow: drawerOpen ? "0 8px 40px 0 rgba(0,0,0,0.22), 0 2px 8px 0 rgba(0,0,0,0.10)" : "none",
          transition:
            "transform 0.32s cubic-bezier(0.4,0,0.2,1), border-radius 0.32s cubic-bezier(0.4,0,0.2,1), box-shadow 0.32s cubic-bezier(0.4,0,0.2,1)",
          willChange: "transform",
          overflow: drawerOpen ? "hidden" : "visible",
        }}
      >
        {/* Header */}
        {subScreenTitle ? (
          <header className="flex items-center justify-between px-5 pb-2 relative z-10" style={{ paddingTop: "calc(env(safe-area-inset-top) + 1rem)" }}>
            <button
              type="button"
              onClick={onSubScreenBack}
              className="h-12 w-10 flex items-center justify-start text-[#2E4A4A] hover:opacity-70 transition-opacity"
            >
              <HugeiconsIcon icon={ArrowLeft01Icon} size={24} color="currentColor" strokeWidth={1.5} />
            </button>
            <h1 className="text-lg font-bold text-[#345C5A] tracking-tight">{subScreenTitle}</h1>
            <div className="w-10" />
          </header>
        ) : (
          <header className="flex flex-col px-5 pb-2 relative z-10 gap-3" style={{ background: "transparent", paddingTop: "calc(env(safe-area-inset-top) + 1.5rem)" }}>
            {/* Top row: hamburger + greeting + notification */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setDrawerOpen(true)}
                className="h-12 w-10 flex items-center justify-start text-[#2E4A4A] hover:opacity-70 transition-opacity flex-shrink-0"
              >
                <HugeiconsIcon icon={Menu03Icon} size={26} color="currentColor" strokeWidth={2} />
              </button>

              {currentPage &&
                (() => {
                  if (currentPage === "home") {
                    return (
                      <div className="flex-1 flex items-baseline gap-1 select-none -ml-1">
                        <span className="text-[22px] font-medium text-[#6B7280]">Hello,</span>
                        <span
                          className="text-[22px] font-black tracking-tight"
                          style={{
                            background: "linear-gradient(90deg, #059669 0%, #10b981 100%)",
                            WebkitBackgroundClip: "text",
                            WebkitTextFillColor: "transparent",
                          }}
                        >
                          {userName ?? "Explorer"}
                        </span>
                      </div>
                    );
                  }
                  if (currentPage === "flights") {
                    return (
                      <div className="flex-1 flex items-baseline gap-1.5 select-none -ml-1">
                        <span className="text-[22px] font-medium text-[#6B7280]">Explore</span>
                        <span className="text-[22px] font-black tracking-widest uppercase text-[#10B981]">Flights</span>
                      </div>
                    );
                  }
                  if (currentPage === "hubs") {
                    return (
                      <div className="flex-1 flex items-baseline gap-1.5 select-none -ml-1">
                        <span className="text-[22px] font-medium text-[#6B7280]">Frontier</span>
                        <span className="text-[22px] font-black tracking-widest uppercase text-[#10B981]">Hubs</span>
                      </div>
                    );
                  }
                  const prefixMap: Record<string, string> = {
                    destinations: "Explore",
                    routes: "Explore",
                    itinerary: "My",
                    friends: "Find",
                    account: "My",
                  };
                  const labelMap: Record<string, string> = {
                    destinations: "DESTINATIONS",
                    itinerary: "ITINERARY",
                    routes: "ROUTES",
                    account: "ACCOUNT",
                    "design-system": "DESIGN SYSTEM",
                  };
                  const prefix = prefixMap[currentPage];
                  const label = labelMap[currentPage] ?? currentPage.toUpperCase();
                  if (prefix) {
                    return (
                      <div className="flex-1 flex items-baseline gap-1.5 select-none -ml-1">
                        <span className="text-[22px] font-medium text-[#6B7280]">{prefix}</span>
                        <span className="text-[22px] font-black tracking-widest uppercase text-[#10B981]">{label}</span>
                      </div>
                    );
                  }
                  return (
                    <span className="flex-1 text-[22px] font-black tracking-widest uppercase select-none text-[#10B981]">
                      {label}
                    </span>
                  );
                })()}

              {(currentPage === "home" || currentPage === "friends") && (
                <div className="flex items-center gap-0.5 ml-auto">
                  {currentPage === "home" && (
                    <button
                      type="button"
                      onClick={() => setHomeLayoutOpen(true)}
                      className="h-10 w-10 flex items-center justify-center text-[#2E4A4A]/60 hover:text-[#2E4A4A] transition-colors rounded-full hover:bg-black/5"
                    >
                      <HugeiconsIcon icon={Layout04Icon} size={22} color="currentColor" strokeWidth={2} />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setNotificationsOpen(true)}
                    className="h-10 w-10 flex items-center justify-center text-[#2E4A4A]/60 hover:text-[#2E4A4A] transition-colors rounded-full hover:bg-black/5 relative"
                  >
                    <HugeiconsIcon icon={Notification01Icon} size={24} color="currentColor" strokeWidth={2} />
                    {unreadCount > 0 && (
                      <span className="absolute top-1.5 right-1.5 h-2.5 w-2.5 rounded-full bg-red-500 border-2 border-white" />
                    )}
                  </button>
                </div>
              )}
            </div>

            {/* Search bar row — Home only */}
            {currentPage === "home" && (
              <div
                className="flex items-center rounded-full gap-2 cursor-pointer"
                style={{
                  background: "rgba(255,255,255,0.72)",
                  backdropFilter: "blur(18px)",
                  WebkitBackdropFilter: "blur(18px)",
                  border: "1px solid rgba(5,150,105,0.15)",
                  boxShadow: "0 4px 20px 0 rgba(5,150,105,0.10), 0 1.5px 5px 0 rgba(5,150,105,0.07)",
                  padding: "5px 5px 5px 16px",
                }}
                onClick={() => setIsSearchOpen(true)}
              >
                <input
                  ref={searchInputRef}
                  type="text"
                  readOnly
                  placeholder="Search flights, destinations..."
                  className="flex-1 bg-transparent text-[#2E4A4A] text-base font-medium placeholder:text-[#9CA3AF] outline-none cursor-pointer"
                  style={{ fontSize: "16px" }}
                />
                <button
                  type="button"
                  className="h-7 w-7 flex items-center justify-center rounded-full flex-shrink-0"
                  style={{ background: "linear-gradient(135deg, #059669 0%, #10b981 100%)" }}
                >
                  <HugeiconsIcon icon={Search01Icon} size={15} color="white" strokeWidth={2} />
                </button>
              </div>
            )}
          </header>
        )}

        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>

      {/* Global notifications sheet (triggered from Home bell icon) */}
      <NotificationsSheet open={notificationsOpen} onClose={() => setNotificationsOpen(false)} />

      {/* Home layout quick-editor sheet */}
      <HomeLayoutSheet open={homeLayoutOpen} onClose={() => setHomeLayoutOpen(false)} />

      <BottomSheet open={isSearchOpen} onClose={() => setIsSearchOpen(false)} style={{ top: "5%" }}>
              {/* Title row */}
              <div className="flex items-center justify-between px-5 pt-2 pb-3 border-b border-[#F0F1F1]">
                <div className="flex items-center gap-2.5">
                  <div
                    className="h-8 w-8 rounded-full flex items-center justify-center"
                    style={{ background: "linear-gradient(135deg, #059669 0%, #10b981 100%)" }}
                  >
                    <HugeiconsIcon icon={Search01Icon} size={15} color="white" strokeWidth={2} />
                  </div>
                  <h2 className="text-[22px] font-medium text-[#6B7280] leading-tight">Search</h2>
                </div>
                <button
                  type="button"
                  onClick={() => setIsSearchOpen(false)}
                  className="h-8 w-8 flex items-center justify-center rounded-full text-[#9CA3AF] hover:text-[#2E4A4A] hover:bg-black/5 transition-colors ml-1"
                >
                  <HugeiconsIcon icon={AddCircleIcon} size={18} color="currentColor" strokeWidth={2} className="rotate-45" />
                </button>
              </div>
              {/* Search input */}
              <div className="px-5 pb-4 pt-3">
                <div className="app-input-container">
                  <button type="button" tabIndex={-1} className="app-input-icon-btn">
                    <HugeiconsIcon icon={Search01Icon} size={20} color="currentColor" strokeWidth={2} />
                  </button>
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search flights, destinations..."
                    className="app-input"
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="off"
                    spellCheck={false}
                  />
                  {searchQuery.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery("")}
                      className="app-input-reset app-input-reset--visible"
                    >
                      <HugeiconsIcon icon={Cancel01Icon} size={16} color="currentColor" strokeWidth={2} />
                    </button>
                  )}
                </div>
              </div>
              {/* Content */}
              <div className="flex-1 overflow-y-auto">
                <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
                  <div className="h-16 w-16 rounded-full bg-[#F0FDF4] flex items-center justify-center mb-5">
                    <HugeiconsIcon icon={Search01Icon} size={28} color="#059669" strokeWidth={2} />
                  </div>
                  <p className="text-[#2E4A4A] font-bold text-base mb-1">Global Search</p>
                  <p className="text-[#9CA3AF] text-sm">Coming soon</p>
                </div>
                <div className="h-10" />
              </div>
      </BottomSheet>
    </div>
  );
};

export default MainLayout;