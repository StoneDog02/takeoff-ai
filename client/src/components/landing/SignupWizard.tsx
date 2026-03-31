import { useState, useRef, useEffect } from "react";
import { CardElement, useStripe, useElements } from "@stripe/react-stripe-js";
import type { Stripe, StripeElements } from "@stripe/stripe-js";
import { API_BASE } from "@/api/config";
import { LinkBankAccountPanel } from "@/components/stripe/LinkBankAccountPanel";
import { PricingCard } from "@/components/landing/PricingCard";
import { getRecaptchaToken, isRecaptchaConfigured } from "@/lib/recaptcha";

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

/** Product from Stripe with nested prices (for signup plan step with monthly/yearly toggle). */
export interface SignupProduct {
  productId: string;
  name: string;
  description: string;
  metadata: Record<string, string>;
  prices: Array<{
    id: string;
    amount: number;
    currency: string;
    interval: "month" | "year";
    formatted: string;
  }>;
}

export interface SignupWizardForm {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  confirmPassword: string;
  company: string;
  companySize: string;
  license: string;
  trades: string[];
  role: string;
  phone: string;
  contactPref: string;
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
  return (
    <div style={{ marginBottom: "32px" }}>
      <h2 style={{ fontFamily: "'DM Serif Display', serif", fontSize: "26px", color: DARK, margin: "0 0 6px" }}>
        {title}
      </h2>
      <p style={{ color: "#888", fontSize: "14px", margin: 0 }}>{sub}</p>
    </div>
  );
}

function SelectTile({ label, selected, onClick }: { label: string; selected: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: "10px 14px",
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
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: "8px 16px",
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

  return (
    <div>
      <StepHeader title="Create your account" sub="Start with your login credentials" />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
        <Field label="First name" error={errors.firstName}>
          <input
            style={{ ...inputStyle, ...(errors.firstName ? { borderColor: ACCENT } : {}) }}
            placeholder="John"
            value={form.firstName}
            onChange={(e) => { upd("firstName", e.target.value); onClearError("firstName"); }}
          />
        </Field>
        <Field label="Last name" error={errors.lastName}>
          <input
            style={{ ...inputStyle, ...(errors.lastName ? { borderColor: ACCENT } : {}) }}
            placeholder="Smith"
            value={form.lastName}
            onChange={(e) => { upd("lastName", e.target.value); onClearError("lastName"); }}
          />
        </Field>
      </div>
      <Field label="Email address" error={errors.email}>
        <input
          style={{ ...inputStyle, ...(errors.email ? { borderColor: ACCENT } : {}) }}
          type="email"
          placeholder="john@smithconstruction.com"
          value={form.email}
          onChange={(e) => { upd("email", e.target.value); onClearError("email"); }}
        />
      </Field>
      <Field label="Password" error={errors.password}>
        <div style={{ position: "relative" }}>
          <input
            style={{ ...inputStyle, paddingRight: "60px", ...(errors.password ? { borderColor: ACCENT } : {}) }}
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
            style={{ ...inputStyle, paddingRight: "60px", ...(errors.confirmPassword ? { borderColor: ACCENT } : {}) }}
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
  return (
    <div>
      <StepHeader title="Tell us about your company" sub="We'll tailor Takeoff to fit your operation" />
      <Field label="Company name" error={errors.company}>
        <input
          style={{ ...inputStyle, ...(errors.company ? { borderColor: ACCENT } : {}) }}
          placeholder="Smith Construction LLC"
          value={form.company}
          onChange={(e) => { upd("company", e.target.value); onClearError("company"); }}
        />
      </Field>
      <Field label="Company size" error={errors.companySize}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
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
          style={inputStyle}
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
            gridTemplateColumns: "1fr 1fr",
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
          style={{ ...inputStyle, ...(errors.phone ? { borderColor: ACCENT } : {}) }}
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
                flex: 1, padding: "10px", borderRadius: "8px",
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
      <div style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: "10px", padding: "16px 20px" }}>
        <p style={{ fontSize: "13px", color: "#888", margin: 0, lineHeight: "1.6" }}>
          🔒 Your contact information is never sold or shared with third parties. We'll only reach out about your account or important platform updates.
        </p>
      </div>
    </div>
  );
}

const SIGNUP_DEFAULT_FEATURES = [
  "Full project management suite",
  "Estimates, takeoffs & invoicing",
  "Crew & payroll management",
  "Client communication portal",
  "Subcontractor bid collection",
];

