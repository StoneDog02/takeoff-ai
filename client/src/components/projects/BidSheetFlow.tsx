import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { api } from '@/api/client'
import type { BidDocument, BidSheet, CostBuckets, TradePackage, Subcontractor, SubBid, TakeoffItem } from '@/types/global'
import { BidCollectionStage } from './bid-sheet/BidCollectionStage'
import { ProposalViewStage } from './bid-sheet/ProposalViewStage'
import { LoadingSkeleton } from '@/components/LoadingSkeleton'

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


const STATUS_CONFIG: Record<string, { bg: string; text: string; border: string }> = {
  Awarded: { bg: '#f0fdf4', text: '#15803d', border: '#bbf7d0' },
  Received: { bg: '#eff6ff', text: '#1d4ed8', border: '#bfdbfe' },
  Sent: { bg: '#fffbeb', text: '#a16207', border: '#fde68a' },
  Pending: { bg: '#f3f4f6', text: '#374151', border: '#e5e7eb' },
}

const SUB_TABS = [
  { key: 'packages', label: 'Trade Packages' },
  { key: 'collection', label: 'Bid Collection' },
  { key: 'summary', label: 'GC Summary' },
  { key: 'proposal', label: 'Homeowner Proposal' },
] as const

function fmt(n: number | null | undefined): string {
  return n != null ? '$' + n.toLocaleString() : '—'
}

function CostBucketsEditor({
  costBuckets,
  onSave,
  saving,
}: {
  costBuckets: CostBuckets
  onSave: (next: CostBuckets) => Promise<void>
  saving: boolean
}) {
  const [materials, setMaterials] = useState(String(costBuckets.self_supplied_materials ?? ''))
  const [labor, setLabor] = useState(String(costBuckets.own_labor ?? ''))
  const [overhead, setOverhead] = useState(String(costBuckets.overhead_margin ?? ''))
  useEffect(() => {
    setMaterials(String(costBuckets.self_supplied_materials ?? ''))
    setLabor(String(costBuckets.own_labor ?? ''))
    setOverhead(String(costBuckets.overhead_margin ?? ''))
  }, [costBuckets.self_supplied_materials, costBuckets.own_labor, costBuckets.overhead_margin])
  const handleSave = () => {
    onSave({
      ...costBuckets,
      self_supplied_materials: Number(materials) || 0,
      own_labor: Number(labor) || 0,
      overhead_margin: Number(overhead) || 0,
    })
  }
  return (
    <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', gap: 16 }}>
      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginRight: 8 }}>Add-ons (included in proposal total):</span>
      <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Materials</span>
        <input type="number" min={0} step={1} value={materials} onChange={(e) => setMaterials(e.target.value)} className="w-28 px-2 py-1.5 rounded-md border border-[var(--border)] bg-[var(--bg-base)] text-sm font-medium text-right" placeholder="0" />
      </label>
      <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Labor</span>
        <input type="number" min={0} step={1} value={labor} onChange={(e) => setLabor(e.target.value)} className="w-28 px-2 py-1.5 rounded-md border border-[var(--border)] bg-[var(--bg-base)] text-sm font-medium text-right" placeholder="0" />
      </label>
      <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Overhead & margin</span>
        <input type="number" min={0} step={1} value={overhead} onChange={(e) => setOverhead(e.target.value)} className="w-28 px-2 py-1.5 rounded-md border border-[var(--border)] bg-[var(--bg-base)] text-sm font-medium text-right" placeholder="0" />
      </label>
      <button type="button" onClick={handleSave} disabled={saving} style={{ padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, background: 'var(--text-primary)', color: '#fff', border: 'none', cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}>
        {saving ? 'Saving…' : 'Update'}
      </button>
    </div>
  )
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
  /** Called after bid sheet is saved with an award change so Budget tab can refetch actuals. */
  onAwardedChange?: () => void
  initialBidSheet?: BidSheet
}

type SubTabKey = (typeof SUB_TABS)[number]['key']

