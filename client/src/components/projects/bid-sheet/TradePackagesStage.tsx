import { useState } from 'react'
import type { TradePackage, TakeoffItem } from '@/types/global'
import { TRADE_COLORS } from '../BidSheetFlow'

function isTakeoffItem(item: unknown): item is TakeoffItem {
  return typeof item === 'object' && item !== null && 'description' in item && 'quantity' in item && 'unit' in item
}

interface TradePackagesStageProps {
  tradePackages: TradePackage[]
}

export function TradePackagesStage({ tradePackages }: TradePackagesStageProps) {
  const [expandedTrade, setExpandedTrade] = useState<string | null>(tradePackages[0]?.trade_tag ?? null)

  if (tradePackages.length === 0) {
    return (
      <p className="text-sm text-muted">
        No trade packages yet. Run Launch Takeoff and then generate packages from the takeoff data (group by trade_tag).
      </p>
    )
  }

  const colors = (trade: string) => TRADE_COLORS[trade] || TRADE_COLORS.TBD

  return (
    <>
      <div className="bidsheet-trade-chips">
        {tradePackages.map((pkg) => {
          const c = colors(pkg.trade_tag)
          const isExpanded = expandedTrade === pkg.trade_tag
          return (
            <button
              key={pkg.id}
              type="button"
              className={`bidsheet-trade-chip ${isExpanded ? 'expanded' : ''}`}
              style={{ borderColor: isExpanded ? c.accent : c.light, backgroundColor: isExpanded ? c.bg : 'var(--bg-surface)' }}
              onClick={() => setExpandedTrade(isExpanded ? null : pkg.trade_tag)}
            >
              <div className="bidsheet-trade-chip-name" style={{ color: c.accent }}>
                {pkg.trade_tag}
              </div>
              <div className="bidsheet-trade-chip-count">{(pkg.line_items || []).length} line items</div>
            </button>
          )
        })}
      </div>

      {tradePackages.map((pkg) => {
        if (expandedTrade !== pkg.trade_tag) return null
        const c = colors(pkg.trade_tag)
        return (
          <div key={pkg.id} className="bidsheet-pkg-card bidsheet-pkg-card-neutral">
            <div className="bidsheet-pkg-head bidsheet-pkg-head-neutral">
              <div className="bidsheet-pkg-head-title" style={{ color: c.accent }}>
                {pkg.trade_tag} Scope Package
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted italic">Scope for subs — no pricing shown</span>
                <button
                  type="button"
                  className="text-xs font-bold px-3 py-1.5 rounded-md text-white border-0 cursor-pointer"
                  style={{ background: c.accent }}
                >
                  Send to Sub
                </button>
              </div>
            </div>
            <table className="bidsheet-pkg-table bidsheet-pkg-table-neutral">
              <thead>
                <tr>
                  <th>Description</th>
                  <th>Notes</th>
                  <th className="num">Qty</th>
                  <th className="num">Unit</th>
                </tr>
              </thead>
              <tbody>
                {(pkg.line_items || []).filter(isTakeoffItem).map((item, i) => (
                  <tr key={i}>
                    <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{item.description}</td>
                    <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{item.notes || '—'}</td>
                    <td className="num" style={{ color: 'var(--text-primary)' }}>
                      {Number(item.quantity).toLocaleString()}
                    </td>
                    <td className="unit">{item.unit}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      })}
    </>
  )
}
