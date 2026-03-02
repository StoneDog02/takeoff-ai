interface StatCardProps {
  value: string
  label: string
}

export function StatCard({ value, label }: StatCardProps) {
  return (
    <div className="text-center">
      <div className="text-4xl font-bold text-accent mb-1">{value}</div>
      <div className="text-gray-600 text-sm">{label}</div>
    </div>
  )
}
