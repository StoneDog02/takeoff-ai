/**
 * Build / refresh project budget_line_items from an estimate's line items.
 * Used when the client accepts the estimate (authoritative scope + pricing).
 */

const BUDGET_CATEGORY_KEYS = ['labor', 'materials', 'subs', 'equipment', 'permits', 'overhead', 'other']

/**
 * Map estimate group meta to budget_line_items.category (matches Budget tab keys).
 * @param {Record<string, unknown>} g
 */
function normalizeGroupCategoryKey(g) {
  const legacyRaw = g.budgetCategoryKey != null ? String(g.budgetCategoryKey).trim() : ''
  if (legacyRaw) {
    const k = legacyRaw.toLowerCase()
    if (k === 'subcontractors') return 'subs'
    if (BUDGET_CATEGORY_KEYS.includes(k)) return k
  }
  const labelRaw = g.budgetCategory != null ? String(g.budgetCategory).trim() : ''
  if (labelRaw) {
    const L = labelRaw.toLowerCase().replace(/&/g, 'and').trim()
    const byLabel = {
      labor: 'labor',
      materials: 'materials',
      subcontractors: 'subs',
      equipment: 'equipment',
      'permits and fees': 'permits',
      'permits & fees': 'permits',
      overhead: 'overhead',
      other: 'other',
    }
    if (byLabel[L]) return byLabel[L]
    if (L.includes('subcontract')) return 'subs'
    if (L.includes('material')) return 'materials'
    if (L.includes('labor')) return 'labor'
    if (L.includes('permit')) return 'permits'
    if (L.includes('equipment')) return 'equipment'
    if (L.includes('overhead')) return 'overhead'
  }
  const src = g.source
  if (src === 'takeoff') return 'materials'
  if (src === 'bid') return 'subs'
  return 'other'
}

function roundMoney(n) {
  return Math.round(Number(n) * 100) / 100
}

/**
 * After client approves via portal: populate budget from estimate_groups_meta (one logical row per budget category).
 * - Removes prior rows with source = 'estimate' for this project (idempotent re-approve / heal).
 * - For each aggregated category: UPDATE first existing row for that project+category (any source), else INSERT with source = 'estimate'.
 * - Preserves actual on updated rows.
 * Falls back to replaceProjectBudgetFromEstimate when meta has no usable groups.
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 */
async function applyApprovedEstimateGroupsToBudget(supabase, projectId, estimateId) {
  if (!projectId || !estimateId) return

  const { data: est, error: estErr } = await supabase
    .from('estimates')
    .select('id, total_amount, estimate_groups_meta')
    .eq('id', estimateId)
    .maybeSingle()

  if (estErr) {
    console.error('[budgetFromEstimate] load estimate for groups', estErr)
    throw estErr
  }
  if (!est) return

  const meta = est.estimate_groups_meta
  const groups = Array.isArray(meta) ? meta.filter((g) => g && typeof g === 'object') : []

  /** @type {Map<string, { predicted: number, labels: string[] }>} */
  const buckets = new Map()
  for (const g of groups) {
    const categoryKey = normalizeGroupCategoryKey(g)
    const name = g.categoryName != null ? String(g.categoryName).trim() : ''
    const total = roundMoney(g.clientTotal != null ? Number(g.clientTotal) : 0)
    if (!buckets.has(categoryKey)) {
      buckets.set(categoryKey, { predicted: 0, labels: [] })
    }
    const b = buckets.get(categoryKey)
    b.predicted = roundMoney(b.predicted + total)
    if (name) b.labels.push(name)
  }

  if (buckets.size === 0) {
    await replaceProjectBudgetFromEstimate(supabase, projectId, estimateId)
    return
  }

  const { error: delErr } = await supabase
    .from('budget_line_items')
    .delete()
    .eq('project_id', projectId)
    .eq('source', 'estimate')

  if (delErr) {
    console.error('[budgetFromEstimate] delete estimate-sourced budget rows', delErr)
    throw delErr
  }

  for (const [categoryKey, { predicted, labels }] of buckets) {
    const uniqueLabels = [...new Set(labels.filter(Boolean))]
    let label =
      uniqueLabels.length > 0 ? uniqueLabels.join(', ') : categoryKey.charAt(0).toUpperCase() + categoryKey.slice(1)
    if (label.length > 220) label = `${label.slice(0, 217)}…`

    const { data: existingList, error: findErr } = await supabase
      .from('budget_line_items')
      .select('id, actual')
      .eq('project_id', projectId)
      .eq('category', categoryKey)
      .order('id', { ascending: true })
      .limit(1)

    if (findErr) {
      console.error('[budgetFromEstimate] find budget row', findErr)
      throw findErr
    }

    const existing = existingList && existingList[0]

    if (existing) {
      const { error: upErr } = await supabase
        .from('budget_line_items')
        .update({
          label,
          predicted,
        })
        .eq('id', existing.id)
      if (upErr) {
        console.error('[budgetFromEstimate] update budget row', upErr)
        throw upErr
      }
    } else {
      const { error: insErr } = await supabase.from('budget_line_items').insert({
        project_id: projectId,
        label,
        predicted,
        actual: 0,
        category: categoryKey,
        source: 'estimate',
      })
      if (insErr) {
        console.error('[budgetFromEstimate] insert budget row from groups', insErr)
        throw insErr
      }
    }
  }

  const predictedTotal = [...buckets.values()].reduce((s, b) => s + b.predicted, 0)
  const estTotal = Number(est.total_amount) || predictedTotal
  await supabase
    .from('projects')
    .update({
      estimated_value: estTotal > 0 ? estTotal : predictedTotal,
      updated_at: new Date().toISOString(),
    })
    .eq('id', projectId)
}

