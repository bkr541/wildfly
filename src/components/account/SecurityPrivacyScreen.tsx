import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { HugeiconsIcon } from "@hugeicons/react";
import { SecurityIcon, Delete02Icon, Logout01Icon, LockPasswordIcon, ArrowDown01Icon } from "@hugeicons/core-free-icons";
import { AppInput } from "@/components/ui/app-input";
import { toast } from "sonner";

interface SecurityPrivacyScreenProps {
  onBack: () => void;
}

const SecurityPrivacyScreen = ({ onBack }: SecurityPrivacyScreenProps) => {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);

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

  const labelStyle = "block text-[11px] font-bold text-[#6B7B7B] tracking-[0.15em] uppercase mb-1.5";

  return (
    <div className="flex flex-col h-full animate-fade-in">
      <div className="flex-1 px-5 pb-4 space-y-4 overflow-y-auto">
        <div className="bg-white rounded-2xl shadow-sm border border-[#E3E6E6] overflow-hidden">
          {/* Change Password */}
          <button
            type="button"
            onClick={() => setPasswordOpen((o) => !o)}
            className={`flex items-center w-full px-4 py-3 gap-3 hover:bg-[#F8F9F9] transition-colors text-left ${passwordOpen ? "" : "border-b border-[#F0F1F1]"}`}
          >
            <span className="h-8 w-8 rounded-full bg-[#345C5A] flex items-center justify-center shrink-0">
              <HugeiconsIcon icon={SecurityIcon} size={15} color="#D1FAE5" strokeWidth={1.5} />
            </span>
            <div className="flex-1">
              <p className="text-sm font-semibold text-[#2E4A4A]">Change Password</p>
              <p className="text-xs text-[#6B7B7B]">Update your account password</p>
            </div>
            <HugeiconsIcon
              icon={ArrowDown01Icon}
              size={13}
              color="#C4CACA"
              strokeWidth={1.5}
              className={`transition-transform duration-200 ${passwordOpen ? "rotate-180" : ""}`}
            />
          </button>

          {passwordOpen && (
            <div className="border-t border-[#F0F1F1] border-b border-[#F0F1F1] px-4 py-4 space-y-3 animate-fade-in bg-[#F8F9F9]">
              <div>
                <label className={labelStyle}>New Password</label>
                <AppInput isPassword icon={LockPasswordIcon} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Enter new password" />
              </div>
              <div>
                <label className={labelStyle}>Confirm Password</label>
                <AppInput isPassword icon={LockPasswordIcon} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Confirm new password" />
              </div>
              <button onClick={handleChangePassword} disabled={saving} className="w-full h-11 rounded-full bg-gradient-to-r from-[#10B981] to-[#059669] text-white font-bold text-xs tracking-widest uppercase shadow-lg hover:shadow-xl active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2 px-6">
                <span>{saving ? "Updating..." : "Update Password"}</span>
                {!saving && <HugeiconsIcon icon={SecurityIcon} size={16} color="white" strokeWidth={2} />}
              </button>
            </div>
          )}

          {/* Sign Out */}
          <button onClick={handleSignOut} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[#F2F3F3] transition-colors border-b border-[#F0F1F1]">
            <span className="h-8 w-8 rounded-full bg-[#345C5A] flex items-center justify-center shrink-0">
              <HugeiconsIcon icon={Logout01Icon} size={14} color="#D1FAE5" strokeWidth={1.5} />
            </span>
            <span className="text-sm font-semibold text-[#2E4A4A]">Sign Out</span>
          </button>

          {/* Delete Account */}
          <button className="w-full flex items-center gap-3 px-4 py-3 hover:bg-red-50 transition-colors">
            <span className="h-8 w-8 rounded-full bg-red-500 flex items-center justify-center shrink-0">
              <HugeiconsIcon icon={Delete02Icon} size={14} color="#fee2e2" strokeWidth={1.5} />
            </span>
            <span className="text-sm font-semibold text-red-600">Delete Account</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default SecurityPrivacyScreen;
