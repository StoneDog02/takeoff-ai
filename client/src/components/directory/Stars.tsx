import { Star } from 'lucide-react'

interface StarsProps {
  rating: number
}

export function Stars({ rating }: StarsProps) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          size={11}
          fill={i <= rating ? '#f59e0b' : 'none'}
          color={i <= rating ? '#f59e0b' : 'var(--text-muted)'}
        />
      ))}
    </div>
  )
}
