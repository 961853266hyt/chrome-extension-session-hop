import { useState } from 'react'
import {
  Search, ChevronLeft, ChevronsRight, MoreVertical, ArrowLeftRight, RefreshCw, Pencil, Trash2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'

function initials(name) {
  return name.slice(0, 2).toUpperCase()
}

export default function AccountSidebar({
  accounts, activeId, collapsed, busy, onToggle, onSwitch, onUpdate, onRename, onDelete,
}) {
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
            title="展开账号栏"
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
                placeholder="搜索账号"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <Button variant="ghost" size="icon-sm" title="收起" onClick={onToggle}>
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
              暂无账号
            </p>
          )
        ) : filtered.length === 0 ? (
          !collapsed && (
            <p className="px-1 py-4 text-center text-[11px] text-muted-foreground">无匹配结果</p>
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
                      title={`${acc.name}（${acc.cookies.length} 条 Cookie）${active ? ' · 当前' : ''}`}
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
                    title={active ? '当前账号 · 点击重新写入' : '点击切换到该账号'}
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
                        {active && <span className="size-1.5 shrink-0 rounded-full bg-primary" />}
                      </span>
                      <span className="block text-[10px] text-muted-foreground">
                        {acc.cookies.length} 条 Cookie
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
                        title="更多操作"
                      >
                        <MoreVertical />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onSelect={() => onSwitch(acc)}>
                        <ArrowLeftRight /> 切换
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => onUpdate(acc)}>
                        <RefreshCw /> 更新为当前登录态
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => onRename(acc)}>
                        <Pencil /> 重命名
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onSelect={() => onDelete(acc)}
                      >
                        <Trash2 /> 删除
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
