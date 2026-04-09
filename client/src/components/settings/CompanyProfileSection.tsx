import { useState, useRef, useEffect } from 'react'
import type { CompanyProfile, CompanyAddress, CompanyInvoicePaymentSettings } from '@/types/global'
import { settingsApi } from '@/api/settings'
import {
  SectionHeader,
  Card,
  CardHeader,
  CardBody,
  Field,
  FieldRow,
  Input,
  Btn,
  SaveRow,
} from './SettingsPrimitives'
import { LoadingSkeleton } from '@/components/LoadingSkeleton'

const defaultAddress: CompanyAddress = {
  line1: '',
  line2: '',
  city: '',
  state: '',
  zip: '',
}

const defaultInvoicePayment: CompanyInvoicePaymentSettings = {
  cash: true,
  check: true,
  ach: true,
  card: false,
  checkInstructions: '',
  achInstructions: '',
  cashNote: '',
  stripeConnectAccountId: null,
}

const defaultProfile: CompanyProfile = {
  name: '',
  address: { ...defaultAddress },
  phone: '',
  email: '',
  invoicePayment: { ...defaultInvoicePayment },
}

export function CompanyProfileSection() {
  const [profile, setProfile] = useState<CompanyProfile>(defaultProfile)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let cancelled = false
    settingsApi.getSettings().then((res) => {
      if (cancelled) return
      const c = res.company
      if (c) {
        setProfile({
          name: c.name ?? '',
          logoUrl: c.logoUrl ?? undefined,
          licenseNumber: c.licenseNumber ?? undefined,
          address: c.address ?? { ...defaultAddress },
          phone: c.phone ?? '',
          email: c.email ?? '',
          website: c.website ?? undefined,
          defaultEstimateMarkupPct:
            c.defaultEstimateMarkupPct != null && Number.isFinite(Number(c.defaultEstimateMarkupPct))
              ? Number(c.defaultEstimateMarkupPct)
              : null,
          invoicePayment: c.invoicePayment ? { ...defaultInvoicePayment, ...c.invoicePayment } : { ...defaultInvoicePayment },
        })
        if (c.logoUrl) setLogoPreview(c.logoUrl)
      }
    }).catch((e) => { if (!cancelled) setError(e.message) }).finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  const handleLogoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => setLogoPreview(ev.target?.result as string)
    reader.readAsDataURL(file)
    setSaving(true)
    setError(null)
    try {
      const { url } = await settingsApi.uploadLogo(file, 'company')
      if (url) {
        const next = { ...profile, logoUrl: url }
        setProfile(next)
        await settingsApi.updateCompany(next)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setSaving(false)
    }
  }

  const update = <K extends keyof CompanyProfile>(key: K, value: CompanyProfile[K]) => {
    setProfile((p) => ({ ...p, [key]: value }))
  }

  const updateAddress = <K extends keyof CompanyAddress>(key: K, value: CompanyAddress[K]) => {
    setProfile((p) => ({ ...p, address: { ...p.address, [key]: value } }))
  }

  const updateInvoicePayment = <K extends keyof CompanyInvoicePaymentSettings>(key: K, value: CompanyInvoicePaymentSettings[K]) => {
    setProfile((p) => ({
      ...p,
      invoicePayment: { ...defaultInvoicePayment, ...p.invoicePayment, [key]: value },
    }))
  }

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    try {
      await settingsApi.updateCompany(profile)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div style={{ padding: 24 }}><LoadingSkeleton variant="inline" lines={5} /></div>

  return (
    <>
      {error && <div style={{ marginBottom: 16, padding: 12, background: '#fef2f2', color: '#b91c1c', borderRadius: 8 }}>{error}</div>}
      <SectionHeader
        title="Company Profile"
        desc="This information appears on estimates, invoices, and proposals."
      />
      <Card>
        <CardHeader title="Identity" />
        <CardBody>
          <FieldRow cols="1fr 1fr">
            <Field label="Company Name">
              <Input value={profile.name} onChange={(e) => update('name', e.target.value)} />
            </Field>
            <Field label="License Number" hint="optional">
              <Input
                value={profile.licenseNumber ?? ''}
                onChange={(e) => update('licenseNumber', e.target.value || undefined)}
                placeholder="e.g. CGC-1234567"
              />
            </Field>
          </FieldRow>
          <Field label="Logo">
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 4 }}>
              <div
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: 12,
                  border: '2px dashed #e8e6e1',
                  background: logoPreview ? 'transparent' : '#fafaf9',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden',
                  flexShrink: 0,
                }}
              >
                {logoPreview ? (
                  <img
                    src={logoPreview}
                    alt="Logo"
                    style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                  />
                ) : (
                  <span style={{ fontSize: 11, color: '#c4bfb8' }}>No logo</span>
                )}
              </div>
              <div>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={handleLogoChange}
                />
                <Btn variant="ghost" onClick={() => fileRef.current?.click()} style={{ marginBottom: 6 }}>
                  Upload logo
                </Btn>
                <div style={{ fontSize: 11.5, color: '#c4bfb8' }}>PNG, SVG or JPG · Max 2MB</div>
              </div>
            </div>
          </Field>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Address & Contact" />
        <CardBody>
          <FieldRow>
            <Field label="Street Line 1">
              <Input value={profile.address.line1} onChange={(e) => updateAddress('line1', e.target.value)} />
            </Field>
          </FieldRow>
          <FieldRow>
            <Field label="Street Line 2" hint="optional">
              <Input
                value={profile.address.line2 ?? ''}
                onChange={(e) => updateAddress('line2', e.target.value || undefined)}
              />
            </Field>
          </FieldRow>
          <FieldRow cols="1fr 1fr 1fr">
            <Field label="City">
              <Input
                value={profile.address.city}
                onChange={(e) => updateAddress('city', e.target.value)}
                placeholder="City"
              />
            </Field>
            <Field label="State">
              <Input
                value={profile.address.state}
                onChange={(e) => updateAddress('state', e.target.value)}
                placeholder="State"
              />
            </Field>
            <Field label="ZIP">
              <Input
                value={profile.address.zip}
                onChange={(e) => updateAddress('zip', e.target.value)}
                placeholder="ZIP"
              />
            </Field>
          </FieldRow>
          <FieldRow cols="1fr 1fr">
            <Field label="Phone">
              <Input value={profile.phone} onChange={(e) => update('phone', e.target.value)} />
            </Field>
            <Field label="Email">
              <Input value={profile.email} onChange={(e) => update('email', e.target.value)} />
            </Field>
          </FieldRow>
          <FieldRow>
            <Field label="Website">
              <Input
                value={profile.website ?? ''}
                onChange={(e) => update('website', e.target.value || undefined)}
                placeholder="https://example.com"
              />
            </Field>
          </FieldRow>
          <FieldRow cols="1fr 1fr">
            <Field
              label="Default estimate markup"
              hint="Takeoff & sub-bid category rows when building an estimate. Leave blank to use 15%."
            >
              <Input
                type="number"
                min={0}
                max={500}
                step={0.5}
                value={profile.defaultEstimateMarkupPct ?? ''}
                onChange={(e) => {
                  const v = e.target.value.trim()
                  if (v === '') update('defaultEstimateMarkupPct', null)
                  else {
                    const n = Number(v)
                    update('defaultEstimateMarkupPct', Number.isFinite(n) ? n : null)
                  }
                }}
                placeholder="15"
              />
            </Field>
          </FieldRow>
          <SaveRow>
            <Btn onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Save profile'}</Btn>
          </SaveRow>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Customer invoice payments" />
        <CardBody>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '0 0 16px', lineHeight: 1.5 }}>
            These options appear on the public invoice link your clients open from email. Enable card only if{' '}
            <code style={{ fontSize: 12 }}>STRIPE_SECRET_KEY</code> is set on the server. For payouts directly to your bank,
            add your Stripe Connect account id after onboarding at Stripe.
          </p>
          <FieldRow cols="1fr 1fr">
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={profile.invoicePayment?.cash ?? true}
                onChange={(e) => updateInvoicePayment('cash', e.target.checked)}
              />
              Cash
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={profile.invoicePayment?.check ?? true}
                onChange={(e) => updateInvoicePayment('check', e.target.checked)}
              />
              Check
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={profile.invoicePayment?.ach ?? true}
                onChange={(e) => updateInvoicePayment('ach', e.target.checked)}
              />
              ACH / wire
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={profile.invoicePayment?.card ?? false}
                onChange={(e) => updateInvoicePayment('card', e.target.checked)}
              />
              Card (Stripe Checkout)
            </label>
          </FieldRow>
          <Field label="Cash note" hint="optional — e.g. where to drop off payment">
            <Input
              value={profile.invoicePayment?.cashNote ?? ''}
              onChange={(e) => updateInvoicePayment('cashNote', e.target.value)}
              placeholder="e.g. Pay at our office front desk weekdays 8–5"
            />
          </Field>
          <Field label="Check instructions" hint="payable to, mailing address">
            <textarea
              value={profile.invoicePayment?.checkInstructions ?? ''}
              onChange={(e) => updateInvoicePayment('checkInstructions', e.target.value)}
              rows={3}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: 8,
                border: '1px solid var(--border)',
                fontFamily: 'inherit',
                fontSize: 14,
                resize: 'vertical',
              }}
            />
          </Field>
          <Field label="ACH / wire instructions" hint="routing, account, reference to include">
            <textarea
              value={profile.invoicePayment?.achInstructions ?? ''}
              onChange={(e) => updateInvoicePayment('achInstructions', e.target.value)}
              rows={4}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: 8,
                border: '1px solid var(--border)',
                fontFamily: 'inherit',
                fontSize: 14,
                resize: 'vertical',
              }}
            />
          </Field>
          <Field
            label="Stripe Connect account id"
            hint="Optional — acct_… from Stripe Dashboard after Connect onboarding; sends card payments to that account."
          >
            <Input
              value={profile.invoicePayment?.stripeConnectAccountId ?? ''}
              onChange={(e) => {
                const v = e.target.value.trim()
                updateInvoicePayment('stripeConnectAccountId', v === '' ? null : v)
              }}
              placeholder="acct_…"
            />
          </Field>
          <SaveRow>
            <Btn onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Save profile'}</Btn>
          </SaveRow>
        </CardBody>
      </Card>
    </>
  )
}
