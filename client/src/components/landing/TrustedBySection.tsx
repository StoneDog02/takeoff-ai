import { TrustedByStrip } from '@/components/landing/TrustedByStrip'

/**
 * Reusable "Trusted by" / social proof strip. Renders company names or logos
 * in a clean, premium row. Uses TrustedByStrip component for reuse elsewhere.
 */
const DEFAULT_COMPANIES = [
  'BuildCo',
  'FrameWorks',
  'Summit Construction',
  'Apex Builders',
  'Precision GC',
]

export function TrustedBySection() {
  return (
    <section className="w-full py-10 px-6 md:px-12 border-b border-border-dark">
      <div className="max-w-[1200px] mx-auto">
        <TrustedByStrip
          variant="dark"
          title="Trusted by teams at"
          items={DEFAULT_COMPANIES}
        />
        <p className="mt-10 max-w-[720px] mx-auto text-center text-[15px] md:text-base text-white-dim leading-relaxed">
          Proj-X is a Buildertrend alternative, Procore alternative, and Raken alternative built for modern
          general contractors.
        </p>
      </div>
    </section>
  )
}
