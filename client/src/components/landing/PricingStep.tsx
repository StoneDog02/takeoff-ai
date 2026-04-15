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

const ADDON_PRICES: Record<string, number> = {
  [PRICING_ADDON.estimating]: 79,
  [PRICING_ADDON.portals]: 69,
  [PRICING_ADDON.aiTakeoff]: 99,
  [PRICING_ADDON.financial]: 89,
  [PRICING_ADDON.fieldOps]: 129,
  [PRICING_ADDON.vault]: 24,
  [PRICING_ADDON.directory]: 29,
};

function StepHeader({ title, sub }: { title: string; sub: string }) {
  return (
    <div style={{ marginBottom: "28px" }}>
      <h2 style={{ fontFamily: "'DM Serif Display', serif", fontSize: "26px", color: DARK, margin: "0 0 6px" }}>
        {title}
      </h2>
      <p style={{ color: "#888", fontSize: "14px", margin: 0 }}>{sub}</p>
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
  selected,
  onSelect,
}: {
  name: string;
  priceLabel: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      style={{
        flex: "1 1 160px",
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
      <div style={{ fontSize: "18px", fontWeight: "800", color: selected ? ACCENT : DARK }}>{priceLabel}</div>
    </button>
  );
}

export function AddonRow({
  title,
  priceLabel,
  note,
  checked,
  onToggle,
  disabled,
  children,
}: {
  title: string;
  priceLabel: string;
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
}

export function PricingStep({ selection, setSelection }: PricingStepProps) {
  const { tier, addons, employees } = selection;
  const addonSet = useMemo(() => new Set(addons), [addons]);

  /** AI Material Takeoff is shown for awareness but cannot be selected until launch. */
  useLayoutEffect(() => {
    if (!addons.includes(PRICING_ADDON.aiTakeoff)) return;
    setSelection((prev) => ({
      ...prev,
      addons: prev.addons.filter((a) => a !== PRICING_ADDON.aiTakeoff),
    }));
  }, [addons, setSelection]);

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

  const applyUpsell = () => {
    if (!upsell) return;
    setTier(upsell.targetTier);
  };

  return (
    <div style={{ paddingBottom: "100px" }}>
      <StepHeader
        title="Choose your plan"
        sub="Pick a base tier and any add-ons. Next you’ll add a payment method — you won’t be charged until your trial ends."
      />

      <label style={labelStyle}>Base plan</label>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "12px", marginBottom: "28px" }}>
        <PlanRadioCard
          name="Core PM"
          priceLabel="$99/mo"
          selected={tier === "core"}
          onSelect={() => setTier("core")}
        />
        <PlanRadioCard
          name="Core PM Plus"
          priceLabel="$149/mo"
          selected={tier === "plus"}
          onSelect={() => setTier("plus")}
        />
        <PlanRadioCard
          name="Core PM Pro"
          priceLabel="$199/mo"
          selected={tier === "pro"}
          onSelect={() => setTier("pro")}
        />
      </div>

      {(tier === "core" || tier === "plus") && (
        <>
          <h3 style={{ ...sectionTitleStyle, marginTop: "8px" }}>Optional upgrades</h3>
          {tier === "core" ? (
            <AddonRow
              title="Estimating Suite"
              priceLabel="$79/mo"
              checked={addonSet.has(PRICING_ADDON.estimating)}
              onToggle={() => toggleAddon(PRICING_ADDON.estimating)}
            />
          ) : null}
          <AddonRow
            title="Bid & Client Portals"
            priceLabel="$69/mo"
            checked={addonSet.has(PRICING_ADDON.portals)}
            onToggle={() => toggleAddon(PRICING_ADDON.portals)}
          />

          {upsell ? (
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
                }}
              >
                Upgrade to {upsell.targetTier === "plus" ? "Core PM Plus" : "Core PM Pro"}
                {upsell.savings > 0 ? ` · Save $${upsell.savings}/mo` : ""}
              </button>
            </div>
          ) : (
            <div style={{ marginBottom: "20px" }} />
          )}
        </>
      )}

      <h3 style={sectionTitleStyle}>Standalone add-ons</h3>
      <AddonRow
        title="AI Material Takeoff"
        priceLabel="$99/mo (planned)"
        note="We’re still rolling this out in production — it isn’t offered as an add-on yet. When it’s ready, you’ll be able to add it from billing."
        checked={false}
        disabled
        onToggle={() => {}}
      />
      <AddonRow
        title="Financial Suite"
        priceLabel="$89/mo"
        checked={addonSet.has(PRICING_ADDON.financial)}
        onToggle={() => toggleAddon(PRICING_ADDON.financial)}
      />
      <AddonRow
        title="Field Ops & Team Payroll"
        priceLabel="$129/mo + $5/employee after 5"
        checked={fieldOpsOn}
        onToggle={() => toggleAddon(PRICING_ADDON.fieldOps)}
      >
        {fieldOpsOn ? (
          <div style={{ paddingLeft: "30px" }}>
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
      <AddonRow
        title="Document Vault"
        priceLabel="$24/mo"
        checked={addonSet.has(PRICING_ADDON.vault)}
        onToggle={() => toggleAddon(PRICING_ADDON.vault)}
      />
      <AddonRow
        title="Directory & Messaging"
        priceLabel="$29/mo"
        checked={addonSet.has(PRICING_ADDON.directory)}
        onToggle={() => toggleAddon(PRICING_ADDON.directory)}
      />

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
    </div>
  );
}
