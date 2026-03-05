import { TRADE_COLORS } from '@/data/mockDirectoryData'

interface TradePillProps {
  trade: string
}

export function TradePill({ trade }: TradePillProps) {
  const color = TRADE_COLORS[trade] ?? '#9ca3af'
  return (
    <span
      className="text-[11px] font-bold uppercase tracking-wider rounded-full px-2.5 py-0.5"
      style={{
        background: `${color}18`,
        color,
      }}
    >
      {trade}
    </span>
  )
}
