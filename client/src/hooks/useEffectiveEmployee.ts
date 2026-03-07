import { useAuth } from '@/contexts/AuthContext'
import { usePreview } from '@/contexts/PreviewContext'

export interface EffectiveEmployee {
  employeeId: string | null
  employeeName: string | null
  isPreview: boolean
}

export function useEffectiveEmployee(): EffectiveEmployee {
  const { type, employee } = useAuth()
  const { previewRole, previewEmployee } = usePreview()

  if (previewRole === 'employee' && previewEmployee) {
    return {
      employeeId: previewEmployee.id,
      employeeName: previewEmployee.name,
      isPreview: true,
    }
  }
  if (type === 'employee' && employee) {
    return {
      employeeId: employee.id,
      employeeName: employee.name ?? null,
      isPreview: false,
    }
  }
  return {
    employeeId: null,
    employeeName: null,
    isPreview: false,
  }
}
