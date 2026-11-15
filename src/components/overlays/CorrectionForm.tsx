import React, { useState } from 'react'

import { buttonClass } from '@/components/ui'
import { ApiError, api } from '@/lib/api'

/** The corrections form. Reports go to the corrections inbox in the dashboard. */
export function CorrectionForm({ idPrefix = 'fb', storyTitle }: { idPrefix?: string; storyTitle?: string }) {
  const [text, setText] = useState('')
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle')

  if (state === 'sent') {
    return (
      <p role="status" className="mt-3 border-l-[3px] border-signal bg-paper p-3.5 text-[15px]">
        Thank you. Your report is with the corrections desk. An editor checks every report against the story’s sources.
      </p>
    )
  }

  return (
    <form
      noValidate
      onSubmit={async (e) => {
        e.preventDefault()
        if (text.trim().length < 5) return setMessage('Describe what we should check.')
        setState('sending')
        try {
          await api('/corrections', { body: { message: text.trim(), storyTitle, email: email.trim() } })
          setState('sent')
        } catch (err) {
          setState('idle')
          setMessage(err instanceof ApiError ? err.message : 'Something went wrong. Try again.')
        }
      }}
    >
      <label htmlFor={`${idPrefix}-text`} className="mt-3 block text-sm font-semibold">What should we check?</label>
      <textarea
        id={`${idPrefix}-text`}
        rows={4}
        maxLength={4000}
        value={text}
        onChange={(e) => setText(e.target.value)}
        className="mt-1.5 w-full border border-ink/35 bg-white px-3 py-2.5 text-[15px]"
      />
      <label htmlFor={`${idPrefix}-mail`} className="mt-3 block text-sm font-semibold">Your email, if you want a reply</label>
      <input id={`${idPrefix}-mail`} type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1.5 w-full border border-ink/35 bg-white px-3 py-2.5 text-[15px]" />
      <button type="submit" disabled={state === 'sending'} className={buttonClass({ size: 'sm', className: 'mt-3.5 disabled:opacity-60' })}>
        {state === 'sending' ? 'Sending…' : 'Send correction'}
      </button>
      <p role="status" className="mt-2.5 min-h-5 text-sm text-signal">{message}</p>
    </form>
  )
}
