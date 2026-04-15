import { supabase } from "@/lib/supabaseClient";
import type { PricingSelection } from "@/components/landing/PricingStep";
import { createInitialSubscriptionEdge } from "@/lib/billingEdge";

const STORAGE_KEY = "takeoff_pending_subscription_v1";

/** Serialize runs — Auth callback + SIGNED_IN + refetch can all fire at once. */
let completeChain: Promise<void> = Promise.resolve();

async function waitForSessionWithAccessToken(maxWaitMs = 8000): Promise<{
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
  completeChain = completeChain
    .then(() => runPendingSignupCompletion())
    .catch(() => {
      /* keep chain alive for later invocations */
    });
  await completeChain;
}

/**
 * After email confirmation, session + getUser() can lag behind the URL hash/code exchange.
 * Run pending completion a few times with gaps so we don't rely only on a later sign-out/sign-in.
 */
export async function completePendingSignupWithRetries(opts?: {
  rounds?: number;
  gapMs?: number;
}): Promise<void> {
  const rounds = opts?.rounds ?? 4;
  const gapMs = opts?.gapMs ?? 1200;
  for (let i = 0; i < rounds; i++) {
    await tryCompletePendingSignupSubscription();
    let raw: string | null = null;
    try {
      raw = localStorage.getItem(STORAGE_KEY);
    } catch {
      return;
    }
    if (!raw) return;
    if (i < rounds - 1) await new Promise((r) => setTimeout(r, gapMs));
  }
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
