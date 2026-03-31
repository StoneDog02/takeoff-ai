import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import type { InvoicePortalResponse } from '@/api/client'
import { InvoiceClientFacing } from '@/components/invoices/InvoiceClientFacing'
import { SectionHeader, Card, CardHeader, CardBody, Field, Input, Select, Btn, SaveRow } from './SettingsPrimitives'
import { settingsApi } from '@/api/settings'
import { LoadingSkeleton } from '@/components/LoadingSkeleton'

const TEMPLATE_OPTIONS = [
  { value: 'standard', label: 'Standard' },
  { value: 'minimal', label: 'Minimal' },
  { value: 'detailed', label: 'Detailed' },
]

const PREVIEW_INVOICE_ID = '00000000-0000-4000-8000-000000000001'

function buildBrandingPreviewInvoice(
  primaryColor: string,
  secondaryColor: string,
  template: string,
  name: string,
  logoUrl: string | null
): InvoicePortalResponse {
  const invoiceTemplateStyle =
    template === 'minimal' || template === 'detailed' ? template : 'standard'
  const displayName = name.trim() || 'Your company'
  return {
    invoice_id: PREVIEW_INVOICE_ID,
    status: 'sent',
    total_amount: 2000,
    amount_due_now: 0,
    due_date: '2026-03-15',
    paid_at: null,
    sent_at: '2026-03-01T12:00:00.000Z',
    projectName: 'Sample project',
    address: '123 Oak Street, Austin, TX 78701',
    clientName: 'Alex Rivera',
    gcName: displayName,
    company: {
      name: displayName,
      logoUrl: logoUrl || null,
      phone: '(555) 123-4567',
      email: 'billing@example.com',
      website: 'www.example.com',
      licenseNumber: 'TX-123456',
      addressLine: '456 Builder Lane, Austin, TX 78702',
    },
    invoice_kind: 'single',
    schedule_rows: [],
    line_items: [
      {
        id: 'preview-1',
        description: 'Demo line — labor & materials',
        quantity: 1,
        unit: 'lot',
        unit_price: 1200,
        total: 1200,
        section: 'Interior',
      },
      {
        id: 'preview-2',
        description: 'Additional scope item',
        quantity: 2,
        unit: 'hr',
        unit_price: 400,
        total: 800,
        section: 'Interior',
      },
    ],
    notes: null,
    terms: null,
    branding: {
      primaryColor,
      secondaryColor,
      invoiceTemplateStyle,
    },
  }
}

