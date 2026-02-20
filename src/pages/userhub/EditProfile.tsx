import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useUserProfile } from "@/hooks/useUserProfile";
import { Camera } from "lucide-react";
import SubScreenLayout from "@/components/userhub/SubScreenLayout";

const inputBase =
  "w-full px-4 py-3 rounded-lg bg-background text-foreground placeholder:text-muted-foreground outline-none transition-all border border-border focus:ring-2 focus:ring-ring";

const EditProfile = () => {
  const navigate = useNavigate();
  const { user, loading, reload } = useUserProfile();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [username, setUsername] = useState("");
  const [dob, setDob] = useState("");
  const [mobile, setMobile] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // initial snapshot for dirty check
  const [initial, setInitial] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!user) return;
    const vals = {
      firstName: user.first_name || "",
      lastName: user.last_name || "",
      username: user.username || "",
      dob: user.dob || "",
      mobile: (user as any).mobile_number || "",
      bio: user.bio || "",
    };
    setFirstName(vals.firstName);
    setLastName(vals.lastName);
    setUsername(vals.username);
    setDob(vals.dob);
    setMobile(vals.mobile);
    setBio(vals.bio);
    setInitial(vals);
    if (user.image_file?.startsWith("http")) setAvatarUrl(user.image_file);
  }, [user]);

  const current = { firstName, lastName, username, dob, mobile, bio };
  const isDirty = JSON.stringify(current) !== JSON.stringify(initial);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) return;
    const path = `${authUser.id}/avatar.${file.name.split(".").pop()}`;
    const { error } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
    if (!error) {
      const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path);
      setAvatarUrl(urlData.publicUrl);
      await supabase.from("users").update({ image_file: urlData.publicUrl }).eq("id", user.id);
    }
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    await supabase
      .from("users")
      .update({
        first_name: firstName.trim() || null,
        last_name: lastName.trim() || null,
        username: username.trim() || null,
        dob: dob || null,
        mobile_number: mobile.trim() || null,
        bio: bio.trim() || null,
      })
      .eq("id", user.id);
    await reload();
    setSaving(false);
    setInitial({ ...current });
  };

  if (loading) return <div className="flex items-center justify-center min-h-screen bg-background"><p className="text-muted-foreground">Loading...</p></div>;

  return (
    <SubScreenLayout
      title="Edit Profile"
      subtitle="Update your personal details."
      onBack={() => navigate("/user-hub/account")}
      isDirty={isDirty}
      isSaving={saving}
      onSave={handleSave}
    >
      {/* Avatar */}
      <div className="flex flex-col items-center mb-6 mt-4">
        <label className="relative w-20 h-20 rounded-full bg-secondary flex items-center justify-center cursor-pointer overflow-hidden group">
          {avatarUrl ? (
            <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
          ) : (
            <Camera className="w-7 h-7 text-muted-foreground" />
          )}
          <div className="absolute inset-0 bg-background/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <Camera className="w-5 h-5 text-foreground" />
          </div>
          <input type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
        </label>
      </div>

      <div className="space-y-4">
        <div className="form-group">
          <label className="block text-xs font-semibold text-muted-foreground tracking-widest uppercase mb-2">First Name</label>
          <input value={firstName} onChange={(e) => setFirstName(e.target.value)} className={inputBase} />
        </div>
        <div className="form-group">
          <label className="block text-xs font-semibold text-muted-foreground tracking-widest uppercase mb-2">Last Name</label>
          <input value={lastName} onChange={(e) => setLastName(e.target.value)} className={inputBase} />
        </div>
        <div className="form-group">
          <label className="block text-xs font-semibold text-muted-foreground tracking-widest uppercase mb-2">Username</label>
          <input value={username} onChange={(e) => setUsername(e.target.value)} className={inputBase} />
        </div>
        <div className="form-group">
          <label className="block text-xs font-semibold text-muted-foreground tracking-widest uppercase mb-2">Date of Birth</label>
          <input type="date" value={dob} onChange={(e) => setDob(e.target.value)} className={inputBase} />
        </div>
        <div className="form-group">
          <label className="block text-xs font-semibold text-muted-foreground tracking-widest uppercase mb-2">Mobile Number</label>
          <input type="tel" value={mobile} onChange={(e) => setMobile(e.target.value)} placeholder="+1 (555) 000-0000" className={inputBase} />
        </div>
        <div className="form-group">
          <label className="block text-xs font-semibold text-muted-foreground tracking-widest uppercase mb-2">Bio</label>
          <textarea value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Tell us about yourself..." className={`${inputBase} min-h-[80px] resize-none`} />
        </div>
      </div>
    </SubScreenLayout>
  );
};

export default EditProfile;
