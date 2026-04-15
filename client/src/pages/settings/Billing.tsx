import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  AddonRow,
  PlanRadioCard,
  PRICING_ADDON,
  computePricingMonthly,
  effectivePricingAddons,
  type PricingSelection,
  type PricingTier,
} from "@/components/landing/PricingStep";
import { SectionHeader, Card, CardBody, Btn, Label } from "@/components/settings/SettingsPrimitives";
import { LoadingSkeleton } from "@/components/LoadingSkeleton";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { subscriptionToPricingSelection } from "@/lib/billingPricingSelection";
import {
  billingPortalEdge,
  getPaymentMethodEdge,
  updateSubscriptionCancelEdge,
  updateSubscriptionEdge,
  type PaymentMethodCard,
} from "@/lib/billingEdge";

const ACCENT = "#C0392B";
const DARK = "#1A1A1A";
const BORDER = "#e8e6e1";

const TIER_LABEL: Record<PricingTier, string> = {
  core: "Core PM",
  plus: "Core PM Plus",
  pro: "Core PM Pro",
};

function applyTierChange(sel: PricingSelection, tier: PricingTier): PricingSelection {
  let nextAddons = [...sel.addons];
  if (tier === "plus") nextAddons = nextAddons.filter((a) => a !== PRICING_ADDON.estimating);
  if (tier === "pro") {
    nextAddons = nextAddons.filter((a) => a !== PRICING_ADDON.estimating && a !== PRICING_ADDON.portals);
  }
  return { ...sel, tier, addons: nextAddons };
}

function toggleAddon(sel: PricingSelection, id: string): PricingSelection {
  const has = sel.addons.includes(id);
  const nextAddons = has ? sel.addons.filter((a) => a !== id) : [...sel.addons, id];
  return { ...sel, addons: nextAddons };
}

const ADDON_BADGE_LABEL: Record<string, string> = {
  [PRICING_ADDON.estimating]: "Estimating Suite",
  [PRICING_ADDON.portals]: "Bid & Client Portals",
  [PRICING_ADDON.aiTakeoff]: "AI Material Takeoff",
  [PRICING_ADDON.financial]: "Financial Suite",
  [PRICING_ADDON.fieldOps]: "Field Ops & Payroll",
  [PRICING_ADDON.vault]: "Document Vault",
  [PRICING_ADDON.directory]: "Directory & Messaging",
};

function formatDate(d: Date | null): string {
  if (!d) return "—";
  try {
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return "—";
  }
}

