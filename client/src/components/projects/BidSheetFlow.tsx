import { useState, useEffect, useMemo } from 'react'
import { api } from '@/api/client'
import type { BidSheet, TradePackage, Subcontractor, TakeoffItem } from '@/types/global'
import { ProposalViewStage } from './bid-sheet/ProposalViewStage'

export const TRADE_COLORS: Record<string, { bg: string; accent: string; light: string }> = {
  Framing: { bg: '#FFF7ED', accent: '#f59e0b', light: '#FED7AA' },
  Electrical: { bg: '#EFF6FF', accent: '#6366f1', light: '#BFDBFE' },
  Plumbing: { bg: '#F0FDF4', accent: '#0ea5e9', light: '#BBF7D0' },
  Concrete: { bg: '#F5F3FF', accent: '#7C3AED', light: '#DDD6FE' },
  Roofing: { bg: '#FFF1F2', accent: '#E11D48', light: '#FECDD3' },
  HVAC: { bg: '#ECFEFF', accent: '#0891B2', light: '#A5F3FC' },
  Drywall: { bg: '#FEFCE8', accent: '#CA8A04', light: '#FEF08A' },
  TBD: { bg: '#F9FAFB', accent: '#374151', light: '#E5E7EB' },
}

const PIPELINE_STEPS = [
  { key: 'takeoff', label: 'Takeoff', icon: '📐' },
  { key: 'packages', label: 'Trade Packages', icon: '📦' },
  { key: 'sent', label: 'Bids Sent', icon: '📤' },
  { key: 'received', label: 'Bids Received', icon: '📥' },
  { key: 'awarded', label: 'Awarded', icon: '✅' },
] as const

const STATUS_CONFIG: Record<string, { bg: string; text: string; border: string }> = {
  Awarded: { bg: '#f0fdf4', text: '#15803d', border: '#bbf7d0' },
  Received: { bg: '#eff6ff', text: '#1d4ed8', border: '#bfdbfe' },
  Sent: { bg: '#fffbeb', text: '#a16207', border: '#fde68a' },
  Pending: { bg: '#f3f4f6', text: '#374151', border: '#e5e7eb' },
}

const SUB_TABS = [
  { key: 'packages', label: 'Trade Packages' },
  { key: 'collection', label: 'Bid Collection' },
  { key: 'compare', label: 'Bid Compare' },
  { key: 'summary', label: 'GC Summary' },
  { key: 'proposal', label: 'Homeowner Proposal' },
] as const

function fmt(n: number | null | undefined): string {
  return n != null ? '$' + n.toLocaleString() : '—'
}

function groupTakeoffByTrade(categories: { name: string; items: TakeoffItem[] }[]): TradePackage[] {
  const byTrade = new Map<string, TakeoffItem[]>()
  for (const cat of categories) {
    for (const item of cat.items || []) {
      const tag = item.trade_tag || 'TBD'
      if (!byTrade.has(tag)) byTrade.set(tag, [])
      byTrade.get(tag)!.push(item)
    }
  }
  return Array.from(byTrade.entries()).map(([trade_tag, line_items]) => ({
    id: '',
    project_id: '',
    trade_tag,
    line_items,
  }))
}

export interface BidSheetFlowProps {
  projectId: string
  project?: { name?: string; address_line_1?: string; city?: string; state?: string; postal_code?: string; assigned_to_name?: string }
  takeoffCategories?: { name: string; items: TakeoffItem[] }[]
  subcontractors: Subcontractor[]
  onAddSub?: (row: { name: string; trade: string; email: string; phone: string }) => Promise<void>
  onDeleteSub?: (id: string) => Promise<void>
  onBulkSend?: (subIds: string[]) => void
  initialBidSheet?: BidSheet
}

type SubTabKey = (typeof SUB_TABS)[number]['key']
type PipelineKey = (typeof PIPELINE_STEPS)[number]['key']

