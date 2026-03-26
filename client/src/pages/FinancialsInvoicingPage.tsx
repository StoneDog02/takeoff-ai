import { Suspense, lazy } from 'react'
import { LoadingSkeleton } from '@/components/LoadingSkeleton'

const EstimatesPage = lazy(() =>
  import('@/pages/EstimatesPage').then((m) => ({ default: m.EstimatesPage })),
)

export function FinancialsInvoicingPage() {
  return (
    <div className="dashboard-app revenue-page min-h-full">
      <div className="w-full max-w-[1600px] mx-auto px-6 sm:px-8 lg:px-10 pb-12">
        <Suspense
          fallback={
            <div className="py-8">
              <LoadingSkeleton variant="page" className="min-h-[30vh]" />
            </div>
          }
        >
          <EstimatesPage embedded />
        </Suspense>
      </div>
    </div>
  )
}
