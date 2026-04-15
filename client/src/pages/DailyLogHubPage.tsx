import { Link } from "react-router-dom";

/** Standalone daily log hub; project-level logs remain under each job. */
export default function DailyLogHubPage() {
  return (
    <div className="dashboard-app max-w-[1600px] mx-auto px-6 sm:px-8 lg:px-10 py-8">
      <h1 className="text-xl font-semibold text-[var(--text-primary)]">Daily log</h1>
      <p className="mt-2 text-sm text-[var(--color-muted)] max-w-xl">
        Field logs and photos also live on each project&apos;s Daily log tab. Open a project to add or review entries.
      </p>
      <Link to="/projects" className="inline-flex mt-4 text-sm font-medium text-[var(--color-accent)] hover:underline">
        Go to projects
      </Link>
    </div>
  );
}
