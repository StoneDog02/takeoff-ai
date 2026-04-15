import { type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Lock } from "lucide-react";
import { LoadingSkeleton } from "@/components/LoadingSkeleton";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { FEATURE_LABELS } from "@/components/gates/FeatureGate";
import type { FeatureFlag } from "@/lib/featureFlags";

const BILLING_TO = "/settings/billing";

/** Two-sentence marketing blurbs for the full-page upgrade wall (per gated route). */
const UPGRADE_WALL_COPY: Partial<Record<FeatureFlag, readonly [string, string]>> = {
  projects: [
    "Organize jobs, schedules, and budgets in one workspace your whole team can follow.",
    "Move from kickoff to closeout with clarity on scope, tasks, and financial health.",
  ],
  estimateBuilder: [
    "Build detailed estimates with line items, markups, and versions tied to each job.",
    "Submit sharper bids faster and keep estimating consistent across your portfolio.",
  ],
  subBidPortal: [
    "Publish bid packages, collect subcontractor responses, and compare bids in one thread.",
    "Cut email chaos and keep every quote auditable when clients and subs ask questions.",
  ],
  aiTakeoff: [
    "Turn plans into structured quantities and scopes with AI-assisted takeoff workflows.",
    "Spend less time counting sheets and more time pricing the work that wins projects.",
  ],
  bankLink: [
    "Connect bank feeds to see cash alongside jobs, invoices, and expenses in context.",
    "Reconcile faster and catch drift between the field and your books before it compounds.",
  ],
  dailyLog: [
    "Capture jobsite notes, photos, weather, and production in a daily field record.",
    "Protect your schedule and your team with a clear history when disputes arise.",
  ],
  payroll: [
    "Run payroll with time and jobs tied together so crews get paid accurately.",
    "Reduce double entry and export headaches with payroll informed by real field data.",
  ],
  crewBuilder: [
    "Plan crews, skills, and assignments across active jobs without spreadsheet juggling.",
    "See who is scheduled where and adjust before conflicts cost you days on site.",
  ],
  documentVault: [
    "Centralize plans, contracts, RFIs, and photos in a project-linked document vault.",
    "Everyone works from the same controlled set instead of hunting through inboxes.",
  ],
  directory: [
    "Keep subs, clients, and internal contacts searchable with roles and history.",
    "Reach the right person at the right time without digging through old threads.",
  ],
  messaging: [
    "Message office and field teams in job-aware threads instead of scattered texts.",
    "Keep decisions searchable and tied to work so nothing gets lost on personal phones.",
  ],
};

function defaultWallCopy(_feature: FeatureFlag): readonly [string, string] {
  return [
    "This capability is included when your subscription unlocks the right modules.",
    "Upgrade your plan to turn it on for your team and keep everyone in one system.",
  ];
}

function wallCopy(feature: FeatureFlag): readonly [string, string] {
  return UPGRADE_WALL_COPY[feature] ?? defaultWallCopy(feature);
}

type UpgradeWallProps = {
  feature: FeatureFlag;
  className?: string;
};

/**
 * Full-page dark empty state when a route is blocked by subscription.
 */
export function UpgradeWall({ feature, className }: UpgradeWallProps) {
  const title = FEATURE_LABELS[feature];
  const [a, b] = wallCopy(feature);

  return (
    <div
      className={[
        "min-h-screen flex flex-col items-center justify-center px-6 py-16 text-center",
        className ?? "",
      ]
        .filter(Boolean)
        .join(" ")}
      style={{
        background: "#0b0e14",
        color: "var(--color-white)",
        fontFamily: "'DM Sans', sans-serif",
      }}
    >
      <div className="w-full max-w-lg">
        <div className="flex justify-center mb-8" aria-hidden>
          <Lock className="h-[72px] w-[72px]" strokeWidth={1.4} style={{ color: "#C0392B" }} />
        </div>
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-[var(--color-white)] mb-4">
          Unlock {title}
        </h1>
        <p className="text-base leading-relaxed text-[var(--color-white-dim)] mb-3">{a}</p>
        <p className="text-base leading-relaxed text-[var(--color-white-dim)] mb-10">{b}</p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center items-stretch sm:items-center">
          <Link
            to={BILLING_TO}
            className="inline-flex items-center justify-center rounded-lg px-5 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C0392B] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0b0e14]"
            style={{ backgroundColor: "#C0392B" }}
          >
            Upgrade now
          </Link>
          <Link
            to={{ pathname: "/", hash: "features" }}
            className="inline-flex items-center justify-center rounded-lg px-5 py-3 text-sm font-semibold border border-[rgba(245,243,239,0.22)] text-[var(--color-white)] bg-transparent hover:bg-[rgba(245,243,239,0.06)] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(245,243,239,0.35)] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0b0e14]"
          >
            View all features
          </Link>
        </div>
      </div>
    </div>
  );
}

type SubscriptionRouteProps = {
  feature: FeatureFlag;
  children: ReactNode;
};

/**
 * Route guard: shows page skeleton while subscription loads, children when allowed,
 * or a full-page {@link UpgradeWall} when the feature is not on the current plan.
 */
export function SubscriptionRoute({ feature, children }: SubscriptionRouteProps) {
  const { hasFeature, isLoading } = useSubscription();

  if (isLoading) {
    return (
      <div className="dashboard-app flex min-h-screen items-center justify-center">
        <LoadingSkeleton variant="page" />
      </div>
    );
  }

  if (!hasFeature(feature)) {
    return <UpgradeWall feature={feature} />;
  }

  return <>{children}</>;
}
