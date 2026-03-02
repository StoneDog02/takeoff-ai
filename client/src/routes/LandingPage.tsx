import { useScrollReveal } from '@/hooks/useScrollReveal'
import { LandingNav } from '@/components/landing/LandingNav'
import { HeroSection } from '@/components/landing/HeroSection'
import { TrustedBySection } from '@/components/landing/TrustedBySection'
import { FeaturesSection } from '@/components/landing/FeaturesSection'
import { StatsSection } from '@/components/landing/StatsSection'
import { PricingSection } from '@/components/landing/PricingSection'
import { TestimonialsSection } from '@/components/landing/TestimonialsSection'
import { FAQSection } from '@/components/landing/FAQSection'
import { CTASection } from '@/components/landing/CTASection'
import { ContactSection } from '@/components/landing/ContactSection'
import { Footer } from '@/components/landing/Footer'

export function LandingPage() {
  useScrollReveal()

  return (
    <div className="min-h-screen flex flex-col w-full bg-dark text-landing-white font-dm-sans landing-noise">
      <LandingNav />
      <HeroSection />
      <TrustedBySection />
      <FeaturesSection />
      <StatsSection />
      <PricingSection />
      <TestimonialsSection />
      <FAQSection />
      <CTASection />
      <ContactSection />
      <Footer />
    </div>
  )
}
