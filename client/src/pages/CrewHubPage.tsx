import { Link } from "react-router-dom";

/** Crew scheduling hub; links into Teams for roster and assignments. */
export default function CrewHubPage() {
  return (
    <div className="dashboard-app max-w-[1600px] mx-auto px-6 sm:px-8 lg:px-10 py-8">
      <h1 className="text-xl font-semibold text-[var(--text-primary)]">Crew</h1>
      <p className="mt-2 text-sm text-[var(--color-muted)] max-w-xl">
        Build rosters, skills, and schedules from the Teams workspace. Use Projects for job-level crew tabs when you need them in context.
      </p>
      <Link to="/teams" className="inline-flex mt-4 text-sm font-medium text-[var(--color-accent)] hover:underline">
        Open Teams
      </Link>
    </div>
  );
}
