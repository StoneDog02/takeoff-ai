import { useState, useEffect } from 'react'
import type { Project, Subcontractor, BidSheet, SubBid, TradePackage } from '@/types/global'
import type { MaterialList } from '@/types/global'
import { LaunchTakeoffWidget, type TakeoffPlanType } from '@/components/projects/LaunchTakeoffWidget'
import { dayjs, formatRelative } from '@/lib/date'

function formatCurrency(n: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n)
}

type BidStatusKey = 'pending' | 'viewed' | 'bid_received' | 'awarded' | 'declined'
function getBidStatus(bid: SubBid): { key: BidStatusKey; label: string; subtitle?: string } {
  if (bid.awarded) return { key: 'awarded', label: 'Awarded' }
  const status = (bid.response_status || 'pending').toLowerCase()
  if (status === 'declined') return { key: 'declined', label: 'Declined' }
  if (status === 'bid_received') return { key: 'bid_received', label: 'Bid Received', subtitle: 'Ready to review' }
  if (status === 'viewed') return { key: 'viewed', label: "Viewed", subtitle: "They've opened it" }
  return { key: 'pending', label: 'Pending' }
}

export type TakeoffItem = {
  id: string
  material_list: MaterialList
  created_at: string
}

export interface EstimatingWorkspaceProps {
  project: Project | null
  takeoffs: TakeoffItem[]
  subcontractors: Subcontractor[]
  onRefreshTakeoffs: () => void
  onRefreshSubcontractors: () => void
  onBuildEstimate: () => void
  /** When true, Stage 2 can be complete and Stage 3 is unlocked. From bid sheet awarded count. */
  hasAwardedBids?: boolean
  /** Optional: switch to Takeoff tab (e.g. "View full takeoff"). */
  onViewFullTakeoff?: () => void
  /** Props for LaunchTakeoffWidget when no takeoff exists (and for re-run). */
  onStartTakeoff?: (file: File, planType: TakeoffPlanType, tradeFilter?: null | string | string[]) => void
  takeoffResult?: { material_list: MaterialList; id?: string; created_at?: string; truncated?: boolean } | null
  takeoffError?: string | null
  takeoffInProgress?: boolean
  takeoffProgress?: number
  takeoffMessage?: string
  takeoffStartTime?: number
  /** Stage 2: bid sheet data (from getBidSheet). When null/undefined, workspace may still show takeoff-derived trade list. */
  bidSheet?: BidSheet | null
  /** Stage 2: add a sub bid for a trade (parent creates subcontractor + sub_bid and saves bid sheet). */
  onAddSubBid?: (tradeTag: string, sub: { name: string; email: string; phone?: string }, amount: number) => Promise<void>
  /** Stage 2: set awarded on a sub bid. */
  onSetAwarded?: (subBidId: string, awarded: boolean) => Promise<void>
  /** Stage 2: add a custom trade package (not from takeoff). */
  onAddCustomTrade?: (tradeTag: string) => Promise<void>
  /** Stage 2: skip bid sheet (e.g. "I'll price this manually"). */
  onSkipBidSheet?: () => void
  /** Stage 2: open Bid Sheet tab to add more subs or manage bids. */
  onViewBidSheet?: () => void
  /** Stage 2: refetch bid sheet (e.g. for polling). When provided, Stage 2 header shows "Last updated X s ago · Refresh". */
  onRefreshBidSheet?: () => void
  /** Stage 2: timestamp of last bid sheet fetch (ms) for "Last updated X seconds ago". */
  lastBidSheetUpdated?: number | null
  /** Stage 2: resend portal link email for a sub bid. */
  onResendBid?: (subBidId: string) => Promise<void>
  /** Stage 3: open estimate flow with no prefill (blank estimate). */
  onBuildBlankEstimate?: () => void
}

type StageStatus = 'locked' | 'active' | 'complete'

