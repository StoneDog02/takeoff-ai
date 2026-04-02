import { useState, useEffect, useMemo, useCallback } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { dayjs } from '@/lib/date'
import { isBankTxTagged } from '@/lib/bankTransactionUtils'
import { syncBankTransactionsFromStripe } from '@/api/financialConnections'
import { isPublicDemo } from '@/lib/publicDemo'
import {
  loadDemoBankRowsFromSession,
  persistDemoBankRows,
  getDemoTransactionJobs,
} from '@/data/demo/bankTransactionFixtures'

/** Matches DB check constraint on public.bank_transactions.expense_type */
export const EXPENSE_TYPES = [
  'Materials',
  'Subcontractor',
  'Equipment',
  'Labor',
  'Overhead',
  'Payroll',
]

export function isTagged(row) {
  return isBankTxTagged(row)
}

function inCurrentMonth(isoDate) {
  const d = dayjs(isoDate)
  const now = dayjs()
  return d.month() === now.month() && d.year() === now.year()
}

function computeMetrics(rows) {
  const monthRows = rows.filter((r) => inCurrentMonth(r.transaction_date))
  const debitsMonth = monthRows.filter((r) => r.is_debit)
  const totalSpend = debitsMonth.reduce((s, r) => s + Number(r.amount || 0), 0)
  const taggedDebits = debitsMonth.filter((r) => isBankTxTagged(r))
  const untaggedDebits = debitsMonth.filter((r) => !isBankTxTagged(r))
  const taggedSum = taggedDebits.reduce((s, r) => s + Number(r.amount || 0), 0)
  const untaggedSum = untaggedDebits.reduce((s, r) => s + Number(r.amount || 0), 0)
  const missingReceiptCount = debitsMonth.filter((r) => !r.receipt_url).length
  return {
    totalSpend,
    taggedSum,
    untaggedSum,
    missingReceiptCount,
  }
}

function applySearchAndTab(rows, filterTab, searchQuery) {
  const q = (searchQuery || '').trim().toLowerCase()
  let list = rows
  if (q) {
    list = list.filter((r) => (r.merchant_name || '').toLowerCase().includes(q))
  }
  if (filterTab === 'needs_tagging') {
    list = list.filter((r) => !isBankTxTagged(r))
  } else if (filterTab === 'tagged') {
    list = list.filter((r) => isBankTxTagged(r))
  } else if (filterTab === 'missing_receipt') {
    list = list.filter((r) => r.is_debit && !r.receipt_url)
  }
  return list
}

/**
 * Bank transactions from Supabase (linked accounts / imports).
 */
