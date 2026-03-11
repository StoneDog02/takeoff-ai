import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { BarChart2, CreditCard, PenTool, Map } from 'lucide-react'
import type { Integration } from '@/types/global'
import { settingsApi } from '@/api/settings'
import { quickbooksApi } from '@/api/quickbooks'
import { SectionHeader, Card, CardBody, Label, Input, Btn } from './SettingsPrimitives'

const INTEGRATIONS: (Omit<Integration, 'connected' | 'config'> & { category: string; desc: string; Icon: typeof BarChart2; apiKey?: boolean })[] = [
  { id: 'quickbooks', name: 'QuickBooks', category: 'Accounting', desc: 'Sync invoices and expenses', Icon: BarChart2 },
  { id: 'stripe', name: 'Stripe', category: 'Payments', desc: 'Accept payments online', Icon: CreditCard },
  { id: 'docusign', name: 'DocuSign', category: 'E-Signature', desc: 'Send documents for signature', Icon: PenTool },
  { id: 'google-maps', name: 'Google Maps', category: 'Mapping', desc: 'Jobsite mapping & directions', Icon: Map, apiKey: true },
]

export function IntegrationsSection() {
  const [states, setStates] = useState<Record<string, boolean>>({})
  const [keys, setKeys] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [searchParams, setSearchParams] = useSearchParams()

  const fetchIntegrations = () => {
    return settingsApi.getSettings().then((res) => {
      const map: Record<string, boolean> = {}
      for (const item of INTEGRATIONS) map[item.id] = false
      for (const conn of res.integrations || []) {
        if (conn.integration_id in map) map[conn.integration_id] = conn.connected
      }
      setStates(map)
    })
  }

  useEffect(() => {
    let cancelled = false
    fetchIntegrations()
      .catch((e) => { if (!cancelled) setError(e.message) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    const qb = searchParams.get('quickbooks')
    if (qb === 'connected') {
      setError(null)
      fetchIntegrations()
      setSearchParams((p) => { p.delete('quickbooks'); return p }, { replace: true })
    } else if (qb === 'error') {
      setError(searchParams.get('message') || 'QuickBooks connection failed')
      setSearchParams((p) => { p.delete('quickbooks'); p.delete('message'); return p }, { replace: true })
    }
  }, [searchParams, setSearchParams])

  const setConnected = async (integrationId: string, connected: boolean, config?: Record<string, unknown>) => {
    setUpdating(integrationId)
    setError(null)
    try {
      await settingsApi.updateIntegration(integrationId, { connected, config })
      setStates((s) => ({ ...s, [integrationId]: connected }))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed')
    } finally {
      setUpdating(null)
    }
  }

  if (loading) return <div style={{ padding: 24, color: '#6b7280' }}>Loading…</div>

  return (
    <>
      {error && <div style={{ marginBottom: 16, padding: 12, background: '#fef2f2', color: '#b91c1c', borderRadius: 8 }}>{error}</div>}
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
                <Btn variant="ghost" onClick={() => setConnected(item.id, false)} disabled={!!updating}>
                  {updating === item.id ? 'Updating…' : 'Disconnect'}
                </Btn>
              ) : item.id === 'quickbooks' ? (
                <Btn
                  onClick={async () => {
                    setUpdating('quickbooks')
                    setError(null)
                    try {
                      const { url } = await quickbooksApi.getConnectUrl()
                      window.location.href = url
                    } catch (e) {
                      setError(e instanceof Error ? e.message : 'Connect failed')
                      setUpdating(null)
                    }
                  }}
                  disabled={!!updating}
                >
                  {updating === 'quickbooks' ? 'Connecting…' : 'Connect'}
                </Btn>
              ) : (
                <Btn
                  onClick={() => setConnected(item.id, true, item.apiKey && keys[item.id] ? { apiKey: keys[item.id] } : undefined)}
                  disabled={!!updating}
                >
                  {updating === item.id ? 'Connecting…' : 'Connect'}
                </Btn>
              )}
            </CardBody>
          </Card>
        ))}
      </div>
    </>
  )
}
