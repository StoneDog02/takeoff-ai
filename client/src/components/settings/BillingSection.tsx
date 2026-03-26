import { SectionHeader, Card, CardHeader, CardBody, Btn } from './SettingsPrimitives'

export function BillingSection() {
  const projectPct = (12 / 25) * 100
  const seatPct = (8 / 10) * 100

  return (
    <>
      <SectionHeader title="Billing & Subscription" desc="Manage your plan and view usage." />
      <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-4">
        <Card style={{ marginBottom: 0 }}>
          <CardHeader title="Current plan" />
          <CardBody>
            <div className="mb-1 flex min-w-0 items-baseline gap-1.5">
              <span
                className="min-w-0 break-words text-[22px] font-extrabold tracking-tight text-[#111] dark:text-[var(--text-primary)] md:text-[30px]"
                style={{ letterSpacing: '-0.02em' }}
              >
                Professional
              </span>
            </div>
            <div style={{ fontSize: 13, color: '#9ca3af', marginBottom: 20 }}>$99 / month · Billed monthly</div>
            <Btn variant="ghost" className="w-full md:w-auto">
              Change plan
            </Btn>
          </CardBody>
        </Card>
        <Card style={{ marginBottom: 0 }}>
          <CardHeader title="Usage this period" />
          <CardBody>
            {[
              { label: 'Projects', used: 12, limit: 25, pct: projectPct, warn: false },
              { label: 'Team seats', used: 8, limit: 10, pct: seatPct, warn: true },
            ].map((item) => (
              <div key={item.label} style={{ marginBottom: 18 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: 500, color: '#374151' }}>{item.label}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: item.warn ? '#b91c1c' : '#111' }}>{item.used} / {item.limit}</span>
                </div>
                <div style={{ height: 6, background: '#f0ede8', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${item.pct}%`, background: item.warn ? '#b91c1c' : '#111', borderRadius: 3, transition: 'width 0.3s' }} />
                </div>
                {item.warn && <div style={{ fontSize: 11, color: '#b91c1c', marginTop: 4 }}>⚠ Near limit — consider upgrading</div>}
              </div>
            ))}
          </CardBody>
        </Card>
      </div>
      <Card>
        <CardBody className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between md:gap-6">
          <div className="min-w-0 flex-1">
            <div className="mb-1 text-[15px] font-bold text-[#111] dark:text-[var(--text-primary)]">
              Upgrade to Enterprise
            </div>
            <div className="mb-2 text-[13px] leading-snug text-[#9ca3af]">
              Unlimited projects, seats, and priority support. Contact sales for custom pricing.
            </div>
          </div>
          <Btn className="w-full shrink-0 whitespace-nowrap md:w-auto">Upgrade plan →</Btn>
        </CardBody>
      </Card>
    </>
  )
}
