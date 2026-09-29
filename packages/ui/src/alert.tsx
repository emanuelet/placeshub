import type { HTMLAttributes } from 'react'

export interface AlertProps extends HTMLAttributes<HTMLParagraphElement> {
  tone?: 'error' | 'success'
}

export function Alert({ tone = 'error', className, ...props }: AlertProps) {
  return (
    <p
      role={tone === 'error' ? 'alert' : 'status'}
      className={[`ui-alert-${tone}`, className].filter(Boolean).join(' ')}
      {...props}
    />
  )
}
