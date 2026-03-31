-- Stripe Financial Connections idempotent sync (see server/lib/syncStripeBankTransactions.js)
alter table public.bank_transactions add column if not exists stripe_transaction_id text;
alter table public.bank_transactions add column if not exists stripe_status text;
create unique index if not exists bank_transactions_stripe_transaction_id_key on public.bank_transactions (stripe_transaction_id) where stripe_transaction_id is not null;
