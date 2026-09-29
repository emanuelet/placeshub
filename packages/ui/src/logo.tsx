import type { SVGProps } from 'react'

export function LogoMark(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 64 64" width="28" height="28" aria-hidden="true" {...props}>
      <rect width="64" height="64" rx="15" fill="#3155d9" />
      <path
        d="M32 53C32 53 16.5 39.5 16.5 28.5a15.5 15.5 0 0 1 31 0C47.5 39.5 32 53 32 53Z"
        fill="#ffffff"
      />
      <circle cx="32" cy="28.5" r="6.5" fill="#ea580c" />
    </svg>
  )
}

export function Logo({ className }: { className?: string }) {
  return (
    <span
      className={['inline-flex items-center gap-2 font-bold tracking-tight', className]
        .filter(Boolean)
        .join(' ')}
    >
      <LogoMark />
      <span>
        Places<span className="text-primary">Hub</span>
      </span>
    </span>
  )
}
