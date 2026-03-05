import { useState, useEffect } from 'react'
import { api } from '@/api/client'
import type { BidSheet, TradePackage, SubBid, Subcontractor, CostBuckets, TakeoffItem } from '@/types/global'
import { TradePackagesStage } from './bid-sheet/TradePackagesStage'
import { BidCollectionStage } from './bid-sheet/BidCollectionStage'
import { CostSummaryStage } from './bid-sheet/CostSummaryStage'
import { ProposalViewStage } from './bid-sheet/ProposalViewStage'
import { ExportStage } from './bid-sheet/ExportStage'

export const TRADE_COLORS: Record<string, { bg: string; accent: string; light: string }> = {
  Framing: { bg: '#FFF7ED', accent: '#EA580C', light: '#FED7AA' },
  Electrical: { bg: '#EFF6FF', accent: '#2563EB', light: '#BFDBFE' },
  Plumbing: { bg: '#F0FDF4', accent: '#16A34A', light: '#BBF7D0' },
  Concrete: { bg: '#F5F3FF', accent: '#7C3AED', light: '#DDD6FE' },
  Roofing: { bg: '#FFF1F2', accent: '#E11D48', light: '#FECDD3' },
  HVAC: { bg: '#ECFEFF', accent: '#0891B2', light: '#A5F3FC' },
  Drywall: { bg: '#FEFCE8', accent: '#CA8A04', light: '#FEF08A' },
  TBD: { bg: '#F9FAFB', accent: '#374151', light: '#E5E7EB' },
}

const STAGES = [
  { id: 1, key: 'packages', label: 'Trade Packages' },
  { id: 2, key: 'bids', label: 'Bid Collection' },
  { id: 3, key: 'summary', label: 'GC Summary' },
  { id: 4, key: 'proposal', label: 'Homeowner Proposal' },
  { id: 5, key: 'export', label: 'Export' },
]

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
  project?: { name?: string; address_line_1?: string; city?: string; state?: string; postal_code?: string }
  takeoffCategories?: { name: string; items: TakeoffItem[] }[]
  subcontractors: Subcontractor[]
  onAddSub?: (row: { name: string; trade: string; email: string; phone: string }) => Promise<void>
  onDeleteSub?: (id: string) => Promise<void>
  onBulkSend?: (subIds: string[]) => void
  initialBidSheet?: BidSheet
}

