import { Link } from 'react-router-dom'
import { LandingNav } from '@/components/landing/LandingNav'

export function PrivacyPage() {
  return (
    <div className="min-h-screen flex flex-col w-full bg-dark text-landing-white font-dm-sans">
      <LandingNav />
      <main className="flex-1 max-w-3xl mx-auto px-6 py-12">
        <Link to="/" className="text-sm text-white-dim hover:text-landing-white mb-6 inline-block">
          ← Back to home
        </Link>
        <h1 className="text-3xl font-bold text-landing-white mb-2">Privacy Policy</h1>
        <p className="text-sm text-white-dim mb-10">Last updated: March 2026</p>

        <div className="prose prose-invert prose-sm max-w-none space-y-6 text-white-dim leading-relaxed">
          <section>
            <h2 className="text-lg font-semibold text-landing-white mt-8 mb-2">1. Information we collect</h2>
            <p>
              Proj-X collects information you provide when you register, use the service, or contact us. This may include your name, email address, company details, project and job data, and usage information. When you connect third-party services (such as QuickBooks), we receive only the data necessary to provide the integration and store connection tokens securely on our servers.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-landing-white mt-8 mb-2">2. How we use your information</h2>
            <p>
              We use your information to operate and improve Proj-X, to provide support, to send service-related communications, and to comply with legal obligations. We do not sell your personal information to third parties.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-landing-white mt-8 mb-2">3. Data storage and security</h2>
            <p>
              Your data is stored using industry-standard hosting and encryption. We use Supabase and other trusted providers. Integration credentials (e.g. OAuth tokens for QuickBooks) are stored securely and are not exposed to the client.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-landing-white mt-8 mb-2">4. Third-party services</h2>
            <p>
              We integrate with third-party services (such as QuickBooks, payment processors, and email providers). Their use of your data is governed by their respective privacy policies. We recommend reviewing those policies when you connect an integration.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-landing-white mt-8 mb-2">5. Cookies and similar technologies</h2>
            <p>
              We use cookies and similar technologies for authentication, session management, and to improve the service. You can control cookie preferences in your browser settings.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-landing-white mt-8 mb-2">6. Your rights</h2>
            <p>
              You may access, correct, or delete your personal information through your account settings or by contacting us. You may also request a copy of your data or withdraw consent where applicable under local law.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-landing-white mt-8 mb-2">7. Contact</h2>
            <p>
              For privacy-related questions or requests, contact us at the email or address provided in the app or on our website.
            </p>
          </section>
        </div>

        <div className="mt-12 pt-8 border-t border-border-dark">
          <Link to="/terms" className="text-accent hover:underline">Terms of Service</Link>
          <span className="text-white-dim mx-2">·</span>
          <Link to="/" className="text-accent hover:underline">Home</Link>
        </div>
      </main>
    </div>
  )
}
