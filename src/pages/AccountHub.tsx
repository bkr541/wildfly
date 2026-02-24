import { useState, useEffect } from "react";
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

const AccountHub = () => {
  const { avatarUrl, initials, fullName } = useProfile();
  const [isDeveloper, setIsDeveloper] = useState(false);
  const [username, setUsername] = useState<string | null>(null);

  useEffect(() => {
    const check = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Check developer_allowlist
      const { data: dev } = await supabase
        .from("developer_allowlist")
        .select("user_id")
        .eq("user_id", user.id)
        .maybeSingle();
      if (dev) setIsDeveloper(true);

      // Get username
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

  return (
    <>
      {/* Profile header */}
      <div className="flex flex-col items-center pt-4 pb-6 px-6 relative z-10 animate-fade-in">
        {/* Avatar with edit pencil */}
        <div className="relative mb-3">
          <Avatar className="h-24 w-24 border-[3px] border-[#E3E6E6] shadow-md">
            <AvatarImage src={avatarUrl ?? undefined} alt="Profile" />
            <AvatarFallback className="bg-[#E3E6E6] text-[#345C5A] text-2xl font-bold">
              {initials}
            </AvatarFallback>
          </Avatar>
          <button
            type="button"
            className="absolute bottom-0 right-0 h-8 w-8 rounded-full bg-[#345C5A] text-white flex items-center justify-center shadow-md border-2 border-white hover:bg-[#2E4A4A] transition-colors"
          >
            <FontAwesomeIcon icon={faPen} className="w-3 h-3" />
          </button>
        </div>

        <h1 className="text-xl font-bold text-[#2E4A4A] tracking-tight leading-tight">{fullName}</h1>
        {username && (
          <p className="text-sm text-[#6B7B7B] font-medium">@{username}</p>
        )}
      </div>

      {/* Menu items */}
      <div className="flex-1 flex flex-col px-5 pb-8 relative z-10 animate-fade-in">
        <div className="bg-white rounded-2xl shadow-sm border border-[#E3E6E6] overflow-hidden">
          {menuItems.map((item, idx) => (
            <button
              key={item.key}
              type="button"
              className={`flex items-center w-full px-5 py-4 text-left hover:bg-[#F2F3F3] transition-colors ${
                idx < menuItems.length - 1 ? "border-b border-[#F0F1F1]" : ""
              }`}
            >
              <span className="h-9 w-9 rounded-xl bg-[#F2F3F3] flex items-center justify-center mr-4 shrink-0">
                <FontAwesomeIcon icon={item.icon} className="w-4 h-4 text-[#345C5A]" />
              </span>
              <span className="flex-1 text-[15px] font-semibold text-[#2E4A4A]">{item.label}</span>
              <FontAwesomeIcon icon={faChevronRight} className="w-3.5 h-3.5 text-[#C4CACA]" />
            </button>
          ))}
        </div>
      </div>
    </>
  );
};

export default AccountHub;
