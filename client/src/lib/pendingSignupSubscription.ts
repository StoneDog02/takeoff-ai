import { supabase } from "@/lib/supabaseClient";
import type { PricingSelection } from "@/components/landing/PricingStep";
import { createInitialSubscriptionEdge } from "@/lib/billingEdge";

const STORAGE_KEY = "takeoff_pending_subscription_v1";

/** Single-flight: concurrent SIGNED_IN + /auth/callback must not each create a Stripe subscription. */
let pendingCompletionFlight: Promise<void> | null = null;

export function hasPendingSignupSubscription(): boolean {
  try {
    return Boolean(localStorage.getItem(STORAGE_KEY)?.trim());
  } catch {
    return false;
  }
}

async function waitForSessionWithAccessToken(maxWaitMs = 16000): Promise<{
  userId: string;
  email: string;
  accessToken: string;
} | null> {
  if (!supabase) return null;
  const deadline = Date.now() + maxWaitMs;
  while (Date.now() < deadline) {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const t = session?.access_token;
    const u = session?.user;
    if (!t || !u?.id || !u.email) {
      await new Promise((r) => setTimeout(r, 100));
      continue;
    }
    // getSession() can be briefly ahead of a token Auth will accept; getUser() verifies with the server.
    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();
    if (userErr || !user?.id || user.id !== u.id) {
      await new Promise((r) => setTimeout(r, 150));
      continue;
    }
    const email = user.email ?? u.email;
    if (!email) {
      await new Promise((r) => setTimeout(r, 100));
      continue;
    }
    return { userId: user.id, email, accessToken: t };
  }
  return null;
}

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
  if (pendingCompletionFlight) {
    await pendingCompletionFlight;
    return;
  }
  pendingCompletionFlight = (async () => {
    try {
      await runPendingSignupCompletion();
    } finally {
      pendingCompletionFlight = null;
    }
  })();
  await pendingCompletionFlight;
}

async function runPendingSignupCompletion(): Promise<void> {
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

  const hydrated = await waitForSessionWithAccessToken();
  if (!hydrated) return;

  const email = hydrated.email.toLowerCase().trim();
  if (email !== pending.email.toLowerCase().trim()) return;

  const { data: existing, error: selErr } = await supabase
    .from("subscriptions")
    .select("id")
    .eq("user_id", hydrated.userId)
    .maybeSingle();

  if (selErr) return;
  if (existing) {
    clearPendingSignupSubscription();
    return;
  }

  const { errorMessage } = await createInitialSubscriptionEdge(
    {
      userId: hydrated.userId,
      stripeCustomerId: pending.stripeCustomerId,
      pricingSelection: pending.pricingSelection,
    },
    { accessToken: hydrated.accessToken },
  );

  if (!errorMessage) {
    clearPendingSignupSubscription();
  }
}

/**
 * After create-subscription, wait until RLS allows the user to read their subscriptions row
 * (so /dashboard + getMe() see billing state without a manual refresh).
 */
export async function waitForSubscriptionRowVisible(maxMs = 16000): Promise<boolean> {
  if (!supabase) return false;
  const deadline = Date.now() + maxMs;
  while (Date.now() < deadline) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user?.id) {
      await new Promise((r) => setTimeout(r, 300));
      continue;
    }
    const { data, error } = await supabase
      .from("subscriptions")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();
    if (!error && data?.id) return true;
    await new Promise((r) => setTimeout(r, 350));
  }
  return false;
}
