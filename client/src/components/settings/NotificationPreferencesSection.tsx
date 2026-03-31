import React, { useState, useEffect, useRef, useCallback } from 'react'
import type { NotificationChannel, NotificationPreferences } from '@/types/global'
import { settingsApi } from '@/api/settings'
import { SectionHeader, Card, Toggle } from './SettingsPrimitives'
import { ViewportTooltip } from './ViewportTooltip'
import { LoadingSkeleton } from '@/components/LoadingSkeleton'

const defaultPrefs: NotificationPreferences = {
  newBids: { email: true, sms: false, push: false },
  invoiceStatus: { email: true, sms: false, push: false },
  clockInOut: { email: false, sms: false, push: false },
  gpsClockOut: { email: true, sms: false, push: false },
  budgetThreshold: { email: true, sms: false, push: false },
}

const NOTIF_EVENT_KEYS: (keyof NotificationPreferences)[] = [
  'newBids',
  'invoiceStatus',
  'clockInOut',
  'gpsClockOut',
  'budgetThreshold',
]

const NOTIF_EVENTS: { id: keyof NotificationPreferences; label: string }[] = [
  { id: 'newBids', label: 'New bids received' },
  { id: 'invoiceStatus', label: 'Invoice status changes' },
  { id: 'clockInOut', label: 'Employee clock-in/out alerts' },
  { id: 'gpsClockOut', label: 'GPS clock-out events' },
  { id: 'budgetThreshold', label: 'Budget threshold warnings' },
]

const CHANNELS: (keyof NotificationChannel)[] = ['email', 'sms', 'push']

const PUSH_DISABLED_TOOLTIP =
  "Push notifications aren't available yet — the app is still in development."

const SMS_DISABLED_TOOLTIP = 'SMS notification coming soon...'

function storedPrefsHadSmsOn(raw: unknown): boolean {
  if (!raw || typeof raw !== 'object') return false
  const o = raw as Record<string, unknown>
  return NOTIF_EVENT_KEYS.some((k) => {
    const ch = o[k as string]
    return ch && typeof ch === 'object' && (ch as Record<string, unknown>).sms === true
  })
}

function coerceChannel(raw: unknown): Partial<NotificationChannel> {
  if (!raw || typeof raw !== 'object') return {}
  const o = raw as Record<string, unknown>
  const out: Partial<NotificationChannel> = {}
  if (typeof o.email === 'boolean') out.email = o.email
  if (typeof o.sms === 'boolean') out.sms = o.sms
  if (typeof o.push === 'boolean') out.push = o.push
  return out
}

/** SMS is disabled in-product; always persist and display as off. */
function withSmsAllOff(p: NotificationPreferences): NotificationPreferences {
  const out = { ...p }
  for (const k of NOTIF_EVENT_KEYS) {
    out[k] = { ...out[k], sms: false }
  }
  return out
}

/** Merge API `prefs` JSON with defaults so missing keys stay predictable. */
function prefsFromApi(raw: unknown): NotificationPreferences {
  if (!raw || typeof raw !== 'object') {
    return withSmsAllOff({
      newBids: { ...defaultPrefs.newBids },
      invoiceStatus: { ...defaultPrefs.invoiceStatus },
      clockInOut: { ...defaultPrefs.clockInOut },
      gpsClockOut: { ...defaultPrefs.gpsClockOut },
      budgetThreshold: { ...defaultPrefs.budgetThreshold },
    })
  }
  const p = raw as Record<string, unknown>
  const out = {} as NotificationPreferences
  for (const k of NOTIF_EVENT_KEYS) {
    out[k] = {
      ...defaultPrefs[k],
      ...coerceChannel(p[k as string]),
    }
  }
  return withSmsAllOff(out)
}

