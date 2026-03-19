/**
 * Teams API client. Always uses live API (server + Supabase).
 * Use getProjectsList() for jobs/projects in Teams flows.
 */
import { teamsApi } from './teams'
import { api } from './client'
import type { Project } from '@/types/global'

function toProject(p: Awaited<ReturnType<typeof api.projects.list>>[number]): Project {
  return {
    ...p,
    address_line_1: p.address_line_1 ?? undefined,
    address_line_2: p.address_line_2 ?? undefined,
    city: p.city ?? undefined,
    state: p.state ?? undefined,
    postal_code: p.postal_code ?? undefined,
    expected_start_date: p.expected_start_date ?? undefined,
    expected_end_date: p.expected_end_date ?? undefined,
    estimated_value: p.estimated_value ?? undefined,
    assigned_to_name: p.assigned_to_name ?? undefined,
    plan_type: p.plan_type ?? undefined,
    client_email: p.client_email ?? undefined,
    client_phone: p.client_phone ?? undefined,
  }
}

/** Projects/jobs list for Teams. Use this in Teams components instead of api.projects.list(). */
export async function getProjectsList(): Promise<Project[]> {
  const list = await api.projects.list()
  return list.map(toProject)
}

export { teamsApi }
export type { YtdPayResponse } from './teams'
