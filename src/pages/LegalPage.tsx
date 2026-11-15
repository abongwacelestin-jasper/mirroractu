import React from 'react'

import { Container, PageHeader } from '@/components/ui'
import { SimpleTable } from '@/pages/StandardsPage'

const ROWS = [
  ['Privacy', 'What reader data is collected and why', 'Draft pending legal review'],
  ['Terms of use', 'Rules for using the site and its content', 'Draft pending legal review'],
  ['Cookies', 'Consent choices for analytics and advertising', 'To be written with the consent tool'],
  ['Accessibility', 'The standard the site meets and how to report a barrier', 'After the accessibility audit'],
  ['Contact', 'Newsroom, corrections and advertising addresses', 'Published at launch'],
]

export function LegalPage() {
  return (
    <>
      <PageHeader title="Legal and contact" intro="These pages are being prepared for launch. Here is where each one stands." />
      <Container className="pb-[88px] pt-6">
      <div className="max-w-[760px]">
        <SimpleTable head={['Page', 'What it will cover', 'Status']} rows={ROWS} />
        <p className="mt-7 text-lg text-muted">
          In this preview nothing you type is sent or stored on a server. Saved stories, followed sections and text size stay in your browser.
        </p>
      </div>
      </Container>
    </>
  )
}
