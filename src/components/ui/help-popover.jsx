import * as React from 'react'
import { CircleHelp } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useI18n } from '@/lib/i18n'

/** 点击问号图标弹出的轻量说明气泡，点击外部或再次点击关闭。 */
export function HelpPopover({ children, className, label }) {
  const { t } = useI18n()
  const [open, setOpen] = React.useState(false)
  const ref = React.useRef(null)
  const ariaLabel = label ?? t('dialog.help')

  React.useEffect(() => {
    if (!open) return
    const onDown = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  return (
    <span ref={ref} className="relative inline-flex">
      <button
        type="button"
        aria-label={ariaLabel}
        className="text-muted-foreground/70 transition-colors hover:text-foreground"
        onClick={() => setOpen((v) => !v)}
      >
        <CircleHelp className="size-3.5" />
      </button>
      {open && (
        <div
          role="tooltip"
          className={cn(
            'absolute left-1/2 top-6 z-50 w-64 -translate-x-1/2 rounded-lg border-0 bg-popover px-3 py-2 text-xs leading-relaxed text-popover-foreground shadow-lg ring-1 ring-border/60',
            className,
          )}
        >
          {children}
        </div>
      )}
    </span>
  )
}
