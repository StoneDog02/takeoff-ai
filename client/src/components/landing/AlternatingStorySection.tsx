const ROWS = [
  {
    title: 'Stay on top of everything in one place',
    body:
      'Stop hunting for the latest takeoff, bid version, or site note. Proj-X keeps jobs, materials, and team updates tied together so your office and field share the same picture.',
    visual: 'jobs',
  },
  {
    title: 'Update clients without the ping-pong',
    body:
      'Homeowners see progress and approvals in one portal. Your team spends less time re-explaining status — and fewer threads get lost between email and text.',
    visual: 'messages',
  },
  {
    title: 'Catch scope and cost before they slip',
    body:
      'When change orders, selections, and invoices are tracked in context, “I do not remember agreeing to that” stops being your problem. You keep a clear paper trail without the paperwork pile.',
    visual: 'changes',
  },
  {
    title: 'Show up like the pro you are',
    body:
      'Sharp bid sheets and organized sub packages signal that you run a tight operation. That first impression helps you win bids and earn referrals.',
    visual: 'bid',
  },
] as const

function StoryVisual({ kind }: { kind: (typeof ROWS)[number]['visual'] }) {
  if (kind === 'jobs') {
    return (
      <div className="rounded-xl border border-border-dark bg-dark-3 p-4 shadow-[0_24px_48px_rgba(0,0,0,0.35)]">
        <div className="text-[10px] uppercase tracking-wider text-white-dim mb-3">Active jobs</div>
        <div className="space-y-2">
          {[
            { name: 'Riverside Commercial', tag: 'Framing', pct: 72 },
            { name: 'Harbor View Custom', tag: 'Dry-in', pct: 45 },
            { name: 'Maple Lane Reno', tag: 'Rough-in', pct: 88 },
          ].map((j) => (
            <div key={j.name} className="flex items-center gap-3 py-2.5 px-3 rounded-lg bg-dark-4/80 border border-white-faint/10">
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold text-landing-white truncate">{j.name}</div>
                <div className="text-[10px] text-white-dim">{j.tag}</div>
              </div>
              <div className="w-16 h-1.5 rounded-full bg-white-faint/20 overflow-hidden flex-shrink-0">
                <div className="h-full rounded-full bg-accent" style={{ width: `${j.pct}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }
  if (kind === 'messages') {
    return (
      <div className="rounded-xl border border-border-dark bg-dark-3 p-4 shadow-[0_24px_48px_rgba(0,0,0,0.35)]">
        <div className="text-[10px] uppercase tracking-wider text-white-dim mb-3">Client thread · Harbor View</div>
        <div className="space-y-2">
          <div className="rounded-lg bg-dark-4/80 border border-white-faint/10 px-3 py-2 text-xs text-white-dim">
            <span className="text-accent text-[10px] font-semibold uppercase">You</span>
            <p className="m-0 mt-1 text-landing-white/90">Framing inspection scheduled Tuesday 9am. Photos will post to the log.</p>
          </div>
          <div className="rounded-lg bg-accent/10 border border-accent/25 px-3 py-2 text-xs text-white-dim ml-4">
            <span className="text-accent-hover text-[10px] font-semibold uppercase">Homeowner</span>
            <p className="m-0 mt-1 text-landing-white/90">Perfect — thanks for the heads up.</p>
          </div>
        </div>
      </div>
    )
  }
  if (kind === 'changes') {
    return (
      <div className="rounded-xl border border-border-dark bg-dark-3 p-4 shadow-[0_24px_48px_rgba(0,0,0,0.35)]">
        <div className="text-[10px] uppercase tracking-wider text-white-dim mb-3">Open change orders</div>
        <div className="space-y-2">
          {[
            { id: 'CO-104', sum: '$4,280', st: 'Signed' },
            { id: 'CO-105', sum: '$1,120', st: 'Pending' },
          ].map((c) => (
            <div
              key={c.id}
              className="flex items-center justify-between py-2.5 px-3 rounded-lg bg-dark-4/80 border border-white-faint/10 text-xs"
            >
              <span className="font-mono text-white-dim">{c.id}</span>
              <span className="text-landing-white font-semibold">{c.sum}</span>
              <span
                className={
                  c.st === 'Signed' ? 'text-[#2ecc71] text-[10px] font-semibold uppercase' : 'text-amber-400/90 text-[10px] font-semibold uppercase'
                }
              >
                {c.st}
              </span>
            </div>
          ))}
        </div>
      </div>
    )
  }
  return (
    <div className="rounded-xl border border-border-dark bg-dark-3 p-4 shadow-[0_24px_48px_rgba(0,0,0,0.35)]">
      <div className="text-[10px] uppercase tracking-wider text-white-dim mb-3">Bid sheet preview</div>
      <div className="rounded-lg bg-dark-4/80 border border-white-faint/10 overflow-hidden text-xs">
        <div className="grid grid-cols-[1fr_auto] gap-2 px-3 py-2 border-b border-white-faint/10 text-white-dim text-[10px] uppercase tracking-wide">
          <span>Line</span>
          <span className="text-right">Total</span>
        </div>
        {[
          { line: 'Framing labor & material', total: '$48,200' },
          { line: 'Electrical rough-in', total: '$12,400' },
          { line: 'Interior finishes (allowance)', total: '$22,000' },
        ].map((r) => (
          <div key={r.line} className="grid grid-cols-[1fr_auto] gap-2 px-3 py-2 border-b border-white-faint/5 text-landing-white/95">
            <span className="truncate">{r.line}</span>
            <span className="text-right font-medium text-white-dim">{r.total}</span>
          </div>
        ))}
        <div className="flex justify-between items-center px-3 py-2.5 bg-accent/10 text-landing-white font-sora font-bold text-sm">
          <span>Subtotal</span>
          <span>$82,600</span>
        </div>
      </div>
    </div>
  )
}

export function AlternatingStorySection() {
  return (
    <section
      id="how-it-works"
      className="w-full bg-dark-2 py-[88px] md:py-[120px] px-6 md:px-12 border-y border-border-dark"
    >
      <div className="max-w-[1200px] mx-auto">
        <div className="reveal text-center max-w-[720px] mx-auto mb-16 md:mb-20">
          <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-accent-hover block mb-3">
            HOW WE SET YOU UP
          </span>
          <h2 className="font-sora text-3xl md:text-5xl font-extrabold text-landing-white tracking-tight leading-tight mb-4">
            Here is how Proj-X fits your workflow
          </h2>
          <p className="text-base text-white-dim leading-relaxed m-0">
            Four rhythms we hear from teams that outgrow spreadsheets — and outlast messy inboxes.
          </p>
        </div>

        <div className="flex flex-col gap-20 md:gap-24">
          {ROWS.map((row, i) => {
            const copyFirst = i % 2 === 0
            const copyBlock = (
              <div className={`reveal ${copyFirst ? 'reveal-left' : 'reveal-right'} md:text-left`}>
                <h3 className="font-sora text-2xl md:text-3xl font-bold text-landing-white tracking-tight leading-snug mb-4">
                  {row.title}
                </h3>
                <p className="text-[15px] md:text-base text-white-dim leading-relaxed m-0 max-w-[520px] md:max-w-none">
                  {row.body}
                </p>
              </div>
            )
            const visualBlock = (
              <div
                className={`reveal ${copyFirst ? 'reveal-right' : 'reveal-left'} reveal-delay-1 max-w-[440px] ${copyFirst ? 'md:justify-self-end' : 'md:justify-self-start'} w-full`}
              >
                <StoryVisual kind={row.visual} />
              </div>
            )

            return (
              <div
                key={row.title}
                className="grid md:grid-cols-2 gap-10 md:gap-14 items-center"
              >
                {copyFirst ? (
                  <>
                    {copyBlock}
                    {visualBlock}
                  </>
                ) : (
                  <>
                    <div className="md:order-1 order-2">{visualBlock}</div>
                    <div className="md:order-2 order-1">{copyBlock}</div>
                  </>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
