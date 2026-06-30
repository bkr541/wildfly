/**
 * Shared Free / Paid subscription and monthly-search entitlement state.
 *
 * Entitlements are read from a SECURITY DEFINER RPC so plan naming, status,
 * monthly periods, and usage calculations stay authoritative on the server.
 */

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface BillingPlan {
  id: string;
  name: string;
  entitlementTier: "free" | "paid";
  monthlySearchLimit: number | null;
  stripePriceId: string | null;
  billingPeriod: "monthly" | "yearly";
  isActive: boolean;
  features: Record<string, unknown>;
}

export interface SearchEntitlement {
  tier: "free" | "paid";
  isPaid: boolean;
  monthlyLimit: number | null;
  usedThisMonth: number;
  remainingThisMonth: number | null;
  periodStart: string | null;
  periodEnd: string | null;
}

export interface BillingState {
  loading: boolean;
  planId: string;
  planName: string;
  planStatus: string;
  isPaid: boolean;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  entitlement: SearchEntitlement;
  plans: BillingPlan[];
  handleUpgrade: (planId: string) => Promise<void>;
  handleManageBilling: () => Promise<void>;
  refetch: () => void;
  checkoutLoading: boolean;
  portalLoading: boolean;
}

function edgeFunctionUrl(name: string): string {
  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
  return `https://${projectId}.supabase.co/functions/v1/${name}`;
}

const APP_URL = window.location.origin;

const EMPTY_ENTITLEMENT: SearchEntitlement = {
  tier: "free",
  isPaid: false,
  monthlyLimit: 5,
  usedThisMonth: 0,
  remainingThisMonth: 5,
  periodStart: null,
  periodEnd: null,
};

export function useBilling(): BillingState {
  const { userId, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [planId, setPlanId] = useState("free");
  const [planName, setPlanName] = useState("Free");
  const [planStatus, setPlanStatus] = useState("active");
  const [currentPeriodEnd, setCurrentPeriodEnd] = useState<string | null>(null);
  const [cancelAtPeriodEnd, setCancelAtPeriodEnd] = useState(false);
  const [entitlement, setEntitlement] = useState<SearchEntitlement>(EMPTY_ENTITLEMENT);
  const [plans, setPlans] = useState<BillingPlan[]>([]);

  const refetch = useCallback(() => setRefreshKey((value) => value + 1), []);

  useEffect(() => {
    if (authLoading) return;
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      if (!userId) {
        setLoading(false);
        return;
      }

      const [entitlementResult, subscriptionResult, plansResult] = await Promise.all([
        (supabase.rpc as any)("get_search_entitlement"),
        supabase
          .from("user_subscriptions")
          .select("plan_id, status, current_period_end, cancel_at_period_end")
          .eq("user_id", userId)
          .maybeSingle(),
        (supabase.from("plans") as any)
          .select("id, name, entitlement_tier, monthly_allowance_credits, stripe_price_id, is_active, billing_period, features")
          .eq("is_active", true)
          .order("created_at"),
      ]);

      if (cancelled) return;

      const rpcData = (entitlementResult.data ?? {}) as Record<string, unknown>;
      const currentPlanId = String(subscriptionResult.data?.plan_id ?? rpcData.plan_id ?? "free");
      const currentPlanName = String(rpcData.plan_name ?? (currentPlanId === "free" ? "Free" : currentPlanId));
      const tier = rpcData.tier === "paid" ? "paid" : "free";
      const limit = typeof rpcData.limit === "number" ? rpcData.limit : tier === "paid" ? null : 5;
      const used = typeof rpcData.used === "number" ? rpcData.used : 0;
      const remaining = typeof rpcData.remaining === "number" ? rpcData.remaining : tier === "paid" ? null : Math.max(0, (limit ?? 5) - used);

      setPlanId(currentPlanId);
      setPlanName(currentPlanName);
      setPlanStatus(subscriptionResult.data?.status ?? "active");
      setCurrentPeriodEnd(subscriptionResult.data?.current_period_end ?? null);
      setCancelAtPeriodEnd(subscriptionResult.data?.cancel_at_period_end ?? false);
      setEntitlement({
        tier,
        isPaid: tier === "paid",
        monthlyLimit: limit,
        usedThisMonth: used,
        remainingThisMonth: remaining,
        periodStart: typeof rpcData.period_start === "string" ? rpcData.period_start : null,
        periodEnd: typeof rpcData.period_end === "string" ? rpcData.period_end : null,
      });

      const mappedPlans: BillingPlan[] = ((plansResult.data ?? []) as any[]).map((plan) => ({
        id: plan.id,
        name: plan.name,
        entitlementTier: plan.entitlement_tier === "paid" ? "paid" : "free",
        monthlySearchLimit: plan.entitlement_tier === "paid" ? null : (plan.monthly_allowance_credits ?? 5),
        stripePriceId: plan.stripe_price_id ?? null,
        billingPeriod: plan.billing_period === "yearly" ? "yearly" : "monthly",
        isActive: plan.is_active ?? true,
        features: (plan.features as Record<string, unknown>) ?? {},
      }));
      setPlans(mappedPlans);
      setLoading(false);
    };

    load().catch((error) => {
      console.error("Failed to load billing state", error);
      if (!cancelled) setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [authLoading, refreshKey, userId]);

  const handleUpgrade = useCallback(async (targetPlanId: string) => {
    if (checkoutLoading) return;
    if (targetPlanId === planId) {
      toast.info("You're already on this plan.");
      return;
    }

    setCheckoutLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("You must be signed in to upgrade.");

      const response = await fetch(edgeFunctionUrl("create-checkout-session"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          purchaseType: "subscription",
          planId: targetPlanId,
          successUrl: `${APP_URL}/billing/success?type=subscription`,
          cancelUrl: `${APP_URL}/billing/cancel`,
        }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.url) {
        throw new Error(payload.error ?? "Failed to start checkout. Please try again.");
      }

      sessionStorage.setItem("billing_prev_plan", planId);
      window.location.href = payload.url;
    } catch (error: any) {
      toast.error(error?.message ?? "Something went wrong. Please try again.");
      setCheckoutLoading(false);
    }
  }, [checkoutLoading, planId]);

  const handleManageBilling = useCallback(async () => {
    if (portalLoading) return;
    setPortalLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("You must be signed in.");

      const response = await fetch(edgeFunctionUrl("create-customer-portal-session"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ returnUrl: `${APP_URL}/billing/portal-return` }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.url) {
        throw new Error(payload.error ?? "Failed to open billing management.");
      }
      window.location.href = payload.url;
    } catch (error: any) {
      toast.error(error?.message ?? "Something went wrong. Please try again.");
      setPortalLoading(false);
    }
  }, [portalLoading]);

  return {
    loading,
    planId,
    planName,
    planStatus,
    isPaid: entitlement.isPaid,
    currentPeriodEnd,
    cancelAtPeriodEnd,
    entitlement,
    plans,
    handleUpgrade,
    handleManageBilling,
    refetch,
    checkoutLoading,
    portalLoading,
  };
}