function parseSignupFeatures(metadata: Record<string, string>): string[] {
  const raw = metadata?.features;
  if (!raw || typeof raw !== "string") return [];
  const trimmed = raw.trim();
  if (!trimmed) return [];
  try {
    const parsed = JSON.parse(trimmed) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((x): x is string => typeof x === "string")
      : trimmed.split(/\n/).map((s) => s.trim()).filter(Boolean);
  } catch {
    return trimmed.split(/\n/).map((s) => s.trim()).filter(Boolean);
  }
}

// ─── Step 5: Plan ──────────────────────────────────────────────────────────────

type Step5Errors = Partial<Record<"plan", string>>;

function Step5({
  form,
  upd,
  errors,
  onClearError,
  plans,
  products,
  plansLoading,
  yearly,
  setYearlyAndUpdatePlan,
}: {
  form: SignupWizardForm;
  upd: (key: keyof SignupWizardForm, value: string) => void;
  errors: Step5Errors;
  onClearError: (field: keyof Step5Errors) => void;
  plans: SignupPlan[];
  products: SignupProduct[];
  plansLoading: boolean;
  yearly: boolean;
  setYearlyAndUpdatePlan: (yearly: boolean) => void;
}) {
  const useProductCards = products.length > 0;
  const [openFeaturesKey, setOpenFeaturesKey] = useState<string | null>(null);
  const singlePlan = useProductCards ? products.length === 1 : plans.length === 1;

  return (
    <div>
      <StepHeader
        title="Choose your plan"
        sub="Start with a 14-day free trial on Standard. You'll add a payment method next — you won't be charged until the trial ends."
      />

      {useProductCards && (
        <div style={{ marginBottom: "24px" }}>
          <p style={{ fontSize: "14px", color: "#666", margin: "0 0 12px" }}>Billing frequency</p>
          <div
            style={{
              display: "inline-flex",
              background: "#f0eeea",
              border: "1px solid #e0ddd8",
              borderRadius: "100px",
              padding: "4px",
            }}
          >
            <button
              type="button"
              onClick={() => setYearlyAndUpdatePlan(false)}
              style={{
                padding: "10px 24px",
                borderRadius: "100px",
                border: "none",
                fontSize: "14px",
                fontWeight: 500,
                cursor: "pointer",
                background: !yearly ? "#fff" : "transparent",
                color: !yearly ? DARK : "#666",
                boxShadow: !yearly ? "0 1px 2px rgba(0,0,0,0.06)" : "none",
              }}
            >
              Monthly
            </button>
            <button
              type="button"
              onClick={() => setYearlyAndUpdatePlan(true)}
              style={{
                padding: "10px 24px",
                borderRadius: "100px",
                border: "none",
                fontSize: "14px",
                fontWeight: 500,
                cursor: "pointer",
                background: yearly ? "#fff" : "transparent",
                color: yearly ? DARK : "#666",
                boxShadow: yearly ? "0 1px 2px rgba(0,0,0,0.06)" : "none",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              Yearly
              <span
                style={{
                  background: "#22c55e",
                  color: "#fff",
                  fontSize: "11px",
                  fontWeight: 600,
                  padding: "2px 8px",
                  borderRadius: "100px",
                }}
              >
                Save 20%
              </span>
            </button>
          </div>
          <p style={{ fontSize: "12px", color: "#888", margin: "8px 0 0" }}>
            {yearly ? "Billed annually" : "Billed monthly"}
          </p>
        </div>
      )}

      <Field label="Plan" error={errors.plan}>
        <div
          style={{
            display: singlePlan ? "flex" : "grid",
            justifyContent: singlePlan ? "center" : undefined,
            flexWrap: singlePlan ? "wrap" : undefined,
            gridTemplateColumns: singlePlan
              ? undefined
              : useProductCards
                ? products.length <= 2
                  ? "1fr 1fr"
                  : "1fr 1fr 1fr"
                : plans.length <= 2
                  ? "1fr 1fr"
                  : "1fr 1fr 1fr",
            gap: "24px",
            ...(errors.plan ? { padding: "12px", borderRadius: "10px", border: `2px solid ${ACCENT}` } : {}),
          }}
        >
          {plansLoading && (
            <div style={{ gridColumn: "1 / -1", padding: "24px", textAlign: "center", color: "#888", fontSize: "14px" }}>
              Loading plans…
            </div>
          )}
          {!plansLoading && !useProductCards && plans.length === 0 && (
            <div style={{ gridColumn: "1 / -1", padding: "24px", textAlign: "center", color: "#888", fontSize: "14px" }}>
              No plans available. Please try again later.
            </div>
          )}

          {!plansLoading && useProductCards &&
            products.map((product) => {
              const prices = product.prices || [];
              const priceMonth = prices.find((p) => p.interval === "month");
              const priceYear = prices.find((p) => p.interval === "year");
              const price = yearly ? priceYear ?? priceMonth : priceMonth ?? priceYear;
              const featuresFromMeta = parseSignupFeatures(product.metadata || {});
              const features = featuresFromMeta.length > 0 ? featuresFromMeta : SIGNUP_DEFAULT_FEATURES;
              const meta = product.metadata || {};
              const isStandard = product.name.toLowerCase() === "standard";
              const offerBadge =
                meta.offer_badge ||
                (meta.limited_time_offer === "true" ? "LIMITED TIME OFFER" : undefined) ||
                (isStandard ? "LIMITED TIME OFFER" : undefined);
              const originalPriceFormatted = meta.original_price_formatted || (isStandard ? "$1,000 / mo" : undefined);
              const discountBadge = meta.discount_badge || (isStandard ? "50% OFF" : undefined);
              const description =
                product.description ||
                (isStandard ? "Everything you need to run your business." : "Subscribe to this plan.");
              const selected = price ? form.plan === price.id : false;
              const trialNote =
                meta.trial_note ||
                (isStandard ? "14-day free trial" : undefined);

              return (
                <PricingCard
                  key={product.productId}
                  name={product.name}
                  description={description}
                  price={price ? { amount: price.amount, currency: price.currency, formatted: price.formatted, interval: price.interval } : null}
                  features={features}
                  cta="Select plan"
                  offerBadge={offerBadge}
                  originalPriceFormatted={originalPriceFormatted}
                  discountBadge={discountBadge}
                  trialNote={trialNote}
                  disclaimer="No contracts — cancel anytime."
                  selectable
                  selected={selected}
                  onSelect={() => {
                    if (price) {
                      upd("plan", price.id);
                      onClearError("plan");
                    }
                  }}
                  ctaHref={undefined}
                  collapsibleFeatures
                  featuresOpen={openFeaturesKey === product.productId}
                  onToggleFeatures={() => setOpenFeaturesKey((k) => (k === product.productId ? null : product.productId))}
                />
              );
            })}

          {!plansLoading && !useProductCards &&
            plans.map((p) => (
              <PricingCard
                key={p.id}
                name={p.name}
                description="Everything you need to run your business."
                price={{ amount: p.amount, currency: p.currency, formatted: p.formatted, interval: p.interval }}
                features={[]}
                cta="Select plan"
                trialNote={p.name.toLowerCase() === "standard" ? "14-day free trial" : undefined}
                billingNote={p.interval === "year" ? "Billed annually" : "Billed monthly"}
                disclaimer="No contracts — cancel anytime."
                selectable
                selected={form.plan === p.id}
                onSelect={() => { upd("plan", p.id); onClearError("plan"); }}
                ctaHref={undefined}
                collapsibleFeatures
                featuresOpen={openFeaturesKey === p.id}
                onToggleFeatures={() => setOpenFeaturesKey((k) => (k === p.id ? null : p.id))}
              />
            ))}
        </div>
      </Field>
    </div>
  );
}

// ─── Step 6: Payment (Stripe Card Element) ───────────────────────────────────────

type Step6Errors = Partial<Record<"card", string>>;

function Step6Payment({
  form,
  errors,
  onClearError,
  onStripeReady,
  onCardChange,
  plans,
}: {
  form: SignupWizardForm;
  errors: Step6Errors;
  onClearError: (field: keyof Step6Errors) => void;
  onStripeReady: (stripe: Stripe | null, elements: StripeElements | null) => void;
  onCardChange: (complete: boolean) => void;
  plans: SignupPlan[];
}) {
  const stripe = useStripe();
  const elements = useElements();

  useEffect(() => {
    onStripeReady(stripe ?? null, elements ?? null);
  }, [stripe, elements, onStripeReady]);

  const selectedPlan = plans.find((p) => p.id === form.plan);

  return (
    <div>
      <StepHeader title="Payment details" sub="Secured by Stripe. Your card won't be charged until your trial ends." />

      {/* Plan summary */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "12px 16px", borderRadius: "8px",
        background: "#fdf0ef", border: `1px solid ${ACCENT}`, marginBottom: "20px",
      }}>
        <div>
          <div style={{ fontSize: "11px", color: ACCENT, fontWeight: "600", marginBottom: "2px" }}>
            SELECTED PLAN
          </div>
          <div style={{ fontWeight: "700", color: DARK, fontSize: "15px" }}>
            {selectedPlan ? selectedPlan.name : "Plan"}
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: "20px", fontWeight: "700", color: ACCENT }}>
            {selectedPlan ? selectedPlan.formatted : form.plan ? "—" : "—"}
          </div>
          <div style={{ fontSize: "12px", color: "#888" }}>after 14-day trial</div>
        </div>
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
                  fontSize: "14px",
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
        display: "flex", alignItems: "center", gap: "8px",
        marginTop: "4px", padding: "12px 16px",
        background: "#fff", borderRadius: "8px", border: `1px solid ${BORDER}`,
      }}>
        <span style={{ color: "#22a06b", fontSize: "16px" }}>🔒</span>
        <span style={{ fontSize: "12px", color: "#888" }}>
          256-bit SSL encryption · Powered by Stripe · Cancel anytime
        </span>
      </div>

      <LinkBankAccountPanel variant="signup" signupEmail={form.email} />
    </div>
  );
}

