import { useState } from 'react'
import { Download } from 'lucide-react'
import type { ExportScope, ExportFormat } from '@/types/global'
import { settingsApi } from '@/api/settings'
import { SectionHeader, Card, CardHeader, CardBody, Field, FieldRow, Select, Btn } from './SettingsPrimitives'

const SCOPES: { value: ExportScope; label: string }[] = [
  { value: 'projects', label: 'All project data' },
  { value: 'employees', label: 'Employee records' },
  { value: 'financial', label: 'Financial data' },
]

const SCOPE_LABELS: Record<string, string> = {
  projects: 'All project data',
  employees: 'Employee records',
  financial: 'Financial data',
}

const FORMATS: { value: ExportFormat; label: string }[] = [
  { value: 'csv', label: 'CSV' },
  { value: 'pdf', label: 'PDF' },
]

export function DataExportSection() {
  const [scope, setScope] = useState<ExportScope>('projects')
  const [format, setFormat] = useState<ExportFormat>('csv')
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleExport = async () => {
    setExporting(true)
    setError(null)
    try {
      const blob = await settingsApi.exportData(scope, format)
      const ext = format === 'csv' ? 'csv' : 'pdf'
      const filename = `${scope}-export.${ext}`
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed')
    } finally {
      setExporting(false)
    }
  }

  return (
    <>
      {error && <div style={{ marginBottom: 16, padding: 12, background: '#fef2f2', color: '#b91c1c', borderRadius: 8 }}>{error}</div>}
      <SectionHeader title="Data & Export" desc="Export project, employee, or financial data as CSV or PDF." />
      <Card>
        <CardHeader title="Export data" />
        <CardBody>
          <FieldRow cols="1fr 1fr">
            <Field label="Export scope">
              <Select value={scope} onChange={(e) => setScope(e.target.value as ExportScope)}>
                {SCOPES.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </Select>
            </Field>
            <Field label="Format">
              <Select value={format} onChange={(e) => setFormat(e.target.value as ExportFormat)}>
                {FORMATS.map((f) => (
                  <option key={f.value} value={f.value}>{f.label}</option>
                ))}
              </Select>
            </Field>
          </FieldRow>
          <div style={{ background: '#fafaf9', border: '1px solid #f1f0ed', borderRadius: 10, padding: '12px 16px', marginBottom: 16, fontSize: 13, color: '#6b7280' }}>
            Exporting: <strong style={{ color: '#111' }}>{SCOPE_LABELS[scope] ?? scope}</strong> as <strong style={{ color: '#111' }}>{format.toUpperCase()}</strong>
          </div>
          <Btn style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }} onClick={handleExport} disabled={exporting}>
            <Download size={14} strokeWidth={2.5} /> {exporting ? 'Exporting…' : 'Export now'}
          </Btn>
        </CardBody>
      </Card>
    </>
  )
}
