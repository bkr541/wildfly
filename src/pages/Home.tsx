import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";

const HomePage = ({ onSignOut }: { onSignOut: () => void }) => {
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [initials, setInitials] = useState("U");

  useEffect(() => {
    const loadAvatar = async () => {
      const { data: { user } } = await supabase.auth.getUser();
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
    <div className="relative flex flex-col min-h-screen bg-background overflow-hidden">
      <div className="absolute bottom-20 left-8 w-16 h-16 rounded-full bg-accent-pink/30 animate-float" />
      <div className="absolute top-20 right-8 w-10 h-10 rounded-full bg-accent-blue/30 animate-float-delay" />

      <header className="flex items-center justify-end px-6 pt-10 pb-4 relative z-10">
        <Avatar className="h-10 w-10 border-2 border-muted">
          <AvatarImage src={avatarUrl ?? undefined} alt="Profile" />
          <AvatarFallback className="bg-muted text-muted-foreground text-sm font-semibold">
            {initials}
          </AvatarFallback>
        </Avatar>

      </header>

      <div className="flex-1 flex flex-col items-center justify-center px-8 relative z-10">
        
        


      </div>
    </div>);

};

export default HomePage;