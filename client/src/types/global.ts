/**
 * Shared types for the construction/contractor job management app.
 * Used by Estimates & Invoices module, Projects tab, and API client.
 */

// ----- Projects (Agent 1 / existing) -----
/** Plan type for takeoff: which reference doc set is used (plan-type-docs). */
export type ProjectPlanType = 'residential' | 'commercial' | 'civil' | 'auto'

export interface Project {
  id: string
  name: string
  status?: string
  scope?: string
  created_at?: string
  updated_at?: string
  /** When the project was marked completed; cleared if reopened. */
  completed_at?: string | null
  /** First time an estimate was accepted for this project (ISO). Used for post-approval budget / CO UX. */
  estimate_approved_at?: string | null
  user_id?: string
  address_line_1?: string
  address_line_2?: string
  city?: string
  state?: string
  postal_code?: string
  expected_start_date?: string
  expected_end_date?: string
  estimated_value?: number
  assigned_to_name?: string
  /** Primary client contact (from New Project / New Estimate wizard). */
  client_email?: string | null
  client_phone?: string | null
  plan_type?: ProjectPlanType
}

export interface Phase {
  id: string
  project_id: string
  name: string
  start_date: string
  end_date: string
  order?: number
}

export interface Milestone {
  id: string
  project_id: string
  phase_id?: string
  title: string
  due_date: string
  completed: boolean
}

/** Task-level schedule row (from Custom Build Schedule import or manual add). Drives Gantt bars and Today's Schedule. */
export interface ProjectTask {
  id: string
  project_id: string
  phase_id?: string
  title: string
  responsible?: string
  start_date: string
  end_date: string
  duration_weeks?: number
  order?: number
  completed: boolean
  created_at?: string
  updated_at?: string
}

/** Dashboard schedule list item (task or milestone). */
export interface ScheduleItem {
  id: string
  projectId: string
  projectName: string
  title: string
  completed: boolean
  type: 'task' | 'milestone'
  responsible?: string
  endDate?: string
}

export interface JobWalkMedia {
  id: string
  project_id: string
  url: string
  type: 'photo' | 'video'
  uploaded_at?: string
  uploader_name: string
  caption?: string
  /** Set for daily log uploads; filter with this instead of caption-only tagging when present. */
  log_date?: string | null
  /** True when the file is only in the offline upload queue (not yet on the server). */
  queued?: boolean
}

/** Row in `daily_logs` (Supabase). Weather values are lowercase. */
export interface DailyLogRow {
  id: string
  project_id: string
  log_date: string
  weather: string | null
  temperature: string | null
  crew_count: number
  crew_present: unknown
  work_summary: string | null
  phase_id: string | null
  materials: unknown
  issues: unknown
  visitor_log: unknown
  notes: string | null
  created_by: string | null
  locked_at: string | null
  created_at: string
  updated_at: string
}

/** Build plan file (PDF/drawing) attached to a project for reference. */
export interface ProjectBuildPlan {
  id: string
  project_id: string
  file_name: string
  url: string
  uploaded_at?: string
  uploader_name: string
}

/** Paper-trail row (estimates sent, invoices, bids dispatched, etc.). */
export type PaperDocumentType =
  | 'estimate'
  | 'invoice'
  | 'change_order'
  | 'bid_package'
  | 'receipt'
  | 'sub_contract'

export interface PaperTrailDocument {
  id: string
  organization_id: string
  project_id: string | null
  /** Set by global documents list API when project still exists. */
  project_name?: string | null
  document_type: PaperDocumentType
  title: string | null
  status: string | null
  total_amount: number | null
  client_name: string | null
  client_email: string | null
  token: string | null
  source_id: string | null
  file_url: string | null
  sent_at: string | null
  viewed_at: string | null
  actioned_at: string | null
  created_at: string
  archived_at: string | null
  metadata: Record<string, unknown> | null
}

/** Bid document (PDF/file) uploaded for reference — bids received from subs. */
export interface BidDocument {
  id: string
  project_id: string
  file_name: string
  url: string
  uploaded_at?: string
  uploader_name: string
}

export interface BudgetLineItem {
  id: string
  project_id: string
  label: string
  predicted: number
  actual: number
  category: string
  /** Unit of measure (e.g. hr, sf, ls) when set in Budget tab. */
  unit?: string | null
  /** Set when row was created from an approved estimate (`budget_line_items.source`). */
  source?: string | null
  created_at?: string | null
}

export interface ChangeOrder {
  id: string
  project_id: string
  description: string
  amount: number
  status: 'Approved' | 'Pending'
  date: string
  category: string
  created_at?: string
}

