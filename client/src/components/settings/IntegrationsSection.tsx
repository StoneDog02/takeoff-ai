import { useState } from 'react'
import { BarChart2, CreditCard, PenTool, Map } from 'lucide-react'
import type { Integration } from '@/types/global'
import { SectionHeader, Card, CardBody, Label, Input, Btn } from './SettingsPrimitives'

const INTEGRATIONS: (Omit<Integration, 'connected' | 'config'> & { category: string; desc: string; Icon: typeof BarChart2; apiKey?: boolean })[] = [
  { id: 'quickbooks', name: 'QuickBooks', category: 'Accounting', desc: 'Sync invoices and expenses', Icon: BarChart2 },
  { id: 'stripe', name: 'Stripe', category: 'Payments', desc: 'Accept payments online', Icon: CreditCard },
  { id: 'docusign', name: 'DocuSign', category: 'E-Signature', desc: 'Send documents for signature', Icon: PenTool },
  { id: 'google-maps', name: 'Google Maps', category: 'Mapping', desc: 'Jobsite mapping & directions', Icon: Map, apiKey: true },
]

export function IntegrationsSection() {
  const [states, setStates] = useState<Record<string, boolean>>({
    quickbooks: false,
    stripe: false,
    docusign: true,
    'google-maps': false,
  })
  const [keys, setKeys] = useState<Record<string, string>>({})

  return (
    <>
      <SectionHeader title="Integrations" desc="Connect accounting, payments, e-sign, and maps." />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {INTEGRATIONS.map((item) => (
          <Card key={item.id} style={{ marginBottom: 0 }}>
            <CardBody>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
                <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                  <div style={{ width: 44, height: 44, borderRadius: 12, background: '#f0ede8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <item.Icon size={20} strokeWidth={1.75} color="#374151" />
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 15, color: '#111' }}>{item.name}</div>
                    <div style={{ fontSize: 12, color: '#9ca3af' }}>{item.category} · {item.desc}</div>
                  </div>
                </div>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    padding: '4px 10px',
                    borderRadius: 20,
                    background: states[item.id] ? '#dcfce7' : '#f1f0ed',
                    color: states[item.id] ? '#15803d' : '#9ca3af',
                  }}
                >
                  {states[item.id] ? 'Connected' : 'Not connected'}
                </span>
              </div>
              {item.apiKey && !states[item.id] && (
                <div style={{ marginBottom: 10 }}>
                  <Label>API Key</Label>
                  <Input
                    placeholder="Optional — enter key"
                    value={keys[item.id] ?? ''}
                    onChange={(e) => setKeys((k) => ({ ...k, [item.id]: e.target.value }))}
                  />
                </div>
              )}
              {states[item.id] ? (
                <Btn variant="ghost" onClick={() => setStates((s) => ({ ...s, [item.id]: false }))}>
                  Disconnect
                </Btn>
              ) : (
                <Btn onClick={() => setStates((s) => ({ ...s, [item.id]: true }))}>Connect</Btn>
              )}
            </CardBody>
          </Card>
        ))}
      </div>
    </>
  )
}
