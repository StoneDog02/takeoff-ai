import { useId, useLayoutEffect, useMemo, type CSSProperties, type ReactNode } from "react";

export type PricingTier = "core" | "plus" | "pro";

export interface PricingSelection {
  tier: PricingTier;
  addons: string[];
  employees: number;
}

const ACCENT = "#C0392B";
const DARK = "#1A1A1A";
const BORDER = "#EBEBEB";

const TIER_PRICES: Record<PricingTier, number> = {
  core: 99,
  plus: 149,
  pro: 199,
};

/** Short blurbs for tier cards (landing + signup). Aligns with what each tier bundles vs add-ons. */
export const TIER_CARD_DESCRIPTION: Record<PricingTier, string> = {
  core:
    "Jobs, schedule, and tasks—the operational core for running projects in Proj-X.",
  plus:
    "Everything in Core PM, plus budgets, field collaboration, and Estimating Suite included—line-item bids, markups, and estimate versions tied to each job.",
  pro:
    "Everything in Plus, plus Bid & Client Portals included—publish bid packages to subs and client approval links, with estimating still bundled in.",
};

/** Section above estimating/portals: explains tier bundling vs Core line items (landing + signup). */
const TIER_STACK_SECTION_TITLE = "What’s included with each base plan";
const TIER_STACK_SECTION_INTRO =
  "Estimating and portals are folded into Core PM Plus and Core PM Pro. The cards below show which tier each capability ships with; on Core PM you can still add them as separate billing lines at signup if that matches your workflow.";

export const PRICING_ADDON = {
  estimating: "estimating",
  portals: "portals",
  aiTakeoff: "ai-takeoff",
  financial: "financial",
  fieldOps: "field-ops",
  vault: "vault",
  directory: "directory",
} as const;

export type PricingAddonId = (typeof PRICING_ADDON)[keyof typeof PRICING_ADDON];

function tierMarketingName(tier: PricingTier): string {
  if (tier === "plus") return "Core PM Plus";
  if (tier === "pro") return "Core PM Pro";
  return "Core PM";
}

/** Every stackable paid add-on for “up to” copy on landing (excludes AI; not selectable there). */
export function maxStackAddonsForTier(tier: PricingTier): string[] {
  const stack = [
    PRICING_ADDON.estimating,
    PRICING_ADDON.portals,
    PRICING_ADDON.financial,
    PRICING_ADDON.fieldOps,
    PRICING_ADDON.vault,
    PRICING_ADDON.directory,
  ];
  if (tier === "core") return stack;
  if (tier === "plus") return stack.filter((id) => id !== PRICING_ADDON.estimating);
  return stack.filter((id) => id !== PRICING_ADDON.estimating && id !== PRICING_ADDON.portals);
}

const ADDON_PRICES: Record<string, number> = {
  [PRICING_ADDON.estimating]: 79,
  [PRICING_ADDON.portals]: 69,
  [PRICING_ADDON.aiTakeoff]: 99,
  [PRICING_ADDON.financial]: 89,
  [PRICING_ADDON.fieldOps]: 129,
  [PRICING_ADDON.vault]: 24,
  [PRICING_ADDON.directory]: 29,
};

function StepHeader({
  title,
  sub,
  compact,
  callout,
}: {
  title: string;
  sub: string;
  compact?: boolean;
  /** Accent-bordered callout for important trial / plan disclaimers (draws attention above body copy). */
  callout?: { title: string; body: string };
}) {
  return (
    <div style={{ marginBottom: compact ? "20px" : "28px" }}>
      <h2
        style={{
          fontFamily: "'DM Serif Display', serif",
          fontSize: compact ? "22px" : "26px",
          color: DARK,
          margin: "0 0 12px",
          lineHeight: compact ? 1.2 : undefined,
        }}
      >
        {title}
      </h2>
      {callout ? (
        <div
          role="note"
          style={{
            marginBottom: compact ? "14px" : "18px",
            borderRadius: "10px",
            border: "1px solid #e8c4c0",
            borderLeftWidth: "5px",
            borderLeftColor: ACCENT,
            background: "linear-gradient(90deg, #fff9f8 0%, #fdf0ef 38%, #fdf0ef 100%)",
            boxShadow: "0 4px 18px rgba(192, 57, 43, 0.1)",
          }}
        >
          <div style={{ padding: compact ? "12px 14px 12px 12px" : "14px 18px 14px 14px" }}>
            <div
              style={{
                fontSize: compact ? "11px" : "12px",
                fontWeight: "800",
                color: ACCENT,
                letterSpacing: "0.07em",
                marginBottom: "8px",
                fontFamily: "'DM Sans', sans-serif",
              }}
            >
              {callout.title}
            </div>
            <p
              style={{
                margin: 0,
                fontSize: compact ? "13px" : "14px",
                lineHeight: 1.55,
                color: "#4a1f18",
                fontWeight: "600",
                fontFamily: "'DM Sans', sans-serif",
              }}
            >
              {callout.body}
            </p>
          </div>
        </div>
      ) : null}
      {sub.trim() ? (
        <p
          style={{
            color: callout ? "#555" : "#888",
            fontSize: compact ? "13px" : "14px",
            margin: 0,
            lineHeight: 1.5,
            fontWeight: callout ? "500" : "400",
          }}
        >
          {sub}
        </p>
      ) : null}
    </div>
  );
}

