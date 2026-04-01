import { Link } from 'react-router-dom'

const productLinks = [
  { href: '#features', label: 'Features' },
  { href: '#pricing', label: 'Pricing' },
  { href: '#testimonials', label: 'Testimonials' },
  { href: '#', label: 'Updates' },
]

const companyLinks = [
  { href: '#', label: 'About Us' },
  { href: '#', label: 'Careers' },
  { href: '#', label: 'Blog' },
  { href: '#contact', label: 'Contact' },
]

const legalLinks = [
  { to: '/privacy', label: 'Privacy Policy' },
  { to: '/terms', label: 'Terms of Service' },
  { href: '#', label: 'Cookie Policy' },
]

export function Footer() {
  return (
    <footer className="w-full bg-dark-2 border-t border-border-dark pt-16 pb-10 px-6 md:px-12">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-12 max-w-[1200px] mx-auto pb-12 border-b border-border-dark">
        <div>
          <Link
            to="/"
            className="inline-flex items-center gap-2.5 no-underline mb-3.5"
          >
            <div className="w-8 h-8 bg-accent flex items-center justify-center [clip-path:polygon(0_0,100%_0,100%_75%,75%_100%,0_100%)]">
              <span className="font-sora font-extrabold text-sm text-white">P</span>
            </div>
            <span className="font-sora font-semibold text-base text-landing-white tracking-tight">
              Proj-X
            </span>
          </Link>
          <p className="text-sm text-white-dim leading-relaxed mt-3.5 max-w-[260px]">
            The construction software built for how GCs actually work. Upload plans, run jobs, and grow with
            confidence — trusted by 500+ contractors.
          </p>
          <div className="flex gap-2 mt-5">
            {['f', '𝕏', 'in', '▶'].map((c) => (
              <a
                key={c}
                href="#"
                className="w-8 h-8 rounded-lg bg-white-faint border border-border-dark flex items-center justify-center text-white-dim text-xs font-bold no-underline transition-all hover:bg-accent hover:border-accent hover:text-white"
                aria-label={`Social ${c}`}
              >
                {c}
              </a>
            ))}
          </div>
        </div>
        <div>
          <div className="font-sora text-[13px] font-bold text-landing-white tracking-wider uppercase mb-4">
            Product
          </div>
          <ul className="list-none flex flex-col gap-2.5">
            {productLinks.map(({ href, label }) => (
              <li key={label}>
                <a
                  href={href}
                  className="text-sm text-white-dim no-underline transition-colors hover:text-landing-white"
                >
                  {label}
                </a>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <div className="font-sora text-[13px] font-bold text-landing-white tracking-wider uppercase mb-4">
            Company
          </div>
          <ul className="list-none flex flex-col gap-2.5">
            {companyLinks.map(({ href, label }) => (
              <li key={label}>
                <a
                  href={href}
                  className="text-sm text-white-dim no-underline transition-colors hover:text-landing-white"
                >
                  {label}
                </a>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <div className="font-sora text-[13px] font-bold text-landing-white tracking-wider uppercase mb-4">
            Legal
          </div>
          <ul className="list-none flex flex-col gap-2.5">
            {legalLinks.map((item) => (
              <li key={item.label}>
                {'to' in item && typeof item.to === 'string' ? (
                  <Link
                    to={item.to}
                    className="text-sm text-white-dim no-underline transition-colors hover:text-landing-white"
                  >
                    {item.label}
                  </Link>
                ) : (
                  <a
                    href={'href' in item ? item.href : '#'}
                    className="text-sm text-white-dim no-underline transition-colors hover:text-landing-white"
                  >
                    {item.label}
                  </a>
                )}
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="max-w-[1200px] mx-auto mt-7 flex flex-col sm:flex-row items-center justify-between gap-4">
        <span className="text-[13px] text-white-dim/80">
          © 2026 Proj-X. All rights reserved. | Built for contractors, by builders.
        </span>
      </div>
    </footer>
  )
}
