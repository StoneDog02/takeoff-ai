import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { isBankTxTagged } from '@/lib/bankTransactionUtils'

/**
 * Live aggregates for Financials → Reports: per-job invoiced vs tagged debit spend,
 * and spend by expense_type (tagged debits only).
 */
export function useFinancialsReports(userId) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [projects, setProjects] = useState([])
  const [transactions, setTransactions] = useState([])
  const [invoices, setInvoices] = useState([])

  const load = useCallback(async () => {
    if (!userId || !supabase) {
      setProjects([])
      setTransactions([])
      setInvoices([])
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    const [pRes, tRes, iRes] = await Promise.all([
      supabase.from('projects').select('id,name').eq('user_id', userId).order('name'),
      supabase
        .from('bank_transactions')
        .select('job_id,amount,is_debit,expense_type')
        .eq('user_id', userId),
      supabase.from('invoices').select('job_id,total_amount').eq('user_id', userId),
    ])
    const err = pRes.error || tRes.error || iRes.error
    if (err) {
      setError(err.message)
      setProjects([])
      setTransactions([])
      setInvoices([])
    } else {
      setProjects(pRes.data || [])
      setTransactions(tRes.data || [])
      setInvoices(iRes.data || [])
    }
    setLoading(false)
  }, [userId])

  useEffect(() => {
    load()
  }, [load])

  const jobPnl = useMemo(() => {
    const invoiced = new Map()
    for (const inv of invoices) {
      if (!inv.job_id) continue
      const v = Number(inv.total_amount || 0)
      invoiced.set(inv.job_id, (invoiced.get(inv.job_id) || 0) + v)
    }
    const spent = new Map()
    for (const tx of transactions) {
      if (!tx.is_debit || !isBankTxTagged(tx)) continue
      const v = Number(tx.amount || 0)
      const jid = tx.job_id
      spent.set(jid, (spent.get(jid) || 0) + v)
    }
    return projects.map((p) => ({
      id: p.id,
      name: p.name,
      totalInvoiced: invoiced.get(p.id) || 0,
      totalSpent: spent.get(p.id) || 0,
    }))
  }, [projects, invoices, transactions])

  const categorySpend = useMemo(() => {
    const m = new Map()
    for (const tx of transactions) {
      if (!tx.is_debit || !isBankTxTagged(tx)) continue
      const et = String(tx.expense_type || '').trim()
      if (!et) continue
      const v = Number(tx.amount || 0)
      m.set(et, (m.get(et) || 0) + v)
    }
    return Array.from(m.entries())
      .map(([expense_type, amount]) => ({ expense_type, amount }))
      .sort((a, b) => b.amount - a.amount)
  }, [transactions])

  return { loading, error, jobPnl, categorySpend, refresh: load }
}
