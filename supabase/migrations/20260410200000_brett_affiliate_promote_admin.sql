-- Partner (Brett) uses admin portal + Affiliates tab for invites; no affiliate-only role required.
UPDATE public.profiles
SET role = 'admin', updated_at = now()
WHERE id IN (
  SELECT id FROM auth.users WHERE lower(trim(email)) = 'brett.gasaway2001@gmail.com'
);
