import {
  createFinancialConnectionsSession,
  syncBankTransactionsFromStripe,
  syncFinancialConnections,
} from '@/api/financialConnections'
import { isStripeConfigured, stripePromise } from '@/lib/stripe'

type CollectFcFn = (opts: {
  clientSecret: string
}) => Promise<{
  error?: { message?: string }
  financialConnectionsSession?: { accounts?: { id: string }[] }
}>

/**
 * Opens Stripe Financial Connections for a signed-in user (API session + collect + sync).
 * Use this anywhere the user has a Supabase session but may not have subscription.stripeCustomerId yet.
 */
export async function runFinancialConnectionsLinkForSignedInUser(
  accessToken: string,
): Promise<{ ok: boolean; linked: boolean; errorMessage?: string }> {
  if (!isStripeConfigured || !stripePromise) {
    return { ok: false, linked: false, errorMessage: 'Stripe is not configured.' }
  }
  const stripe = await stripePromise
  if (!stripe) {
    return { ok: false, linked: false, errorMessage: 'Stripe failed to load.' }
  }
  const collect = stripe.collectFinancialConnectionsAccounts as unknown as CollectFcFn | undefined
  if (typeof collect !== 'function') {
    return { ok: false, linked: false, errorMessage: 'Update @stripe/stripe-js to use bank linking.' }
  }

  const { client_secret } = await createFinancialConnectionsSession({ accessToken })
  const result = await collect.call(stripe, { clientSecret: client_secret })
  if (result.error) {
    return {
      ok: false,
      linked: false,
      errorMessage: result.error.message || 'Bank linking was cancelled or failed.',
    }
  }

  const linked = (result.financialConnectionsSession?.accounts?.length ?? 0) > 0
  if (linked) {
    await syncFinancialConnections(accessToken)
    await syncBankTransactionsFromStripe(accessToken).catch(() => {
      /* transactions may lag until Stripe finishes refresh */
    })
  }
  return { ok: true, linked }
}
