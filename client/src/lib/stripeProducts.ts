import type { PricingSelection, PricingTier } from "@/components/landing/PricingStep";

/** Stripe subscription/checkout line item (price + quantity). */
export type StripePriceLineItem = {
  price: string;
  quantity: number;
};

function readViteEnv(key: string): string {
  try {
    const env = (import.meta as ImportMeta & { env?: Record<string, string | boolean | undefined> }).env;
    const v = env?.[key];
    if (typeof v === "string" && v !== "") return v;
  } catch {
    /* import.meta may be unavailable in some runners */
  }
  if (typeof process !== "undefined") {
    const p = process.env[key];
    if (typeof p === "string" && p !== "") return p;
  }
  return "";
}

/** Stripe Price IDs from Vite env (see `.env` VITE_STRIPE_PRICE_*). */
export const PRICE_IDS = {
  core: readViteEnv("VITE_STRIPE_PRICE_CORE"),
  plus: readViteEnv("VITE_STRIPE_PRICE_PLUS"),
  pro: readViteEnv("VITE_STRIPE_PRICE_PRO"),
  estimating: readViteEnv("VITE_STRIPE_PRICE_ESTIMATING"),
  portals: readViteEnv("VITE_STRIPE_PRICE_PORTALS"),
  aiTakeoff: readViteEnv("VITE_STRIPE_PRICE_AI_TAKEOFF"),
  financials: readViteEnv("VITE_STRIPE_PRICE_FINANCIALS"),
  fieldPayrollBase: readViteEnv("VITE_STRIPE_PRICE_FIELD_PAYROLL_BASE"),
  fieldPayrollPerEmp: readViteEnv("VITE_STRIPE_PRICE_FIELD_PAYROLL_PER_EMP"),
  docs: readViteEnv("VITE_STRIPE_PRICE_DOCS"),
  directory: readViteEnv("VITE_STRIPE_PRICE_DIRECTORY"),
} as const;

function tierPriceId(tier: PricingTier): string {
  switch (tier) {
    case "core":
      return PRICE_IDS.core;
    case "plus":
      return PRICE_IDS.plus;
    case "pro":
      return PRICE_IDS.pro;
  }
}

/** True if this addon id should trigger Field Payroll Stripe prices (`fieldpayroll` or wizard `field-ops`). */
function hasFieldPayrollAddon(addons: string[]): boolean {
  return addons.includes("fieldpayroll") || addons.includes("field-ops");
}

/**
 * Maps signup `pricingSelection` to Stripe `line_items`-style entries.
 * Omits entries whose configured price id is missing (empty env).
 */
export function buildLineItems(pricingSelection: PricingSelection): StripePriceLineItem[] {
  const { tier, addons, employees } = pricingSelection;
  const set = new Set(addons);
  const items: StripePriceLineItem[] = [];

  const tierId = tierPriceId(tier);
  if (tierId) items.push({ price: tierId, quantity: 1 });

  if (set.has("estimating") && tier === "core" && PRICE_IDS.estimating) {
    items.push({ price: PRICE_IDS.estimating, quantity: 1 });
  }

  if (set.has("portals") && (tier === "core" || tier === "plus") && PRICE_IDS.portals) {
    items.push({ price: PRICE_IDS.portals, quantity: 1 });
  }

  if (set.has("ai-takeoff") && PRICE_IDS.aiTakeoff) {
    items.push({ price: PRICE_IDS.aiTakeoff, quantity: 1 });
  }

  if (set.has("financial") && PRICE_IDS.financials) {
    items.push({ price: PRICE_IDS.financials, quantity: 1 });
  }

  if (hasFieldPayrollAddon(addons)) {
    if (PRICE_IDS.fieldPayrollBase) {
      items.push({ price: PRICE_IDS.fieldPayrollBase, quantity: 1 });
    }
    const overQty = Math.max(0, employees - 5);
    if (overQty > 0 && PRICE_IDS.fieldPayrollPerEmp) {
      items.push({ price: PRICE_IDS.fieldPayrollPerEmp, quantity: overQty });
    }
  }

  if ((set.has("vault") || set.has("docs")) && PRICE_IDS.docs) {
    items.push({ price: PRICE_IDS.docs, quantity: 1 });
  }

  if (set.has("directory") && PRICE_IDS.directory) {
    items.push({ price: PRICE_IDS.directory, quantity: 1 });
  }

  return items;
}
