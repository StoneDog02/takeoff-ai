-- Affiliate portal: auth link + setup token; profiles.role includes affiliate.
-- Version matches hosted project (Supabase MCP affiliate_portal_auth).

ALTER TABLE public.affiliates
  ADD COLUMN IF NOT EXISTS auth_user_id uuid UNIQUE;

ALTER TABLE public.affiliates
  ADD COLUMN IF NOT EXISTS portal_setup_token text;

ALTER TABLE public.affiliates
  ADD COLUMN IF NOT EXISTS portal_setup_token_expires_at timestamptz;

CREATE INDEX IF NOT EXISTS affiliates_auth_user_id_idx ON public.affiliates (auth_user_id)
  WHERE auth_user_id IS NOT NULL;

COMMENT ON COLUMN public.affiliates.auth_user_id IS 'Set when the partner completes portal signup; used for /affiliate dashboard access.';
COMMENT ON COLUMN public.affiliates.portal_setup_token IS 'Single-use secret for /affiliate/setup until password is set.';

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check CHECK (
    role IN (
      'admin',
      'project_manager',
      'field_supervisor',
      'employee',
      'subcontractor',
      'affiliate'
    )
  );
