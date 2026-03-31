/**
 * Pull Stripe Financial Connections transactions into public.bank_transactions.
 * Uses service-role Supabase (bypasses RLS). Preserves user tagging on updates.
 */

function mapStripeTransaction(tx, userId, accountId) {
  const cents = Number(tx.amount ?? 0)
  const isDebit = cents < 0
  const absDollars = Math.abs(cents) / 100
  const transactedAt = tx.transacted_at
  const d =
    typeof transactedAt === 'number'
      ? new Date(transactedAt * 1000)
      : new Date()
  const transactionDate = d.toISOString().slice(0, 10)
  return {
    user_id: userId,
    stripe_transaction_id: tx.id,
    stripe_status: tx.status || null,
    account_id: accountId,
    merchant_name: (tx.description && String(tx.description).trim()) || 'Transaction',
    amount: absDollars,
    is_debit: isDebit,
    transaction_date: transactionDate,
  }
}

/**
 * @param {object} opts
 * @param {import('stripe').Stripe} opts.stripe
 * @param {import('@supabase/supabase-js').SupabaseClient} opts.supabase
 * @param {string} opts.userId
 * @param {string} opts.customerId - Stripe Customer id (cus_...)
 * @param {string} [opts.onlyAccountId] - if set, only sync this Financial Connections account (fca_...)
 * @returns {Promise<{ synced: number, accounts: number, error?: string }>}
 */
async function syncStripeBankTransactionsForUser(opts) {
  const { stripe, supabase, userId, customerId, onlyAccountId } = opts
  if (!stripe || !supabase || !userId || !customerId) {
    return { synced: 0, accounts: 0, error: 'missing_parameters' }
  }

  let accounts = []
  try {
    const list = await stripe.financialConnections.accounts.list({
      account_holder: { customer: customerId },
      limit: 100,
    })
    accounts = list.data || []
  } catch (err) {
    return { synced: 0, accounts: 0, error: err instanceof Error ? err.message : 'list_accounts_failed' }
  }

  if (onlyAccountId) {
    accounts = accounts.filter((a) => a.id === onlyAccountId)
  }

  let synced = 0

  for (const account of accounts) {
    const accountId = account.id
    try {
      await stripe.financialConnections.accounts.subscribe(accountId, {
        features: ['transactions'],
      })
    } catch {
      // already subscribed or inactive
    }
    try {
      await stripe.financialConnections.accounts.refresh(accountId, {
        features: ['transactions'],
      })
    } catch {
      // rate-limited or refresh not available yet
    }

    let startingAfter
    for (;;) {
      const page = await stripe.financialConnections.transactions.list({
        account: accountId,
        limit: 100,
        ...(startingAfter ? { starting_after: startingAfter } : {}),
      })
      const batch = page.data || []
      for (const tx of batch) {
        const n = await upsertOneTransaction({ supabase, userId, accountId, tx })
        synced += n
      }
      if (!page.has_more || batch.length === 0) break
      startingAfter = batch[batch.length - 1].id
    }
  }

  return { synced, accounts: accounts.length }
}

async function upsertOneTransaction({ supabase, userId, accountId, tx }) {
  const { data: existing, error: selErr } = await supabase
    .from('bank_transactions')
    .select('id, job_id, expense_type, notes, receipt_url, is_payroll')
    .eq('stripe_transaction_id', tx.id)
    .maybeSingle()

  if (selErr) {
    console.error('[syncStripeBankTransactions] select:', selErr.message)
    return 0
  }

  if (tx.status === 'void') {
    if (existing?.id) {
      const { error: delErr } = await supabase.from('bank_transactions').delete().eq('id', existing.id)
      if (delErr) console.error('[syncStripeBankTransactions] delete void:', delErr.message)
    }
    return 0
  }

  const mapped = mapStripeTransaction(tx, userId, accountId)

  if (existing?.id) {
    const { error: upErr } = await supabase
      .from('bank_transactions')
      .update({
        merchant_name: mapped.merchant_name,
        amount: mapped.amount,
        is_debit: mapped.is_debit,
        transaction_date: mapped.transaction_date,
        stripe_status: mapped.stripe_status,
        account_id: mapped.account_id,
      })
      .eq('id', existing.id)
    if (upErr) {
      console.error('[syncStripeBankTransactions] update:', upErr.message)
      return 0
    }
    return 1
  }

  const insertRow = {
    ...mapped,
    job_id: null,
    expense_type: null,
    is_payroll: false,
    receipt_url: null,
    notes: null,
  }

  const { error: insErr } = await supabase.from('bank_transactions').insert(insertRow)
  if (insErr) {
    console.error('[syncStripeBankTransactions] insert:', insErr.message)
    return 0
  }
  return 1
}

/**
 * Find app user + Stripe customer for a Financial Connections account id (webhook).
 */
async function findUserForFcAccount(supabase, accountId) {
  const { data: row, error } = await supabase
    .from('user_financial_connections')
    .select('user_id, stripe_customer_id')
    .contains('account_ids', [accountId])
    .maybeSingle()
  if (!error && row?.user_id && row.stripe_customer_id) {
    return { userId: row.user_id, customerId: row.stripe_customer_id }
  }
  const { data: rows } = await supabase.from('user_financial_connections').select('user_id, stripe_customer_id, account_ids')
  const found = (rows || []).find((r) => Array.isArray(r.account_ids) && r.account_ids.includes(accountId))
  if (!found?.user_id || !found.stripe_customer_id) return null
  return { userId: found.user_id, customerId: found.stripe_customer_id }
}

module.exports = {
  syncStripeBankTransactionsForUser,
  findUserForFcAccount,
}
