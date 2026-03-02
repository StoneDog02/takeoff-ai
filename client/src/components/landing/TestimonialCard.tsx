interface TestimonialCardProps {
  quote: string
  name: string
  handle: string
}

export function TestimonialCard({ quote, name, handle }: TestimonialCardProps) {
  return (
    <div className="p-6 rounded-xl border border-gray-200 bg-white shadow-card">
      <p className="text-gray-700 mb-4 italic">&ldquo;{quote}&rdquo;</p>
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-gray-200 flex-shrink-0" />
        <div>
          <div className="font-semibold text-gray-900">{name}</div>
          <div className="text-sm text-gray-500">{handle}</div>
        </div>
      </div>
    </div>
  )
}
