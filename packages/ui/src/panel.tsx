import type { HTMLAttributes } from 'react'

export interface PanelProps extends HTMLAttributes<HTMLDivElement> {
  muted?: boolean
}

export function Panel({ muted = false, className, ...props }: PanelProps) {
  const base = muted ? 'ui-panel-muted' : 'ui-panel'
  return <div className={[base, className].filter(Boolean).join(' ')} {...props} />
}
