import { FinancialsTransactions } from '@/components/FinancialsTransactions'

export function FinancialsTransactionsPage() {
  return (
    <div className="dashboard-app revenue-page min-h-full">
      <div className="w-full max-w-[1600px] mx-auto px-6 sm:px-8 lg:px-10 pb-12">
        <FinancialsTransactions />
      </div>
    </div>
  )
}
