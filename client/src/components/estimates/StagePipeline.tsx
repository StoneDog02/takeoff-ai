import type { PipelineStage } from '@/types/global'
import { PIPELINE_STAGES } from '@/lib/pipeline'

const STAGE_STYLES: Record<PipelineStage, { color: string; bg: string; dot: string }> = {
  draft: { color: 'var(--text-muted)', bg: 'var(--bg-base)', dot: 'var(--border-mid)' },
  sent: { color: 'var(--blue)', bg: 'var(--blue-glow)', dot: 'var(--blue)' },
  accepted: { color: 'var(--est-amber)', bg: 'var(--est-amber-light)', dot: 'var(--est-amber)' },
  invoiced: { color: 'var(--est-amber)', bg: 'var(--est-amber-light)', dot: 'var(--est-amber)' },
  paid: { color: 'var(--green)', bg: 'var(--green-glow)', dot: 'var(--green)' },
  declined: { color: 'var(--text-muted)', bg: 'var(--bg-base)', dot: 'var(--border-mid)' },
}

interface StagePipelineProps {
  current: PipelineStage
  onAdvance?: (next: PipelineStage) => void
}

export function StagePipeline({ current, onAdvance }: StagePipelineProps) {
  const idx = PIPELINE_STAGES.findIndex((s) => s.key === current)

  return (
    <div className="estimates-stage-pipeline">
      {PIPELINE_STAGES.map((s, i) => {
        const done = i < idx
        const active = i === idx
        const canAdvance = onAdvance && i === idx + 1
        const style = STAGE_STYLES[s.key]
        return (
          <div key={s.key} className="estimates-stage-pipeline__segment">
            <button
              type="button"
              className={`estimates-stage-pipeline__pill ${active ? 'active' : ''} ${done ? 'done' : ''} ${canAdvance ? 'can-advance' : ''}`}
              style={{
                ['--pill-color' as string]: style.color,
                ['--pill-bg' as string]: style.bg,
                ['--pill-dot' as string]: style.dot,
              }}
              onClick={() => canAdvance && onAdvance(s.key)}
              disabled={!canAdvance}
            >
              {done ? '✓ ' : ''}{s.label}
            </button>
            {i < PIPELINE_STAGES.length - 1 && (
              <div className={`estimates-stage-pipeline__connector ${i < idx ? 'done' : ''}`} />
            )}
          </div>
        )
      })}
    </div>
  )
}
