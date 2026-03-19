/**
 * Build / refresh project budget_line_items from an estimate's line items.
 * Used when the client accepts the estimate (authoritative scope + pricing).
 */

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
  sectionToBudgetCategory,
}
