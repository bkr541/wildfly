import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  FloppyDiskIcon,
  UserIcon,
  Mail01Icon,
  SmartPhone01Icon,
  Calendar03Icon,
  PencilEdit01Icon,
  UserIdVerificationIcon,
} from "@hugeicons/core-free-icons";
import { AppInput } from "@/components/ui/app-input";
import { useProfile } from "@/contexts/ProfileContext";
import { toast } from "sonner";

interface MyAccountScreenProps {
  onBack: () => void;
}

const MyAccountScreen = ({ onBack }: MyAccountScreenProps) => {
  const { patchProfile, refreshProfile } = useProfile();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [dob, setDob] = useState("");
  const [mobileNumber, setMobileNumber] = useState("");
  const [bio, setBio] = useState("");

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("user_info")
        .select("first_name, last_name, username, email, dob, mobile_number, bio")
        .eq("auth_user_id", user.id)
        .maybeSingle();
      if (data) {
        setFirstName(data.first_name || "");
        setLastName(data.last_name || "");
        setUsername(data.username || "");
        setEmail(data.email || "");
        setDob(data.dob || "");
        setMobileNumber(data.mobile_number || "");
        setBio(data.bio || "");
      }
      setLoading(false);
    };
    load();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); return; }
    const { error } = await supabase
      .from("user_info")
      .update({
        first_name: firstName.trim() || null,
        last_name: lastName.trim() || null,
        username: username.trim() || null,
        dob: dob || null,
        mobile_number: mobileNumber.trim() || null,
        bio: bio.trim() || null,
      })
      .eq("auth_user_id", user.id);
    setSaving(false);
    if (error) {
      toast.error("Failed to save changes");
    } else {
      // Optimistically update the header/drawer immediately, then confirm via server
      const fn = firstName.trim();
      const ln = lastName.trim();
      patchProfile({
        userName: fn || "Explorer",
        fullName: [fn, ln].filter(Boolean).join(" ") || "Explorer",
      });
      // Confirm with a fresh server read in the background
      refreshProfile();
      toast.success("Account updated");
      onBack();
    }
  };

  const inputStyle = "w-full px-3.5 py-3 rounded-xl bg-[#E8EAE9] text-[#2E4A4A] placeholder:text-[#849494] outline-none transition-all border-2 border-transparent focus:border-[#345C5A] focus:bg-white text-sm";

  if (loading) {
    return <div className="flex items-center justify-center py-20"><p className="text-[#6B7B7B]">Loading...</p></div>;
  }

  return (
    <div className="flex flex-col h-full animate-fade-in">
      {/* Form */}
      <div className="flex-1 px-5 pb-4 overflow-y-auto">
        <div className="bg-white rounded-2xl shadow-sm border border-[#E3E6E6] p-4 space-y-4">
          <AppInput
            icon={UserIcon}
            label="First Name"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            placeholder="First"
          />
          <AppInput
            icon={UserIcon}
            label="Last Name"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            placeholder="Last"
          />
          <AppInput
            icon={UserIdVerificationIcon}
            label="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="username"
          />
          <AppInput
            icon={Mail01Icon}
            label="Email"
            value={email}
            disabled
          />
          <AppInput
            icon={Calendar03Icon}
            label="Date of Birth"
            type="date"
            value={dob}
            onChange={(e) => setDob(e.target.value)}
          />
          <AppInput
            icon={SmartPhone01Icon}
            label="Mobile"
            type="tel"
            value={mobileNumber}
            onChange={(e) => setMobileNumber(e.target.value)}
            placeholder="+1 (555) 000-0000"
          />

          {/* Bio */}
          <div>
            <label className="text-sm font-semibold ml-1 block text-[#6B7B7B]">Bio</label>
            <div className="app-input-container" style={{ alignItems: "flex-start", paddingTop: "4px", paddingBottom: "4px" }}>
              <button type="button" tabIndex={-1} className="app-input-icon-btn" style={{ marginTop: "6px" }}>
                <HugeiconsIcon icon={PencilEdit01Icon} size={20} color="currentColor" strokeWidth={2} />
              </button>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Tell us about yourself..."
                rows={3}
                className="app-input resize-none"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Save */}
      <div className="px-5 pb-4 pt-2">
        <button onClick={handleSave} disabled={saving} className="w-full h-12 rounded-full bg-gradient-to-r from-[#10B981] to-[#059669] text-white font-bold text-sm tracking-widest uppercase shadow-lg hover:shadow-xl active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2 px-6">
          <span>{saving ? "Saving..." : "Save Changes"}</span>
          {!saving && <HugeiconsIcon icon={FloppyDiskIcon} size={18} color="white" strokeWidth={2} />}
        </button>
      </div>
    </div>
  );
};

export default MyAccountScreen;