export function BidSheetFlow({
  projectId,
  project,
  takeoffCategories = [],
  subcontractors,
  onAddSub,
  onDeleteSub,
  onBulkSend,
  initialBidSheet,
}: BidSheetFlowProps) {
  const [stage, setStage] = useState(1)
  const [bidSheet, setBidSheet] = useState<BidSheet | null>(initialBidSheet ?? null)
  const [loading, setLoading] = useState(!initialBidSheet)
  const [saving, setSaving] = useState(false)
  const [exportingPDF, setExportingPDF] = useState(false)
  const [exportingCSV, setExportingCSV] = useState(false)
  const [showAddSub, setShowAddSub] = useState(false)
  const [newSub, setNewSub] = useState({ name: '', trade: 'Framing', email: '', phone: '' })
  const [selectedSubs, setSelectedSubs] = useState<Set<string>>(new Set())

  const load = async () => {
    setLoading(true)
    try {
      const data = await api.projects.getBidSheet(projectId)
      setBidSheet(data)
    } catch {
      setBidSheet({
        project_id: projectId,
        trade_packages: [],
        sub_bids: [],
        cost_buckets: {
          awarded_bids: 0,
          self_supplied_materials: 0,
          own_labor: 0,
          overhead_margin: 0,
        },
        proposal_lines: [],
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (initialBidSheet) {
      setBidSheet(initialBidSheet)
      setLoading(false)
      return
    }
    load()
  }, [projectId, initialBidSheet])

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

  const addSubBid = async (tradePackageId: string, subcontractorId: string, amount: number, notes?: string) => {
    const newBid: SubBid = {
      id: `new-${Date.now()}`,
      trade_package_id: tradePackageId,
      subcontractor_id: subcontractorId,
      amount,
      notes,
      awarded: false,
    }
    const nextBids = [...(bidSheet?.sub_bids ?? []), newBid]
    await saveBidSheet({ ...bidSheet!, sub_bids: nextBids })
  }

  const setAwarded = async (subBidId: string, awarded: boolean) => {
    const target = (bidSheet?.sub_bids ?? []).find((x) => x.id === subBidId)
    const bidsCorrected = (bidSheet?.sub_bids ?? []).map((b) => {
      if (b.id === subBidId) return { ...b, awarded }
      if (awarded && target && b.trade_package_id === target.trade_package_id) return { ...b, awarded: false }
      return b
    })
    await saveBidSheet({ ...bidSheet!, sub_bids: bidsCorrected })
  }

  const updateCostBuckets = (updates: Partial<CostBuckets>) => {
    if (!bidSheet) return
    setBidSheet({
      ...bidSheet,
      cost_buckets: { ...bidSheet.cost_buckets, ...updates },
    })
  }

  const saveCostBuckets = async () => {
    if (!bidSheet) return
    await saveBidSheet({ cost_buckets: bidSheet.cost_buckets })
  }

  const exportPDF = () => {
    setExportingPDF(true)
    try {
      window.print()
    } finally {
      setExportingPDF(false)
    }
  }

  const exportCSV = () => {
    setExportingCSV(true)
    try {
      const buckets = bidSheet?.cost_buckets ?? {}
      const rows = [
        ['Bucket', 'Amount'],
        ['Awarded bids', buckets.awarded_bids ?? 0],
        ['Self-supplied materials', buckets.self_supplied_materials ?? 0],
        ['Own labor', buckets.own_labor ?? 0],
        ['Overhead/margin', buckets.overhead_margin ?? 0],
        ['Total', (buckets.awarded_bids ?? 0) + (buckets.self_supplied_materials ?? 0) + (buckets.own_labor ?? 0) + (buckets.overhead_margin ?? 0)],
      ]
      const csv = rows.map((r) => r.join(',')).join('\n')
      const blob = new Blob([csv], { type: 'text/csv' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `cost-summary-${projectId}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setExportingCSV(false)
    }
  }

  const projectLine = project
    ? [project.name, project.address_line_1, [project.city, project.state, project.postal_code].filter(Boolean).join(', ')].filter(Boolean).join(' · ')
    : ''

  const handleAddSub = async () => {
    if (!newSub.name.trim() || !newSub.email.trim() || !onAddSub) return
    await onAddSub(newSub)
    setNewSub({ name: '', trade: 'Framing', email: '', phone: '' })
    setShowAddSub(false)
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

  const tradeColors = (trade: string) => TRADE_COLORS[trade] || TRADE_COLORS.TBD

  const getSubStatus = (sub: Subcontractor) => {
    const hasBid = (bidSheet?.sub_bids ?? []).some((b) => b.subcontractor_id === sub.id)
    if (!hasBid) return 'Pending'
    const awarded = (bidSheet?.sub_bids ?? []).some((b) => b.subcontractor_id === sub.id && b.awarded)
    return awarded ? 'Awarded' : 'Received'
  }

  if (loading || !bidSheet) {
    return (
      <div className="bidsheet-tab">
        <p className="text-sm text-muted">Loading bid sheet…</p>
      </div>
    )
  }

  return (
    <div className="bidsheet-tab">
      {/* Header */}
      <div className="bidsheet-header">
        <div>
          <div className="bidsheet-header-project">{projectLine || 'Project'}</div>
          <h1 className="bidsheet-header-title">Bid Sheet</h1>
        </div>
        <div className="bidsheet-header-actions">
          <button
            type="button"
            className="btn-sm"
            onClick={() => onBulkSend?.(Array.from(selectedSubs))}
            disabled={selectedSubs.size === 0}
          >
            Bulk Send ({selectedSubs.size})
          </button>
          <button type="button" className="btn btn-primary" onClick={() => setShowAddSub(true)} disabled={!onAddSub}>
            + Add Sub
          </button>
        </div>
      </div>

      {/* Subcontractors Panel */}
      <div className="bidsheet-subs-card">
        <div className="bidsheet-subs-card-head">
          <span className="bidsheet-subs-card-title">Subcontractors</span>
          <span className="bidsheet-subs-count">{subcontractors.length}</span>
        </div>
        <table className="bidsheet-subs-table">
          <thead>
            <tr>
              <th>
                <input type="checkbox" checked={subcontractors.length > 0 && selectedSubs.size === subcontractors.length} onChange={selectAllSubs} />
              </th>
              <th>Name</th>
              <th>Trade</th>
              <th>Email</th>
              <th>Phone</th>
              <th>Status</th>
              <th style={{ width: 60 }} />
            </tr>
          </thead>
          <tbody>
            {subcontractors.map((sub) => {
              const c = tradeColors(sub.trade)
              const status = getSubStatus(sub)
              return (
                <tr key={sub.id}>
                  <td>
                    <input type="checkbox" checked={selectedSubs.has(sub.id)} onChange={() => toggleSub(sub.id)} />
                  </td>
                  <td style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>{sub.name}</td>
                  <td>
                    <span className="bidsheet-trade-pill" style={{ background: c.bg, color: c.accent, borderColor: c.light }}>
                      {sub.trade}
                    </span>
                  </td>
                  <td style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{sub.email}</td>
                  <td style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{sub.phone || '—'}</td>
                  <td>
                    <span className={`bidsheet-status-pill ${status.toLowerCase()}`}>{status}</span>
                  </td>
                  <td>
                    {onDeleteSub && (
                      <button
                        type="button"
                        onClick={() => onDeleteSub(sub.id)}
                        className="text-xs font-semibold cursor-pointer border-none bg-transparent"
                        style={{ color: 'var(--red-light, #d95f50)' }}
                      >
                        Remove
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Add Sub Modal */}
      {showAddSub && (
        <div className="bidsheet-add-sub-overlay" onClick={() => setShowAddSub(false)}>
          <div className="bidsheet-add-sub-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Add Subcontractor</h3>
            {[
              ['Name', 'name', 'text'],
              ['Email', 'email', 'email'],
              ['Phone', 'phone', 'tel'],
            ].map(([label, key, type]) => (
              <div key={key} className="field">
                <label>{label}</label>
                <input
                  type={type}
                  value={newSub[key as keyof typeof newSub]}
                  onChange={(e) => setNewSub({ ...newSub, [key]: e.target.value })}
                />
              </div>
            ))}
            <div className="field">
              <label>Trade</label>
              <select value={newSub.trade} onChange={(e) => setNewSub({ ...newSub, trade: e.target.value })}>
                {Object.keys(TRADE_COLORS).filter((t) => t !== 'TBD').map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div className="actions">
              <button type="button" className="btn-sm" onClick={() => setShowAddSub(false)}>
                Cancel
              </button>
              <button type="button" className="btn btn-primary" onClick={handleAddSub}>
                Add
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bid Sheet Stages Card */}
      <div className="bidsheet-stages-card">
        <div className="bidsheet-stages-head">
          <div className="bidsheet-stages-title">Bid Sheet</div>
          <div className="bidsheet-stage-tabs">
            {STAGES.map((s) => (
              <button
                key={s.key}
                type="button"
                className={`bidsheet-stage-tab ${stage === s.id ? 'active' : ''}`}
                onClick={() => setStage(s.id)}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
        <div className="bidsheet-stages-body">
          {stage === 1 && (
            <>
              {takeoffCategories.length > 0 && (
                <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
                  <p className="text-sm text-muted">Auto-generated from takeoff. Each sub sees only their scope — no pricing visible.</p>
                  <button type="button" className="btn" onClick={generateTradePackages} disabled={saving}>
                    Re-generate from Takeoff
                  </button>
                </div>
              )}
              <TradePackagesStage tradePackages={bidSheet.trade_packages ?? []} />
            </>
          )}
          {stage === 2 && (
            <BidCollectionStage
              tradePackages={bidSheet.trade_packages ?? []}
              subBids={bidSheet.sub_bids ?? []}
              subcontractors={subcontractors}
              onAddBid={addSubBid}
              onSetAwarded={setAwarded}
            />
          )}
          {stage === 3 && (
            <CostSummaryStage
              costBuckets={bidSheet.cost_buckets}
              tradePackages={bidSheet.trade_packages ?? []}
              subBids={bidSheet.sub_bids ?? []}
              subcontractors={subcontractors}
              onUpdate={updateCostBuckets}
              onSave={saveCostBuckets}
              saving={saving}
            />
          )}
          {stage === 4 && (
            <ProposalViewStage
              proposalLines={bidSheet.proposal_lines}
              projectName={project?.name}
              projectAddress={project ? [project.address_line_1, [project.city, project.state].filter(Boolean).join(', ')].filter(Boolean).join(' · ') : undefined}
            />
          )}
          {stage === 5 && (
            <ExportStage
              bidSheet={{
                ...bidSheet,
                cost_buckets: bidSheet.cost_buckets ?? {
                  awarded_bids: 0,
                  self_supplied_materials: 0,
                  own_labor: 0,
                  overhead_margin: 0,
                },
              }}
              onExportPDF={exportPDF}
              onExportCSV={exportCSV}
              exportingPDF={exportingPDF}
              exportingCSV={exportingCSV}
            />
          )}
        </div>
      </div>
    </div>
  )
}
