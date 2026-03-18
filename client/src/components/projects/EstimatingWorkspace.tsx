import { useState, useEffect, useCallback, type ReactNode } from 'react'
import type { Project, Subcontractor, BidSheet, SubBid, TradePackage, CustomProduct } from '@/types/global'
import type { MaterialList } from '@/types/global'
import { LaunchTakeoffWidget, type TakeoffPlanType } from '@/components/projects/LaunchTakeoffWidget'
import { dayjs } from '@/lib/date'
import { api } from '@/api/client'
import { estimatesApi } from '@/api/estimates'
import { USE_MOCK_ESTIMATES, MOCK_CUSTOM_PRODUCTS } from '@/data/mockEstimatesData'
import {
  AddProductFormFields,
  defaultProductFormValue,
  restoreProductFormFromGcLine,
  productFormValueToPayload,
  gcLineFromProductForm,
  customProductToProductFormValue,
  type ProductFormValue,
  type AddProductModalPayload,
} from '@/components/estimates/AddProductModal'

function formatCurrency(n: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n)
}

function formatBidMoney(n: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)
}

function gcScopeLibraryKey(name: string, unit: string) {
  return `${name.trim().toLowerCase().replace(/\s+/g, ' ')}|${(unit || 'ea').trim().toLowerCase()}`
}

/** Same payload as Products & Services — dedupe by name + unit. */
async function persistScopesToProductLibrary(
  payloads: AddProductModalPayload[],
  tradeTag: string
): Promise<number> {
  if (USE_MOCK_ESTIMATES) return 0
  let added = 0
  try {
    const existing = await estimatesApi.getCustomProducts()
    const seen = new Set(existing.map((p) => gcScopeLibraryKey(p.name, p.unit || 'ea')))
    for (const payload of payloads) {
      const name = payload.name.trim()
      if (!name) continue
      const unitPrice = payload.type === 'sub' ? (payload.billedPrice ?? payload.price) : payload.price
      if (unitPrice <= 0) continue
      const key = gcScopeLibraryKey(name, payload.unit)
      if (seen.has(key)) continue
      try {
        await estimatesApi.createCustomProduct({
          name,
          description: payload.description.trim() || undefined,
          unit: payload.unit,
          default_unit_price: unitPrice,
          item_type: payload.type,
          sub_cost: payload.subCost,
          markup_pct: payload.markupPct,
          billed_price: payload.billedPrice,
          trades: payload.trades.length ? payload.trades : tradeTag ? [tradeTag] : [],
          taxable: payload.taxable,
        })
        seen.add(key)
        added += 1
      } catch (err) {
        console.warn('Could not add product to library:', err)
      }
    }
  } catch (e) {
    console.warn('Product library sync failed:', e)
  }
  return added
}

function scopeRowLineTotal(row: { quantity: number; form: ProductFormValue }) {
  const gl = gcLineFromProductForm(row.form, row.quantity)
  return gl.quantity * gl.unit_price
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
  /** When true, every trade scope is resolved (awarded sub or GC self-priced) or user skipped/bypassed. Unlocks Build Estimate. */
  estimateStageReady?: boolean
  /** When true, GC chose to skip takeoff (small job / price manually); Stage 2 and 3 unlock without takeoff. */
  takeoffBypassed?: boolean
  /** Callback when GC clicks "Bypass takeoff". */
  onBypassTakeoff?: () => void
  /** When true, GC chose to skip bid sheet; Stage 3 unlocks without awarded bids. */
  bidSheetSkipped?: boolean
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
  /** Remove a declined sub bid row from the bid sheet. */
  onRemoveSubBid?: (subBidId: string) => Promise<void>
}

type StageStatus = 'locked' | 'active' | 'complete'