export default function Billing() {
  const { user } = useAuth();
  const {
    subscription,
    employees,
    currentPeriodEnd,
    cancelAtPeriodEnd,
    stripeSubscriptionId,
    stripeCustomerId,
    isTrialing,
    trialEndsAt,
    trialDaysRemaining,
    isLoading: subLoading,
    refreshSubscription,
  } = useSubscription();

  const [selection, setSelection] = useState<PricingSelection | null>(null);
  const [paymentCard, setPaymentCard] = useState<PaymentMethodCard | null>(null);
  const [paymentLoading, setPaymentLoading] = useState(true);
  const [pending, setPending] = useState<string | null>(null);
  const [pendingAddon, setPendingAddon] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelSuccess, setCancelSuccess] = useState(false);

  useEffect(() => {
    if (!subscription) {
      setSelection(null);
      return;
    }
    setSelection(
      subscriptionToPricingSelection(subscription.tier, subscription.addons, employees),
    );
  }, [subscription, employees]);

  const loadPaymentMethod = useCallback(async () => {
    if (!stripeCustomerId) {
      setPaymentCard(null);
      setPaymentLoading(false);
      return;
    }
    setPaymentLoading(true);
    const { data, errorMessage } = await getPaymentMethodEdge(stripeCustomerId);
    if (errorMessage) {
      setPaymentCard(null);
    } else {
      setPaymentCard(data && data.last4 ? data : null);
    }
    setPaymentLoading(false);
  }, [stripeCustomerId]);

  useEffect(() => {
    void loadPaymentMethod();
  }, [loadPaymentMethod, stripeSubscriptionId, stripeCustomerId]);

  const { total, lines } = useMemo(() => {
    if (!selection) return { total: 0, lines: [] as { label: string; amount: number }[] };
    return computePricingMonthly(selection);
  }, [selection]);

  const activeBadges = useMemo(() => {
    if (!selection) return [];
    return effectivePricingAddons(selection).map((id) => ADDON_BADGE_LABEL[id] ?? id);
  }, [selection]);

  const applySelection = async (next: PricingSelection) => {
    if (!user?.id || !stripeSubscriptionId) return;
    setError(null);
    setPending("plan");
    const { errorMessage } = await updateSubscriptionEdge({
      userId: user.id,
      stripeSubscriptionId,
      tier: next.tier,
      addons: next.addons,
      employees: next.employees,
    });
    setPending(null);
    if (errorMessage) {
      setError(errorMessage);
      await refreshSubscription();
      return;
    }
    await refreshSubscription();
  };

  const onSelectTier = async (tier: PricingTier) => {
    if (!selection || pending) return;
    if (tier === selection.tier) return;
    const next = applyTierChange(selection, tier);
    setSelection(next);
    await applySelection(next);
  };

  const onToggleAddon = async (id: string) => {
    if (!selection || pendingAddon || pending) return;
    const next = toggleAddon(selection, id);
    setSelection(next);
    setPendingAddon(id);
    setError(null);
    if (!user?.id || !stripeSubscriptionId) {
      setPendingAddon(null);
      return;
    }
    const { errorMessage } = await updateSubscriptionEdge({
      userId: user.id,
      stripeSubscriptionId,
      tier: next.tier,
      addons: next.addons,
      employees: next.employees,
    });
    setPendingAddon(null);
    if (errorMessage) {
      setError(errorMessage);
      await refreshSubscription();
      return;
    }
    await refreshSubscription();
  };

  const openBillingPortal = async () => {
    if (!stripeCustomerId) {
      setError("No Stripe customer on file.");
      return;
    }
    const returnUrl = `${window.location.origin}/settings?section=billing`;
    setError(null);
    setPending("portal");
    const { data, errorMessage } = await billingPortalEdge(stripeCustomerId, returnUrl);
    setPending(null);
    if (errorMessage || !data?.url) {
      setError(errorMessage ?? "Could not open billing portal");
      return;
    }
    window.location.href = data.url;
  };

  const confirmCancel = async () => {
    if (!user?.id || !stripeSubscriptionId) return;
    setError(null);
    setPending("cancel");
    const { errorMessage } = await updateSubscriptionCancelEdge({
      userId: user.id,
      stripeSubscriptionId,
      cancelAtPeriodEnd: true,
    });
    setPending(null);
    setCancelOpen(false);
    if (errorMessage) {
      setError(errorMessage);
      return;
    }
    setCancelSuccess(true);
    await refreshSubscription();
  };

  if (subLoading) {
    return (
      <div className="w-full min-w-0" style={{ padding: 24 }}>
        <LoadingSkeleton variant="inline" lines={10} />
      </div>
    );
  }

  if (!subscription || !stripeSubscriptionId || !stripeCustomerId || !selection) {
    return (
      <div className="w-full min-w-0" style={{ padding: 24 }}>
        <SectionHeader
          title="Billing & Subscription"
          desc="Plans, payment method, and subscription management."
        />
        <Card>
          <CardBody>
            <p style={{ margin: 0, fontSize: 14, color: "#6b7280" }}>
              No active subscription on this account.{" "}
              <Link to="/sign-up" style={{ color: ACCENT, fontWeight: 600 }}>
                Start a plan
              </Link>{" "}
              to unlock billing here.
            </p>
          </CardBody>
        </Card>
      </div>
    );
  }

  const addonSet = new Set(selection.addons);
  const fieldOpsOn = addonSet.has(PRICING_ADDON.fieldOps);

  return (
    <div className="w-full min-w-0 max-w-full" style={{ paddingBottom: 32 }}>
      {error ? (
        <div
          style={{
            marginBottom: 16,
            padding: 12,
            background: "#fef2f2",
            color: "#b91c1c",
            borderRadius: 8,
            fontSize: 13,
          }}
        >
          {error}
        </div>
      ) : null}

      <SectionHeader
        title="Billing & Subscription"
        desc="Your plan, add-ons, payment method, and cancellation options."
      />

      {/* Current plan */}
      <Card style={{ marginBottom: 16 }}>
        <CardBody>
          <div style={{ fontSize: 15, fontWeight: 700, color: DARK, marginBottom: 12 }}>Current plan</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", marginBottom: 12 }}>
            <span
              style={{
                display: "inline-flex",
                padding: "6px 12px",
                borderRadius: 8,
                background: "#f0ede8",
                fontSize: 13,
                fontWeight: 700,
                color: "#111",
              }}
            >
              {TIER_LABEL[selection.tier]}
            </span>
            {activeBadges.map((label) => (
              <span
                key={label}
                style={{
                  display: "inline-flex",
                  padding: "4px 10px",
                  borderRadius: 99,
                  border: `1px solid ${BORDER}`,
                  fontSize: 12,
                  fontWeight: 600,
                  color: "#374151",
                }}
              >
                {label}
              </span>
            ))}
          </div>
          <div style={{ fontSize: 14, color: "#4b5563", marginBottom: 6 }}>
            <strong style={{ color: "#111" }}>Estimated monthly total:</strong> ${total}/mo
          </div>
          <div style={{ fontSize: 13, color: "#6b7280" }}>
            Next billing date: <strong style={{ color: "#111" }}>{formatDate(currentPeriodEnd)}</strong>
          </div>
          {cancelAtPeriodEnd ? (
            <div style={{ marginTop: 10, fontSize: 13, color: "#b45309", fontWeight: 600 }}>
              Cancellation scheduled — access continues until {formatDate(currentPeriodEnd)}.
            </div>
          ) : null}
          {isTrialing ? (
            <div style={{ marginTop: 10, fontSize: 13, color: ACCENT, fontWeight: 600 }}>
              Trial
              {trialDaysRemaining != null ? ` · ${trialDaysRemaining} day${trialDaysRemaining === 1 ? "" : "s"} left` : ""}
              {trialEndsAt ? ` · Ends ${formatDate(trialEndsAt)}` : ""}
            </div>
          ) : null}
          {cancelSuccess ? (
            <div style={{ marginTop: 12, padding: 12, background: "#ecfdf5", color: "#047857", borderRadius: 8, fontSize: 13 }}>
              Your subscription will cancel at the end of the billing period. You keep full access until then.
            </div>
          ) : null}
        </CardBody>
      </Card>

      {/* Tier cards */}
      <Card style={{ marginBottom: 16 }}>
        <CardBody>
          <div style={{ fontSize: 15, fontWeight: 700, color: DARK, marginBottom: 8 }}>Change plan</div>
          <p style={{ margin: "0 0 16px", fontSize: 13, color: "#6b7280" }}>
            Proration is applied automatically when you switch tiers.
          </p>
          <Label>Base plan</Label>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 12,
              marginBottom: 8,
              opacity: pending === "plan" ? 0.65 : 1,
              pointerEvents: pending === "plan" ? "none" : "auto",
            }}
          >
            <PlanRadioCard name="Core PM" priceLabel="$99/mo" selected={selection.tier === "core"} onSelect={() => void onSelectTier("core")} />
            <PlanRadioCard name="Core PM Plus" priceLabel="$149/mo" selected={selection.tier === "plus"} onSelect={() => void onSelectTier("plus")} />
            <PlanRadioCard name="Core PM Pro" priceLabel="$199/mo" selected={selection.tier === "pro"} onSelect={() => void onSelectTier("pro")} />
          </div>
          {pending === "plan" ? (
            <p style={{ margin: "8px 0 0", fontSize: 12, color: "#6b7280" }}>Updating subscription…</p>
          ) : null}
        </CardBody>
      </Card>

      {/* Add-ons */}
      <Card style={{ marginBottom: 16 }}>
        <CardBody>
          <div style={{ fontSize: 15, fontWeight: 700, color: DARK, marginBottom: 12 }}>Add-ons</div>
          {(selection.tier === "core" || selection.tier === "plus") && (
            <>
              {selection.tier === "core" ? (
                <AddonRow
                  title="Estimating Suite"
                  priceLabel="$79/mo"
                  checked={addonSet.has(PRICING_ADDON.estimating)}
                  onToggle={() => void onToggleAddon(PRICING_ADDON.estimating)}
                  disabled={!!pendingAddon || !!pending}
                />
              ) : null}
              <AddonRow
                title="Bid & Client Portals"
                priceLabel="$69/mo"
                checked={addonSet.has(PRICING_ADDON.portals)}
                onToggle={() => void onToggleAddon(PRICING_ADDON.portals)}
                disabled={!!pendingAddon || !!pending}
              />
            </>
          )}
          <AddonRow
            title="AI Material Takeoff"
            priceLabel="$99/mo (planned)"
            note="Not available to add yet — coming soon."
            checked={false}
            disabled
            onToggle={() => {}}
          />
          <AddonRow
            title="Financial Suite"
            priceLabel="$89/mo"
            checked={addonSet.has(PRICING_ADDON.financial)}
            onToggle={() => void onToggleAddon(PRICING_ADDON.financial)}
            disabled={!!pendingAddon || !!pending}
          />
          <AddonRow
            title="Field Ops & Team Payroll"
            priceLabel="$129/mo + $5/employee after 5"
            checked={fieldOpsOn}
            onToggle={() => void onToggleAddon(PRICING_ADDON.fieldOps)}
            disabled={!!pendingAddon || !!pending}
          >
            {fieldOpsOn ? (
              <div style={{ paddingLeft: 30 }}>
                <span style={{ fontSize: 12, color: "#666", fontWeight: 600 }}>Employees</span>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 8 }}>
                  <button
                    type="button"
                    disabled={!!pending || !!pendingAddon}
                    onClick={() => {
                      const next = { ...selection, employees: Math.max(1, selection.employees - 1) };
                      setSelection(next);
                      void applySelection(next);
                    }}
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 8,
                      border: `1px solid ${BORDER}`,
                      background: "#fff",
                      cursor: pending ? "not-allowed" : "pointer",
                    }}
                  >
                    −
                  </button>
                  <span style={{ fontSize: 16, fontWeight: 700, minWidth: 28, textAlign: "center" }}>{selection.employees}</span>
                  <button
                    type="button"
                    disabled={!!pending || !!pendingAddon}
                    onClick={() => {
                      const next = { ...selection, employees: selection.employees + 1 };
                      setSelection(next);
                      void applySelection(next);
                    }}
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 8,
                      border: `1px solid ${BORDER}`,
                      background: "#fff",
                      cursor: pending ? "not-allowed" : "pointer",
                    }}
                  >
                    +
                  </button>
                </div>
              </div>
            ) : null}
          </AddonRow>
          <AddonRow
            title="Document Vault"
            priceLabel="$24/mo"
            checked={addonSet.has(PRICING_ADDON.vault)}
            onToggle={() => void onToggleAddon(PRICING_ADDON.vault)}
            disabled={!!pendingAddon || !!pending}
          />
          <AddonRow
            title="Directory & Messaging"
            priceLabel="$29/mo"
            checked={addonSet.has(PRICING_ADDON.directory)}
            onToggle={() => void onToggleAddon(PRICING_ADDON.directory)}
            disabled={!!pendingAddon || !!pending}
          />
          {pendingAddon ? (
            <p style={{ margin: "10px 0 0", fontSize: 12, color: "#6b7280" }}>Updating add-on…</p>
          ) : null}
        </CardBody>
      </Card>

      {/* Line items recap */}
      <Card style={{ marginBottom: 16 }}>
        <CardBody>
          <div style={{ fontSize: 12, fontWeight: 700, color: ACCENT, letterSpacing: "0.06em", marginBottom: 10 }}>
            ESTIMATED MONTHLY TOTAL
          </div>
          <ul style={{ listStyle: "none", margin: "0 0 12px", padding: 0 }}>
            {lines.map((l) => (
              <li
                key={l.label}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: 13,
                  color: "#555",
                  padding: "4px 0",
                  borderBottom: `1px solid ${BORDER}`,
                }}
              >
                <span>{l.label}</span>
                <span style={{ fontWeight: 600, color: DARK }}>${l.amount}/mo</span>
              </li>
            ))}
          </ul>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: DARK }}>Total</span>
            <span style={{ fontSize: 22, fontWeight: 800, color: ACCENT }}>${total}/mo</span>
          </div>
          <p style={{ margin: "10px 0 0", fontSize: 11, color: "#9ca3af", lineHeight: 1.45 }}>
            Estimates follow your current selections. Stripe invoices the prorated amount when you change plans.
          </p>
        </CardBody>
      </Card>

      {/* Payment method */}
      <Card style={{ marginBottom: 16 }}>
        <CardBody>
          <div style={{ fontSize: 15, fontWeight: 700, color: DARK, marginBottom: 8 }}>Payment method</div>
          {paymentLoading ? (
            <LoadingSkeleton variant="inline" lines={2} />
          ) : paymentCard ? (
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12, marginBottom: 12 }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: "#111" }}>
                {paymentCard.brand?.toUpperCase() ?? "Card"} ···· {paymentCard.last4}
              </span>
              <span style={{ fontSize: 13, color: "#6b7280" }}>
                Exp {paymentCard.expMonth}/{paymentCard.expYear}
              </span>
            </div>
          ) : (
            <p style={{ fontSize: 13, color: "#6b7280", marginBottom: 12 }}>No card on file.</p>
          )}
          <Btn type="button" variant="outline" disabled={!!pending} onClick={() => void openBillingPortal()}>
            {pending === "portal" ? "Opening…" : "Update card"}
          </Btn>
          <p style={{ margin: "10px 0 0", fontSize: 11, color: "#9ca3af" }}>
            Opens Stripe’s secure billing portal to manage your payment methods.
          </p>
        </CardBody>
      </Card>

      {/* Cancel */}
      <div style={{ padding: "0 4px" }}>
        {!cancelAtPeriodEnd && !cancelSuccess ? (
          <button
            type="button"
            onClick={() => setCancelOpen(true)}
            style={{
              background: "none",
              border: "none",
              padding: 0,
              fontSize: 13,
              fontWeight: 600,
              color: "#6b7280",
              textDecoration: "underline",
              cursor: "pointer",
            }}
          >
            Cancel subscription
          </button>
        ) : null}
      </div>

      {cancelOpen ? (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(0,0,0,0.5)",
            padding: 20,
          }}
          onClick={() => setCancelOpen(false)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="teams-card"
            style={{ maxWidth: 420, width: "100%", padding: 24, background: "var(--bg-surface, #fff)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="teams-section-title" style={{ marginBottom: 12 }}>
              Cancel subscription?
            </h2>
            <p className="teams-muted" style={{ marginBottom: 20, fontSize: 14, lineHeight: 1.5 }}>
              Your access continues until the end of the current billing period ({formatDate(currentPeriodEnd)}). You can
              resubscribe anytime.
            </p>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <Btn type="button" variant="ghost" onClick={() => setCancelOpen(false)}>
                Keep subscription
              </Btn>
              <Btn type="button" variant="dangerSolid" disabled={pending === "cancel"} onClick={() => void confirmCancel()}>
                {pending === "cancel" ? "Confirming…" : "Confirm cancel"}
              </Btn>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