export interface BudgetSummary {
  predicted_total: number
  actual_total: number
  profitability: number
}

export interface Subcontractor {
  id: string
  project_id: string
  name: string
  trade: string
  email: string
  phone?: string
}

/** Single item in the project activity feed (Live Activity panel). */
export interface ProjectActivityItem {
  at: string
  tag: 'Media' | 'Time' | 'Budget' | 'Bid' | 'Schedule' | 'Takeoff'
  who: string
  action: string
  detail?: string
}

/** Work type for a project: clock-in option for crew with name, rate, unit (e.g. General Labor $85/hr). */
export interface ProjectWorkType {
  id: string
  project_id: string
  name: string
  description?: string
  rate: number
  unit: string
  /** Optional type/category for icon/color (e.g. 'labor', 'tile', 'plumbing', 'custom'). */
  type_key?: string
  /** When type_key is 'custom', hex color for the type (e.g. #3B82F6). */
  custom_color?: string
}

/** Global contractor contact (Manage > Contractors). Not tied to a project. */
export interface Contractor {
  id: string
  name: string
  trade: string
  email: string
  phone?: string
  created_at?: string
  updated_at?: string
}

export interface CostBuckets {
  own_labor?: number
  awarded_bids?: number
  overhead_margin?: number
  self_supplied_materials?: number
}

export interface TakeoffItem {
  description: string
  quantity: number
  unit: string
  notes?: string
  /** Subcategory within the takeoff category (e.g. Footings, Pipe, Manholes & Structures). Used for sidebar sub-sections. */
  subcategory?: string
  trade_tag?: string
  cost_estimate?: number | null
  [key: string]: unknown
}

export interface TradePackage {
  id: string
  project_id: string
  trade_tag: string
  line_items: TakeoffItem[]
  /** GC doing this trade in-house (priced via gc_estimate_lines). */
  gc_self_perform?: boolean
  /** Line items for estimate when GC self-performs this scope. */
  gc_estimate_lines?: { description: string; quantity: number; unit: string; unit_price: number }[]
}

export interface SubBid {
  id: string
  trade_package_id: string
  subcontractor_id: string
  amount: number
  notes?: string
  /** Sub’s availability / timing note from portal. */
  availability?: string | null
  /** PDF or file URL from portal bid submission. */
  quote_url?: string | null
  /** Required portal uploads: W-9, license, workers comp, liability, contingency — public URLs. */
  compliance_documents?: Record<string, string> | null
  awarded?: boolean
  /** Set when bid is dispatched; used for sub portal link /bid/[token]. */
  portal_token?: string | null
  /** Portal response: pending, viewed, bid_received, declined. */
  response_status?: string | null
  viewed_at?: string | null
  responded_at?: string | null
}

export interface ProposalLine {
  id: string
  label: string
  description?: string
  amount: number
  group?: string
  [key: string]: unknown
}

export interface BidSheet {
  project_id: string
  cost_buckets: CostBuckets
  proposal_lines: ProposalLine[]
  trade_packages: TradePackage[]
  sub_bids: SubBid[]
  updated_at?: string
}

export interface MaterialList {
  categories: { name: string; items: TakeoffItem[] }[]
  summary?: string
}

// ----- Estimates & Invoices (this module) -----
/** Minimal job shape; projects table is used as jobs. */
export interface Job {
  id: string
  name: string
  client_name?: string
  client_email?: string | null
  client_phone?: string | null
  created_at: string
  status?: string
  estimated_value?: number | null
}

export type EstimateStatus = 'draft' | 'sent' | 'viewed' | 'accepted' | 'declined' | 'changes_requested'

export interface Estimate {
  id: string
  job_id: string
  title: string
  status: EstimateStatus
  total_amount: number
  /** Total amount already converted to invoices (progress invoicing). */
  invoiced_amount?: number
  recipient_emails: string[]
  created_at: string
  updated_at: string
  sent_at?: string
  /** Set when estimate is sent; used for client approval portal /estimate/[token]. */
  client_token?: string | null
  /** When the client first opened the estimate portal. */
  viewed_at?: string | null
  /** Client message when they requested changes. */
  changes_requested_message?: string | null
  changes_requested_at?: string | null
  /** Shown on client portal (whole-document GC notes). */
  client_notes?: string | null
  client_terms?: string | null
  /** Snapshot of wizard line-item groups (revise + per-section notes for portal). */
  estimate_groups_meta?: unknown
  /** Set when this estimate was created from “send change order”; portal approval marks the CO approved. */
  source_change_order_id?: string | null
}

