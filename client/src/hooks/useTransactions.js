import { useState, useEffect, useMemo, useCallback } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { dayjs } from '@/lib/date'

/** Matches DB check constraint on public.bank_transactions.expense_type */
export const EXPENSE_TYPES = [
  'Materials',
  'Subcontractor',
  'Equipment',
  'Labor',
  'Overhead',
  'Payroll',
]

/** Fixed UUIDs so mock rows can be upserted to Supabase by id */
const MOCK_TRANSACTIONS = [
  {
    id: 'a1000000-0000-4000-8000-000000000001',
    account_id: 'fca_mock_checking_01',
    merchant_name: 'Home Depot',
    amount: 1240.55,
    is_debit: true,
    transaction_date: dayjs().subtract(2, 'day').format('YYYY-MM-DD'),
    job_id: null,
    expense_type: null,
    is_payroll: false,
    receipt_url: null,
    notes: null,
    created_at: new Date().toISOString(),
  },
  {
    id: 'a1000000-0000-4000-8000-000000000002',
    account_id: 'fca_mock_checking_01',
    merchant_name: 'Acme Drywall Supply',
    amount: 890,
    is_debit: true,
    transaction_date: dayjs().subtract(5, 'day').format('YYYY-MM-DD'),
    job_id: null,
    expense_type: 'Materials',
    is_payroll: false,
    receipt_url: null,
    notes: null,
    created_at: new Date().toISOString(),
  },
  {
    id: 'a1000000-0000-4000-8000-000000000003',
    account_id: 'fca_mock_checking_01',
    merchant_name: 'Client Deposit — Smith Remodel',
    amount: 15000,
    is_debit: false,
    transaction_date: dayjs().subtract(1, 'day').format('YYYY-MM-DD'),
    job_id: null,
    expense_type: null,
    is_payroll: false,
    receipt_url: null,
    notes: null,
    created_at: new Date().toISOString(),
  },
  {
    id: 'a1000000-0000-4000-8000-000000000004',
    account_id: 'fca_mock_card_02',
    merchant_name: 'Shell',
    amount: 64.2,
    is_debit: true,
    transaction_date: dayjs().subtract(8, 'day').format('YYYY-MM-DD'),
    job_id: null,
    expense_type: null,
    is_payroll: false,
    receipt_url: 'https://example.com/receipts/shell-demo.pdf',
    notes: null,
    created_at: new Date().toISOString(),
  },
  {
    id: 'a1000000-0000-4000-8000-000000000005',
    account_id: 'fca_mock_card_02',
    merchant_name: 'Sunrise Equipment Rental',
    amount: 425,
    is_debit: true,
    transaction_date: dayjs().subtract(12, 'day').format('YYYY-MM-DD'),
    job_id: null,
    expense_type: 'Equipment',
    is_payroll: false,
    receipt_url: null,
    notes: null,
    created_at: new Date().toISOString(),
  },
  {
    id: 'a1000000-0000-4000-8000-000000000006',
    account_id: 'fca_mock_checking_01',
    merchant_name: 'Payroll — ADP',
    amount: 8420,
    is_debit: true,
    transaction_date: dayjs().subtract(14, 'day').format('YYYY-MM-DD'),
    job_id: null,
    expense_type: 'Payroll',
    is_payroll: true,
    receipt_url: null,
    notes: null,
    created_at: new Date().toISOString(),
  },
  {
    id: 'a1000000-0000-4000-8000-000000000007',
    account_id: 'fca_mock_checking_01',
    merchant_name: 'City Lumber',
    amount: 2103.4,
    is_debit: true,
    transaction_date: dayjs().subtract(3, 'day').format('YYYY-MM-DD'),
    job_id: null,
    expense_type: null,
    is_payroll: false,
    receipt_url: null,
    notes: null,
    created_at: new Date().toISOString(),
  },
  {
    id: 'a1000000-0000-4000-8000-000000000008',
    account_id: 'fca_mock_card_02',
    merchant_name: 'Uber',
    amount: 24.5,
    is_debit: true,
    transaction_date: dayjs().subtract(20, 'day').format('YYYY-MM-DD'),
    job_id: null,
    expense_type: 'Overhead',
    is_payroll: false,
    receipt_url: null,
    notes: null,
    created_at: new Date().toISOString(),
  },
]

const MOCK_IDS = new Set(MOCK_TRANSACTIONS.map((r) => r.id))

export function isTagged(row) {
  return row.job_id != null && row.expense_type != null && String(row.expense_type).length > 0
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
  const taggedDebits = debitsMonth.filter((r) => isTagged(r))
  const untaggedDebits = debitsMonth.filter((r) => !isTagged(r))
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
    list = list.filter((r) => !isTagged(r))
  } else if (filterTab === 'tagged') {
    list = list.filter((r) => isTagged(r))
  } else if (filterTab === 'missing_receipt') {
    list = list.filter((r) => r.is_debit && !r.receipt_url)
  }
  return list
}

function mergeWithMock(dbRows) {
  const dbById = new Map((dbRows || []).map((r) => [r.id, r]))
  const merged = MOCK_TRANSACTIONS.map((mock) => {
    const saved = dbById.get(mock.id)
    return saved ? { ...mock, ...saved } : { ...mock }
  })
  for (const row of dbRows || []) {
    if (!MOCK_IDS.has(row.id)) merged.push(row)
  }
  merged.sort((a, b) => String(b.transaction_date).localeCompare(String(a.transaction_date)))
  return merged
}

/**
 * Bank transactions list: mock seed merged with Supabase rows (swap `loadTransactions` for Financial Connections later).
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

  const loadTransactions = useCallback(async () => {
    if (!userId || !supabase) {
      setTransactions(MOCK_TRANSACTIONS)
      setLoading(false)
      return
    }
    setLoading(true)
    setLoadError(null)
    const { data, error } = await supabase
      .from('bank_transactions')
      .select('*')
      .eq('user_id', userId)
      .order('transaction_date', { ascending: false })

    if (error) {
      setLoadError(error.message)
      setTransactions(mergeWithMock([]))
    } else {
      setTransactions(mergeWithMock(data || []))
    }
    setLoading(false)
  }, [userId])

  const loadJobs = useCallback(async () => {
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
    loadTransactions()
  }, [loadTransactions])

  useEffect(() => {
    loadJobs()
  }, [loadJobs])

  const metrics = useMemo(() => computeMetrics(transactions), [transactions])

  const filteredRows = useMemo(
    () => applySearchAndTab(transactions, filterTab, searchQuery),
    [transactions, filterTab, searchQuery],
  )

  const grouped = useMemo(() => {
    const needsTagging = filteredRows.filter((r) => !isTagged(r))
    const tagged = filteredRows.filter((r) => isTagged(r))
    return { needsTagging, tagged }
  }, [filteredRows])

  const saveTransaction = useCallback(
    async (row, form) => {
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

        await loadTransactions()
        return true
      } catch (e) {
        setSaveError(e instanceof Error ? e.message : 'Save failed')
        return false
      } finally {
        setSavingId(null)
      }
    },
    [userId, loadTransactions],
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
    refresh: loadTransactions,
  }
}
