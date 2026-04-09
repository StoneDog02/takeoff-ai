-- Affiliates: external partners with referral codes (parallel to user-owned codes in referral_codes).
-- Requires existing public.referral_codes and public.referrals tables.
-- Applied to hosted project via Supabase MCP; version matches remote schema_migrations.

-- ---------------------------------------------------------------------------
-- affiliates
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.affiliates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text NOT NULL,
  phone text,
  commission_rate numeric(8, 6) NOT NULL CHECK (commission_rate >= 0 AND commission_rate <= 1),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS affiliates_email_lower_idx ON public.affiliates (lower(email));

ALTER TABLE public.affiliates ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- affiliate_commission_events (Stripe invoice idempotency)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.affiliate_commission_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id uuid NOT NULL REFERENCES public.affiliates (id) ON DELETE CASCADE,
  referral_id uuid NOT NULL REFERENCES public.referrals (id) ON DELETE CASCADE,
  referee_user_id uuid NOT NULL,
  stripe_invoice_id text NOT NULL UNIQUE,
  amount_cents bigint NOT NULL,
  currency text NOT NULL DEFAULT 'usd',
  commission_rate numeric(8, 6) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS affiliate_commission_events_affiliate_id_idx
  ON public.affiliate_commission_events (affiliate_id);

ALTER TABLE public.affiliate_commission_events ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- referral_codes: affiliate-owned codes (exactly one of user_id, affiliate_id)
-- ---------------------------------------------------------------------------
ALTER TABLE public.referral_codes
  ADD COLUMN IF NOT EXISTS affiliate_id uuid REFERENCES public.affiliates (id) ON DELETE CASCADE;

ALTER TABLE public.referral_codes
  ALTER COLUMN user_id DROP NOT NULL;

-- Drop legacy constraint name if present from a previous partial run (best-effort).
ALTER TABLE public.referral_codes DROP CONSTRAINT IF EXISTS referral_codes_owner_xor;

ALTER TABLE public.referral_codes
  ADD CONSTRAINT referral_codes_owner_xor CHECK (
    (user_id IS NOT NULL AND affiliate_id IS NULL)
    OR (user_id IS NULL AND affiliate_id IS NOT NULL)
  );

CREATE UNIQUE INDEX IF NOT EXISTS referral_codes_affiliate_id_unique
  ON public.referral_codes (affiliate_id)
  WHERE affiliate_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- referrals: optional affiliate as "referrer" instead of auth user
-- ---------------------------------------------------------------------------
ALTER TABLE public.referrals
  ADD COLUMN IF NOT EXISTS affiliate_id uuid REFERENCES public.affiliates (id) ON DELETE SET NULL;

ALTER TABLE public.referrals
  ADD COLUMN IF NOT EXISTS affiliate_commission_rate numeric(8, 6);

ALTER TABLE public.referrals
  ALTER COLUMN referrer_id DROP NOT NULL;

ALTER TABLE public.referrals DROP CONSTRAINT IF EXISTS referrals_referrer_xor;

ALTER TABLE public.referrals
  ADD CONSTRAINT referrals_referrer_xor CHECK (
    (referrer_id IS NOT NULL AND affiliate_id IS NULL)
    OR (referrer_id IS NULL AND affiliate_id IS NOT NULL)
  );

COMMENT ON COLUMN public.referrals.affiliate_commission_rate IS
  'Snapshot of affiliates.commission_rate when the referral was created; used for Stripe accrual.';
