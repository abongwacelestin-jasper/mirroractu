import React from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { twMerge } from 'tailwind-merge'

import { Story, categoryName, storyDate, storyPath } from '@/data'
import { Hl, MonoDate } from '@/components/ui'
import { Viz, VizTone } from '@/components/story/Viz'

/** Section name and date above a headline. */
export function Kicker({ story, dark = false, className }: { story: Story; dark?: boolean; className?: string }) {
  return (
    <div className={twMerge('flex items-baseline gap-3.5 text-[13.5px] font-semibold', className)}>
      <span>{categoryName(story.cats[0])}</span>
      <MonoDate className={twMerge('font-normal', dark ? 'text-mirror' : 'text-muted')}>{storyDate(story)}</MonoDate>
    </div>
  )
}

const HEADLINE = {
  xl: 'text-[30px] leading-[1.06] tracking-[-0.03em] sm:text-[38px]',
  lg: 'text-[30px] leading-[1.14]',
  md: 'text-[25px] leading-[1.14]',
}

export function StoryCard({
  story,
  size = 'md',
  withViz = false,
  vizTone = 'paper',
  standfirst = true,
}: {
  story: Story
  size?: keyof typeof HEADLINE
  withViz?: boolean
  vizTone?: VizTone
  standfirst?: boolean
}) {
  return (
    <Link to={storyPath(story.id)} className="group block">
      {withViz && <Viz story={story} tone={vizTone} className="mb-[22px]" />}
      <Kicker story={story} className="mb-2.5" />
      <h3 className={HEADLINE[size]}>
        <Hl>{story.h}</Hl>
      </h3>
      {standfirst && <p className={twMerge('mt-2.5 max-w-[56ch] text-muted', size === 'xl' ? 'text-lg' : 'text-base')}>{story.st}</p>}
    </Link>
  )
}

/** Compact dated list of headlines. */
export function StoryRows({ stories, showDate = true }: { stories: Story[]; showDate?: boolean }) {
  return (
    <ul>
      {stories.map((s) => (
        <li key={s.id} className="border-t border-rule last:border-b">
          <Link
            to={storyPath(s.id)}
            className={twMerge('group grid items-baseline gap-3.5 py-[15px]', showDate ? 'grid-cols-[62px_1fr]' : 'grid-cols-1')}
          >
            {showDate && <MonoDate className="text-muted">{storyDate(s)}</MonoDate>}
            <strong className="text-[16.5px] font-semibold leading-[1.3] tracking-[-0.01em]">
              <Hl>{s.h}</Hl>
            </strong>
          </Link>
        </li>
      ))}
    </ul>
  )
}

/**
 * The mirror: what is confirmed on one side, what is still open on the other,
 * split by the dashed signal axis. Collapses to a stack on phones.
 */
export function Ledger({ confirmed, open, dark = false, textSize }: { confirmed: string[]; open: string[]; dark?: boolean; textSize?: 'm' | 'l' }) {
  const reduce = useReducedMotion()
  const rule = dark ? 'border-rule-dark' : 'border-rule'
  const item = twMerge('border-t pt-3 leading-[1.45]', rule, textSize === 'l' ? 'text-xl' : textSize === 'm' ? 'text-[17px]' : 'text-base')
  return (
    <div className="grid grid-cols-1 sm:grid-cols-[1fr_33px_1fr]">
      <div>
        <h2 className="mb-3.5 flex items-center gap-2.5 text-[15px] font-semibold tracking-normal">
          <i className="inline-block size-3.5 bg-current" />
          Confirmed
        </h2>
        <ul className="grid gap-3">
          {confirmed.map((x) => <li key={x} className={item}>{x}</li>)}
        </ul>
      </div>

      <motion.div
        aria-hidden="true"
        initial={reduce ? false : { scaleY: 0, opacity: 0 }}
        animate={{ scaleY: 1, opacity: 1 }}
        transition={{ duration: 0.3, delay: 0.1, ease: [0.23, 1, 0.32, 1] }}
        className="axis-x relative my-[30px] h-0.5 origin-left sm:axis-y sm:my-0 sm:h-auto sm:w-0.5 sm:origin-top sm:justify-self-center"
      >
        <span className="absolute -top-1.5 left-0 size-3.5 rounded-full bg-signal sm:-left-1.5 sm:top-0" />
      </motion.div>

      <div className={dark ? 'text-mirror' : 'text-muted'}>
        <h2 className={twMerge('mb-3.5 flex items-center gap-2.5 text-[15px] font-semibold tracking-normal', dark ? 'text-white' : 'text-ink')}>
          <i className="hatch inline-block size-3.5" />
          Still open
        </h2>
        <ul className="grid gap-3">
          {open.map((x) => <li key={x} className={item}>{x}</li>)}
        </ul>
      </div>
    </div>
  )
}
