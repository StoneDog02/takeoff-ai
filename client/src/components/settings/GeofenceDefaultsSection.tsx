import { useState } from 'react'
import type { GeofenceDefaults } from '@/types/global'
import { SectionHeader, Card, CardHeader, CardBody, Field, FieldRow, Input, Btn, SaveRow } from './SettingsPrimitives'

const defaults: GeofenceDefaults = {
  defaultRadiusMeters: 150,
  clockOutToleranceMinutes: 5,
}

export function GeofenceDefaultsSection() {
  const [radius, setRadius] = useState(defaults.defaultRadiusMeters)
  const [tolerance, setTolerance] = useState(defaults.clockOutToleranceMinutes)

  return (
    <>
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
            <Btn>Save defaults</Btn>
          </SaveRow>
        </CardBody>
      </Card>
    </>
  )
}
