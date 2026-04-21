import { createContext, useContext, useState, useRef, useEffect } from "react";
import type { CSSProperties } from "react";
import { CardElement, useStripe, useElements } from "@stripe/react-stripe-js";
import type { Stripe, StripeElements } from "@stripe/stripe-js";
import { API_BASE } from "@/api/config";
import { LinkBankAccountPanel } from "@/components/stripe/LinkBankAccountPanel";
import { getRecaptchaToken, isRecaptchaConfigured } from "@/lib/recaptcha";
import { buildLineItems } from "@/lib/stripeProducts";
import {
  REFERRAL_STORAGE_KEY,
  clearReferralSignupIntent,
  persistReferralCodeFromManualInput,
  setReferralSignupIntent,
} from "@/lib/referralCapture";
import {
  PricingStep,
  computePricingMonthly,
  effectivePricingAddons,
  isPricingSelectionValid,
  type PricingSelection,
  type PricingTier,
} from "@/components/landing/PricingStep";

export type { PricingTier, PricingSelection } from "@/components/landing/PricingStep";

// ─── Constants ────────────────────────────────────────────────────────────────

const ACCENT = "#C0392B";
const DARK = "#1A1A1A";
const BG = "#F7F6F3";
const BORDER = "#EBEBEB";

const STEPS = [
  { id: 1, label: "Account" },
  { id: 2, label: "Company" },
  { id: 3, label: "Your Role" },
  { id: 4, label: "Contact" },
  { id: 5, label: "Choose Plan" },
  { id: 6, label: "Payment" },
];

const TRADES = [
  "General Contractor", "Electrical", "Plumbing", "HVAC",
  "Framing", "Concrete", "Roofing", "Drywall",
  "Painting", "Flooring", "Masonry", "Other",
];

const ROLES = [
  "Owner / Principal", "Project Manager", "Superintendent",
  "Foreman", "Estimator", "Office Manager",
];

const SIZES = [
  "1–5 employees", "6–20 employees", "21–50 employees",
  "51–100 employees", "100+ employees",
];

/** Matches other app breakpoints (e.g. directory tabs). */
const SIGNUP_MOBILE_MQ = "(max-width: 768px)";

const SignupMobileContext = createContext(false);

function useIsSignupMobile(): boolean {
  const [mobile, setMobile] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia(SIGNUP_MOBILE_MQ).matches : false,
  );
  useEffect(() => {
    const mq = window.matchMedia(SIGNUP_MOBILE_MQ);
    const apply = () => setMobile(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);
  return mobile;
}

// ─── Types ────────────────────────────────────────────────────────────────────

/** Plan from Stripe (product + price). id is the Stripe price_id. */
export interface SignupPlan {
  id: string;
  name: string;
  amount: number;
  currency: string;
  interval: "month" | "year";
  formatted: string;
}

export interface SignupWizardForm {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  confirmPassword: string;
  /** Optional referral code (also captured from ?ref= into localStorage). */
  referralCode: string;
  company: string;
  companySize: string;
  license: string;
  trades: string[];
  role: string;
  phone: string;
  contactPref: string;
  /** Configurator selections (tier, add-ons, payroll seats). */
  pricingSelection: PricingSelection;
  plan: string;
  cardName: string;
  cardNumber: string;
  expiry: string;
  cvc: string;
}

// ─── Shared Styles ─────────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 14px",
  borderRadius: "8px",
  border: `1px solid ${BORDER}`,
  background: "#fff",
  fontSize: "14px",
  fontFamily: "'DM Sans', sans-serif",
  color: DARK,
  outline: "none",
  boxSizing: "border-box",
};

const labelStyle: React.CSSProperties = {
  fontSize: "13px",
  color: "#666",
  marginBottom: "6px",
  display: "block",
  fontWeight: "500",
};

const btnPrimaryStyle: React.CSSProperties = {
  padding: "9px 28px",
  borderRadius: "8px",
  border: "none",
  background: ACCENT,
  color: "#fff",
  cursor: "pointer",
  fontSize: "13px",
  fontWeight: "600",
  fontFamily: "'DM Sans', sans-serif",
};

const btnSecondaryStyle: React.CSSProperties = {
  padding: "9px 22px",
  borderRadius: "8px",
  border: `1px solid ${BORDER}`,
  background: "#fff",
  cursor: "pointer",
  fontSize: "13px",
  color: "#555",
  fontFamily: "'DM Sans', sans-serif",
  fontWeight: "500",
};

function mergeInputStyle(isMobile: boolean, extra?: CSSProperties): CSSProperties {
  return {
    ...inputStyle,
    ...(isMobile ? { fontSize: "16px", padding: "12px 16px", minHeight: "48px" } : {}),
    ...extra,
  };
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function Field({ label, children, error }: { label: string; children: React.ReactNode; error?: string }) {
  return (
    <div style={{ marginBottom: "20px" }}>
      <label style={labelStyle}>{label}</label>
      {children}
      {error && (
        <p style={{ fontSize: "12px", color: ACCENT, marginTop: "6px", marginBottom: 0 }}>{error}</p>
      )}
    </div>
  );
}

function StepHeader({ title, sub }: { title: string; sub: string }) {
  const isMobile = useContext(SignupMobileContext);
  return (
    <div style={{ marginBottom: isMobile ? "22px" : "32px" }}>
      <h2
        style={{
          fontFamily: "'DM Serif Display', serif",
          fontSize: isMobile ? "22px" : "26px",
          color: DARK,
          margin: "0 0 6px",
          lineHeight: isMobile ? 1.2 : undefined,
        }}
      >
        {title}
      </h2>
      <p style={{ color: "#888", fontSize: isMobile ? "13px" : "14px", margin: 0, lineHeight: 1.45 }}>{sub}</p>
    </div>
  );
}

function SelectTile({ label, selected, onClick }: { label: string; selected: boolean; onClick: () => void }) {
  const isMobile = useContext(SignupMobileContext);
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: isMobile ? "12px 14px" : "10px 14px",
        borderRadius: "8px",
        border: `1px solid ${selected ? ACCENT : BORDER}`,
        background: selected ? "#fdf0ef" : "#fff",
        color: selected ? ACCENT : "#333",
        cursor: "pointer",
        fontSize: "13px",
        fontFamily: "'DM Sans', sans-serif",
        fontWeight: selected ? "600" : "400",
        textAlign: "left",
      }}
    >
      {label}
    </button>
  );
}