const labelStyle: CSSProperties = {
  fontSize: "13px",
  color: "#666",
  marginBottom: "10px",
  display: "block",
  fontWeight: "500",
};

const sectionTitleStyle: CSSProperties = {
  fontSize: "15px",
  fontWeight: "700",
  color: DARK,
  margin: "0 0 14px",
  fontFamily: "'DM Sans', sans-serif",
};

export function PlanRadioCard({
  name,
  priceLabel,
  description,
  selected,
  onSelect,
  fullWidth,
}: {
  name: string;
  priceLabel: string;
  /** Shown under the price on tier cards (landing + signup). */
  description?: string;
  selected: boolean;
  onSelect: () => void;
  /** Stack vertically (e.g. signup on narrow screens). */
  fullWidth?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      style={{
        flex: fullWidth ? "none" : "1 1 160px",
        width: fullWidth ? "100%" : undefined,
        minWidth: 0,
        textAlign: "left",
        padding: "16px 14px",
        borderRadius: "10px",
        border: `2px solid ${selected ? ACCENT : BORDER}`,
        background: selected ? "#fdf0ef" : "#fff",
        cursor: "pointer",
        fontFamily: "'DM Sans', sans-serif",
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          width: "18px",
          height: "18px",
          borderRadius: "50%",
          border: `2px solid ${selected ? ACCENT : "#ccc"}`,
          marginBottom: "10px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {selected ? (
          <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: ACCENT }} />
        ) : null}
      </div>
      <div style={{ fontWeight: "700", fontSize: "14px", color: DARK, marginBottom: "4px" }}>{name}</div>
      <div style={{ fontSize: "18px", fontWeight: "800", color: selected ? ACCENT : DARK, marginBottom: description ? "8px" : 0 }}>
        {priceLabel}
      </div>
      {description ? (
        <p
          style={{
            margin: 0,
            fontSize: "12px",
            lineHeight: 1.5,
            color: "#666",
            fontWeight: "400",
          }}
        >
          {description}
        </p>
      ) : null}
    </button>
  );
}

/** Add-on as a card: interactive (landing with toggles) or read-only (landing informational). */
export function AddonInfoCard({
  title,
  priceLabel,
  description,
  bundleWithPlans,
  selected,
  onSelect = () => {},
  disabled,
  readOnly,
  children,
}: {
  title: string;
  priceLabel: string;
  description: string;
  /** When set (e.g. tier stack section), show which base tiers bundle this before the billing note. */
  bundleWithPlans?: string;
  selected?: boolean;
  onSelect?: () => void;
  disabled?: boolean;
  /** When true, no click — informational only (e.g. marketing pricing section). */
  readOnly?: boolean;
  children?: ReactNode;
}) {
  const sel = !!selected;
  const commonInteractive = {
    width: "100%" as const,
    textAlign: "left" as const,
    padding: "16px 18px",
    borderRadius: "10px",
    boxSizing: "border-box" as const,
    fontFamily: "'DM Sans', sans-serif",
    marginBottom: "12px",
    border: `2px solid ${sel ? ACCENT : BORDER}`,
    background: sel ? "#fdf0ef" : "#fff",
    cursor: disabled ? ("not-allowed" as const) : ("pointer" as const),
    opacity: disabled ? 0.55 : 1,
  };

  const bundleLayout = Boolean(bundleWithPlans);

  if (disabled) {
    return (
      <div style={commonInteractive}>
        <div style={{ fontWeight: "700", fontSize: "15px", color: DARK, marginBottom: "4px" }}>{title}</div>
        {bundleWithPlans ? (
          <p style={{ margin: "0 0 6px", fontSize: "12px", fontWeight: "600", color: ACCENT, lineHeight: 1.45 }}>
            {bundleWithPlans}
          </p>
        ) : null}
        <div
          style={{
            fontSize: bundleLayout ? "12px" : "14px",
            fontWeight: bundleLayout ? "500" : "700",
            color: bundleLayout ? "#555" : ACCENT,
            marginBottom: "8px",
          }}
        >
          {priceLabel}
        </div>
        <p style={{ margin: 0, fontSize: "13px", color: "#666", lineHeight: 1.55 }}>{description}</p>
      </div>
    );
  }

  if (readOnly) {
    return (
      <div
        style={{
          width: "100%",
          textAlign: "left",
          padding: "16px 18px",
          borderRadius: "10px",
          boxSizing: "border-box",
          fontFamily: "'DM Sans', sans-serif",
          marginBottom: "12px",
          border: `1px solid ${BORDER}`,
          background: "#fff",
        }}
      >
        <div style={{ fontWeight: "700", fontSize: "15px", color: DARK, marginBottom: bundleLayout ? "6px" : "4px" }}>{title}</div>
        {bundleWithPlans ? (
          <p style={{ margin: "0 0 6px", fontSize: "12px", fontWeight: "600", color: ACCENT, lineHeight: 1.45 }}>
            {bundleWithPlans}
          </p>
        ) : null}
        <div
          style={{
            fontSize: bundleLayout ? "12px" : "14px",
            fontWeight: bundleLayout ? "500" : "700",
            color: bundleLayout ? "#555" : ACCENT,
            marginBottom: "8px",
          }}
        >
          {priceLabel}
        </div>
        <p style={{ margin: 0, fontSize: "13px", color: "#666", lineHeight: 1.55 }}>{description}</p>
        {children != null ? <div style={{ marginTop: "12px" }}>{children}</div> : null}
      </div>
    );
  }

  return (
    <button type="button" onClick={onSelect} aria-pressed={sel} style={commonInteractive}>
      <div style={{ fontWeight: "700", fontSize: "15px", color: DARK, marginBottom: bundleLayout ? "6px" : "4px" }}>{title}</div>
      {bundleWithPlans ? (
        <p style={{ margin: "0 0 6px", fontSize: "12px", fontWeight: "600", color: ACCENT, lineHeight: 1.45 }}>
          {bundleWithPlans}
        </p>
      ) : null}
      <div
        style={{
          fontSize: bundleLayout ? "12px" : "14px",
          fontWeight: bundleLayout ? "500" : "700",
          color: bundleLayout ? "#555" : ACCENT,
          marginBottom: "8px",
        }}
      >
        {priceLabel}
      </div>
      <p style={{ margin: 0, fontSize: "13px", color: "#666", lineHeight: 1.55 }}>{description}</p>
      {children != null ? <div style={{ marginTop: "14px" }}>{children}</div> : null}
    </button>
  );
}