function sectionToBudgetCategory(section) {
  const s = String(section || '')
    .toLowerCase()
    .replace(/&/g, 'and')
    .trim()
  if (!s) return 'other'
  if (s.includes('labor')) return 'labor'
  if (s.includes('material')) return 'materials'
  if (s.includes('subcontractor') || /^sub\s/.test(s) || s === 'subs') return 'subs'
  if (s.includes('equipment')) return 'equipment'
  if (s.includes('permit')) return 'permits'
  if (s.includes('overhead')) return 'overhead'
  return 'other'
}

function linePredicted(line) {
  const t = Number(line.total)
  if (!Number.isNaN(t) && t >= 0) return t
  return Math.max(0, (Number(line.quantity) || 0) * (Number(line.unit_price) || 0))
}

/**
 * Replace all budget rows for the project with rows derived from estimate_line_items.
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 */
async function replaceProjectBudgetFromEstimate(supabase, projectId, estimateId) {
  if (!projectId || !estimateId) return

  const { data: lines, error: liErr } = await supabase
    .from('estimate_line_items')
    .select('description, quantity, unit, unit_price, total, section')
    .eq('estimate_id', estimateId)
    .order('id', { ascending: true })

  if (liErr) {
    console.error('[budgetFromEstimate] load line items', liErr)
    throw liErr
  }

  const { error: delErr } = await supabase.from('budget_line_items').delete().eq('project_id', projectId)
  if (delErr) {
    console.error('[budgetFromEstimate] delete budget', delErr)
    throw delErr
  }

  const rows = lines || []
  let inserts = []

  if (rows.length === 0) {
    const { data: est } = await supabase.from('estimates').select('total_amount').eq('id', estimateId).maybeSingle()
    const total = Number(est?.total_amount) || 0
    if (total > 0) {
      inserts = [
        {
          project_id: projectId,
          label: 'Approved estimate',
          predicted: total,
          actual: 0,
          category: 'other',
        },
      ]
    }
  } else {
    inserts = rows.map((line) => {
      let desc = (line.description || '').trim() || 'Line item'
      if (desc.length > 220) desc = `${desc.slice(0, 217)}…`
      return {
        project_id: projectId,
        label: desc,
        predicted: linePredicted(line),
        actual: 0,
        category: sectionToBudgetCategory(line.section),
      }
    })
  }

  if (inserts.length > 0) {
    const { error: insErr } = await supabase.from('budget_line_items').insert(inserts)
    if (insErr) {
      console.error('[budgetFromEstimate] insert budget', insErr)
      throw insErr
    }
  }

  const predictedTotal = inserts.reduce((s, r) => s + Number(r.predicted || 0), 0)
  const { data: est2 } = await supabase.from('estimates').select('total_amount').eq('id', estimateId).maybeSingle()
  const estTotal = Number(est2?.total_amount) || predictedTotal
  await supabase
    .from('projects')
    .update({ estimated_value: estTotal > 0 ? estTotal : predictedTotal, updated_at: new Date().toISOString() })
    .eq('id', projectId)
}

module.exports = {
  replaceProjectBudgetFromEstimate,
  applyApprovedEstimateGroupsToBudget,
  sectionToBudgetCategory,
}
