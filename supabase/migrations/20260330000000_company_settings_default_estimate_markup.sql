-- Default estimate markup % for new estimate category rows (GC setting)
ALTER TABLE company_settings
  ADD COLUMN IF NOT EXISTS default_estimate_markup_pct numeric;

COMMENT ON COLUMN company_settings.default_estimate_markup_pct IS 'Default % markup applied to takeoff/bid category rows in Build Estimate; null = use app default (15)';