export function AddonRow({
  title,
  priceLabel,
  bundleHint,
  note,
  checked,
  onToggle,
  disabled,
  children,
}: {
  title: string;
  priceLabel: string;
  /** Which base tiers bundle this; shown under the title on signup. */
  bundleHint?: string;
  note?: string;
  checked: boolean;
  onToggle: () => void;
  disabled?: boolean;
  children?: ReactNode;
}) {
  const uid = useId().replace(/:/g, "");
  const inputId = `pricing-addon-${uid}`;
  return (
    <div
      style={{
        border: `1px solid ${BORDER}`,
        borderRadius: "10px",
        padding: "14px 16px",
        background: "#fff",
        marginBottom: "10px",
        opacity: disabled ? 0.45 : 1,
      }}
    >
      <label
        htmlFor={inputId}
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: "12px",
          cursor: disabled ? "not-allowed" : "pointer",
          margin: 0,
        }}
      >
        <input
          id={inputId}
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={() => {
            if (!disabled) onToggle();
          }}
          style={{
            width: "18px",
            height: "18px",
            marginTop: "2px",
            flexShrink: 0,
            accentColor: ACCENT,
            cursor: disabled ? "not-allowed" : "pointer",
          }}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: "8px" }}>
            <span style={{ fontWeight: "600", fontSize: "14px", color: DARK }}>{title}</span>
            <span style={{ fontSize: "14px", fontWeight: "700", color: ACCENT }}>{priceLabel}</span>
          </div>
          {bundleHint ? (
            <p style={{ margin: "6px 0 0", fontSize: "12px", color: ACCENT, fontWeight: "600", lineHeight: 1.45 }}>
              {bundleHint}
            </p>
          ) : null}
          {note ? (
            <p style={{ margin: "6px 0 0", fontSize: "12px", color: "#888", lineHeight: 1.5 }}>{note}</p>
          ) : null}
        </div>
      </label>
      {children != null ? <div style={{ paddingTop: "12px" }}>{children}</div> : null}
    </div>
  );
}

function fieldOpsExtraCost(employees: number): number {
  return Math.max(0, employees - 5) * 5;
}

/** Add-ons that are included in the selected tier (and must not be billed separately). */
export function effectivePricingAddons(selection: PricingSelection): string[] {
  let a = [...selection.addons];
  if (selection.tier === "plus") a = a.filter((x) => x !== PRICING_ADDON.estimating);
  if (selection.tier === "pro") {
    a = a.filter((x) => x !== PRICING_ADDON.estimating && x !== PRICING_ADDON.portals);
  }
  return a;
}

