import { useState } from 'react'
import type { TradePackage, SubBid, Subcontractor } from '@/types/global'
import { TRADE_COLORS } from '../BidSheetFlow'

interface BidCollectionStageProps {
  tradePackages: TradePackage[]
  subBids: SubBid[]
  subcontractors: Subcontractor[]
  onAddBid: (tradePackageId: string, subcontractorId: string, amount: number, notes?: string) => Promise<void>
  onSetAwarded: (subBidId: string, awarded: boolean) => Promise<void>
}

export function BidCollectionStage({
  tradePackages,
  subBids,
  subcontractors,
  onAddBid,
  onSetAwarded,
}: BidCollectionStageProps) {
  const [bidInputs, setBidInputs] = useState<Record<string, string>>({})

  const getBidsForPackage = (pkgId: string) => subBids.filter((b) => b.trade_package_id === pkgId)
  const getSubName = (id: string) => subcontractors.find((s) => s.id === id)?.name ?? id
  const colors = (trade: string) => TRADE_COLORS[trade] || TRADE_COLORS.TBD

  const handleAdd = async (pkg: TradePackage) => {
    const inputKey = pkg.id
    const sub = bidInputs[`${inputKey}_sub`]
    const amt = bidInputs[`${inputKey}_amt`]
    const notes = bidInputs[`${inputKey}_notes`] || ''
    if (!sub || !amt) return
    await onAddBid(pkg.id, sub, Number(amt), notes || undefined)
    setBidInputs((prev) => ({ ...prev, [`${inputKey}_sub`]: '', [`${inputKey}_amt`]: '', [`${inputKey}_notes`]: '' }))
  }

  if (tradePackages.length === 0) {
    return <p className="text-sm text-muted">Generate trade packages in Stage 1 first.</p>
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted mb-5">Track bids per trade. Multiple subs per trade allowed — award the winner.</p>
      {tradePackages.map((pkg, _pi) => {
        const bids = getBidsForPackage(pkg.id)
        const c = colors(pkg.trade_tag)
        const inputKey = pkg.id
        return (
          <div
            key={pkg.id}
            className="bidsheet-pkg-card"
            style={{ borderColor: c.light, marginBottom: 16 }}
          >
            <div className="bidsheet-pkg-head" style={{ background: c.bg, borderColor: c.light }}>
              <div className="bidsheet-pkg-head-title" style={{ color: c.accent }}>
                {pkg.trade_tag}
              </div>
              <span className="text-xs text-muted">{bids.length} bid{bids.length !== 1 ? 's' : ''} received</span>
            </div>
            <div style={{ padding: '16px 18px' }}>
              {bids.length > 0 && (
                <div className="mb-4">
                  {bids.map((bid, _bi) => (
                    <div
                      key={bid.id}
                      className={`bidsheet-bid-row ${bid.awarded ? 'awarded' : ''}`}
                    >
                      <div className="flex-1">
                        <div className="font-bold text-sm">{getSubName(bid.subcontractor_id)}</div>
                        {bid.notes && <div className="text-xs text-muted">{bid.notes}</div>}
                      </div>
                      <div className="font-extrabold text-base" style={{ color: 'var(--text-primary)' }}>
                        ${Number(bid.amount).toLocaleString()}
                      </div>
                      <button
                        type="button"
                        onClick={() => onSetAwarded(bid.id, !bid.awarded)}
                        className="px-3.5 py-1.5 rounded-md text-xs font-bold cursor-pointer border"
                        style={
                          bid.awarded
                            ? { background: '#16A34A', color: 'white', borderColor: '#16A34A' }
                            : { background: 'var(--bg-surface)', color: 'var(--text-primary)', borderColor: 'var(--border)' }
                        }
                      >
                        {bid.awarded ? '✓ Awarded' : 'Award'}
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <div className="bidsheet-bid-add">
                <div className="field">
                  <label>Sub Name</label>
                  <select
                    value={bidInputs[`${inputKey}_sub`] || ''}
                    onChange={(e) => setBidInputs((prev) => ({ ...prev, [`${inputKey}_sub`]: e.target.value }))}
                  >
                    <option value="">Select sub</option>
                    {subcontractors.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} {s.trade !== pkg.trade_tag ? `(${s.trade})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field amount">
                  <label>Bid Amount</label>
                  <input
                    type="number"
                    placeholder="$0"
                    value={bidInputs[`${inputKey}_amt`] || ''}
                    onChange={(e) => setBidInputs((prev) => ({ ...prev, [`${inputKey}_amt`]: e.target.value }))}
                  />
                </div>
                <div className="field">
                  <label>Notes</label>
                  <input
                    placeholder="Optional notes"
                    value={bidInputs[`${inputKey}_notes`] || ''}
                    onChange={(e) => setBidInputs((prev) => ({ ...prev, [`${inputKey}_notes`]: e.target.value }))}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => handleAdd(pkg)}
                  disabled={!bidInputs[`${inputKey}_sub`] || !bidInputs[`${inputKey}_amt`]}
                  className="btn px-4 py-2 rounded-lg text-sm font-bold cursor-pointer border-0 text-white"
                  style={{ background: c.accent, whiteSpace: 'nowrap' }}
                >
                  + Add Bid
                </button>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
