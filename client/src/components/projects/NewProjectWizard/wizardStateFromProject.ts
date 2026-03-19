import type { Project } from '@/types/global'
import type { Phase, Milestone } from '@/types/global'
import type { ProjectTask } from '@/types/global'
import type { Subcontractor } from '@/types/global'
import type { ProjectWorkType } from '@/types/global'
import type { BudgetLineItem } from '@/types/global'
import type { JobAssignment, Employee } from '@/types/global'
import { PHASE_COLORS, uid } from './constants'
import type { WizardProjectState, WizardTeamMember } from './types'

/**
 * Build wizard state from API project, phases, budget items, milestones, tasks, subcontractors, work types,
 * and optionally job_assignments + employees for roster-based team members.
 */
export function wizardStateFromProject(
  project: Project,
  phases: Phase[],
  budgetItems: BudgetLineItem[],
  milestones: Milestone[],
  projectTasks: ProjectTask[] = [],
  projectSubcontractors: Subcontractor[] = [],
  projectWorkTypes: ProjectWorkType[] = [],
  jobAssignments: JobAssignment[] = [],
  _rosterEmployees: Employee[] = []
): WizardProjectState {
  const rosterTeam: WizardTeamMember[] = jobAssignments
    .filter((a) => !a.ended_at)
    .map((a, i) => ({
      type: 'roster' as const,
      id: uid(),
      employee_id: a.employee_id,
      role_on_job: a.role_on_job ?? '',
      color: PHASE_COLORS[i % PHASE_COLORS.length],
    }))
  const externalTeam: WizardTeamMember[] = projectSubcontractors.map((s, i) => ({
    type: 'external' as const,
    id: s.id,
    name: s.name ?? '',
    role: s.trade ?? '',
    email: s.email ?? '',
    color: PHASE_COLORS[(rosterTeam.length + i) % PHASE_COLORS.length],
  }))
  const team = [...rosterTeam, ...externalTeam]

  const planType = project.plan_type === 'commercial' || project.plan_type === 'civil' ? project.plan_type : 'residential'
  return {
    name: project.name ?? '',
    address: project.address_line_1 ?? '',
    id: project.id,
    status: (project.status ?? 'active').toLowerCase(),
    startDate: project.expected_start_date ?? '',
    endDate: project.expected_end_date ?? '',
    client: project.assigned_to_name ?? '',
    clientName: project.assigned_to_name ?? undefined,
    clientEmail: project.client_email?.trim() || undefined,
    clientPhone: project.client_phone?.trim() || undefined,
    budget: budgetItems.reduce((s, i) => s + (i.predicted ?? 0), 0),
    description: project.scope ?? undefined,
    planType,
    phases: phases.map((p, i) => ({
      id: p.id,
      name: p.name ?? '',
      start: p.start_date ?? '',
      end: p.end_date ?? '',
      color: PHASE_COLORS[i % PHASE_COLORS.length],
    })),
    tasks: projectTasks
      .filter((t) => t.phase_id)
      .map((t) => ({
        id: t.id,
        phaseId: t.phase_id!,
        title: t.title ?? '',
        start_date: t.start_date ?? '',
        end_date: t.end_date ?? '',
        responsible: t.responsible ?? undefined,
      })),
    milestones: milestones.map((m) => ({
      id: m.id,
      label: m.title ?? '',
      date: m.due_date ?? '',
      type: 'custom' as const,
    })),
    team,
    workTypes: projectWorkTypes.map((w) => ({
      id: w.id,
      name: w.name ?? '',
      rate: w.rate ?? 0,
      unit: w.unit ?? 'hr',
      type_key: w.type_key,
      description: w.description,
      custom_color: w.custom_color,
    })),
    budgetCategories: budgetItems.map((b) => ({
      id: b.id,
      name: b.label ?? '',
      amount: String(b.predicted ?? 0),
    })),
  }
}
