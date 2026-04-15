import { Link } from "react-router-dom";
import { X } from "lucide-react";

type TrialBannerProps = {
  trialDaysRemaining: number | null;
  urgent: boolean;
  onDismiss: () => void;
};

/** Middle sentence fragment after "Your free trial ends …" */
function trialEndsFragment(days: number | null): string {
  if (days == null) return "soon";
  if (days <= 0) return "today";
  if (days === 1) return "in 1 day";
  return `in ${days} days`;
}

/**
 * Full-width trial notice at the top of the app shell. Parent should add
 * `dashboard-app--trial-banner` to `.dashboard-app` for sidenav/content offset.
 */
export function TrialBanner({ trialDaysRemaining, urgent, onDismiss }: TrialBannerProps) {
  const mid = trialEndsFragment(trialDaysRemaining);

  return (
    <div
      className={`trial-banner ${urgent ? "trial-banner--urgent" : ""}`}
      role="region"
      aria-label="Trial ending soon"
    >
      <p className="trial-banner__text">
        Your free trial ends {mid} — add a payment method to keep access.
      </p>
      <div className="trial-banner__actions">
        <Link to="/settings/billing" className="trial-banner__btn trial-banner__btn--primary">
          Add payment method
        </Link>
        <button
          type="button"
          className="trial-banner__btn trial-banner__btn--ghost"
          onClick={onDismiss}
          aria-label="Dismiss trial notice"
        >
          <X size={18} strokeWidth={2} aria-hidden />
        </button>
      </div>
    </div>
  );
}

export const TRIAL_BANNER_SESSION_KEY = "projx_trial_banner_dismissed_session";
