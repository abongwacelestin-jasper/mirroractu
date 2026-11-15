import React from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { twMerge } from 'tailwind-merge'

import { AnimatedLogo } from '@/components/brand/AnimatedLogo'
import { Container } from '@/components/ui'

const EASE = [0.23, 1, 0.32, 1] as const

/**
 * First-load splash: the MirrorActu symbol assembles itself, the solid half, then the scan-line
 * half, then the signal axis and dot, then the wordmark. Each piece runs at most 300ms.
 *
 * On the real site the same splash is drawn by index.html (`#boot`) so it is on screen before
 * any JavaScript arrives; lib/boot.ts fades it out once React has mounted. This component is
 * the React twin, used where there is no index.html of ours (tests, embeds).
 */
export function BrandSplash() {
  const reduce = useReducedMotion()
  const t = (delay: number, d = 0.28) => (reduce ? { duration: 0 } : { duration: d, delay, ease: EASE })
  return (
    <div role="status" aria-label="Loading MirrorActu" className="fixed inset-0 z-[80] flex flex-col items-center justify-center bg-ink text-white">
      <div className="flex items-center gap-4">
        <AnimatedLogo className="size-16 sm:size-20" />
        <motion.span
          initial={{ opacity: 0, x: -6 }}
          animate={{ opacity: 1, x: 0 }}
          transition={t(0.45)}
          className="whitespace-nowrap text-[40px] font-extrabold leading-[0.9] tracking-[-0.035em] sm:text-[52px]"
        >
          <span translate="no">Mirror<b className="font-extrabold text-signal">Actu</b></span>
        </motion.span>
      </div>
      <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={t(0.55)} className="mt-5 font-serif text-xl text-mirror">
        Today, reflected. Tomorrow, remembered.
      </motion.p>
      <div aria-hidden="true" className="mt-7 h-0.5 w-40 overflow-hidden bg-ink-2">
        <motion.div
          className="h-full w-1/3 bg-signal"
          initial={{ x: '-100%' }}
          animate={reduce ? { x: '100%' } : { x: ['-100%', '300%'] }}
          transition={reduce ? { duration: 0 } : { duration: 1.1, repeat: Infinity, ease: 'easeInOut' }}
        />
      </div>
    </div>
  )
}

/** A placeholder block. A light band sweeps across it unless the reader prefers reduced motion. */
export function Bone({ className, dark = false }: { className?: string; dark?: boolean }) {
  return <div aria-hidden="true" className={twMerge(dark ? 'shimmer-dark bg-ink-2' : 'shimmer bg-paper-2', className)} />
}

export type SkeletonKind = 'home' | 'section' | 'story' | 'page'

/** Route-change placeholder shaped like the page that is about to arrive. */
export function PageSkeleton({ kind }: { kind: SkeletonKind }) {
  return (
    <div role="status" aria-label="Loading page">
      {kind === 'home' ? <HomeSkeleton /> : kind === 'story' ? <StorySkeleton /> : <HeroSkeleton withGrid={kind === 'section'} />}
    </div>
  )
}

function HomeSkeleton() {
  return (
    <>
      <section className="bg-ink">
        <Container className="pb-14 pt-10 lg:pt-14">
          <Bone dark className="h-[clamp(52px,10vw,150px)] w-3/4" />
          <div className="mt-10 grid gap-10 lg:grid-cols-12 lg:gap-x-8">
            <div className="lg:col-span-8">
              <Bone dark className="h-4 w-40" />
              <Bone dark className="mt-5 h-14 w-full" />
              <Bone dark className="mt-3 h-14 w-2/3" />
              <Bone dark className="mt-6 h-6 w-5/6" />
              <div className="mt-10 grid grid-cols-2 gap-8">
                {[0, 1].map((i) => (
                  <div key={i} className="space-y-3">
                    <Bone dark className="h-4 w-24" />
                    <Bone dark className="h-12" />
                    <Bone dark className="h-12" />
                  </div>
                ))}
              </div>
            </div>
            <div className="space-y-5 lg:col-span-4">
              <Bone dark className="h-24" />
              <Bone dark className="h-24" />
              <Bone dark className="h-40" />
            </div>
          </div>
        </Container>
      </section>
      <Container className="grid gap-10 py-14 lg:grid-cols-12 lg:gap-x-8">
        <div className="space-y-4 lg:col-span-5"><Bone className="h-48" /><Bone className="h-6 w-1/3" /><Bone className="h-10" /><Bone className="h-5 w-4/5" /></div>
        <div className="space-y-4 lg:col-span-4"><Bone className="h-36" /><Bone className="h-6 w-1/3" /><Bone className="h-10" /></div>
        <div className="space-y-3 lg:col-span-3">{Array.from({ length: 6 }, (_, i) => <Bone key={i} className="h-10" />)}</div>
      </Container>
    </>
  )
}

function HeroSkeleton({ withGrid }: { withGrid: boolean }) {
  return (
    <>
      <section className="bg-ink">
        <Container className="pb-14 pt-14 lg:pt-20">
          <Bone dark className="h-[clamp(52px,10vw,140px)] w-1/2" />
          <Bone dark className="mt-6 h-7 w-2/3" />
        </Container>
      </section>
      <Container className="py-12">
        {withGrid && (
          <div className="mb-10 grid grid-cols-2 gap-6 lg:grid-cols-4">
            {Array.from({ length: 4 }, (_, i) => <Bone key={i} className="h-20" />)}
          </div>
        )}
        <div className="grid gap-10 lg:grid-cols-12 lg:gap-x-8">
          <div className="space-y-4 lg:col-span-8">
            <Bone className="h-56" />
            <Bone className="h-10 w-3/4" />
            <Bone className="h-5 w-2/3" />
            {Array.from({ length: 4 }, (_, i) => <Bone key={i} className="h-16" />)}
          </div>
          <div className="space-y-4 lg:col-span-4">
            <Bone className="h-48" />
            <Bone className="h-[250px]" />
          </div>
        </div>
      </Container>
    </>
  )
}

function StorySkeleton() {
  return (
    <Container className="pb-24 pt-14">
      <Bone className="h-4 w-24" />
      <Bone className="mt-5 h-14 w-full max-w-[900px]" />
      <Bone className="mt-3 h-14 w-2/3 max-w-[700px]" />
      <Bone className="mt-6 h-7 w-3/4 max-w-[760px]" />
      <Bone className="mt-8 h-12" />
      <div className="mt-11 grid gap-10 lg:grid-cols-12 lg:gap-x-8">
        <div className="space-y-4 lg:col-span-8">
          <Bone className="h-6" /><Bone className="h-6" /><Bone className="h-6 w-4/5" />
          <Bone className="mt-6 h-44 max-w-[620px]" />
          <div className="grid grid-cols-2 gap-8 pt-6">
            {[0, 1].map((i) => <div key={i} className="space-y-3"><Bone className="h-12" /><Bone className="h-12" /><Bone className="h-12" /></div>)}
          </div>
        </div>
        <div className="space-y-4 lg:col-span-4"><Bone className="h-32" /><Bone className="h-[250px]" /></div>
      </div>
    </Container>
  )
}