export function EstimatingWorkspace({
  project,
  takeoffs,
  subcontractors,
  onRefreshTakeoffs: _onRefreshTakeoffs,
  onRefreshSubcontractors,
  onBuildEstimate,
  estimateStageReady = false,
  takeoffBypassed = false,
  onBypassTakeoff,
  bidSheetSkipped = false,
  onViewFullTakeoff,
  onStartTakeoff,
  takeoffResult,
  takeoffError,
  takeoffInProgress,
  takeoffProgress,
  takeoffMessage,
  takeoffStartTime,
  bidSheet,
  onSetAwarded,
  onAddCustomTrade,
  onSkipBidSheet,
  onViewBidSheet,
  onRefreshBidSheet,
  lastBidSheetUpdated,
  onResendBid,
  onBuildBlankEstimate,
  onRemoveSubBid,
}: EstimatingWorkspaceProps) {
  const [stage1CategoriesOpen, setStage1CategoriesOpen] = useState(false)
  const [stage2AddSubExpanded, setStage2AddSubExpanded] = useState<string | null>(null)
  const [stage2AddSubForm, setStage2AddSubForm] = useState({ name: '', email: '' })
  const [stage2AddSubSaving, setStage2AddSubSaving] = useState(false)
  const [stage2CustomTradeName, setStage2CustomTradeName] = useState('')
  const [stage2CustomTradeAdding, setStage2CustomTradeAdding] = useState(false)
  const [resendingBidId, setResendingBidId] = useState<string | null>(null)
  const [, setCopyFeedback] = useState<string | null>(null)
  const [secondsSinceBidSheetUpdate, setSecondsSinceBidSheetUpdate] = useState(0)
  const [viewBidModal, setViewBidModal] = useState<SubBid | null>(null)
  const [removingBidId, setRemovingBidId] = useState<string | null>(null)
  const [awardingBidId, setAwardingBidId] = useState<string | null>(null)
  const [inviteToast, setInviteToast] = useState<string | null>(null)
  const [manualShareBanner, setManualShareBanner] = useState<{
    portalUrl: string
    variant: 'no_email' | 'email_failed'
  } | null>(null)
  const [manualShareCopied, setManualShareCopied] = useState(false)
  /** Trade tag whose invited subs list modal is open (from “N invited” pill). */
  const [invitedListTradeTag, setInvitedListTradeTag] = useState<string | null>(null)
  const [gcScopeModalTrade, setGcScopeModalTrade] = useState<string | null>(null)
  const [gcScopeRows, setGcScopeRows] = useState<{ id: string; quantity: number; form: ProductFormValue }[]>([])
  const [gcScopeSaving, setGcScopeSaving] = useState(false)
  const [gcScopeCatalog, setGcScopeCatalog] = useState<CustomProduct[]>([])
  const [gcScopeCatalogLoading, setGcScopeCatalogLoading] = useState(false)
  const [gcScopeLibPickEpoch, setGcScopeLibPickEpoch] = useState<Record<string, number>>({})

  function gcSelfPerformSaved(tp: TradePackage | undefined): boolean {
    return !!(
      tp?.gc_self_perform &&
      Array.isArray(tp.gc_estimate_lines) &&
      tp.gc_estimate_lines.length > 0 &&
      tp.gc_estimate_lines.some((l) => {
        const q = Number(l.quantity) || 0
        const p = Number(l.unit_price) || 0
        return q * p > 0 || p > 0
      })
    )
  }

  useEffect(() => {
    if (!inviteToast) return
    const t = setTimeout(() => setInviteToast(null), 5000)
    return () => clearTimeout(t)
  }, [inviteToast])

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
  const stage2Unlocked = hasTakeoff || takeoffBypassed
  const stage3Unlocked = stage2Unlocked && (estimateStageReady || bidSheetSkipped || takeoffBypassed)

  const stage1Status: StageStatus = hasTakeoff || takeoffBypassed ? 'complete' : 'active'
  const stage2Status: StageStatus = !stage2Unlocked ? 'locked' : estimateStageReady || bidSheetSkipped ? 'complete' : 'active'
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
  const tradeCount = Math.max(tradePackages.length, 1)
  const tradesWithAwarded = new Set(awardedBids.map((b) => b.trade_package_id))
  const awardedTradeCount = tradesWithAwarded.size
  const totalAwarded = awardedBids.reduce((s, b) => s + (b.amount ?? 0), 0)
  const subsById = new Map(subcontractors.map((s) => [s.id, s]))
  const packagesById = new Map(tradePackages.map((p) => [p.id, p]))
  const tradeNamesFromTakeoff = categories.map((c) => c.name)
  /** Union takeoff categories + any bid-sheet packages so scopes stay listed after first sub is added. */
  const pkgByTag = new Map(tradePackages.map((p) => [p.trade_tag, p]))
  const allTradeTags = [...new Set([...tradeNamesFromTakeoff, ...tradePackages.map((p) => p.trade_tag)])]
  const displayTradeList: TradePackage[] = allTradeTags.map((tag) =>
    pkgByTag.get(tag) ?? {
      id: `display-${tag}`,
      project_id: project?.id ?? '',
      trade_tag: tag,
      line_items: [],
    }
  )

  const bidsForInvitedModal =
    invitedListTradeTag == null
      ? []
      : subBids.filter((b) => packagesById.get(b.trade_package_id)?.trade_tag === invitedListTradeTag)

  useEffect(() => {
    if (invitedListTradeTag == null) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setInvitedListTradeTag(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [invitedListTradeTag])

  useEffect(() => {
    if (gcScopeModalTrade == null) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !gcScopeSaving) setGcScopeModalTrade(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [gcScopeModalTrade, gcScopeSaving])

  useEffect(() => {
    if (!gcScopeModalTrade) {
      setGcScopeCatalog([])
      return
    }
    setGcScopeLibPickEpoch({})
    let cancelled = false
    if (USE_MOCK_ESTIMATES) {
      setGcScopeCatalog([...MOCK_CUSTOM_PRODUCTS].sort((a, b) => a.name.localeCompare(b.name)))
      return
    }
    setGcScopeCatalogLoading(true)
    estimatesApi
      .getCustomProducts()
      .then((list) => {
        if (!cancelled) setGcScopeCatalog([...list].sort((a, b) => a.name.localeCompare(b.name)))
      })
      .catch(() => {
        if (!cancelled) setGcScopeCatalog([])
      })
      .finally(() => {
        if (!cancelled) setGcScopeCatalogLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [gcScopeModalTrade])

  const closeInvitedModal = useCallback(() => setInvitedListTradeTag(null), [])

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
                {onBypassTakeoff && (
                  <button type="button" className="estimating-workspace-skip-takeoff" onClick={onBypassTakeoff}>
                    Bypass takeoff — small job or I&apos;ll price manually →
                  </button>
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

        <div className={`estimating-workspace-card ${!stage2Unlocked ? 'estimating-workspace-card--locked' : ''}`}>
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
            {!stage2Unlocked ? (
              <div className="estimating-workspace-stage-locked">
                <span className="estimating-workspace-stage-locked-icon" aria-hidden>🔒</span>
                <p className="estimating-workspace-stage-locked-text">Complete takeoff or bypass it below to continue.</p>
              </div>
            ) : (
              <>
                <div className="estimating-workspace-bidsheet-empty">
                  {displayTradeList.length > 0 && (
                    <>
                      <p className="estimating-workspace-card-subtext" style={{ marginBottom: 14, maxWidth: 640 }}>
                        <strong>Add &amp; Dispatch</strong> invites subs per trade, or use <strong>I&apos;ll do this scope</strong> to price work you&apos;re keeping in-house.
                        Award a sub <em>or</em> save in-house lines for each trade to unlock <strong>Build Estimate</strong> (or skip bid collection below).
                      </p>
                      {manualShareBanner && (
                        <div className="ew-manual-invite-banner" role="status">
                          <p className="ew-manual-invite-banner__title">
                            {manualShareBanner.variant === 'no_email'
                              ? 'No email provided — share this link manually:'
                              : 'Invite email could not be sent — share this link manually:'}
                          </p>
                          <div className="ew-manual-invite-banner__url-row">
                            <code className="ew-manual-invite-banner__url">{manualShareBanner.portalUrl}</code>
                            <button
                              type="button"
                              className="btn btn-primary ew-manual-invite-copy"
                              onClick={async () => {
                                try {
                                  await navigator.clipboard.writeText(manualShareBanner.portalUrl)
                                  setManualShareCopied(true)
                                  setTimeout(() => setManualShareCopied(false), 2500)
                                } catch {
                                  // ignore
                                }
                              }}
                            >
                              {manualShareCopied ? 'Copied ✓' : 'Copy link'}
                            </button>
                          </div>
                          <button type="button" className="ew-manual-invite-dismiss" onClick={() => setManualShareBanner(null)}>
                            Dismiss
                          </button>
                        </div>
                      )}
                      <ul className="estimating-workspace-trade-rows">
                        {displayTradeList.map((pkg) => {
                          const bidsThisTrade = subBids.filter(
                            (b) => packagesById.get(b.trade_package_id)?.trade_tag === pkg.trade_tag
                          )
                          const subsThisTrade = bidsThisTrade.length
                          const previewNames = bidsThisTrade
                            .map((b) => subsById.get(b.subcontractor_id)?.name?.trim())
                            .filter((n): n is string => Boolean(n))
                          const invitedHoverTitle =
                            previewNames.length > 0
                              ? `${previewNames.slice(0, 5).join(' · ')}${
                                  previewNames.length > 5 ? ` · +${previewNames.length - 5} more` : ''
                                } — click for full list`
                              : 'Click to see invited subs'
                          const storedPkg = pkgByTag.get(pkg.trade_tag)
                          const selfPriced = gcSelfPerformSaved(storedPkg)
                          const openGcScopeModal = () => {
                            const tp = pkgByTag.get(pkg.trade_tag)
                            const tag = pkg.trade_tag
                            const rid = () => `gc-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
                            if (tp?.gc_self_perform && tp.gc_estimate_lines?.length) {
                              setGcScopeRows(
                                tp.gc_estimate_lines.map((l) => ({
                                  id: rid(),
                                  quantity: Number(l.quantity) || 1,
                                  form: restoreProductFormFromGcLine(
                                    {
                                      description: l.description ?? '',
                                      quantity: Number(l.quantity) || 1,
                                      unit: l.unit ?? 'ea',
                                      unit_price: Number(l.unit_price) || 0,
                                    },
                                    tag
                                  ),
                                }))
                              )
                            } else {
                              setGcScopeRows([
                                {
                                  id: rid(),
                                  quantity: 1,
                                  form: defaultProductFormValue(tag),
                                },
                              ])
                            }
                            setGcScopeModalTrade(tag)
                          }
                          return (
                            <li key={`${pkg.id}-${pkg.trade_tag}`} className="estimating-workspace-trade-row">
                              <span className="estimating-workspace-trade-name">{pkg.trade_tag}</span>
                              <div className="estimating-workspace-trade-actions">
                                {!selfPriced && stage2AddSubExpanded === pkg.trade_tag ? (
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
                                    <button
                                      type="button"
                                      className="btn btn-primary"
                                      disabled={stage2AddSubSaving || !stage2AddSubForm.name.trim() || !project?.id}
                                      onClick={async () => {
                                        const subName = stage2AddSubForm.name.trim()
                                        if (!subName || !project?.id) return
                                        const emailVal = stage2AddSubForm.email.trim()
                                        setStage2AddSubSaving(true)
                                        setManualShareBanner(null)
                                        setInviteToast(null)
                                        try {
                                          const result = await api.projects.createSubcontractorWithPortalInvite(project.id, {
                                            name: subName,
                                            trade: pkg.trade_tag,
                                            email: emailVal,
                                          })
                                          void api.contractors
                                            .create({
                                              name: subName,
                                              trade: pkg.trade_tag,
                                              email: emailVal || '',
                                              phone: '',
                                            })
                                            .catch(() => {})
                                          setStage2AddSubExpanded(null)
                                          setStage2AddSubForm({ name: '', email: '' })
                                          onRefreshSubcontractors()
                                          onRefreshBidSheet?.()
                                          if (emailVal && result.email_sent) {
                                            setInviteToast(`Invite sent to ${emailVal}`)
                                          } else {
                                            setManualShareBanner({
                                              portalUrl: result.portal_url,
                                              variant: emailVal ? 'email_failed' : 'no_email',
                                            })
                                          }
                                        } catch (err) {
                                          console.error(err)
                                          setInviteToast(
                                            err instanceof Error ? err.message : 'Could not create invite. Try again.'
                                          )
                                        } finally {
                                          setStage2AddSubSaving(false)
                                        }
                                      }}
                                    >
                                      {stage2AddSubSaving ? 'Dispatching…' : 'Add & Dispatch →'}
                                    </button>
                                    <button
                                      type="button"
                                      className="btn btn-ghost"
                                      onClick={() => {
                                        setStage2AddSubExpanded(null)
                                        setStage2AddSubForm({ name: '', email: '' })
                                      }}
                                    >
                                      Cancel
                                    </button>
                                    <p className="estimating-workspace-add-sub-helper">
                                      With an email, we send the secure bid link automatically. Leave email empty to get a copyable link for text or other channels.
                                    </p>
                                  </div>
                                ) : !selfPriced ? (
                                  <>
                                    <button
                                      type="button"
                                      className="estimating-workspace-add-sub-btn"
                                      onClick={() => setStage2AddSubExpanded(pkg.trade_tag)}
                                    >
                                      Add Sub →
                                    </button>
                                    <button
                                      type="button"
                                      className="estimating-workspace-gc-scope-btn"
                                      title="You’re performing this trade — add your pricing"
                                      onClick={openGcScopeModal}
                                    >
                                      I&apos;ll do this scope
                                    </button>
                                  </>
                                ) : null}
                              </div>
                              <div className="ew-trade-row-pills">
                                {selfPriced ? (
                                  <button
                                    type="button"
                                    className="estimating-workspace-trade-pill ew-gc-self-pill ew-gc-self-pill--clickable"
                                    title="In-house pricing saved — click to review or change"
                                    onClick={openGcScopeModal}
                                  >
                                    Your work ✓
                                  </button>
                                ) : null}
                                {subsThisTrade > 0 ? (
                                  <button
                                    type="button"
                                    className="estimating-workspace-trade-pill estimating-workspace-trade-pill--has estimating-workspace-trade-pill--invited-btn"
                                    onClick={() => setInvitedListTradeTag(pkg.trade_tag)}
                                    title={invitedHoverTitle}
                                    aria-label={`${subsThisTrade} invited to ${pkg.trade_tag}. Click to view list.`}
                                  >
                                    {subsThisTrade} invited
                                  </button>
                                ) : !selfPriced ? (
                                  <span className="estimating-workspace-trade-pill estimating-workspace-trade-pill--none">
                                    No subs yet
                                  </span>
                                ) : null}
                              </div>
                            </li>
                          )
                        })}
                      </ul>
                      {estimateStageReady && !bidSheetSkipped && (
                        <p className="estimating-workspace-ready-nudge estimating-workspace-ready-nudge--inline">
                          Every trade is covered — open <strong>Build &amp; Send Estimate</strong> when you&apos;re ready.
                        </p>
                      )}
                    </>
                  )}
                  {displayTradeList.length === 0 && !hasSubBids && (
                    <p className="estimating-workspace-card-subtext" style={{ marginBottom: 12 }}>
                      Run takeoff for trade categories, or add a custom trade below.
                    </p>
                  )}
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
                {hasSubBids && (
              <div className="estimating-workspace-bidsheet-table-wrap" style={{ marginTop: 24 }}>
                <h4 className="estimating-workspace-section-title" style={{ fontSize: 15, fontWeight: 700, margin: '0 0 10px', color: 'var(--text-primary)' }}>
                  Bids &amp; portal links
                </h4>
                <div className="estimating-workspace-bidsheet-summary">
                  {awardedTradeCount} of {tradeCount} trades awarded · Total awarded: {formatCurrency(totalAwarded)}
                </div>
                <table className="estimating-workspace-bidsheet-table estimating-workspace-bidsheet-table--roster">
                  <thead>
                    <tr>
                      <th>Trade</th>
                      <th>Company / Name</th>
                      <th>Email</th>
                      <th>Bid amount</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {subBids.map((bid) => {
                      const pkg = packagesById.get(bid.trade_package_id)
                      const sub = subsById.get(bid.subcontractor_id)
                      const status = getBidStatus(bid)
                      const sk = status.key
                      const portalUrl = bid.portal_token ? `${baseUrl}/bid/${bid.portal_token}` : ''

                      let bidAmountCell: ReactNode
                      if (sk === 'pending') {
                        bidAmountCell = (
                          <div className="ew-roster-bid-amt">
                            <span className="ew-roster-bid-amt-dash">—</span>
                            <em className="ew-roster-bid-amt-muted">Awaiting dispatch</em>
                          </div>
                        )
                      } else if (sk === 'viewed') {
                        bidAmountCell = (
                          <div className="ew-roster-bid-amt">
                            <span className="ew-roster-bid-amt-dash">—</span>
                            <em className="ew-roster-bid-amt-muted">Link opened…</em>
                          </div>
                        )
                      } else if (sk === 'bid_received') {
                        bidAmountCell = (
                          <span className="ew-roster-bid-amt-received">{formatCurrency(bid.amount ?? 0)}</span>
                        )
                      } else if (sk === 'awarded') {
                        bidAmountCell = (
                          <span className="ew-roster-bid-amt-awarded">
                            {formatCurrency(bid.amount ?? 0)} <span aria-hidden>✓</span>
                          </span>
                        )
                      } else {
                        bidAmountCell = <span className="ew-roster-bid-amt-declined">Declined</span>
                      }

                      let actionsCell: ReactNode
                      if (sk === 'pending') {
                        actionsCell = (
                          <div className="ew-roster-actions">
                            <button
                              type="button"
                              className="ew-roster-icon-btn"
                              title={portalUrl ? 'Copy link' : 'No link yet'}
                              disabled={!portalUrl}
                              aria-label="Copy link"
                              onClick={async () => {
                                if (!portalUrl) return
                                try {
                                  await navigator.clipboard.writeText(portalUrl)
                                  setCopyFeedback(bid.id)
                                  setTimeout(() => setCopyFeedback(null), 2000)
                                } catch {
                                  // ignore
                                }
                              }}
                            >
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                                <rect x="9" y="9" width="13" height="13" rx="2" />
                                <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                              </svg>
                            </button>
                            {onResendBid && (
                              <button
                                type="button"
                                className="ew-roster-link-btn"
                                disabled={resendingBidId === bid.id || !portalUrl}
                                onClick={async () => {
                                  setResendingBidId(bid.id)
                                  try {
                                    await onResendBid(bid.id)
                                  } finally {
                                    setResendingBidId(null)
                                  }
                                }}
                              >
                                {resendingBidId === bid.id ? 'Sending…' : 'Resend'}
                              </button>
                            )}
                          </div>
                        )
                      } else if (sk === 'viewed') {
                        actionsCell = (
                          <div className="ew-roster-actions">
                            <button
                              type="button"
                              className="ew-roster-icon-btn"
                              title="Copy link"
                              disabled={!portalUrl}
                              aria-label="Copy link"
                              onClick={async () => {
                                if (!portalUrl) return
                                try {
                                  await navigator.clipboard.writeText(portalUrl)
                                  setCopyFeedback(bid.id)
                                  setTimeout(() => setCopyFeedback(null), 2000)
                                } catch {
                                  // ignore
                                }
                              }}
                            >
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                                <rect x="9" y="9" width="13" height="13" rx="2" />
                                <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                              </svg>
                            </button>
                            {onResendBid && (
                              <button
                                type="button"
                                className="ew-roster-link-btn"
                                disabled={resendingBidId === bid.id || !portalUrl}
                                onClick={async () => {
                                  setResendingBidId(bid.id)
                                  try {
                                    await onResendBid(bid.id)
                                  } finally {
                                    setResendingBidId(null)
                                  }
                                }}
                              >
                                {resendingBidId === bid.id ? 'Sending…' : 'Resend'}
                              </button>
                            )}
                          </div>
                        )
                      } else if (sk === 'bid_received') {
                        actionsCell = (
                          <div className="ew-roster-actions ew-roster-actions--stack">
                            {onSetAwarded && (
                              <button
                                type="button"
                                className="ew-roster-award-btn"
                                disabled={awardingBidId === bid.id}
                                onClick={async () => {
                                  setAwardingBidId(bid.id)
                                  try {
                                    await onSetAwarded(bid.id, true)
                                  } finally {
                                    setAwardingBidId(null)
                                  }
                                }}
                              >
                                {awardingBidId === bid.id ? '…' : 'Award →'}
                              </button>
                            )}
                            <button type="button" className="ew-roster-link-btn" onClick={() => setViewBidModal(bid)}>
                              View bid
                            </button>
                          </div>
                        )
                      } else if (sk === 'awarded') {
                        actionsCell = <span className="ew-roster-awarded-badge">Awarded ✓</span>
                      } else {
                        actionsCell = onRemoveSubBid ? (
                          <button
                            type="button"
                            className="ew-roster-link-btn ew-roster-remove"
                            disabled={removingBidId === bid.id}
                            onClick={async () => {
                              setRemovingBidId(bid.id)
                              try {
                                await onRemoveSubBid(bid.id)
                              } finally {
                                setRemovingBidId(null)
                              }
                            }}
                          >
                            {removingBidId === bid.id ? 'Removing…' : 'Remove'}
                          </button>
                        ) : (
                          <span className="ew-roster-muted">—</span>
                        )
                      }

                      return (
                        <tr key={bid.id} className={bid.awarded ? 'estimating-workspace-bid-row--awarded' : ''}>
                          <td>{pkg?.trade_tag ?? '—'}</td>
                          <td>{sub?.name ?? '—'}</td>
                          <td className="ew-roster-email">{sub?.email?.trim() || '—'}</td>
                          <td>{bidAmountCell}</td>
                          <td>
                            <span className={`estimating-workspace-bid-status estimating-workspace-bid-status--${sk}`} title={status.subtitle}>
                              {status.label}
                            </span>
                          </td>
                          <td>{actionsCell}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
                {viewBidModal && (
                  <div
                    className="ew-view-bid-overlay"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="ew-view-bid-title"
                    onClick={() => setViewBidModal(null)}
                  >
                    <div className="ew-view-bid-modal ew-view-bid-modal--detail" onClick={(e) => e.stopPropagation()}>
                      <h3 id="ew-view-bid-title" className="ew-view-bid-title">
                        Bid details
                      </h3>
                      <p className="ew-view-bid-lead">Review everything before you award this trade.</p>

                      <div className="ew-view-bid-grid">
                        <div className="ew-view-bid-field">
                          <span className="ew-view-bid-label">Subcontractor</span>
                          <div className="ew-view-bid-value">
                            {subsById.get(viewBidModal.subcontractor_id)?.name ?? '—'}
                          </div>
                        </div>
                        <div className="ew-view-bid-field">
                          <span className="ew-view-bid-label">Trade</span>
                          <div className="ew-view-bid-value">
                            {packagesById.get(viewBidModal.trade_package_id)?.trade_tag ?? '—'}
                          </div>
                        </div>
                        <div className="ew-view-bid-field ew-view-bid-field--full">
                          <span className="ew-view-bid-label">Submitted bid amount</span>
                          <div className="ew-view-bid-amount">{formatBidMoney(viewBidModal.amount ?? 0)}</div>
                        </div>
                        <div className="ew-view-bid-field ew-view-bid-field--full">
                          <span className="ew-view-bid-label">Notes / qualifications</span>
                          <div className="ew-view-bid-notes">{viewBidModal.notes?.trim() || '—'}</div>
                        </div>
                        <div className="ew-view-bid-field ew-view-bid-field--full">
                          <span className="ew-view-bid-label">Availability</span>
                          <div className="ew-view-bid-notes ew-view-bid-notes--compact">
                            {viewBidModal.availability?.trim() || '—'}
                          </div>
                        </div>
                        <div className="ew-view-bid-field ew-view-bid-field--full">
                          <span className="ew-view-bid-label">Quote PDF</span>
                          {viewBidModal.quote_url ? (
                            <a
                              href={viewBidModal.quote_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              download
                              className="ew-view-bid-attach ew-view-bid-attach--pdf"
                            >
                              Download quote PDF
                            </a>
                          ) : (
                            <span className="ew-view-bid-muted">No file attached</span>
                          )}
                        </div>
                      </div>

                      <div className="ew-view-bid-actions ew-view-bid-actions--split">
                        <button type="button" className="btn btn-ghost" onClick={() => setViewBidModal(null)}>
                          Close
                        </button>
                        {onSetAwarded ? (
                          <button
                            type="button"
                            className="ew-view-bid-award-cta"
                            disabled={awardingBidId === viewBidModal.id}
                            onClick={async () => {
                              const bidId = viewBidModal.id
                              setAwardingBidId(bidId)
                              try {
                                await onSetAwarded(bidId, true)
                                setViewBidModal(null)
                              } finally {
                                setAwardingBidId(null)
                              }
                            }}
                          >
                            {awardingBidId === viewBidModal.id ? 'Awarding…' : 'Award this bid →'}
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </div>
                )}
                {onViewBidSheet && (
                  <button
                    type="button"
                    className="estimating-workspace-add-another-sub"
                    onClick={onViewBidSheet}
                  >
                    Add another sub
                  </button>
                )}
                {(estimateStageReady || awardedTradeCount > 0) && (
                  <div className="estimating-workspace-ready-nudge">
                    Ready to build your estimate →
                  </div>
                )}
              </div>
                )}
              {invitedListTradeTag != null && (
                <div
                  className="ew-view-bid-overlay ew-invited-subs-overlay"
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="ew-invited-subs-title"
                  onClick={closeInvitedModal}
                >
                  <div className="ew-view-bid-modal ew-invited-subs-modal" onClick={(e) => e.stopPropagation()}>
                    <h3 id="ew-invited-subs-title" className="ew-view-bid-title">
                      Invited — {invitedListTradeTag}
                    </h3>
                    <p className="ew-invited-subs-lead">
                      Everyone you invited to bid on this trade (portal link sent or shared manually).
                    </p>
                    {bidsForInvitedModal.length === 0 ? (
                      <p className="ew-invited-subs-empty">No subs listed for this trade.</p>
                    ) : (
                      <ul className="ew-invited-subs-list">
                        {bidsForInvitedModal.map((bid) => {
                          const sub = subsById.get(bid.subcontractor_id)
                          const st = getBidStatus(bid)
                          return (
                            <li key={bid.id} className="ew-invited-subs-row">
                              <div className="ew-invited-subs-row-main">
                                <span className="ew-invited-subs-name">{sub?.name?.trim() || '—'}</span>
                                <span className="ew-invited-subs-email">
                                  {sub?.email?.trim() ? sub.email.trim() : <em className="ew-invited-subs-no-email">No email</em>}
                                </span>
                              </div>
                              <span
                                className={`estimating-workspace-bid-status estimating-workspace-bid-status--${st.key}`}
                                title={st.subtitle}
                              >
                                {st.label}
                              </span>
                            </li>
                          )
                        })}
                      </ul>
                    )}
                    <div className="ew-view-bid-actions ew-invited-subs-actions">
                      <button type="button" className="btn btn-primary" onClick={closeInvitedModal}>
                        Close
                      </button>
                    </div>
                  </div>
                </div>
              )}
              {gcScopeModalTrade && project?.id && (
                <div
                  className="ew-view-bid-overlay ew-gc-scope-overlay"
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="ew-gc-scope-title"
                  onClick={() => {
                    if (!gcScopeSaving) setGcScopeModalTrade(null)
                  }}
                >
                  <div className="ew-view-bid-modal ew-gc-scope-modal" onClick={(e) => e.stopPropagation()}>
                    <h3 id="ew-gc-scope-title" className="ew-view-bid-title">
                      In-house pricing — {gcScopeModalTrade}
                    </h3>
                    <p className="ew-gc-scope-lead">
                      Use <strong>Load from library</strong> to pull a saved product/service, or fill the form like <strong>Add product</strong>. Each line has{' '}
                      <strong>Qty</strong> for this job. Saving syncs new definitions to Products &amp; Services when needed. This trade counts as resolved for
                      Build Estimate.
                    </p>
                    <div className="ew-gc-scope-forms">
                      {gcScopeRows.map((row, idx) => (
                        <div key={row.id} className="ew-gc-scope-form-card">
                          <div className="ew-gc-scope-form-card-head">
                            <span className="ew-gc-scope-line-label">Line {idx + 1}</span>
                            <div className="ew-gc-scope-form-card-meta">
                              <label className="ew-gc-scope-qty-label">
                                Qty
                                <input
                                  type="number"
                                  min={0.0001}
                                  step="any"
                                  className="estimate-wizard-input ew-gc-scope-qty-input"
                                  value={row.quantity}
                                  disabled={gcScopeSaving}
                                  onChange={(e) => {
                                    const q = Math.max(0.0001, Number(e.target.value) || 0) || 1
                                    setGcScopeRows((rows) =>
                                      rows.map((r) => (r.id === row.id ? { ...r, quantity: q } : r))
                                    )
                                  }}
                                />
                              </label>
                              <span className="ew-gc-scope-line-subtotal">
                                Line: {formatCurrency(scopeRowLineTotal(row))}
                              </span>
                              <button
                                type="button"
                                className="ew-gc-scope-remove-line"
                                disabled={gcScopeRows.length <= 1 || gcScopeSaving}
                                onClick={() =>
                                  setGcScopeRows((rows) => rows.filter((r) => r.id !== row.id))
                                }
                                aria-label="Remove line"
                              >
                                ×
                              </button>
                            </div>
                          </div>
                          <div className="ew-gc-scope-library-row">
                            <label className="ew-gc-scope-library-label" htmlFor={`gc-lib-${row.id}`}>
                              Load from library
                            </label>
                            <select
                              id={`gc-lib-${row.id}`}
                              key={`gc-lib-${row.id}-${gcScopeLibPickEpoch[row.id] ?? 0}`}
                              className="ew-gc-scope-library-pick ew-gc-scope-library-pick--wide"
                              defaultValue=""
                              disabled={gcScopeSaving || gcScopeCatalogLoading}
                              aria-label="Load line from Products and Services library"
                              onChange={(e) => {
                                const id = e.target.value
                                if (!id) return
                                const prod = gcScopeCatalog.find((x) => String(x.id) === id)
                                if (prod) {
                                  setGcScopeRows((rows) =>
                                    rows.map((r) =>
                                      r.id === row.id
                                        ? {
                                            ...r,
                                            form: customProductToProductFormValue(prod, gcScopeModalTrade),
                                          }
                                        : r
                                    )
                                  )
                                  setGcScopeLibPickEpoch((prev) => ({
                                    ...prev,
                                    [row.id]: (prev[row.id] ?? 0) + 1,
                                  }))
                                }
                              }}
                            >
                              <option value="">
                                {gcScopeCatalogLoading
                                  ? 'Loading library…'
                                  : gcScopeCatalog.length
                                    ? 'Choose a saved product…'
                                    : 'No saved products yet'}
                              </option>
                              {gcScopeCatalog.map((p) => (
                                <option key={p.id} value={String(p.id)}>
                                  {p.name} (${Number(p.default_unit_price).toFixed(2)}/{p.unit})
                                </option>
                              ))}
                            </select>
                          </div>
                          <AddProductFormFields
                            value={row.form}
                            scopeTradeTag={gcScopeModalTrade}
                            compact
                            onChange={(patch) =>
                              setGcScopeRows((rows) =>
                                rows.map((r) =>
                                  r.id === row.id ? { ...r, form: { ...r.form, ...patch } } : r
                                )
                              )
                            }
                          />
                        </div>
                      ))}
                    </div>
                    <button
                      type="button"
                      className="btn btn-ghost ew-gc-scope-add-line"
                      disabled={gcScopeSaving || !gcScopeModalTrade}
                      onClick={() =>
                        setGcScopeRows((rows) => [
                          ...rows,
                          {
                            id: `gc-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
                            quantity: 1,
                            form: defaultProductFormValue(gcScopeModalTrade),
                          },
                        ])
                      }
                    >
                      + Add line item
                    </button>
                    <div className="ew-gc-scope-total-bar">
                      <strong>Scope total:</strong>{' '}
                      {formatCurrency(gcScopeRows.reduce((s, r) => s + scopeRowLineTotal(r), 0))}
                    </div>
                    <div className="ew-view-bid-actions ew-gc-scope-actions">
                      <button
                        type="button"
                        className="btn btn-ghost"
                        disabled={gcScopeSaving}
                        onClick={() => setGcScopeModalTrade(null)}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost ew-gc-scope-clear-btn"
                        disabled={gcScopeSaving || !gcSelfPerformSaved(pkgByTag.get(gcScopeModalTrade))}
                        onClick={async () => {
                          if (!project?.id || !gcScopeModalTrade) return
                          setGcScopeSaving(true)
                          try {
                            await api.projects.setGcSelfPerform(project.id, {
                              trade_tag: gcScopeModalTrade,
                              gc_self_perform: false,
                              estimate_lines: [],
                            })
                            onRefreshBidSheet?.()
                            setGcScopeModalTrade(null)
                          } catch (e) {
                            console.error(e)
                            setInviteToast(e instanceof Error ? e.message : 'Could not clear')
                          } finally {
                            setGcScopeSaving(false)
                          }
                        }}
                      >
                        Use subs instead
                      </button>
                      <button
                        type="button"
                        className="btn btn-primary"
                        disabled={gcScopeSaving}
                        onClick={async () => {
                          if (!project?.id || !gcScopeModalTrade) return
                          if (gcScopeRows.some((r) => !r.form.name.trim())) {
                            setInviteToast('Enter a name on each line (same as when adding a product).')
                            return
                          }
                          const hasValue = gcScopeRows.some((r) => {
                            const gl = gcLineFromProductForm(r.form, r.quantity)
                            return gl.quantity * gl.unit_price > 0 || gl.unit_price > 0
                          })
                          if (!hasValue) {
                            setInviteToast('Enter at least one unit price (and quantity) for this scope.')
                            return
                          }
                          setGcScopeSaving(true)
                          try {
                            const estimateLines = gcScopeRows.map((r) =>
                              gcLineFromProductForm(r.form, r.quantity)
                            )
                            const payloads = gcScopeRows.map((r) => productFormValueToPayload(r.form))
                            const tradeSaved = gcScopeModalTrade
                            await api.projects.setGcSelfPerform(project.id, {
                              trade_tag: tradeSaved,
                              gc_self_perform: true,
                              estimate_lines: estimateLines,
                            })
                            const libraryAdded = await persistScopesToProductLibrary(payloads, tradeSaved)
                            onRefreshBidSheet?.()
                            setGcScopeModalTrade(null)
                            setInviteToast(
                              libraryAdded > 0
                                ? `Saved in-house pricing for ${tradeSaved} · ${libraryAdded} new ${libraryAdded === 1 ? 'item' : 'items'} added to Products & Services`
                                : `Saved in-house pricing for ${tradeSaved}`
                            )
                          } catch (e) {
                            console.error(e)
                            setInviteToast(e instanceof Error ? e.message : 'Could not save')
                          } finally {
                            setGcScopeSaving(false)
                          }
                        }}
                      >
                        {gcScopeSaving ? 'Saving…' : 'Save & mark your work'}
                      </button>
                    </div>
                  </div>
                </div>
              )}
              </>
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
                <p className="estimating-workspace-stage-locked-text">
                  For each trade: award a sub, use <strong>I&apos;ll do this scope</strong> to price in-house, bypass takeoff, or skip bid collection.
                </p>
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
      {inviteToast && (
        <div
          role="status"
          className={`ew-invite-toast ${inviteToast.startsWith('Invite sent to') ? 'ew-invite-toast--success' : 'ew-invite-toast--error'}`}
        >
          {inviteToast}
        </div>
      )}
    </div>
  )
}
