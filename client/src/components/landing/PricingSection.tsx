import { useState } from "react";
import { Link } from "react-router-dom";
import { PricingPickForm, type PricingSelection } from "@/components/landing/PricingStep";

const defaultSelection: PricingSelection = { tier: "core", addons: [], employees: 5 };

/** Landing pricing: tier picker + informational add-on cards; signup uses the interactive wizard. */
export function PricingSection() {
  const [selection, setSelection] = useState<PricingSelection>(defaultSelection);

  return (
    <section id="pricing" className="w-full bg-light-bg py-[120px] px-6 md:px-12">
      <div className="max-w-[720px] mx-auto">
        <div className="reveal text-center mb-10">
          <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-accent block mb-3">
            PRICING
          </span>
          <h2 className="font-sora text-3xl md:text-5xl font-extrabold text-text-dark tracking-tight mb-4">
            Simple, Transparent Pricing
          </h2>
          <p className="text-[17px] text-text-mid font-light max-w-[500px] mx-auto">
            Choose a base tier to see how optional add-ons stack. You&apos;ll turn individual add-ons on or off when you
            sign up and confirm billing in Stripe.
          </p>
        </div>

        <div className="reveal text-left pb-12">
          <PricingPickForm selection={selection} setSelection={setSelection} displayMode="cards" />
        </div>

        <div className="reveal text-center mt-4">
          <Link
            to="/sign-up"
            className="inline-flex items-center justify-center rounded-lg px-8 py-3.5 text-base font-semibold text-white transition-opacity hover:opacity-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 font-dm-sans"
            style={{ backgroundColor: "var(--color-accent, #C0392B)" }}
          >
            Get started with this plan
          </Link>
          <p className="text-xs text-text-light mt-3 max-w-md mx-auto leading-relaxed">
            Your choices here are not saved — at signup you&apos;ll confirm the same options with Stripe.
          </p>
        </div>
      </div>
    </section>
  );
}
