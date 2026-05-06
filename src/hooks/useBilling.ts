/**
 * useBilling — Shared hook for all billing-related UI state.
 *
 * Fetches and normalises:
 *  - Current subscription plan (id, name, status, allowance)
 *  - Wallet: monthly used/remaining, purchased balance, totals
 *  - Available credit packs for purchase
 *
 * Exposes checkout helpers:
 *  - handleUpgrade(planId)        → starts subscription checkout
 *  - handleBuyCredits(packId)     → starts credit pack checkout
 *  - handleManageBilling()        → opens Stripe Customer Portal
 *
 * Contract: the client NEVER grants entitlements directly.
 * All mutations happen server-side via the Stripe webhook.
 */

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BillingPlan {
  id: string;
  name: string;
  monthlyAllowanceCredits: number | null; // null = unlimited (Gold)
  stripePrice_id: string | null;
  billingPeriod: "monthly" | "yearly";
  isActive: boolean;
  features: Record<string, unknown>;
}

export interface CreditPack {
  id: string;
  name: string;
  creditsAmount: number;
  priceUsd: number;
  stripePriceId: string | null;
  isActive: boolean;
  displayOrder: number;
}

export interface WalletState {
  monthlyUsed: number;
  monthlyRemaining: number;
  monthlyAllowance: number;
  purchasedBalance: number;
  totalCredits: number;
  isUnlimited: boolean;
  periodEnd: string | null;
  periodStart: string | null;
}

export interface BillingState {
  // loading
  loading: boolean;
  // plan
  planId: string;
  planName: string;
  planStatus: string;
  isGold: boolean;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  // wallet
  wallet: WalletState;
  // catalog
  plans: BillingPlan[];
  creditPacks: CreditPack[];
  // actions
  handleUpgrade: (planId: string) => Promise<void>;
  handleBuyCredits: (packId: string) => Promise<void>;
  handleManageBilling: () => Promise<void>;
  refetch: () => void;
  // per-action loading flags
  checkoutLoading: boolean;
  portalLoading: boolean;
}

// ─── Edge function URL helper ────────────────────────────────────────────────

function edgeFunctionUrl(name: string): string {
  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
  return `https://${projectId}.supabase.co/functions/v1/${name}`;
}

