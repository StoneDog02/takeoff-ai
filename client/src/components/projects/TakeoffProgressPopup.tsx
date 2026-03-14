import React, { useState, useRef, useEffect } from 'react'

interface TakeoffProgressPopupProps {
  progress: number
  message: string
  startTime: number
}

const DEFAULT_POSITION = { x: 24, y: 24 }

export function TakeoffProgressPopup({ progress, message, startTime }: TakeoffProgressPopupProps) {
  const [position, setPosition] = useState(DEFAULT_POSITION)
  const [dragging, setDragging] = useState(false)
  const [elapsedSec, setElapsedSec] = useState(0)
  const positionRef = useRef(position)
  const dragStartRef = useRef({ mouseX: 0, mouseY: 0, boxX: 0, boxY: 0 })

  positionRef.current = position

  useEffect(() => {
    if (startTime <= 0) return
    const tick = () => setElapsedSec(Math.floor((Date.now() - startTime) / 1000))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [startTime])

  const elapsedDisplay = elapsedSec < 60 ? `${elapsedSec}s` : `${Math.floor(elapsedSec / 60)}m ${elapsedSec % 60}s`

  useEffect(() => {
    if (!dragging) return
    const onMove = (e: MouseEvent) => {
      const { mouseX, mouseY, boxX, boxY } = dragStartRef.current
      setPosition({
        x: boxX + (e.clientX - mouseX),
        y: boxY + (e.clientY - mouseY),
      })
    }
    const onUp = () => setDragging(false)
    window.addEventListener('mousemove', onMove, { passive: true })
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [dragging])

  const handleDragStart = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button')) return
    e.preventDefault()
    dragStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      boxX: positionRef.current.x,
      boxY: positionRef.current.y,
    }
    setDragging(true)
  }

  return (
    <div
      className="takeoff-progress-popup fixed z-[9999] w-[280px] rounded-xl border border-border dark:border-border-dark bg-surface-elevated dark:bg-dark-3 shadow-lg"
      style={{ left: position.x, top: position.y }}
      role="dialog"
      aria-label="Takeoff in progress"
    >
      <div
        className="flex cursor-grab active:cursor-grabbing items-center justify-between gap-2 rounded-t-xl border-b border-border dark:border-border-dark bg-muted/50 dark:bg-dark-4 px-3 py-2 select-none"
        onMouseDown={handleDragStart}
      >
        <span className="text-xs font-semibold text-muted dark:text-white-dim uppercase tracking-wider">
          Takeoff running
        </span>
        <span className="text-[11px] font-mono text-muted dark:text-white-dim tabular-nums">{elapsedDisplay}</span>
      </div>
      <div className="p-3">
        <p className="text-sm font-medium text-gray-900 dark:text-landing-white mb-2 truncate" title={message}>
          {message}
        </p>
        <div className="h-2 w-full rounded-full bg-gray-200 dark:bg-dark-3 overflow-hidden">
          <div
            className="h-full rounded-full bg-accent transition-all duration-300 ease-out"
            style={{ width: `${Math.min(100, progress)}%` }}
          />
        </div>
        <p className="text-xs text-muted dark:text-white-dim mt-1.5">{progress}%</p>
      </div>
    </div>
  )
}
