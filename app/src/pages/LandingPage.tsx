import { useEffect } from 'react'
import { SiteHeader } from '@/components/SiteHeader'
import { FinalCta, SiteFooter } from '@/features/landing/ClosingSection'
import { ContextSection } from '@/features/landing/ContextSection'
import { ContributionsSection } from '@/features/landing/ContributionsSection'
import { Hero } from '@/features/landing/Hero'
import { PerspectivesSection } from '@/features/landing/PerspectivesSection'
import { ProductPreview } from '@/features/landing/ProductPreview'
import '@/features/landing/landing.css'

export function LandingPage() {
  useEffect(() => {
    document.title = 'KingSight — Property value, in context'
  }, [])

  return (
    <div className="min-h-dvh overflow-x-clip bg-canvas">
      <SiteHeader variant="landing" />
      <main id="main">
        <Hero />
        <ProductPreview />
        <ContextSection />
        <PerspectivesSection />
        <ContributionsSection />
        <FinalCta />
      </main>
      <SiteFooter />
    </div>
  )
}
