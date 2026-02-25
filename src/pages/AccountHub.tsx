import { useState, useEffect } from "react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { useProfile } from "@/contexts/ProfileContext";
import { supabase } from "@/integrations/supabase/client";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  UserIcon,
  Airplane01Icon,
  Notification01Icon,
  PaintBrushIcon,
  WalletAdd01Icon,
  HelpCircleIcon,
  Shield01Icon,
  SourceCodeIcon,
  PencilEdit01Icon,
  ArrowRight01Icon,
} from "@hugeicons/core-free-icons";
import MyAccountScreen from "@/components/account/MyAccountScreen";
import TravelPreferencesScreen from "@/components/account/TravelPreferencesScreen";
import NotificationsScreen from "@/components/account/NotificationsScreen";
import AppearanceScreen from "@/components/account/AppearanceScreen";
import WalletScreen from "@/components/account/WalletScreen";
import HelpSupportScreen from "@/components/account/HelpSupportScreen";
import SecurityPrivacyScreen from "@/components/account/SecurityPrivacyScreen";
import DeveloperToolsScreen from "@/components/account/DeveloperToolsScreen";

interface AccountHubProps {
  onSubScreenChange?: (title: string | null) => void;
  backRef?: React.MutableRefObject<(() => void) | null>;
}

interface MenuItem {
  icon: any;
  label: string;
  key: string;
}

const baseMenuItems: MenuItem[] = [
  { icon: UserIcon, label: "My Account", key: "my-account" },
  { icon: Airplane01Icon, label: "Travel Preferences", key: "travel-prefs" },
  { icon: Notification01Icon, label: "Notifications", key: "notifications" },
  { icon: PaintBrushIcon, label: "Appearance", key: "appearance" },
  { icon: WalletAdd01Icon, label: "My Wallet", key: "wallet" },
  { icon: HelpCircleIcon, label: "Help & Support", key: "help" },
  { icon: Shield01Icon, label: "Security & Privacy", key: "security" },
];

const screenTitles: Record<string, string> = {
  "my-account": "My Account",
  "travel-prefs": "Travel Preferences",
  "notifications": "Notifications",
  "appearance": "Appearance",
  "wallet": "My Wallet",
  "help": "Help & Support",
  "security": "Security & Privacy",
  "developer": "Developer Tools",
};

const AccountHub = ({ onSubScreenChange, backRef }: AccountHubProps) => {
  const { avatarUrl, initials, fullName } = useProfile();
  const [isDeveloper, setIsDeveloper] = useState(false);
  const [username, setUsername] = useState<string | null>(null);
  const [activeScreen, setActiveScreen] = useState<string | null>(null);

  const openScreen = (key: string) => {
    setActiveScreen(key);
    onSubScreenChange?.(screenTitles[key] ?? null);
  };

  const handleBack = () => {
    setActiveScreen(null);
    onSubScreenChange?.(null);
  };

  useEffect(() => {
    if (backRef) backRef.current = handleBack;
    return () => { if (backRef) backRef.current = null; };
  }, [backRef]);

  useEffect(() => {
    const check = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: dev } = await supabase
        .from("developer_allowlist")
        .select("user_id")
        .eq("user_id", user.id)
        .maybeSingle();
      if (dev) setIsDeveloper(true);

      const { data: info } = await supabase
        .from("user_info")
        .select("username")
        .eq("auth_user_id", user.id)
        .maybeSingle();
      if (info?.username) setUsername(info.username);
    };
    check();
  }, []);

  const menuItems: MenuItem[] = [
    ...baseMenuItems,
    ...(isDeveloper ? [{ icon: SourceCodeIcon, label: "Developer Tools", key: "developer" }] : []),
  ];

  if (activeScreen === "my-account") return <MyAccountScreen onBack={handleBack} />;
  if (activeScreen === "travel-prefs") return <TravelPreferencesScreen onBack={handleBack} />;
  if (activeScreen === "notifications") return <NotificationsScreen onBack={handleBack} />;
  if (activeScreen === "appearance") return <AppearanceScreen onBack={handleBack} />;
  if (activeScreen === "wallet") return <WalletScreen onBack={handleBack} />;
  if (activeScreen === "help") return <HelpSupportScreen onBack={handleBack} />;
  if (activeScreen === "security") return <SecurityPrivacyScreen onBack={handleBack} />;
  if (activeScreen === "developer") return <DeveloperToolsScreen onBack={handleBack} />;

  return (
    <>
      <div className="px-6 pt-0 pb-3 relative z-10 animate-fade-in">
        <h1 className="text-3xl font-bold text-[#2E4A4A] mb-0 tracking-tight">Account Hub</h1>
        <p className="text-[#6B7B7B] leading-relaxed text-base">Manage your account and settings.</p>
      </div>

      <div className="flex-1 flex flex-col px-5 pb-4 gap-4 relative z-10 animate-fade-in">
        {/* Profile card */}
        <div className="flex flex-col items-center py-3">
          <div className="relative mb-2">
            <Avatar className="h-20 w-20 border-[3px] border-[#E3E6E6] shadow-md">
              <AvatarImage src={avatarUrl ?? undefined} alt="Profile" />
              <AvatarFallback className="bg-[#E3E6E6] text-[#345C5A] text-xl font-bold">
                {initials}
              </AvatarFallback>
            </Avatar>
            <button
              type="button"
              className="absolute bottom-0 right-0 h-7 w-7 rounded-full bg-[#345C5A] text-white flex items-center justify-center shadow-md border-2 border-white hover:bg-[#2E4A4A] transition-colors"
            >
              <HugeiconsIcon icon={PencilEdit01Icon} size={12} color="currentColor" strokeWidth={1.5} />
            </button>
          </div>
          <h2 className="text-lg font-bold text-[#2E4A4A] leading-tight">{fullName}</h2>
          {username && (
            <p className="text-xs text-[#6B7B7B] font-medium">@{username}</p>
          )}
        </div>

        {/* Menu items */}
        <div className="bg-white rounded-2xl shadow-sm border border-[#E3E6E6] overflow-hidden">
          {menuItems.map((item, idx) => (
            <button
              key={item.key}
              type="button"
              onClick={() => openScreen(item.key)}
              className={`flex items-center w-full px-4 py-2.5 text-left hover:bg-[#F2F3F3] transition-colors ${
                idx < menuItems.length - 1 ? "border-b border-[#F0F1F1]" : ""
              }`}
            >
              <span className="h-8 w-8 rounded-lg bg-[#F2F3F3] flex items-center justify-center mr-3 shrink-0">
                <HugeiconsIcon icon={item.icon} size={14} color="#345C5A" strokeWidth={1.5} />
              </span>
              <span className="flex-1 text-sm font-semibold text-[#2E4A4A]">{item.label}</span>
              <HugeiconsIcon icon={ArrowRight01Icon} size={12} color="#C4CACA" strokeWidth={1.5} />
            </button>
          ))}
        </div>
      </div>
    </>
  );
};

export default AccountHub;
