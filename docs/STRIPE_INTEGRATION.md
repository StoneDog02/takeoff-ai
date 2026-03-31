# Stripe integration – step-by-step

This guide walks through wiring Stripe into the signup wizard (Step 6: Payment) so card data is handled by Stripe and never touches your server.

---

## 1. Stripe account and keys

1. **Create or log into** [Stripe Dashboard](https://dashboard.stripe.com).
2. **Get your API keys** (Dashboard → Developers → API keys):
   - **Publishable key** (starts with `pk_test_` or `pk_live_`) → used in the **client** (browser).
   - **Secret key** (starts with `sk_test_` or `sk_live_`) → used **only on the server**; never expose it in the client or in frontend env.

Use **test keys** until you’re ready to go live.

---

## 2. Environment variables

**Client (`.env` in project root or `client/.env`):**

```env
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_xxxxxxxxxxxx
```

**Server (root `.env`):**

```env
STRIPE_SECRET_KEY=sk_test_xxxxxxxxxxxx
```

Optional: `STRIPE_SIGNUP_PRODUCT_ID=prod_xxx` limits the signup plan step to that one product’s prices. If unset, **all active products** and their active recurring prices are loaded from Stripe (no product/price IDs in code).

For **webhooks** (to keep `public.subscriptions` in sync with Stripe):

```env
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxx
```

Optional — **referral discount** on recurring subscription invoices (`invoice.created` handler uses `public.subscriptions` + Postgres `consume_referral_credit`):

```env
STRIPE_REFERRAL_COUPON_ID=coupon_xxxxxxxxxxxx
```

Get this from Stripe Dashboard → Developers → Webhooks → Add endpoint → `https://your-api.com/api/stripe/webhook` → select events: `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.created`, `invoice.paid`, `invoice.payment_succeeded`, `invoice.payment_failed` → reveal signing secret.

Referral credits are awarded in `server/routes/stripe.js` from `invoice.paid` and/or `invoice.payment_succeeded` (same handler; idempotent if both fire), only when `invoice.billing_reason === 'subscription_cycle'`. Subscribe to both events if your Stripe Dashboard lists them.

Add `.env` (and any file with real keys) to `.gitignore` so keys are never committed.

---

## 3. Install packages

**Client:**

```bash
cd client
npm install @stripe/stripe-js @stripe/react-stripe-js
```

**Server:**

```bash
# from repo root
npm install stripe
```

---

## 4. Server: Stripe SDK and payment route

1. **Create a Stripe route** (e.g. `server/routes/stripe.js`):

   - Initialize Stripe with `STRIPE_SECRET_KEY`.
   - Add a **POST** endpoint that creates a **SetupIntent** (to save a card for later, e.g. after a trial) or a **PaymentIntent** (if you charge immediately). For a “14-day trial, then charge” flow, SetupIntent is typical.
   - Return `client_secret` to the client so it can confirm the payment method.

2. **Example flow (SetupIntent for “card on file” at signup):**

   - `POST /api/stripe/setup-intent` (optional: body with `customer_id` or `email` to create/link a Stripe Customer).
   - Server: `stripe.setupIntents.create({ payment_method_types: ['card'], customer: customerIdOrNull })`.
   - Return `{ client_secret: setupIntent.client_secret }`.

3. **Register the route** in `server/index.js` (e.g. `app.use('/api/stripe', stripeRoutes)`).  
   This endpoint can be **unauthenticated** if you call it before the user has an account; protect it by rate limiting and/or a simple token if needed.

4. **Optional:** Create a Stripe Customer when the user signs up (using their email) and attach the payment method to that customer so you can charge them after the trial.

---

## 5. Client: Load Stripe and wrap the signup flow in Elements

1. **Stripe provider**  
   Create a small module that loads Stripe and exposes the Elements provider, e.g. `client/src/lib/stripe.ts`:

   - `loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY)` (call once, reuse the promise).
   - Export a wrapper component that uses `<Elements stripe={stripePromise}>` and renders `children`.

2. **Wrap the signup route**  
   In your router (e.g. `client/src/App.tsx`), wrap the `SignUpPage` route with this Elements provider so the SignupWizard (and Step 6) run inside `<Elements>`.

   Alternatively, wrap only the `SignupWizard` (or just the payment step) in `<Elements>` if you prefer a narrower scope.

---

## 6. Client: Replace placeholder card fields with Stripe Card Element

1. **In `SignupWizard.tsx` (Step 6):**
   - Remove the placeholder inputs for card number, expiry, CVC, and (optionally) name on card.
   - Use Stripe’s **`CardElement`** (or **`PaymentElement`**) from `@stripe/react-stripe-js` inside the same form layout. The Card Element is a single, Stripe-hosted iframe that collects number, expiry, CVC, and optionally postal code; card data never touches your app.

2. **Validation:**  
   Use the Element’s `change` event (or Stripe’s `cardElement.on('change', ...)`) to detect `complete` and `error` and drive your existing Step 6 validation/error state (e.g. “Please complete the card details” until the element is complete and valid).

3. **On “Complete Setup”:**
   - Call your server to create a SetupIntent (or PaymentIntent) and get `client_secret`.
   - Use `stripe.confirmCardSetup(client_secret, { payment_method: { card: cardElement } })` (or `confirmCardPayment` for PaymentIntent). If that succeeds, you get a `payment_method` id (and optionally `customer` id).
   - Then call your existing `onSignUp(form)` to create the Supabase account. Optionally send `payment_method_id` (and `customer_id`) to your backend to store for the user so you can charge them after the trial.

---

## 7. End-to-end flow (summary)

1. User fills Steps 1–5, then Step 6 (Stripe Card Element).
2. User clicks **Complete Setup**.
3. Client requests SetupIntent from `POST /api/stripe/setup-intent` (with email or nothing).
4. Server creates SetupIntent (and optionally a Stripe Customer), returns `client_secret`.
5. Client calls `stripe.confirmCardSetup(client_secret, { payment_method: { card: cardElement } })`.
6. On success, client has `payment_method.id`; optionally send it (and customer id) to your API and store on the user record.
7. Client calls `onSignUp(form)` to create the Supabase account.
8. Redirect to dashboard (or success screen). Later, use the saved `payment_method` or Stripe Customer to create a subscription or one-time charge when the trial ends.

---

## 8. Security and PCI

- **Never** send the secret key to the client or log it.
- **Never** send raw card numbers to your server; Stripe Elements sends card data directly to Stripe.
- Use **HTTPS** in production.
- Prefer **SetupIntent** for “save card, charge later” and **PaymentIntent** for “charge now.”

---

## 9. Optional: Subscriptions and trial

For a “14-day free trial, then $X/month” flow:

- Use **Stripe Billing**: create a **Product** and **Price** (recurring) in the Dashboard.
- After signup, create a **Subscription** with `trial_period_days: 14` and the customer’s default payment method (from the SetupIntent flow above). Stripe will charge when the trial ends.
- You can create the subscription from your server right after signup (with trial) or via a webhook/cron when the trial is about to end.

Once this is in place, the signup wizard’s “plan” choice (Starter / Pro / Enterprise) can map to different Stripe Price IDs that you pass when creating the subscription.