function Pill({ label, selected, onClick }: { label: string; selected: boolean; onClick: () => void }) {
  const isMobile = useContext(SignupMobileContext);
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: isMobile ? "10px 16px" : "8px 16px",
        borderRadius: "999px",
        border: `1px solid ${selected ? ACCENT : BORDER}`,
        background: selected ? "#fdf0ef" : "#fff",
        color: selected ? ACCENT : "#444",
        cursor: "pointer",
        fontSize: "13px",
        fontFamily: "'DM Sans', sans-serif",
        fontWeight: selected ? "600" : "400",
      }}
    >
      {label}
    </button>
  );
}

// ─── Step 1: Account ───────────────────────────────────────────────────────────

type Step1Errors = Partial<Record<"firstName" | "lastName" | "email" | "password" | "confirmPassword", string>>;

function Step1({
  form,
  upd,
  errors,
  onClearError,
}: {
  form: SignupWizardForm;
  upd: (key: keyof SignupWizardForm, value: string) => void;
  errors: Step1Errors;
  onClearError: (field: keyof Step1Errors) => void;
}) {
  const [showPass, setShowPass] = useState(false);
  const [referralOpen, setReferralOpen] = useState(false);

  useEffect(() => {
    if (form.referralCode?.trim()) setReferralOpen(true);
  }, [form.referralCode]);

  const isMobile = useContext(SignupMobileContext);

  return (
    <div>
      <StepHeader title="Create your account" sub="Start with your login credentials" />
      <div
        style={{
          display: "grid",
          gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
          gap: isMobile ? "0" : "16px",
        }}
      >
        <Field label="First name" error={errors.firstName}>
          <input
            style={mergeInputStyle(isMobile, { ...(errors.firstName ? { borderColor: ACCENT } : {}) })}
            placeholder="John"
            value={form.firstName}
            onChange={(e) => { upd("firstName", e.target.value); onClearError("firstName"); }}
          />
        </Field>
        <Field label="Last name" error={errors.lastName}>
          <input
            style={mergeInputStyle(isMobile, { ...(errors.lastName ? { borderColor: ACCENT } : {}) })}
            placeholder="Smith"
            value={form.lastName}
            onChange={(e) => { upd("lastName", e.target.value); onClearError("lastName"); }}
          />
        </Field>
      </div>
      <Field label="Email address" error={errors.email}>
        <input
          style={mergeInputStyle(isMobile, { ...(errors.email ? { borderColor: ACCENT } : {}) })}
          type="email"
          placeholder="john@smithconstruction.com"
          value={form.email}
          onChange={(e) => { upd("email", e.target.value); onClearError("email"); }}
        />
      </Field>
      <Field label="Password" error={errors.password}>
        <div style={{ position: "relative" }}>
          <input
            style={mergeInputStyle(isMobile, {
              paddingRight: "60px",
              ...(errors.password ? { borderColor: ACCENT } : {}),
            })}
            type={showPass ? "text" : "password"}
            placeholder="Min. 8 characters"
            value={form.password}
            onChange={(e) => { upd("password", e.target.value); onClearError("password"); onClearError("confirmPassword"); }}
          />
          <button
            type="button"
            onClick={() => setShowPass((p) => !p)}
            style={{
              position: "absolute", right: "12px", top: "50%",
              transform: "translateY(-50%)", background: "none",
              border: "none", cursor: "pointer", color: "#888",
              fontSize: "12px", fontFamily: "'DM Sans', sans-serif",
            }}
          >
            {showPass ? "Hide" : "Show"}
          </button>
        </div>
      </Field>
      <Field label="Confirm password" error={errors.confirmPassword}>
        <div style={{ position: "relative" }}>
          <input
            style={mergeInputStyle(isMobile, {
              paddingRight: "60px",
              ...(errors.confirmPassword ? { borderColor: ACCENT } : {}),
            })}
            type={showPass ? "text" : "password"}
            placeholder="Re-enter your password"
            value={form.confirmPassword}
            onChange={(e) => { upd("confirmPassword", e.target.value); onClearError("confirmPassword"); }}
          />
          <button
            type="button"
            onClick={() => setShowPass((p) => !p)}
            style={{
              position: "absolute", right: "12px", top: "50%",
              transform: "translateY(-50%)", background: "none",
              border: "none", cursor: "pointer", color: "#888",
              fontSize: "12px", fontFamily: "'DM Sans', sans-serif",
            }}
          >
            {showPass ? "Hide" : "Show"}
          </button>
        </div>
      </Field>
      <div style={{ marginTop: "8px", marginBottom: "8px" }}>
        {!referralOpen ? (
          <button
            type="button"
            onClick={() => setReferralOpen(true)}
            style={{
              background: "none",
              border: "none",
              padding: 0,
              cursor: "pointer",
              fontSize: "13px",
              color: ACCENT,
              fontFamily: "'DM Sans', sans-serif",
              fontWeight: 600,
              textDecoration: "underline",
              textUnderlineOffset: "3px",
            }}
          >
            Have a referral code? (optional)
          </button>
        ) : (
          <Field label="Referral code (optional)">
            <input
              style={mergeInputStyle(isMobile)}
              placeholder="e.g. BRETTA4K2"
              value={form.referralCode}
              onChange={(e) => upd("referralCode", e.target.value.toUpperCase())}
              autoComplete="off"
              spellCheck={false}
            />
          </Field>
        )}
      </div>
      <p style={{ fontSize: "12px", color: "#aaa", marginTop: "-8px" }}>
        By continuing, you agree to our Terms of Service and Privacy Policy.
      </p>
    </div>
  );
}

