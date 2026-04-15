import { supabase } from "@/lib/supabaseClient";
import type { PricingSelection } from "@/components/landing/PricingStep";
import { createInitialSubscriptionEdge } from "@/lib/billingEdge";

const STORAGE_KEY = "takeoff_pending_subscription_v1";

export type PendingSignupSubscription = {
  email: string;
  stripeCustomerId: string;
  pricingSelection: PricingSelection;
};

export function savePendingSignupSubscription(payload: PendingSignupSubscription): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    /* ignore */
  }
}

export function clearPendingSignupSubscription(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

/**
 * Email-confirmation signups: subscription is created on first SIGNED_IN when we have session + pending payload.
 */
export async function tryCompletePendingSignupSubscription(): Promise<void> {
  if (!supabase) return;
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch {
    return;
  }
  if (!raw) return;

  let pending: PendingSignupSubscription;
  try {
    pending = JSON.parse(raw) as PendingSignupSubscription;
  } catch {
    clearPendingSignupSubscription();
    return;
  }

  if (
    !pending.email ||
    typeof pending.stripeCustomerId !== "string" ||
    !pending.stripeCustomerId.startsWith("cus_") ||
    !pending.pricingSelection
  ) {
    clearPendingSignupSubscription();
    return;
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();
  const user = session?.user;
  const accessToken = session?.access_token;
  if (!user?.id || !user.email || !accessToken) return;

  const email = user.email.toLowerCase().trim();
  if (email !== pending.email.toLowerCase().trim()) return;

  const { data: existing, error: selErr } = await supabase
    .from("subscriptions")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (selErr) return;
  if (existing) {
    clearPendingSignupSubscription();
    return;
  }

  const { errorMessage } = await createInitialSubscriptionEdge(
    {
      userId: user.id,
      stripeCustomerId: pending.stripeCustomerId,
      pricingSelection: pending.pricingSelection,
    },
    { accessToken },
  );

  if (!errorMessage) {
    clearPendingSignupSubscription();
  }
}
