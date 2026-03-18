import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

interface ProfileData {
  avatarUrl: string | null;
  initials: string;
  userName: string;
  fullName: string;
  refreshProfile: () => Promise<void>;
  /** Optimistically patch profile fields without a round-trip */
  patchProfile: (patch: Partial<Omit<ProfileData, "refreshProfile" | "patchProfile">>) => void;
}

const noop = async () => {};

const ProfileContext = createContext<ProfileData>({
  avatarUrl: null,
  initials: "U",
  userName: "Explorer",
  fullName: "Explorer",
  refreshProfile: noop,
  patchProfile: () => {},
});

export const useProfile = () => useContext(ProfileContext);

export const ProfileProvider = ({ children }: { children: ReactNode }) => {
  const [profile, setProfile] = useState<Omit<ProfileData, "refreshProfile" | "patchProfile">>({
    avatarUrl: null,
    initials: "U",
    userName: "Explorer",
    fullName: "Explorer",
  });

  const loadProfile = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from("user_info")
      .select("avatar_url, image_file, first_name, last_name")
      .eq("auth_user_id", user.id)
      .maybeSingle();

    if (data) {
      // Prefer avatar_url (canonical); fall back to legacy image_file
      const rawAvatar = data.avatar_url || (data.image_file?.startsWith("http") ? data.image_file : null);
      const avatarUrl = rawAvatar ?? null;
      const fi = (data.first_name?.[0] || "").toUpperCase();
      const li = (data.last_name?.[0] || "").toUpperCase();
      const initials = fi + li || "U";
      const userName = data.first_name || "Explorer";
      const fullName = [data.first_name, data.last_name].filter(Boolean).join(" ") || "Explorer";

      setProfile({ avatarUrl, initials, userName, fullName });
    }
  }, []);

  const patchProfile = useCallback((patch: Partial<Omit<ProfileData, "refreshProfile" | "patchProfile">>) => {
    setProfile((prev) => {
      const next = { ...prev, ...patch };
      // Recompute derived fields if name fields changed
      if (patch.userName !== undefined || patch.fullName !== undefined) {
        const names = (next.fullName || "").split(" ");
        const fi = (names[0]?.[0] || "").toUpperCase();
        const li = (names[1]?.[0] || "").toUpperCase();
        next.initials = fi + li || "U";
      }
      return next;
    });
  }, []);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  return (
    <ProfileContext.Provider value={{ ...profile, refreshProfile: loadProfile, patchProfile }}>
      {children}
    </ProfileContext.Provider>
  );
};