// ─── Step 2: Company ───────────────────────────────────────────────────────────

type Step2Errors = Partial<Record<"company" | "companySize", string>>;

function Step2({
  form,
  upd,
  errors,
  onClearError,
}: {
  form: SignupWizardForm;
  upd: (key: keyof SignupWizardForm, value: string) => void;
  errors: Step2Errors;
  onClearError: (field: keyof Step2Errors) => void;
}) {
  const isMobile = useContext(SignupMobileContext);
  return (
    <div>
      <StepHeader title="Tell us about your company" sub="We'll tailor Takeoff to fit your operation" />
      <Field label="Company name" error={errors.company}>
        <input
          style={mergeInputStyle(isMobile, { ...(errors.company ? { borderColor: ACCENT } : {}) })}
          placeholder="Smith Construction LLC"
          value={form.company}
          onChange={(e) => { upd("company", e.target.value); onClearError("company"); }}
        />
      </Field>
      <Field label="Company size" error={errors.companySize}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
            gap: "10px",
            ...(errors.companySize ? { padding: "12px", borderRadius: "8px", border: `1px solid ${ACCENT}` } : {}),
          }}
        >
          {SIZES.map((s) => (
            <SelectTile
              key={s}
              label={s}
              selected={form.companySize === s}
              onClick={() => { upd("companySize", s); onClearError("companySize"); }}
            />
          ))}
        </div>
      </Field>
      <Field label="Business license number (optional)">
        <input
          style={mergeInputStyle(isMobile)}
          placeholder="e.g. GC-1043892"
          value={form.license || ""}
          onChange={(e) => upd("license", e.target.value)}
        />
      </Field>
    </div>
  );
}

// ─── Step 3: Role ──────────────────────────────────────────────────────────────

type Step3Errors = Partial<Record<"trades" | "role", string>>;

function Step3({
  form,
  upd,
  toggleTrade,
  errors,
  onClearError,
}: {
  form: SignupWizardForm;
  upd: (key: keyof SignupWizardForm, value: string) => void;
  toggleTrade: (t: string) => void;
  errors: Step3Errors;
  onClearError: (field: keyof Step3Errors) => void;
}) {
  const isMobile = useContext(SignupMobileContext);
  return (
    <div>
      <StepHeader title="What's your trade?" sub="Select all that apply — you can change this later" />
      <Field label="Trade type(s)" error={errors.trades}>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "8px",
            ...(errors.trades ? { padding: "12px", borderRadius: "8px", border: `1px solid ${ACCENT}` } : {}),
          }}
        >
          {TRADES.map((t) => (
            <Pill
              key={t}
              label={t}
              selected={form.trades.includes(t)}
              onClick={() => { toggleTrade(t); onClearError("trades"); }}
            />
          ))}
        </div>
      </Field>
      <Field label="Your role at the company" error={errors.role}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
            gap: "10px",
            ...(errors.role ? { padding: "12px", borderRadius: "8px", border: `1px solid ${ACCENT}` } : {}),
          }}
        >
          {ROLES.map((r) => (
            <SelectTile
              key={r}
              label={r}
              selected={form.role === r}
              onClick={() => { upd("role", r); onClearError("role"); }}
            />
          ))}
        </div>
      </Field>
    </div>
  );
}

// ─── Step 4: Contact ───────────────────────────────────────────────────────────

type Step4Errors = Partial<Record<"phone" | "contactPref", string>>;

function Step4({
  form,
  upd,
  errors,
  onClearError,
}: {
  form: SignupWizardForm;
  upd: (key: keyof SignupWizardForm, value: string) => void;
  errors: Step4Errors;
  onClearError: (field: keyof Step4Errors) => void;
}) {
  const isMobile = useContext(SignupMobileContext);
  const formatPhone = (v: string) => {
    const d = v.replace(/\D/g, "").slice(0, 10);
    if (d.length < 4) return d;
    if (d.length < 7) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
    return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  };

  return (
    <div>
      <StepHeader title="Contact info" sub="We'll use this for account notifications and support" />
      <Field label="Phone number" error={errors.phone}>
        <input
          style={mergeInputStyle(isMobile, { ...(errors.phone ? { borderColor: ACCENT } : {}) })}
          type="tel"
          placeholder="(801) 555-0123"
          value={form.phone}
          onChange={(e) => { upd("phone", formatPhone(e.target.value)); onClearError("phone"); }}
        />
      </Field>
      <Field label="Preferred contact method" error={errors.contactPref}>
        <div
          style={{
            display: "flex",
            flexDirection: isMobile ? "column" : "row",
            gap: "10px",
            ...(errors.contactPref ? { padding: "12px", borderRadius: "8px", border: `1px solid ${ACCENT}` } : {}),
          }}
        >
          {["Email", "Phone", "SMS"].map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => { upd("contactPref", m); onClearError("contactPref"); }}
              style={{
                flex: isMobile ? "none" : 1,
                width: isMobile ? "100%" : undefined,
                padding: isMobile ? "12px 10px" : "10px",
                borderRadius: "8px",
                border: `1px solid ${form.contactPref === m ? ACCENT : BORDER}`,
                background: form.contactPref === m ? "#fdf0ef" : "#fff",
                color: form.contactPref === m ? ACCENT : "#444",
                cursor: "pointer", fontSize: "13px",
                fontFamily: "'DM Sans', sans-serif",
                fontWeight: form.contactPref === m ? "600" : "400",
              }}
            >
              {m}
            </button>
          ))}
        </div>
      </Field>
      <div
        style={{
          background: "#fff",
          border: `1px solid ${BORDER}`,
          borderRadius: "10px",
          padding: isMobile ? "14px 16px" : "16px 20px",
        }}
      >
        <p style={{ fontSize: isMobile ? "12px" : "13px", color: "#888", margin: 0, lineHeight: "1.6" }}>
          🔒 Your contact information is never sold or shared with third parties. We'll only reach out about your account or important platform updates.
        </p>
      </div>
    </div>
  );
}

