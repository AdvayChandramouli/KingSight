import type { PhotoPlate } from '@/features/landing/media/ledger'

export function PhotoCaption({ photo }: { photo: PhotoPlate }) {
  return (
    <div className="bg-canvas px-4 py-3 sm:px-5">
      <p className="text-[0.8125rem] leading-relaxed text-ink">{photo.caption}</p>
      <p className="mt-1 text-[0.8125rem] leading-relaxed text-ink-muted">
        {photo.geography}. {photo.credit}
        {photo.license ? ` · ${photo.license}` : ''}
        {' · '}
        <a href={photo.sourceUrl} target="_blank" rel="noreferrer" className="font-medium text-ink underline">
          Source
          <span className="sr-only"> (opens in a new tab)</span>
        </a>
      </p>
    </div>
  )
}
