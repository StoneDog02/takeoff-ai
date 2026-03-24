import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { fetchAddressSuggestions, type AddressSuggestion } from '@/api/geocode'

type AddressAutocompleteFieldProps = {
  value: string
  onChange: (address: string) => void
  /** User chose a suggestion — coordinates are from search index */
  onPick: (suggestion: AddressSuggestion) => void
  disabled?: boolean
  placeholder?: string
  id?: string
  /** Optional fixed anchor (e.g. company HQ) — overrides browser location for regional bias */
  biasLat?: number
  biasLng?: number
  /** When true (default), request browser geolocation once when the user starts typing to bias results near the user */
  useLocationBias?: boolean
}

const DEBOUNCE_MS = 280
const MIN_CHARS = 3

/**
 * Debounced address search with dropdown (Photon / OSM via API).
 * Optionally biases toward `biasLat`/`biasLng` or the browser's approximate location.
 */
export function AddressAutocompleteField({
  value,
  onChange,
  onPick,
  disabled,
  placeholder = 'Start typing an address…',
  id = 'geofence-address-autocomplete',
  biasLat,
  biasLng,
  useLocationBias = true,
}: AddressAutocompleteFieldProps) {
  const [open, setOpen] = useState(false)
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([])
  const [loading, setLoading] = useState(false)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [activeIndex, setActiveIndex] = useState(-1)
  const [locationBias, setLocationBias] = useState<{ lat: number; lng: number } | null>(null)
  /** Only fetch/show suggestions after the user has typed (avoids dropdown on tab load with a saved address). */
  const [searchArmed, setSearchArmed] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const geoRequested = useRef(false)
  /** Browser timer id (avoid NodeJS.Timeout vs number mismatch in tsc). */
  const blurResetTimer = useRef<number | null>(null)
  const listId = `${id}-listbox`

  const effectiveBias = useMemo(() => {
    if (
      typeof biasLat === 'number' &&
      typeof biasLng === 'number' &&
      Number.isFinite(biasLat) &&
      Number.isFinite(biasLng)
    ) {
      return { lat: biasLat, lng: biasLng }
    }
    return locationBias
  }, [biasLat, biasLng, locationBias])

  const requestLocationBias = useCallback(() => {
    if (!useLocationBias || geoRequested.current) return
    if (typeof biasLat === 'number' && typeof biasLng === 'number') return
    geoRequested.current = true
    if (typeof navigator === 'undefined' || !navigator.geolocation) return
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocationBias({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        })
      },
      () => {},
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 600000 }
    )
  }, [useLocationBias, biasLat, biasLng])

  const close = useCallback(() => {
    setOpen(false)
    setActiveIndex(-1)
    setSuggestions([])
  }, [])

  const clearBlurResetTimer = useCallback(() => {
    if (blurResetTimer.current != null) {
      clearTimeout(blurResetTimer.current)
      blurResetTimer.current = null
    }
  }, [])

  useEffect(() => {
    const onDocDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) close()
    }
    document.addEventListener('mousedown', onDocDown)
    return () => document.removeEventListener('mousedown', onDocDown)
  }, [close])

  useEffect(() => () => clearBlurResetTimer(), [clearBlurResetTimer])

  useEffect(() => {
    const q = value.trim()
    if (!searchArmed || q.length < MIN_CHARS || disabled) {
      setSuggestions([])
      setLoading(false)
      setFetchError(null)
      if (!searchArmed) setOpen(false)
      return
    }

    const ac = new AbortController()
    const t = window.setTimeout(async () => {
      setLoading(true)
      try {
        const list = await fetchAddressSuggestions(q, {
          limit: 8,
          signal: ac.signal,
          biasLat: effectiveBias?.lat,
          biasLng: effectiveBias?.lng,
        })
        if (ac.signal.aborted) return
        setSuggestions(list)
        setActiveIndex(list.length ? 0 : -1)
        if (list.length) setOpen(true)
        setFetchError(
          list.length ? null : 'No matches — try adding state and ZIP (e.g. Nibley, UT 84321), or wait a moment and type again.'
        )
      } catch {
        if (!ac.signal.aborted) {
          setSuggestions([])
          setFetchError('Could not reach address search. Check connection and that the API server is running.')
        }
      } finally {
        if (!ac.signal.aborted) setLoading(false)
      }
    }, DEBOUNCE_MS)

    return () => {
      clearTimeout(t)
      ac.abort()
    }
  }, [value, disabled, effectiveBias?.lat, effectiveBias?.lng, searchArmed])

  const pick = useCallback(
    (s: AddressSuggestion) => {
      onChange(s.label)
      onPick(s)
      close()
      inputRef.current?.blur()
    },
    [onChange, onPick, close]
  )

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!suggestions.length) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setOpen(true)
      setActiveIndex((i) => (i + 1) % suggestions.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setOpen(true)
      setActiveIndex((i) => (i <= 0 ? suggestions.length - 1 : i - 1))
    } else if (e.key === 'Enter' && suggestions.length > 0) {
      e.preventDefault()
      const idx = activeIndex >= 0 ? activeIndex : 0
      pick(suggestions[idx])
    } else if (e.key === 'Escape') {
      close()
    }
  }

  return (
    <div ref={wrapRef} style={{ position: 'relative', flex: '1 1 260px', minWidth: 0 }}>
      <input
        ref={inputRef}
        id={id}
        type="text"
        role="combobox"
        aria-expanded={open && suggestions.length > 0}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={activeIndex >= 0 ? `${id}-opt-${activeIndex}` : undefined}
        value={value}
        onChange={(e) => {
          clearBlurResetTimer()
          setSearchArmed(true)
          requestLocationBias()
          onChange(e.target.value)
        }}
        onFocus={() => {
          clearBlurResetTimer()
          if (searchArmed && suggestions.length) setOpen(true)
        }}
        onBlur={() => {
          blurResetTimer.current = window.setTimeout(() => {
            setSearchArmed(false)
            close()
            blurResetTimer.current = null
          }, 180)
        }}
        onKeyDown={onKeyDown}
        disabled={disabled}
        placeholder={placeholder}
        className="search-wrap"
        style={{ width: '100%', boxSizing: 'border-box' }}
        autoComplete="off"
        spellCheck={false}
      />
      {loading && (
        <span
          className="text-sm"
          style={{
            position: 'absolute',
            right: 10,
            top: '50%',
            transform: 'translateY(-50%)',
            color: 'var(--text-muted)',
            pointerEvents: 'none',
          }}
        >
          …
        </span>
      )}
      {open && suggestions.length > 0 && (
        <ul
          id={listId}
          role="listbox"
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: '100%',
            margin: '4px 0 0',
            padding: 4,
            listStyle: 'none',
            maxHeight: 260,
            overflowY: 'auto',
            zIndex: 10000,
            background: 'var(--surface-elevated, #fff)',
            border: '1px solid var(--border-subtle, #e5e7eb)',
            borderRadius: 8,
            boxShadow: '0 8px 24px rgba(0,0,0,.12)',
          }}
        >
          {suggestions.map((s, i) => (
            <li
              key={s.id || `${s.lat},${s.lng},${i}`}
              id={`${id}-opt-${i}`}
              role="option"
              aria-selected={i === activeIndex}
              onMouseEnter={() => setActiveIndex(i)}
              onMouseDown={(e) => {
                e.preventDefault()
                pick(s)
              }}
              style={{
                padding: '8px 10px',
                borderRadius: 6,
                cursor: 'pointer',
                fontSize: 13,
                lineHeight: 1.35,
                background: i === activeIndex ? 'var(--surface-muted, #f3f4f6)' : 'transparent',
                color: 'var(--text-primary, inherit)',
              }}
            >
              {s.label}
            </li>
          ))}
          <li
            className="text-sm"
            style={{
              padding: '6px 10px 4px',
              color: 'var(--text-muted)',
              fontSize: 11,
              listStyle: 'none',
            }}
          >
            OpenStreetMap (Photon or Nominatim) — pick a row to place the pin
          </li>
        </ul>
      )}
      {effectiveBias && (
        <p className="text-sm" style={{ color: 'var(--text-muted)', marginTop: 6, marginBottom: 0 }}>
          {typeof biasLat === 'number' && typeof biasLng === 'number'
            ? 'Results favor addresses near your company anchor.'
            : 'Results favor addresses near your approximate location.'}
        </p>
      )}
      {fetchError && !loading && (
        <p className="text-sm" style={{ color: 'var(--text-muted)', marginTop: 6, marginBottom: 0 }}>
          {fetchError}
        </p>
      )}
    </div>
  )
}
