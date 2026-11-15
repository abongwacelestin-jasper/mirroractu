import React from 'react'

import { ButtonLink, Container, PageHeader } from '@/components/ui'

export function NotFoundPage() {
  return (
    <>
      <PageHeader title="Not found" intro="There is no page at this address. It may have moved, or the link may be mistyped." />
      <Container className="py-14"><ButtonLink to="/">Go to the front page</ButtonLink></Container>
    </>
  )
}