export interface EstimateLineItem {
  id: string
  estimate_id: string
  product_id: string | null
  description: string
  quantity: number
  unit: string
  unit_price: number
  total: number
  /** Optional phase/section for grouping (e.g. Demolition, Rough-in). */
  section?: string | null
}

export type InvoiceStatus = 'draft' | 'sent' | 'viewed' | 'paid' | 'overdue'

/** Pipeline stage for estimates & invoices (reference flow). */
export type PipelineStage = 'draft' | 'sent' | 'accepted' | 'invoiced' | 'paid' | 'declined'

/** Milestone for progress invoicing (estimate). */
export interface PipelineMilestone {
  label: string
  pct: number
  amount: number
  status: 'pending' | 'invoiced'
}

/** Unified pipeline item (estimate or invoice) for Kanban/stage view. */
export interface PipelineItem {
  id: string
  type: 'estimate' | 'invoice'
  job_id: string
  jobName: string
  client: string | null
  date: string
  amount: number
  stage: PipelineStage
  invoiced: number
  paid: number
  milestones: PipelineMilestone[]
  estimate_id?: string | null
  /** For estimates: original status (sent | viewed | changes_requested | accepted | declined). */
  estimateStatus?: EstimateStatus
  /** When client opened the portal (estimate only). */
  viewed_at?: string | null
  /** Client message when they requested changes (estimate only). */
  changes_requested_message?: string | null
}

export interface Invoice {
  id: string
  estimate_id: string | null
  job_id: string | null
  status: InvoiceStatus
  total_amount: number
  recipient_emails: string[]
  created_at: string
  updated_at: string
  sent_at?: string
  paid_at?: string
  due_date?: string
  /** Public portal token; set when invoice is sent. */
  client_token?: string | null
  viewed_at?: string | null
  /** Progress milestones or manual line items / notes at create/send time. */
  schedule_snapshot?: Record<string, unknown> | null
}

export type CustomProductItemType = 'service' | 'product' | 'labor' | 'sub' | 'material' | 'equipment'

export interface CustomProduct {
  id: string
  user_id: string
  name: string
  description?: string
  unit: string
  default_unit_price: number
  /** Optional: service or product (QuickBooks-style). */
  item_type?: CustomProductItemType
  sub_cost?: number | null
  markup_pct?: number | null
  billed_price?: number | null
  trades?: string[] | null
  taxable?: boolean | null
  created_at: string
}

export type ExpenseCategory = 'materials' | 'labor' | 'equipment' | 'misc' | 'subs'

export interface JobExpense {
  id: string
  job_id: string
  amount: number
  category: ExpenseCategory
  description?: string
  receipt_file_url?: string
  created_at: string
  /** Optional: pass-through to client (include in invoice). */
  billable?: boolean
  /** Optional: vendor or store name. */
  vendor?: string
}

/** Per-category budget for Budget vs Actual (e.g. mock). */
export interface JobBudgetCategory {
  allocated: number
  color: string
  bg: string
}

/** Optional job fields for Receipts: budget by category, progress, estimate total. */
export interface JobReceiptsMeta {
  estimateTotal?: number
  pctComplete?: number
  budget?: Partial<Record<string, JobBudgetCategory>>
}

/** For Projects tab: running spend total per job. */
export interface JobSpendSummary {
  job_id: string
  total_spend: number
  by_category: Partial<Record<ExpenseCategory, number>>
}

// ----- Settings (Settings tab) -----
export interface CompanyAddress {
  line1: string
  line2?: string
  city: string
  state: string
  zip: string
}

/** Shown on the customer invoice portal (how to pay + optional Stripe Checkout). */
export interface CompanyInvoicePaymentSettings {
  cash: boolean
  check: boolean
  ach: boolean
  /** Requires STRIPE_SECRET_KEY and Stripe Checkout; optional Connect account id for payouts. */
  card: boolean
  checkInstructions: string
  achInstructions: string
  cashNote: string
  /** Stripe Connect Express / Standard account id (acct_…) so card charges transfer to the GC. */
  stripeConnectAccountId?: string | null
}

export interface CompanyProfile {
  name: string
  logoUrl?: string
  licenseNumber?: string
  address: CompanyAddress
  phone: string
  email: string
  website?: string
  /** Default % markup for takeoff/bid category rows in Build Estimate; null = use app default (15%). */
  defaultEstimateMarkupPct?: number | null
  invoicePayment?: CompanyInvoicePaymentSettings
}

