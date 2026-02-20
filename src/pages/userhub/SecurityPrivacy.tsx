import { useNavigate } from "react-router-dom";
import { ChevronLeft, ChevronRight, Lock, RotateCcw, FileText, Headphones, Info, LogOut, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useUserProfile } from "@/hooks/useUserProfile";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

const SecurityPrivacy = () => {
  const navigate = useNavigate();
  const { user } = useUserProfile();
  const { toast } = useToast();
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  const handleDelete = async () => {
    if (!user) return;
    setDeleting(true);
    // Delete user_settings, user_locations first, then users row
    await supabase.from("user_settings").delete().eq("user_id", user.id);
    await supabase.from("user_locations").delete().eq("user_id", user.id);
    await supabase.from("users").delete().eq("id", user.id);
    await supabase.auth.signOut();
    setDeleting(false);
    navigate("/");
  };

  const comingSoon = () =>
    toast({ title: "Coming soon", description: "This feature is not available yet." });

  const rows = [
    { label: "Change Password", icon: Lock, action: () => navigate("/user-hub/security-privacy/change-password") },
    { label: "Reset Curation Engine", icon: RotateCcw, action: comingSoon },
    { label: "Terms & Privacy Policy", icon: FileText, action: comingSoon },
    { label: "Contact Support", icon: Headphones, action: comingSoon },
    { label: "App Version", icon: Info, action: undefined, extra: "v0.0.0" },
  ];

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <div className="flex items-center px-6 pt-10 pb-2">
        <button onClick={() => navigate("/user-hub")} className="mr-3 text-foreground">
          <ChevronLeft className="w-6 h-6" />
        </button>
        <h1 className="text-lg font-bold text-foreground">Security & Privacy</h1>
      </div>
      <div className="px-6 pb-4">
        <p className="text-muted-foreground text-sm">Keep your account secure and in control.</p>
      </div>

      <div className="px-6 space-y-1">
        {rows.map((row) => (
          <button
            key={row.label}
            onClick={row.action}
            disabled={!row.action}
            className="w-full flex items-center justify-between px-4 py-3.5 rounded-lg hover:bg-secondary transition-colors disabled:opacity-70"
          >
            <div className="flex items-center gap-3">
              <row.icon className="w-5 h-5 text-muted-foreground" />
              <span className="text-foreground text-sm font-medium">{row.label}</span>
            </div>
            {row.extra ? (
              <span className="text-muted-foreground text-xs">{row.extra}</span>
            ) : row.action ? (
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            ) : null}
          </button>
        ))}

        <div className="pt-4 space-y-1">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3.5 rounded-lg hover:bg-secondary transition-colors"
          >
            <LogOut className="w-5 h-5 text-muted-foreground" />
            <span className="text-foreground text-sm font-medium">Log Out</span>
          </button>

          <button
            onClick={() => setShowDeleteModal(true)}
            className="w-full flex items-center gap-3 px-4 py-3.5 rounded-lg hover:bg-destructive/10 transition-colors"
          >
            <Trash2 className="w-5 h-5 text-destructive" />
            <span className="text-destructive text-sm font-medium">Delete Account</span>
          </button>
        </div>
      </div>

      <Dialog open={showDeleteModal} onOpenChange={setShowDeleteModal}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Account?</DialogTitle>
            <DialogDescription>
              This action is permanent. All your data will be removed and cannot be recovered.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-row gap-2">
            <button
              onClick={() => setShowDeleteModal(false)}
              className="flex-1 py-2.5 rounded-lg border border-border text-foreground text-sm font-semibold hover:bg-secondary transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="flex-1 py-2.5 rounded-lg bg-destructive text-destructive-foreground text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {deleting ? "Deleting..." : "Delete"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SecurityPrivacy;
