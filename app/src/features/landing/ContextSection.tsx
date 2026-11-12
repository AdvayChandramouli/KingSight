import { House, MapPin, Network } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

const ITEMS: { title: string; body: string; icon: LucideIcon; tone: string }[] = [
  {
    title: 'Building attributes',
    icon: House,
    tone: 'text-ink',
    body: 'Living area, bedrooms, bathrooms, construction grade, condition, year built, and whether the home sits on the water. In the explorer you can change these to see how an estimate responds.',
  },
  {
    title: 'Location',
    icon: MapPin,
    tone: 'text-deep-blue',
    body: 'Latitude and longitude place the home within King County. Where a home sits matters to both models, though no single direction on the map always means a higher price.',
  },
  {
    title: 'Connected properties',
    icon: Network,
    tone: 'text-clay-ink',
    body: 'The graph model links each home to properties around it. Those connections give the model neighborhood context. They aren’t a ranked list of comparable sales, and they don’t show that one home sets another’s price.',
  },
]

export function ContextSection() {
  return (
    <section id="how-it-works" aria-labelledby="context-title" className="scroll-mt-8 border-t border-border">
      <div className="mx-auto grid max-w-[90rem] lg:grid-cols-[minmax(16rem,0.7fr)_minmax(0,1.3fr)]">
        <figure className="border-b border-border bg-basswood lg:border-r lg:border-b-0">
          <div className="flex min-h-56 flex-col items-start justify-end gap-4 px-6 py-10 sm:px-8 lg:min-h-full lg:px-10">
            <span aria-hidden className="relative block size-3 rounded-full bg-brass ring-4 ring-canvas">
              <span className="absolute top-3 left-1/2 h-8 w-px -translate-x-1/2 bg-brass" />
            </span>
            <p className="text-sm font-medium text-fir">Preview home</p>
          </div>
          <figcaption className="bg-canvas px-6 py-4 text-sm leading-relaxed text-ink sm:px-8 lg:px-10">
            A pin for one sale on a planning model. Not a map, and not a street address.
          </figcaption>
        </figure>

        <div className="px-6 py-16 sm:px-8 lg:px-14 lg:py-24">
          <h2 id="context-title" className="max-w-[16ch] text-[2rem] font-medium tracking-tight text-ink sm:text-4xl">
            A home, its details, its surroundings
          </h2>
          <p className="mt-5 max-w-[34rem] text-lg leading-relaxed text-ink-muted">
            Every estimate starts from the same three kinds of information.
          </p>
          <ul className="mt-10 divide-y divide-border border-y border-border">
            {ITEMS.map((item) => {
              const Icon = item.icon
              return (
                <li key={item.title} className="grid grid-cols-[1.75rem_minmax(0,1fr)] gap-x-4 py-6">
                  <Icon aria-hidden className={`mt-1 size-5 ${item.tone}`} />
                  <div>
                    <h3 className="text-xl font-medium text-ink">{item.title}</h3>
                    <p className="mt-1.5 max-w-[38rem] text-ink-muted">{item.body}</p>
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      </div>
    </section>
  )
}
