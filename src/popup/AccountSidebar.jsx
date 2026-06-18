import { useState } from 'react'
import {
  Search, ChevronLeft, ChevronsRight, MoreVertical, ArrowLeftRight, RefreshCw, Pencil, LogOut, Trash2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useI18n } from '@/lib/i18n'
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'

function initials(name) {
  return name.slice(0, 2).toUpperCase()
}

export default function AccountSidebar({
  accounts, activeId, collapsed, busy, onToggle, onSwitch, onUpdate, onRename, onLogout, onDelete,
}) {
  const { t } = useI18n()
  const [query, setQuery] = useState('')
  const q = query.trim().toLowerCase()
  const filtered = q ? accounts.filter((a) => a.name.toLowerCase().includes(q)) : accounts

  return (
    <aside
      className={cn(
        'flex shrink-0 flex-col border-r bg-card/40 transition-[width] duration-200',
        collapsed ? 'w-14' : 'w-48',
      )}
    >
      {/* 顶部：搜索 + 折叠按钮 */}
      <div className="flex h-12 items-center gap-1.5 border-b px-2">
        {collapsed ? (
          <Button
            variant="ghost"
            size="icon-sm"
            className="mx-auto"
            title={t('sidebar.expand')}
            onClick={onToggle}
          >
            <ChevronsRight />
          </Button>
        ) : (
          <>
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="h-7 pl-7 text-xs"
                placeholder={t('sidebar.searchPlaceholder')}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <Button variant="ghost" size="icon-sm" title={t('sidebar.collapse')} onClick={onToggle}>
              <ChevronLeft />
            </Button>
          </>
        )}
      </div>

      {/* 账号列表 */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden p-1.5">
        {accounts.length === 0 ? (
          !collapsed && (
            <p className="px-1 py-4 text-center text-[11px] leading-relaxed text-muted-foreground">
              {t('sidebar.empty')}
            </p>
          )
        ) : filtered.length === 0 ? (
          !collapsed && (
            <p className="px-1 py-4 text-center text-[11px] text-muted-foreground">{t('sidebar.noMatches')}</p>
          )
        ) : (
          <ul className="space-y-1">
            {filtered.map((acc) => {
              const active = acc.id === activeId
              if (collapsed) {
                return (
                  <li key={acc.id}>
                    <button
                      disabled={busy}
                      onClick={() => onSwitch(acc)}
                      title={`${acc.name} (${t('common.cookieCount', { count: acc.cookies.length })})${active ? ` · ${t('sidebar.current')}` : ''}`}
                      className="flex w-full cursor-pointer items-center justify-center rounded-md py-1.5 transition-colors hover:bg-accent disabled:opacity-50"
                    >
                      <span
                        className={cn(
                          'flex size-8 items-center justify-center rounded-md text-[12px] font-semibold transition-shadow',
                          active
                            ? 'bg-primary text-primary-foreground ring-2 ring-primary ring-offset-1 ring-offset-background'
                            : 'bg-muted text-foreground',
                        )}
                      >
                        {initials(acc.name)}
                      </span>
                    </button>
                  </li>
                )
              }
              return (
                <li
                  key={acc.id}
                  className={cn(
                    'group flex items-center gap-1 rounded-md pr-0.5 transition-colors',
                    active ? 'bg-accent' : 'hover:bg-accent/60',
                  )}
                >
                  <button
                    disabled={busy}
                    onClick={() => onSwitch(acc)}
                    title={active ? t('sidebar.currentAccountWriteAgain') : t('sidebar.switchToAccount')}
                    className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 p-1.5 text-left disabled:opacity-50"
                  >
                    <span
                      className={cn(
                        'flex size-7 shrink-0 items-center justify-center rounded-md text-[11px] font-semibold',
                        active ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground',
                      )}
                    >
                      {initials(acc.name)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1 text-[12px] font-medium leading-tight">
                        <span className="truncate">{acc.name}</span>
                        {active && <span className="size-1.5 shrink-0 rounded-full bg-green-600" />}
                      </span>
                      <span className="block text-[10px] text-muted-foreground">
                        {t('common.cookieCount', { count: acc.cookies.length })}
                      </span>
                    </span>
                  </button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        disabled={busy}
                        className="size-6 shrink-0 opacity-0 transition-opacity group-hover:opacity-100 data-[state=open]:opacity-100"
                        title={t('sidebar.moreActions')}
                      >
                        <MoreVertical />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onSelect={() => onSwitch(acc)}>
                        <ArrowLeftRight /> {t('sidebar.switch')}
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => onUpdate(acc)}>
                        <RefreshCw /> {t('sidebar.syncFromBrowser')}
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => onRename(acc)}>
                        <Pencil /> {t('sidebar.rename')}
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={onLogout}>
                        <LogOut /> {t('sidebar.logout')}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onSelect={() => onDelete(acc)}
                      >
                        <Trash2 /> {t('common.delete')}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </aside>
  )
}
