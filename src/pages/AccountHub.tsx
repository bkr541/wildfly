import { useState, useEffect, useCallback } from "react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { useProfile } from "@/contexts/ProfileContext";
import { supabase } from "@/integrations/supabase/client";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faUser,
  faPlane,
  faBell,
  faPalette,
  faWallet,
  faCircleQuestion,
  faShieldHalved,
  faCode,
  faPen,
  faChevronRight,
} from "@fortawesome/free-solid-svg-icons";
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
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
  /** Ref that parent can use to trigger the back action from outside */
  backRef?: React.MutableRefObject<(() => void) | null>;
}

interface MenuItem {
  icon: IconDefinition;
  label: string;
  key: string;
}

const baseMenuItems: MenuItem[] = [
  { icon: faUser, label: "My Account", key: "my-account" },
  { icon: faPlane, label: "Travel Preferences", key: "travel-prefs" },
  { icon: faBell, label: "Notifications", key: "notifications" },
  { icon: faPalette, label: "Appearance", key: "appearance" },
  { icon: faWallet, label: "My Wallet", key: "wallet" },
  { icon: faCircleQuestion, label: "Help & Support", key: "help" },
  { icon: faShieldHalved, label: "Security & Privacy", key: "security" },
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

  const handleBack = useCallback(() => {
    setActiveScreen(null);
    onSubScreenChange?.(null);
  }, [onSubScreenChange]);

  // Expose handleBack to parent via ref
  useEffect(() => {
    if (backRef) backRef.current = handleBack;
    return () => { if (backRef) backRef.current = null; };
  }, [backRef, handleBack]);

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
    ...(isDeveloper ? [{ icon: faCode, label: "Developer Tools", key: "developer" }] : []),
  ];

  

  // Sub-screens
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
      {/* Page title */}
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
              <FontAwesomeIcon icon={faPen} className="w-2.5 h-2.5" />
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
                <FontAwesomeIcon icon={item.icon} className="w-3.5 h-3.5 text-[#345C5A]" />
              </span>
              <span className="flex-1 text-sm font-semibold text-[#2E4A4A]">{item.label}</span>
              <FontAwesomeIcon icon={faChevronRight} className="w-3 h-3 text-[#C4CACA]" />
            </button>
          ))}
        </div>
      </div>
    </>
  );
};

export default AccountHub;
