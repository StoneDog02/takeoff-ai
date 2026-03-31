import { useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useScrollReveal } from '@/hooks/useScrollReveal'
import { persistReferralCodeFromUrl } from '@/lib/referralCapture'
import { LandingNav } from '@/components/landing/LandingNav'
import { HeroSection } from '@/components/landing/HeroSection'
import { TrustedBySection } from '@/components/landing/TrustedBySection'
import { InstantTakeoffSection } from '@/components/landing/InstantTakeoffSection'
import { StatsSection } from '@/components/landing/StatsSection'
import { PricingSection } from '@/components/landing/PricingSection'
import { TestimonialsSection } from '@/components/landing/TestimonialsSection'
import { FAQSection } from '@/components/landing/FAQSection'
import { CTASection } from '@/components/landing/CTASection'
import { ContactSection } from '@/components/landing/ContactSection'
import { Footer } from '@/components/landing/Footer'

export function LandingPage() {
  const [searchParams] = useSearchParams()
  useScrollReveal()

  useEffect(() => {
    persistReferralCodeFromUrl(window.location.search)
  }, [searchParams])

  return (
    <div className="min-h-screen flex flex-col w-full bg-dark text-landing-white font-dm-sans landing-noise">
      <LandingNav />
      <HeroSection />
      <TrustedBySection />
      <InstantTakeoffSection />
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
