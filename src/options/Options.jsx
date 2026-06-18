import { useCallback, useEffect, useRef, useState } from 'react'
import { Plus, Download, Upload, Trash2, Pencil, Check, X, Globe, Cookie, FileJson, ClipboardPaste, ClipboardCopy } from 'lucide-react'
import { listScopes, createScope, renameScope, deleteScope, importPreset } from '../lib/scopes'
import { setCookieNames, setLabel } from '../lib/domain-config'
import { saveAccount, renameAccount, updateAccountCookies, deleteAccount, exportAccounts, importAccounts } from '../lib/storage'
import { matchCookieName } from '../lib/cookies'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { HelpPopover } from '@/components/ui/help-popover'
import { Card, CardHeader, CardContent } from '@/components/ui/card'
import {
  Dialog, DialogContent, DialogHeader, DialogFooter, DialogTitle, DialogDescription, DialogClose,
} from '@/components/ui/dialog'
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
} from '@/components/ui/dropdown-menu'
import { Toast } from '@/components/toast'
import { EditAccountDialog } from '@/components/edit-account-dialog'
import { AddAccountDialog } from '@/components/add-account-dialog'

// 把逗号 / 空格 / 换行分隔的输入解析成 Cookie 名列表
function parseNames(text) {
  return [...new Set(text.split(/[\s,，;]+/).map((s) => s.trim()).filter(Boolean))]
}

// 由作用域模式推出一个具体主机名（去掉通配符与前导点）
function scopeHost(pattern) {
  return pattern.replace(/\*+/g, '').replace(/^\.+/, '') || pattern
}

// 手动账号：把 { name, value } 合成可还原的 Cookie 对象（绑定到该主机、一年有效）。
// __Secure-/__Host- 前缀的 Cookie 浏览器强制要求 secure，据此自动决定。
function buildManualCookie(name, value, host) {
  const secure = /^(__Secure-|__Host-)/.test(name)
  return {
    name,
    value,
    domain: host,
    hostOnly: true,
    path: '/',
    secure,
    httpOnly: false,
    sameSite: 'lax',
    session: false,
    expirationDate: Math.floor(Date.now() / 1000) + 31536000,
  }
}

async function readClipboardText() {
  let text
  try {
    text = await navigator.clipboard.readText()
  } catch {
    throw new Error('无法读取剪贴板，请检查浏览器权限')
  }
  if (!text.trim()) throw new Error('剪贴板是空的')
  return text
}

// 解析剪贴板里的 Cookie JSON：支持 Cookie 数组或 { name?, cookies: [...] }，并按 Cookie 组过滤
function parseClipboardCookies(text, cookieNames) {
  let parsed
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error('剪贴板内容不是有效的 JSON')
  }
  let cookies
  let name = null
  if (Array.isArray(parsed)) {
    cookies = parsed
  } else if (Array.isArray(parsed?.cookies)) {
    cookies = parsed.cookies
    if (typeof parsed.name === 'string' && parsed.name.trim()) name = parsed.name.trim()
  } else {
    throw new Error('未识别到 Cookie 数据（应为 Cookie 数组或含 cookies 字段的对象）')
  }
  cookies = cookies.filter(
    (c) => c?.name && typeof c.value === 'string' && matchCookieName(c.name, cookieNames),
  )
  if (cookies.length === 0) throw new Error('没有可用的 Cookie（检查格式或 Cookie 组）')
  return { cookies, name }
}

function validatePattern(raw) {
  const p = raw.trim().toLowerCase()
  if (!p) return { error: '请输入域名通配模式' }
  if (/[\s/]|^https?:/.test(p)) return { error: '不要带协议或路径，例如 www-d.example.com' }
  if (!p.includes('.')) return { error: '看起来不是有效域名' }
  return { value: p }
}

