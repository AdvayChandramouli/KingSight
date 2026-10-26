import { ArrowRight, House } from 'lucide-react'
import { useEffect } from 'react'
import { Link } from 'react-router'
import { SiteHeader } from '@/components/SiteHeader'
import { buttonClasses } from '@/components/ui/buttonClasses'
import { ShorelineArt } from '@/features/landing/art/ShorelineArt'

export function NotFoundPage() {
  useEffect(() => {
    document.title = 'Page not found — KingSight'
  }, [])

  return (
    <div className="flex min-h-dvh flex-col overflow-x-clip bg-canvas">
      <SiteHeader variant="landing" />
      <main id="main" className="mx-auto flex w-full max-w-[90rem] flex-1 flex-col px-5 pt-10 pb-16 sm:px-8 lg:px-12 lg:pt-16">
        <div className="max-w-[38rem]">
          <h1 className="text-[2.375rem] font-medium tracking-[-0.03em] text-ink sm:text-[3.5rem]">
            This page isn’t on the map
          </h1>
          <p className="mt-5 text-lg leading-relaxed text-ink-muted">
            The link may be mistyped, or the page may have moved. You can head back to the overview or
            open the explorer to browse properties.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/" className={buttonClasses('secondary', 'lg', 'no-underline')}>
              <House aria-hidden className="size-4" />
              Home
            </Link>
            <Link to="/explore" className={buttonClasses('primary', 'lg', 'no-underline')}>
              Open explorer
              <ArrowRight aria-hidden className="size-4" />
            </Link>
          </div>
        </div>
        <div className="mt-14 h-44 overflow-hidden rounded-[18px] border border-border/70 sm:h-56 lg:mt-auto lg:h-64">
          <ShorelineArt />
        </div>
      </main>
    </div>
  )
}
