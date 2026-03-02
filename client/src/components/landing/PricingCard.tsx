import { Link } from 'react-router-dom'

interface PricingCardProps {
  name: string
  description: string
  price: string
  period: string
  features: string[]
  cta: string
  highlighted?: boolean
}

export function PricingCard({
  name,
  description,
  price,
  period,
  features,
  cta,
  highlighted = false,
}: PricingCardProps) {
  return (
    <div
      className={`relative p-6 rounded-xl border-2 bg-white shadow-card ${
        highlighted ? 'border-accent' : 'border-gray-200'
      }`}
    >
      {highlighted && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-accent text-white text-xs font-medium">
          Most Popular
        </div>
      )}
      <h3 className="text-xl font-semibold text-gray-900 mb-1">{name}</h3>
      <p className="text-gray-600 text-sm mb-4">{description}</p>
      <div className="mb-6">
        <span className="text-3xl font-bold text-gray-900">{price}</span>
        <span className="text-gray-600 text-sm">/{period}</span>
      </div>
      <ul className="space-y-3 mb-6">
        {features.map((f) => (
          <li key={f} className="flex items-center gap-2 text-sm text-gray-700">
            <span className="text-accent">✓</span>
            {f}
          </li>
        ))}
      </ul>
      <Link
        to="/sign-up"
        className={`block w-full py-3 rounded-lg text-sm font-medium text-center transition-colors ${
          highlighted
            ? 'bg-accent text-white hover:bg-accent-hover'
            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
        }`}
      >
        {cta}
      </Link>
    </div>
  )
}
