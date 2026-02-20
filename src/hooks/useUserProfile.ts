import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface UserProfile {
  id: number;
  first_name: string | null;
  last_name: string | null;
  username: string | null;
  email: string;
  dob: string | null;
  mobile_number: string | null;
  home_location_id: number | null;
  image_file: string;
  bio: string | null;
}

export function useUserProfile() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = async () => {
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) { setLoading(false); return; }
    const { data } = await supabase
      .from("users")
      .select("id, first_name, last_name, username, email, dob, mobile_number, home_location_id, image_file, bio")
      .eq("auth_user_id", authUser.id)
      .maybeSingle();
    if (data) setUser(data as UserProfile);
    setLoading(false);
  };

  useEffect(() => { reload(); }, []);

  return { user, loading, reload };
}
