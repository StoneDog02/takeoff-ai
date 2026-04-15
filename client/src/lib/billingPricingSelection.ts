import type { PricingSelection, PricingTier } from "@/components/landing/PricingStep";
import { PRICING_ADDON } from "@/components/landing/PricingStep";

export function normalizeTier(t: string | null | undefined): PricingTier {
  const x = (t ?? "core").toLowerCase().trim();
  if (x === "plus") return "plus";
  if (x === "pro") return "pro";
  return "core";
}

/** Map DB / webhook addon keys to wizard `PricingSelection.addons` ids. */
export function dbAddonsToWizardAddons(raw: string[] | null | undefined): string[] {
  if (!raw?.length) return [];
  const out: string[] = [];
  for (const a of raw) {
    const k = String(a).toLowerCase().trim();
    const map: Record<string, string> = {
      estimating: PRICING_ADDON.estimating,
      portals: PRICING_ADDON.portals,
      "ai-takeoff": PRICING_ADDON.aiTakeoff,
      aitakeoff: PRICING_ADDON.aiTakeoff,
      financial: PRICING_ADDON.financial,
      financials: PRICING_ADDON.financial,
      fieldpayroll: PRICING_ADDON.fieldOps,
      fieldops: PRICING_ADDON.fieldOps,
      "field-ops": PRICING_ADDON.fieldOps,
      vault: PRICING_ADDON.vault,
      docs: PRICING_ADDON.vault,
      directory: PRICING_ADDON.directory,
    };
    const id = map[k] ?? k;
    if (!out.includes(id)) out.push(id);
  }
  return out;
}

export function subscriptionToPricingSelection(
  tier: string | null,
  addons: string[] | null,
  employees: number | null,
): PricingSelection {
  return {
    tier: normalizeTier(tier),
    addons: dbAddonsToWizardAddons(addons),
    employees: typeof employees === "number" && employees >= 1 ? employees : 5,
  };
}