export function BidSheetFlow({
  projectId,
  project,
  takeoffCategories = [],
  subcontractors,
  onAddSub,
  onDeleteSub: _onDeleteSub,
  onBulkSend,
  initialBidSheet,
}: BidSheetFlowProps) {
  const [bidSheet, setBidSheet] = useState<BidSheet | null>(initialBidSheet ?? null)
  const [loading, setLoading] = useState(!initialBidSheet)
  const [saving, setSaving] = useState(false)
  const [activePipelineStep, setActivePipelineStep] = useState<PipelineKey>('packages')
  const [activeSubTab, setActiveSubTab] = useState<SubTabKey>('packages')
  const [activeTrade, setActiveTrade] = useState<string | null>(null)
  const [addSubOpen, setAddSubOpen] = useState(false)
  const [newSub, setNewSub] = useState({ name: '', trade: 'Framing', email: '', phone: '' })
  const [expandedSub, setExpandedSub] = useState<string | null>(null)
  const [selectedSubs, setSelectedSubs] = useState<Set<string>>(new Set())

  const tradePackages = bidSheet?.trade_packages ?? []
  const subBids = bidSheet?.sub_bids ?? []
  const subsById = useMemo(() => Object.fromEntries(subcontractors.map((s) => [s.id, s])), [subcontractors])

  const allSubs = useMemo(() => {
    return subcontractors.map((s) => {
      const bids = subBids.filter((b) => b.subcontractor_id === s.id)
      const awardedBid = bids.find((b) => b.awarded)
      const anyBid = bids[0]
      const status = awardedBid ? 'Awarded' : anyBid ? 'Received' : 'Pending'
      const bid = awardedBid?.amount ?? anyBid?.amount ?? null
      const c = TRADE_COLORS[s.trade] || TRADE_COLORS.TBD
      return {
        ...s,
        trade: s.trade,
        tradeColor: c.accent,
        tradeId: anyBid?.trade_package_id ?? null,
        status,
        bid,
        subBidId: awardedBid?.id ?? anyBid?.id ?? null,
      }
    })
  }, [subcontractors, subBids])

  const awardedTotal = useMemo(() => subBids.filter((b) => b.awarded).reduce((s, b) => s + (b.amount || 0), 0), [subBids])

  const pipelineCounts = useMemo(() => {
    const takeoff = takeoffCategories?.length ?? 0
    const packages = tradePackages.length
    const sent = subcontractors.length
    const received = subBids.length
    const awarded = subBids.filter((b) => b.awarded).length
    return { takeoff: takeoff || 1, packages, sent, received, awarded }
  }, [takeoffCategories?.length, tradePackages.length, subcontractors.length, subBids])

  useEffect(() => {
    if (initialBidSheet) {
      setBidSheet(initialBidSheet)
      setLoading(false)
      return
    }
    setLoading(true)
    api.projects
      .getBidSheet(projectId)
      .then(setBidSheet)
      .catch(() =>
        setBidSheet({
          project_id: projectId,
          trade_packages: [],
          sub_bids: [],
          cost_buckets: { awarded_bids: 0, self_supplied_materials: 0, own_labor: 0, overhead_margin: 0 },
          proposal_lines: [],
        })
      )
      .finally(() => setLoading(false))
  }, [projectId, initialBidSheet])

  useEffect(() => {
    if (tradePackages.length > 0 && !activeTrade) setActiveTrade(tradePackages[0].trade_tag)
  }, [tradePackages, activeTrade])

  const saveBidSheet = async (updates: Partial<BidSheet>) => {
    if (!bidSheet) return
    setSaving(true)
    try {
      const next = await api.projects.updateBidSheet(projectId, { ...bidSheet, ...updates })
      setBidSheet(next)
    } finally {
      setSaving(false)
    }
  }

  const generateTradePackages = () => {
    const packages = groupTakeoffByTrade(takeoffCategories)
    if (packages.length === 0) return
    saveBidSheet({
      ...bidSheet!,
      trade_packages: packages.map((p) => ({ ...p, id: p.id || `pkg-${Date.now()}-${Math.random().toString(36).slice(2)}`, project_id: projectId })),
    })
  }

  const setAwarded = async (subBidId: string, awarded: boolean) => {
    const target = subBids.find((x) => x.id === subBidId)
    const bidsCorrected = subBids.map((b) => {
      if (b.id === subBidId) return { ...b, awarded }
      if (awarded && target && b.trade_package_id === target.trade_package_id) return { ...b, awarded: false }
      return b
    })
    await saveBidSheet({ ...bidSheet!, sub_bids: bidsCorrected })
  }

  const handleAddSub = async () => {
    if (!newSub.name.trim() || !onAddSub) return
    await onAddSub(newSub)
    setNewSub({ name: '', trade: 'Framing', email: '', phone: '' })
    setAddSubOpen(false)
  }

  const toggleSub = (id: string) => {
    setSelectedSubs((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const selectAllSubs = () => {
    if (selectedSubs.size === subcontractors.length) setSelectedSubs(new Set())
    else setSelectedSubs(new Set(subcontractors.map((s) => s.id)))
  }

  const trade = activeTrade ? tradePackages.find((p) => p.trade_tag === activeTrade) : null
  const colors = (t: string) => TRADE_COLORS[t] || TRADE_COLORS.TBD

  if (loading || !bidSheet) {
    return (
      <div className="bidsheet-tab">
        <p className="text-sm text-muted">Loading bid sheet…</p>
      </div>
    )
  }

  return (
    <div className="bidsheet-tab">
      {/* Pipeline Banner */}
      <div className="bidsheet-pipeline">
        <div className="bidsheet-pipeline-title">
          <span>Bid Pipeline</span>
          <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 400 }}>
            Awarded total: <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 700, color: 'var(--green, #16a34a)' }}>{fmt(awardedTotal)}</span>
          </span>
        </div>
        <div className="bidsheet-pipeline-steps">
          {PIPELINE_STEPS.map((step, i) => {
            const active = activePipelineStep === step.key
            const past = PIPELINE_STEPS.findIndex((s) => s.key === activePipelineStep) > i
            const count = pipelineCounts[step.key as keyof typeof pipelineCounts] ?? 0
            return (
              <div key={step.key} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                <button
                  type="button"
                  onClick={() => {
                    setActivePipelineStep(step.key)
                    if (step.key === 'packages') setActiveSubTab('packages')
                    else if (step.key === 'sent' || step.key === 'received' || step.key === 'awarded') setActiveSubTab('collection')
                  }}
                  className={`bidsheet-pipeline-step ${active ? 'active' : ''} ${past ? 'past' : ''}`}
                >
                  <div className="step-icon">{step.icon}</div>
                  <div className="step-label" style={{ color: active ? '#fff' : past ? '#15803d' : 'var(--text-secondary)' }}>{step.label}</div>
                  <span
                    className="step-count"
                    style={{
                      background: active ? 'rgba(255,255,255,0.15)' : past ? '#dcfce7' : 'var(--bg-base)',
                      color: active ? '#fff' : past ? '#16a34a' : 'var(--text-muted)',
                    }}
                  >
                    {count}
                  </span>
                </button>
                {i < PIPELINE_STEPS.length - 1 && (
                  <div className="bidsheet-pipeline-connector" style={{ background: past ? '#16a34a' : 'var(--border)' }}>
                    <svg style={{ position: 'absolute', right: -5, top: '50%', transform: 'translateY(-50%)' }} width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={past ? '#16a34a' : 'var(--border)'} strokeWidth="2.5">
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Body: Sidebar + Main */}
      <div className="bidsheet-body">
        {/* Left: Subcontractors */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="bidsheet-sidebar-card">
            <div className="bidsheet-sidebar-head">
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>Subcontractors</span>
              <span style={{ fontSize: 11, background: 'var(--bg-base)', color: 'var(--text-muted)', padding: '2px 7px', borderRadius: 8, fontWeight: 600 }}>{allSubs.length}</span>
            </div>
            {allSubs.map((s) => {
              const cfg = STATUS_CONFIG[s.status]
              return (
                <div
                  key={s.id}
                  className="bidsheet-sidebar-sub-row"
                  style={{ background: expandedSub === s.id ? 'var(--bg-base)' : 'transparent' }}
                  onClick={() => setExpandedSub(expandedSub === s.id ? null : s.id)}
                  onMouseEnter={(e) => { if (expandedSub !== s.id) e.currentTarget.style.background = 'var(--bg-hover, #fafafa)' }}
                  onMouseLeave={(e) => { if (expandedSub !== s.id) e.currentTarget.style.background = 'transparent' }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.3 }}>{s.name}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 4 }}>
                        <span style={{ fontSize: 10, background: s.tradeColor + '20', color: s.tradeColor, padding: '1px 6px', borderRadius: 5, fontWeight: 600 }}>{s.trade}</span>
                      </div>
                    </div>
                    <span style={{ fontSize: 10, background: cfg.bg, color: cfg.text, border: `1px solid ${cfg.border}`, padding: '2px 7px', borderRadius: 10, fontWeight: 600, whiteSpace: 'nowrap' }}>{s.status}</span>
                  </div>
                  {s.bid != null && <div style={{ fontSize: 12, fontVariantNumeric: 'tabular-nums', fontWeight: 700, color: 'var(--text-primary)', marginTop: 5 }}>{fmt(s.bid)}</div>}
                </div>
              )
            })}
          </div>
          <button type="button" className="bidsheet-add-sub-btn" onClick={() => setAddSubOpen(true)} disabled={!onAddSub}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
            Add Sub
          </button>
          {addSubOpen && (
            <div style={{ background: 'var(--bg-surface)', borderRadius: 12, border: '1.5px solid var(--border)', padding: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12 }}>New Subcontractor</div>
              {[['name', 'Name', 'text'], ['email', 'Email', 'email'], ['phone', 'Phone', 'text']].map(([key, placeholder, type]) => (
                <input
                  key={key}
                  type={type}
                  placeholder={placeholder}
                  value={newSub[key as keyof typeof newSub]}
                  onChange={(e) => setNewSub({ ...newSub, [key]: e.target.value })}
                  className="w-full rounded-md border border-[var(--border)] px-2.5 py-1.5 text-[12px] outline-none mb-2"
                />
              ))}
              <select
                value={newSub.trade}
                onChange={(e) => setNewSub({ ...newSub, trade: e.target.value })}
                className="w-full rounded-md border border-[var(--border)] px-2.5 py-1.5 text-[12px] outline-none mb-3"
              >
                {Object.keys(TRADE_COLORS).filter((t) => t !== 'TBD').map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" onClick={handleAddSub} className="flex-1 py-2 rounded-lg bg-[var(--text-primary)] text-white text-[12px] font-semibold border-none cursor-pointer">Add</button>
                <button type="button" onClick={() => setAddSubOpen(false)} className="py-2 px-3 rounded-lg bg-[var(--bg-base)] text-[var(--text-muted)] text-[12px] border-none cursor-pointer">Cancel</button>
              </div>
            </div>
          )}
        </div>

        {/* Right: Sub-tabs + Content */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="bidsheet-subtabs">
            {SUB_TABS.map(({ key, label }) => (
              <button key={key} type="button" onClick={() => setActiveSubTab(key)} className={`bidsheet-subtab ${activeSubTab === key ? 'active' : ''}`}>{label}</button>
            ))}
          </div>

          {activeSubTab === 'packages' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="bidsheet-info-bar">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
                Auto-generated from takeoff. Each sub sees only their scope — no pricing visible.
                <button type="button" onClick={generateTradePackages} disabled={saving} className="ml-auto text-[11px] py-1 px-2.5 rounded-md bg-[var(--bg-surface)] border border-[var(--border)] cursor-pointer text-[var(--text-secondary)] font-medium whitespace-nowrap">Re-generate from Takeoff</button>
              </div>
              <div className="bidsheet-trade-btns">
                {tradePackages.map((pkg) => {
                  const c = colors(pkg.trade_tag)
                  const isActive = activeTrade === pkg.trade_tag
                  return (
                    <button
                      key={pkg.id}
                      type="button"
                      onClick={() => setActiveTrade(pkg.trade_tag)}
                      className={`bidsheet-trade-btn ${isActive ? 'active' : ''}`}
                      style={{ ['--trade-color' as string]: c.accent, borderColor: isActive ? c.accent : undefined, background: isActive ? c.accent + '20' : undefined, color: isActive ? c.accent : undefined }}
                    >
                      {pkg.trade_tag}
                      <span style={{ marginLeft: 6, fontSize: 10, opacity: 0.7 }}>{(pkg.line_items || []).length} items</span>
                    </button>
                  )
                })}
              </div>
              {trade && (
                <div className="bidsheet-pkg-scope-card" style={{ borderColor: colors(trade.trade_tag).accent + '40' }}>
                  <div className="bidsheet-pkg-scope-head" style={{ background: colors(trade.trade_tag).accent + '08', borderColor: colors(trade.trade_tag).accent + '20' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ width: 10, height: 10, borderRadius: '50%', background: colors(trade.trade_tag).accent }} />
                        <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>{trade.trade_tag} Scope Package</span>
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Scope for subs — no pricing shown</div>
                    </div>
                    <button type="button" style={{ padding: '8px 16px', background: colors(trade.trade_tag).accent, color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Send to Subs →</button>
                  </div>
                  <div style={{ padding: '0 20px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px 100px 80px', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                      {['Description', 'Notes', 'Qty', 'Unit'].map((h) => <span key={h} style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.4 }}>{h}</span>)}
                    </div>
                    {(trade.line_items || []).map((item: TakeoffItem, i: number) => (
                      <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 120px 100px 80px', padding: '12px 0', borderBottom: i < (trade.line_items?.length ?? 0) - 1 ? '1px solid var(--border)' : 'none', alignItems: 'center' }}>
                        <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{item.description}</span>
                        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>—</span>
                        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>{Number(item.quantity).toLocaleString()}</span>
                        <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{item.unit}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {tradePackages.length === 0 && <p className="text-sm text-muted">No trade packages yet. Run takeoff and Re-generate from Takeoff.</p>}
            </div>
          )}

          {activeSubTab === 'collection' && (
            <div className="bidsheet-compare-card">
              <div className="bidsheet-collection-header">
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>Bid Collection</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 1 }}>Track sent & received bids across all trades</div>
                </div>
                <button type="button" onClick={() => onBulkSend?.(Array.from(selectedSubs))} disabled={selectedSubs.size === 0} className="py-1.5 px-3.5 rounded-lg bg-[var(--red)] text-white text-[12px] font-semibold border-none cursor-pointer">Bulk Send</button>
              </div>
              <div className="bidsheet-collection-table">
                {['Subcontractor', 'Trade', 'Phone', 'Email', 'Status'].map((h) => <span key={h}>{h}</span>)}
              </div>
              <button type="button" onClick={selectAllSubs} className="bidsheet-collection-row text-left text-[12px] text-[var(--text-muted)] hover:text-[var(--text-primary)]">
                {selectedSubs.size === allSubs.length ? 'Deselect all' : 'Select all'}
              </button>
              {allSubs.map((s) => {
                const cfg = STATUS_CONFIG[s.status]
                const checked = selectedSubs.has(s.id)
                return (
                  <div key={s.id} role="button" tabIndex={0} onClick={() => toggleSub(s.id)} onKeyDown={(e) => e.key === 'Enter' && toggleSub(s.id)} className={`bidsheet-collection-row ${checked ? 'selected' : ''}`} style={{ cursor: 'pointer' }}>
                    <div style={{ minWidth: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <input type="checkbox" checked={checked} readOnly style={{ pointerEvents: 'none' }} />
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{s.name}</div>
                        {s.bid != null && <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums', marginTop: 1 }}>{fmt(s.bid)}</div>}
                      </div>
                    </div>
                    <span style={{ fontSize: 11, background: s.tradeColor + '20', color: s.tradeColor, padding: '2px 8px', borderRadius: 6, fontWeight: 600, width: 'fit-content' }}>{s.trade}</span>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{s.phone || '—'}</span>
                    <span className="bidsheet-collection-email" style={{ fontSize: 12, color: 'var(--text-muted)' }} title={s.email || undefined}>{s.email || '—'}</span>
                    <span className="bidsheet-collection-status" style={{ fontSize: 11, background: cfg.bg, color: cfg.text, border: `1px solid ${cfg.border}`, padding: '3px 8px', borderRadius: 20, fontWeight: 600, whiteSpace: 'nowrap' }}>{s.status}</span>
                  </div>
                )
              })}
            </div>
          )}

          {activeSubTab === 'compare' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {tradePackages.filter((pkg) => subBids.some((b) => b.trade_package_id === pkg.id)).map((pkg) => {
                const bids = subBids.filter((b) => b.trade_package_id === pkg.id).map((b) => ({ ...b, subName: subsById[b.subcontractor_id]?.name ?? b.subcontractor_id }))
                if (bids.length === 0) return null
                const sorted = [...bids].sort((a, b) => a.amount - b.amount)
                const lowest = sorted[0].amount
                const c = colors(pkg.trade_tag)
                return (
                  <div key={pkg.id} className="bidsheet-compare-card">
                    <div className="bidsheet-compare-head">
                      <span style={{ width: 10, height: 10, borderRadius: '50%', background: c.accent }} />
                      <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{pkg.trade_tag}</span>
                      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{bids.length} bids received</span>
                    </div>
                    <div>
                      {sorted.map((bid, i) => {
                        const cfg = STATUS_CONFIG[bid.awarded ? 'Awarded' : 'Received']
                        const isLowest = bid.amount === lowest
                        const diff = bid.amount - lowest
                        return (
                          <div key={bid.id} className="bidsheet-compare-row" style={{ background: isLowest ? '#f0fdf4' : 'transparent' }}>
                            <div style={{ width: 24, height: 24, borderRadius: '50%', background: isLowest ? '#16a34a' : 'var(--bg-base)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                              <span style={{ fontSize: 11, fontWeight: 700, color: isLowest ? '#fff' : 'var(--text-muted)' }}>{i + 1}</span>
                            </div>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{bid.subName}</div>
                              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{subsById[bid.subcontractor_id]?.email ?? '—'}</div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                              <div style={{ fontSize: 18, fontWeight: 700, color: isLowest ? '#16a34a' : 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>{fmt(bid.amount)}</div>
                              {!isLowest && <div style={{ fontSize: 11, color: 'var(--red)', fontWeight: 600 }}>+{fmt(diff)} vs lowest</div>}
                              {isLowest && <div style={{ fontSize: 11, color: '#16a34a', fontWeight: 600 }}>Lowest bid</div>}
                            </div>
                            <div style={{ width: 100 }}>
                              <div style={{ height: 6, background: 'var(--bg-base)', borderRadius: 3, overflow: 'hidden' }}>
                                <div style={{ height: '100%', width: `${(lowest / bid.amount) * 100}%`, background: isLowest ? '#16a34a' : '#f59e0b', borderRadius: 3 }} />
                              </div>
                            </div>
                            <span style={{ fontSize: 11, background: cfg.bg, color: cfg.text, border: `1px solid ${cfg.border}`, padding: '3px 9px', borderRadius: 20, fontWeight: 600 }}>{bid.awarded ? 'Awarded' : 'Received'}</span>
                            {!bid.awarded && (
                              <button type="button" onClick={() => setAwarded(bid.id, true)} className="py-1.5 px-3 rounded-md bg-[var(--text-primary)] text-white text-[11px] font-semibold border-none cursor-pointer whitespace-nowrap">Award</button>
                            )}
                            {bid.awarded && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#16a34a' }}>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>
                                <span style={{ fontSize: 11, fontWeight: 700 }}>Awarded</span>
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                    {bids.length > 1 && (
                      <div style={{ padding: '10px 20px', background: '#f0fdf4', borderTop: '1px solid #dcfce7', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 12, color: '#15803d' }}>Potential savings vs highest bid</span>
                        <span style={{ fontSize: 13, fontWeight: 700, color: '#16a34a', fontVariantNumeric: 'tabular-nums' }}>{fmt(Math.max(...bids.map((b) => b.amount)) - lowest)}</span>
                      </div>
                    )}
                  </div>
                )
              })}
              {tradePackages.every((pkg) => !subBids.some((b) => b.trade_package_id === pkg.id)) && <p className="text-sm text-muted">No bids received yet. Add bids in Bid Collection.</p>}
            </div>
          )}

          {activeSubTab === 'summary' && (
            <div className="bidsheet-gc-summary-card">
              <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>GC Summary</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 1 }}>Awarded subcontractor breakdown for internal review</div>
              </div>
              <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
                {tradePackages.map((pkg) => {
                  const awarded = subBids.find((b) => b.trade_package_id === pkg.id && b.awarded)
                  const subName = awarded ? subsById[awarded.subcontractor_id]?.name : null
                  const c = colors(pkg.trade_tag)
                  return (
                    <div key={pkg.id} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '14px 16px', borderRadius: 10, background: awarded ? 'var(--bg-base)' : '#fafafa', border: '1.5px solid var(--border)' }}>
                      <span style={{ width: 10, height: 10, borderRadius: '50%', background: c.accent, flexShrink: 0 }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{pkg.trade_tag}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{awarded ? subName : 'No award yet'}</div>
                      </div>
                      {awarded ? <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>{fmt(awarded.amount)}</span> : <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Pending</span>}
                      {awarded ? <span style={{ fontSize: 11, background: '#f0fdf4', color: '#15803d', border: '1px solid #bbf7d0', padding: '3px 9px', borderRadius: 20, fontWeight: 600 }}>Awarded</span> : <span style={{ fontSize: 11, background: '#f3f4f6', color: '#6b7280', padding: '3px 9px', borderRadius: 20, fontWeight: 600 }}>TBD</span>}
                    </div>
                  )
                })}
                <div className="bidsheet-gc-total-bar">
                  <span style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>Total Awarded</span>
                  <span style={{ fontSize: 20, fontWeight: 700, color: '#4ade80', fontVariantNumeric: 'tabular-nums' }}>{fmt(awardedTotal)}</span>
                </div>
              </div>
            </div>
          )}

          {activeSubTab === 'proposal' && (
            <div className="bidsheet-compare-card">
              <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>Homeowner Proposal</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 1 }}>Client-facing summary — no sub names or internal pricing visible</div>
                </div>
                <button type="button" onClick={() => window.print()} className="py-1.5 px-3.5 rounded-lg bg-[var(--red)] text-white text-[12px] font-semibold border-none cursor-pointer flex items-center gap-1.5">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
                  Export PDF
                </button>
              </div>
              <div style={{ padding: '24px 28px' }}>
                <ProposalViewStage
                  proposalLines={bidSheet.proposal_lines}
                  projectName={project?.name}
                  projectAddress={project ? [project.address_line_1, [project.city, project.state].filter(Boolean).join(', ')].filter(Boolean).join(' · ') : undefined}
                  total={awardedTotal + (bidSheet.cost_buckets?.self_supplied_materials ?? 0) + (bidSheet.cost_buckets?.own_labor ?? 0) + (bidSheet.cost_buckets?.overhead_margin ?? 0)}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