function pricingTierLabel(tier: PricingTier): string {
  switch (tier) {
    case "core":
      return "Core PM";
    case "plus":
      return "Core PM Plus";
    case "pro":
      return "Core PM Pro";
  }
}

const PAYMENT_ADDON_LABELS: Record<string, string> = {
  estimating: "Estimating Suite",
  portals: "Bid & Client Portals",
  "ai-takeoff": "AI Material Takeoff",
  financial: "Financial Suite",
  "field-ops": "Field Ops & Payroll",
  fieldpayroll: "Field Ops & Payroll",
  vault: "Document Vault",
  directory: "Directory & Messaging",
};

// ─── Step 6: Payment (Stripe Card Element) ───────────────────────────────────────

type StepPaymentErrors = Partial<Record<"card", string>>;

/** Referral code from form or ?ref= localStorage (same source as apply-referral after signup). */
function getActiveReferralCode(form: SignupWizardForm): string {
  const fromForm = form.referralCode?.trim() ?? "";
  if (fromForm) return fromForm;
  try {
    return typeof window !== "undefined" ? (localStorage.getItem(REFERRAL_STORAGE_KEY) || "").trim() : "";
  } catch {
    return "";
  }
}

/** 10% off first paid subscription invoice — estimate for display only (amount = cents). */
function formatEstimatedFirstInvoiceAfterReferral(plan: {
  amount: number;
  currency: string;
  interval: "month" | "year";
}): string {
  const afterCents = Math.round(plan.amount * 0.9);
  const sym = plan.currency?.toLowerCase() === "usd" ? "$" : "";
  const amt = (afterCents / 100).toFixed(afterCents % 100 === 0 ? 0 : 2);
  const suffix = plan.interval === "year" ? "/yr" : "/mo";
  return `${sym}${amt}${suffix}`;
}

