import { api } from '@/api/client'
import type { Subcontractor } from '@/types/global'

export interface DirectorySubcontractor extends Subcontractor {
  project_ids: string[]
  project_names: string[]
}

/**
 * Fetches all projects, then subcontractors per project, and returns a deduplicated
 * list keyed by email (or name + trade). Each entry includes which project(s) they appear on.
 */
export async function getAggregatedSubcontractors(): Promise<DirectorySubcontractor[]> {
  const projects = await api.projects.list()
  const byKey = new Map<string, DirectorySubcontractor>()

  await Promise.all(
    projects.map(async (project) => {
      try {
        const subs = await api.projects.getSubcontractors(project.id)
        for (const sub of subs) {
          const key = (sub.email || '').trim() || `${sub.name}|${sub.trade}`
          const existing = byKey.get(key)
          if (existing) {
            if (!existing.project_ids.includes(project.id)) {
              existing.project_ids.push(project.id)
              existing.project_names.push(project.name)
            }
          } else {
            byKey.set(key, {
              ...sub,
              project_ids: [project.id],
              project_names: [project.name],
            })
          }
        }
      } catch {
        // skip project if subs fail
      }
    })
  )

  return Array.from(byKey.values())
}
