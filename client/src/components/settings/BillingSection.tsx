import { SectionHeader, Card, CardHeader, CardBody, Btn } from './SettingsPrimitives'

export function BillingSection() {
  const projectPct = (12 / 25) * 100
  const seatPct = (8 / 10) * 100

  return (
    <>
      <SectionHeader title="Billing & Subscription" desc="Manage your plan and view usage." />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        <Card style={{ marginBottom: 0 }}>
          <CardHeader title="Current plan" />
          <CardBody>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 4 }}>
              <span style={{ fontSize: 30, fontWeight: 800, color: '#111', letterSpacing: '-0.02em' }}>Professional</span>
            </div>
            <div style={{ fontSize: 13, color: '#9ca3af', marginBottom: 20 }}>$99 / month · Billed monthly</div>
            <Btn variant="ghost">Change plan</Btn>
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
        <CardBody style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, color: '#111', marginBottom: 3 }}>Upgrade to Enterprise</div>
            <div style={{ fontSize: 13, color: '#9ca3af' }}>Unlimited projects, seats, and priority support. Contact sales for custom pricing.</div>
          </div>
          <Btn style={{ whiteSpace: 'nowrap' }}>Upgrade plan →</Btn>
        </CardBody>
      </Card>
    </>
  )
}
