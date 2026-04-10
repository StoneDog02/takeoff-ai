-- Invite-only partners: no commission % display or Stripe accrual; referrals still work.
ALTER TABLE public.affiliates
  ADD COLUMN IF NOT EXISTS tracks_commission boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.affiliates.tracks_commission IS
  'When false, partner may invite/share referrals but no commission is recorded (affiliate_commission_rate snapshots stay null).';

UPDATE public.affiliates
SET tracks_commission = false
WHERE lower(trim(email)) = 'brett.gasaway2001@gmail.com';

UPDATE public.referrals r
SET affiliate_commission_rate = NULL
FROM public.affiliates a
WHERE r.affiliate_id = a.id
  AND a.tracks_commission = false;