/** Company branding returned by public token portals and document viewer (from Company Profile settings). */
export interface PortalCompanyInfo {
  name: string | null
  logoUrl?: string | null
  phone?: string | null
  email?: string | null
  website?: string | null
  licenseNumber?: string | null
  addressLine?: string | null
}

export type UserRole =
  | 'admin'
  | 'project_manager'
  | 'field_supervisor'
  | 'employee'
  | 'subcontractor'

export type InviteStatus = 'pending' | 'accepted' | 'expired'

export interface InvitedMember {
  id: string
  email: string
  role: UserRole
  status: InviteStatus
  invitedAt: string
}

export interface NotificationChannel {
  email: boolean
  sms: boolean
  push: boolean
}

export interface NotificationPreferences {
  newBids: NotificationChannel
  invoiceStatus: NotificationChannel
  clockInOut: NotificationChannel
  gpsClockOut: NotificationChannel
  budgetThreshold: NotificationChannel
}

export interface GeofenceDefaults {
  defaultRadiusMeters: number
  clockOutToleranceMinutes: number
}

export interface Integration {
  id: string
  name: string
  connected: boolean
  config?: { apiKeyMasked?: string }
}

export type InvoiceTemplateStyle = 'standard' | 'minimal' | 'detailed'

export interface Branding {
  logoUrl?: string
  primaryColor: string
  /** Headings / typography accents on invoices (e.g. section titles). */
  secondaryColor: string
  invoiceTemplateStyle: InvoiceTemplateStyle
}

export interface TaxRate {
  id: string
  label: string
  rate: number
}

export interface TaxCompliance {
  defaultTaxRates: TaxRate[]
  contractorLicenseNumber?: string
  insuranceExpiryDate?: string
}

export type ExportScope = 'projects' | 'employees' | 'financial'
export type ExportFormat = 'csv' | 'pdf'

// ----- Teams / Employee Tracking -----
export type EmployeeStatus = 'on_site' | 'off' | 'pto'

export interface Employee {
  id: string
  user_id?: string
  auth_user_id?: string | null
  name: string
  role: string
  email: string
  phone?: string
  status: EmployeeStatus
  /** GC-set: employee portal daily log access regardless of role title. */
  daily_log_access?: boolean
  current_compensation?: number
  created_at: string
  updated_at: string
}

export interface JobAssignment {
  id: string
  employee_id: string
  job_id: string
  assigned_at: string
  role_on_job?: string
  ended_at?: string
}

/** Keys match server `weekly_schedule` (Sunday–Saturday). */
export type WeekdayScheduleKey = 'sun' | 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat'

export interface DayScheduleSegment {
  enabled: boolean
  start: string
  end: string
}

export type JobWeeklySchedule = Partial<Record<WeekdayScheduleKey, DayScheduleSegment>>

export interface JobAssignmentScheduleResponse {
  weekly_schedule: JobWeeklySchedule
  timezone: string
  updated_at: string | null
}

export type TimeEntrySource = 'manual' | 'gps_auto' | 'server_auto'

export interface TimeEntry {
  id: string
  employee_id: string
  job_id: string
  clock_in: string
  clock_out?: string
  hours?: number
  source: TimeEntrySource
  gps_clock_out_log_id?: string
  /** Project work type (e.g. General Labor) chosen at clock-in. */
  project_work_type_id?: string
  created_at?: string
}

export interface AttendanceRecord {
  id: string
  employee_id: string
  date: string
  clock_in: string
  clock_out?: string
  late_arrival_minutes?: number
  early_departure_minutes?: number
  notes?: string
  created_at?: string
}

export type PayRaiseAmountType = 'percent' | 'dollar'

export interface PayRaise {
  id: string
  employee_id: string
  effective_date: string
  amount_type: PayRaiseAmountType
  amount: number
  previous_rate?: number
  new_rate?: number
  notes?: string
  created_at?: string
}

export interface PayrollSummary {
  employee_id: string
  year: number
  total_earnings: number
  monthly_breakdown?: { month: number; earnings: number }[]
}

export interface GpsClockOutLog {
  id: string
  employee_id: string
  time_entry_id: string
  job_id: string
  exited_at: string
  lat?: number
  lng?: number
  geofence_id?: string
  created_at?: string
}

/** Geofence config per job (center + radius). Stored in job_geofences table. */
export interface JobGeofence {
  id?: string
  job_id: string
  user_id?: string
  center_lat: number
  center_lng: number
  radius_value: number
  radius_unit: 'feet' | 'meters'
  created_at?: string
  updated_at?: string
}
