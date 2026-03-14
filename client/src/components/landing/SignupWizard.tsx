import { useState } from "react";

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

const PLANS = [
  {
    name: "Starter",
    price: "$49",
    period: "/mo",
    desc: "Great for small crews",
    features: ["5 active projects", "2 team members", "Material takeoffs", "Basic reports"],
  },
  {
    name: "Pro",
    price: "$149",
    period: "/mo",
    desc: "Most popular for growing GCs",
    features: ["Unlimited projects", "20 team members", "Payroll & scheduling", "Client portal", "Advanced reports"],
    popular: true,
  },
  {
    name: "Enterprise",
    price: "Custom",
    period: "",
    desc: "For large operations",
    features: ["Everything in Pro", "Dedicated support", "Custom integrations", "Multi-location", "SLA guarantee"],
  },
];

// ─── Types ────────────────────────────────────────────────────────────────────

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

// ─── Step 5: Plan ──────────────────────────────────────────────────────────────

type Step5Errors = Partial<Record<"plan", string>>;

function Step5({
  form,
  upd,
  errors,
  onClearError,
}: {
  form: SignupWizardForm;
  upd: (key: keyof SignupWizardForm, value: string) => void;
  errors: Step5Errors;
  onClearError: (field: keyof Step5Errors) => void;
}) {
  return (
    <div>
      <StepHeader title="Choose your plan" sub="All plans include a 14-day free trial. No credit card until you're ready." />
      <Field label="Plan" error={errors.plan}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr",
            gap: "12px",
            ...(errors.plan ? { padding: "12px", borderRadius: "10px", border: `2px solid ${ACCENT}` } : {}),
          }}
        >
          {PLANS.map((p) => (
            <div
              key={p.name}
              role="button"
              tabIndex={0}
              onClick={() => { upd("plan", p.name); onClearError("plan"); }}
              onKeyDown={(e) => { if (e.key === "Enter") { upd("plan", p.name); onClearError("plan"); } }}
              style={{
                border: `2px solid ${form.plan === p.name ? ACCENT : p.popular ? "#ddd" : BORDER}`,
                borderRadius: "10px", background: "#fff", padding: "20px 16px",
                cursor: "pointer", position: "relative", transition: "border-color 0.15s",
              }}
            >
            {p.popular && (
              <div style={{
                position: "absolute", top: "-1px", left: "50%",
                transform: "translateX(-50%)",
                background: ACCENT, color: "#fff", fontSize: "11px",
                fontWeight: "700", padding: "3px 12px",
                borderRadius: "0 0 6px 6px", letterSpacing: "0.5px",
              }}>
                MOST POPULAR
              </div>
            )}
            <div style={{ fontSize: "16px", fontWeight: "700", color: DARK, marginTop: p.popular ? "10px" : 0, marginBottom: "4px" }}>
              {p.name}
            </div>
            <div style={{ marginBottom: "8px" }}>
              <span style={{ fontSize: "24px", fontWeight: "700", color: form.plan === p.name ? ACCENT : DARK }}>
                {p.price}
              </span>
              <span style={{ fontSize: "13px", color: "#888" }}>{p.period}</span>
            </div>
            <p style={{ fontSize: "12px", color: "#888", margin: "0 0 14px" }}>{p.desc}</p>
            <div style={{ borderTop: `1px solid ${BORDER}`, paddingTop: "12px" }}>
              {p.features.map((f) => (
                <div key={f} style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", color: "#444", marginBottom: "6px" }}>
                  <span style={{ color: ACCENT, fontWeight: "700", fontSize: "14px" }}>✓</span>
                  {f}
                </div>
              ))}
            </div>
          </div>
        ))}
        </div>
      </Field>
    </div>
  );
}

// ─── Step 6: Payment ───────────────────────────────────────────────────────────
//
// Stripe Elements is not yet wired: @stripe/stripe-js and @stripe/react-stripe-js are not in
// package.json. These are placeholder card fields with validation. For production, install
// Stripe, add a publishable key (e.g. VITE_STRIPE_PUBLISHABLE_KEY), wrap the app or this
// step in <Elements stripe={loadStripe(pk)}>, and replace these inputs with <CardElement />
// or <PaymentElement /> so card data never touches your server.

type Step6Errors = Partial<Record<"cardName" | "cardNumber" | "expiry" | "cvc", string>>;

