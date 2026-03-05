/**
 * Teams API client. When VITE_USE_TEAMS_MOCK=true, returns mock data from @/data/mockTeamsData.
 * Use getProjectsList() for jobs/projects in Teams flows so mock mode shows mock projects.
 */
import { teamsApi as realTeamsApi } from './teams'
import { mockTeamsApi, mockProjects } from '@/data/mockTeamsData'
import { api } from './client'
import type { Project } from '@/types/global'

export const USE_TEAMS_MOCK = import.meta.env.VITE_USE_TEAMS_MOCK === 'true'

export const teamsApi = USE_TEAMS_MOCK ? mockTeamsApi : realTeamsApi

/** Projects/jobs list for Teams (mock or real). Use this in Teams components instead of api.projects.list(). */
export async function getProjectsList(): Promise<Project[]> {
  if (USE_TEAMS_MOCK) return mockProjects
  return api.projects.list()
}

export type { YtdPayResponse } from './teams'
