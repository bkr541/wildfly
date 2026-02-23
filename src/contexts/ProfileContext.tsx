import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

interface ProfileData {
  avatarUrl: string | null;
  initials: string;
  userName: string;
  fullName: string;
}

const ProfileContext = createContext<ProfileData>({
  avatarUrl: null,
  initials: "U",
  userName: "Explorer",
  fullName: "Explorer",
});

export const useProfile = () => useContext(ProfileContext);

export const ProfileProvider = ({ children }: { children: ReactNode }) => {
  const [profile, setProfile] = useState<ProfileData>({
    avatarUrl: null,
    initials: "U",
    userName: "Explorer",
    fullName: "Explorer",
  });

  useEffect(() => {
    const loadProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from("user_info")
        .select("image_file, first_name, last_name")
        .eq("auth_user_id", user.id)
        .maybeSingle();

      if (data) {
        const avatarUrl = data.image_file?.startsWith("http") ? data.image_file : null;
        const fi = (data.first_name?.[0] || "").toUpperCase();
        const li = (data.last_name?.[0] || "").toUpperCase();
        const initials = fi + li || "U";
        const userName = data.first_name || "Explorer";
        const fullName = [data.first_name, data.last_name].filter(Boolean).join(" ") || "Explorer";

        setProfile({ avatarUrl, initials, userName, fullName });
      }
    };

    loadProfile();
  }, []);

  return (
    <ProfileContext.Provider value={profile}>
      {children}
    </ProfileContext.Provider>
  );
};
