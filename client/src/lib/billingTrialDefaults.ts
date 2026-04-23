import { maxStackAddonsForTier, type PricingSelection, type PricingTier } from "@/components/landing/PricingStep";

/**
 * New signups: 30-day trial on Core PM Pro with every **shipped** billable add-on.
 * Estimating + portals are included in the Pro tier (no separate line items).
 * AI Material Takeoff is intentionally omitted: product gating stays off until that launch.
 */
export function fullTrialPricingSelection(employees = 5): PricingSelection {
  return {
    tier: "pro",
    addons: maxTrialAddonsForTier("pro"),
    employees,
  };
}

/** All stackable add-on ids for a tier (excludes AI takeoff — not billable / not enabled in-app yet). */
export function maxTrialAddonsForTier(tier: PricingTier): string[] {
  return [...maxStackAddonsForTier(tier)];
}

export function trialExitAckStorageKey(stripeSubscriptionId: string, trialEndsAtMs: number): string {
  return `projx_trial_exit_ack:${stripeSubscriptionId}:${trialEndsAtMs}`;
}

export function pricingSelectionsMatch(a: PricingSelection, b: PricingSelection): boolean {
  if (a.tier !== b.tier || a.employees !== b.employees) return false;
  const as = [...new Set(a.addons)].sort().join("\0");
  const bs = [...new Set(b.addons)].sort().join("\0");
  return as === bs;
}
