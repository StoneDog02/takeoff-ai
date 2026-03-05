import type { Employee, PayRaise } from '@/types/global'

interface EmployeeCardProps {
  employee: Employee
  assignedJobNames?: string[]
  latestPayRaise?: PayRaise | null
}

const STATUS_CLASS: Record<Employee['status'], string> = {
  on_site: 's-active',
  off: 's-completed',
  pto: 's-planning',
}

export function EmployeeCard({ employee, assignedJobNames = [], latestPayRaise }: EmployeeCardProps) {
  return (
    <div className="metric-card" style={{ animation: 'none' }}>
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div>
          <h3 className="metric-value" style={{ marginBottom: 4, fontSize: 18 }}>
            {employee.name}
          </h3>
          <p className="dashboard-app .metric-label" style={{ marginBottom: 2 }}>
            {employee.role}
          </p>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            {employee.email}
            {employee.phone ? ` · ${employee.phone}` : ''}
          </p>
        </div>
        <span className={`status-pill ${STATUS_CLASS[employee.status]}`}>
          {employee.status === 'on_site' ? 'On-site' : employee.status === 'pto' ? 'PTO' : 'Off'}
        </span>
      </div>
      {assignedJobNames.length > 0 && (
        <p className="text-sm mt-2" style={{ color: 'var(--text-muted)' }}>
          Jobs: {assignedJobNames.join(', ')}
        </p>
      )}
      {latestPayRaise && (
        <div className="mt-2 pt-2" style={{ borderTop: '1px solid var(--border)' }}>
          <span className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>
            Latest raise
          </span>
          <p className="text-sm">
            {latestPayRaise.effective_date}:{' '}
            {latestPayRaise.amount_type === 'percent'
              ? `${latestPayRaise.amount}%`
              : `$${latestPayRaise.amount}`}
            {latestPayRaise.new_rate != null ? ` → $${latestPayRaise.new_rate}/hr` : ''}
          </p>
        </div>
      )}
      {employee.current_compensation != null && !latestPayRaise && (
        <p className="text-sm mt-2" style={{ color: 'var(--text-muted)' }}>
          Rate: ${employee.current_compensation}/hr
        </p>
      )}
    </div>
  )
}
