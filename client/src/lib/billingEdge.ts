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

/** Initial subscription after signup (full tier + add-ons). Uses Edge Function; requires default PM on customer. */
export async function createInitialSubscriptionEdge(payload: {
  userId: string;
  stripeCustomerId: string;
  pricingSelection: PricingSelection;
}) {
  return callEdgeFunctionJson<{
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
  });
}
