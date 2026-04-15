import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  getEnabledFeatures,
  type FeatureFlag,
  type UserSubscription,
} from "@/lib/featureFlags";
import { supabase } from "@/lib/supabaseClient";

type SubscriptionRow = {
  tier: string | null;
  addons: unknown;
  status: string;
  trial_ends_at: string | null;
  employees: number | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean | null;
  stripe_subscription_id: string | null;
  stripe_customer_id: string | null;
  stripe_price_id: string | null;
};

function rowToUserSubscription(row: SubscriptionRow): UserSubscription {
  const addons = Array.isArray(row.addons) ? (row.addons as string[]) : [];
  return {
    tier: row.tier,
    addons,
    status: row.status,
  };
}

function parseTrialEndsAt(iso: string | null): Date | null {
  if (!iso || typeof iso !== "string") return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

function computeTrialDaysRemaining(
  status: string,
  trialEndsAt: Date | null,
): number | null {
  if (status.toLowerCase() !== "trialing" || !trialEndsAt) return null;
  const end = trialEndsAt.getTime();
  const now = Date.now();
  if (end <= now) return 0;
  return Math.ceil((end - now) / (24 * 60 * 60 * 1000));
}

export type SubscriptionContextValue = {
  subscription: UserSubscription | null;
  /** Seat count from `subscriptions.employees` when present. */
  employees: number | null;
  /** Next invoice / period boundary from `subscriptions.current_period_end`. */
  currentPeriodEnd: Date | null;
  /** Stripe `cancel_at_period_end` (scheduled cancellation). */
  cancelAtPeriodEnd: boolean;
  stripeSubscriptionId: string | null;
  stripeCustomerId: string | null;
  stripePriceId: string | null;
  features: Set<FeatureFlag>;
  hasFeature: (flag: FeatureFlag) => boolean;
  isTrialing: boolean;
  trialEndsAt: Date | null;
  trialDaysRemaining: number | null;
  isLoading: boolean;
  refreshSubscription: () => Promise<void>;
};

const SubscriptionContext = createContext<SubscriptionContextValue | null>(null);

export function SubscriptionProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const userId = user?.id ?? null;

  const [subscription, setSubscription] = useState<UserSubscription | null>(null);
  const [employees, setEmployees] = useState<number | null>(null);
  const [trialEndsAt, setTrialEndsAt] = useState<Date | null>(null);
  const [currentPeriodEnd, setCurrentPeriodEnd] = useState<Date | null>(null);
  const [cancelAtPeriodEnd, setCancelAtPeriodEnd] = useState(false);
  const [stripeSubscriptionId, setStripeSubscriptionId] = useState<string | null>(null);
  const [stripeCustomerId, setStripeCustomerId] = useState<string | null>(null);
  const [stripePriceId, setStripePriceId] = useState<string | null>(null);
  const [subLoading, setSubLoading] = useState(true);

  const loadSubscription = useCallback(async () => {
    if (!supabase || !userId) {
      setSubscription(null);
      setEmployees(null);
      setTrialEndsAt(null);
      setCurrentPeriodEnd(null);
      setCancelAtPeriodEnd(false);
      setStripeSubscriptionId(null);
      setStripeCustomerId(null);
      setStripePriceId(null);
      setSubLoading(false);
      return;
    }

    setSubLoading(true);
    try {
      const { data, error } = await supabase
        .from("subscriptions")
        .select(
          "tier, addons, status, trial_ends_at, employees, current_period_end, cancel_at_period_end, stripe_subscription_id, stripe_customer_id, stripe_price_id",
        )
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.warn("[SubscriptionContext] load failed:", error.message);
        setSubscription(null);
        setEmployees(null);
        setTrialEndsAt(null);
        setCurrentPeriodEnd(null);
        setCancelAtPeriodEnd(false);
        setStripeSubscriptionId(null);
        setStripeCustomerId(null);
        setStripePriceId(null);
        return;
      }

      if (!data) {
        setSubscription(null);
        setEmployees(null);
        setTrialEndsAt(null);
        setCurrentPeriodEnd(null);
        setCancelAtPeriodEnd(false);
        setStripeSubscriptionId(null);
        setStripeCustomerId(null);
        setStripePriceId(null);
        return;
      }

      const row = data as SubscriptionRow;
      setSubscription(rowToUserSubscription(row));
      setEmployees(
        typeof row.employees === "number" && Number.isFinite(row.employees)
          ? row.employees
          : null,
      );
      setTrialEndsAt(parseTrialEndsAt(row.trial_ends_at));
      setCurrentPeriodEnd(parseTrialEndsAt(row.current_period_end));
      setCancelAtPeriodEnd(!!row.cancel_at_period_end);
      setStripeSubscriptionId(
        typeof row.stripe_subscription_id === "string" && row.stripe_subscription_id
          ? row.stripe_subscription_id
          : null,
      );
      setStripeCustomerId(
        typeof row.stripe_customer_id === "string" && row.stripe_customer_id
          ? row.stripe_customer_id
          : null,
      );
      setStripePriceId(
        typeof row.stripe_price_id === "string" && row.stripe_price_id ? row.stripe_price_id : null,
      );
    } finally {
      setSubLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (authLoading) return;
    void loadSubscription();
  }, [authLoading, loadSubscription]);

  useEffect(() => {
    if (!supabase || !userId) return;

    const client = supabase;
    const channel = client
      .channel(`subscriptions:user:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "subscriptions",
          filter: `user_id=eq.${userId}`,
        },
        () => {
          void loadSubscription();
        },
      )
      .subscribe();

    return () => {
      void client.removeChannel(channel);
    };
  }, [userId, loadSubscription]);

  const features = useMemo(
    () => (subscription ? getEnabledFeatures(subscription) : new Set<FeatureFlag>()),
    [subscription],
  );

  const hasFeature = useCallback(
    (flag: FeatureFlag) => features.has(flag),
    [features],
  );

  const isTrialing = subscription?.status.toLowerCase() === "trialing";
  const trialDaysRemaining = useMemo(
    () =>
      subscription
        ? computeTrialDaysRemaining(subscription.status, trialEndsAt)
        : null,
    [subscription, trialEndsAt],
  );

  const isLoading = authLoading || subLoading;

  const value = useMemo<SubscriptionContextValue>(
    () => ({
      subscription,
      employees,
      currentPeriodEnd,
      cancelAtPeriodEnd,
      stripeSubscriptionId,
      stripeCustomerId,
      stripePriceId,
      features,
      hasFeature,
      isTrialing,
      trialEndsAt,
      trialDaysRemaining,
      isLoading,
      refreshSubscription: loadSubscription,
    }),
    [
      subscription,
      employees,
      currentPeriodEnd,
      cancelAtPeriodEnd,
      stripeSubscriptionId,
      stripeCustomerId,
      stripePriceId,
      features,
      hasFeature,
      isTrialing,
      trialEndsAt,
      trialDaysRemaining,
      isLoading,
      loadSubscription,
    ],
  );

  return (
    <SubscriptionContext.Provider value={value}>{children}</SubscriptionContext.Provider>
  );
}

export function useSubscription(): SubscriptionContextValue {
  const ctx = useContext(SubscriptionContext);
  if (!ctx) {
    throw new Error("useSubscription must be used within a SubscriptionProvider");
  }
  return ctx;
}
