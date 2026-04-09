-- Client invoice portal: offline payment copy + optional Stripe Checkout for card
ALTER TABLE company_settings
  ADD COLUMN IF NOT EXISTS invoice_payment_config jsonb DEFAULT '{}'::jsonb;

COMMENT ON COLUMN company_settings.invoice_payment_config IS
  'JSON: { cash, check, ach, card booleans; check_instructions, ach_instructions; stripe_connect_account_id (optional acct_ for Connect transfers) }';
