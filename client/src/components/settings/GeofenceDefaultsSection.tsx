import { useState, useEffect } from 'react'
import type { GeofenceDefaults } from '@/types/global'
import { settingsApi } from '@/api/settings'
import { SectionHeader, Card, CardHeader, CardBody, Field, FieldRow, Input, Btn, SaveRow } from './SettingsPrimitives'
import { LoadingSkeleton } from '@/components/LoadingSkeleton'

const defaults: GeofenceDefaults = {
  defaultRadiusMeters: 100,
  clockOutToleranceMinutes: 5,
}

export function GeofenceDefaultsSection() {
  const [radius, setRadius] = useState(defaults.defaultRadiusMeters)
  const [tolerance, setTolerance] = useState(defaults.clockOutToleranceMinutes)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    settingsApi.getSettings().then((res) => {
      if (cancelled) return
      const g = res.geofence_defaults
      if (g) {
        setRadius(g.default_radius_meters ?? defaults.defaultRadiusMeters)
        setTolerance(g.clock_out_tolerance_minutes ?? defaults.clockOutToleranceMinutes)
      }
    }).catch((e) => { if (!cancelled) setError(e.message) }).finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    try {
      await settingsApi.updateGeofenceDefaults({ default_radius_meters: radius, clock_out_tolerance_minutes: tolerance })
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
        title="Jobsite & Geofence Defaults"
        desc="Used for new jobsites unless overridden per job. GPS auto clock-out triggers after being outside the boundary for the tolerance period."
      />
      <Card>
        <CardHeader title="Default GPS settings" />
        <CardBody>
          <FieldRow cols="1fr 1fr">
            <Field label="Default Geofence Radius" hint="meters">
              <div style={{ position: 'relative' }}>
                <Input
                  type="number"
                  value={radius}
                  onChange={(e) => setRadius(Number(e.target.value) || 0)}
                />
                <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: '#9ca3af', pointerEvents: 'none' }}>m</span>
              </div>
              <div style={{ marginTop: 8, height: 4, background: '#f0ede8', borderRadius: 4, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${Math.min(radius / 5, 100)}%`, background: 'linear-gradient(90deg, #b91c1c, #ef4444)', borderRadius: 4, transition: 'width 0.3s' }} />
              </div>
              <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>Approx. {radius}m radius around jobsite center</div>
            </Field>
            <Field label="Auto Clock-out Tolerance" hint="minutes">
              <div style={{ position: 'relative' }}>
                <Input
                  type="number"
                  value={tolerance}
                  onChange={(e) => setTolerance(Number(e.target.value) || 0)}
                />
                <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: '#9ca3af', pointerEvents: 'none' }}>min</span>
              </div>
              <div style={{ fontSize: 11.5, color: '#9ca3af', marginTop: 8 }}>Must be outside boundary for this many minutes before auto clock-out.</div>
            </Field>
          </FieldRow>
          <SaveRow>
            <Btn onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Save defaults'}</Btn>
          </SaveRow>
        </CardBody>
      </Card>
    </>
  )
}
