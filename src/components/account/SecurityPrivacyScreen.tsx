import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faKey, faTrash, faRightFromBracket } from "@fortawesome/free-solid-svg-icons";
import { toast } from "sonner";

interface SecurityPrivacyScreenProps {
  onBack: () => void;
}

const SecurityPrivacyScreen = ({ onBack }: SecurityPrivacyScreenProps) => {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);

  const handleChangePassword = async () => {
    if (newPassword.length < 6) { toast.error("Password must be at least 6 characters"); return; }
    if (newPassword !== confirmPassword) { toast.error("Passwords do not match"); return; }
    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setSaving(false);
    if (error) toast.error(error.message);
    else { toast.success("Password updated"); setNewPassword(""); setConfirmPassword(""); }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    window.location.reload();
  };

  const inputStyle = "w-full px-3.5 py-3 rounded-xl bg-[#E8EAE9] text-[#2E4A4A] placeholder:text-[#849494] outline-none transition-all border-2 border-transparent focus:border-[#345C5A] focus:bg-white text-sm";
  const labelStyle = "block text-[11px] font-bold text-[#6B7B7B] tracking-[0.15em] uppercase mb-1.5";

  return (
    <div className="flex flex-col h-full animate-fade-in">

      <div className="flex-1 px-5 pb-4 space-y-4 overflow-y-auto">
        {/* Change Password */}
        <div className="bg-white rounded-2xl shadow-sm border border-[#E3E6E6] p-4 space-y-3">
          <div className="flex items-center gap-2 mb-1">
            <FontAwesomeIcon icon={faKey} className="w-3.5 h-3.5 text-[#345C5A]" />
            <p className="text-sm font-semibold text-[#2E4A4A]">Change Password</p>
          </div>
          <div>
            <label className={labelStyle}>New Password</label>
            <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Enter new password" className={inputStyle} />
          </div>
          <div>
            <label className={labelStyle}>Confirm Password</label>
            <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Confirm new password" className={inputStyle} />
          </div>
          <button onClick={handleChangePassword} disabled={saving} className="w-full py-2.5 rounded-xl bg-[#345C5A] text-white font-bold text-xs tracking-widest uppercase hover:opacity-90 transition-opacity disabled:opacity-50">
            {saving ? "Updating..." : "Update Password"}
          </button>
        </div>

        {/* Sign Out */}
        <button onClick={handleSignOut} className="w-full flex items-center gap-3 px-4 py-3 bg-white rounded-2xl shadow-sm border border-[#E3E6E6] hover:bg-[#F2F3F3] transition-colors">
          <span className="h-8 w-8 rounded-lg bg-[#F2F3F3] flex items-center justify-center shrink-0">
            <FontAwesomeIcon icon={faRightFromBracket} className="w-3.5 h-3.5 text-[#345C5A]" />
          </span>
          <span className="text-sm font-semibold text-[#2E4A4A]">Sign Out</span>
        </button>

        {/* Delete Account */}
        <button className="w-full flex items-center gap-3 px-4 py-3 bg-white rounded-2xl shadow-sm border border-red-200 hover:bg-red-50 transition-colors">
          <span className="h-8 w-8 rounded-lg bg-red-50 flex items-center justify-center shrink-0">
            <FontAwesomeIcon icon={faTrash} className="w-3.5 h-3.5 text-red-500" />
          </span>
          <span className="text-sm font-semibold text-red-600">Delete Account</span>
        </button>
      </div>
    </div>
  );
};

export default SecurityPrivacyScreen;
