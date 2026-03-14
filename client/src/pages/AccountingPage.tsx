import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { BarChart2, Link2 } from 'lucide-react'
import { quickbooksApi } from '@/api/quickbooks'
import type { QuickBooksCompanyInfo } from '@/api/quickbooks'
import { LoadingSkeleton } from '@/components/LoadingSkeleton'

const fmt = (n: number) =>
  '$' + Number(n ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

interface QBInvoice {
  Id?: string
  DocNumber?: string
  TxnDate?: string
  DueDate?: string
  TotalAmt?: number
  Balance?: number
  CustomerRef?: { name?: string; value?: string }
  EmailStatus?: string
  PrintStatus?: string
}

interface QBPurchase {
  Id?: string
  TxnDate?: string
  TotalAmt?: number
  PrivateNote?: string
  EntityRef?: { name?: string; value?: string }
  AccountRef?: { name?: string }
}

export function AccountingPage() {
  const [company, setCompany] = useState<QuickBooksCompanyInfo | null>(null)
  const [invoices, setInvoices] = useState<QBInvoice[]>([])
  const [purchases, setPurchases] = useState<QBPurchase[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notConnected, setNotConnected] = useState(false)
  const [chargeAmount, setChargeAmount] = useState('')
  const [chargeToken, setChargeToken] = useState('')
  const [chargeLoading, setChargeLoading] = useState(false)
  const [chargeResult, setChargeResult] = useState<{ success?: boolean; message?: string } | null>(null)

  useEffect(() => {
    let cancelled = false
    setError(null)
    setNotConnected(false)
    Promise.all([
      quickbooksApi.getCompany(),
      quickbooksApi.getInvoices(),
      quickbooksApi.getPurchases(),
    ])
      .then(([companyRes, invoicesRes, purchasesRes]) => {
        if (cancelled) return
        setCompany(companyRes)
        const invList = (invoicesRes?.QueryResponse?.Invoice ?? []) as QBInvoice[]
        const purchList = (purchasesRes?.QueryResponse?.Purchase ?? []) as QBPurchase[]
        setInvoices(invList)
        setPurchases(purchList)
      })
      .catch((e) => {
        if (cancelled) return
        const msg = e instanceof Error ? e.message : 'Failed to load QuickBooks data'
        setError(msg)
        if (msg.toLowerCase().includes('not connected') || msg.includes('403')) {
          setNotConnected(true)
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [])

  if (loading) {
    return (
      <div className="dashboard-app min-h-full">
        <div className="w-full max-w-[1200px] mx-auto px-6 py-8">
          <div className="mb-6">
            <div className="text-sm text-gray-500 dark:text-gray-400">Finance</div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Accounting</h1>
          </div>
          <div className="py-12">
            <LoadingSkeleton variant="page" className="min-h-[30vh]" />
          </div>
        </div>
      </div>
    )
  }

  if (notConnected || error) {
    return (
      <div className="dashboard-app min-h-full">
        <div className="w-full max-w-[1200px] mx-auto px-6 py-8">
          <div className="mb-6">
            <div className="text-sm text-gray-500 dark:text-gray-400">Finance</div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Accounting</h1>
          </div>
          <div
            className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-8 text-center"
            style={{ maxWidth: 480, margin: '0 auto' }}
          >
            <div className="w-14 h-14 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center mx-auto mb-4">
              <BarChart2 className="w-7 h-7 text-gray-500 dark:text-gray-400" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Connect QuickBooks
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-6">
              {error || 'Link your QuickBooks account to view company info, invoices, and expenses here.'}
            </p>
            <Link
              to="/settings"
              className="inline-flex items-center gap-2 rounded-lg bg-[#b91c1c] text-white px-5 py-2.5 text-sm font-medium hover:opacity-90"
            >
              <Link2 className="w-4 h-4" />
              Go to Settings → Integrations
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const companyName =
    company?.CompanyInfo?.CompanyName ?? company?.CompanyInfo?.LegalName ?? 'QuickBooks'

  const handleCollectPayment = async () => {
    const amount = chargeAmount.trim()
    const token = chargeToken.trim()
    if (!amount || !token) {
      setChargeResult({ success: false, message: 'Enter amount and payment token.' })
      return
    }
    setChargeLoading(true)
    setChargeResult(null)
    try {
      await quickbooksApi.createCharge({
        amount,
        currency: 'USD',
        token,
      })
      setChargeResult({ success: true, message: 'Charge submitted successfully.' })
      setChargeAmount('')
      setChargeToken('')
    } catch (e) {
      setChargeResult({
        success: false,
        message: e instanceof Error ? e.message : 'Charge failed.',
      })
    } finally {
      setChargeLoading(false)
    }
  }

  return (
    <div className="dashboard-app min-h-full">
      <div className="w-full max-w-[1200px] mx-auto px-6 py-8">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="text-sm text-gray-500 dark:text-gray-400">Finance</div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Accounting</h1>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{companyName}</p>
          </div>
        </div>

        {/* QuickBooks Payments: Collect payment */}
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden mb-6">
          <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700">
            <h2 className="font-semibold text-gray-900 dark:text-white">Collect payment</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Charge a card via QuickBooks Payments. Use a payment token from Intuit&apos;s client-side tokenization, then enter amount and token here.
            </p>
          </div>
          <div className="px-5 py-4 flex flex-wrap items-end gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Amount (USD)</label>
              <input
                type="text"
                placeholder="0.00"
                value={chargeAmount}
                onChange={(e) => setChargeAmount(e.target.value)}
                className="rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white w-32"
              />
            </div>
            <div className="flex-1 min-w-[200px]">
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Payment token</label>
              <input
                type="text"
                placeholder="Token from Intuit tokenization"
                value={chargeToken}
                onChange={(e) => setChargeToken(e.target.value)}
                className="rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white w-full"
              />
            </div>
            <button
              type="button"
              onClick={handleCollectPayment}
              disabled={chargeLoading}
              className="rounded-lg bg-[#b91c1c] text-white px-4 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50"
            >
              {chargeLoading ? 'Charging…' : 'Charge'}
            </button>
          </div>
          {chargeResult && (
            <div
              className={`mx-5 mb-4 px-3 py-2 rounded-lg text-sm ${chargeResult.success ? 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200' : 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200'}`}
            >
              {chargeResult.message}
            </div>
          )}
        </div>

        {/* Invoices */}
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden mb-6">
          <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700">
            <h2 className="font-semibold text-gray-900 dark:text-white">Invoices</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">Recent invoices from QuickBooks</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-700/50 text-left text-gray-600 dark:text-gray-300">
                  <th className="px-5 py-3 font-medium">Number</th>
                  <th className="px-5 py-3 font-medium">Customer</th>
                  <th className="px-5 py-3 font-medium">Date</th>
                  <th className="px-5 py-3 font-medium text-right">Total</th>
                  <th className="px-5 py-3 font-medium text-right">Balance</th>
                </tr>
              </thead>
              <tbody>
                {invoices.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-5 py-8 text-center text-gray-500 dark:text-gray-400">
                      No invoices found
                    </td>
                  </tr>
                ) : (
                  invoices.map((inv) => (
                    <tr
                      key={inv.Id ?? inv.DocNumber ?? Math.random()}
                      className="border-t border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/30"
                    >
                      <td className="px-5 py-3 font-medium text-gray-900 dark:text-white">
                        {inv.DocNumber ?? '—'}
                      </td>
                      <td className="px-5 py-3 text-gray-700 dark:text-gray-300">
                        {inv.CustomerRef?.name ?? inv.CustomerRef?.value ?? '—'}
                      </td>
                      <td className="px-5 py-3 text-gray-600 dark:text-gray-400">
                        {inv.TxnDate ?? '—'}
                      </td>
                      <td className="px-5 py-3 text-right font-medium text-gray-900 dark:text-white">
                        {inv.TotalAmt != null ? fmt(inv.TotalAmt) : '—'}
                      </td>
                      <td className="px-5 py-3 text-right text-gray-600 dark:text-gray-400">
                        {inv.Balance != null ? fmt(inv.Balance) : '—'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Purchases / Expenses */}
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700">
            <h2 className="font-semibold text-gray-900 dark:text-white">Purchases &amp; Expenses</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">Recent purchases from QuickBooks</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-700/50 text-left text-gray-600 dark:text-gray-300">
                  <th className="px-5 py-3 font-medium">Date</th>
                  <th className="px-5 py-3 font-medium">Vendor / Payee</th>
                  <th className="px-5 py-3 font-medium text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {purchases.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-5 py-8 text-center text-gray-500 dark:text-gray-400">
                      No purchases found
                    </td>
                  </tr>
                ) : (
                  purchases.map((p) => (
                    <tr
                      key={p.Id ?? p.TxnDate ?? Math.random()}
                      className="border-t border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/30"
                    >
                      <td className="px-5 py-3 text-gray-600 dark:text-gray-400">
                        {p.TxnDate ?? '—'}
                      </td>
                      <td className="px-5 py-3 text-gray-700 dark:text-gray-300">
                        {p.EntityRef?.name ?? p.EntityRef?.value ?? p.PrivateNote ?? '—'}
                      </td>
                      <td className="px-5 py-3 text-right font-medium text-gray-900 dark:text-white">
                        {p.TotalAmt != null ? fmt(p.TotalAmt) : '—'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