function StepPayment({
  form,
  errors,
  onClearError,
  onStripeReady,
  onCardChange,
}: {
  form: SignupWizardForm;
  errors: StepPaymentErrors;
  onClearError: (field: keyof StepPaymentErrors) => void;
  onStripeReady: (stripe: Stripe | null, elements: StripeElements | null) => void;
  onCardChange: (complete: boolean) => void;
}) {
  const stripe = useStripe();
  const elements = useElements();

  useEffect(() => {
    onStripeReady(stripe ?? null, elements ?? null);
  }, [stripe, elements, onStripeReady]);

  const { total } = computePricingMonthly(form.pricingSelection);
  const planName = pricingTierLabel(form.pricingSelection.tier);
  const formattedTotal = `$${total}/mo`;
  const billedAddonIds = effectivePricingAddons(form.pricingSelection);
  const packageCount = billedAddonIds.length;
  const addonSummary =
    billedAddonIds.length > 0
      ? billedAddonIds.map((id) => PAYMENT_ADDON_LABELS[id] || id).join(" · ")
      : null;
  const referralPlanForEstimate = {
    amount: total * 100,
    currency: "usd",
    interval: "month" as const,
  };
  const referralCode = getActiveReferralCode(form);
  const hasReferral = Boolean(referralCode);
  const isMobile = useContext(SignupMobileContext);

  return (
    <div>
      <StepHeader title="Payment details" sub="Secured by Stripe. Your card won't be charged until your trial ends." />

      {/* Plan summary */}
      <div style={{
        padding: "12px 16px", borderRadius: "8px",
        background: "#fdf0ef", border: `1px solid ${ACCENT}`, marginBottom: "20px",
      }}>
        <div style={{
          display: "flex",
          flexDirection: isMobile ? "column" : "row",
          alignItems: isMobile ? "stretch" : "center",
          justifyContent: "space-between",
          gap: isMobile ? "12px" : "8px",
        }}>
          <div>
            <div style={{ fontSize: "11px", color: ACCENT, fontWeight: "600", marginBottom: "2px" }}>
              SELECTED PLAN
            </div>
            <div style={{ fontWeight: "700", color: DARK, fontSize: "15px", lineHeight: 1.35 }}>
              {planName}
              {packageCount > 0 ? (
                <span style={{ fontWeight: "600", color: "#8a382e", fontSize: "13px" }}>
                  {" "}
                  · +{packageCount} {packageCount === 1 ? "package" : "packages"}
                </span>
              ) : null}
            </div>
            {addonSummary ? (
              <p
                style={{
                  margin: "8px 0 0",
                  fontSize: "12px",
                  color: "#666",
                  lineHeight: 1.45,
                  maxWidth: isMobile ? "none" : "420px",
                }}
              >
                Includes: {addonSummary}
              </p>
            ) : null}
          </div>
          <div style={{ textAlign: isMobile ? "left" : "right", flexShrink: 0 }}>
            <div style={{ fontSize: "20px", fontWeight: "700", color: ACCENT }}>
              {formattedTotal}
            </div>
            <div style={{ fontSize: "12px", color: "#888" }}>est. monthly after trial</div>
          </div>
        </div>

        {hasReferral && total > 0 && (
          <div
            style={{
              marginTop: "14px",
              paddingTop: "14px",
              borderTop: "1px solid rgba(192, 57, 43, 0.25)",
            }}
          >
            <div style={{ fontSize: "11px", color: "#15803d", fontWeight: "700", letterSpacing: "0.04em", marginBottom: "6px" }}>
              REFERRAL DISCOUNT
            </div>
            <p style={{ margin: "0 0 8px", fontSize: "13px", lineHeight: 1.45, color: DARK }}>
              You&apos;re signing up with referral code{" "}
              <strong style={{ fontFamily: "ui-monospace, monospace", letterSpacing: "0.02em" }}>{referralCode}</strong>.
              You can get <strong>10% off</strong> your <strong>first paid subscription invoice</strong> after your trial
              ends (when your plan bills — not the $0 trial).
            </p>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                alignItems: "baseline",
                justifyContent: "space-between",
                gap: "8px",
                padding: "10px 12px",
                borderRadius: "6px",
                background: "rgba(22, 163, 74, 0.08)",
                border: "1px solid rgba(22, 163, 74, 0.35)",
              }}
            >
              <span style={{ fontSize: "12px", color: "#166534", fontWeight: "600" }}>Estimated first paid invoice</span>
              <span style={{ fontSize: "16px", fontWeight: "800", color: "#15803d" }}>
                ~{formatEstimatedFirstInvoiceAfterReferral(referralPlanForEstimate)}{" "}
                <span style={{ fontSize: "11px", fontWeight: "600", color: "#166534" }}>(after 10% off)</span>
              </span>
            </div>
            <p style={{ margin: "8px 0 0", fontSize: "11px", lineHeight: 1.4, color: "#888" }}>
              Actual discount is applied when your subscription invoice is created; you&apos;ll also see it on your Stripe invoice and in the app.
            </p>
          </div>
        )}
      </div>

      <Field label="Card details" error={errors.card}>
        <div
          style={{
            padding: "12px 14px",
            borderRadius: "8px",
            border: `1px solid ${errors.card ? ACCENT : BORDER}`,
            background: "#fff",
          }}
        >
          <CardElement
            options={{
              style: {
                base: {
                  fontSize: isMobile ? "16px" : "14px",
                  fontFamily: "'DM Sans', sans-serif",
                  color: DARK,
                },
              },
            }}
            onChange={(e) => {
              onCardChange(e.complete && !e.error);
              if (e.complete || e.error) onClearError("card");
            }}
          />
        </div>
      </Field>

      <div style={{
        display: "flex", alignItems: "flex-start", gap: "8px",
        marginTop: "4px", padding: "12px 16px",
        background: "#fff", borderRadius: "8px", border: `1px solid ${BORDER}`,
        flexWrap: isMobile ? "wrap" : "nowrap",
      }}>
        <span style={{ color: "#22a06b", fontSize: "16px", flexShrink: 0 }}>🔒</span>
        <span style={{ fontSize: "12px", color: "#888", lineHeight: 1.45 }}>
          256-bit SSL encryption · Powered by Stripe · Cancel anytime
        </span>
      </div>

      <LinkBankAccountPanel variant="signup" signupEmail={form.email} />
    </div>
  );
}

// ─── Post-signup: Check your email ───────────────────────────────────────────────

function CheckEmailScreen({ email }: { email: string }) {
  const isMobile = useContext(SignupMobileContext);
  return (
    <div style={{ textAlign: "center", padding: isMobile ? "28px 16px 40px" : "60px 40px" }}>
      <div style={{
        width: "64px", height: "64px", borderRadius: "50%",
        background: "#e8f5e9", border: "2px solid #4caf50",
        display: "flex", alignItems: "center", justifyContent: "center",
        margin: "0 auto 24px", fontSize: "28px", color: "#2e7d32",
      }}>
        ✉
      </div>
      <h2
        style={{
          fontFamily: "'DM Serif Display', serif",
          fontSize: isMobile ? "24px" : "28px",
          color: DARK,
          margin: "0 0 12px",
          lineHeight: 1.2,
        }}
      >
        Check your email
      </h2>
      <p style={{ color: "#666", fontSize: isMobile ? "14px" : "15px", maxWidth: "380px", margin: "0 auto 16px", lineHeight: "1.7" }}>
        We've sent a verification link to <strong style={{ color: DARK }}>{email}</strong>.
      </p>
      <p style={{ color: "#888", fontSize: isMobile ? "13px" : "14px", maxWidth: "360px", margin: "0 auto 32px", lineHeight: "1.6" }}>
        Click the link in that email to verify your account. Once verified, you'll be taken straight to your dashboard.
      </p>
      <p style={{ color: "#999", fontSize: "13px" }}>
        Didn't get the email? Check your spam folder or try signing up again.
      </p>
    </div>
  );
}

// ─── Mobile progress header (replaces sidebar on narrow screens) ───────────────

