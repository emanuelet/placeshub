import type { HTMLAttributes } from 'react'

export function EmptyState({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={['ui-empty-state', className].filter(Boolean).join(' ')} {...props} />
}
