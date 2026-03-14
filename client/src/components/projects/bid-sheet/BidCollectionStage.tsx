import { useState } from 'react'
import type { TradePackage, SubBid, Subcontractor } from '@/types/global'

interface BidCollectionStageProps {
  tradePackages: TradePackage[]
  subBids: SubBid[]
  subcontractors: Subcontractor[]
  onAddBid: (tradePackageId: string, subcontractorId: string, amount: number, notes?: string) => Promise<void>
  onSetAwarded: (subBidId: string, awarded: boolean) => Promise<void>
}

function getInitials(name: string): string {
  if (!name?.trim()) return '?'
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase().slice(0, 2)
  return name.slice(0, 2).toUpperCase()
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
    <div className="bidsheet-collection-neutral">
      <p className="text-sm text-muted mb-5">Track bids per trade. Multiple subs per trade allowed — award the winner.</p>
      {tradePackages.map((pkg) => {
        const bids = getBidsForPackage(pkg.id)
        const awardedBid = bids.find((b) => b.awarded)
        const hasAwarded = !!awardedBid
        const inputKey = pkg.id
        return (
          <div key={pkg.id} className="bidsheet-collection-neutral-card">
            <div className="bidsheet-collection-neutral-head">
              <div className="bidsheet-collection-neutral-head-left">
                <span className={`bidsheet-collection-neutral-bar ${hasAwarded ? 'awarded' : ''}`} />
                <div>
                  <div className="bidsheet-collection-neutral-title">{pkg.trade_tag}</div>
                  <div className="bidsheet-collection-neutral-subtitle">
                    {bids.length === 0
                      ? 'No bids yet'
                      : hasAwarded
                        ? `${bids.length} bid${bids.length !== 1 ? 's' : ''} received · Awarded to ${getSubName(awardedBid.subcontractor_id)}`
                        : `${bids.length} bid${bids.length !== 1 ? 's' : ''} received`}
                  </div>
                </div>
              </div>
              <div className={`bidsheet-collection-neutral-pill ${hasAwarded ? 'awarded' : ''}`}>
                {hasAwarded ? (
                  <>✓ AWARDED · ${Number(awardedBid.amount).toLocaleString()}</>
                ) : (
                  'Awaiting bids'
                )}
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9" /></svg>
              </div>
            </div>
            <div className="bidsheet-collection-neutral-body">
              {bids.length > 0 && (
                <div className="bidsheet-collection-neutral-table-wrap">
                  <div className="bidsheet-collection-neutral-table-head">
                    <span>SUBCONTRACTOR</span>
                    <span>AMOUNT</span>
                    <span>NOTES</span>
                    <span style={{ width: 100, textAlign: 'right' }} />
                  </div>
                  {bids.map((bid) => (
                    <div key={bid.id} className={`bidsheet-collection-neutral-table-row ${bid.awarded ? 'awarded' : ''}`}>
                      <div className="bidsheet-collection-neutral-sub">
                        <span className="bidsheet-collection-neutral-avatar" style={{ background: bid.awarded ? '#16a34a' : 'var(--border)' }}>{getInitials(getSubName(bid.subcontractor_id))}</span>
                        <span className="font-semibold text-sm">{getSubName(bid.subcontractor_id)}</span>
                      </div>
                      <div className="font-bold font-mono" style={{ color: bid.awarded ? '#16a34a' : 'var(--text-primary)' }}>${Number(bid.amount).toLocaleString()}</div>
                      <div className="text-sm text-[var(--text-muted)]">{bid.notes || '—'}</div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10 }}>
                        <button
                          type="button"
                          onClick={() => onSetAwarded(bid.id, !bid.awarded)}
                          className="bidsheet-collection-neutral-award-btn"
                          style={bid.awarded ? { background: '#16a34a', color: '#fff', borderColor: '#16a34a' } : undefined}
                        >
                          {bid.awarded ? '✓ Awarded' : 'Award'}
                        </button>
                        {bid.awarded && (
                          <button type="button" onClick={() => onSetAwarded(bid.id, false)} className="bidsheet-collection-neutral-x" aria-label="Remove award">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden>
                              <path d="M18 6L6 18M6 6l12 12" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div className="bidsheet-collection-neutral-add-wrap">
                <div className="bidsheet-collection-neutral-add-label">ADD BID</div>
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
                      placeholder="$ 0"
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
                    className="bidsheet-collection-neutral-add-btn"
                  >
                    + Add Bid
                  </button>
                </div>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
