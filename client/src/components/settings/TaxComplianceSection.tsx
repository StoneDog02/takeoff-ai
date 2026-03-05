import { useState } from 'react'
import { dayjs } from '@/lib/date'
import { SectionHeader, Card, CardHeader, CardBody, Field, Input, Btn, SaveRow } from './SettingsPrimitives'

function isExpiringWithin30Days(dateStr: string | undefined): boolean {
  if (!dateStr) return false
  const d = dayjs(dateStr)
  const diff = d.diff(dayjs(), 'day', true)
  return diff >= 0 && diff <= 30
}

export function TaxComplianceSection() {
  const [rates, setRates] = useState<{ id: string; name: string; rate: string }[]>([{ id: '1', name: 'State', rate: '6.5' }])
  const [license, setLicense] = useState('')
  const [insuranceExpiry, setInsuranceExpiry] = useState('2025-06-15')
  const showInsuranceAlert = isExpiringWithin30Days(insuranceExpiry)

  const addRate = () => setRates((r) => [...r, { id: crypto.randomUUID(), name: '', rate: '' }])
  const removeRate = (i: number) => setRates((r) => r.filter((_, idx) => idx !== i))
  const updateRate = (i: number, field: 'name' | 'rate', value: string) => {
    setRates((r) => r.map((x, idx) => (idx === i ? { ...x, [field]: value } : x)))
  }

  return (
    <>
      <SectionHeader
        title="Tax & Compliance"
        desc="Default tax rates, contractor license, and insurance expiry. You will be alerted when insurance expires within 30 days."
      />
      <Card>
        <CardHeader title="Default tax rates" desc="Applied to taxable line items on estimates and invoices" />
        <CardBody>
          {rates.map((rate, i) => (
            <div key={rate.id} style={{ display: 'grid', gridTemplateColumns: '1fr 120px auto', gap: 12, alignItems: 'flex-end', marginBottom: 10 }}>
              <Field label={i === 0 ? 'Name' : ''}>
                <Input value={rate.name} onChange={(e) => updateRate(i, 'name', e.target.value)} placeholder="e.g. State, County" />
              </Field>
              <Field label={i === 0 ? 'Rate %' : ''}>
                <div style={{ position: 'relative' }}>
                  <Input type="number" step={0.01} value={rate.rate} onChange={(e) => updateRate(i, 'rate', e.target.value)} />
                  <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: '#9ca3af' }}>%</span>
                </div>
              </Field>
              <button
                type="button"
                onClick={() => removeRate(i)}
                style={{ padding: '10px 12px', border: '1px solid #fecaca', borderRadius: 9, background: '#fff', cursor: 'pointer', color: '#b91c1c', fontSize: 13, fontFamily: 'inherit' }}
              >
                Remove
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={addRate}
            style={{ border: '1px dashed #d1d5db', borderRadius: 9, padding: '8px 18px', background: 'transparent', cursor: 'pointer', fontSize: 13, color: '#9ca3af', fontFamily: 'inherit', marginTop: 4 }}
          >
            + Add rate
          </button>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Contractor license" />
        <CardBody>
          <Field label="License number">
            <Input value={license} onChange={(e) => setLicense(e.target.value)} placeholder="e.g. CGC-1234567" />
          </Field>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Insurance expiry date" desc="You'll receive an alert 30 days before expiry" />
        <CardBody>
          <Field label="Expiry date">
            <Input type="date" value={insuranceExpiry} onChange={(e) => setInsuranceExpiry(e.target.value)} style={{ width: 'auto' }} />
          </Field>
          {showInsuranceAlert && (
            <div style={{ marginTop: 10, display: 'inline-flex', alignItems: 'center', gap: 6, background: '#fee2e2', color: '#b91c1c', borderRadius: 8, padding: '6px 12px', fontSize: 12, fontWeight: 600 }}>
              Insurance expiring within 30 days — please renew
            </div>
          )}
        </CardBody>
      </Card>
      <Card style={{ marginBottom: 0 }}>
        <CardBody>
          <SaveRow>
            <Btn>Save compliance info</Btn>
          </SaveRow>
        </CardBody>
      </Card>
    </>
  )
}