export function computePricingMonthly(selection: PricingSelection): { total: number; lines: { label: string; amount: number }[] } {
  const lines: { label: string; amount: number }[] = [];
  const tier = selection.tier;
  lines.push({ label: `Core PM${tier === "plus" ? " Plus" : tier === "pro" ? " Pro" : ""}`, amount: TIER_PRICES[tier] });

  for (const id of effectivePricingAddons(selection)) {
    if (id === PRICING_ADDON.fieldOps) {
      lines.push({ label: "Field Ops & Team Payroll (base)", amount: ADDON_PRICES[PRICING_ADDON.fieldOps] });
      const extra = fieldOpsExtraCost(selection.employees);
      if (extra > 0) lines.push({ label: `Additional employees (${selection.employees - 5} × $5)`, amount: extra });
    } else if (ADDON_PRICES[id] != null) {
      const labelMap: Record<string, string> = {
        [PRICING_ADDON.estimating]: "Estimating Suite",
        [PRICING_ADDON.portals]: "Bid & Client Portals",
        [PRICING_ADDON.aiTakeoff]: "AI Material Takeoff",
        [PRICING_ADDON.financial]: "Financial Suite",
        [PRICING_ADDON.vault]: "Document Vault",
        [PRICING_ADDON.directory]: "Directory & Messaging",
      };
      lines.push({ label: labelMap[id] || id, amount: ADDON_PRICES[id] });
    }
  }

  const total = lines.reduce((s, l) => s + l.amount, 0);
  return { total, lines };
}

export function isPricingSelectionValid(sel: PricingSelection | undefined): boolean {
  if (!sel) return false;
  if (sel.tier !== "core" && sel.tier !== "plus" && sel.tier !== "pro") return false;
  if (!Array.isArray(sel.addons)) return false;
  if (typeof sel.employees !== "number" || sel.employees < 1) return false;
  return true;
}

type Upsell = {
  message: string;
  targetTier: PricingTier;
  savings: number;
} | null;

function computeUpsell(selection: PricingSelection): Upsell {
  const { tier } = selection;
  const effective = new Set(effectivePricingAddons(selection));
  const hasEst = effective.has(PRICING_ADDON.estimating);
  const hasPortals = effective.has(PRICING_ADDON.portals);
  if (!hasEst && !hasPortals) return null;

  if (tier === "core" && hasEst) {
    const current = TIER_PRICES.core + ADDON_PRICES[PRICING_ADDON.estimating];
    const next = TIER_PRICES.plus;
    const savings = current - next;
    return {
      message: `Estimating Suite is included in Core PM Plus. You’d pay $${current}/mo on Core with this add-on vs $${next}/mo on Plus — save $${savings}/mo.`,
      targetTier: "plus",
      savings,
    };
  }

  if (tier === "core" && hasPortals && !hasEst) {
    const current = TIER_PRICES.core + ADDON_PRICES[PRICING_ADDON.portals];
    const next = TIER_PRICES.pro;
    const savings = current - next;
    if (savings > 0) {
      return {
        message: `Bid & Client Portals are included in Core PM Pro. Bundle for $${next}/mo instead of $${current}/mo — save $${savings}/mo.`,
        targetTier: "pro",
        savings,
      };
    }
    return {
      message:
        "Upgrade to Core PM Pro to include Bid & Client Portals and Estimating Suite in one tier with simpler billing.",
      targetTier: "pro",
      savings: 0,
    };
  }

  if (tier === "plus" && hasPortals) {
    const current = TIER_PRICES.plus + ADDON_PRICES[PRICING_ADDON.portals];
    const next = TIER_PRICES.pro;
    const savings = current - next;
    return {
      message: `Pro includes portals (and Estimating). Pay $${next}/mo instead of $${current}/mo — save $${savings}/mo.`,
      targetTier: "pro",
      savings,
    };
  }

  return null;
}

export interface PricingStepProps {
  selection: PricingSelection;
  setSelection: (next: PricingSelection | ((prev: PricingSelection) => PricingSelection)) => void;
  /** Passed from signup wizard on narrow screens. */
  compactLayout?: boolean;
  allowAiTakeoffAddon?: boolean;
  /** Optional copy overrides for full-trial signup. */
  stepTitle?: string;
  stepSub?: string;
  /** Highlighted box under the title (e.g. “AI takeoff not included yet”). */
  stepCallout?: { title: string; body: string };
  /** Signup full-trial: no tier/add-on controls — show locked-in line items from `selection` only. */
  readOnlyIncludedSummary?: boolean;
}

export type PricingPickDisplayMode = "checkbox" | "cards";

export const ADDON_CARD_DESCRIPTION: Record<string, string> = {
  [PRICING_ADDON.estimating]:
    "Line-item estimates, markups, grouped scopes, and estimate versions tied to each job — so you can build and revise bids without spreadsheets.",
  [PRICING_ADDON.portals]:
    "Publish bid packages to subs, collect responses in one thread, and send client approval links so approvals and quotes stay auditable.",
  [PRICING_ADDON.financial]:
    "Connect bank activity, tag transactions to jobs, run native invoicing, and see revenue alongside field work in one financial layer.",
  [PRICING_ADDON.fieldOps]:
    "Daily field logs, geofenced clock-in, crew scheduling, roster, and payroll-ready time. First five employee seats are included; additional seats are billed in increments.",
  [PRICING_ADDON.vault]:
    "Centralize plans, contracts, RFIs, and site photos per project so everyone works from the same controlled document set.",
  [PRICING_ADDON.directory]:
    "Keep subs, clients, and internal contacts searchable with roles and history, plus job-aware messaging instead of scattered texts.",
  [PRICING_ADDON.aiTakeoff]:
    "We are still rolling this out — it will not appear as a billable add-on until launch. When live, it will help turn plans into structured quantities and scopes.",
};

