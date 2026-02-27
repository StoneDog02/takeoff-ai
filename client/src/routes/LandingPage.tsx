import { Link } from 'react-router-dom'

export function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      {/* Top bar */}
      <header className="border-b border-slate-200 bg-white">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <span className="font-semibold text-blue-600 text-xl">Takeoff AI</span>
          <nav className="flex gap-4">
            <Link
              to="/sign-in"
              className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors"
            >
              Sign in
            </Link>
            <Link
              to="/sign-up"
              className="px-4 py-2 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors"
            >
              Sign up
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-16 text-center">
        <div className="max-w-2xl">
          <h1 className="text-4xl font-bold text-slate-900 mb-4 tracking-tight">
            Takeoff AI
          </h1>
          <p className="text-xl text-slate-600 mb-10 leading-relaxed">
            Upload plans. Get material lists. Build.
          </p>
          <div className="flex flex-wrap gap-4 justify-center">
            <Link
              to="/sign-up"
              className="inline-block px-6 py-3 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors"
            >
              Get started
            </Link>
            <Link
              to="/sign-in"
              className="inline-block px-6 py-3 rounded-lg text-sm font-medium border border-slate-300 text-slate-700 hover:bg-slate-50 transition-colors"
            >
              Sign in
            </Link>
          </div>
        </div>
      </main>
    </div>
  )
}