export function useTransactions(userId) {
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [jobs, setJobs] = useState([])
  const [jobsLoading, setJobsLoading] = useState(true)
  const [filterTab, setFilterTab] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [saveError, setSaveError] = useState(null)
  const [savingId, setSavingId] = useState(null)

  const fetchTransactions = useCallback(async () => {
    if (isPublicDemo()) {
      setLoadError(null)
      setTransactions(loadDemoBankRowsFromSession())
      setLoading(false)
      return
    }
    if (!userId || !supabase) {
      setTransactions([])
      setLoading(false)
      return
    }
    setLoadError(null)
    const { data, error } = await supabase
      .from('bank_transactions')
      .select('*')
      .eq('user_id', userId)
      .order('transaction_date', { ascending: false })

    if (error) {
      setLoadError(error.message)
      setTransactions([])
    } else {
      setTransactions(data || [])
    }
  }, [userId])

  /** Stripe FC → Supabase, then reload rows. `showLoading` only on first paint. */
  const syncAndRefresh = useCallback(
    async (showLoading = true) => {
      if (isPublicDemo()) {
        if (showLoading) setLoading(true)
        setLoadError(null)
        setTransactions(loadDemoBankRowsFromSession())
        if (showLoading) setLoading(false)
        return
      }
      if (!userId || !supabase) {
        setTransactions([])
        setLoading(false)
        return
      }
      if (showLoading) setLoading(true)
      setLoadError(null)
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession()
        if (session?.access_token) {
          await syncBankTransactionsFromStripe(session.access_token).catch(() => {
            /* still show DB rows */
          })
        }
      } catch {
        // ignore
      }
      await fetchTransactions()
      if (showLoading) setLoading(false)
    },
    [userId, fetchTransactions],
  )

  const loadJobs = useCallback(async () => {
    if (isPublicDemo()) {
      setJobs(getDemoTransactionJobs())
      setJobsLoading(false)
      return
    }
    if (!userId || !supabase) {
      setJobs([])
      setJobsLoading(false)
      return
    }
    setJobsLoading(true)
    const { data, error } = await supabase
      .from('projects')
      .select('id,name')
      .eq('user_id', userId)
      .order('name')
    if (!error && data) setJobs(data)
    else setJobs([])
    setJobsLoading(false)
  }, [userId])

  useEffect(() => {
    syncAndRefresh(true)
  }, [syncAndRefresh])

  useEffect(() => {
    if (!userId || isPublicDemo()) return undefined
    const id = setInterval(() => {
      syncAndRefresh(false)
    }, 90 * 1000)
    return () => clearInterval(id)
  }, [userId, syncAndRefresh])

  useEffect(() => {
    loadJobs()
  }, [loadJobs])

  const metrics = useMemo(() => computeMetrics(transactions), [transactions])

  const filteredRows = useMemo(
    () => applySearchAndTab(transactions, filterTab, searchQuery),
    [transactions, filterTab, searchQuery],
  )

  const grouped = useMemo(() => {
    const needsTagging = filteredRows.filter((r) => !isBankTxTagged(r))
    const tagged = filteredRows.filter((r) => isBankTxTagged(r))
    return { needsTagging, tagged }
  }, [filteredRows])

  const saveTransaction = useCallback(
    async (row, form) => {
      if (isPublicDemo()) {
        setSaveError(null)
        setSavingId(row.id)
        try {
          let receiptUrl = row.receipt_url ?? null
          if (form.receiptFile && form.receiptFile instanceof File) {
            receiptUrl = 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf'
          } else if (form.receiptUrl && form.receiptUrl.trim()) {
            receiptUrl = form.receiptUrl.trim()
          } else if (form.receiptUrl === '' && row.receipt_url && String(row.receipt_url).startsWith('http')) {
            receiptUrl = null
          }
          const expenseType = form.expenseType || null
          const jobId = form.jobId || null
          const isPayroll = expenseType === 'Payroll'
          const payload = {
            job_id: jobId,
            expense_type: expenseType,
            is_payroll: isPayroll,
            receipt_url: receiptUrl,
            notes: form.notes?.trim() || null,
          }
          const list = loadDemoBankRowsFromSession()
          const next = list.map((r) => (r.id === row.id ? { ...r, ...payload } : r))
          persistDemoBankRows(next)
          setTransactions(next)
          return true
        } catch (e) {
          setSaveError(e instanceof Error ? e.message : 'Save failed')
          return false
        } finally {
          setSavingId(null)
        }
      }
      if (!userId || !supabase) {
        setSaveError('Supabase is not configured')
        return false
      }
      setSaveError(null)
      setSavingId(row.id)
      try {
        let receiptUrl = row.receipt_url ?? null

        if (form.receiptFile && form.receiptFile instanceof File) {
          const safeName = form.receiptFile.name.replace(/[^a-zA-Z0-9._-]/g, '_')
          const path = `${userId}/${row.id}/${safeName}`
          const { error: upErr } = await supabase.storage
            .from('bank-receipts')
            .upload(path, form.receiptFile, { upsert: true })
          if (upErr) throw upErr
          receiptUrl = path
        } else if (form.receiptUrl && form.receiptUrl.trim()) {
          receiptUrl = form.receiptUrl.trim()
        } else if (form.receiptUrl === '' && row.receipt_url && String(row.receipt_url).startsWith('http')) {
          receiptUrl = null
        }

        const expenseType = form.expenseType || null
        const jobId = form.jobId || null
        const isPayroll = expenseType === 'Payroll'

        const payload = {
          job_id: jobId,
          expense_type: expenseType,
          is_payroll: isPayroll,
          receipt_url: receiptUrl,
          notes: form.notes?.trim() || null,
        }

        const { data: existing } = await supabase
          .from('bank_transactions')
          .select('id')
          .eq('id', row.id)
          .eq('user_id', userId)
          .maybeSingle()

        if (existing) {
          const { error } = await supabase.from('bank_transactions').update(payload).eq('id', row.id).eq('user_id', userId)
          if (error) throw error
        } else {
          const insertRow = {
            id: row.id,
            user_id: userId,
            account_id: row.account_id,
            merchant_name: row.merchant_name,
            amount: row.amount,
            is_debit: row.is_debit,
            transaction_date: row.transaction_date,
            created_at: row.created_at || new Date().toISOString(),
            ...payload,
          }
          const { error } = await supabase.from('bank_transactions').insert(insertRow)
          if (error) throw error
        }

        await fetchTransactions()
        return true
      } catch (e) {
        setSaveError(e instanceof Error ? e.message : 'Save failed')
        return false
      } finally {
        setSavingId(null)
      }
    },
    [userId, fetchTransactions],
  )

  return {
    transactions,
    loading,
    loadError,
    jobs,
    jobsLoading,
    metrics,
    filterTab,
    setFilterTab,
    searchQuery,
    setSearchQuery,
    grouped,
    filteredRows,
    saveTransaction,
    saveError,
    setSaveError,
    savingId,
    refresh: syncAndRefresh,
  }
}