export function EstimatingWorkspace({
  project,
  takeoffs,
  subcontractors,
  onRefreshTakeoffs,
  onRefreshSubcontractors,
  onBuildEstimate,
  hasAwardedBids = false,
  onViewFullTakeoff,
  onStartTakeoff,
  takeoffResult,
  takeoffError,
  takeoffInProgress,
  takeoffProgress,
  takeoffMessage,
  takeoffStartTime,
  bidSheet,
  onAddSubBid,
  onSetAwarded,
  onAddCustomTrade,
  onSkipBidSheet,
  onViewBidSheet,
  onRefreshBidSheet,
  lastBidSheetUpdated,
  onResendBid,
  onBuildBlankEstimate,
}: EstimatingWorkspaceProps) {
  const [stage1CategoriesOpen, setStage1CategoriesOpen] = useState(false)
  const [stage2AddSubExpanded, setStage2AddSubExpanded] = useState<string | null>(null)
  const [stage2AddSubForm, setStage2AddSubForm] = useState({ name: '', email: '', amount: '' })
  const [stage2AddSubSaving, setStage2AddSubSaving] = useState(false)
  const [stage2CustomTradeName, setStage2CustomTradeName] = useState('')
  const [stage2CustomTradeAdding, setStage2CustomTradeAdding] = useState(false)
  const [resendingBidId, setResendingBidId] = useState<string | null>(null)
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null)
  const [secondsSinceBidSheetUpdate, setSecondsSinceBidSheetUpdate] = useState(0)

  const baseUrl = typeof import.meta !== 'undefined' && import.meta.env?.VITE_APP_URL
    ? (import.meta.env.VITE_APP_URL as string).replace(/\/$/, '')
    : (typeof window !== 'undefined' ? window.location.origin : '')

  useEffect(() => {
    if (!onRefreshBidSheet) return
    const t = setInterval(onRefreshBidSheet, 30_000)
    return () => clearInterval(t)
  }, [onRefreshBidSheet])

  useEffect(() => {
    if (lastBidSheetUpdated == null) return
    const tick = () => setSecondsSinceBidSheetUpdate(Math.max(0, Math.round((Date.now() - lastBidSheetUpdated) / 1000)))
    tick()
    const t = setInterval(tick, 1000)
    return () => clearInterval(t)
  }, [lastBidSheetUpdated])
  const hasTakeoff = takeoffs.length > 0
  const stage3Unlocked = hasTakeoff || hasAwardedBids

  const stage1Status: StageStatus = hasTakeoff ? 'complete' : 'active'
  const stage2Status: StageStatus = !hasTakeoff ? 'locked' : hasAwardedBids ? 'complete' : 'active'
  const stage3Status: StageStatus = !stage3Unlocked ? 'locked' : 'active'

  const stages = [
    { key: 'takeoff', label: '1 Takeoff', status: stage1Status },
    { key: 'bidsheet', label: '2 Bid Sheet', status: stage2Status },
    { key: 'estimate', label: '3 Build Estimate', status: stage3Status },
  ] as const

  const latestTakeoff = takeoffs[0]
  const categories = latestTakeoff?.material_list?.categories ?? []
  const totalItems = categories.reduce((sum, cat) => sum + (cat.items?.length ?? 0), 0)
  const categoryCount = categories.length

  const subBids = bidSheet?.sub_bids ?? []
  const tradePackages = bidSheet?.trade_packages ?? []
  const hasSubBids = subBids.length > 0
  const awardedBids = subBids.filter((b) => b.awarded)
  const awardedCount = awardedBids.length
  const tradeCount = Math.max(tradePackages.length, 1)
  const tradesWithAwarded = new Set(awardedBids.map((b) => b.trade_package_id))
  const awardedTradeCount = tradesWithAwarded.size
  const totalAwarded = awardedBids.reduce((s, b) => s + (b.amount ?? 0), 0)
  const subsById = new Map(subcontractors.map((s) => [s.id, s]))
  const packagesById = new Map(tradePackages.map((p) => [p.id, p]))
  const tradeNamesFromTakeoff = categories.map((c) => c.name)
  const displayTradeList = tradePackages.length > 0
    ? tradePackages
    : tradeNamesFromTakeoff.map((name) => ({ id: `display-${name}`, project_id: project?.id ?? '', trade_tag: name, line_items: [] } as TradePackage))

  return (
    <div className="estimating-workspace">
      <div className="estimating-workspace-progress">
        {stages.map((stage, i) => (
          <div key={stage.key} className="estimating-workspace-progress-segment">
            <div
              className={`estimating-workspace-progress-stage estimating-workspace-progress-stage--${stage.status}`}
              aria-current={stage.status === 'active' ? 'step' : undefined}
            >
              {stage.status === 'complete' ? (
                <span className="estimating-workspace-progress-icon" aria-hidden>✓</span>
              ) : (
                <span className="estimating-workspace-progress-num">{i + 1}</span>
              )}
              <span className="estimating-workspace-progress-label">{stage.label}</span>
            </div>
            {i < stages.length - 1 && (
              <div
                className={`estimating-workspace-progress-connector ${
                  stage.status === 'complete' ? 'estimating-workspace-progress-connector--done' : ''
                }`}
                aria-hidden
              />
            )}
          </div>
        ))}
      </div>

      <div className="estimating-workspace-cards">
        <div className="estimating-workspace-card">
          <div className="estimating-workspace-card-head">
            <h3 className="estimating-workspace-card-title">Run Takeoff</h3>
            <span className={`estimating-workspace-card-status estimating-workspace-card-status--${stage1Status}`}>
              {stage1Status === 'complete' ? 'Complete' : stage1Status === 'active' ? 'Current' : 'Locked'}
            </span>
          </div>
          <div className="estimating-workspace-card-body">
            {!hasTakeoff ? (
              <>
                <p className="estimating-workspace-card-subtext">
                  Upload your plans and our AI will generate a material list broken down by trade category.
                </p>
                {project && (
                  <LaunchTakeoffWidget
                    projectId={project.id}
                    planType={(project.plan_type as TakeoffPlanType) ?? 'residential'}
                    onStartTakeoff={onStartTakeoff}
                    existingTakeoffs={takeoffs}
                    takeoffResult={takeoffResult}
                    takeoffError={takeoffError}
                    takeoffInProgress={takeoffInProgress}
                    takeoffProgress={takeoffProgress}
                    takeoffMessage={takeoffMessage}
                    takeoffStartTime={takeoffStartTime}
                  />
                )}
              </>
            ) : (
              <div className="estimating-workspace-takeoff-summary">
                <div className="estimating-workspace-takeoff-summary-row">
                  <span className="estimating-workspace-takeoff-badge estimating-workspace-takeoff-badge--complete">Complete</span>
                  <span className="estimating-workspace-takeoff-meta">
                    {latestTakeoff.created_at
                      ? dayjs(latestTakeoff.created_at).format('MMM D, YYYY')
                      : '—'}
                    {' · '}
                    {categoryCount} categor{categoryCount === 1 ? 'y' : 'ies'} · {totalItems} items
                  </span>
                </div>
                <div className="estimating-workspace-takeoff-categories-wrap">
                  <button
                    type="button"
                    className="estimating-workspace-takeoff-categories-toggle"
                    onClick={() => setStage1CategoriesOpen((o) => !o)}
                    aria-expanded={stage1CategoriesOpen}
                  >
                    {stage1CategoriesOpen ? 'Hide categories' : 'Show categories'}
                    <span className="estimating-workspace-takeoff-categories-chevron" aria-hidden>
                      {stage1CategoriesOpen ? '▼' : '▶'}
                    </span>
                  </button>
                  {stage1CategoriesOpen && (
                    <ul className="estimating-workspace-takeoff-categories-list">
                      {categories.map((cat) => (
                        <li key={cat.name} className="estimating-workspace-takeoff-category-item">
                          <span className="estimating-workspace-takeoff-category-name">{cat.name}</span>
                          <span className="estimating-workspace-takeoff-category-count">
                            {(cat.items?.length ?? 0)} items
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div className="estimating-workspace-takeoff-actions">
                  {onViewFullTakeoff && (
                    <button
                      type="button"
                      className="estimating-workspace-takeoff-rerun"
                      onClick={onViewFullTakeoff}
                    >
                      Re-run
                    </button>
                  )}
                  {onViewFullTakeoff && (
                    <>
                      <span className="estimating-workspace-takeoff-actions-sep">·</span>
                      <button
                        type="button"
                        className="estimating-workspace-takeoff-view-full"
                        onClick={onViewFullTakeoff}
                      >
                        View full takeoff →
                      </button>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className={`estimating-workspace-card ${!hasTakeoff ? 'estimating-workspace-card--locked' : ''}`}>
          <div className="estimating-workspace-card-head">
            <h3 className="estimating-workspace-card-title">Collect Subcontractor Bids</h3>
            <span className={`estimating-workspace-card-status estimating-workspace-card-status--${stage2Status}`}>
              {stage2Status === 'complete' ? 'Complete' : stage2Status === 'active' ? 'Current' : 'Locked'}
            </span>
            {hasSubBids && onRefreshBidSheet != null && lastBidSheetUpdated != null && (
              <p className="estimating-workspace-card-meta">
                Last updated {secondsSinceBidSheetUpdate === 0 ? 'just now' : `${secondsSinceBidSheetUpdate} seconds ago`}
                {' · '}
                <button type="button" className="estimating-workspace-card-refresh" onClick={onRefreshBidSheet}>
                  Refresh
                </button>
              </p>
            )}
          </div>
          <div className="estimating-workspace-card-body">
            <p className="estimating-workspace-card-subtext">
              Dispatch trade packages to subs based on your takeoff. Awarded bids will flow directly into your estimate.
            </p>
            {!hasTakeoff ? (
              <div className="estimating-workspace-stage-locked">
                <span className="estimating-workspace-stage-locked-icon" aria-hidden>🔒</span>
                <p className="estimating-workspace-stage-locked-text">Complete takeoff first to generate trade packages.</p>
              </div>
            ) : !hasSubBids ? (
              <div className="estimating-workspace-bidsheet-empty">
                <ul className="estimating-workspace-trade-rows">
                  {displayTradeList.map((pkg) => (
                    <li key={pkg.id} className="estimating-workspace-trade-row">
                      <span className="estimating-workspace-trade-name">{pkg.trade_tag}</span>
                      <div className="estimating-workspace-trade-actions">
                        {stage2AddSubExpanded === pkg.trade_tag ? (
                          <div className="estimating-workspace-add-sub-form">
                            <input
                              type="text"
                              placeholder="Name"
                              value={stage2AddSubForm.name}
                              onChange={(e) => setStage2AddSubForm((f) => ({ ...f, name: e.target.value }))}
                              className="estimate-wizard-input"
                            />
                            <input
                              type="email"
                              placeholder="Email"
                              value={stage2AddSubForm.email}
                              onChange={(e) => setStage2AddSubForm((f) => ({ ...f, email: e.target.value }))}
                              className="estimate-wizard-input"
                            />
                            <input
                              type="number"
                              placeholder="Bid amount"
                              value={stage2AddSubForm.amount}
                              onChange={(e) => setStage2AddSubForm((f) => ({ ...f, amount: e.target.value }))}
                              className="estimate-wizard-input"
                            />
                            <button
                              type="button"
                              className="btn btn-primary"
                              disabled={stage2AddSubSaving || !stage2AddSubForm.name.trim()}
                              onClick={async () => {
                                if (!onAddSubBid || !stage2AddSubForm.name.trim()) return
                                setStage2AddSubSaving(true)
                                try {
                                  await onAddSubBid(pkg.trade_tag, {
                                    name: stage2AddSubForm.name.trim(),
                                    email: stage2AddSubForm.email.trim(),
                                  }, Number(stage2AddSubForm.amount) || 0)
                                  setStage2AddSubExpanded(null)
                                  setStage2AddSubForm({ name: '', email: '', amount: '' })
                                  onRefreshSubcontractors()
                                } finally {
                                  setStage2AddSubSaving(false)
                                }
                              }}
                            >
                              Add
                            </button>
                            <button
                              type="button"
                              className="btn btn-ghost"
                              onClick={() => {
                                setStage2AddSubExpanded(null)
                                setStage2AddSubForm({ name: '', email: '', amount: '' })
                              }}
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            className="estimating-workspace-add-sub-btn"
                            onClick={() => setStage2AddSubExpanded(pkg.trade_tag)}
                          >
                            Add Sub →
                          </button>
                        )}
                      </div>
                      <span className="estimating-workspace-trade-pill estimating-workspace-trade-pill--none">No Bids</span>
                    </li>
                  ))}
                </ul>
                {onAddCustomTrade && (
                  <div className="estimating-workspace-add-custom-trade">
                    <input
                      type="text"
                      placeholder="Trade name"
                      value={stage2CustomTradeName}
                      onChange={(e) => setStage2CustomTradeName(e.target.value)}
                      className="estimate-wizard-input"
                    />
                    <button
                      type="button"
                      className="btn btn-ghost"
                      disabled={stage2CustomTradeAdding || !stage2CustomTradeName.trim()}
                      onClick={async () => {
                        if (!stage2CustomTradeName.trim()) return
                        setStage2CustomTradeAdding(true)
                        try {
                          await onAddCustomTrade(stage2CustomTradeName.trim())
                          setStage2CustomTradeName('')
                        } finally {
                          setStage2CustomTradeAdding(false)
                        }
                      }}
                    >
                      Add custom trade
                    </button>
                  </div>
                )}
                {onSkipBidSheet && (
                  <button type="button" className="estimating-workspace-skip-bidsheet" onClick={onSkipBidSheet}>
                    Skip — I&apos;ll price this manually →
                  </button>
                )}
              </div>
            ) : (
              <div className="estimating-workspace-bidsheet-table-wrap">
                <div className="estimating-workspace-bidsheet-summary">
                  {awardedTradeCount} of {tradeCount} trades awarded · Total awarded: {formatCurrency(totalAwarded)}
                </div>
                <table className="estimating-workspace-bidsheet-table">
                  <thead>
                    <tr>
                      <th>Trade</th>
                      <th>Company</th>
                      <th>Bid Amount</th>
                      <th>Status</th>
                      <th aria-hidden />
                    </tr>
                  </thead>
                  <tbody>
                    {subBids.map((bid) => {
                      const pkg = packagesById.get(bid.trade_package_id)
                      const sub = subsById.get(bid.subcontractor_id)
                      const status = getBidStatus(bid)
                      const canAward = status.key === 'bid_received' && !bid.awarded
                      const showAmount = status.key === 'bid_received' || bid.awarded
                      const portalUrl = bid.portal_token ? `${baseUrl}/bid/${bid.portal_token}` : ''
                      return (
                        <tr key={bid.id} className={bid.awarded ? 'estimating-workspace-bid-row--awarded' : ''}>
                          <td>{pkg?.trade_tag ?? '—'}</td>
                          <td>{sub?.name ?? '—'}</td>
                          <td>{showAmount ? formatCurrency(bid.amount ?? 0) : '—'}</td>
                          <td>
                            <div className="estimating-workspace-bid-status-cell">
                              <span className={`estimating-workspace-bid-status estimating-workspace-bid-status--${status.key}`} title={status.subtitle}>
                                {status.label}
                              </span>
                              {status.subtitle && <span className="estimating-workspace-bid-status-sub">{status.subtitle}</span>}
                              {bid.viewed_at && (
                                <span className="estimating-workspace-bid-status-sub">Opened {formatRelative(bid.viewed_at)}</span>
                              )}
                            </div>
                          </td>
                          <td>
                            <div className="estimating-workspace-bid-actions">
                              {portalUrl && (
                                <button
                                  type="button"
                                  className="estimating-workspace-bid-action-btn"
                                  title="Copy link"
                                  onClick={async () => {
                                    try {
                                      await navigator.clipboard.writeText(portalUrl)
                                      setCopyFeedback(bid.id)
                                      setTimeout(() => setCopyFeedback(null), 2000)
                                    } catch {
                                      // ignore
                                    }
                                  }}
                                >
                                  {copyFeedback === bid.id ? '✓ Copied' : '📋 Copy link'}
                                </button>
                              )}
                              {onResendBid && portalUrl && (
                                <button
                                  type="button"
                                  className="estimating-workspace-bid-action-btn"
                                  disabled={resendingBidId === bid.id}
                                  onClick={async () => {
                                    setResendingBidId(bid.id)
                                    try {
                                      await onResendBid(bid.id)
                                    } finally {
                                      setResendingBidId(null)
                                    }
                                  }}
                                >
                                  {resendingBidId === bid.id ? 'Sending…' : 'Resend email'}
                                </button>
                              )}
                              {onSetAwarded && (
                                <button
                                  type="button"
                                  className="estimating-workspace-award-btn"
                                  disabled={!canAward}
                                  onClick={() => canAward && onSetAwarded(bid.id, true)}
                                >
                                  Award
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
                {onViewBidSheet && (
                  <button
                    type="button"
                    className="estimating-workspace-add-another-sub"
                    onClick={onViewBidSheet}
                  >
                    Add another sub
                  </button>
                )}
                {awardedTradeCount > 0 && (
                  <div className="estimating-workspace-ready-nudge">
                    Ready to build your estimate →
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className={`estimating-workspace-card ${!stage3Unlocked ? 'estimating-workspace-card--locked' : ''}`}>
          <div className="estimating-workspace-card-head">
            <h3 className="estimating-workspace-card-title">Build & Send Estimate</h3>
            <span className={`estimating-workspace-card-status estimating-workspace-card-status--${stage3Status}`}>
              {stage3Status === 'active' ? 'Ready' : stage3Status === 'locked' ? 'Locked' : 'Complete'}
            </span>
          </div>
          <div className="estimating-workspace-card-body">
            <p className="estimating-workspace-card-subtext">
              Your takeoff and awarded bids are ready to import. Review line items, set your markup, and send to the client.
            </p>
            {!stage3Unlocked ? (
              <div className="estimating-workspace-stage-locked">
                <span className="estimating-workspace-stage-locked-icon" aria-hidden>🔒</span>
                <p className="estimating-workspace-stage-locked-text">Complete takeoff or collect at least one bid to unlock.</p>
              </div>
            ) : (
              <div className="estimating-workspace-build-summary">
                <div className="estimating-workspace-build-summary-rows">
                  <div className="estimating-workspace-build-summary-row">
                    <span className="estimating-workspace-build-summary-label">From Takeoff:</span>
                    <span className="estimating-workspace-build-summary-val">{totalItems} material items</span>
                  </div>
                  <div className="estimating-workspace-build-summary-row">
                    <span className="estimating-workspace-build-summary-label">From Bid Sheet:</span>
                    <span className="estimating-workspace-build-summary-val">
                      {awardedBids.length} awarded bids totaling {formatCurrency(totalAwarded)}
                    </span>
                  </div>
                </div>
                <p className="estimating-workspace-build-note">
                  Unit prices from the takeoff will be blank for you to fill in.
                </p>
                <button
                  type="button"
                  className="estimating-workspace-build-cta"
                  onClick={onBuildEstimate}
                >
                  Build Estimate →
                </button>
                {onBuildBlankEstimate && (
                  <button
                    type="button"
                    className="estimating-workspace-build-blank"
                    onClick={onBuildBlankEstimate}
                  >
                    Or send a blank estimate →
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