// ─── Post-signup: Check your email ───────────────────────────────────────────────

function CheckEmailScreen({ email }: { email: string }) {
  return (
    <div style={{ textAlign: "center", padding: "60px 40px" }}>
      <div style={{
        width: "64px", height: "64px", borderRadius: "50%",
        background: "#e8f5e9", border: "2px solid #4caf50",
        display: "flex", alignItems: "center", justifyContent: "center",
        margin: "0 auto 24px", fontSize: "28px", color: "#2e7d32",
      }}>
        ✉
      </div>
      <h2 style={{ fontFamily: "'DM Serif Display', serif", fontSize: "28px", color: DARK, margin: "0 0 12px" }}>
        Check your email
      </h2>
      <p style={{ color: "#666", fontSize: "15px", maxWidth: "380px", margin: "0 auto 16px", lineHeight: "1.7" }}>
        We've sent a verification link to <strong style={{ color: DARK }}>{email}</strong>.
      </p>
      <p style={{ color: "#888", fontSize: "14px", maxWidth: "360px", margin: "0 auto 32px", lineHeight: "1.6" }}>
        Click the link in that email to verify your account. Once verified, you'll be taken straight to your dashboard.
      </p>
      <p style={{ color: "#999", fontSize: "13px" }}>
        Didn't get the email? Check your spam folder or try signing up again.
      </p>
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
  /** Called when user completes step 6 (signup). Return error message to show, or undefined on success. */
  onSignUp: (form: SignupWizardForm) => Promise<string | undefined>;
  /** Optional: called when user would have gone to dashboard (e.g. if email confirm is disabled). */
  onGoToDashboard?: (form: SignupWizardForm) => void;
}

export default function SignupWizard({ onSignUp }: SignupWizardProps) {
  const [step, setStep] = useState(1);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [plans, setPlans] = useState<SignupPlan[]>([]);
  const [products, setProducts] = useState<SignupProduct[]>([]);
  const [plansLoading, setPlansLoading] = useState(true);
  const [yearly, setYearly] = useState(false);
  const [form, setForm] = useState<SignupWizardForm>({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    confirmPassword: "",
    company: "",
    companySize: "",
    license: "",
    trades: [],
    role: "",
    phone: "",
    contactPref: "",
    plan: "",
    cardName: "",
    cardNumber: "",
    expiry: "",
    cvc: "",
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/stripe/plans`, { cache: "no-store" });
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        const payload = data as { plans?: SignupPlan[]; products?: SignupProduct[] };
        if (Array.isArray(payload.plans)) setPlans(payload.plans);
        if (Array.isArray(payload.products)) setProducts(payload.products);
      } catch {
        if (!cancelled) {
          setPlans([]);
          setProducts([]);
        }
      } finally {
        if (!cancelled) setPlansLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const upd = (key: keyof SignupWizardForm, value: string) => setForm((f) => ({ ...f, [key]: value }));

  const setYearlyAndUpdatePlan = (newYearly: boolean) => {
    setYearly(newYearly);
    if (!form.plan) return;
    const product = products.find((p) => p.prices.some((pr) => pr.id === form.plan));
    if (product) {
      const price = newYearly
        ? product.prices.find((p) => p.interval === "year")
        : product.prices.find((p) => p.interval === "month");
      if (price) upd("plan", price.id);
    }
  };

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
      const errs = validateStep5();
      const hasErrors = Object.keys(errs).length > 0;
      setStep5Errors(errs);
      if (hasErrors) return;
      setStep5Errors({});
    }
    if (step === 6) {
      const errs = validateStep6();
      const hasErrors = Object.keys(errs).length > 0;
      setStep6Errors(errs);
      if (hasErrors) return;
      setStep6Errors({});
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

  const [step5Errors, setStep5Errors] = useState<Step5Errors>({});

  const validateStep5 = (): Step5Errors => {
    const err: Step5Errors = {};
    if (!form.plan) err.plan = "Please select a plan.";
    return err;
  };

  const clearStep5Error = (field: keyof Step5Errors) => {
    setStep5Errors((prev) => {
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  const [step6Errors, setStep6Errors] = useState<Step6Errors>({});
  const [cardComplete, setCardComplete] = useState(false);
  const stripeRef = useRef<{ stripe: Stripe; elements: StripeElements } | null>(null);

  const validateStep6 = (): Step6Errors => {
    const err: Step6Errors = {};
    if (!cardComplete) err.card = "Please complete your card details.";
    return err;
  };

  const clearStep6Error = (field: keyof Step6Errors) => {
    setStep6Errors((prev) => {
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
      if (st && el) {
        const res = await fetch(`${API_BASE}/stripe/setup-intent`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: form.email || undefined }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError((data as { error?: string }).error || "Failed to set up payment.");
          setLoading(false);
          return;
        }
        const clientSecret = (data as { client_secret?: string }).client_secret;
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

      const err = await onSignUp(form);
      if (err) {
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
    <Step5
      key="5"
      form={form}
      upd={upd}
      errors={step5Errors}
      onClearError={clearStep5Error}
      plans={plans}
      products={products}
      plansLoading={plansLoading}
      yearly={yearly}
      setYearlyAndUpdatePlan={setYearlyAndUpdatePlan}
    />,
    <Step6Payment
      key="6"
      form={form}
      errors={step6Errors}
      onClearError={clearStep6Error}
      onStripeReady={(stripe, elements) => {
        stripeRef.current = stripe && elements ? { stripe, elements } : null;
      }}
      onCardChange={setCardComplete}
      plans={plans}
    />,
  ];

  if (done) {
    return (
      <div style={{ display: "flex", minHeight: "640px", borderRadius: "12px", overflow: "hidden", border: `1px solid ${BORDER}` }}>
        <Sidebar currentStep={7} />
        <div style={{ flex: 1, background: BG, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <CheckEmailScreen email={form.email || ""} />
        </div>
      </div>
    );
  }

  return (
    <div style={{
      display: "flex", minHeight: "640px", fontFamily: "'DM Sans', sans-serif",
      borderRadius: "12px", overflow: "hidden",
      border: `1px solid ${BORDER}`, boxShadow: "0 4px 24px rgba(0,0,0,0.08)",
    }}>
      <Sidebar currentStep={step} />

      <div style={{ flex: 1, background: BG, display: "flex", flexDirection: "column", minWidth: 0 }}>
        {/* Step content */}
        <div style={{ flex: 1, padding: "36px 44px", overflowY: "auto" }}>
          {error && (
            <div style={{
              marginBottom: "20px", padding: "12px 16px", borderRadius: "8px",
              background: "#fdf0ef", border: `1px solid ${ACCENT}`, color: "#b71c1c", fontSize: "13px",
            }}>
              {error}
            </div>
          )}
          {stepComponents[step - 1]}
        </div>

        {/* Footer nav */}
        <div style={{
          padding: "18px 44px", borderTop: `1px solid ${BORDER}`,
          background: "#fff", display: "flex",
          alignItems: "center", justifyContent: "space-between",
        }}>
          {step > 1 ? (
            <button type="button" onClick={() => setStep((s) => s - 1)} style={btnSecondaryStyle}>
              ← Back
            </button>
          ) : (
            <div />
          )}
          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            <span style={{ fontSize: "12px", color: "#aaa" }}>Step {step} of {STEPS.length}</span>
            <button
              type="button"
              onClick={handleStepNext}
              style={
                loading
                  ? { ...btnPrimaryStyle, opacity: 0.8, pointerEvents: "none" as const }
                  : { ...btnPrimaryStyle }
              }
              disabled={loading}
            >
              {loading ? "Creating account..." : step === STEPS.length ? "Complete Setup →" : "Continue →"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
