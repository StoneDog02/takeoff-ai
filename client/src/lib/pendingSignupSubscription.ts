import { supabase } from "@/lib/supabaseClient";
import {
  isPricingSelectionValid,
  type PricingSelection,
} from "@/components/landing/PricingStep";
import { createInitialSubscriptionEdge } from "@/lib/billingEdge";

const STORAGE_KEY = "takeoff_pending_subscription_v1";

/** Stored on the auth user at sign-up so email-confirm + first sign-in works on any device. */
export const USER_META_PENDING_STRIPE_CUSTOMER = "pending_billing_stripe_customer_id";
export const USER_META_PENDING_PRICING_JSON = "pending_billing_pricing_json";

/** Single-flight: concurrent SIGNED_IN + /auth/callback must not each create a Stripe subscription. */
let pendingCompletionFlight: Promise<void> | null = null;

function hasLegacyLocalStoragePending(): boolean {
  try {
    return Boolean(localStorage.getItem(STORAGE_KEY)?.trim());
  } catch {
    return false;
  }
}

/** @deprecated Prefer hasAnyPendingSignupBilling(); kept for callers that only need the legacy key. */
export function hasPendingSignupSubscription(): boolean {
  return hasLegacyLocalStoragePending();
}

/** After `waitForSession`, true if this session may still be finishing initial Stripe setup. */
export async function hasAnyPendingSignupBilling(): Promise<boolean> {
  if (hasLegacyLocalStoragePending()) return true;
  if (!supabase) return false;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return parsePendingBillingFromUserMetadata(user?.user_metadata) !== null;
}

function parsePendingBillingFromUserMetadata(
  meta: Record<string, unknown> | undefined | null,
): Omit<PendingSignupSubscription, "email"> | null {
  if (!meta || typeof meta !== "object") return null;
  const stripeCustomerId = meta[USER_META_PENDING_STRIPE_CUSTOMER];
  const pricingJson = meta[USER_META_PENDING_PRICING_JSON];
  if (typeof stripeCustomerId !== "string" || !stripeCustomerId.startsWith("cus_")) return null;
  if (typeof pricingJson !== "string" || !pricingJson.trim()) return null;
  try {
    const pricing = JSON.parse(pricingJson) as PricingSelection;
    if (!isPricingSelectionValid(pricing)) return null;
    return { stripeCustomerId, pricingSelection: pricing };
  } catch {
    return null;
  }
}

async function waitForSessionWithAccessToken(maxWaitMs = 16000): Promise<{
  userId: string;
  email: string;
  accessToken: string;
  userMetadata: Record<string, unknown>;
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
    const userMetadata =
      user.user_metadata && typeof user.user_metadata === "object"
        ? (user.user_metadata as Record<string, unknown>)
        : {};
    return { userId: user.id, email, accessToken: t, userMetadata };
  }
  return null;
}

export type PendingSignupSubscription = {
  email: string;
  stripeCustomerId: string;
  pricingSelection: PricingSelection;
};

export function clearPendingSignupSubscription(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

async function clearPendingBillingUserMetadata(): Promise<void> {
  if (!supabase) return;
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) return;
    await supabase.auth.updateUser({
      data: {
        [USER_META_PENDING_STRIPE_CUSTOMER]: "",
        [USER_META_PENDING_PRICING_JSON]: "",
      },
    });
  } catch {
    /* non-fatal */
  }
}

/** Clears legacy localStorage and user_metadata pending billing (after subscription exists or is abandoned). */
export async function clearAllPendingSignupBillingState(): Promise<void> {
  clearPendingSignupSubscription();
  await clearPendingBillingUserMetadata();
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

  const hydrated = await waitForSessionWithAccessToken();
  if (!hydrated) return;

  const fromMeta = parsePendingBillingFromUserMetadata(hydrated.userMetadata);
  let pending: PendingSignupSubscription | null = fromMeta
    ? {
        email: hydrated.email,
        stripeCustomerId: fromMeta.stripeCustomerId,
        pricingSelection: fromMeta.pricingSelection,
      }
    : null;

  if (!pending) {
    let raw: string | null = null;
    try {
      raw = localStorage.getItem(STORAGE_KEY);
    } catch {
      return;
    }
    if (!raw) return;
    try {
      pending = JSON.parse(raw) as PendingSignupSubscription;
    } catch {
      clearPendingSignupSubscription();
      return;
    }
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

  const email = hydrated.email.toLowerCase().trim();
  if (email !== pending.email.toLowerCase().trim()) return;

  const { data: existing, error: selErr } = await supabase
    .from("subscriptions")
    .select("id")
    .eq("user_id", hydrated.userId)
    .maybeSingle();

  if (selErr) return;
  if (existing) {
    await clearAllPendingSignupBillingState();
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
    await clearAllPendingSignupBillingState();
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