export default function Options() {
  const [scopes, setScopes] = useState([])
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState(null)
  const [newOpen, setNewOpen] = useState(false)
  const [editTarget, setEditTarget] = useState(null) // { pattern, account }
  const [addTarget, setAddTarget] = useState(null) // { pattern, cookieNames }
  const fileInputRef = useRef(null)

  const reload = useCallback(async () => {
    setScopes(await listScopes())
  }, [])

  useEffect(() => {
    reload()
  }, [reload])

  function notify(type, text) {
    setMessage({ type, text })
    setTimeout(() => setMessage(null), 2800)
  }

  async function run(fn) {
    if (busy) return
    setBusy(true)
    try {
      await fn()
    } catch (e) {
      notify('error', e?.message ?? '操作失败')
    } finally {
      setBusy(false)
    }
  }

  const download = (text, filename) => {
    const blob = new Blob([text], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  const copyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      throw new Error('无法写入剪贴板，请检查浏览器权限')
    }
  }

  // 团队预设（含 scopes 字段）走 importPreset，账号备份走 importAccounts
  const importText = async (text) => {
    let parsed
    try {
      parsed = JSON.parse(text)
    } catch {
      throw new Error('不是有效的 JSON')
    }
    if (Array.isArray(parsed?.scopes)) {
      const { created, skipped } = await importPreset(text)
      await reload()
      notify('ok', `预设已导入：新建 ${created} 个作用域${skipped ? `，跳过 ${skipped} 个已存在` : ''}`)
    } else {
      const count = await importAccounts(text)
      await reload()
      notify('ok', `成功导入 ${count} 个账号`)
    }
  }

  const onImportFile = (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    run(async () => importText(await file.text()))
  }

  const onImportClipboard = () =>
    run(async () => {
      let text
      try {
        text = await navigator.clipboard.readText()
      } catch {
        throw new Error('无法读取剪贴板，请检查浏览器权限')
      }
      if (!text.trim()) throw new Error('剪贴板是空的')
      await importText(text)
    })

  return (
    <div className="mx-auto max-w-4xl px-5 py-10">
      <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">设置</h1>
        <div className="flex gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" disabled={busy}>
                <Upload /> 导出全部
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => run(async () => {
                download(await exportAccounts(null), `accounts-all-${Date.now()}.json`)
                notify('ok', '已导出全部')
              })}>
                <FileJson /> 下载文件
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => run(async () => {
                await copyToClipboard(await exportAccounts(null))
                notify('ok', '已复制到剪贴板')
              })}>
                <ClipboardCopy /> 复制到剪贴板
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" disabled={busy}>
                <Download /> 导入
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => fileInputRef.current?.click()}>
                <FileJson /> 从文件
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={onImportClipboard}>
                <ClipboardPaste /> 从剪贴板
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <input ref={fileInputRef} type="file" accept="application/json,.json" hidden onChange={onImportFile} />
          <Button disabled={busy} onClick={() => setNewOpen(true)}>
            <Plus /> 新增作用域
          </Button>
        </div>
      </header>

      {scopes.length === 0 ? (
        <Card className="border-0 shadow-md ring-1 ring-border/60">
          <CardContent className="py-14 text-center text-sm text-muted-foreground">
            还没有任何作用域。点右上角「新增作用域」创建，
            <br />
            或打开任意网站，在插件弹窗里登录后「保存当前账号」。
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-5">
          {scopes.map((scope) => (
            <ScopeCard
              key={scope.pattern}
              scope={scope}
              busy={busy}
              run={run}
              reload={reload}
              notify={notify}
              download={download}
              onEditAccount={(account) => setEditTarget({ pattern: scope.pattern, account })}
              onAddAccount={() => setAddTarget({ pattern: scope.pattern, cookieNames: scope.cookieNames })}
            />
          ))}
        </div>
      )}

      <NewScopeDialog
        open={newOpen}
        onOpenChange={setNewOpen}
        busy={busy}
        onSubmit={(pattern, names) =>
          run(async () => {
            await createScope(pattern, names)
            await reload()
            setNewOpen(false)
            notify('ok', `已创建作用域 ${pattern}`)
          })
        }
      />

      <EditAccountDialog
        open={!!editTarget}
        onOpenChange={(open) => !open && setEditTarget(null)}
        account={editTarget?.account ?? null}
        scope={editTarget?.pattern ?? ''}
        busy={busy}
        onSubmit={(name, cookies) =>
          run(async () => {
            const { pattern, account } = editTarget
            if (name !== account.name) await renameAccount(pattern, account.id, name)
            await updateAccountCookies(pattern, account.id, cookies)
            await reload()
            setEditTarget(null)
            notify('ok', '已保存')
          })
        }
      />

      <AddAccountDialog
        open={!!addTarget}
        onOpenChange={(open) => !open && setAddTarget(null)}
        scope={addTarget?.pattern ?? ''}
        cookieNames={addTarget?.cookieNames ?? []}
        busy={busy}
        onSubmit={(name, pairs) =>
          run(async () => {
            const host = scopeHost(addTarget.pattern)
            const cookies = pairs.map((p) => buildManualCookie(p.name, p.value, host))
            await saveAccount(addTarget.pattern, name, cookies)
            await reload()
            setAddTarget(null)
            notify('ok', `已添加账号「${name}」`)
          })
        }
      />

      <Toast message={message} className="bottom-6" />
    </div>
  )
}

