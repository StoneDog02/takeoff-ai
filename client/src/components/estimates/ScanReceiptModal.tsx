import { useState, useRef } from 'react'
import { estimatesApi } from '@/api/estimates'
import type { Job, JobExpense } from '@/types/global'
import type { ExpenseCategory } from '@/types/global'

const CATEGORY_OPTIONS: { value: ExpenseCategory; label: string }[] = [
  { value: 'materials', label: 'Materials' },
  { value: 'labor', label: 'Labor' },
  { value: 'equipment', label: 'Equipment' },
  { value: 'subs', label: 'Subs' },
  { value: 'misc', label: 'Other' },
]

const CAT_MAP: Record<string, ExpenseCategory> = {
  Materials: 'materials',
  Labor: 'labor',
  Equipment: 'equipment',
  Subs: 'subs',
  Other: 'misc',
}

interface ScanReceiptModalProps {
  jobs: Job[]
  defaultJobId: string
  onClose: () => void
  onAdd: (expense: Omit<JobExpense, 'id' | 'created_at'> & { id: number; created_at: string }) => void
}

export function ScanReceiptModal({
  jobs,
  defaultJobId,
  onClose,
  onAdd,
}: ScanReceiptModalProps) {
  const [stage, setStage] = useState<'idle' | 'scanning' | 'review' | 'manual'>('idle')
  const [dragOver, setDragOver] = useState(false)
  const [preview, setPreview] = useState<string | null>(null)
  const [scanned, setScanned] = useState<{
    vendor?: string
    date?: string
    total?: number
    description?: string
    category?: string
  } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({
    date: '',
    category: 'materials' as ExpenseCategory,
    description: '',
    job: defaultJobId,
    amount: '',
    billable: true,
    vendor: '',
  })
  const fileRef = useRef<HTMLInputElement>(null)

  const scanImage = async (base64: string, mediaType: string) => {
    setStage('scanning')
    setError(null)
    try {
      const parsed = await estimatesApi.scanReceipt({
        image_base64: base64,
        media_type: mediaType,
        job_id: defaultJobId || undefined,
      })
      setScanned(parsed)
      const category = (parsed.category && CAT_MAP[parsed.category]) || 'materials'
      setForm((f) => ({
        ...f,
        vendor: parsed.vendor ?? '',
        date: parsed.date ?? '',
        description: parsed.description ?? '',
        amount: parsed.total != null ? String(parsed.total) : '',
        category,
      }))
      setStage('review')
    } catch {
      setError("Couldn't read the receipt. You can fill it in manually below.")
      setStage('manual')
    }
  }

  const handleFile = (file: File | null) => {
    if (!file || !file.type.startsWith('image/')) return
    const reader = new FileReader()
    reader.onload = (e) => {
      const dataUrl = (e.target?.result as string) ?? ''
      setPreview(dataUrl)
      const base64 = dataUrl.split(',')[1]
      if (base64) scanImage(base64, file.type)
    }
    reader.readAsDataURL(file)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    handleFile(e.dataTransfer.files[0] ?? null)
  }

  const handleSave = () => {
    if (!form.description?.trim() || !form.amount) return
    const created_at = form.date || new Date().toISOString().slice(0, 10)
    onAdd({
      id: Date.now(),
      job_id: form.job,
      amount: parseFloat(form.amount),
      category: form.category,
      description: form.description.trim(),
      billable: form.billable,
      vendor: form.vendor.trim() || undefined,
      created_at,
    })
    onClose()
  }

  const valid = !!form.description?.trim() && !!form.amount

  return (
    <div
      className="receipt-scan-modal-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="scan-receipt-title"
    >
      <div className="receipt-scan-modal" onClick={(e) => e.stopPropagation()}>
        <div className="receipt-scan-modal__header">
          <div>
            <div className="receipt-scan-modal__eyebrow">AI-Powered</div>
            <h2 id="scan-receipt-title" className="receipt-scan-modal__title">
              Scan Receipt
            </h2>
          </div>
          <button
            type="button"
            className="receipt-scan-modal__close"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div
          className={`receipt-scan-modal__body ${preview ? 'receipt-scan-modal__body--split' : ''}`}
        >
          {preview && (
            <div className="receipt-scan-modal__preview">
              <img src={preview} alt="Receipt" className="receipt-scan-modal__preview-img" />
              <button
                type="button"
                className="receipt-scan-modal__rescan"
                onClick={() => {
                  setPreview(null)
                  setStage('idle')
                  setScanned(null)
                }}
              >
                Scan different photo
              </button>
            </div>
          )}

          <div className="receipt-scan-modal__content">
            {stage === 'idle' && (
              <div
                className={`receipt-scan-dropzone ${dragOver ? 'receipt-scan-dropzone--active' : ''}`}
                onDragOver={(e) => {
                  e.preventDefault()
                  setDragOver(true)
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileRef.current?.click()}
              >
                <div className="receipt-scan-dropzone__title">Drop a receipt photo here</div>
                <div className="receipt-scan-dropzone__sub">or tap to choose from camera roll</div>
                <span className="receipt-scan-dropzone__btn">Choose Photo</span>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="receipt-scan-dropzone__input"
                  onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
                />
              </div>
            )}

            {stage === 'scanning' && (
              <div className="receipt-scan-scanning">
                <div className="receipt-scan-spinner" />
                <div className="receipt-scan-scanning__title">Reading your receipt…</div>
                <div className="receipt-scan-scanning__sub">Extracting vendor, items, and total</div>
              </div>
            )}

            {(stage === 'review' || stage === 'manual') && (
              <div className="receipt-scan-form">
                {stage === 'review' && scanned && (
                  <div className="receipt-scan-success-banner">
                    <span className="receipt-scan-success-banner__icon">✓</span>
                    <div>
                      <div className="receipt-scan-success-banner__title">Receipt scanned successfully</div>
                      <div className="receipt-scan-success-banner__sub">Fields pre-filled — review and confirm below</div>
                    </div>
                  </div>
                )}
                {error && (
                  <div className="receipt-scan-error-banner">{error}</div>
                )}

                <div className="receipt-scan-form-grid">
                  <div className="receipt-scan-field">
                    <label className="receipt-scan-label">Vendor</label>
                    <input
                      value={form.vendor}
                      onChange={(e) => setForm((f) => ({ ...f, vendor: e.target.value }))}
                      placeholder="Store name"
                      className="receipt-scan-input"
                    />
                  </div>
                  <div className="receipt-scan-field">
                    <label className="receipt-scan-label">Date</label>
                    <input
                      value={form.date}
                      onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                      placeholder="MM/DD/YYYY"
                      className="receipt-scan-input"
                    />
                  </div>
                  <div className="receipt-scan-field receipt-scan-field--full">
                    <label className="receipt-scan-label">Description</label>
                    <input
                      value={form.description}
                      onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                      placeholder="What was this for?"
                      className="receipt-scan-input"
                    />
                  </div>
                  <div className="receipt-scan-field">
                    <label className="receipt-scan-label">Category</label>
                    <select
                      value={form.category}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, category: e.target.value as ExpenseCategory }))
                      }
                      className="receipt-scan-input"
                    >
                      {CATEGORY_OPTIONS.map((c) => (
                        <option key={c.value} value={c.value}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="receipt-scan-field">
                    <label className="receipt-scan-label">Amount</label>
                    <div className="receipt-scan-amount-wrap">
                      <span className="receipt-scan-amount-prefix">$</span>
                      <input
                        type="number"
                        value={form.amount}
                        onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                        className="receipt-scan-input receipt-scan-input--amount"
                      />
                    </div>
                  </div>
                  <div className="receipt-scan-field">
                    <label className="receipt-scan-label">Job</label>
                    <select
                      value={form.job}
                      onChange={(e) => setForm((f) => ({ ...f, job: e.target.value }))}
                      className="receipt-scan-input"
                    >
                      {jobs.map((j) => (
                        <option key={j.id} value={j.id}>
                          {j.name.split('–')[0].trim()}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="receipt-scan-field receipt-scan-field--billable">
                    <button
                      type="button"
                      className="receipt-scan-billable-row"
                      onClick={() => setForm((f) => ({ ...f, billable: !f.billable }))}
                    >
                      <div
                        className={`receipt-scan-toggle ${form.billable ? 'receipt-scan-toggle--on' : ''}`}
                      >
                        <span className="receipt-scan-toggle-thumb" />
                      </div>
                      <div>
                        <div className="receipt-scan-billable-title">Billable to client</div>
                        <div className="receipt-scan-billable-sub">Include in next invoice</div>
                      </div>
                    </button>
                  </div>
                </div>

                <button
                  type="button"
                  className="receipt-scan-save-btn"
                  onClick={handleSave}
                  disabled={!valid}
                >
                  Log Expense →
                </button>
              </div>
            )}

            {stage === 'idle' && (
              <button
                type="button"
                className="receipt-scan-skip"
                onClick={() => setStage('manual')}
              >
                Skip scan — enter manually
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
