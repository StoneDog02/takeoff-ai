import { useState, useRef, useMemo, useCallback, useEffect } from 'react'
import type { JobWalkMedia } from '@/types/global'
import { formatDate, formatShortDate, dayjs } from '@/lib/date'

const PH_PLACEHOLDERS = ['ph-1', 'ph-2', 'ph-3', 'ph-4', 'ph-5'] as const

interface JobWalkGalleryProps {
  projectId: string
  projectName?: string
  media: JobWalkMedia[]
  onUpload: (file: File, uploaderName?: string, caption?: string) => Promise<void>
  onDelete?: (mediaId: string) => Promise<void>
  onRefresh: () => void
}

type ViewMode = 'grid' | 'list'
type FilterKey = 'all' | 'photo' | 'video' | string

interface WalkGroup {
  walkId: string
  walkLabel: string
  dateLabel: string
  dateSort: string
  items: JobWalkMedia[]
}

function getWalkId(m: JobWalkMedia): string {
  if (!m.uploaded_at) return 'unknown'
  return dayjs(m.uploaded_at).format('YYYY-MM-DD')
}

function getPh(index: number): (typeof PH_PLACEHOLDERS)[number] {
  return PH_PLACEHOLDERS[index % PH_PLACEHOLDERS.length]
}

export function JobWalkGallery({
  projectId: _projectId,
  projectName,
  media,
  onUpload,
  onDelete,
  onRefresh,
}: JobWalkGalleryProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [filter, setFilter] = useState<FilterKey>('all')
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)
  const [uploadModalOpen, setUploadModalOpen] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploaderName, setUploaderName] = useState('')
  const [uploadCaption, setUploadCaption] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const walkGroups = useMemo(() => {
    const byWalk = new Map<string, { dateSort: string; dateLabel: string; items: JobWalkMedia[] }>()
    media.forEach((m) => {
      const walkId = getWalkId(m)
      const d = m.uploaded_at ? dayjs(m.uploaded_at) : null
      const dateSort = d ? d.format('YYYY-MM-DD') : ''
      const dateLabel = d ? formatDate(m.uploaded_at) : '—'
      if (!byWalk.has(walkId)) {
        byWalk.set(walkId, { dateSort, dateLabel, items: [] })
      }
      byWalk.get(walkId)!.items.push(m)
    })
    const entries = Array.from(byWalk.entries()).sort((a, b) => b[1].dateSort.localeCompare(a[1].dateSort))
    return entries.map(([walkId, data], i) => ({
      walkId,
      walkLabel: `Walk ${i + 1} — ${data.dateLabel}`,
      dateLabel: data.dateLabel,
      dateSort: data.dateSort,
      items: data.items,
    })) as WalkGroup[]
  }, [media])

  const filteredMedia = useMemo(() => {
    if (filter === 'all') return media
    if (filter === 'photo' || filter === 'video') return media.filter((m) => m.type === filter)
    return media.filter((m) => getWalkId(m) === filter)
  }, [media, filter])

  const filteredWalkGroups = useMemo(() => {
    return walkGroups
      .map((g) => ({ ...g, items: g.items.filter((m) => filteredMedia.some((f) => f.id === m.id)) }))
      .filter((g) => g.items.length > 0)
  }, [walkGroups, filteredMedia])

  const photoCount = media.filter((m) => m.type === 'photo').length
  const videoCount = media.filter((m) => m.type === 'video').length
  const lastUpdated = media.length
    ? media.reduce((latest, m) => {
        if (!m.uploaded_at) return latest
        const t = dayjs(m.uploaded_at).valueOf()
        return t > latest ? t : latest
      }, 0)
    : null
  const lastUpdatedBy = lastUpdated
    ? media.find((m) => m.uploaded_at && dayjs(m.uploaded_at).valueOf() === lastUpdated)?.uploader_name
    : null

  const openUpload = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const handleFileSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      e.target.value = ''
      if (!file || (!file.type.startsWith('image/') && !file.type.startsWith('video/'))) return
      setUploading(true)
      try {
        await onUpload(file, uploaderName || undefined, uploadCaption || undefined)
        onRefresh()
        setUploadModalOpen(false)
        setUploadCaption('')
      } finally {
        setUploading(false)
      }
    },
    [onUpload, onRefresh, uploaderName, uploadCaption]
  )

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDragOver(false)
      const file = e.dataTransfer.files[0]
      if (file) {
        if (file.type.startsWith('image/') || file.type.startsWith('video/')) {
          setUploading(true)
          onUpload(file, uploaderName || undefined, uploadCaption || undefined).then(() => {
            onRefresh()
            setUploading(false)
          })
        }
      }
    },
    [onUpload, onRefresh, uploaderName, uploadCaption]
  )

  const openLightbox = useCallback((index: number) => {
    setLightboxIndex(index)
  }, [])

  const closeLightbox = useCallback(() => {
    setLightboxIndex(null)
  }, [])

  const lightboxItem = lightboxIndex != null ? filteredMedia[lightboxIndex] : null

  const lbPrev = useCallback(() => {
    if (lightboxIndex == null) return
    setLightboxIndex((filteredMedia.length + lightboxIndex - 1) % filteredMedia.length)
  }, [lightboxIndex, filteredMedia.length])

  const lbNext = useCallback(() => {
    if (lightboxIndex == null) return
    setLightboxIndex((lightboxIndex + 1) % filteredMedia.length)
  }, [lightboxIndex, filteredMedia.length])

  useEffect(() => {
    if (lightboxIndex == null) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeLightbox()
      if (e.key === 'ArrowLeft') lbPrev()
      if (e.key === 'ArrowRight') lbNext()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [lightboxIndex, closeLightbox, lbPrev, lbNext])

  const handleDelete = useCallback(
    async (e: React.MouseEvent, mediaId: string) => {
      e.stopPropagation()
      if (!onDelete) return
      if (!confirm('Remove this item?')) return
      await onDelete(mediaId)
      onRefresh()
      if (lightboxIndex != null && filteredMedia[lightboxIndex]?.id === mediaId) closeLightbox()
    },
    [onDelete, onRefresh, lightboxIndex, filteredMedia, closeLightbox]
  )

  const mediaName = (m: JobWalkMedia) => m.caption || (m.type === 'video' ? 'Video' : 'Photo')

  return (
    <div className="media-tab">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*"
        className="sr-only"
        onChange={handleFileSelect}
      />

      {/* Header */}
      <div className="media-tab-header">
        <div className="media-tab-header-left">
          <div className="media-tab-title">Job Walk Media</div>
          <div className="media-tab-sub">
            {projectName ? (
              <span className="media-tab-sub-project hidden md:inline">{`${projectName} · `}</span>
            ) : null}
            {media.length} item{media.length !== 1 ? 's' : ''} across {walkGroups.length || 1} walk{walkGroups.length !== 1 ? 's' : ''}
          </div>
        </div>
        <div className="media-tab-header-right">
          <div className="view-toggle">
            <button
              type="button"
              className={`view-btn ${viewMode === 'grid' ? 'active' : ''}`}
              onClick={() => setViewMode('grid')}
              title="Grid view"
            >
              <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <rect x={3} y={3} width={7} height={7} />
                <rect x={14} y={3} width={7} height={7} />
                <rect x={3} y={14} width={7} height={7} />
                <rect x={14} y={14} width={7} height={7} />
              </svg>
            </button>
            <button
              type="button"
              className={`view-btn ${viewMode === 'list' ? 'active' : ''}`}
              onClick={() => setViewMode('list')}
              title="List view"
            >
              <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <line x1={8} y1={6} x2={21} y2={6} />
                <line x1={8} y1={12} x2={21} y2={12} />
                <line x1={8} y1={18} x2={21} y2={18} />
                <line x1={3} y1={6} x2={3.01} y2={6} />
                <line x1={3} y1={12} x2={3.01} y2={12} />
                <line x1={3} y1={18} x2={3.01} y2={18} />
              </svg>
            </button>
          </div>
          <button type="button" className="btn btn-primary media-tab-add-btn flex items-center gap-1.5" onClick={() => setUploadModalOpen(true)}>
            <svg className="media-tab-add-icon" width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2.5}>
              <line x1={12} y1={5} x2={12} y2={19} />
              <line x1={5} y1={12} x2={19} y2={12} />
            </svg>
            <span className="media-tab-add-label-full">Add media</span>
            <span className="media-tab-add-label-short">+ Add</span>
          </button>
        </div>
      </div>

      {/* Stats strip */}
      <div className="media-stats-strip">
        <div className="media-stat">
          <div className="media-stat-label">Total Items</div>
          <div className="media-stat-val">{media.length}</div>
          <div className="media-stat-sub">across all walks</div>
        </div>
        <div className="media-stat">
          <div className="media-stat-label">Job Walks</div>
          <div className="media-stat-val">{walkGroups.length || 0}</div>
          <div className="media-stat-sub">by date</div>
        </div>
        <div className="media-stat">
          <div className="media-stat-label">Photos</div>
          <div className="media-stat-val">{photoCount}</div>
          <div className="media-stat-sub">
            {photoCount && lastUpdated ? formatShortDate(media.find((m) => m.type === 'photo')?.uploaded_at) : '—'}
          </div>
        </div>
        <div className="media-stat">
          <div className="media-stat-label">Videos</div>
          <div className="media-stat-val">{videoCount}</div>
          <div className="media-stat-sub">
            {videoCount ? formatShortDate(media.find((m) => m.type === 'video')?.uploaded_at) : '—'}
          </div>
        </div>
        <div className="media-stat media-stat--last-updated">
          <div className="media-stat-label">Last Updated</div>
          <div className="media-stat-val media-stat-val--date">
            {lastUpdated ? formatShortDate(dayjs(lastUpdated).toISOString()) : '—'}
          </div>
          <div className="media-stat-sub">
            {lastUpdated ? lastUpdatedBy || 'by date' : 'No activity'}
          </div>
        </div>
      </div>

      {/* Filter chips */}
      <div className="filter-chips">
        <button type="button" className={`media-chip ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}>
          All
        </button>
        <button type="button" className={`media-chip ${filter === 'photo' ? 'active' : ''}`} onClick={() => setFilter('photo')}>
          <div className="media-chip-dot" style={{ background: 'var(--text-secondary)' }} />
          Photos
        </button>
        <button type="button" className={`media-chip ${filter === 'video' ? 'active' : ''}`} onClick={() => setFilter('video')}>
          <div className="media-chip-dot" style={{ background: 'var(--red, #c23b2a)' }} />
          Videos
        </button>
        <div className="filter-chips-sep hidden md:block" style={{ width: 1, height: 16, background: 'var(--border)', margin: '0 2px' }} />
        <div className="filter-chips-walks max-md:hidden md:contents">
          {walkGroups.map((g) => (
            <button
              key={g.walkId}
              type="button"
              className={`media-chip ${filter === g.walkId ? 'active' : ''}`}
              onClick={() => setFilter(g.walkId)}
            >
              Walk {walkGroups.indexOf(g) + 1} — {formatShortDate(g.dateSort)}
            </button>
          ))}
        </div>
      </div>

      {/* Upload zone */}
      <div
        className={`upload-zone ${dragOver ? 'dragging' : ''}`}
        onClick={() => setUploadModalOpen(true)}
        onDragOver={(e) => {
          e.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
      >
        <div className="upload-icon-wrap">
          <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="var(--blue)" strokeWidth={1.8}>
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1={12} y1={3} x2={12} y2={15} />
          </svg>
        </div>
        <div className="upload-text">
          <div className="upload-text-primary">
            <span className="upload-text-tap md:hidden">Tap to upload</span>
            <span className="upload-text-click hidden md:inline">Click to upload</span>{' '}
            <span className="upload-text-or">or drag & drop</span>
            <span className="upload-text-suffix-desktop hidden md:inline"> files here</span>
          </div>
          <div className="upload-text-secondary">
            Photos/videos grouped by date automatically
          </div>
        </div>
        <div className="upload-types">
          <span className="upload-type-badge">JPG</span>
          <span className="upload-type-badge">PNG</span>
          <span className="upload-type-badge">MP4</span>
          <span className="upload-type-badge">MOV</span>
        </div>
      </div>

      {/* Walk groups */}
      {filteredMedia.length === 0 ? (
        <div className="media-empty">
          <div className="media-empty-icon" aria-hidden>
            <svg width={28} height={28} viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth={1.5}>
              <rect x={3} y={3} width={18} height={18} rx={2} />
              <circle cx={8.5} cy={8.5} r={1.5} />
              <polyline points="21 15 16 10 5 21" />
            </svg>
          </div>
          {media.length === 0 ? (
            <>
              <div className="media-empty-title">No media yet</div>
              <div className="media-empty-sub">
                Add photos or videos from a job walk — they&apos;ll be grouped by date.
              </div>
            </>
          ) : (
            <>
              <div className="media-empty-title">No media found</div>
              <div className="media-empty-sub">Try a different filter or add new media above.</div>
            </>
          )}
        </div>
      ) : (
        filteredWalkGroups.map((group) => {
          const photoN = group.items.filter((i) => i.type === 'photo').length
          const videoN = group.items.filter((i) => i.type === 'video').length
          const countStr = [
            photoN ? `${photoN} photo${photoN !== 1 ? 's' : ''}` : null,
            videoN ? `${videoN} video${videoN !== 1 ? 's' : ''}` : null,
          ]
            .filter(Boolean)
            .join(' · ')
          return (
            <div key={group.walkId} className="walk-group">
              <div className="walk-group-header">
                <div className="walk-group-header-left">
                  <div className="walk-date-badge">
                    <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth={2.5}>
                      <rect x={3} y={4} width={18} height={18} rx={2} />
                      <line x1={16} y1={2} x2={16} y2={6} />
                      <line x1={8} y1={2} x2={8} y2={6} />
                      <line x1={3} y1={10} x2={21} y2={10} />
                    </svg>
                    {group.dateLabel}
                  </div>
                  <div className="walk-group-label">{group.walkLabel}</div>
                  <div className="walk-group-count">{countStr}</div>
                </div>
                <div className="walk-group-header-right">
                  <button type="button" className="btn-sm text-[11.5px]" onClick={() => setUploadModalOpen(true)}>
                    <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                      <line x1={12} y1={5} x2={12} y2={19} />
                      <line x1={5} y1={12} x2={19} y2={12} />
                    </svg>
                    Add to walk
                  </button>
                </div>
              </div>
              {viewMode === 'grid' ? (
                <div className="media-grid">
                  {group.items.map((m) => {
                    const globalIdx = filteredMedia.findIndex((f) => f.id === m.id)
                    const ph = getPh(filteredMedia.indexOf(m))
                    return (
                      <div
                        key={m.id}
                        className="media-card"
                        onClick={() => openLightbox(globalIdx)}
                        onKeyDown={(e) => e.key === 'Enter' && openLightbox(globalIdx)}
                        role="button"
                        tabIndex={0}
                      >
                        {m.type === 'video' ? (
                          <video src={m.url} className={`media-card-img ${ph}`} style={{ aspectRatio: '4/3', objectFit: 'cover' }} />
                        ) : (
                          <img src={m.url} alt={mediaName(m)} className={`media-card-img ${ph}`} />
                        )}
                        <div className="media-card-overlay" />
                        <div className="media-card-hover-overlay">
                          <div className="media-card-action" title="View">
                            <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                              <circle cx={12} cy={12} r={3} />
                            </svg>
                          </div>
                          <div className="media-card-action" title="Download" onClick={(e) => e.stopPropagation()}>
                            <a href={m.url} download target="_blank" rel="noreferrer" className="flex items-center justify-center">
                              <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                <polyline points="7 10 12 15 17 10" />
                                <line x1={12} y1={15} x2={12} y2={3} />
                              </svg>
                            </a>
                          </div>
                          {onDelete && (
                            <div className="media-card-action" title="Delete" onClick={(e) => handleDelete(e as unknown as React.MouseEvent, m.id)}>
                              <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                                <polyline points="3 6 5 6 21 6" />
                                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                                <path d="M10 11v6M14 11v6" />
                              </svg>
                            </div>
                          )}
                        </div>
                        <span className={`media-card-type ${m.type}`}>{m.type === 'video' ? 'VIDEO' : 'PHOTO'}</span>
                        {m.caption && (
                          <div className="media-card-note-tag" title={m.caption}>
                            <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                              <polyline points="14 2 14 8 20 8" />
                            </svg>
                          </div>
                        )}
                        <div className="media-card-footer">
                          <div className="media-card-name">{mediaName(m)}</div>
                          <div className="media-card-meta">
                            {m.uploader_name}
                            <div className="media-card-meta-dot" />
                            {m.uploaded_at ? formatDate(m.uploaded_at) : '—'}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="media-list">
                  {group.items.map((m) => {
                    const globalIdx = filteredMedia.findIndex((f) => f.id === m.id)
                    const ph = getPh(filteredMedia.indexOf(m))
                    return (
                      <div
                        key={m.id}
                        className="media-list-row"
                        onClick={() => openLightbox(globalIdx)}
                        onKeyDown={(e) => e.key === 'Enter' && openLightbox(globalIdx)}
                        role="button"
                        tabIndex={0}
                      >
                        {m.type === 'video' ? (
                          <video src={m.url} className={`media-list-thumb ${ph}`} style={{ objectFit: 'cover' }} />
                        ) : (
                          <img src={m.url} alt="" className={`media-list-thumb ${ph}`} />
                        )}
                        <div className="media-list-info">
                          <div className="media-list-name">{mediaName(m)}</div>
                          <div className="media-list-meta">
                            <span>{m.uploader_name}</span>
                            <span style={{ color: 'var(--border-mid)' }}>·</span>
                            <span>{m.uploaded_at ? formatDate(m.uploaded_at) : '—'}</span>
                          </div>
                          {m.caption && <div className="media-list-note">"{m.caption.slice(0, 80)}{m.caption.length > 80 ? '…' : ''}"</div>}
                        </div>
                        <span className={`media-list-type ${m.type}`}>{m.type === 'video' ? 'VIDEO' : 'PHOTO'}</span>
                        <div className="media-list-actions">
                          <a href={m.url} download className="btn-sm" style={{ padding: '5px 8px' }} onClick={(e) => e.stopPropagation()}>
                            <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                              <polyline points="7 10 12 15 17 10" />
                              <line x1={12} y1={15} x2={12} y2={3} />
                            </svg>
                          </a>
                          {onDelete && (
                            <button
                              type="button"
                              className="btn-sm border-[rgba(194,59,42,0.2)] text-[var(--red)]"
                              style={{ padding: '5px 8px' }}
                              onClick={(e) => handleDelete(e, m.id)}
                            >
                              <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                                <polyline points="3 6 5 6 21 6" />
                                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                              </svg>
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })
      )}

      {/* Lightbox */}
      <div
        className={`lightbox-overlay ${lightboxIndex != null ? 'open' : ''}`}
        onClick={(e) => e.target === e.currentTarget && closeLightbox()}
      >
        <div className="lightbox" onClick={(e) => e.stopPropagation()}>
          <div className="lightbox-header">
            <div>
              <div className="lightbox-title">{lightboxItem ? mediaName(lightboxItem) : ''}</div>
              <div className="lightbox-sub">
                {lightboxItem
                  ? `${lightboxItem.uploaded_at ? formatDate(lightboxItem.uploaded_at) : '—'} · ${lightboxItem.uploader_name} · ${lightboxItem.type === 'video' ? 'Video' : 'Photo'}`
                  : ''}
              </div>
            </div>
            <button type="button" className="lightbox-close" onClick={closeLightbox} aria-label="Close">
              <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <line x1={18} y1={6} x2={6} y2={18} />
                <line x1={6} y1={6} x2={18} y2={18} />
              </svg>
            </button>
          </div>
          <div className="lightbox-img-wrap">
            {lightboxItem &&
              (lightboxItem.type === 'video' ? (
                <video src={lightboxItem.url} controls className="lightbox-img" />
              ) : (
                <img src={lightboxItem.url} alt={mediaName(lightboxItem)} className="lightbox-img" />
              ))}
          </div>
          <div className="lightbox-footer">
            <div className="lightbox-note">{lightboxItem?.caption || ''}</div>
            <div className="lightbox-nav">
              <button type="button" className="lightbox-nav-btn" onClick={lbPrev} aria-label="Previous">
                <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <polyline points="15 18 9 12 15 6" />
                </svg>
              </button>
              <div className="lightbox-nav-count">
                {lightboxIndex != null ? `${lightboxIndex + 1} / ${filteredMedia.length}` : '0 / 0'}
              </div>
              <button type="button" className="lightbox-nav-btn" onClick={lbNext} aria-label="Next">
                <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Upload modal */}
      <div
        className={`media-upload-modal-overlay ${uploadModalOpen ? 'open' : ''}`}
        onClick={(e) => e.target === e.currentTarget && setUploadModalOpen(false)}
      >
        <div className="media-upload-modal" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header">
            <div className="modal-title">Add media</div>
            <div className="modal-sub">Upload photos or videos from this job walk</div>
          </div>
          <div className="modal-body">
            <div className="modal-dropzone" onClick={openUpload}>
              {uploading ? (
                <span>Uploading…</span>
              ) : (
                <>
                  <svg
                    width={24}
                    height={24}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="var(--text-muted)"
                    strokeWidth={1.5}
                    style={{ margin: '0 auto 8px', display: 'block' }}
                  >
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1={12} y1={3} x2={12} y2={15} />
                  </svg>
                  Click to choose files or drag them here
                  <div style={{ fontSize: 11, marginTop: 4, color: 'var(--border-mid)' }}>JPG · PNG · MP4 · MOV · up to 500MB</div>
                </>
              )}
            </div>
            <div className="modal-field">
              <div className="modal-label">Uploaded by</div>
              <input
                type="text"
                className="modal-input"
                placeholder="Your name"
                value={uploaderName}
                onChange={(e) => setUploaderName(e.target.value)}
              />
            </div>
            <div className="modal-field">
              <div className="modal-label">Notes (optional)</div>
              <textarea
                className="modal-textarea"
                placeholder="What's shown in this media? Any observations from the walk…"
                value={uploadCaption}
                onChange={(e) => setUploadCaption(e.target.value)}
              />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn-sm" onClick={() => setUploadModalOpen(false)}>
              Cancel
            </button>
            <button type="button" className="btn btn-primary flex items-center gap-1.5" onClick={openUpload} disabled={uploading}>
              <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2.5}>
                <polyline points="20 6 9 17 4 12" />
              </svg>
              {uploading ? 'Uploading…' : 'Upload'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
