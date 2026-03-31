import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { api, type InvoicePortalResponse } from '@/api/client'
import {
  InvoiceClientFacing,
  invoicePortalShellClassAndStyle,
} from '@/components/invoices/InvoiceClientFacing'

function LoadingSpinner() {
  return (
    <div className="estimate-portal-loading">
      <div className="estimate-portal-spinner" aria-label="Loading">
        <div className="estimate-portal-spinner__dot" />
        <div className="estimate-portal-spinner__dot" />
        <div className="estimate-portal-spinner__dot" />
      </div>
    </div>
  )
}

/**
 * Public invoice page at /invoice/:token — milestone schedule for progress invoices, or line items for simple invoices.
 */
export function InvoicePortal() {
  const { token } = useParams<{ token: string }>()
  const [data, setData] = useState<InvoicePortalResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const viewedFiredRef = useRef(false)

  useEffect(() => {
    if (!token) {
      setError('Invalid or missing link.')
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    setError(null)
    api.invoicePortal
      .get(token)
      .then((res) => {
        if (cancelled) return
        setData(res)
        setError(null)
        if (!viewedFiredRef.current) {
          viewedFiredRef.current = true
          api.invoicePortal.markViewed(token).catch(() => {})
        }
      })
      .catch((err) => {
        if (cancelled) return
        setError(err instanceof Error ? err.message : 'Invalid or expired link.')
        setData(null)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [token])

  const shell = data
    ? invoicePortalShellClassAndStyle(data)
    : {
        className: 'invoice-portal--tpl-standard',
        style: {
          ['--invoice-accent' as string]: '#b91c1c',
          ['--invoice-accent-secondary' as string]: '#1e293b',
        },
      }

  return (
    <div
      className={`estimate-portal estimate-portal--page invoice-portal ${shell.className}`}
      style={shell.style}
    >
      <div className="estimate-portal__inner">
        {loading && <LoadingSpinner />}
        {error && !loading && (
          <div className="estimate-portal-card">
            <div className="estimate-portal-card__body">
              <h2 className="estimate-portal-title">Invalid or expired link</h2>
              <p className="estimate-portal-message">{error}</p>
            </div>
          </div>
        )}

        {data && !loading && <InvoiceClientFacing data={data} interactiveSchedule />}
      </div>
      <footer className="estimate-portal-footer">
        <span className="estimate-portal-footer__text">Powered by BuildOS</span>
      </footer>
    </div>
  )
}
