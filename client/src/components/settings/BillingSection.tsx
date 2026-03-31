import { useCallback, useEffect, useRef, useState } from 'react'
import { Landmark, CreditCard } from 'lucide-react'
import { ReferralDiscountBanner } from '@/components/ReferralDiscountBanner'
import { LinkBankAccountPanel } from '@/components/stripe/LinkBankAccountPanel'
import { billingApi, type BillingSummary } from '@/api/billing'
import { SectionHeader, Card, CardHeader, CardBody, Btn } from './SettingsPrimitives'
import { LoadingSkeleton } from '@/components/LoadingSkeleton'
import { BillingPlansModal } from './BillingPlansModal'
import { BillingPaymentMethod } from './BillingPaymentMethod'
import { BillingPaymentHistory } from './BillingPaymentHistory'

function formatStatus(status: string): string {
  const s = (status || '').replace(/_/g, ' ')
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : '—'
}

function formatPeriodEnd(iso: string | null): string {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  } catch {
    return ''
  }
}

function usageRow(
  label: string,
  used: number,
  limit: number | null,
  warn: boolean
) {
  const hasLimit = limit != null && limit > 0
  const pct = hasLimit ? Math.min(100, (used / limit) * 100) : 0
  return (
    <div key={label} style={{ marginBottom: 18 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontSize: 13, fontWeight: 500, color: '#374151' }}>{label}</span>
        <span
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: warn ? '#b91c1c' : '#111',
          }}
        >
          {hasLimit ? `${used} / ${limit}` : `${used}`}
        </span>
      </div>
      {hasLimit ? (
        <div style={{ height: 6, background: '#f0ede8', borderRadius: 3, overflow: 'hidden' }}>
          <div
            style={{
              height: '100%',
              width: `${pct}%`,
              background: warn ? '#b91c1c' : '#111',
              borderRadius: 3,
              transition: 'width 0.3s',
            }}
          />
        </div>
      ) : null}
      {warn && hasLimit ? (
        <div style={{ fontSize: 11, color: '#b91c1c', marginTop: 4 }}>
          Near limit — consider upgrading
        </div>
      ) : null}
    </div>
  )
}

