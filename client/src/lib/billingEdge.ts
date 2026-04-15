import { callEdgeFunctionJson } from "@/lib/edgeFunctions";
import type { PricingTier } from "@/components/landing/PricingStep";

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
