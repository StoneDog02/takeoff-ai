import { useMemo, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Lock } from "lucide-react";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { ViewportTooltip } from "@/components/settings/ViewportTooltip";
import type { FeatureFlag } from "@/lib/featureFlags";

/** Short product name for each gate (titles, tooltips). */
export const FEATURE_LABELS = {
  projects: "Projects",
  schedule: "Schedule",
  scopeOfWork: "Scope of work",
  taskDashboard: "Task dashboard",
  workTypeRates: "Work type rates",
  budgetTracking: "Budget tracking",
  estimateBuilder: "Estimate builder",
  lineItems: "Line items",
  markupControls: "Markup controls",
  subBidPortal: "Sub bid portal",
  clientApprovalPortal: "Client approval portal",
  aiTakeoff: "AI Material Takeoff",
  bankLink: "Bank link",
  revenueReports: "Revenue reports",
  transactionTagging: "Transaction tagging",
  changeOrders: "Change orders",
  nativeInvoicing: "Native invoicing",
  dailyLog: "Daily log",
  geofence: "Geofence",
  crewBuilder: "Crew builder",
  roster: "Roster",
  payroll: "Payroll",
  timeTracking: "Time tracking",
  documentVault: "Document Vault",
  directory: "Directory",
  messaging: "Messaging",
} as const satisfies Record<FeatureFlag, string>;

/**
 * Where to unlock each feature (plan tier or add-on), for upgrade messaging.
 */
export const FEATURE_TO_MODULE = {
  projects: "An active Core PM subscription",
  schedule: "An active Core PM subscription",
  scopeOfWork: "An active Core PM subscription",
  taskDashboard: "An active Core PM subscription",
  workTypeRates: "An active Core PM subscription",
  budgetTracking: "An active Core PM subscription",
  estimateBuilder: "Core PM Plus, Pro, or Estimating Suite add-on",
  lineItems: "Core PM Plus, Pro, or Estimating Suite add-on",
  markupControls: "Core PM Plus, Pro, or Estimating Suite add-on",
  subBidPortal: "Core PM Pro or Bid & Client Portals add-on",
  clientApprovalPortal: "Core PM Pro or Bid & Client Portals add-on",
  aiTakeoff: "AI Material Takeoff add-on",
  bankLink: "Financial Suite add-on",
  revenueReports: "Financial Suite add-on",
  transactionTagging: "Financial Suite add-on",
  changeOrders: "Financial Suite add-on",
  nativeInvoicing: "Financial Suite add-on",
  dailyLog: "Field Ops & Team Payroll add-on",
  geofence: "Field Ops & Team Payroll add-on",
  crewBuilder: "Field Ops & Team Payroll add-on",
  roster: "Field Ops & Team Payroll add-on",
  payroll: "Field Ops & Team Payroll add-on",
  timeTracking: "Field Ops & Team Payroll add-on",
  documentVault: "Document Vault add-on",
  directory: "Directory & Messaging add-on",
  messaging: "Directory & Messaging add-on",
} as const satisfies Record<FeatureFlag, string>;

const billingSettingsTo = "/settings/billing";

type FeatureGateProps = {
  feature: FeatureFlag;
  children: ReactNode;
  /** Shown when the user does not have access (after subscription has loaded). */
  fallback?: ReactNode;
};

/**
 * Renders `children` when the user has the feature; otherwise `fallback` (default: null).
 * Renders nothing while subscription is loading to avoid flashing the wrong state.
 */
export function FeatureGate({ feature, children, fallback = null }: FeatureGateProps) {
  const { hasFeature, isLoading } = useSubscription();
  if (isLoading) return null;
  if (hasFeature(feature)) return <>{children}</>;
  return <>{fallback}</>;
}

type UpgradePromptProps = {
  feature: FeatureFlag;
  className?: string;
};

/**
 * Neutral empty-state card: lock, feature title, which plan/add-on unlocks it, CTA to billing.
 */
export function UpgradePrompt({ feature, className }: UpgradePromptProps) {
  const title = FEATURE_LABELS[feature];
  const unlock = FEATURE_TO_MODULE[feature];

  return (
    <div
      className={[
        "feature-upgrade-prompt rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-8 text-center shadow-card",
        "max-w-md mx-auto",
        className ?? "",
      ]
        .filter(Boolean)
        .join(" ")}
      style={{ fontFamily: "'DM Sans', sans-serif" }}
    >
      <div className="flex justify-center mb-4">
        <span
          className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-surface-elevated)] border border-[var(--color-border)] text-[var(--color-muted)]"
          aria-hidden
        >
          <Lock className="h-5 w-5" strokeWidth={2} />
        </span>
      </div>
      <h3 className="text-lg font-semibold text-[var(--text-primary)] tracking-tight mb-1">
        {title}
      </h3>
      <p className="text-sm text-[var(--color-muted)] leading-relaxed mb-6">
        Unlocked with{" "}
        <span className="text-[var(--text-primary)] font-medium">{unlock}</span>.
      </p>
      <Link
        to={billingSettingsTo}
        className="inline-flex items-center justify-center rounded-lg px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:opacity-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2"
        style={{ backgroundColor: "var(--color-accent)" }}
      >
        Upgrade your plan
      </Link>
    </div>
  );
}

type FeatureTooltipProps = {
  feature: FeatureFlag;
  children: ReactNode;
  /** Forwarded when the wrapped control should be keyboard-focusable for the tooltip. */
  focusable?: boolean;
};

/**
 * Wraps any element; on hover (when locked), shows an upgrade tooltip. Passes through unchanged when the user has access.
 */
export function FeatureTooltip({ feature, children, focusable }: FeatureTooltipProps) {
  const { hasFeature, isLoading } = useSubscription();
  const label = `Upgrade to unlock ${FEATURE_LABELS[feature]}`;

  if (isLoading || hasFeature(feature)) return <>{children}</>;

  return (
    <ViewportTooltip label={label} focusable={focusable}>
      {children}
    </ViewportTooltip>
  );
}

/**
 * Imperative gate: `enabled` reflects loaded subscription; `UpgradePrompt` is null while loading or when the feature is enabled.
 */
export function useFeatureGate(feature: FeatureFlag): {
  enabled: boolean;
  UpgradePrompt: ReactNode;
} {
  const { hasFeature, isLoading } = useSubscription();
  const has = hasFeature(feature);
  const enabled = !isLoading && has;

  const upgradePrompt = useMemo(() => {
    if (isLoading || has) return null;
    return <UpgradePrompt feature={feature} />;
  }, [feature, isLoading, has]);

  return { enabled, UpgradePrompt: upgradePrompt };
}