export interface PricingPickFormProps extends PricingStepProps {
  /** `cards` = landing (no checkboxes). Default matches signup wizard. */
  displayMode?: PricingPickDisplayMode;
  /** Narrow viewport: stacked plan cards and spacing tuned for phones. */
  compactLayout?: boolean;
  /** When true (e.g. full-trial signup), AI takeoff can stay selected and its row is interactive. */
  allowAiTakeoffAddon?: boolean;
}

/** Shared tier + add-ons + summary UI (signup wizard and landing pricing). */
export function PricingPickForm({
  selection,
  setSelection,
  displayMode = "checkbox",
  compactLayout = false,
  allowAiTakeoffAddon = false,
}: PricingPickFormProps) {
  const useCards = displayMode === "cards";
  const narrow = compactLayout;
  const { tier, addons, employees } = selection;
  const addonSet = useMemo(() => new Set(addons), [addons]);

  /** AI Material Takeoff is shown for awareness but cannot be selected until launch. */
  useLayoutEffect(() => {
    if (useCards || allowAiTakeoffAddon) return;
    if (!addons.includes(PRICING_ADDON.aiTakeoff)) return;
    setSelection((prev) => ({
      ...prev,
      addons: prev.addons.filter((a) => a !== PRICING_ADDON.aiTakeoff),
    }));
  }, [useCards, allowAiTakeoffAddon, addons, setSelection]);

  const setTier = (t: PricingTier) => {
    setSelection((prev) => {
      let nextAddons = [...prev.addons];
      if (t === "plus") nextAddons = nextAddons.filter((a) => a !== PRICING_ADDON.estimating);
      if (t === "pro") {
        nextAddons = nextAddons.filter((a) => a !== PRICING_ADDON.estimating && a !== PRICING_ADDON.portals);
      }
      return { ...prev, tier: t, addons: nextAddons };
    });
  };

  const toggleAddon = (id: string) => {
    setSelection((prev) => {
      const has = prev.addons.includes(id);
      const nextAddons = has ? prev.addons.filter((a) => a !== id) : [...prev.addons, id];
      return { ...prev, addons: nextAddons };
    });
  };

  const upsell = computeUpsell(selection);
  const { total, lines } = computePricingMonthly(selection);
  const fieldOpsOn = addonSet.has(PRICING_ADDON.fieldOps);
  const extraEmpCost = fieldOpsExtraCost(employees);

  const landingCostRange = useMemo(() => {
    if (!useCards) return null;
    const minTotal = computePricingMonthly({ tier, addons: [], employees: 5 }).total;
    const maxTotal = computePricingMonthly({
      tier,
      addons: maxStackAddonsForTier(tier),
      employees: 5,
    }).total;
    return { minTotal, maxTotal };
  }, [useCards, tier]);

  const applyUpsell = () => {
    if (!upsell) return;
    setTier(upsell.targetTier);
  };

  return (
    <>
      <label style={labelStyle}>Base plan</label>
      <div
        style={{
          display: "flex",
          flexDirection: narrow ? "column" : "row",
          flexWrap: narrow ? "nowrap" : "wrap",
          gap: narrow ? "10px" : "12px",
          marginBottom: narrow ? "22px" : "28px",
        }}
      >
        <PlanRadioCard
          name="Core PM"
          priceLabel="$99/mo"
          description={TIER_CARD_DESCRIPTION.core}
          selected={tier === "core"}
          onSelect={() => setTier("core")}
          fullWidth={narrow}
        />
        <PlanRadioCard
          name="Core PM Plus"
          priceLabel="$149/mo"
          description={TIER_CARD_DESCRIPTION.plus}
          selected={tier === "plus"}
          onSelect={() => setTier("plus")}
          fullWidth={narrow}
        />
        <PlanRadioCard
          name="Core PM Pro"
          priceLabel="$199/mo"
          description={TIER_CARD_DESCRIPTION.pro}
          selected={tier === "pro"}
          onSelect={() => setTier("pro")}
          fullWidth={narrow}
        />
      </div>

      {(tier === "core" || tier === "plus") && (
        <>
          <h3 style={{ ...sectionTitleStyle, marginTop: "8px" }}>{TIER_STACK_SECTION_TITLE}</h3>
          <p
            style={{
              margin: "0 0 18px",
              fontSize: "13px",
              lineHeight: 1.55,
              color: "#666",
              fontFamily: "'DM Sans', sans-serif",
            }}
          >
            {TIER_STACK_SECTION_INTRO}
          </p>
          {tier === "core" ? (
            useCards ? (
              <AddonInfoCard
                title="Estimating Suite"
                bundleWithPlans="Included with Core PM Plus and Core PM Pro."
                priceLabel="On Core PM only: billed as a separate line item ($79/mo)."
                description={ADDON_CARD_DESCRIPTION[PRICING_ADDON.estimating]}
                readOnly
              />
            ) : (
              <AddonRow
                title="Estimating Suite"
                priceLabel="$79/mo"
                bundleHint="Included in Core PM Plus & Pro — select to add on Core PM."
                checked={addonSet.has(PRICING_ADDON.estimating)}
                onToggle={() => toggleAddon(PRICING_ADDON.estimating)}
              />
            )
          ) : null}
          {useCards ? (
            <AddonInfoCard
              title="Bid & Client Portals"
              bundleWithPlans="Included with Core PM Pro."
              priceLabel={
                tier === "core"
                  ? "On Core PM or Plus: billed separately ($69/mo), or choose Core PM Pro to bundle."
                  : "On Core PM Plus: billed as a separate line item ($69/mo), or upgrade to Pro to bundle."
              }
              description={ADDON_CARD_DESCRIPTION[PRICING_ADDON.portals]}
              readOnly
            />
          ) : (
            <AddonRow
              title="Bid & Client Portals"
              priceLabel="$69/mo"
              bundleHint={
                tier === "core"
                  ? "Included in Core PM Pro — select to add on Core PM or Plus."
                  : "Included in Core PM Pro — select to add Portals on Plus."
              }
              checked={addonSet.has(PRICING_ADDON.portals)}
              onToggle={() => toggleAddon(PRICING_ADDON.portals)}
            />
          )}

          {upsell && !useCards ? (
            <div
              style={{
                marginTop: "14px",
                marginBottom: "20px",
                padding: "14px 16px",
                borderRadius: "10px",
                border: `1px solid ${ACCENT}`,
                background: "#fff5f4",
              }}
            >
              <p style={{ margin: "0 0 12px", fontSize: "13px", lineHeight: 1.55, color: "#7f2318", fontWeight: "500" }}>
                {upsell.message}
              </p>
              <button
                type="button"
                onClick={applyUpsell}
                style={{
                  padding: "8px 18px",
                  borderRadius: "8px",
                  border: "none",
                  background: ACCENT,
                  color: "#fff",
                  fontSize: "13px",
                  fontWeight: "600",
                  cursor: "pointer",
                  fontFamily: "'DM Sans', sans-serif",
                  width: narrow ? "100%" : undefined,
                  boxSizing: "border-box",
                }}
              >
                Upgrade to {upsell.targetTier === "plus" ? "Core PM Plus" : "Core PM Pro"}
                {upsell.savings > 0 ? ` · Save $${upsell.savings}/mo` : ""}
              </button>
            </div>
          ) : (
            <div style={{ marginBottom: useCards ? "12px" : "20px" }} />
          )}
        </>
      )}

      <h3 style={sectionTitleStyle}>Standalone add-ons</h3>
      {useCards ? (
        <AddonInfoCard
          title="AI Material Takeoff"
          priceLabel="$99/mo (planned)"
          description={ADDON_CARD_DESCRIPTION[PRICING_ADDON.aiTakeoff]}
          readOnly
        />
      ) : (
        <AddonRow
          title="AI Material Takeoff"
          priceLabel={allowAiTakeoffAddon ? "$99/mo" : "$99/mo (planned)"}
          note={
            allowAiTakeoffAddon
              ? "Included with your full trial. Uncheck before your trial ends if you do not want this line on your subscription."
              : "We’re still rolling this out in production — it isn’t offered as an add-on yet. When it’s ready, you’ll be able to add it from billing."
          }
          checked={addonSet.has(PRICING_ADDON.aiTakeoff)}
          disabled={!allowAiTakeoffAddon}
          onToggle={() => toggleAddon(PRICING_ADDON.aiTakeoff)}
        />
      )}
      {useCards ? (
        <AddonInfoCard
          title="Financial Suite"
          priceLabel="$89/mo"
          description={ADDON_CARD_DESCRIPTION[PRICING_ADDON.financial]}
          readOnly
        />
      ) : (
        <AddonRow
          title="Financial Suite"
          priceLabel="$89/mo"
          checked={addonSet.has(PRICING_ADDON.financial)}
          onToggle={() => toggleAddon(PRICING_ADDON.financial)}
        />
      )}
      {useCards ? (
        <AddonInfoCard
          title="Field Ops & Team Payroll"
          priceLabel="$129/mo + $5/employee after 5"
          description={ADDON_CARD_DESCRIPTION[PRICING_ADDON.fieldOps]}
          readOnly
        >
          <p style={{ margin: 0, fontSize: "13px", color: "#15803d", fontWeight: "600", lineHeight: 1.5 }}>
            First five employee seats are included in the base add-on price; each additional seat is $5/mo. You set the
            exact headcount when you subscribe.
          </p>
        </AddonInfoCard>
      ) : (
        <AddonRow
          title="Field Ops & Team Payroll"
          priceLabel="$129/mo + $5/employee after 5"
          checked={fieldOpsOn}
          onToggle={() => toggleAddon(PRICING_ADDON.fieldOps)}
        >
          {fieldOpsOn ? (
            <div style={{ paddingLeft: narrow ? "0" : "30px" }}>
              <span style={{ fontSize: "12px", color: "#666", fontWeight: "600" }}>Employees</span>
              <div style={{ display: "flex", alignItems: "center", gap: "12px", marginTop: "8px" }}>
                <button
                  type="button"
                  onClick={() =>
                    setSelection((p) => ({
                      ...p,
                      employees: Math.max(1, p.employees - 1),
                    }))
                  }
                  style={{
                    width: "36px",
                    height: "36px",
                    borderRadius: "8px",
                    border: `1px solid ${BORDER}`,
                    background: "#fff",
                    fontSize: "18px",
                    cursor: "pointer",
                    fontFamily: "'DM Sans', sans-serif",
                  }}
                >
                  −
                </button>
                <span style={{ fontSize: "16px", fontWeight: "700", color: DARK, minWidth: "28px", textAlign: "center" }}>
                  {employees}
                </span>
                <button
                  type="button"
                  onClick={() => setSelection((p) => ({ ...p, employees: p.employees + 1 }))}
                  style={{
                    width: "36px",
                    height: "36px",
                    borderRadius: "8px",
                    border: `1px solid ${BORDER}`,
                    background: "#fff",
                    fontSize: "18px",
                    cursor: "pointer",
                    fontFamily: "'DM Sans', sans-serif",
                  }}
                >
                  +
                </button>
              </div>
              {extraEmpCost > 0 ? (
                <p style={{ margin: "10px 0 0", fontSize: "13px", color: "#15803d", fontWeight: "600" }}>
                  First 5 employees included · +${extraEmpCost}/mo for {employees - 5} additional seat
                  {employees - 5 === 1 ? "" : "s"}
                </p>
              ) : (
                <p style={{ margin: "10px 0 0", fontSize: "13px", color: "#15803d", fontWeight: "600" }}>
                  First 5 employees included — no extra seat fees at this count.
                </p>
              )}
            </div>
          ) : null}
        </AddonRow>
      )}
      {useCards ? (
        <AddonInfoCard
          title="Document Vault"
          priceLabel="$24/mo"
          description={ADDON_CARD_DESCRIPTION[PRICING_ADDON.vault]}
          readOnly
        />
      ) : (
        <AddonRow
          title="Document Vault"
          priceLabel="$24/mo"
          checked={addonSet.has(PRICING_ADDON.vault)}
          onToggle={() => toggleAddon(PRICING_ADDON.vault)}
        />
      )}
      {useCards ? (
        <AddonInfoCard
          title="Directory & Messaging"
          priceLabel="$29/mo"
          description={ADDON_CARD_DESCRIPTION[PRICING_ADDON.directory]}
          readOnly
        />
      ) : (
        <AddonRow
          title="Directory & Messaging"
          priceLabel="$29/mo"
          checked={addonSet.has(PRICING_ADDON.directory)}
          onToggle={() => toggleAddon(PRICING_ADDON.directory)}
        />
      )}

      {useCards && landingCostRange ? (
        <div style={{ marginTop: "28px" }}>
          <div
            style={{
              border: `1px solid ${BORDER}`,
              borderRadius: "12px",
              background: "#fff",
              padding: "16px 18px",
            }}
          >
            <div style={{ fontSize: "12px", fontWeight: "700", color: ACCENT, letterSpacing: "0.06em", marginBottom: "10px" }}>
              HOW PRICING ADDS UP
            </div>
            <p style={{ margin: 0, fontSize: "14px", color: "#444", lineHeight: 1.6 }}>
              {landingCostRange.minTotal === landingCostRange.maxTotal ? (
                <>
                  <strong style={{ color: DARK }}>{tierMarketingName(tier)}</strong> is{" "}
                  <strong style={{ color: DARK }}>${landingCostRange.minTotal}/mo</strong> with the options shown above
                  (AI Material Takeoff is not included until launch).
                </>
              ) : (
                <>
                  <strong style={{ color: DARK }}>{tierMarketingName(tier)}</strong> starts at{" "}
                  <strong style={{ color: DARK }}>${landingCostRange.minTotal}/mo</strong> for the base plan only. If you
                  add every paid add-on listed for this tier, estimated billing is up to about{" "}
                  <strong style={{ color: DARK }}>${landingCostRange.maxTotal}/mo</strong> with five Field Ops employee
                  seats included; more seats add $5/mo each. AI Material Takeoff is not included until launch.
                </>
              )}
            </p>
            <p style={{ margin: "12px 0 0", fontSize: "12px", color: "#888", lineHeight: 1.45 }}>
              You pick exactly which add-ons to enable when you sign up; amounts are before tax and follow what you
              confirm in Stripe.
            </p>
          </div>
        </div>
      ) : (
        <div
          style={{
            position: "sticky",
            bottom: 0,
            marginTop: "28px",
            paddingTop: "16px",
            paddingBottom: "4px",
            background: "linear-gradient(to top, #F7F6F3 85%, transparent)",
            zIndex: 2,
          }}
        >
          <div
            style={{
              border: `1px solid ${BORDER}`,
              borderRadius: "12px",
              background: "#fff",
              boxShadow: "0 -4px 20px rgba(0,0,0,0.06)",
              padding: "16px 18px",
            }}
          >
            <div style={{ fontSize: "12px", fontWeight: "700", color: ACCENT, letterSpacing: "0.06em", marginBottom: "10px" }}>
              ESTIMATED MONTHLY TOTAL
            </div>
            <ul style={{ listStyle: "none", margin: "0 0 12px", padding: 0 }}>
              {lines.map((l) => (
                <li
                  key={l.label}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: "13px",
                    color: "#555",
                    padding: "4px 0",
                    borderBottom: `1px solid ${BORDER}`,
                  }}
                >
                  <span>{l.label}</span>
                  <span style={{ fontWeight: "600", color: DARK }}>${l.amount}/mo</span>
                </li>
              ))}
            </ul>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <span style={{ fontSize: "15px", fontWeight: "700", color: DARK }}>Total</span>
              <span style={{ fontSize: "22px", fontWeight: "800", color: ACCENT }}>${total}/mo</span>
            </div>
            <p style={{ margin: "10px 0 0", fontSize: "11px", color: "#999", lineHeight: 1.45 }}>
              Estimates for your selections only. Final charges follow the plan you confirm with Stripe on the next steps.
            </p>
          </div>
        </div>
      )}
    </>
  );
}

