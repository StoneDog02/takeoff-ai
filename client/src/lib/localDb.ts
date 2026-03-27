import Dexie, { type Table } from 'dexie'

export interface LocalProject {
  id: string
  name: string
  status: string
  address_line_1?: string
  city?: string
  client?: string
  phases?: any[]
  synced_at: number
}

export interface LocalDailyLog {
  id: string // uuid, generated client-side if created offline
  project_id: string
  log_date: string
  weather?: string
  temperature?: string
  crew_count?: number
  crew_present?: any[]
  work_summary?: string
  phase_id?: string
  materials?: any[]
  issues?: any[]
  visitor_log?: any[]
  notes?: string
  sync_status: 'synced' | 'pending' | 'error'
  created_at: number
}

export interface LocalMediaUpload {
  id: string
  project_id: string
  log_date?: string
  file_data: Blob // stored locally until online
  file_name: string
  caption?: string
  sync_status: 'synced' | 'pending' | 'error'
  created_at: number
}

class BuildOSLocalDB extends Dexie {
  projects!: Table<LocalProject>
  daily_logs!: Table<LocalDailyLog>
  media_queue!: Table<LocalMediaUpload>

  constructor() {
    super('BuildOSLocal')
    this.version(1).stores({
      projects: 'id, status, synced_at',
      daily_logs: 'id, project_id, log_date, sync_status',
      media_queue: 'id, project_id, sync_status, created_at',
    })
  }
}

export const localDb = new BuildOSLocalDB()
