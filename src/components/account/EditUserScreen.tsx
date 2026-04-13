import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { HugeiconsIcon } from "@hugeicons/react";
import { toast } from "sonner";
import {
  ArrowLeft02Icon,
  CheckmarkCircle01Icon,
  UserIcon,
  CreditCardIcon,
} from "@hugeicons/core-free-icons";

interface UserRow {
  id: number;
  auth_user_id: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string;
  username: string | null;
  avatar_url: string | null;
  display_name: string | null;
  home_airport: string | null;
  home_city: string | null;
  is_discoverable: boolean;
  signup_type: string;
  status: string;
  date_joined: string | null;
  plan_id: string | null;
  plan_status: string | null;
}

interface EditUserScreenProps {
  user: UserRow;
  onBack: () => void;
  onUserUpdated: (updatedUser: Partial<UserRow> & { auth_user_id: string }) => void;
}

interface PlanOption {
  id: string;
  name: string;
}

const EditUserScreen = ({ user, onBack, onUserUpdated }: EditUserScreenProps) => {
  const uid = user.auth_user_id!;

  // Editable fields
  const [firstName, setFirstName] = useState(user.first_name ?? "");
  const [lastName, setLastName] = useState(user.last_name ?? "");
  const [email, setEmail] = useState(user.email ?? "");
  const [username, setUsername] = useState(user.username ?? "");
  const [displayName, setDisplayName] = useState(user.display_name ?? "");
  const [homeAirport, setHomeAirport] = useState(user.home_airport ?? "");
  const [homeCity, setHomeCity] = useState(user.home_city ?? "");
  const [status, setStatus] = useState(user.status ?? "pending");
  const [bio, setBio] = useState("");
  const [mobileNumber, setMobileNumber] = useState("");

  // Subscription
  const [selectedPlan, setSelectedPlan] = useState(user.plan_id ?? "free");
  const [plans, setPlans] = useState<PlanOption[]>([]);
  const [subDetails, setSubDetails] = useState<Record<string, unknown> | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Load additional details + plans
  useEffect(() => {
    const load = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;

        const [detailsRes, plansRes] = await Promise.all([
          fetch(`https://${projectId}.supabase.co/functions/v1/admin-user-details`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${session.access_token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ target_user_id: uid }),
          }),
          supabase.from("plans").select("id, name").eq("is_active", true).order("created_at"),
        ]);

        const details = await detailsRes.json();
        if (details.subscription) setSubDetails(details.subscription);

        if (plansRes.data) {
          setPlans(plansRes.data.map((p) => ({ id: p.id, name: p.name })));
        }

        // Load full user_info for bio/mobile
        const fullInfoRes = await fetch(`https://${projectId}.supabase.co/functions/v1/admin-user-details`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ target_user_id: uid }),
        });
        // Already fetched above, reuse details
      } catch (e) {
        console.error("Failed to load edit user data", e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [uid]);

  const handleSave = useCallback(async () => {
    if (saving) return;
    setSaving(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;

      const userInfoUpdates: Record<string, unknown> = {
        first_name: firstName || null,
        last_name: lastName || null,
        email,
        username: username || null,
        display_name: displayName || null,
        home_airport: homeAirport || null,
        home_city: homeCity || null,
        status,
        bio: bio || null,
        mobile_number: mobileNumber || null,
      };

      const body: Record<string, unknown> = {
        target_user_id: uid,
        user_info_updates: userInfoUpdates,
      };

      // Only include plan_id if changed
      if (selectedPlan !== (user.plan_id ?? "free")) {
        body.plan_id = selectedPlan;
      }

      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/admin-update-user`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        }
      );

      const json = await res.json();
      if (!res.ok || json.error) {
        throw new Error(json.error ?? "Failed to update user");
      }

      toast.success("User updated successfully");

      // Notify parent of changes
      onUserUpdated({
        auth_user_id: uid,
        first_name: firstName || null,
        last_name: lastName || null,
        email,
        username: username || null,
        display_name: displayName || null,
        home_airport: homeAirport || null,
        home_city: homeCity || null,
        status,
        plan_id: selectedPlan,
      });

      onBack();
    } catch (e: any) {
      toast.error(e.message ?? "Failed to update user");
    } finally {
      setSaving(false);
    }
  }, [saving, firstName, lastName, email, username, displayName, homeAirport, homeCity, status, bio, mobileNumber, selectedPlan, uid, user.plan_id, onBack, onUserUpdated]);

  const initials = () => {
    const f = (firstName?.[0] || "").toUpperCase();
    const l = (lastName?.[0] || "").toUpperCase();
    return f + l || "U";
  };

  const fullName = [firstName, lastName].filter(Boolean).join(" ") || displayName || email;

  if (loading) {
    return (
      <div className="flex-1 flex flex-col px-5 pb-4 gap-3 relative z-10 animate-fade-in">
        <div className="space-y-3 mt-2">
          {[...Array(8)].map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col px-5 pb-4 gap-4 relative z-10 animate-fade-in">
      {/* Profile Header */}
      <div className="flex flex-col items-center py-3">
        <Avatar className="h-16 w-16 border-[3px] border-[#E3E6E6] shadow-md mb-2">
          <AvatarImage src={user.avatar_url ?? undefined} />
          <AvatarFallback className="bg-[#E3E6E6] text-[#345C5A] text-lg font-bold">
            {initials()}
          </AvatarFallback>
        </Avatar>
        <h2 className="text-base font-bold text-[#2E4A4A]">{fullName}</h2>
        {user.date_joined && (
          <p className="text-[11px] text-[#A0ADAD]">
            Joined {new Date(user.date_joined).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
          </p>
        )}
      </div>

      {/* Account Info Section */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <span className="h-6 w-6 rounded-full bg-surface-active flex items-center justify-center shrink-0">
            <HugeiconsIcon icon={UserIcon} size={12} color="#047857" strokeWidth={1.5} />
          </span>
          <span className="text-xs font-bold text-[#2E4A4A] uppercase tracking-wide">Account Info</span>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-[#E3E6E6] overflow-hidden divide-y divide-[#F0F1F1]">
          <FieldRow label="First Name" value={firstName} onChange={setFirstName} />
          <FieldRow label="Last Name" value={lastName} onChange={setLastName} />
          <FieldRow label="Email" value={email} onChange={setEmail} />
          <FieldRow label="Username" value={username} onChange={setUsername} />
          <FieldRow label="Display Name" value={displayName} onChange={setDisplayName} />
          <FieldRow label="Home Airport" value={homeAirport} onChange={setHomeAirport} />
          <FieldRow label="Home City" value={homeCity} onChange={setHomeCity} />
          <FieldRow label="Mobile" value={mobileNumber} onChange={setMobileNumber} />
          <FieldRow label="Bio" value={bio} onChange={setBio} />

          {/* Status selector */}
          <div className="flex items-center justify-between px-4 py-3">
            <span className="text-xs font-semibold text-[#6B7B7B]">Status</span>
            <div className="flex gap-1.5">
              {["pending", "current"].map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStatus(s)}
                  className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide border transition-colors ${
                    status === s
                      ? s === "current"
                        ? "bg-emerald-600 text-white border-emerald-600"
                        : "bg-amber-500 text-white border-amber-500"
                      : "bg-white border-[#E3E6E6] text-[#6B7B7B]"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Signup Type (read-only) */}
          <div className="flex items-center justify-between px-4 py-3">
            <span className="text-xs font-semibold text-[#6B7B7B]">Signup Type</span>
            <span className="text-xs font-semibold text-[#2E4A4A]">{user.signup_type}</span>
          </div>
        </div>
      </div>

      {/* Subscription Section */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <span className="h-6 w-6 rounded-full bg-surface-active flex items-center justify-center shrink-0">
            <HugeiconsIcon icon={CreditCardIcon} size={12} color="#047857" strokeWidth={1.5} />
          </span>
          <span className="text-xs font-bold text-[#2E4A4A] uppercase tracking-wide">Subscription</span>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-[#E3E6E6] overflow-hidden">
          <div className="px-4 py-3">
            <span className="text-xs font-semibold text-[#6B7B7B] block mb-2">Plan</span>
            <div className="flex flex-wrap gap-2">
              {plans.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setSelectedPlan(p.id)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold border transition-colors ${
                    selectedPlan === p.id
                      ? "bg-emerald-600 text-white border-emerald-600"
                      : "bg-white border-[#E3E6E6] text-[#2E4A4A] hover:bg-[#F2F3F3]"
                  }`}
                >
                  {p.name}
                </button>
              ))}
            </div>
          </div>

          {subDetails && (
            <div className="border-t border-[#F0F1F1] px-4 py-3 space-y-1">
              {[
                ["Status", subDetails.status],
                ["Stripe Customer", subDetails.stripe_customer_id],
                ["Period Start", subDetails.current_period_start ? new Date(String(subDetails.current_period_start)).toLocaleDateString() : null],
                ["Period End", subDetails.current_period_end ? new Date(String(subDetails.current_period_end)).toLocaleDateString() : null],
              ]
                .filter(([, v]) => v)
                .map(([label, value]) => (
                  <div key={String(label)} className="flex justify-between text-[11px]">
                    <span className="text-[#6B7B7B] font-medium">{String(label)}</span>
                    <span className="text-[#2E4A4A] font-semibold text-right max-w-[55%] truncate">{String(value)}</span>
                  </div>
                ))}
            </div>
          )}
        </div>
      </div>

      {/* Save Button */}
      <button
        type="button"
        onClick={handleSave}
        disabled={saving}
        className="w-full h-12 rounded-xl bg-emerald-600 text-white text-sm font-bold flex items-center justify-center gap-2 hover:bg-emerald-700 active:scale-[0.98] transition-all disabled:opacity-50 mt-2 mb-4"
      >
        <HugeiconsIcon icon={CheckmarkCircle01Icon} size={16} color="white" strokeWidth={2} />
        {saving ? "Saving…" : "Save Changes"}
      </button>
    </div>
  );
};

/* ─── Field Row ──────────────────────────────────────────────────── */
const FieldRow = ({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) => (
  <div className="flex items-center justify-between px-4 py-2.5">
    <span className="text-xs font-semibold text-[#6B7B7B] shrink-0 mr-3">{label}</span>
    <Input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-8 text-xs text-right border-0 bg-transparent shadow-none focus-visible:ring-0 px-0 font-semibold text-[#2E4A4A] max-w-[60%]"
    />
  </div>
);

export default EditUserScreen;
