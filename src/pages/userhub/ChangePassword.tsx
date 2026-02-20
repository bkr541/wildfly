import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

const inputBase =
  "w-full px-4 py-3 rounded-lg bg-background text-foreground placeholder:text-muted-foreground outline-none transition-all border border-border focus:ring-2 focus:ring-ring";

const ChangePassword = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmPw, setConfirmPw] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = () => {
    if (!currentPw.trim() || !newPw.trim()) {
      setError("Both fields are required.");
      return;
    }
    if (newPw.length < 6) {
      setError("New password must be at least 6 characters.");
      return;
    }
    setError("");
    setShowConfirm(true);
  };

  const handleConfirm = async () => {
    if (confirmPw !== newPw) {
      setError("Passwords do not match.");
      return;
    }
    setSaving(true);
    setError("");
    const { error: updateError } = await supabase.auth.updateUser({ password: newPw });
    setSaving(false);
    setShowConfirm(false);
    if (updateError) {
      setError(updateError.message);
    } else {
      toast({ title: "Password updated", description: "Your password has been changed successfully." });
      navigate("/user-hub/security-privacy");
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <div className="flex items-center px-6 pt-10 pb-2">
        <button onClick={() => navigate("/user-hub/security-privacy")} className="mr-3 text-foreground">
          <ChevronLeft className="w-6 h-6" />
        </button>
        <h1 className="text-lg font-bold text-foreground">Change Password</h1>
      </div>
      <div className="px-6 pb-4">
        <p className="text-muted-foreground text-sm">Enter your current and new password.</p>
      </div>

      <div className="px-6 space-y-4 mt-2">
        <div className="form-group">
          <label className="block text-xs font-semibold text-muted-foreground tracking-widest uppercase mb-2">Current Password</label>
          <input type="password" value={currentPw} onChange={(e) => setCurrentPw(e.target.value)} className={inputBase} />
        </div>
        <div className="form-group">
          <label className="block text-xs font-semibold text-muted-foreground tracking-widest uppercase mb-2">New Password</label>
          <input type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} className={inputBase} />
        </div>
        {error && <p className="text-destructive text-xs">{error}</p>}
      </div>

      <div className="sticky bottom-0 px-6 pb-6 pt-3 mt-auto bg-background">
        <button
          onClick={handleSubmit}
          disabled={!currentPw || !newPw}
          className="w-full py-3 rounded-lg bg-foreground text-background font-bold text-sm tracking-widest uppercase hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          Change Password
        </button>
      </div>

      <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Confirm Password</DialogTitle>
            <DialogDescription>Please re-enter your new password to confirm.</DialogDescription>
          </DialogHeader>
          <div className="form-group">
            <input
              type="password"
              value={confirmPw}
              onChange={(e) => setConfirmPw(e.target.value)}
              placeholder="Confirm new password"
              className={inputBase}
            />
          </div>
          {error && <p className="text-destructive text-xs">{error}</p>}
          <DialogFooter className="flex-row gap-2">
            <button
              onClick={() => { setShowConfirm(false); setConfirmPw(""); setError(""); }}
              className="flex-1 py-2.5 rounded-lg border border-border text-foreground text-sm font-semibold hover:bg-secondary transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={saving}
              className="flex-1 py-2.5 rounded-lg bg-foreground text-background text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {saving ? "Updating..." : "Update Password"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ChangePassword;
