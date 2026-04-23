import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { api } from "@/api/client";
import { subscriptionToPricingSelection } from "@/lib/billingPricingSelection";
import {
  maxTrialAddonsForTier,
  pricingSelectionsMatch,
  trialExitAckStorageKey,
} from "@/lib/billingTrialDefaults";
import { updateSubscriptionEdge } from "@/lib/billingEdge";
import {
  ADDON_CARD_DESCRIPTION,
  PRICING_ADDON,
  computePricingMonthly,
  type PricingSelection,
  type PricingTier,
} from "@/components/landing/PricingStep";
import { isPublicDemo } from "@/lib/publicDemo";

const ADDON_LABEL: Record<string, string> = {
  [PRICING_ADDON.estimating]: "Estimating Suite",
  [PRICING_ADDON.portals]: "Bid & Client Portals",
  [PRICING_ADDON.financial]: "Financial Suite",
  [PRICING_ADDON.fieldOps]: "Field Ops & Payroll",
  [PRICING_ADDON.vault]: "Document Vault",
  [PRICING_ADDON.directory]: "Directory & Messaging",
};

const ADDON_PRICE: Record<string, string> = {
  [PRICING_ADDON.estimating]: "$79/mo",
  [PRICING_ADDON.portals]: "$69/mo",
  [PRICING_ADDON.financial]: "$89/mo",
  [PRICING_ADDON.fieldOps]: "$129/mo + seats",
  [PRICING_ADDON.vault]: "$24/mo",
  [PRICING_ADDON.directory]: "$29/mo",
};

function tierTitle(tier: PricingTier): string {
  if (tier === "plus") return "Core PM Plus";
  if (tier === "pro") return "Core PM Pro";
  return "Core PM";
}

function toggleAddon(sel: PricingSelection, id: string): PricingSelection {
  const has = sel.addons.includes(id);
  const nextAddons = has ? sel.addons.filter((a) => a !== id) : [...sel.addons, id];
  return { ...sel, addons: nextAddons };
}

/** AI takeoff stays off subscription / feature gates until product launch. */
function stripAiTakeoff(sel: PricingSelection): PricingSelection {
  return {
    ...sel,
    addons: sel.addons.filter((a) => a !== PRICING_ADDON.aiTakeoff),
  };
}

function orderedAddonIdsForTier(tier: PricingTier): string[] {
  const order = [
    PRICING_ADDON.estimating,
    PRICING_ADDON.portals,
    PRICING_ADDON.financial,
    PRICING_ADDON.fieldOps,
    PRICING_ADDON.vault,
    PRICING_ADDON.directory,
  ];
  const allowed = new Set(maxTrialAddonsForTier(tier));
  return order.filter((id) => allowed.has(id));
}

/**
 * Blocking prompt in the last 7 days of trialing: optional feedback to Support Inbox,
 * then confirm add-ons for post-trial billing (Stripe subscription items update; no proration invoice while trialing).
 */