function MobileSignupHeader({ currentStep, complete }: { currentStep: number; complete?: boolean }) {
  return (
    <div
      style={{
        flexShrink: 0,
        background: DARK,
        padding: "12px 16px",
        paddingTop: "max(12px, env(safe-area-inset-top, 0px))",
        borderBottom: "1px solid #2a2a2a",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: "12px",
          marginBottom: complete ? 0 : "10px",
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div style={{ color: ACCENT, fontSize: "16px", fontWeight: "700", letterSpacing: "1px" }}>TAKEOFF</div>
          <div style={{ color: "#555", fontSize: "10px", marginTop: "2px" }}>Construction Management</div>
        </div>
        {complete ? (
          <div style={{ fontSize: "12px", color: "#a5d6a7", fontWeight: "600", textAlign: "right", flexShrink: 0 }}>
            Almost there
          </div>
        ) : (
          <div style={{ textAlign: "right", flexShrink: 0 }}>
            <div style={{ fontSize: "11px", color: "#888", fontWeight: "600" }}>
              Step {currentStep} of {STEPS.length}
            </div>
            <div style={{ fontSize: "12px", color: "#fff", fontWeight: "600", marginTop: "2px" }}>
              {STEPS[currentStep - 1]?.label ?? ""}
            </div>
          </div>
        )}
      </div>
      {!complete && (
        <div style={{ display: "flex", gap: "4px" }}>
          {STEPS.map((s) => (
            <div
              key={s.id}
              style={{
                flex: 1,
                height: "3px",
                borderRadius: "2px",
                background: currentStep > s.id ? ACCENT : currentStep === s.id ? ACCENT : "#333",
                opacity: currentStep >= s.id ? 1 : 0.35,
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Sidebar ────────────────────────────────────────────────────────────────────

function Sidebar({ currentStep }: { currentStep: number }) {
  return (
    <div style={{
      width: "220px", flexShrink: 0, background: DARK,
      padding: "28px 20px", display: "flex", flexDirection: "column",
    }}>
      <div style={{ marginBottom: "36px" }}>
        <div style={{ color: ACCENT, fontSize: "18px", fontWeight: "700", letterSpacing: "1px" }}>
          TAKEOFF
        </div>
        <div style={{ color: "#555", fontSize: "11px", marginTop: "3px" }}>
          Construction Management
        </div>
      </div>

      <div style={{ flex: 1 }}>
        {STEPS.map((s, i) => (
          <div key={s.id} style={{ display: "flex", alignItems: "flex-start", gap: "10px", marginBottom: "4px" }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
              <div style={{
                width: "24px", height: "24px", borderRadius: "50%",
                background: currentStep > s.id ? ACCENT : currentStep === s.id ? ACCENT : "#2a2a2a",
                border: currentStep >= s.id ? "none" : "1px solid #333",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "10px", fontWeight: "700",
                color: currentStep >= s.id ? "#fff" : "#555",
              }}>
                {currentStep > s.id ? "✓" : s.id}
              </div>
              {i < STEPS.length - 1 && (
                <div style={{
                  width: "1px", height: "24px",
                  background: currentStep > s.id ? ACCENT : "#2a2a2a",
                  margin: "4px 0",
                }} />
              )}
            </div>
            <div style={{ paddingTop: "3px" }}>
              <div style={{
                fontSize: "12px",
                fontWeight: currentStep === s.id ? "600" : "400",
                color: currentStep >= s.id ? "#fff" : "#444",
                lineHeight: "1.3",
              }}>
                {s.label}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ borderTop: "1px solid #2a2a2a", paddingTop: "14px" }}>
        <div style={{ color: "#444", fontSize: "11px" }}>Need help?</div>
        <div style={{ color: ACCENT, fontSize: "11px", marginTop: "2px" }}>support@takeoff.com</div>
      </div>
    </div>
  );
}

// ─── Main Wizard ────────────────────────────────────────────────────────────────

export interface SignupWizardProps {
  /** Called when user completes the payment step (signup). Return error message to show, or undefined on success. */
  onSignUp: (
    form: SignupWizardForm,
    ctx?: { stripeCustomerId?: string },
  ) => Promise<string | undefined>;
  /** Optional: called when user would have gone to dashboard (e.g. if email confirm is disabled). */
  onGoToDashboard?: (form: SignupWizardForm) => void;
}

export default function SignupWizard({ onSignUp }: SignupWizardProps) {
  const isMobile = useIsSignupMobile();
  const [step, setStep] = useState(1);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<SignupWizardForm>({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    confirmPassword: "",
    referralCode: "",
    company: "",
    companySize: "",
    license: "",
    trades: [],
    role: "",
    phone: "",
    contactPref: "",
    pricingSelection: { tier: "core", addons: [], employees: 5 },
    plan: "",
    cardName: "",
    cardNumber: "",
    expiry: "",
    cvc: "",
  });

  useEffect(() => {
    try {
      const stored = localStorage.getItem(REFERRAL_STORAGE_KEY)?.trim();
      if (stored) {
        setForm((f) => ({ ...f, referralCode: stored }));
      }
    } catch {
      // ignore
    }
  }, []);

  const upd = (key: keyof SignupWizardForm, value: string) => setForm((f) => ({ ...f, [key]: value }));

  const toggleTrade = (t: string) =>
    setForm((f) => ({
      ...f,
      trades: f.trades.includes(t) ? f.trades.filter((x) => x !== t) : [...f.trades, t],
    }));

  const [step1Errors, setStep1Errors] = useState<Step1Errors>({});

  const validateStep1 = (): Step1Errors => {
    const trim = (s: string) => s.trim();
    const err: Step1Errors = {};
    if (!trim(form.firstName)) err.firstName = "Please enter your first name.";
    if (!trim(form.lastName)) err.lastName = "Please enter your last name.";
    if (!trim(form.email)) err.email = "Please enter your email address.";
    else {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(trim(form.email))) err.email = "Please enter a valid email address.";
    }
    if (!form.password) err.password = "Please enter a password.";
    else if (form.password.length < 8) err.password = "Password must be at least 8 characters.";
    if (!form.confirmPassword) err.confirmPassword = "Please confirm your password.";
    else if (form.password !== form.confirmPassword) err.confirmPassword = "Passwords do not match.";
    return err;
  };

  const handleStepNext = async () => {
    if (step === 1) {
      const errs = validateStep1();
      const hasErrors = Object.keys(errs).length > 0;
      setStep1Errors(errs);
      if (hasErrors) return;
      setStep1Errors({});
      const email = form.email.trim();
      if (email) {
        try {
          const res = await fetch(
            `${API_BASE}/auth/check-email?email=${encodeURIComponent(email)}`
          );
          const data = (await res.json().catch(() => ({}))) as { exists?: boolean };
          if (data.exists) {
            setStep1Errors({
              email: "An account with this email already exists. Sign in instead.",
            });
            return;
          }
        } catch {
          // On network error, allow continue; signUp may still fail with a message if duplicate
        }
      }
    }
    if (step === 2) {
      const errs = validateStep2();
      const hasErrors = Object.keys(errs).length > 0;
      setStep2Errors(errs);
      if (hasErrors) return;
      setStep2Errors({});
    }
    if (step === 3) {
      const errs = validateStep3();
      const hasErrors = Object.keys(errs).length > 0;
      setStep3Errors(errs);
      if (hasErrors) return;
      setStep3Errors({});
    }
    if (step === 4) {
      const errs = validateStep4();
      const hasErrors = Object.keys(errs).length > 0;
      setStep4Errors(errs);
      if (hasErrors) return;
      setStep4Errors({});
    }
    if (step === 5) {
      if (!isPricingSelectionValid(form.pricingSelection)) return;
      const items = buildLineItems(form.pricingSelection);
      const tierPrice = items[0]?.price;
      if (!tierPrice) {
        setError(
          "We couldn’t resolve your plan’s Stripe price. Check that price IDs are configured, then try again.",
        );
        return;
      }
      setError(null);
      setForm((f) => ({ ...f, plan: tierPrice }));
    }
    if (step === 6) {
      const errs = validateStepPayment();
      const hasErrors = Object.keys(errs).length > 0;
      setStepPaymentErrors(errs);
      if (hasErrors) return;
      setStepPaymentErrors({});
    }
    if (step < STEPS.length) setStep((s) => s + 1);
    else handleComplete();
  };

  const clearStep1Error = (field: keyof Step1Errors) => {
    setStep1Errors((prev) => {
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  const [step2Errors, setStep2Errors] = useState<Step2Errors>({});

  const validateStep2 = (): Step2Errors => {
    const trim = (s: string) => s.trim();
    const err: Step2Errors = {};
    if (!trim(form.company)) err.company = "Please enter your company name.";
    if (!form.companySize) err.companySize = "Please select your company size.";
    return err;
  };

  const clearStep2Error = (field: keyof Step2Errors) => {
    setStep2Errors((prev) => {
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  const [step3Errors, setStep3Errors] = useState<Step3Errors>({});

  const validateStep3 = (): Step3Errors => {
    const err: Step3Errors = {};
    if (!form.trades.length) err.trades = "Please select at least one trade.";
    if (!form.role) err.role = "Please select your role at the company.";
    return err;
  };

  const clearStep3Error = (field: keyof Step3Errors) => {
    setStep3Errors((prev) => {
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  const [step4Errors, setStep4Errors] = useState<Step4Errors>({});

  const validateStep4 = (): Step4Errors => {
    const err: Step4Errors = {};
    const digits = form.phone.replace(/\D/g, "");
    if (!digits || digits.length < 10) err.phone = "Please enter a valid 10-digit phone number.";
    if (!form.contactPref) err.contactPref = "Please select your preferred contact method.";
    return err;
  };

  const clearStep4Error = (field: keyof Step4Errors) => {
    setStep4Errors((prev) => {
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  const [stepPaymentErrors, setStepPaymentErrors] = useState<StepPaymentErrors>({});
  const [cardComplete, setCardComplete] = useState(false);
  const stripeRef = useRef<{ stripe: Stripe; elements: StripeElements } | null>(null);

  const validateStepPayment = (): StepPaymentErrors => {
    const err: StepPaymentErrors = {};
    if (!cardComplete) err.card = "Please complete your card details.";
    return err;
  };

  const clearStepPaymentError = (field: keyof StepPaymentErrors) => {
    setStepPaymentErrors((prev) => {
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  const handleComplete = async () => {
    setError(null);
    setLoading(true);
    try {
      if (isRecaptchaConfigured) {
        const token = await getRecaptchaToken("signup");
        if (!token) {
          setError("Verification failed. Please refresh the page and try again.");
          setLoading(false);
          return;
        }
        const res = await fetch(`${API_BASE}/auth/verify-recaptcha`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });
        const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
        if (!data.ok) {
          setError(data.error || "Verification failed. Please try again.");
          setLoading(false);
          return;
        }
      }

      const { stripe: st, elements: el } = stripeRef.current ?? {};
      let stripeCustomerIdFromSetup: string | undefined;
      if (st && el) {
        const res = await fetch(`${API_BASE}/stripe/setup-intent`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: form.email || undefined }),
        });
        const setupJson = (await res.json().catch(() => ({}))) as {
          client_secret?: string;
          stripe_customer_id?: string;
          error?: string;
        };
        if (!res.ok) {
          setError(setupJson.error || "Failed to set up payment.");
          setLoading(false);
          return;
        }
        const clientSecret = setupJson.client_secret;
        stripeCustomerIdFromSetup = setupJson.stripe_customer_id;
        if (!clientSecret) {
          setError("Payment setup failed. Please try again.");
          setLoading(false);
          return;
        }
        const cardEl = el.getElement("card");
        if (!cardEl) {
          setError("Card form is not ready. Please try again.");
          setLoading(false);
          return;
        }
        const { error: confirmError } = await st.confirmCardSetup(clientSecret, {
          payment_method: { card: cardEl },
        });
        if (confirmError) {
          setError(confirmError.message || "Card verification failed.");
          setLoading(false);
          return;
        }
      }

      setReferralSignupIntent();
      if (form.referralCode.trim()) {
        persistReferralCodeFromManualInput(form.referralCode.trim());
      }
      const err = await onSignUp(form, { stripeCustomerId: stripeCustomerIdFromSetup });
      if (err) {
        clearReferralSignupIntent();
        setError(err);
        setLoading(false);
        return;
      }
      setDone(true);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const stepComponents = [
    <Step1 key="1" form={form} upd={upd} errors={step1Errors} onClearError={clearStep1Error} />,
    <Step2 key="2" form={form} upd={upd} errors={step2Errors} onClearError={clearStep2Error} />,
    <Step3 key="3" form={form} upd={upd} toggleTrade={toggleTrade} errors={step3Errors} onClearError={clearStep3Error} />,
    <Step4 key="4" form={form} upd={upd} errors={step4Errors} onClearError={clearStep4Error} />,
    <PricingStep
      key="5-pricing"
      selection={form.pricingSelection}
      setSelection={(next) =>
        setForm((f) => ({
          ...f,
          pricingSelection: typeof next === "function" ? next(f.pricingSelection) : next,
        }))
      }
      compactLayout={isMobile}
    />,
    <StepPayment
      key="6-pay"
      form={form}
      errors={stepPaymentErrors}
      onClearError={clearStepPaymentError}
      onStripeReady={(stripe, elements) => {
        stripeRef.current = stripe && elements ? { stripe, elements } : null;
      }}
      onCardChange={setCardComplete}
    />,
  ];

  const shellStyle: CSSProperties = {
    display: "flex",
    flexDirection: isMobile ? "column" : "row",
    minHeight: isMobile ? "min(100dvh, 920px)" : "640px",
    fontFamily: "'DM Sans', sans-serif",
    borderRadius: isMobile ? "10px" : "12px",
    overflow: "hidden",
    border: `1px solid ${BORDER}`,
    boxShadow: isMobile ? "none" : "0 4px 24px rgba(0,0,0,0.08)",
    width: "100%",
    maxWidth: "100%",
    boxSizing: "border-box",
  };

  const continueDisabled =
    loading ||
    (step === 5 &&
      (!isPricingSelectionValid(form.pricingSelection) || !buildLineItems(form.pricingSelection)[0]?.price));

  const continueBtnStyle: CSSProperties = {
    ...btnPrimaryStyle,
    ...(isMobile
      ? { width: "100%", padding: "12px 20px", fontSize: "15px", minHeight: "48px", boxSizing: "border-box" }
      : {}),
    ...(continueDisabled ? { opacity: 0.6, pointerEvents: "none" as const } : {}),
  };

  const footerStyle: CSSProperties = {
    padding: isMobile ? "12px 18px" : "18px 44px",
    paddingBottom: isMobile ? "max(12px, env(safe-area-inset-bottom, 0px))" : "18px",
    borderTop: `1px solid ${BORDER}`,
    background: "#fff",
    display: "flex",
    flexDirection: isMobile ? "column" : "row",
    alignItems: isMobile ? "stretch" : "center",
    justifyContent: "space-between",
    gap: isMobile ? "12px" : "0",
    flexShrink: 0,
  };

  return (
    <SignupMobileContext.Provider value={isMobile}>
      {done ? (
        <div style={shellStyle}>
          {!isMobile && <Sidebar currentStep={7} />}
          {isMobile && <MobileSignupHeader currentStep={7} complete />}
          <div
            style={{
              flex: 1,
              background: BG,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              minWidth: 0,
              overflowY: "auto",
            }}
          >
            <CheckEmailScreen email={form.email || ""} />
          </div>
        </div>
      ) : (
        <div style={shellStyle}>
          {!isMobile && <Sidebar currentStep={step} />}
          {isMobile && <MobileSignupHeader currentStep={step} />}

          <div
            style={{
              flex: 1,
              background: BG,
              display: "flex",
              flexDirection: "column",
              minWidth: 0,
              minHeight: isMobile ? 0 : undefined,
            }}
          >
            <div
              style={{
                flex: 1,
                padding: isMobile ? "16px 18px" : "36px 44px",
                overflowY: "auto",
                WebkitOverflowScrolling: "touch",
              }}
            >
              {error && (
                <div
                  style={{
                    marginBottom: "20px",
                    padding: "12px 16px",
                    borderRadius: "8px",
                    background: "#fdf0ef",
                    border: `1px solid ${ACCENT}`,
                    color: "#b71c1c",
                    fontSize: "13px",
                  }}
                >
                  {error}
                </div>
              )}
              {stepComponents[step - 1]}
            </div>

            <div style={footerStyle}>
              {isMobile ? (
                <>
                  {step > 1 ? (
                    <button
                      type="button"
                      onClick={() => setStep((s) => s - 1)}
                      style={{
                        ...btnSecondaryStyle,
                        alignSelf: "flex-start",
                        padding: "10px 22px",
                        minHeight: "44px",
                      }}
                    >
                      ← Back
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={handleStepNext}
                    style={continueBtnStyle}
                    disabled={continueDisabled}
                  >
                    {loading ? "Creating account..." : step === STEPS.length ? "Complete Setup →" : "Continue →"}
                  </button>
                </>
              ) : (
                <>
                  {step > 1 ? (
                    <button type="button" onClick={() => setStep((s) => s - 1)} style={btnSecondaryStyle}>
                      ← Back
                    </button>
                  ) : (
                    <div />
                  )}
                  <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                    <span style={{ fontSize: "12px", color: "#aaa" }}>
                      Step {step} of {STEPS.length}
                    </span>
                    <button type="button" onClick={handleStepNext} style={continueBtnStyle} disabled={continueDisabled}>
                      {loading ? "Creating account..." : step === STEPS.length ? "Complete Setup →" : "Continue →"}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </SignupMobileContext.Provider>
  );
}
