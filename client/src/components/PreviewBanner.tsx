import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { usePreview } from '@/contexts/PreviewContext'

export function PreviewBanner() {
  const navigate = useNavigate()
  const { isAdmin, acting_as_employee } = useAuth()
  const { previewRole, previewEmployee, isPreviewing, clearPreview } = usePreview()

  if (!isAdmin || !isPreviewing || !previewRole) return null

  const label =
    previewRole === 'project_manager'
      ? 'Project Manager'
      : previewEmployee
        ? `Employee: ${previewEmployee.name}`
        : 'Employee'

  const handleExit = () => {
    clearPreview()
    navigate('/admin')
  }

  return (
    <div
      className="preview-banner"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '8px 16px',
        background: 'var(--blue-glow, rgba(59, 130, 246, 0.12))',
        borderBottom: '1px solid var(--border, #e5e7eb)',
        fontSize: 13,
        color: 'var(--text-primary)',
      }}
    >
      <span>
        Previewing as <strong>{label}</strong>
        {acting_as_employee && previewRole === 'employee' ? (
          <span className="text-muted" style={{ fontWeight: 400, marginLeft: 8 }}>
            (same job access as their employee login)
          </span>
        ) : null}
      </span>
      <button
        type="button"
        onClick={handleExit}
        className="btn btn-sm"
        style={{ flexShrink: 0 }}
      >
        Exit preview
      </button>
    </div>
  )
}