function ScopeCard({ scope, busy, run, reload, notify, download, onEditAccount, onAddAccount }) {
  const [patternDraft, setPatternDraft] = useState(scope.pattern)
  const [cookieInput, setCookieInput] = useState('')
  const [editingLabel, setEditingLabel] = useState(false)
  const [labelDraft, setLabelDraft] = useState(scope.label)
  const dirty = patternDraft.trim().toLowerCase() !== scope.pattern

  const saveLabel = () => {
    setEditingLabel(false)
    if (labelDraft.trim() === scope.label) return
    run(async () => {
      await setLabel(scope.pattern, labelDraft)
      await reload()
    })
  }

  const savePattern = (e) => {
    e.preventDefault()
    const { value, error } = validatePattern(patternDraft)
    if (error) return notify('error', error)
    run(async () => {
      await renameScope(scope.pattern, value)
      await reload()
      notify('ok', `作用域已改为 ${value}`)
    })
  }

  const addCookieNames = (e) => {
    e.preventDefault()
    const names = parseNames(cookieInput)
    if (names.length === 0) return
    run(async () => {
      await setCookieNames(scope.pattern, [...scope.cookieNames, ...names])
      setCookieInput('')
      await reload()
    })
  }

  const removeCookieName = (name) =>
    run(async () => {
      await setCookieNames(scope.pattern, scope.cookieNames.filter((n) => n !== name))
      await reload()
    })

  // 从剪贴板读取一段 Cookie JSON，直接新建一个账号
  const addFromClipboard = () =>
    run(async () => {
      const { cookies, name } = parseClipboardCookies(await readClipboardText(), scope.cookieNames)
      const accName = name ?? '剪贴板账号'
      await saveAccount(scope.pattern, accName, cookies)
      await reload()
      notify('ok', `已从剪贴板添加「${accName}」（${cookies.length} 个 Cookie）`)
    })

  // 把单个账号复制到剪贴板（name + cookies）
  const copyAccount = (acc) =>
    run(async () => {
      const json = JSON.stringify(
        { app: 'account-manager', version: 1, name: acc.name, domain: scope.pattern, cookies: acc.cookies },
        null,
        2,
      )
      try {
        await navigator.clipboard.writeText(json)
      } catch {
        throw new Error('无法写入剪贴板，请检查浏览器权限')
      }
      notify('ok', `已复制「${acc.name}」到剪贴板`)
    })

  // 用剪贴板里的 Cookie 覆盖某个账号（保留其名字）
  const overwriteFromClipboard = (acc) =>
    run(async () => {
      const { cookies } = parseClipboardCookies(await readClipboardText(), scope.cookieNames)
      await updateAccountCookies(scope.pattern, acc.id, cookies)
      await reload()
      notify('ok', `已用剪贴板覆盖「${acc.name}」（${cookies.length} 个 Cookie）`)
    })

  return (
    <Card className="border-0 shadow-md ring-1 ring-border/60">
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <form className="flex items-center gap-2" onSubmit={savePattern}>
            <Globe className="size-4 shrink-0 text-muted-foreground" />
            <Input
              className="h-8 max-w-72 font-mono text-[13px]"
              value={patternDraft}
              onChange={(e) => setPatternDraft(e.target.value)}
              disabled={busy}
              aria-label="域名通配模式"
            />
            {dirty && (
              <>
                <Button type="submit" size="icon-sm" variant="outline" disabled={busy} title="保存通配">
                  <Check />
                </Button>
                <Button type="button" size="icon-sm" variant="ghost" disabled={busy} title="还原"
                  onClick={() => setPatternDraft(scope.pattern)}>
                  <X />
                </Button>
              </>
            )}
          </form>
          {editingLabel ? (
            <Input
              autoFocus
              className="h-8 w-40 text-[13px]"
              value={labelDraft}
              maxLength={20}
              placeholder="别名"
              aria-label="作用域别名"
              onChange={(e) => setLabelDraft(e.target.value)}
              onBlur={saveLabel}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur() } }}
            />
          ) : (
            <button
              type="button"
              disabled={busy}
              title={scope.label ? '点击编辑别名' : '点击添加别名'}
              onClick={() => { setLabelDraft(scope.label); setEditingLabel(true) }}
              className={
                scope.label
                  ? 'inline-flex shrink-0 items-center rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90'
                  : 'inline-flex shrink-0 items-center gap-1 rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90'
              }
            >
              {scope.label ? scope.label : (<><Plus className="size-3" /> 别名</>)}
            </button>
          )}
        </div>
        <div className="flex shrink-0 gap-2">
          <Button size="sm" disabled={busy || scope.accounts.length === 0}
            onClick={() => run(async () => {
              download(await exportAccounts(scope.pattern), `accounts-${scope.pattern}-${Date.now()}.json`)
              notify('ok', '已导出')
            })}>
            <Upload /> 导出
          </Button>
          <Button variant="destructive" size="sm" disabled={busy}
            onClick={() => {
              if (!confirm(`删除作用域「${scope.pattern}」及其下全部账号？此操作不可撤销。`)) return
              run(async () => {
                await deleteScope(scope.pattern)
                await reload()
                notify('ok', '已删除作用域')
              })
            }}>
            <Trash2 /> 删除
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-5 pt-4">
        <section>
          <div className="mb-2 flex items-center gap-2">
            <Cookie className="size-4 text-muted-foreground" />
            <Label className="text-xs text-muted-foreground">Cookie 组</Label>
            <HelpPopover label="Cookie 名规则">
              填写要管理的 Cookie 名，多个用 <code className="font-mono">,</code> 分隔；支持 <code className="font-mono">前缀*</code> 通配，如 <code className="font-mono">__Secure-*</code>。留空表示不管理任何 Cookie。
            </HelpPopover>
            {scope.cookieNames.length === 0 && (
              <Badge variant="destructive">未选择 Cookie</Badge>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {scope.cookieNames.map((name) => (
              <Badge key={name} variant="secondary" className="font-mono">
                {name}
                <button
                  className="ml-0.5 cursor-pointer opacity-60 hover:opacity-100"
                  onClick={() => removeCookieName(name)}
                  disabled={busy}
                  title="移除"
                >
                  <X className="size-3" />
                </button>
              </Badge>
            ))}
            <form className="flex items-center gap-2" onSubmit={addCookieNames}>
              <Input
                className="h-8 w-56 font-mono text-xs"
                value={cookieInput}
                onChange={(e) => setCookieInput(e.target.value)}
                disabled={busy}
              />
              <Button type="submit" size="sm" disabled={busy || !cookieInput.trim()}>
                <Plus /> 添加
              </Button>
            </form>
          </div>
        </section>

        <section>
          <div className="mb-2 flex items-center justify-between">
            <Label className="text-xs text-muted-foreground">
              Profile（{scope.accounts.length}）
            </Label>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={busy} onClick={addFromClipboard}>
                <ClipboardPaste /> 从剪贴板
              </Button>
              <Button variant="outline" size="sm" disabled={busy} onClick={onAddAccount}>
                <Plus /> 添加账号
              </Button>
            </div>
          </div>
          {scope.accounts.length === 0 ? (
            <p className="rounded-xl bg-muted/40 px-4 py-6 text-center text-sm text-muted-foreground">
              该作用域下还没有账号——在匹配的网站上打开插件弹窗「保存当前账号」，或点右上角「添加账号」手动录入
            </p>
          ) : (
            <div className="space-y-2.5">
              {scope.accounts.map((acc) => (
                <div
                  key={acc.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => !busy && onEditAccount(acc)}
                  onKeyDown={(e) => {
                    if ((e.key === 'Enter' || e.key === ' ') && !busy) {
                      e.preventDefault()
                      onEditAccount(acc)
                    }
                  }}
                  className="flex cursor-pointer items-center justify-between gap-3 rounded-xl bg-card px-4 py-3 shadow-sm ring-1 ring-border/60 transition-shadow hover:shadow-md"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{acc.name}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <Button variant="ghost" size="icon-sm" disabled={busy} title="复制到剪贴板"
                      onClick={(e) => { e.stopPropagation(); copyAccount(acc) }}>
                      <ClipboardCopy />
                    </Button>
                    <Button variant="ghost" size="icon-sm" disabled={busy} title="从剪贴板覆盖"
                      onClick={(e) => { e.stopPropagation(); overwriteFromClipboard(acc) }}>
                      <ClipboardPaste />
                    </Button>
                    <Button variant="ghost" size="icon-sm" disabled={busy} title="编辑"
                      onClick={(e) => { e.stopPropagation(); onEditAccount(acc) }}>
                      <Pencil />
                    </Button>
                    <Button variant="ghost" size="icon-sm" disabled={busy} title="删除"
                      className="text-destructive hover:text-destructive"
                      onClick={(e) => {
                        e.stopPropagation()
                        if (!confirm(`删除账号「${acc.name}」？`)) return
                        run(async () => {
                          await deleteAccount(scope.pattern, acc.id)
                          await reload()
                          notify('ok', '已删除账号')
                        })
                      }}>
                      <Trash2 />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </CardContent>
    </Card>
  )
}

function NewScopeDialog({ open, onOpenChange, busy, onSubmit }) {
  const [pattern, setPattern] = useState('')
  const [names, setNames] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (open) {
      setPattern('')
      setNames('')
      setError('')
    }
  }, [open])

  const submit = (e) => {
    e.preventDefault()
    const { value, error } = validatePattern(pattern)
    if (error) return setError(error)
    onSubmit(value, parseNames(names))
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={submit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>新增作用域</DialogTitle>
            <DialogDescription>
              域名通配决定账号分组和 Cookie 抓取范围；Cookie 组限定只管理哪些 Cookie。
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="ns-pattern">域名通配模式</Label>
            <Input
              id="ns-pattern"
              className="font-mono"
              placeholder="如 www-d.example.com 或 *.example.com"
              value={pattern}
              onChange={(e) => { setPattern(e.target.value); setError('') }}
              autoFocus
            />
            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="ns-names">Cookie 组（可选）</Label>
            <Input
              id="ns-names"
              className="font-mono"
              placeholder="如 sessionid, __Secure-*（逗号分隔，留空 = 全部）"
              value={names}
              onChange={(e) => setNames(e.target.value)}
            />
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">取消</Button>
            </DialogClose>
            <Button type="submit" disabled={busy}>创建</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