export function TrialWeekLeftModal() {
  const { user, bypass_feature_gates } = useAuth();
  const {
    isTrialing,
    trialDaysRemaining,
    trialEndsAt,
    stripeSubscriptionId,
    subscription,
    employees,
    isLoading,
    refreshSubscription,
  } = useSubscription();

  const [open, setOpen] = useState(false);
  const [selection, setSelection] = useState<PricingSelection | null>(null);
  const [feedback, setFeedback] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const baseline = useMemo(() => {
    if (!subscription) return null;
    return stripAiTakeoff(
      subscriptionToPricingSelection(subscription.tier, subscription.addons, employees),
    );
  }, [subscription, employees]);

  useEffect(() => {
    if (isPublicDemo() || isLoading || !user || bypass_feature_gates) {
      setOpen(false);
      return;
    }
    if (
      !isTrialing ||
      trialDaysRemaining == null ||
      trialDaysRemaining < 1 ||
      trialDaysRemaining > 7
    ) {
      setOpen(false);
      return;
    }
    if (!stripeSubscriptionId || !trialEndsAt || !subscription || baseline == null) {
      setOpen(false);
      return;
    }
    try {
      const key = trialExitAckStorageKey(stripeSubscriptionId, trialEndsAt.getTime());
      if (localStorage.getItem(key) === "1") {
        setOpen(false);
        return;
      }
    } catch {
      /* ignore */
    }
    setOpen(true);
  }, [
    isLoading,
    user,
    bypass_feature_gates,
    isTrialing,
    trialDaysRemaining,
    stripeSubscriptionId,
    trialEndsAt,
    subscription,
    baseline,
  ]);

  useEffect(() => {
    if (!open || baseline == null) return;
    setSelection(baseline);
    setFeedback("");
    setError(null);
  }, [open, baseline]);

  const onToggle = useCallback((id: string) => {
    setSelection((prev) => (prev ? toggleAddon(prev, id) : prev));
  }, []);

  const keepFullAccess = useCallback(() => {
    setSelection((prev) => {
      if (!prev) return prev;
      return { ...prev, addons: maxTrialAddonsForTier(prev.tier) };
    });
  }, []);

  useEffect(() => {
    if (!open || typeof document === "undefined") return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const trialEndLabel = useMemo(() => {
    if (!trialEndsAt) return "";
    try {
      return trialEndsAt.toLocaleDateString(undefined, {
        weekday: "long",
        month: "short",
        day: "numeric",
      });
    } catch {
      return "";
    }
  }, [trialEndsAt]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id || !stripeSubscriptionId || !selection || !subscription || !trialEndsAt) return;
    setSubmitting(true);
    setError(null);
    try {
      const trimmed = feedback.trim();
      if (trimmed) {
        await api.support.create({
          type: "question",
          message: `[Trial — ${trialDaysRemaining ?? "?"} day(s) until first charge]\n\n${trimmed}`,
          page_url: typeof window !== "undefined" ? window.location.href : "",
          page_title: "Trial wrap-up",
          metadata: { source: "trial_week_remaining", trial_days_remaining: trialDaysRemaining },
        });
      }

      const sel = stripAiTakeoff(selection);
      const fromRow = stripAiTakeoff(
        subscriptionToPricingSelection(subscription.tier, subscription.addons, employees),
      );
      if (!pricingSelectionsMatch(sel, fromRow)) {
        const { errorMessage } = await updateSubscriptionEdge({
          userId: user.id,
          stripeSubscriptionId,
          tier: sel.tier,
          addons: sel.addons,
          employees: sel.employees,
        });
        if (errorMessage) {
          setError(errorMessage);
          await refreshSubscription();
          setSubmitting(false);
          return;
        }
      }

      try {
        localStorage.setItem(
          trialExitAckStorageKey(stripeSubscriptionId, trialEndsAt.getTime()),
          "1",
        );
      } catch {
        /* non-fatal */
      }
      await refreshSubscription();
      setOpen(false);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!open || !selection || !subscription || !trialEndsAt) return null;

  const tier = selection.tier;
  const addonIds = orderedAddonIdsForTier(tier);
  const { total } = computePricingMonthly(selection);

  return (
    <div className="trial-week-modal-overlay" role="presentation">
      <div
        className="trial-week-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="trial-week-modal-title"
      >
        <form onSubmit={handleSubmit}>
          <div className="trial-week-modal__header">
            <h2 id="trial-week-modal-title">About a week left on your trial</h2>
            <p className="trial-week-modal__lead">
              Your trial ends {trialEndLabel ? <strong>{trialEndLabel}</strong> : "soon"}. Everything stays unlocked
              until then. Share a quick note if you&apos;d like, then confirm which add-ons you want to keep so your
              first invoice matches.
            </p>
          </div>

          <div className="trial-week-modal__body">
            <label className="trial-week-modal__label" htmlFor="trial-week-feedback">
              Quick feedback (optional)
            </label>
            <textarea
              id="trial-week-feedback"
              className="trial-week-modal__textarea"
              rows={3}
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="What’s working? What would make Proj-X a must-have for your team?"
            />

            <div className="trial-week-modal__section-head">
              <h3>Keep full access?</h3>
              <button type="button" className="trial-week-modal__linkish" onClick={keepFullAccess}>
                Select all add-ons
              </button>
            </div>

            {tier === "pro" ? (
              <p className="trial-week-modal__bundled">
                <strong>Core PM Pro</strong> already includes Estimating Suite and Bid &amp; Client Portals. Below are
                the add-ons that bill on top of your Pro base. AI Material Takeoff is not offered yet and stays
                disabled in the app until launch.
              </p>
            ) : (
              <p className="trial-week-modal__bundled">
                Base plan: <strong>{tierTitle(tier)}</strong>. Toggle add-ons you want to continue after the trial.
              </p>
            )}

            <ul className="trial-week-modal__addon-list">
              {addonIds.map((id) => {
                const checked = selection.addons.includes(id);
                return (
                  <li key={id} className="trial-week-modal__addon-item">
                    <label className="trial-week-modal__addon-label">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => onToggle(id)}
                        className="trial-week-modal__checkbox"
                      />
                      <span className="trial-week-modal__addon-text">
                        <span className="trial-week-modal__addon-title-row">
                          <span className="trial-week-modal__addon-title">{ADDON_LABEL[id] ?? id}</span>
                          <span className="trial-week-modal__addon-price">{ADDON_PRICE[id] ?? ""}</span>
                        </span>
                        <span className="trial-week-modal__addon-desc">
                          {ADDON_CARD_DESCRIPTION[id] ?? ""}
                        </span>
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>

            <div className="trial-week-modal__estimate">
              <span>Estimated monthly after trial</span>
              <strong>${total}/mo</strong>
            </div>
            <p className="trial-week-modal__fineprint">
              While you&apos;re still in trial, we update your subscription items so your first charge reflects this
              plan — you won&apos;t be billed extra for changes during the trial period.
            </p>

            {error ? <p className="trial-week-modal__error">{error}</p> : null}
          </div>

          <div className="trial-week-modal__footer">
            <button type="submit" className="trial-week-modal__submit" disabled={submitting}>
              {submitting ? "Saving…" : "Save and continue"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
