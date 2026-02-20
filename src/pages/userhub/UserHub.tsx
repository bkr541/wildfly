import { useNavigate } from "react-router-dom";
import { ChevronLeft, ChevronRight, Camera, User, Bell, Palette, Shield } from "lucide-react";
import { useUserProfile } from "@/hooks/useUserProfile";
import { useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

const menuItems = [
  { label: "Account", icon: User, path: "/user-hub/account" },
  { label: "Notifications", icon: Bell, path: "/user-hub/notifications" },
  { label: "Appearance", icon: Palette, path: "/user-hub/appearance" },
  { label: "Security & Privacy", icon: Shield, path: "/user-hub/security-privacy" },
];

const UserHub = () => {
  const navigate = useNavigate();
  const { user, reload } = useUserProfile();
  const fileRef = useRef<HTMLInputElement>(null);

  const avatarUrl = user?.image_file?.startsWith("http") ? user.image_file : null;
  const displayName = [user?.first_name, user?.last_name].filter(Boolean).join(" ") || "User";

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) return;
    const path = `${authUser.id}/avatar.${file.name.split(".").pop()}`;
    const { error } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
    if (!error) {
      const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path);
      await supabase.from("users").update({ image_file: urlData.publicUrl }).eq("id", user.id);
      reload();
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <div className="flex items-center px-6 pt-10 pb-2">
        <button onClick={() => navigate("/")} className="mr-3 text-foreground">
          <ChevronLeft className="w-6 h-6" />
        </button>
        <h1 className="text-lg font-bold text-foreground">User Hub</h1>
      </div>

      {/* Profile header */}
      <div className="flex flex-col items-center px-6 pt-6 pb-8">
        <button
          onClick={() => fileRef.current?.click()}
          className="relative w-24 h-24 rounded-full bg-secondary flex items-center justify-center cursor-pointer overflow-hidden group mb-3"
        >
          {avatarUrl ? (
            <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
          ) : (
            <Camera className="w-8 h-8 text-muted-foreground" />
          )}
          <div className="absolute inset-0 bg-background/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <Camera className="w-6 h-6 text-foreground" />
          </div>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
        </button>
        <p className="text-foreground font-bold text-lg">{displayName}</p>
        {user?.username && <p className="text-muted-foreground text-sm">@{user.username}</p>}
      </div>

      {/* Menu */}
      <div className="px-6 space-y-1">
        {menuItems.map((item) => (
          <button
            key={item.path}
            onClick={() => navigate(item.path)}
            className="w-full flex items-center justify-between px-4 py-3.5 rounded-lg hover:bg-secondary transition-colors"
          >
            <div className="flex items-center gap-3">
              <item.icon className="w-5 h-5 text-muted-foreground" />
              <span className="text-foreground text-sm font-medium">{item.label}</span>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </button>
        ))}
      </div>
    </div>
  );
};

export default UserHub;
