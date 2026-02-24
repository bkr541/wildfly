import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChevronLeft } from "@fortawesome/free-solid-svg-icons";
import { toast } from "sonner";

interface MyAccountScreenProps {
  onBack: () => void;
}

const MyAccountScreen = ({ onBack }: MyAccountScreenProps) => {
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
    if (!user) return;
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
      toast.success("Account updated");
      onBack();
    }
  };

  const labelStyle = "block text-[11px] font-bold text-[#6B7B7B] tracking-[0.15em] uppercase mb-1.5";
  const inputStyle = "w-full px-3.5 py-3 rounded-xl bg-[#E8EAE9] text-[#2E4A4A] placeholder:text-[#849494] outline-none transition-all border-2 border-transparent focus:border-[#345C5A] focus:bg-white text-sm";

  if (loading) {
    return <div className="flex items-center justify-center py-20"><p className="text-[#6B7B7B]">Loading...</p></div>;
  }

  return (
    <div className="flex flex-col h-full animate-fade-in">
      {/* Header */}
      <header className="relative z-10 flex items-center justify-between px-5 pt-6 pb-2">
        <button type="button" onClick={onBack} className="h-10 w-10 flex items-center justify-start text-[#2E4A4A] hover:opacity-70 transition-opacity">
          <FontAwesomeIcon icon={faChevronLeft} className="w-5 h-5" />
        </button>
        <h1 className="text-lg font-bold text-[#345C5A] tracking-tight">My Account</h1>
        <div className="w-10" />
      </header>

      {/* Form */}
      <div className="flex-1 px-5 pb-4 space-y-3.5 overflow-y-auto">
        <div className="grid grid-cols-2 gap-3">
          <div className="form-group">
            <label className={labelStyle}>First Name</label>
            <input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="First" className={inputStyle} />
          </div>
          <div className="form-group">
            <label className={labelStyle}>Last Name</label>
            <input value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Last" className={inputStyle} />
          </div>
        </div>
        <div className="form-group">
          <label className={labelStyle}>Username</label>
          <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="username" className={inputStyle} />
        </div>
        <div className="form-group">
          <label className={labelStyle}>Email</label>
          <input value={email} disabled className={`${inputStyle} opacity-60 cursor-not-allowed`} />
        </div>
        <div className="form-group">
          <label className={labelStyle}>Date of Birth</label>
          <input type="date" value={dob} onChange={(e) => setDob(e.target.value)} className={inputStyle} />
        </div>
        <div className="form-group">
          <label className={labelStyle}>Mobile Number</label>
          <input type="tel" value={mobileNumber} onChange={(e) => setMobileNumber(e.target.value)} placeholder="+1 (555) 000-0000" className={inputStyle} />
        </div>
        <div className="form-group">
          <label className={labelStyle}>Bio</label>
          <textarea value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Tell us about yourself..." rows={3} className={`${inputStyle} resize-none`} />
        </div>
      </div>

      {/* Save */}
      <div className="px-5 pb-4 pt-2">
        <button onClick={handleSave} disabled={saving} className="w-full py-3 rounded-xl bg-[#345C5A] text-white font-bold text-sm tracking-widest uppercase hover:opacity-90 transition-opacity disabled:opacity-50">
          {saving ? "Saving..." : "Save Changes"}
        </button>
      </div>
    </div>
  );
};

export default MyAccountScreen;
