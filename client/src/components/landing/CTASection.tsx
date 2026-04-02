import { CTABlock } from '@/components/landing/CTABlock'

/**
 * Reusable CTA section for the landing page. Uses CTABlock for consistent,
 * premium call-to-action blocks that can be reused elsewhere (e.g. modal, email).
 */
export function CTASection() {
  return (
    <section
      id="cta"
      className="w-full bg-dark-2 py-[100px] px-6 md:px-12 relative overflow-hidden"
    >
      <div
        className="absolute inset-0 opacity-[0.04] pointer-events-none"
        style={{
          backgroundImage: `
            linear-gradient(rgba(192,57,43,0.04) 1px, transparent 1px),
            linear-gradient(90deg, rgba(192,57,43,0.04) 1px, transparent 1px)
          `,
          backgroundSize: '60px 60px',
        }}
      />
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse, rgba(192,57,43,0.08) 0%, transparent 70%)',
        }}
      />

      <div className="relative z-10 flex justify-center reveal">
        <CTABlock
          variant="dark"
          eyebrow="START BUILDING"
          title="Ready for faster takeoffs?"
          description="Join 500+ contractors who save time and win more bids with accurate, automated material lists."
          primaryAction={{ label: 'Start free trial →', to: '/sign-up' }}
          secondaryAction={{ label: 'View plans', href: '#pricing' }}
        >
          <p className="text-sm text-white-dim">
            No credit card required · 30-day trial · Cancel anytime
          </p>
        </CTABlock>
      </div>
    </section>
  )
}