export function NotificationPreferencesSection() {
  const [prefs, setPrefs] = useState<NotificationPreferences>(() => prefsFromApi(null))
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const saveGenerationRef = useRef(0)

  const reloadFromServer = useCallback(async () => {
    const res = await settingsApi.getSettings()
    const raw = res.notification_preferences?.prefs
    const merged = prefsFromApi(raw)
    setPrefs(merged)
    if (storedPrefsHadSmsOn(raw)) {
      try {
        await settingsApi.updateNotificationPreferences(merged)
      } catch {
        /* ignore; user may retry via email toggle */
      }
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    settingsApi
      .getSettings()
      .then(async (res) => {
        if (cancelled) return
        const raw = res.notification_preferences?.prefs
        const merged = prefsFromApi(raw)
        setPrefs(merged)
        if (storedPrefsHadSmsOn(raw)) {
          try {
            await settingsApi.updateNotificationPreferences(merged)
          } catch {
            /* non-blocking */
          }
        }
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load preferences')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const schedulePersist = useCallback(
    (next: NotificationPreferences) => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      saveGenerationRef.current += 1
      const gen = saveGenerationRef.current
      setSaving(true)
      debounceRef.current = setTimeout(async () => {
        debounceRef.current = null
        try {
          await settingsApi.updateNotificationPreferences(withSmsAllOff(next))
          if (gen === saveGenerationRef.current) setError(null)
        } catch (err) {
          if (gen === saveGenerationRef.current) {
            setError(err instanceof Error ? err.message : 'Save failed')
            try {
              await reloadFromServer()
            } catch {
              /* keep UI state if reload fails */
            }
          }
        } finally {
          if (gen === saveGenerationRef.current) setSaving(false)
        }
      }, 450)
    },
    [reloadFromServer]
  )

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  const toggle = (id: keyof NotificationPreferences, ch: keyof NotificationChannel) => {
    if (ch === 'push' || ch === 'sms') return
    setPrefs((p) => {
      const next = withSmsAllOff({
        ...p,
        [id]: { ...p[id], [ch]: !p[id][ch] },
      })
      schedulePersist(next)
      return next
    })
  }

  if (loading) {
    return (
      <div style={{ padding: 24 }}>
        <LoadingSkeleton variant="inline" lines={5} />
      </div>
    )
  }

  return (
    <>
      {error && (
        <div style={{ marginBottom: 16, padding: 12, background: '#fef2f2', color: '#b91c1c', borderRadius: 8 }}>
          {error}
        </div>
      )}
      <SectionHeader
        title="Notification Preferences"
        desc="Choose how you want to be notified for each type of event. Changes save automatically."
      />
      <Card>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 80px 80px', gap: 0 }}>
          <div style={{ padding: '14px 24px', borderBottom: '1px solid #f1f0ed' }}>
            <span
              style={{
                fontSize: 10.5,
                fontWeight: 700,
                letterSpacing: '0.09em',
                textTransform: 'uppercase',
                color: '#c4bfb8',
              }}
            >
              Event
            </span>
          </div>
          {(['Email', 'SMS', 'Push'] as const).map((ch) => (
            <div
              key={ch}
              style={{ padding: '14px 0', borderBottom: '1px solid #f1f0ed', textAlign: 'center' }}
            >
              {ch === 'Push' ? (
                <ViewportTooltip
                  label={PUSH_DISABLED_TOOLTIP}
                  focusable
                  style={{ width: '100%', justifyContent: 'center' }}
                >
                  <span
                    style={{
                      fontSize: 10.5,
                      fontWeight: 700,
                      letterSpacing: '0.09em',
                      textTransform: 'uppercase',
                      color: '#9ca3af',
                      borderBottom: '1px dotted #c4bfb8',
                      cursor: 'help',
                    }}
                  >
                    {ch}
                  </span>
                </ViewportTooltip>
              ) : ch === 'SMS' ? (
                <ViewportTooltip
                  label={SMS_DISABLED_TOOLTIP}
                  focusable
                  style={{ width: '100%', justifyContent: 'center' }}
                >
                  <span
                    style={{
                      fontSize: 10.5,
                      fontWeight: 700,
                      letterSpacing: '0.09em',
                      textTransform: 'uppercase',
                      color: '#9ca3af',
                      borderBottom: '1px dotted #c4bfb8',
                      cursor: 'help',
                    }}
                  >
                    {ch}
                  </span>
                </ViewportTooltip>
              ) : (
                <span
                  style={{
                    fontSize: 10.5,
                    fontWeight: 700,
                    letterSpacing: '0.09em',
                    textTransform: 'uppercase',
                    color: '#c4bfb8',
                  }}
                >
                  {ch}
                </span>
              )}
            </div>
          ))}
          {NOTIF_EVENTS.map((evt, i) => (
            <React.Fragment key={evt.id}>
              <div
                style={{
                  padding: '16px 24px',
                  borderBottom: i < NOTIF_EVENTS.length - 1 ? '1px solid #f9f8f6' : 'none',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <span style={{ fontSize: 14, color: '#111', fontWeight: 500 }}>{evt.label}</span>
              </div>
              {CHANNELS.map((ch) => (
                <div
                  key={`${evt.id}-${ch}`}
                  style={{
                    padding: '16px 0',
                    borderBottom: i < NOTIF_EVENTS.length - 1 ? '1px solid #f9f8f6' : 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {ch === 'push' ? (
                    <ViewportTooltip label={PUSH_DISABLED_TOOLTIP}>
                      <Toggle checked={prefs[evt.id].push} onChange={() => {}} disabled />
                    </ViewportTooltip>
                  ) : ch === 'sms' ? (
                    <ViewportTooltip label={SMS_DISABLED_TOOLTIP}>
                      <Toggle checked={prefs[evt.id].sms} onChange={() => {}} disabled />
                    </ViewportTooltip>
                  ) : (
                    <Toggle checked={prefs[evt.id][ch]} onChange={() => toggle(evt.id, ch)} />
                  )}
                </div>
              ))}
            </React.Fragment>
          ))}
        </div>
        {saving ? (
          <div
            style={{
              padding: '12px 24px',
              borderTop: '1px solid #f1f0ed',
              display: 'flex',
              justifyContent: 'flex-end',
              alignItems: 'center',
            }}
          >
            <span style={{ fontSize: 12, color: '#9ca3af' }}>Saving…</span>
          </div>
        ) : null}
      </Card>
    </>
  )
}