export function BrandingSection() {
  const [color, setColor] = useState('#b91c1c')
  const [secondaryColor, setSecondaryColor] = useState('#1e293b')
  const [template, setTemplate] = useState('standard')
  const [companyName, setCompanyName] = useState('')
  const [companyLogoUrl, setCompanyLogoUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    settingsApi
      .getSettings()
      .then((res) => {
        if (cancelled) return
        const c = res.company
        if (c) {
          setCompanyName(c.name?.trim() || '')
          setCompanyLogoUrl(c.logoUrl?.trim() || null)
        }
        const b = res.branding
        if (b) {
          setColor(b.primaryColor || '#b91c1c')
          setSecondaryColor(b.secondaryColor || '#1e293b')
          setTemplate(
            b.invoiceTemplateStyle === 'minimal' || b.invoiceTemplateStyle === 'detailed'
              ? b.invoiceTemplateStyle
              : 'standard'
          )
        }
      })
      .catch((e) => {
        if (!cancelled) setError(e.message)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    try {
      await settingsApi.updateBranding({
        primaryColor: color,
        secondaryColor,
        invoiceTemplateStyle: template,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const previewInvoice = useMemo(
    () => buildBrandingPreviewInvoice(color, secondaryColor, template, companyName, companyLogoUrl),
    [color, secondaryColor, template, companyName, companyLogoUrl]
  )

  if (loading)
    return (
      <div style={{ padding: 24 }}>
        <LoadingSkeleton variant="inline" lines={5} />
      </div>
    )

  return (
    <>
      {error && (
        <div style={{ marginBottom: 16, padding: 12, background: '#fef2f2', color: '#b91c1c', borderRadius: 8 }}>
          {error}
        </div>
      )}
      <SectionHeader
        title="Branding"
        desc="Primary and secondary colors plus invoice template apply to client invoices. Your logo comes from Company Profile."
      />
      <Card>
        <CardHeader title="Visual identity" />
        <CardBody>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-[auto_minmax(0,1fr)] md:items-start">
            <div>
              <Field label="Logo (from Company Profile)">
                <div
                  style={{
                    width: 80,
                    height: 80,
                    borderRadius: 14,
                    border: '2px solid #e8e6e1',
                    background: companyLogoUrl ? 'transparent' : '#fafaf9',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden',
                  }}
                >
                  {companyLogoUrl ? (
                    <img src={companyLogoUrl} style={{ width: '100%', height: '100%', objectFit: 'contain' }} alt="" />
                  ) : (
                    <span style={{ fontSize: 10, color: '#c4bfb8', textAlign: 'center', padding: 6 }}>No logo yet</span>
                  )}
                </div>
                <p className="m-0 mt-2 max-w-[200px] text-[11px] leading-snug text-[#9ca3af]">
                  Upload or change your logo in{' '}
                  <Link to="/settings?section=company" className="font-semibold text-[#b91c1c] underline-offset-2 hover:underline">
                    Company Profile
                  </Link>
                  .
                </p>
              </Field>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Field label="Primary brand color">
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 9,
                      background: color,
                      border: '2px solid #e8e6e1',
                      flexShrink: 0,
                      overflow: 'hidden',
                      position: 'relative',
                      cursor: 'pointer',
                    }}
                  >
                    <input
                      type="color"
                      value={color}
                      onChange={(e) => setColor(e.target.value)}
                      style={{
                        opacity: 0,
                        width: '100%',
                        height: '100%',
                        cursor: 'pointer',
                        position: 'absolute',
                        inset: 0,
                      }}
                    />
                  </div>
                  <Input value={color} onChange={(e) => setColor(e.target.value)} style={{ width: 120 }} />
                </div>
                <p className="m-0 mt-1.5 text-[11px] leading-snug text-[#9ca3af]">Top bar and amount highlights</p>
              </Field>
              <Field label="Secondary brand color">
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 9,
                      background: secondaryColor,
                      border: '2px solid #e8e6e1',
                      flexShrink: 0,
                      overflow: 'hidden',
                      position: 'relative',
                      cursor: 'pointer',
                    }}
                  >
                    <input
                      type="color"
                      value={secondaryColor}
                      onChange={(e) => setSecondaryColor(e.target.value)}
                      style={{
                        opacity: 0,
                        width: '100%',
                        height: '100%',
                        cursor: 'pointer',
                        position: 'absolute',
                        inset: 0,
                      }}
                    />
                  </div>
                  <Input
                    value={secondaryColor}
                    onChange={(e) => setSecondaryColor(e.target.value)}
                    style={{ width: 120 }}
                  />
                </div>
                <p className="m-0 mt-1.5 text-[11px] leading-snug text-[#9ca3af]">Section titles and eyebrow text</p>
              </Field>
              <Field label="Invoice template">
                <Select value={template} onChange={(e) => setTemplate(e.target.value)}>
                  {TEMPLATE_OPTIONS.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Preview"
          desc="Live preview of the client invoice layout. Change colors or template above to compare; Save branding to apply to real invoices."
        />
        <CardBody>
          <div
            className="branding-invoice-preview-frame"
            style={{
              maxWidth: 440,
              border: '1px solid #e8e6e1',
              borderRadius: 14,
              overflow: 'auto',
              maxHeight: 'min(520px, 70vh)',
              background: '#fff',
              boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
            }}
          >
            <div
              className={`invoice-portal invoice-portal--tpl-${previewInvoice.branding?.invoiceTemplateStyle ?? 'standard'}`}
              style={{
                ['--invoice-accent' as string]: color,
                ['--invoice-accent-secondary' as string]: secondaryColor,
                minHeight: 0,
                fontFamily: "'DM Sans', system-ui, sans-serif",
              }}
            >
              <div style={{ padding: '12px 14px 16px' }}>
                <InvoiceClientFacing data={previewInvoice} interactiveSchedule={false} />
              </div>
            </div>
          </div>
          <div style={{ marginTop: 16 }}>
            <SaveRow>
              <Btn onClick={handleSave} disabled={saving}>
                {saving ? 'Saving…' : 'Save branding'}
              </Btn>
            </SaveRow>
          </div>
        </CardBody>
      </Card>
    </>
  )
}
