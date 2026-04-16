import { callEdgeFunctionJson } from "@/lib/edgeFunctions";
import type { PricingSelection, PricingTier } from "@/components/landing/PricingStep";

export type PaymentMethodCard = {
  brand: string | null;
  last4: string | null;
  expMonth: number | null;
  expYear: number | null;
};

export async function updateSubscriptionEdge(payload: {
  userId: string;
  stripeSubscriptionId: string;
  tier: PricingTier;
  addons: string[];
  employees: number;
}) {
  return callEdgeFunctionJson<{ success?: boolean; error?: string }>("update-subscription", {
    json: { ...payload } as Record<string, unknown>,
  });
}

export async function updateSubscriptionCancelEdge(payload: {
  userId: string;
  stripeSubscriptionId: string;
  cancelAtPeriodEnd: boolean;
}) {
  return callEdgeFunctionJson<{ success?: boolean; error?: string }>("update-subscription", {
    json: { ...payload } as Record<string, unknown>,
  });
}

export async function getPaymentMethodEdge(stripeCustomerId: string) {
  return callEdgeFunctionJson<PaymentMethodCard | null>("get-payment-method", {
    json: { stripeCustomerId },
  });
}

export async function billingPortalEdge(stripeCustomerId: string, returnUrl: string) {
  return callEdgeFunctionJson<{ url?: string; error?: string }>("billing-portal", {
    json: { stripeCustomerId, returnUrl },
  });
}

type CreateInitialSubResponse = {
  data: {
    subscriptionId?: string;
    clientSecret?: string | null;
    trialEndsAt?: string | null;
    error?: string;
  } | null;
  errorMessage: string | null;
  httpStatus: number;
};

/** Single in-flight create per user (React Strict Mode / double tap). */
const createSubInflight = new Map<string, Promise<CreateInitialSubResponse>>();

/** Initial subscription after signup (full tier + add-ons). Uses Edge Function; requires default PM on customer. */
export async function createInitialSubscriptionEdge(
  payload: {
    userId: string;
    stripeCustomerId: string;
    pricingSelection: PricingSelection;
  },
  opts?: { accessToken?: string | null },
) {
  const uid = payload.userId?.trim() ?? "";
  if (!uid) {
    return {
      data: null,
      errorMessage: "Missing user id",
      httpStatus: 400,
    };
  }
  const existing = createSubInflight.get(uid);
  if (existing) return existing;

  const p = callEdgeFunctionJson<{
    subscriptionId?: string;
    clientSecret?: string | null;
    trialEndsAt?: string | null;
    error?: string;
  }>("create-subscription", {
    json: {
      userId: payload.userId,
      stripeCustomerId: payload.stripeCustomerId,
      pricingSelection: payload.pricingSelection,
    } as Record<string, unknown>,
    accessToken: opts?.accessToken,
  }).finally(() => {
    createSubInflight.delete(uid);
  });
  createSubInflight.set(uid, p);
  return p;
}