function Step6({
  form,
  upd,
  errors,
  onClearError,
}: {
  form: SignupWizardForm;
  upd: (key: keyof SignupWizardForm, value: string) => void;
  errors: Step6Errors;
  onClearError: (field: keyof Step6Errors) => void;
}) {
  const formatCard = (v: string) =>
    v.replace(/\D/g, "").slice(0, 16).replace(/(.{4})/g, "$1 ").trim();
  const formatExp = (v: string) => {
    const d = v.replace(/\D/g, "").slice(0, 4);
    return d.length >= 3 ? `${d.slice(0, 2)}/${d.slice(2)}` : d;
  };

  const selectedPlan = PLANS.find((p) => p.name === form.plan) || PLANS[1];

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
            {selectedPlan.name} Plan
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: "20px", fontWeight: "700", color: ACCENT }}>{selectedPlan.price}</div>
          <div style={{ fontSize: "12px", color: "#888" }}>after 14-day trial</div>
        </div>
      </div>

      <Field label="Name on card" error={errors.cardName}>
        <input
          style={{ ...inputStyle, ...(errors.cardName ? { borderColor: ACCENT } : {}) }}
          placeholder="John Smith"
          value={form.cardName || ""}
          onChange={(e) => { upd("cardName", e.target.value); onClearError("cardName"); }}
        />
      </Field>

      <Field label="Card number" error={errors.cardNumber}>
        <div style={{ position: "relative" }}>
          <input
            style={{ ...inputStyle, paddingRight: "80px", letterSpacing: "1px", ...(errors.cardNumber ? { borderColor: ACCENT } : {}) }}
            placeholder="1234 5678 9012 3456"
            value={form.cardNumber || ""}
            onChange={(e) => { upd("cardNumber", formatCard(e.target.value)); onClearError("cardNumber"); }}
          />
          <div style={{ position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)", display: "flex", gap: "4px" }}>
            {["VISA", "MC"].map((b) => (
              <div key={b} style={{ background: "#eee", borderRadius: "3px", padding: "2px 5px", fontSize: "9px", fontWeight: "700", color: "#555" }}>
                {b}
              </div>
            ))}
          </div>
        </div>
      </Field>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
        <Field label="Expiry date" error={errors.expiry}>
          <input
            style={{ ...inputStyle, ...(errors.expiry ? { borderColor: ACCENT } : {}) }}
            placeholder="MM/YY"
            value={form.expiry || ""}
            onChange={(e) => { upd("expiry", formatExp(e.target.value)); onClearError("expiry"); }}
          />
        </Field>
        <Field label="CVC" error={errors.cvc}>
          <input
            style={{ ...inputStyle, ...(errors.cvc ? { borderColor: ACCENT } : {}) }}
            placeholder="123"
            maxLength={4}
            value={form.cvc || ""}
            onChange={(e) => { upd("cvc", e.target.value.replace(/\D/g, "").slice(0, 4)); onClearError("cvc"); }}
          />
        </Field>
      </div>

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
    </div>
  );
}

// ─── Success Screen ─────────────────────────────────────────────────────────────

function SuccessScreen({ name, onGoToDashboard }: { name: string; onGoToDashboard: () => void }) {
  return (
    <div style={{ textAlign: "center", padding: "60px 40px" }}>
      <div style={{
        width: "64px", height: "64px", borderRadius: "50%",
        background: "#fdf0ef", border: `2px solid ${ACCENT}`,
        display: "flex", alignItems: "center", justifyContent: "center",
        margin: "0 auto 24px", fontSize: "28px",
      }}>
        ✓
      </div>
      <h2 style={{ fontFamily: "'DM Serif Display', serif", fontSize: "28px", color: DARK, margin: "0 0 12px" }}>
        You're all set, {name}!
      </h2>
      <p style={{ color: "#888", fontSize: "15px", maxWidth: "360px", margin: "0 auto 32px", lineHeight: "1.7" }}>
        Your Takeoff workspace is ready. Check your email for login instructions and your 14-day trial details.
      </p>
      <button type="button" onClick={onGoToDashboard} style={btnPrimaryStyle}>
        Go to Dashboard →
      </button>
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
  /** Called when user clicks "Go to Dashboard" on the success screen. */
  onGoToDashboard?: (form: SignupWizardForm) => void;
}

export default function SignupWizard({ onSignUp, onGoToDashboard }: SignupWizardProps) {
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

  const handleStepNext = () => {
    if (step === 1) {
      const errs = validateStep1();
      const hasErrors = Object.keys(errs).length > 0;
      setStep1Errors(errs);
      if (hasErrors) return;
      setStep1Errors({});
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

  const validateStep6 = (): Step6Errors => {
    const err: Step6Errors = {};
    const trim = (s: string) => (s || "").trim();
    if (!trim(form.cardName)) err.cardName = "Please enter the name on the card.";
    const cardDigits = (form.cardNumber || "").replace(/\D/g, "");
    if (cardDigits.length !== 16) err.cardNumber = "Please enter a valid 16-digit card number.";
    const exp = (form.expiry || "").replace(/\D/g, "");
    if (exp.length !== 4) err.expiry = "Please enter expiry as MM/YY.";
    else {
      const mm = parseInt(exp.slice(0, 2), 10);
      const yy = parseInt(exp.slice(2, 4), 10);
      if (mm < 1 || mm > 12) err.expiry = "Please enter a valid month (01–12).";
      const currentYear = new Date().getFullYear() % 100;
      if (yy < currentYear) err.expiry = "Card appears to be expired.";
    }
    const cvcDigits = (form.cvc || "").replace(/\D/g, "");
    if (cvcDigits.length < 3 || cvcDigits.length > 4) err.cvc = "Please enter a valid 3- or 4-digit CVC.";
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
    <Step5 key="5" form={form} upd={upd} errors={step5Errors} onClearError={clearStep5Error} />,
    <Step6 key="6" form={form} upd={upd} errors={step6Errors} onClearError={clearStep6Error} />,
  ];

  if (done) {
    return (
      <div style={{ display: "flex", minHeight: "640px", borderRadius: "12px", overflow: "hidden", border: `1px solid ${BORDER}` }}>
        <Sidebar currentStep={7} />
        <div style={{ flex: 1, background: BG, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <SuccessScreen
            name={form.firstName || "there"}
            onGoToDashboard={() => onGoToDashboard?.(form)}
          />
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