export function BidSheetFlow({
  projectId,
  project,
  takeoffCategories = [],
  subcontractors,
  onAddSub,
  onDeleteSub: _onDeleteSub,
  onBulkSend,
  onAwardedChange,
  initialBidSheet,
}: BidSheetFlowProps) {
  const [bidSheet, setBidSheet] = useState<BidSheet | null>(initialBidSheet ?? null)
  const [loading, setLoading] = useState(!initialBidSheet)
  const [saving, setSaving] = useState(false)
  const [activeSubTab, setActiveSubTab] = useState<SubTabKey>('packages')
  const [activeTrade, setActiveTrade] = useState<string | null>(null)
  const [addSubOpen, setAddSubOpen] = useState(false)
  const [newSub, setNewSub] = useState({ name: '', trade: 'Framing', email: '', phone: '' })
  const [expandedSub, setExpandedSub] = useState<string | null>(null)
  /** When set, the "Send scope to subs" modal is open for this trade; user picks subs then continues to email. */
  const [sendToSubsTrade, setSendToSubsTrade] = useState<string | null>(null)
  const [sendToSubsSelected, setSendToSubsSelected] = useState<Set<string>>(new Set())
  const [bidDocuments, setBidDocuments] = useState<BidDocument[]>([])
  const [documentsLoading, setDocumentsLoading] = useState(false)
  const [documentUploading, setDocumentUploading] = useState(false)
  const [bidDocsModalOpen, setBidDocsModalOpen] = useState(false)

  const tradePackages = bidSheet?.trade_packages ?? []
  const subBids = bidSheet?.sub_bids ?? []
  /** True if bid sheet has been generated from takeoff at least once (we have packages). */
  const hasGeneratedFromTakeoff = tradePackages.length > 0
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

  /** When proposal_lines is empty, show one line per awarded bid (trade name + amount) so the proposal isn’t blank. */
  const derivedProposalLines = useMemo(() => {
    const awarded = subBids.filter((b) => b.awarded)
    return awarded.map((b) => {
      const pkg = tradePackages.find((p) => p.id === b.trade_package_id)
      return { id: b.id, label: pkg?.trade_tag ?? 'Trade', amount: b.amount }
    })
  }, [subBids, tradePackages])
  const proposalLinesToShow = (bidSheet?.proposal_lines?.length ?? 0) > 0 ? bidSheet!.proposal_lines : derivedProposalLines

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

  const loadBidDocuments = useCallback(() => {
    setDocumentsLoading(true)
    api.projects
      .getBidDocuments(projectId)
      .then(setBidDocuments)
      .catch(() => setBidDocuments([]))
      .finally(() => setDocumentsLoading(false))
  }, [projectId])
  useEffect(() => {
    if (bidDocsModalOpen) loadBidDocuments()
  }, [projectId, bidDocsModalOpen, loadBidDocuments])

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
    onAwardedChange?.()
  }

  const handleAddBid = async (tradePackageId: string, subcontractorId: string, amount: number, notes?: string) => {
    const newBid: SubBid = {
      id: `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      trade_package_id: tradePackageId,
      subcontractor_id: subcontractorId,
      amount,
      notes: notes || undefined,
      awarded: false,
    }
    await saveBidSheet({ ...bidSheet!, sub_bids: [...subBids, newBid] })
  }

  const handleAddSub = async () => {
    if (!newSub.name.trim() || !onAddSub) return
    await onAddSub(newSub)
    setNewSub({ name: '', trade: 'Framing', email: '', phone: '' })
    setAddSubOpen(false)
  }

  const bidDocInputRef = useRef<HTMLInputElement>(null)
  const handleBidDocUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    setDocumentUploading(true)
    try {
      const doc = await api.projects.uploadBidDocument(projectId, file)
      setBidDocuments((prev) => [doc, ...prev])
    } finally {
      setDocumentUploading(false)
    }
  }
  const openBidDoc = async (doc: BidDocument) => {
    const { url } = await api.projects.getBidDocumentViewUrl(projectId, doc.id)
    window.open(url, '_blank', 'noopener,noreferrer')
  }
  const deleteBidDoc = async (doc: BidDocument) => {
    await api.projects.deleteBidDocument(projectId, doc.id)
    setBidDocuments((prev) => prev.filter((d) => d.id !== doc.id))
  }

  const trade = activeTrade ? tradePackages.find((p) => p.trade_tag === activeTrade) : null
  const colors = (t: string) => TRADE_COLORS[t] || TRADE_COLORS.TBD

  if (loading || !bidSheet) {
    return (
      <div className="bidsheet-tab">
        <div className="py-6">
          <LoadingSkeleton variant="inline" lines={4} className="max-w-sm" />
        </div>
      </div>
    )
  }

  return (
    <div className="bidsheet-tab">
      {/* Compact status line + primary tabs */}
      <div className="bidsheet-top-bar">
        <div className="bidsheet-status-line">
          <button type="button" className="bidsheet-status-btn" onClick={() => setActiveSubTab('packages')} title="Go to Trade Packages">
            {pipelineCounts.takeoff ? '✓ Takeoff' : 'Takeoff'}
          </button>
          <span className="bidsheet-status-sep" />
          <button type="button" className="bidsheet-status-btn" onClick={() => setActiveSubTab('packages')} title="Go to Trade Packages">
            {pipelineCounts.packages} packages
          </button>
          <span className="bidsheet-status-sep" />
          <button type="button" className="bidsheet-status-btn" onClick={() => setActiveSubTab('collection')} title="Go to Bid Collection">
            {pipelineCounts.sent} sent
          </button>
          <span className="bidsheet-status-sep" />
          <button type="button" className="bidsheet-status-btn" onClick={() => setActiveSubTab('collection')} title="Go to Bid Collection">
            {pipelineCounts.received} received
          </button>
          <span className="bidsheet-status-sep" />
          <button type="button" className="bidsheet-status-btn" onClick={() => setActiveSubTab('collection')} title="Go to Bid Collection">
            {pipelineCounts.awarded} awarded
          </button>
          <span className="bidsheet-status-sep" />
          <button type="button" className="bidsheet-status-btn bidsheet-status-awarded" onClick={() => setActiveSubTab('summary')} title="Go to GC Summary">
            Awarded total: <strong style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--green, #16a34a)' }}>{fmt(awardedTotal)}</strong>
          </button>
        </div>
        <div className="bidsheet-primary-tabs">
          {SUB_TABS.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => setActiveSubTab(key)}
              className={`bidsheet-primary-tab ${activeSubTab === key ? 'active' : ''}`}
            >
              {label}
            </button>
          ))}
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

        {/* Right: Content */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {activeSubTab === 'packages' && (
            <div className="bidsheet-packages-card">
              <div className="bidsheet-info-bar">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
                {hasGeneratedFromTakeoff ? 'Auto-generated from takeoff. Each sub sees only their scope — no pricing visible.' : 'Build trade packages from your takeoff so you can send scopes to subs.'}
                <button type="button" onClick={generateTradePackages} disabled={saving || takeoffCategories.length === 0} className="ml-auto text-[11px] py-1 px-2.5 rounded-md bg-[var(--bg-surface)] border border-[var(--border)] cursor-pointer text-[var(--text-secondary)] font-medium whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed" title={takeoffCategories.length === 0 ? 'Run Launch Takeoff first' : undefined}>
                  {hasGeneratedFromTakeoff ? 'Re-generate from Takeoff' : 'Generate from Takeoff'}
                </button>
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
                    <button
                      type="button"
                      onClick={() => {
                        const matchingIds = new Set(subcontractors.filter((s) => (s.trade || 'TBD') === trade.trade_tag).map((s) => s.id))
                        setSendToSubsSelected(matchingIds)
                        setSendToSubsTrade(trade.trade_tag)
                      }}
                      style={{ padding: '8px 16px', background: colors(trade.trade_tag).accent, color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                    >
                      Send to Subs →
                    </button>
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
              {tradePackages.length === 0 && (
                <p className="text-sm text-muted">
                  {takeoffCategories.length > 0
                    ? 'No trade packages yet. Use "Generate from Takeoff" above to build the bid sheet from your takeoff.'
                    : 'No trade packages yet. Run Launch Takeoff first, then use "Generate from Takeoff" to build the bid sheet.'}
                </p>
              )}
            </div>
          )}

          {activeSubTab === 'collection' && (
            <div className="bidsheet-collection-layout">
              <div className="bidsheet-collection-page-header">
                <div>
                  <div className="bidsheet-collection-page-title">Bid Collection</div>
                  <div className="bidsheet-collection-page-desc">Add bids per trade below. Award winners in Bid Compare — GC Summary and Homeowner Proposal update automatically.</div>
                </div>
                <button
                  type="button"
                  onClick={() => setBidDocsModalOpen(true)}
                  className="bidsheet-collection-docs-btn"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>
                  Bid Documents
                </button>
              </div>
              <BidCollectionStage
                tradePackages={tradePackages}
                subBids={subBids}
                subcontractors={subcontractors}
                onAddBid={handleAddBid}
                onSetAwarded={setAwarded}
              />
            </div>
          )}

          {activeSubTab === 'summary' && (
            <div className="bidsheet-gc-summary-card">
              <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>GC Summary</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 1 }}>Awarded subcontractor breakdown for internal review. Award bids in Bid Collection to fill this in.</div>
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
              <CostBucketsEditor
                costBuckets={bidSheet.cost_buckets}
                onSave={(next) => saveBidSheet({ ...bidSheet, cost_buckets: next })}
                saving={saving}
              />
              <div style={{ padding: '24px 28px' }}>
                <ProposalViewStage
                  proposalLines={proposalLinesToShow}
                  projectName={project?.name}
                  projectAddress={project ? [project.address_line_1, [project.city, project.state].filter(Boolean).join(', ')].filter(Boolean).join(' · ') : undefined}
                  total={awardedTotal + (bidSheet.cost_buckets?.self_supplied_materials ?? 0) + (bidSheet.cost_buckets?.own_labor ?? 0) + (bidSheet.cost_buckets?.overhead_margin ?? 0)}
                />
              </div>
            </div>
          )}

        </div>
      </div>

      {/* Bid Documents modal: upload and view stored bid files */}
      {bidDocsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setBidDocsModalOpen(false)}>
          <div
            className="rounded-lg border border-[var(--border)] bg-[var(--bg-base)] shadow-lg max-w-lg w-full max-h-[85vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>Bid Documents</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Upload and view bids you’ve received from subs</div>
              </div>
              <button type="button" onClick={() => setBidDocsModalOpen(false)} style={{ padding: 6, borderRadius: 6, color: 'var(--text-muted)', background: 'transparent', border: 'none', cursor: 'pointer' }} aria-label="Close">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
              </button>
            </div>
            <div style={{ padding: 20, overflowY: 'auto', flex: 1, minHeight: 0 }}>
              <input
                ref={bidDocInputRef}
                type="file"
                accept=".pdf,.doc,.docx,.xls,.xlsx,image/*"
                onChange={handleBidDocUpload}
                className="sr-only"
                aria-hidden
              />
              <button
                type="button"
                onClick={() => bidDocInputRef.current?.click()}
                disabled={documentUploading}
                style={{
                  padding: '14px 20px',
                  borderRadius: 10,
                  border: '2px dashed var(--border)',
                  background: 'var(--bg-base)',
                  color: 'var(--text-secondary)',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: documentUploading ? 'wait' : 'pointer',
                  width: '100%',
                  marginBottom: 16,
                }}
              >
                {documentUploading ? 'Uploading…' : '+ Upload bid document (PDF, image, or spreadsheet)'}
              </button>
              {documentsLoading ? (
                <div className="py-2">
                  <LoadingSkeleton variant="inline" lines={3} />
                </div>
              ) : bidDocuments.length === 0 ? (
                <p className="text-sm text-[var(--text-muted)]">No bid documents yet. Upload PDFs or files you received from subs to keep them here for reference.</p>
              ) : (
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {bidDocuments.map((doc) => (
                    <li
                      key={doc.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        padding: '12px 14px',
                        borderRadius: 8,
                        background: 'var(--bg-base)',
                        border: '1px solid var(--border)',
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => openBidDoc(doc)}
                        style={{ flex: 1, textAlign: 'left', fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                        title={`View ${doc.file_name}`}
                      >
                        {doc.file_name}
                      </button>
                      {doc.uploaded_at && (
                        <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}>
                          {new Date(doc.uploaded_at).toLocaleDateString()}
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); deleteBidDoc(doc) }}
                        style={{ padding: '6px 12px', borderRadius: 6, fontSize: 12, color: 'var(--text-muted)', background: 'transparent', border: '1px solid var(--border)', cursor: 'pointer' }}
                        title="Remove"
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Send scope to subs: pick which subs to email, then parent opens email modal */}
      {sendToSubsTrade && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setSendToSubsTrade(null)}>
          <div
            className="rounded-lg border border-[var(--border)] bg-[var(--bg-base)] p-6 shadow-lg max-w-md w-full max-h-[85vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-1">Send {sendToSubsTrade} scope to subcontractors</h2>
            <p className="text-sm text-[var(--text-muted)] mb-4">Choose who receives this scope. You’ll compose the email next.</p>
            <div className="flex gap-2 mb-3">
              <button
                type="button"
                onClick={() => {
                  const matching = new Set(subcontractors.filter((s) => (s.trade || 'TBD') === sendToSubsTrade).map((s) => s.id))
                  setSendToSubsSelected(matching)
                }}
                className="text-[11px] py-1 px-2.5 rounded-md bg-[var(--bg-surface)] border border-[var(--border)] cursor-pointer text-[var(--text-secondary)] font-medium"
              >
                Select all {sendToSubsTrade}
              </button>
              <button
                type="button"
                onClick={() => setSendToSubsSelected(new Set(subcontractors.map((s) => s.id)))}
                className="text-[11px] py-1 px-2.5 rounded-md bg-[var(--bg-surface)] border border-[var(--border)] cursor-pointer text-[var(--text-secondary)] font-medium"
              >
                Select all
              </button>
              <button
                type="button"
                onClick={() => setSendToSubsSelected(new Set())}
                className="text-[11px] py-1 px-2.5 rounded-md bg-[var(--bg-surface)] border border-[var(--border)] cursor-pointer text-[var(--text-secondary)] font-medium"
              >
                Deselect all
              </button>
            </div>
            <ul className="overflow-y-auto flex-1 min-h-0 space-y-1 pr-1">
              {subcontractors.map((s) => {
                const checked = sendToSubsSelected.has(s.id)
                const isMatching = (s.trade || 'TBD') === sendToSubsTrade
                return (
                  <li key={s.id}>
                    <label className="flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-[var(--bg-surface)] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => {
                          setSendToSubsSelected((prev) => {
                            const next = new Set(prev)
                            if (next.has(s.id)) next.delete(s.id)
                            else next.add(s.id)
                            return next
                          })
                        }}
                        className="rounded border-[var(--border)]"
                      />
                      <span className="font-medium text-[var(--text-primary)]">{s.name}</span>
                      <span className="text-[11px] text-[var(--text-muted)]" style={{ background: (TRADE_COLORS[s.trade || 'TBD'] || TRADE_COLORS.TBD).accent + '20', color: (TRADE_COLORS[s.trade || 'TBD'] || TRADE_COLORS.TBD).accent, padding: '2px 6px', borderRadius: 4, fontWeight: 600 }}>
                        {s.trade || 'TBD'}
                      </span>
                      {isMatching && <span className="text-[10px] text-[var(--text-muted)]">(matches)</span>}
                    </label>
                  </li>
                )
              })}
            </ul>
            {subcontractors.length === 0 && (
              <p className="text-sm text-[var(--text-muted)] py-4">No subcontractors on this project. Add subs in Team & Crew or the Bid Collection tab.</p>
            )}
            <div className="flex justify-end gap-2 mt-4 pt-4 border-t border-[var(--border)]">
              <button
                type="button"
                onClick={() => setSendToSubsTrade(null)}
                className="px-4 py-2 rounded-md border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-surface)]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  const ids = Array.from(sendToSubsSelected)
                  if (ids.length > 0 && onBulkSend) onBulkSend(ids)
                  setSendToSubsTrade(null)
                }}
                disabled={sendToSubsSelected.size === 0 || !onBulkSend}
                className="px-4 py-2 rounded-md bg-[var(--red)] text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Continue to email ({sendToSubsSelected.size})
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
