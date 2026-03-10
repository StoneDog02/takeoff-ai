/** Client/project info step */
export interface WizardPhase {
  id: string
  name: string
  start: string
  end: string
  color: string
}

/** Task under a phase (wizard-only; phaseId is wizard phase id until API persist) */
export interface WizardTask {
  id: string
  phaseId: string
  title: string
  start_date: string
  end_date: string
  responsible?: string
}

export interface WizardBudgetCategory {
  id: string
  name: string
  amount: string
}

/** Roster employee assigned to the project (persisted as job_assignment). */
export interface WizardTeamMemberRoster {
  type: 'roster'
  id: string
  employee_id: string
  role_on_job?: string
  color: string
}

/** External crew/subcontractor (persisted as subcontractor row). */
export interface WizardTeamMemberExternal {
  type: 'external'
  id: string
  name: string
  role: string
  email: string
  color: string
}

export type WizardTeamMember = WizardTeamMemberRoster | WizardTeamMemberExternal

/** @deprecated Use WizardTeamMember; kept for backward compatibility where only external shape is used. */
export interface WizardTeamMemberLegacy {
  id: string
  name: string
  role: string
  email: string
  color: string
}

/** Work type in wizard (rate/unit for crew clock-in). */
export interface WizardWorkType {
  id: string
  name: string
  rate: number
  unit: string
  type_key?: string
  description?: string
  /** When type_key is 'custom', hex color (e.g. #3B82F6). */
  custom_color?: string
}

export interface WizardMilestone {
  id: string
  label: string
  date: string
  type: 'phase' | 'custom'
}

/** Plan type for takeoff (dropdown in wizard). */
export type WizardPlanType = 'residential' | 'commercial' | 'civil'

/** In-memory project shape used by the setup wizard (before API persist) */
export interface WizardProjectState {
  name: string
  address: string
  id?: string
  status: string
  startDate: string
  endDate: string
  client: string
  clientName?: string
  clientCompany?: string
  clientEmail?: string
  clientPhone?: string
  budget: number
  description?: string
  planType: WizardPlanType
  phases: WizardPhase[]
  tasks: WizardTask[]
  milestones: WizardMilestone[]
  team: WizardTeamMember[]
  workTypes: WizardWorkType[]
  budgetCategories: WizardBudgetCategory[]
}

export const EMPTY_WIZARD_PROJECT: WizardProjectState = {
  name: '',
  address: '',
  status: 'active',
  startDate: '',
  endDate: '',
  client: '',
  budget: 0,
  planType: 'residential',
  phases: [],
  tasks: [],
  milestones: [],
  team: [],
  workTypes: [],
  budgetCategories: [],
}
