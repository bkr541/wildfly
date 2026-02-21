import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faBars, faMagnifyingGlass } from "@fortawesome/free-solid-svg-icons";
import { faBell } from "@fortawesome/free-regular-svg-icons";

const HomePage = ({ onSignOut }: { onSignOut: () => void }) => {
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [initials, setInitials] = useState("U");

  useEffect(() => {
    const loadAvatar = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("user_info")
        .select("image_file, first_name, last_name")
        .eq("auth_user_id", user.id)
        .maybeSingle();
      if (data) {
        if (data.image_file && data.image_file.startsWith("http")) {
          setAvatarUrl(data.image_file);
        }
        const fi = (data.first_name?.[0] || "").toUpperCase();
        const li = (data.last_name?.[0] || "").toUpperCase();
        setInitials(fi + li || "U");
      }
    };
    loadAvatar();
  }, []);

  return (
    <div className="relative flex flex-col min-h-screen bg-[#F2F3F3] overflow-hidden">
      {/* Decorative circles */}
      <div className="absolute bottom-20 left-8 w-16 h-16 rounded-full bg-[#345C5A]/10 animate-float" />
      <div className="absolute top-20 right-8 w-10 h-10 rounded-full bg-[#345C5A]/10 animate-float-delay" />

      {/* Header layout */}
      <header className="flex items-center justify-between px-6 pt-10 pb-4 relative z-10">
        {/* Left Side: Menu Icon */}
        <button className="h-12 w-10 flex items-center justify-start text-[#2E4A4A] hover:opacity-80 transition-opacity">
          <FontAwesomeIcon icon={faBars} className="w-6 h-6" />
        </button>

        {/* Right Side: Search, Notifications & Avatar */}
        <div className="flex items-center gap-5 h-12">
          {/* Search Icon */}
          <button className="h-full flex items-center justify-center text-[#2E4A4A] hover:opacity-80 transition-opacity relative">
            <FontAwesomeIcon icon={faMagnifyingGlass} className="w-[22px] h-[22px]" />
          </button>

          {/* Notification Icon (Outline) */}
          <button className="h-full flex items-center justify-center text-[#2E4A4A] hover:opacity-80 transition-opacity relative">
            <FontAwesomeIcon icon={faBell} className="w-6 h-6" />
          </button>

          {/* Avatar */}
          <Avatar className="h-12 w-12 border-2 border-[#E3E6E6] shadow-sm cursor-pointer hover:opacity-90 transition-opacity">
            <AvatarImage src={avatarUrl ?? undefined} alt="Profile" />
            <AvatarFallback className="bg-[#E3E6E6] text-[#345C5A] text-base font-bold">{initials}</AvatarFallback>
          </Avatar>
        </div>
      </header>

      <div className="flex-1 flex flex-col items-center justify-center px-8 relative z-10"></div>
    </div>
  );
};

export default HomePage;
