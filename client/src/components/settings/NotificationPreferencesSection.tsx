import React, { useState } from 'react'
import type { NotificationPreferences } from '@/types/global'
import { SectionHeader, Card, Btn, Toggle } from './SettingsPrimitives'

const defaultPrefs: NotificationPreferences = {
  newBids: { email: true, sms: false, push: true },
  invoiceStatus: { email: true, sms: true, push: false },
  clockInOut: { email: false, sms: true, push: true },
  gpsClockOut: { email: true, sms: true, push: true },
  budgetThreshold: { email: true, sms: false, push: true },
}

const NOTIF_EVENTS: { id: keyof NotificationPreferences; label: string }[] = [
  { id: 'newBids', label: 'New bids received' },
  { id: 'invoiceStatus', label: 'Invoice status changes' },
  { id: 'clockInOut', label: 'Employee clock-in/out alerts' },
  { id: 'gpsClockOut', label: 'GPS clock-out events' },
  { id: 'budgetThreshold', label: 'Budget threshold warnings' },
]

const CHANNELS: (keyof NotificationPreferences['newBids'])[] = ['email', 'sms', 'push']

export function NotificationPreferencesSection() {
  const [prefs, setPrefs] = useState<NotificationPreferences>(defaultPrefs)

  const toggle = (id: keyof NotificationPreferences, ch: 'email' | 'sms' | 'push') => {
    setPrefs((p) => ({ ...p, [id]: { ...p[id], [ch]: !p[id][ch] } }))
  }

  return (
    <>
      <SectionHeader
        title="Notification Preferences"
        desc="Choose how you want to be notified for each type of event."
      />
      <Card>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 80px 80px', gap: 0 }}>
          <div style={{ padding: '14px 24px', borderBottom: '1px solid #f1f0ed' }}>
            <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase', color: '#c4bfb8' }}>Event</span>
          </div>
          {['Email', 'SMS', 'Push'].map((ch) => (
            <div key={ch} style={{ padding: '14px 0', borderBottom: '1px solid #f1f0ed', textAlign: 'center' }}>
              <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase', color: '#c4bfb8' }}>{ch}</span>
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
                  <Toggle checked={prefs[evt.id][ch]} onChange={() => toggle(evt.id, ch)} />
                </div>
              ))}
            </React.Fragment>
          ))}
        </div>
        <div style={{ padding: '16px 24px', borderTop: '1px solid #f1f0ed', display: 'flex', justifyContent: 'flex-end' }}>
          <Btn>Save preferences</Btn>
        </div>
      </Card>
    </>
  )
}
