import { AddBtn } from '../primitives'
import { uid } from '../constants'
import type { WizardProjectState, WizardWorkType } from '../types'
import { isGeneralLaborWorkTypeName, isLaborHourlyEmployeeRate } from '@/lib/workTypeDisplay'
import { WorkTypeIcon } from '@/components/projects/WorkTypeIcon'
import { WorkTypeSelect } from '@/components/projects/WorkTypeSelect'
import { CustomWorkTypeColorPicker, getUsedWorkTypeColors, getWorkTypeStyle } from '@/components/projects/CustomWorkTypeColorPicker'

const UNITS = [
  { value: 'hr', label: 'per hr' },
  { value: 'sf', label: 'per sf' },
  { value: 'ea', label: 'per ea' },
  { value: 'lf', label: 'per lf' },
]

type OnChange = (key: keyof WizardProjectState, value: unknown) => void

export function StepWorkTypes({ data, onChange }: { data: WizardProjectState; onChange: OnChange }) {
  const workTypes = data.workTypes ?? []

  function addWorkType() {
    onChange('workTypes', [
      ...workTypes,
      { id: uid(), name: '', rate: 0, unit: 'hr', type_key: 'labor' },
    ])
  }

  function updateWorkType(id: string, field: keyof WizardWorkType, val: string | number) {
    onChange(
      'workTypes',
      workTypes.map((w) => {
        if (w.id !== id) return w
        const next = { ...w, [field]: val }
        if (field === 'type_key' && val === 'custom' && !next.custom_color) next.custom_color = '#6366F1'
        return next
      })
    )
  }

  function removeWorkType(id: string) {
    onChange('workTypes', workTypes.filter((w) => w.id !== id))
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <p style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>
        General Labor uses each employee’s hourly rate from their profile. Add other types (e.g. equipment) with the rate you pay for that work.
      </p>
      {workTypes.map((w) => {
        const style = getWorkTypeStyle(w.type_key, w.custom_color)
        return (
        <div
          key={w.id}
          style={{
            display: 'flex',
            gap: 10,
            alignItems: 'center',
            flexWrap: 'wrap',
            padding: '12px 14px',
            background: style.bg,
            borderRadius: 11,
            border: '1.5px solid #e2e8f0',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, flexShrink: 0, color: style.rate }}>
            <WorkTypeIcon typeKey={w.type_key ?? 'labor'} size={20} customColor={w.custom_color} />
          </div>
          <input
            value={w.name}
            onChange={(e) => updateWorkType(w.id, 'name', e.target.value)}
            placeholder="e.g. General Labor"
            style={{
              flex: '1 1 140px',
              minWidth: 120,
              border: '1.5px solid #e2e8f0',
              borderRadius: 7,
              padding: '6px 10px',
              fontSize: 13,
            }}
          />
          {isLaborHourlyEmployeeRate(w) ? (
            <div
              style={{
                width: 120,
                border: '1.5px solid #e2e8f0',
                borderRadius: 7,
                padding: '6px 10px',
                fontSize: 12,
                color: '#475569',
                background: 'rgba(255,255,255,0.6)',
              }}
              title="Paid at each employee’s hourly rate from their profile"
            >
              Employee rate
            </div>
          ) : (
            <input
              type="number"
              min={0}
              step={0.01}
              value={w.rate || ''}
              onChange={(e) => updateWorkType(w.id, 'rate', e.target.value === '' ? 0 : parseFloat(e.target.value) || 0)}
              placeholder="85"
              style={{
                width: 80,
                border: '1.5px solid #e2e8f0',
                borderRadius: 7,
                padding: '6px 10px',
                fontSize: 13,
              }}
            />
          )}
          <select
            value={w.unit}
            onChange={(e) => updateWorkType(w.id, 'unit', e.target.value)}
            style={{
              width: 72,
              border: '1.5px solid #e2e8f0',
              borderRadius: 7,
              padding: '6px 8px',
              fontSize: 13,
            }}
          >
            {UNITS.map((u) => (
              <option key={u.value} value={u.value}>
                {u.label}
              </option>
            ))}
          </select>
          <div style={{ flex: '1 1 100px', minWidth: 90 }}>
            <WorkTypeSelect
              value={w.type_key ?? 'labor'}
              onChange={(k) => updateWorkType(w.id, 'type_key', k)}
              iconSize={16}
              customColor={w.type_key === 'custom' ? w.custom_color : undefined}
              style={{
                border: '1.5px solid #e2e8f0',
                borderRadius: 7,
                padding: '6px 8px',
                fontSize: 13,
              }}
            />
          </div>
          {w.type_key === 'custom' && (
            <div style={{ flex: '1 1 100%', minWidth: 0 }}>
              <CustomWorkTypeColorPicker
                value={w.custom_color || '#6366F1'}
                onChange={(hex) => updateWorkType(w.id, 'custom_color', hex)}
                usedColors={getUsedWorkTypeColors(workTypes, w.id)}
              />
            </div>
          )}
          <button
            type="button"
            onClick={() => removeWorkType(w.id)}
            disabled={isGeneralLaborWorkTypeName(w)}
            style={{
              width: 28,
              height: 28,
              borderRadius: 7,
              border: 'none',
              background: 'transparent',
              cursor: isGeneralLaborWorkTypeName(w) ? 'not-allowed' : 'pointer',
              color: isGeneralLaborWorkTypeName(w) ? '#e2e8f0' : '#cbd5e1',
              opacity: isGeneralLaborWorkTypeName(w) ? 0.4 : 1,
            }}
            title={isGeneralLaborWorkTypeName(w) ? 'General Labor is required on every job' : undefined}
            aria-label="Remove"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        )
      })}
      <AddBtn label="Add Work Type" onClick={addWorkType} />
    </div>
  )
}
