import React from 'react'
import { MapPin } from 'lucide-react'
import { Link } from 'react-router-dom'

import { StoryImage } from '@/components/story/StoryImage'
import { Hl, MonoDate } from '@/components/ui'
import { storiesNear } from '@/data/countries'
import { categoryName, storyDate, storyPath } from '@/data'
import { useSiteActions } from '@/lib/actions'
import { useEdition } from '@/lib/edition'

/**
 * Stories about the reader's country, then their region, as a sideways-scrolling strip above
 * the feed. Hidden for the international edition or when nothing is near.
 */
export function NearYou() {
  const [country] = useEdition()
  const { openEdition } = useSiteActions()
  const near = storiesNear(country.code, 8)
  if (near.scope === 'none') return null

  return (
    <section aria-label={near.label} className="mb-5 border-y-2 border-ink py-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-[19px]">
          <MapPin className="size-[18px] text-signal" />
          {near.label}
          <span className="text-[13px] font-normal text-muted">{near.stories.length} stories</span>
        </h2>
        <button type="button" onClick={openEdition} className="whitespace-nowrap text-[13px] font-semibold underline decoration-signal decoration-2 underline-offset-4">
          Change edition
        </button>
      </div>
      {near.scope === 'region' && <p className="-mt-1.5 mb-3 text-[13.5px] text-muted">Nothing filed from {country.name} today, so here is your region.</p>}
      <ul className="no-scrollbar -mx-[18px] flex snap-x gap-4 overflow-x-auto px-[18px] sm:mx-0 sm:px-0">
        {near.stories.map((s) => (
          <li key={s.id} className="w-[230px] flex-none snap-start sm:w-[250px]">
            <Link to={storyPath(s.id)} className="group block">
              <StoryImage story={s} caption={false} ratio="aspect-[3/2]" />
              <p className="mt-2.5 flex items-baseline gap-2.5 text-[12.5px] font-semibold">
                {categoryName(s.cats[0])}
                <MonoDate className="font-normal text-muted">{storyDate(s)}</MonoDate>
              </p>
              <h3 className="mt-1 text-[16.5px] leading-[1.2]"><Hl>{s.h}</Hl></h3>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
