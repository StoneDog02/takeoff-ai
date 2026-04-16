/**
 * Gateable product features for Proj-X. Map subscription tier + add-ons → enabled flags.
 */

export type FeatureFlag =
  // Core PM (any paid/trialing subscription)
  | "projects"
  | "schedule"
  | "scopeOfWork"
  | "taskDashboard"
  | "workTypeRates"
  | "budgetTracking"
  // Estimating (Plus, Pro, or estimating add-on)
  | "estimateBuilder"
  | "lineItems"
  | "markupControls"
  // Bid & Client Portals (Pro or portals add-on)
  | "subBidPortal"
  | "clientApprovalPortal"
  // AI Takeoff (add-on)
  | "aiTakeoff"
  // Financial Suite (add-on)
  | "bankLink"
  | "revenueReports"
  | "transactionTagging"
  | "changeOrders"
  | "nativeInvoicing"
  // Field Ops & Payroll (add-on)
  | "dailyLog"
  | "geofence"
  | "crewBuilder"
  | "roster"
  | "payroll"
  | "timeTracking"
  // Document Vault (add-on)
  | "documentVault"
  // Directory & Messaging (add-on)
  | "directory"
  | "messaging";

/** Row shape from `public.subscriptions` (fields used for gating). */
export type UserSubscription = {
  tier: string | null;
  addons: string[] | null;
  status: string;
};

const CORE_PM: readonly FeatureFlag[] = [
  "projects",
  "schedule",
  "scopeOfWork",
  "taskDashboard",
  "workTypeRates",
  "budgetTracking",
];

const ESTIMATING: readonly FeatureFlag[] = ["estimateBuilder", "lineItems", "markupControls"];

const PORTALS: readonly FeatureFlag[] = ["subBidPortal", "clientApprovalPortal"];

const AI_TAKEOFF: readonly FeatureFlag[] = ["aiTakeoff"];

const FINANCIAL_SUITE: readonly FeatureFlag[] = [
  "bankLink",
  "revenueReports",
  "transactionTagging",
  "changeOrders",
  "nativeInvoicing",
];

const FIELD_OPS_PAYROLL: readonly FeatureFlag[] = [
  "dailyLog",
  "geofence",
  "crewBuilder",
  "roster",
  "payroll",
  "timeTracking",
];

const DOCUMENT_VAULT: readonly FeatureFlag[] = ["documentVault"];

const DIRECTORY_MESSAGING: readonly FeatureFlag[] = ["directory", "messaging"];

/** Every gateable flag (used for admin / full-product-access bypass). */
const ALL_FLAGS: readonly FeatureFlag[] = [
  ...CORE_PM,
  ...ESTIMATING,
  ...PORTALS,
  ...AI_TAKEOFF,
  ...FINANCIAL_SUITE,
  ...FIELD_OPS_PAYROLL,
  ...DOCUMENT_VAULT,
  ...DIRECTORY_MESSAGING,
];

/** Full product surface regardless of Stripe tier or add-ons. */
export function getAllFeatureFlagsSet(): Set<FeatureFlag> {
  return new Set(ALL_FLAGS);
}

function normalizeTier(tier: string | null | undefined): "core" | "plus" | "pro" {
  const t = (tier ?? "core").toLowerCase().trim();
  if (t === "plus") return "plus";
  if (t === "pro") return "pro";
  return "core";
}

/**
 * Normalize add-on ids from DB / wizard to canonical keys:
 * estimating, portals, aitakeoff, financials, fieldpayroll, docs, directory
 */
function normalizedAddonKeys(addons: string[] | null | undefined): Set<string> {
  const raw = addons ?? [];
  const keys = new Set<string>();
  const alias: Record<string, string> = {
    "ai-takeoff": "aitakeoff",
    aitakeoff: "aitakeoff",
    "field-ops": "fieldpayroll",
    fieldops: "fieldpayroll",
    fieldpayroll: "fieldpayroll",
    vault: "docs",
    docs: "docs",
    financial: "financials",
    financials: "financials",
    estimating: "estimating",
    portals: "portals",
    directory: "directory",
  };
  for (const a of raw) {
    const k = String(a).toLowerCase().trim();
    keys.add(alias[k] ?? k);
  }
  return keys;
}

function addAll(set: Set<FeatureFlag>, flags: readonly FeatureFlag[]): void {
  for (const f of flags) set.add(f);
}

/**
 * Full feature set for a subscription row. Only `active` and `trialing` unlock features.
 */
export function getEnabledFeatures(subscription: UserSubscription): Set<FeatureFlag> {
  const status = (subscription.status ?? "").toLowerCase().trim();
  if (status !== "active" && status !== "trialing") {
    return new Set();
  }

  const tier = normalizeTier(subscription.tier);
  const addonKeys = normalizedAddonKeys(subscription.addons);
  const out = new Set<FeatureFlag>();

  addAll(out, CORE_PM);

  const hasEstimating = tier === "plus" || tier === "pro" || addonKeys.has("estimating");
  if (hasEstimating) addAll(out, ESTIMATING);

  const hasPortals = tier === "pro" || addonKeys.has("portals");
  if (hasPortals) addAll(out, PORTALS);

  if (addonKeys.has("aitakeoff")) addAll(out, AI_TAKEOFF);
  if (addonKeys.has("financials")) addAll(out, FINANCIAL_SUITE);
  if (addonKeys.has("fieldpayroll")) addAll(out, FIELD_OPS_PAYROLL);
  if (addonKeys.has("docs")) addAll(out, DOCUMENT_VAULT);
  if (addonKeys.has("directory")) addAll(out, DIRECTORY_MESSAGING);

  return out;
}

export function hasFeature(subscription: UserSubscription, flag: FeatureFlag): boolean {
  return getEnabledFeatures(subscription).has(flag);
}
