import React from 'react'
import { Link, LinkProps } from 'react-router-dom'
import { twMerge } from 'tailwind-merge'

/** Page-width container: 1440px max, 40/24/18px gutters. */
export function Container({ className, children, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={twMerge('mx-auto w-full max-w-[1440px] px-[18px] sm:px-6 lg:px-10', className)} {...rest}>
      {children}
    </div>
  )
}

type ButtonStyle = { variant?: 'solid' | 'line'; size?: 'md' | 'sm'; className?: string }

export function buttonClass({ variant = 'solid', size = 'md', className }: ButtonStyle = {}) {
  return twMerge(
    'inline-flex items-center justify-center whitespace-nowrap rounded-full border font-semibold transition-[color,background-color,border-color,translate,box-shadow] duration-150 ease-out motion-safe:hover:-translate-y-px',
    size === 'sm' ? 'px-[15px] py-[7px] text-sm' : 'px-5 py-2.5 text-[15px]',
    variant === 'solid'
      ? 'border-signal bg-signal text-ink hover:bg-signal-hover hover:shadow-[0_8px_18px_-8px_rgba(255,90,54,.75)]'
      : 'border-current bg-transparent hover:bg-ink/5 aria-pressed:border-ink aria-pressed:bg-ink aria-pressed:text-white',
    className
  )
}

export function Button({ variant, size, className, ...rest }: ButtonStyle & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button type="button" className={buttonClass({ variant, size, className })} {...rest} />
}

export function ButtonLink({ variant, size, className, ...rest }: ButtonStyle & LinkProps) {
  return <Link className={buttonClass({ variant, size, className })} {...rest} />
}

/** Bold inline link with the signal underline. */
export function TextLink({ className, ...rest }: LinkProps) {
  return (
    <Link
      className={twMerge('border-b-2 border-signal pb-px font-semibold transition-colors duration-150 hover:border-current', className)}
      {...rest}
    />
  )
}

/** A headline inside a `group` link: underlines in signal on hover. */
export function Hl({ children }: { children: React.ReactNode }) {
  return (
    <span className="decoration-signal decoration-2 underline-offset-[5px] group-hover:underline group-focus-visible:underline">
      {children}
    </span>
  )
}

export function MonoDate({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={twMerge('whitespace-nowrap font-mono text-[11px] uppercase tracking-[0.12em]', className)}>{children}</span>
  )
}

/** Small toggle pill used for filters. */
export function Pill({ selected, className, ...rest }: { selected?: boolean } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      aria-selected={selected}
      className={twMerge(
        'whitespace-nowrap rounded-full border border-rule px-3.5 py-1.5 text-sm transition-colors duration-150 hover:border-ink',
        selected && 'border-ink bg-ink text-white',
        className
      )}
      {...rest}
    />
  )
}

/** Section heading with a heavy top rule and an optional link on the right. */
export function DeskHeading({ title, to, linkLabel }: { title: string; to?: string; linkLabel?: string }) {
  return (
    <div data-reveal="left" className="mb-[30px] flex items-baseline justify-between gap-5 border-t-2 border-ink pt-4">
      <h2 className="text-[34px] font-extrabold tracking-[-0.035em]">{title}</h2>
      {to && <TextLink to={to} className="text-[14.5px]">{linkLabel}</TextLink>}
    </div>
  )
}

/**
 * Full-bleed ink hero for every inner page: a giant title, a serif standfirst and a dashed
 * signal axis along its foot, the same mirror line that splits the lead story.
 */
export function PageHeader({ title, intro, aside }: { title: string; intro?: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <section className="bg-ink text-white">
      <Container className="grid items-end gap-6 pb-8 pt-8 lg:grid-cols-[1fr_auto] lg:gap-12 lg:pb-16 lg:pt-20">
        <div className="min-w-0">
          <h1 className="rise break-words text-[clamp(44px,10vw,148px)] font-extrabold leading-[0.86] tracking-[-0.05em]">
            {title}
            <span className="text-signal">.</span>
          </h1>
          {intro && <p style={{ '--rise-delay': '120ms' } as React.CSSProperties} className="rise mt-4 max-w-[34em] font-serif text-[20px] leading-[1.25] text-mirror-light sm:mt-6 sm:text-[28px]">{intro}</p>}
        </div>
        {aside}
      </Container>
      <div aria-hidden="true" className="axis-x draw-x h-0.5" />
    </section>
  )
}
