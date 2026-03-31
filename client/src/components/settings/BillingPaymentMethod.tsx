import { useCallback, useEffect, useState } from 'react'
import { CardElement, useElements, useStripe } from '@stripe/react-stripe-js'
import { stripeBillingApi, type StripePaymentMethodSummary } from '@/api/stripeBilling'
import { isStripeConfigured } from '@/lib/stripe'
import { Btn } from './SettingsPrimitives'

function brandLabel(brand: string): string {
  const b = (brand || 'card').toLowerCase()
  return b.charAt(0).toUpperCase() + b.slice(1)
}

type BillingPaymentMethodProps = {
  refreshKey?: number
  onCardSaved?: () => void
}

export function BillingPaymentMethod({ refreshKey = 0, onCardSaved }: BillingPaymentMethodProps) {
  const stripe = useStripe()
  const elements = useElements()
  const [pm, setPm] = useState<StripePaymentMethodSummary>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [saveLoading, setSaveLoading] = useState(false)
  const [cardComplete, setCardComplete] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    setError(null)
    stripeBillingApi
      .getPaymentMethod()
      .then((r) => setPm(r.payment_method))
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load card'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    load()
  }, [load, refreshKey])

  const handleSaveCard = async () => {
    if (!stripe || !elements) {
      setError('Payment form is not ready.')
      return
    }
    const card = elements.getElement(CardElement)
    if (!card) {
      setError('Card field is not ready.')
      return
    }
    setSaveLoading(true)
    setError(null)
    try {
      const { client_secret: clientSecret } = await stripeBillingApi.createBillingSetupIntent()
      if (!clientSecret) {
        setError('Could not start card setup.')
        return
      }
      const { error: confirmError, setupIntent } = await stripe.confirmCardSetup(clientSecret, {
        payment_method: { card },
      })
      if (confirmError) {
        setError(confirmError.message || 'Card verification failed.')
        return
      }
      const rawPm = setupIntent?.payment_method
      const pmId = typeof rawPm === 'string' ? rawPm : rawPm && typeof rawPm === 'object' && 'id' in rawPm ? rawPm.id : null
      if (pmId) {
        await stripeBillingApi.setDefaultPaymentMethod(pmId)
      }
      setAdding(false)
      setCardComplete(false)
      await load()
      onCardSaved?.()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save card.')
    } finally {
      setSaveLoading(false)
    }
  }

  if (!isStripeConfigured) {
    return (
      <p className="m-0 text-[13px] text-[#9ca3af]">
        Card billing is not configured (missing publishable key). Add{' '}
        <code className="rounded bg-black/5 px-1 text-[12px] dark:bg-white/10">VITE_STRIPE_PUBLISHABLE_KEY</code> to
        enable saved cards.
      </p>
    )
  }

  if (!stripe || !elements) {
    return <p className="m-0 text-[13px] text-[#9ca3af]">Loading payment form…</p>
  }

  return (
    <div>
      {error && (
        <div
          className="mb-3 rounded-lg px-3 py-2 text-[13px] text-red-700"
          style={{ background: '#fef2f2' }}
        >
          {error}
        </div>
      )}
      {loading ? (
        <p className="m-0 text-[13px] text-[#9ca3af]">Loading payment method…</p>
      ) : pm && !adding ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-[15px] font-semibold text-[#111] dark:text-[var(--text-primary)]">
              {brandLabel(pm.brand)} ···· {pm.last4}
            </div>
            {pm.exp_month != null && pm.exp_year != null ? (
              <div className="text-[12px] text-[#9ca3af]">
                Expires {pm.exp_month}/{pm.exp_year}
              </div>
            ) : null}
          </div>
          <Btn variant="ghost" className="w-full sm:w-auto" type="button" onClick={() => setAdding(true)}>
            Replace card
          </Btn>
        </div>
      ) : (
        <div>
          <div
            className="mb-3 rounded-lg border border-[#e8e6e1] bg-[#fafaf9] p-3 dark:border-[var(--border)] dark:bg-[var(--bg-hover)]"
          >
            <CardElement
              options={{
                style: {
                  base: {
                    fontSize: '14px',
                    fontFamily: "'DM Sans', sans-serif",
                    color: typeof document !== 'undefined' && document.documentElement.classList.contains('dark')
                      ? '#f3f4f6'
                      : '#111',
                  },
                },
              }}
              onChange={(e) => {
                setCardComplete(e.complete && !e.error)
              }}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {pm ? (
              <Btn variant="ghost" type="button" onClick={() => setAdding(false)} disabled={saveLoading}>
                Cancel
              </Btn>
            ) : null}
            <Btn type="button" onClick={handleSaveCard} disabled={saveLoading || !cardComplete}>
              {saveLoading ? 'Saving…' : pm ? 'Save new card' : 'Save card'}
            </Btn>
          </div>
          <p className="mt-2 text-[11px] text-[#9ca3af]">Secured by Stripe.</p>
        </div>
      )}
    </div>
  )
}
