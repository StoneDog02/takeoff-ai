import { useState, useRef } from 'react'
import { SectionHeader, Card, CardHeader, CardBody, Field, FieldRow, Input, Select, Btn, SaveRow } from './SettingsPrimitives'

const TEMPLATE_OPTIONS = ['Standard', 'Modern', 'Minimal', 'Classic']

export function BrandingSection() {
  const [color, setColor] = useState('#b91c1c')
  const [template, setTemplate] = useState('Standard')
  const [logo, setLogo] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (ev) => setLogo(ev.target?.result as string)
      reader.readAsDataURL(file)
    }
  }

  return (
    <>
      <SectionHeader title="Branding" desc="Logo and primary color appear on invoices and proposals." />
      <Card>
        <CardHeader title="Visual identity" />
        <CardBody>
          <FieldRow cols="auto 1fr">
            <Field label="Logo">
              <div
                style={{
                  width: 80,
                  height: 80,
                  borderRadius: 14,
                  border: '2px dashed #e8e6e1',
                  background: logo ? 'transparent' : '#fafaf9',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  overflow: 'hidden',
                }}
                onClick={() => fileRef.current?.click()}
              >
                {logo ? (
                  <img src={logo} style={{ width: '100%', height: '100%', objectFit: 'contain' }} alt="" />
                ) : (
                  <span style={{ fontSize: 10, color: '#c4bfb8', textAlign: 'center' }}>Click to upload</span>
                )}
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={handleLogoChange}
              />
            </Field>
            <div>
              <FieldRow cols="1fr 1fr">
                <Field label="Primary Brand Color">
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <div style={{ width: 40, height: 40, borderRadius: 9, background: color, border: '2px solid #e8e6e1', flexShrink: 0, overflow: 'hidden', position: 'relative', cursor: 'pointer' }}>
                      <input
                        type="color"
                        value={color}
                        onChange={(e) => setColor(e.target.value)}
                        style={{ opacity: 0, width: '100%', height: '100%', cursor: 'pointer', position: 'absolute', inset: 0 }}
                      />
                    </div>
                    <Input value={color} onChange={(e) => setColor(e.target.value)} style={{ width: 120 }} />
                  </div>
                </Field>
                <Field label="Invoice Template">
                  <Select value={template} onChange={(e) => setTemplate(e.target.value)}>
                    {TEMPLATE_OPTIONS.map((t) => (
                      <option key={t}>{t}</option>
                    ))}
                  </Select>
                </Field>
              </FieldRow>
            </div>
          </FieldRow>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Preview" desc="How your invoice will appear to clients" />
        <CardBody>
          <div style={{ maxWidth: 380, border: '1px solid #e8e6e1', borderRadius: 14, overflow: 'hidden', background: '#fff', boxShadow: '0 4px 24px rgba(0,0,0,0.06)' }}>
            <div style={{ height: 5, background: color }} />
            <div style={{ padding: '20px 22px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: '#111' }}>Company Name</div>
                  <div style={{ fontSize: 11, color: '#9ca3af' }}>Licensed Contractor</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 10, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Invoice</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color }}>#001</div>
                  <div style={{ fontSize: 11, color: '#9ca3af' }}>Due: Mar 15, 2026</div>
                </div>
              </div>
              {[['Item A', '$1,200.00'], ['Item B', '$800.00']].map(([label, val]) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f1f0ed', fontSize: 13 }}>
                  <span style={{ color: '#374151' }}>{label}</span>
                  <span style={{ fontWeight: 600, color: '#111' }}>{val}</span>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0 0', fontSize: 15, fontWeight: 800 }}>
                <span>Total</span>
                <span style={{ color }}> $2,000.00</span>
              </div>
            </div>
          </div>
        </CardBody>
      </Card>
      <Card style={{ marginBottom: 0 }}>
        <CardBody>
          <SaveRow>
            <Btn>Save branding</Btn>
          </SaveRow>
        </CardBody>
      </Card>
    </>
  )
}
