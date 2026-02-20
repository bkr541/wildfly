import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useUserProfile } from "@/hooks/useUserProfile";
import { useUserSettings } from "@/hooks/useUserSettings";
import SubScreenLayout from "@/components/userhub/SubScreenLayout";

const Toggle = ({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) => (
  <div className="flex items-center justify-between py-3">
    <span className="text-foreground text-sm">{label}</span>
    <button
      onClick={() => onChange(!checked)}
      className={`relative w-11 h-6 rounded-full transition-colors ${checked ? "bg-accent-blue" : "bg-border"}`}
    >
      <span className={`block w-5 h-5 rounded-full bg-foreground shadow transition-transform ${checked ? "translate-x-5" : "translate-x-0.5"}`} />
    </button>
  </div>
);

const Notifications = () => {
  const navigate = useNavigate();
  const { user, loading: userLoading } = useUserProfile();
  const { settings, loading: settingsLoading } = useUserSettings(user?.id);

  const [master, setMaster] = useState(false);
  const [gowild, setGowild] = useState(false);
  const [newRoute, setNewRoute] = useState(false);
  const [passSale, setPassSale] = useState(false);
  const [newFeature, setNewFeature] = useState(true);
  const [saving, setSaving] = useState(false);
  const [initial, setInitial] = useState("");

  useEffect(() => {
    if (!settings) return;
    const vals = {
      master: settings.notifications_master,
      gowild: settings.notif_gowild_availability,
      newRoute: settings.notif_new_route_alerts,
      passSale: settings.notif_pass_sale_alerts,
      newFeature: settings.notif_new_feature_announcements,
    };
    setMaster(vals.master);
    setGowild(vals.gowild);
    setNewRoute(vals.newRoute);
    setPassSale(vals.passSale);
    setNewFeature(vals.newFeature);
    setInitial(JSON.stringify(vals));
  }, [settings]);

  const current = JSON.stringify({ master, gowild, newRoute, passSale, newFeature });
  const isDirty = current !== initial;

  const handleSave = async () => {
    if (!settings) return;
    setSaving(true);
    await supabase
      .from("user_settings")
      .update({
        notifications_master: master,
        notif_gowild_availability: gowild,
        notif_new_route_alerts: newRoute,
        notif_pass_sale_alerts: passSale,
        notif_new_feature_announcements: newFeature,
      })
      .eq("id", settings.id);
    setSaving(false);
    setInitial(current);
  };

  if (userLoading || settingsLoading) return <div className="flex items-center justify-center min-h-screen bg-background"><p className="text-muted-foreground">Loading...</p></div>;

  return (
    <SubScreenLayout
      title="Notifications"
      subtitle="Choose what you want to hear about."
      onBack={() => navigate("/user-hub")}
      isDirty={isDirty}
      isSaving={saving}
      onSave={handleSave}
    >
      <div className="mt-4">
        <Toggle checked={master} onChange={setMaster} label="Enable Notifications" />

        {master && (
          <div className="mt-2 space-y-0 border-t border-border pt-2">
            <Toggle checked={gowild} onChange={setGowild} label="GoWild Availability Alerts" />
            <Toggle checked={newRoute} onChange={setNewRoute} label="New Route Alerts" />
            <Toggle checked={passSale} onChange={setPassSale} label="Pass Sale Alerts" />
            <Toggle checked={newFeature} onChange={setNewFeature} label="New Feature Announcements" />
          </div>
        )}
      </div>
    </SubScreenLayout>
  );
};

export default Notifications;