export function BillingSection() {
  const [data, setData] = useState<BillingSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [plansModalOpen, setPlansModalOpen] = useState(false)
  const [billingRefreshKey, setBillingRefreshKey] = useState(0)
  const paymentSectionRef = useRef<HTMLDivElement>(null)

  const bumpBillingRefresh = useCallback(() => {
    setBillingRefreshKey((k) => k + 1)
  }, [])

  const scrollToPaymentMethod = useCallback(() => {
    paymentSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [])

  useEffect(() => {
    let cancelled = false
    const showSkeleton = billingRefreshKey === 0
    if (showSkeleton) {
      setLoading(true)
      setError(null)
    }
    billingApi
      .getSummary()
      .then((d) => {
        if (!cancelled) setData(d)
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load billing')
      })
      .finally(() => {
        if (!cancelled && showSkeleton) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [billingRefreshKey])

  const sub = data?.subscription
  const plan = sub?.plan
  const limits = data?.limits ?? { max_projects: null, max_team_members: null }
  const usage = data?.usage ?? { project_count: 0, team_member_count: 0 }
  const maxP = limits.max_projects
  const maxT = limits.max_team_members
  const projectWarn = maxP != null && maxP > 0 && usage.project_count >= maxP * 0.8
  const teamWarn = maxT != null && maxT > 0 && usage.team_member_count >= maxT * 0.8

  const planName = plan?.name ?? (sub ? 'Subscription' : 'No active subscription')
  const planLine = plan
    ? `${plan.formatted} · Billed ${plan.interval === 'year' ? 'annually' : 'monthly'}`
    : sub
      ? `${formatStatus(sub.status)}${sub.current_period_end ? ` · Renews ${formatPeriodEnd(sub.current_period_end)}` : ''}`
      : 'Choose a plan to unlock the full product.'

  const isEnterprise =
    plan?.name?.toLowerCase().includes('enterprise') ?? false

  const openPortal = () => {
    const url = data?.manage_billing_url
    if (url) window.location.href = url
  }

  if (loading) {
    return (
      <div className="w-full min-w-0" style={{ padding: 24 }}>
        <LoadingSkeleton variant="inline" lines={8} />
      </div>
    )
  }

  return (
    <div className="w-full min-w-0 max-w-full">
      {error && (
        <div
          style={{
            marginBottom: 16,
            padding: 12,
            background: '#fef2f2',
            color: '#b91c1c',
            borderRadius: 8,
          }}
        >
          {error}
        </div>
      )}
      <SectionHeader
        title="Billing & Subscription"
        desc="Plan, payment method, subscription receipts, and bank connection for transactions."
      />
      <ReferralDiscountBanner className="mb-5" />

      <BillingPlansModal
        open={plansModalOpen}
        onClose={() => setPlansModalOpen(false)}
        onSuccess={bumpBillingRefresh}
        onNeedPaymentMethod={scrollToPaymentMethod}
        currentPriceId={data?.subscription?.stripe_price_id ?? null}
      />

      <Card style={{ marginBottom: 16 }}>
        <CardBody>
          <div className="mb-3 flex items-start gap-3.5">
            <div
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#f0ede8] dark:bg-[var(--bg-hover)]"
              aria-hidden
            >
              <Landmark size={20} strokeWidth={1.75} className="text-[#374151] dark:text-[var(--text-muted)]" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[15px] font-bold text-[#111] dark:text-[var(--text-primary)]">
                Bank account (transactions)
              </div>
              <div className="text-[12px] text-[#9ca3af]">
                Stripe Financial Connections · Read-only transaction import
              </div>
            </div>
          </div>
          <LinkBankAccountPanel variant="settings" />
        </CardBody>
      </Card>

      <div ref={paymentSectionRef} id="billing-payment-method">
        <Card style={{ marginBottom: 16 }}>
          <CardBody>
            <div className="mb-3 flex items-start gap-3.5">
              <div
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#f0ede8] dark:bg-[var(--bg-hover)]"
                aria-hidden
              >
                <CreditCard size={20} strokeWidth={1.75} className="text-[#374151] dark:text-[var(--text-muted)]" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[15px] font-bold text-[#111] dark:text-[var(--text-primary)]">
                  Payment method
                </div>
                <div className="text-[12px] text-[#9ca3af]">
                  Card used for subscription charges. Add or replace your card here.
                </div>
              </div>
            </div>
            <BillingPaymentMethod refreshKey={billingRefreshKey} onCardSaved={bumpBillingRefresh} />
          </CardBody>
        </Card>
      </div>

      <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-4">
        <Card style={{ marginBottom: 0 }}>
          <CardHeader title="Current plan" />
          <CardBody>
            <div className="mb-1 flex min-w-0 flex-wrap items-baseline gap-2">
              <span
                className="min-w-0 break-words text-[22px] font-extrabold tracking-tight text-[#111] dark:text-[var(--text-primary)] md:text-[30px]"
                style={{ letterSpacing: '-0.02em' }}
              >
                {planName}
              </span>
              {sub ? (
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    padding: '4px 8px',
                    borderRadius: 999,
                    background:
                      sub.status === 'active' || sub.status === 'trialing' ? '#dcfce7' : '#fef3c7',
                    color:
                      sub.status === 'active' || sub.status === 'trialing' ? '#15803d' : '#b45309',
                  }}
                >
                  {formatStatus(sub.status)}
                </span>
              ) : null}
            </div>
            <div style={{ fontSize: 13, color: '#9ca3af', marginBottom: 12 }}>{planLine}</div>
            {sub?.trial_end && sub.status === 'trialing' ? (
              <div style={{ fontSize: 12, color: '#b45309', marginBottom: 12 }}>
                Trial ends {formatPeriodEnd(sub.trial_end)}
              </div>
            ) : null}
            {sub?.cancel_at_period_end && sub.current_period_end ? (
              <div style={{ fontSize: 12, color: '#b91c1c', marginBottom: 12 }}>
                Cancels at end of billing period ({formatPeriodEnd(sub.current_period_end)})
              </div>
            ) : null}
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              {data?.manage_billing_url ? (
                <Btn className="w-full sm:w-auto" onClick={openPortal}>
                  Manage billing
                </Btn>
              ) : null}
              <button
                type="button"
                className="btn btn-ghost w-full sm:w-auto text-center"
                onClick={() => setPlansModalOpen(true)}
              >
                View plans
              </button>
            </div>
            {!data?.manage_billing_url ? (
              <p className="mt-3 text-[11px] leading-snug text-[#9ca3af]">
                Stripe Customer Portal is not available yet. Use “View plans” to change plans, “Payment method” for your
                card, or contact support to cancel.
              </p>
            ) : null}
          </CardBody>
        </Card>
        <Card style={{ marginBottom: 0 }}>
          <CardHeader title="Usage" />
          <CardBody>
            {usageRow('Projects', usage.project_count, maxP, projectWarn)}
            {usageRow('Team members', usage.team_member_count, maxT, teamWarn)}
          </CardBody>
        </Card>
      </div>

      <Card style={{ marginBottom: 16 }}>
        <CardHeader title="Payment history" desc="Subscription invoices from Stripe" />
        <CardBody>
          <BillingPaymentHistory refreshKey={billingRefreshKey} />
        </CardBody>
      </Card>

      {!isEnterprise ? (
        <Card style={{ width: '100%', maxWidth: '100%' }}>
          <CardBody className="grid w-full min-w-0 max-w-full grid-cols-1 gap-5 md:grid-cols-[minmax(0,1fr)_auto] md:items-center md:gap-8">
            <div className="min-w-0 w-full">
              <div className="mb-1.5 text-[15px] font-bold text-[#111] dark:text-[var(--text-primary)]">
                Need more capacity?
              </div>
              <p className="m-0 w-full text-[14px] leading-relaxed text-[#9ca3af] dark:text-[var(--text-muted)]">
                Upgrade for higher limits, more seats, and priority support. Compare plans here or open billing
                management when available.
              </p>
            </div>
            <div className="flex w-full flex-col gap-2 sm:flex-row sm:flex-wrap md:w-auto md:justify-end">
              <button
                type="button"
                className="btn btn-primary w-full whitespace-nowrap sm:w-auto"
                onClick={() => setPlansModalOpen(true)}
              >
                Compare plans
              </button>
              {data?.manage_billing_url ? (
                <Btn variant="ghost" className="w-full sm:w-auto" onClick={openPortal}>
                  Manage subscription
                </Btn>
              ) : null}
            </div>
          </CardBody>
        </Card>
      ) : null}
    </div>
  )
}
