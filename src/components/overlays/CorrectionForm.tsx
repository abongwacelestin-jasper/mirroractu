import React, { useState } from 'react'

import { buttonClass } from '@/components/ui'

/** The corrections form. Not connected yet: it validates and says plainly that nothing is sent. */
export function CorrectionForm({ idPrefix = 'fb' }: { idPrefix?: string }) {
  const [text, setText] = useState('')
  const [message, setMessage] = useState('')
  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault()
        setMessage(text.trim() ? 'Not sent. The corrections desk opens at launch.' : 'Describe what we should check.')
      }}
    >
      <label htmlFor={`${idPrefix}-text`} className="mt-3 block text-sm font-semibold">What should we check?</label>
      <textarea
        id={`${idPrefix}-text`}
        rows={4}
        value={text}
        onChange={(e) => setText(e.target.value)}
        className="mt-1.5 w-full border border-ink/35 bg-white px-3 py-2.5 text-[15px]"
      />
      <label htmlFor={`${idPrefix}-mail`} className="mt-3 block text-sm font-semibold">Your email, if you want a reply</label>
      <input id={`${idPrefix}-mail`} type="email" className="mt-1.5 w-full border border-ink/35 bg-white px-3 py-2.5 text-[15px]" />
      <button type="submit" className={buttonClass({ size: 'sm', className: 'mt-3.5' })}>Send correction</button>
      <p role="status" className="mt-2.5 min-h-5 text-sm text-muted">{message}</p>
    </form>
  )
}
