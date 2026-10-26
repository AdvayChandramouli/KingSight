import { ContextDiagram } from './art/ContextDiagram'

const KEYS = {
  building: (
    <svg aria-hidden viewBox="0 0 28 28" className="size-7">
      <rect x="5" y="6" width="16" height="13" rx="2" fill="#31594A" />
      <path d="M5 23.5H21M5 21.5v4M21 21.5v4" stroke="#31594A" strokeWidth="1.4" fill="none" />
    </svg>
  ),
  location: (
    <svg aria-hidden viewBox="0 0 28 28" className="size-7">
      <path d="M14 2V9M14 19V26M2 14H9M19 14H26" stroke="#38596D" strokeWidth="1.5" strokeDasharray="2.5 2.5" />
      <circle cx="14" cy="14" r="4" fill="#FFFEFA" stroke="#38596D" strokeWidth="1.8" />
    </svg>
  ),
  connected: (
    <svg aria-hidden viewBox="0 0 28 28" className="size-7">
      <path d="M8 19L20 8" stroke="#9A654A" strokeWidth="1.8" strokeDasharray="3.5 3" strokeLinecap="round" />
      <rect x="2.5" y="16" width="10" height="8" rx="1.5" fill="#F3E6DC" stroke="#9A654A" strokeWidth="1.8" />
      <rect x="15.5" y="4" width="10" height="8" rx="1.5" fill="#F3E6DC" stroke="#9A654A" strokeWidth="1.8" />
    </svg>
  ),
}

const ITEMS: { key: keyof typeof KEYS; title: string; body: string }[] = [
  {
    key: 'building',
    title: 'Building attributes',
    body: 'Living area, bedrooms, bathrooms, construction grade, condition, year built, and whether the home sits on the water. In the explorer you can change these to see how an estimate responds.',
  },
  {
    key: 'location',
    title: 'Location',
    body: 'Latitude and longitude place the home within King County. Where a home sits matters to both models, though no single direction on the map always means a higher price.',
  },
  {
    key: 'connected',
    title: 'Connected properties',
    body: 'The graph model links each home to properties around it. Those connections give the model neighborhood context. They aren’t a ranked list of comparable sales, and they don’t show that one home sets another’s price.',
  },
]

export function ContextSection() {
  return (
    <section
      id="how-it-works"
      aria-labelledby="context-title"
      className="scroll-mt-4 border-y border-border bg-surface"
    >
      <div className="mx-auto grid max-w-[90rem] items-center gap-12 px-5 py-20 sm:px-8 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:gap-20 lg:px-12 lg:py-28">
        <figure className="order-2 lg:order-1">
          <div className="overflow-hidden rounded-[18px] border border-border/70">
            <ContextDiagram />
          </div>
          <figcaption className="mt-3 text-[0.8125rem] text-ink-muted">
            A sketch of one block from above. The highlighted home, its coordinates, and the homes it
            connects to. Not a real place.
          </figcaption>
        </figure>

        <div className="order-1 lg:order-2">
          <h2 id="context-title" className="max-w-[16ch] text-[2rem] font-medium text-ink sm:text-[2.5rem]">
            A home, its details, its surroundings
          </h2>
          <p className="mt-5 max-w-[34rem] text-lg leading-relaxed text-ink-muted">
            Every estimate starts from the same three kinds of information.
          </p>
          <ul className="mt-10 divide-y divide-border border-y border-border">
            {ITEMS.map((item) => (
              <li key={item.key} className="grid grid-cols-[2.25rem_minmax(0,1fr)] gap-x-4 py-6">
                <div className="pt-0.5">{KEYS[item.key]}</div>
                <div>
                  <h3 className="text-xl font-medium text-ink">{item.title}</h3>
                  <p className="mt-1.5 max-w-[36rem] text-ink-muted">{item.body}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}
