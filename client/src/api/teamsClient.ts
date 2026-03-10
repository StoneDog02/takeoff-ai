/**
 * Teams API client. Always uses live API (server + Supabase).
 * Use getProjectsList() for jobs/projects in Teams flows.
 */
import { teamsApi } from './teams'
import { api } from './client'
import type { Project } from '@/types/global'

/** Projects/jobs list for Teams. Use this in Teams components instead of api.projects.list(). */
export async function getProjectsList(): Promise<Project[]> {
  return api.projects.list()
}

export { teamsApi }
export type { YtdPayResponse } from './teams'