function ReadOnlyTrialIncludedSummary({
  selection,
  compact,
}: {
  selection: PricingSelection;
  compact?: boolean;
}) {
  const { lines, total } = computePricingMonthly(selection);
  return (
    <div
      style={{
        border: `1px solid ${BORDER}`,
        borderRadius: "10px",
        background: "#fff",
        padding: compact ? "14px 16px" : "18px 20px",
        marginTop: compact ? "4px" : "8px",
      }}
    >
      <div
        style={{
          fontSize: "11px",
          fontWeight: "700",
          color: ACCENT,
          letterSpacing: "0.06em",
          marginBottom: "12px",
          fontFamily: "'DM Sans', sans-serif",
        }}
      >
        FULL ACCESS FOR 30 DAYS — EVERYTHING BELOW IS ON FOR YOUR TRIAL
      </div>
      <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
        {lines.map((l) => (
          <li
            key={l.label}
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: "12px",
              padding: "8px 0",
              borderBottom: `1px solid ${BORDER}`,
              fontSize: "13px",
              color: DARK,
              fontFamily: "'DM Sans', sans-serif",
            }}
          >
            <span style={{ fontWeight: "600" }}>{l.label}</span>
            <span style={{ fontWeight: "700", color: ACCENT, flexShrink: 0 }}>${l.amount}/mo</span>
          </li>
        ))}
      </ul>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          marginTop: "12px",
          paddingTop: "10px",
        }}
      >
        <span style={{ fontSize: "14px", fontWeight: "700", color: DARK }}>Estimated monthly after trial</span>
        <span style={{ fontSize: "20px", fontWeight: "800", color: ACCENT }}>${total}/mo</span>
      </div>
      <p style={{ margin: "10px 0 0", fontSize: "12px", color: "#888", lineHeight: 1.45 }}>
        Nothing to toggle here — this is the plan you&apos;re starting on. You won&apos;t be charged until your trial
        ends; the next step is only to save a card on file.
      </p>
    </div>
  );
}

const DEFAULT_STEP_SUB =
  "Pick a base tier and any add-ons. Next you’ll add a payment method — you won’t be charged until your trial ends.";

export function PricingStep({
  selection,
  setSelection,
  compactLayout,
  allowAiTakeoffAddon,
  stepTitle,
  stepSub,
  stepCallout,
  readOnlyIncludedSummary,
}: PricingStepProps) {
  const narrow = !!compactLayout;
  const resolvedSub = readOnlyIncludedSummary ? (stepSub ?? "") : (stepSub ?? DEFAULT_STEP_SUB);
  return (
    <div style={{ paddingBottom: narrow ? "40px" : "100px" }}>
      <StepHeader title={stepTitle ?? "Choose your plan"} sub={resolvedSub} compact={narrow} callout={stepCallout} />
      {readOnlyIncludedSummary ? (
        <ReadOnlyTrialIncludedSummary selection={selection} compact={narrow} />
      ) : (
        <PricingPickForm
          selection={selection}
          setSelection={setSelection}
          compactLayout={narrow}
          allowAiTakeoffAddon={allowAiTakeoffAddon}
        />
      )}
    </div>
  );
}
