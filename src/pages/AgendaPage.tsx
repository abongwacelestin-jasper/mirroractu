import React from 'react'
import { Link } from 'react-router-dom'

import { AdSlot } from '@/components/ads/AdSlot'
import { Container, Hl, PageHeader } from '@/components/ui'
import { AGENDA, categoryName, storyPath } from '@/data'
import { Chip } from '@/pages/SectionPage'

export function AgendaPage() {
  return (
    <>
      <PageHeader title="Coming up" intro="Dates worth knowing, taken from the stories we are following. Each links to the story behind it." />
      <Container className="pb-[88px] pt-6">
      <ul className="max-w-[860px]">
        {AGENDA.map(([, label, title, cats, id]) => (
          <li key={title} className="border-t border-rule">
            <Link to={storyPath(id)} className="group grid items-baseline gap-1 py-[22px] sm:grid-cols-[130px_1fr_auto] sm:gap-6">
              <b className="text-[26px] font-semibold tracking-[-0.02em]">{label}</b>
              <strong className="text-[19px] font-semibold tracking-[-0.01em]"><Hl>{title}</Hl></strong>
              <Chip>{categoryName(cats[0])}</Chip>
            </Link>
          </li>
        ))}
      </ul>
      <AdSlot format="leaderboard" slot={3} placement="the foot of the Coming up page" className="mt-12 max-w-[860px]" />
      </Container>
    </>
  )
}