const APP_URL = window.location.origin;

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useBilling(): BillingState {
  const { userId, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  // Plan state
  const [planId, setPlanId] = useState("free");
  const [planName, setPlanName] = useState("Free");
  const [planStatus, setPlanStatus] = useState("active");
  const [monthlyAllowance, setMonthlyAllowance] = useState(15);
  const [isGold, setIsGold] = useState(false);
  const [currentPeriodEnd, setCurrentPeriodEnd] = useState<string | null>(null);
  const [cancelAtPeriodEnd, setCancelAtPeriodEnd] = useState(false);

  // Wallet state
  const [wallet, setWallet] = useState<WalletState>({
    monthlyUsed: 0,
    monthlyRemaining: 15,
    monthlyAllowance: 15,
    purchasedBalance: 0,
    totalCredits: 15,
    isUnlimited: false,
    periodEnd: null,
    periodStart: null,
  });

  // Catalog
  const [plans, setPlans] = useState<BillingPlan[]>([]);
  const [creditPacks, setCreditPacks] = useState<CreditPack[]>([]);

  const refetch = useCallback(() => setRefreshKey((k) => k + 1), []);

  useEffect(() => {
    if (authLoading) return;
    let cancelled = false;

    const load = async () => {
      setLoading(true);

      if (!userId || cancelled) {
        setLoading(false);
        return;
      }

      // ── Load all data in parallel ──────────────────────────────────────────
      const [walletRes, subRes, plansRes, packsRes] = await Promise.all([
        supabase
          .from("user_credit_wallet")
          .select("monthly_used, purchased_balance, monthly_period_start, monthly_period_end")
          .eq("user_id", userId)
          .maybeSingle(),
        supabase
          .from("user_subscriptions")
          .select("plan_id, status, current_period_end")
          .eq("user_id", userId)
          .maybeSingle(),
        supabase
          .from("plans")
          .select("id, name, monthly_allowance_credits, stripe_price_id, is_active, billing_period, features")
          .eq("is_active", true)
          .order("created_at"),
        supabase
          .from("credit_packs")
          .select("id, name, credits_amount, price_usd, stripe_price_id, is_active, display_order")
          .eq("is_active", true)
          .order("display_order"),
      ]);

      if (cancelled) return;

      // ── Resolve plan details ───────────────────────────────────────────────
      const currentPlanId = subRes.data?.plan_id ?? "free";
      const currentStatus = subRes.data?.status ?? "active";
      setPlanId(currentPlanId);
      setPlanStatus(currentStatus);
      setCurrentPeriodEnd((subRes.data as any)?.current_period_end ?? null);
      setCancelAtPeriodEnd((subRes.data as any)?.cancel_at_period_end ?? false);

      // Look up plan name + allowance from catalog
      const matchedPlan = plansRes.data?.find((p) => p.id === currentPlanId);
      const resolvedName = matchedPlan?.name ?? (currentPlanId === "free" ? "Free" : currentPlanId);
      const resolvedGold = matchedPlan ? matchedPlan.monthly_allowance_credits === null : false;
      const resolvedAllowance = matchedPlan?.monthly_allowance_credits ?? 15;

      setPlanName(resolvedName);
      setMonthlyAllowance(resolvedAllowance ?? 15);
      setIsGold(resolvedGold);

      // ── Resolve wallet ─────────────────────────────────────────────────────
      const w = walletRes.data;
      const periodExpired = w?.monthly_period_end ? new Date() >= new Date(w.monthly_period_end) : false;
      const used = periodExpired ? 0 : (w?.monthly_used ?? 0);
      const purchased = w?.purchased_balance ?? 0;
      const remaining = resolvedGold ? Infinity : Math.max(0, (resolvedAllowance ?? 15) - used);
      const total = resolvedGold ? Infinity : remaining + purchased;

      setWallet({
        monthlyUsed: used,
        monthlyRemaining: resolvedGold ? -1 : remaining,
        monthlyAllowance: resolvedAllowance ?? 15,
        purchasedBalance: purchased,
        totalCredits: resolvedGold ? -1 : total,
        isUnlimited: resolvedGold,
        periodEnd: w?.monthly_period_end ?? null,
        periodStart: w?.monthly_period_start ?? null,
      });

      // ── Resolve catalogs ───────────────────────────────────────────────────
      const mappedPlans: BillingPlan[] = (plansRes.data ?? []).map((p) => ({
        id: p.id,
        name: p.name,
        monthlyAllowanceCredits: p.monthly_allowance_credits,
        stripePrice_id: p.stripe_price_id ?? null,
        billingPeriod: (p.billing_period as "monthly" | "yearly") ?? "monthly",
        isActive: p.is_active ?? true,
        features: (p.features as Record<string, unknown>) ?? {},
      }));
      setPlans(mappedPlans);

      const mappedPacks: CreditPack[] = (packsRes.data ?? []).map((p) => ({
        id: p.id,
        name: p.name,
        creditsAmount: p.credits_amount,
        priceUsd: Number(p.price_usd),
        stripePriceId: p.stripe_price_id ?? null,
        isActive: p.is_active ?? true,
        displayOrder: p.display_order ?? 0,
      }));
      setCreditPacks(mappedPacks);

      setLoading(false);
    };

    load();
    return () => { cancelled = true; };
  }, [refreshKey]);

  // ─── Checkout helpers ─────────────────────────────────────────────────────

  const callCheckout = useCallback(
    async (body: {
      purchaseType: "subscription" | "credit_pack";
      planId?: string;
      creditPackId?: string;
    }) => {
      if (checkoutLoading) return; // prevent double-tap
      setCheckoutLoading(true);

      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error("You must be signed in to complete a purchase.");

        const successUrl = `${APP_URL}/billing/success?type=${body.purchaseType}`;
        const cancelUrl = `${APP_URL}/billing/cancel`;

        const res = await fetch(edgeFunctionUrl("create-checkout-session"), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ ...body, successUrl, cancelUrl }),
        });

        const json = await res.json();

        if (!res.ok || !json.url) {
          throw new Error(json.error ?? "Failed to start checkout. Please try again.");
        }

        // Snapshot current state so BillingSuccess can detect what changed
        sessionStorage.setItem("billing_prev_plan", planId);
        sessionStorage.setItem("billing_prev_credits", String(wallet.purchasedBalance));

        // Redirect to Stripe Checkout
        window.location.href = json.url;
      } catch (err: any) {
        toast.error(err.message ?? "Something went wrong. Please try again.");
        setCheckoutLoading(false);
      }
      // Note: don't setCheckoutLoading(false) on success — the page is navigating away
    },
    [checkoutLoading, planId, wallet.purchasedBalance]
  );

  const handleUpgrade = useCallback(
    async (targetPlanId: string) => {
      if (targetPlanId === planId) {
        toast.info("You're already on this plan.");
        return;
      }
      await callCheckout({ purchaseType: "subscription", planId: targetPlanId });
    },
    [planId, callCheckout]
  );

  const handleBuyCredits = useCallback(
    async (packId: string) => {
      await callCheckout({ purchaseType: "credit_pack", creditPackId: packId });
    },
    [callCheckout]
  );

  const handleManageBilling = useCallback(async () => {
    if (portalLoading) return;
    setPortalLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("You must be signed in.");

      const returnUrl = `${APP_URL}/billing/portal-return`;

      const res = await fetch(edgeFunctionUrl("create-customer-portal-session"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ returnUrl }),
      });

      const json = await res.json();

      if (!res.ok || !json.url) {
        throw new Error(json.error ?? "Failed to open billing management. Please try again.");
      }

      window.location.href = json.url;
    } catch (err: any) {
      toast.error(err.message ?? "Something went wrong. Please try again.");
      setPortalLoading(false);
    }
  }, [portalLoading]);

  return {
    loading,
    planId,
    planName,
    planStatus,
    isGold,
    currentPeriodEnd,
    cancelAtPeriodEnd,
    wallet,
    plans,
    creditPacks,
    handleUpgrade,
    handleBuyCredits,
    handleManageBilling,
    refetch,
    checkoutLoading,
    portalLoading,
  };
}
