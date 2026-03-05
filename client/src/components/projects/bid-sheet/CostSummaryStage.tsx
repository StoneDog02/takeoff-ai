import { useState } from 'react'
import type { CostBuckets, TradePackage, SubBid, Subcontractor } from '@/types/global'

interface CostSummaryStageProps {
  costBuckets: CostBuckets
  tradePackages?: TradePackage[]
  subBids?: SubBid[]
  subcontractors?: Subcontractor[]
  onUpdate: (updates: Partial<CostBuckets>) => void
  onSave: () => Promise<void>
  saving?: boolean
}

function getSubName(subs: Subcontractor[] | undefined, id: string) {
  return subs?.find((s) => s.id === id)?.name ?? id
}

export function CostSummaryStage({ costBuckets, tradePackages = [], subBids = [], subcontractors = [], onUpdate, onSave, saving }: CostSummaryStageProps) {
  const awardedFromBids = subBids.filter((b) => b.awarded).reduce((s, b) => s + Number(b.amount || 0), 0)
  const awardedTotal = awardedFromBids > 0 ? awardedFromBids : Number(costBuckets.awarded_bids ?? 0)
  const selfSupply = Number(costBuckets.self_supplied_materials ?? 0)
  const ownLabor = Number(costBuckets.own_labor ?? 0)
  const [overheadPct, setOverheadPct] = useState(12)
  const [marginPct, setMarginPct] = useState(15)

  const subtotal = awardedTotal + selfSupply + ownLabor
  const overheadAmt = subtotal * (overheadPct / 100)
  const marginAmt = (subtotal + overheadAmt) * (marginPct / 100)
  const total = subtotal + overheadAmt + marginAmt

  const awardedByTrade = tradePackages.map((pkg) => {
    const awarded = subBids.find((b) => b.trade_package_id === pkg.id && b.awarded)
    return { trade: pkg.trade_tag, subName: awarded ? getSubName(subcontractors, awarded.subcontractor_id) : null, amount: awarded?.amount ?? 0 }
  })

  const handleSave = async () => {
    onUpdate({ overhead_margin: Math.round(overheadAmt + marginAmt) })
    await onSave()
  }

  return (
    <div>
      <p className="text-sm text-muted mb-5">Internal only — full cost breakdown. Not shared with homeowner.</p>
      <div className="bidsheet-summary-grid">
        <div className="bidsheet-summary-col">
          <div className="bidsheet-summary-col-head">Awarded Sub Bids</div>
          {awardedByTrade.map(({ trade, subName, amount }) => (
            <div key={trade} className="bidsheet-summary-row">
              <div>
                <span className="text-sm font-semibold">{trade}</span>
                {subName && <span className="text-xs text-muted ml-2">— {subName}</span>}
              </div>
              <span className="font-bold text-sm" style={{ color: amount ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                {amount ? `$${Number(amount).toLocaleString()}` : 'No bid'}
              </span>
            </div>
          ))}
          {awardedByTrade.length === 0 && (
            <div className="bidsheet-summary-row">
              <span className="text-sm text-muted">No awarded bids yet</span>
              <span className="font-bold text-sm text-muted">$0</span>
            </div>
          )}
          <div className="bidsheet-summary-subtotal">
            <span>Subs Subtotal</span>
            <span>${awardedTotal.toLocaleString()}</span>
          </div>
        </div>

        <div className="bidsheet-summary-col">
          <div className="bidsheet-summary-col-head">GC Direct Costs</div>
          {[
            { label: 'Self-Supply Materials', value: selfSupply, setter: (v: number) => onUpdate({ self_supplied_materials: v }) },
            { label: 'Own Labor', value: ownLabor, setter: (v: number) => onUpdate({ own_labor: v }) },
          ].map((row) => (
            <div key={row.label} className="bidsheet-summary-row">
              <span className="text-sm font-semibold">{row.label}</span>
              <div className="flex items-center gap-1.5">
                <span className="text-muted text-sm">$</span>
                <input
                  type="number"
                  value={row.value || ''}
                  onChange={(e) => row.setter(Number(e.target.value) || 0)}
                  className="w-24 px-2 py-1 border border-border rounded text-sm font-bold text-right outline-none bg-surface"
                />
              </div>
            </div>
          ))}
          <div className="p-3 border-b border-border/50">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-semibold">Overhead</span>
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  value={overheadPct}
                  onChange={(e) => setOverheadPct(Number(e.target.value) || 0)}
                  className="w-12 px-2 py-1 border border-border rounded text-sm font-bold text-right outline-none bg-surface"
                />
                <span className="text-muted text-sm">%</span>
                <span className="font-bold text-sm min-w-[80px] text-right">${Math.round(overheadAmt).toLocaleString()}</span>
              </div>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm font-semibold">Margin</span>
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  value={marginPct}
                  onChange={(e) => setMarginPct(Number(e.target.value) || 0)}
                  className="w-12 px-2 py-1 border border-border rounded text-sm font-bold text-right outline-none bg-surface"
                />
                <span className="text-muted text-sm">%</span>
                <span className="font-bold text-sm min-w-[80px] text-right">${Math.round(marginAmt).toLocaleString()}</span>
              </div>
            </div>
          </div>
          <div className="bidsheet-summary-total-bar">
            <span className="label">Total Project Cost</span>
            <span className="value">${Math.round(total).toLocaleString()}</span>
          </div>
        </div>
      </div>
      <button type="button" onClick={handleSave} disabled={saving} className="btn btn-primary">
        {saving ? 'Saving…' : 'Save cost summary'}
      </button>
    </div>
  )
}
