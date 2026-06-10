import { useCallback, useEffect, useRef, useState } from 'react'
import { Plus, Download, Upload, Trash2, Pencil, Check, X, Globe, Cookie } from 'lucide-react'
import { listScopes, createScope, renameScope, deleteScope } from '../lib/scopes'
import { setCookieNames } from '../lib/domain-config'
import { applyAccount } from '../lib/cookies'
import { renameAccount, deleteAccount, exportAccounts, importAccounts } from '../lib/storage'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardHeader, CardContent } from '@/components/ui/card'
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from '@/components/ui/table'
import {
  Dialog, DialogContent, DialogHeader, DialogFooter, DialogTitle, DialogDescription, DialogClose,
} from '@/components/ui/dialog'

// 把逗号 / 空格 / 换行分隔的输入解析成 Cookie 名列表
function parseNames(text) {
  return [...new Set(text.split(/[\s,，;]+/).map((s) => s.trim()).filter(Boolean))]
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
  const [renameTarget, setRenameTarget] = useState(null) // { pattern, account }
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

  const onImportFile = (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    run(async () => {
      const count = await importAccounts(await file.text())
      await reload()
      notify('ok', `成功导入 ${count} 个账号`)
    })
  }

  const totalAccounts = scopes.reduce((n, s) => n + s.accounts.length, 0)

  return (
    <div className="mx-auto max-w-4xl px-5 py-10">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">账号切换助手 · 管理</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {scopes.length} 个作用域 · {totalAccounts} 个账号
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" disabled={busy}
            onClick={() => run(async () => {
              download(await exportAccounts(null), `accounts-all-${Date.now()}.json`)
              notify('ok', '已导出全部')
            })}>
            <Download /> 导出全部
          </Button>
          <Button variant="outline" disabled={busy} onClick={() => fileInputRef.current?.click()}>
            <Upload /> 导入 JSON
          </Button>
          <input ref={fileInputRef} type="file" accept="application/json,.json" hidden onChange={onImportFile} />
          <Button disabled={busy} onClick={() => setNewOpen(true)}>
            <Plus /> 新增作用域
          </Button>
        </div>
      </header>

      {scopes.length === 0 ? (
        <Card>
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
              onRenameAccount={(account) => setRenameTarget({ pattern: scope.pattern, account })}
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

      <RenameAccountDialog
        target={renameTarget}
        onOpenChange={(open) => !open && setRenameTarget(null)}
        busy={busy}
        onSubmit={(name) =>
          run(async () => {
            await renameAccount(renameTarget.pattern, renameTarget.account.id, name)
            await reload()
            setRenameTarget(null)
            notify('ok', '已改名')
          })
        }
      />

      {message && (
        <div
          className={`fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-lg border px-4 py-2.5 text-sm font-medium shadow-lg ${
            message.type === 'ok'
              ? 'border-transparent bg-primary text-primary-foreground'
              : 'border-transparent bg-destructive text-white'
          }`}
        >
          {message.text}
        </div>
      )}
    </div>
  )
}

function ScopeCard({ scope, busy, run, reload, notify, download, onRenameAccount }) {
  const [patternDraft, setPatternDraft] = useState(scope.pattern)
  const [cookieInput, setCookieInput] = useState('')
  const dirty = patternDraft.trim().toLowerCase() !== scope.pattern

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

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0 border-b pb-4">
        <form className="flex flex-1 items-center gap-2" onSubmit={savePattern}>
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
        <div className="flex shrink-0 gap-2">
          <Button variant="outline" size="sm" disabled={busy || scope.accounts.length === 0}
            onClick={() => run(async () => {
              download(await exportAccounts(scope.pattern), `accounts-${scope.pattern}-${Date.now()}.json`)
              notify('ok', '已导出')
            })}>
            <Download /> 导出
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
            {scope.cookieNames.length === 0 && (
              <Badge variant="destructive">未设置 · 管理全部 Cookie</Badge>
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
                placeholder="加 Cookie 名，支持 前缀* 和逗号分隔"
                value={cookieInput}
                onChange={(e) => setCookieInput(e.target.value)}
                disabled={busy}
              />
              <Button type="submit" variant="outline" size="sm" disabled={busy || !cookieInput.trim()}>
                <Plus /> 添加
              </Button>
            </form>
          </div>
        </section>

        <section>
          <Label className="mb-2 block text-xs text-muted-foreground">
            Profile（{scope.accounts.length}）
          </Label>
          {scope.accounts.length === 0 ? (
            <p className="rounded-md border border-dashed px-4 py-5 text-center text-sm text-muted-foreground">
              该作用域下还没有账号——在匹配的网站上打开插件弹窗「保存当前账号」
            </p>
          ) : (
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>备注名</TableHead>
                    <TableHead>Cookie 数</TableHead>
                    <TableHead>更新时间</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {scope.accounts.map((acc) => (
                    <TableRow key={acc.id}>
                      <TableCell className="font-medium">{acc.name}</TableCell>
                      <TableCell>{acc.cookies.length}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(acc.updatedAt).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1.5">
                          <Button variant="outline" size="sm" disabled={busy}
                            title="把该账号的 Cookie 写入浏览器"
                            onClick={() => run(async () => {
                              const failed = await applyAccount(scope.pattern, acc.cookies, scope.cookieNames)
                              notify('ok', failed > 0 ? `已应用，${failed} 条失败。请刷新对应站点` : `已应用「${acc.name}」，请刷新对应站点`)
                            })}>
                            应用
                          </Button>
                          <Button variant="ghost" size="icon-sm" disabled={busy} title="改名"
                            onClick={() => onRenameAccount(acc)}>
                            <Pencil />
                          </Button>
                          <Button variant="ghost" size="icon-sm" disabled={busy} title="删除"
                            className="text-destructive hover:text-destructive"
                            onClick={() => {
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
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
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
            <p className="text-xs text-muted-foreground">
              `example.com` 整站含子域名 · `www-d.example.com` 仅该主机 · `*-d.example.com` 所有测试子域
            </p>
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

function RenameAccountDialog({ target, onOpenChange, busy, onSubmit }) {
  const [name, setName] = useState('')

  useEffect(() => {
    if (target) setName(target.account.name)
  }, [target])

  const submit = (e) => {
    e.preventDefault()
    const v = name.trim()
    if (!v) return
    onSubmit(v)
  }

  return (
    <Dialog open={!!target} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={submit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>重命名账号</DialogTitle>
            <DialogDescription>{target?.pattern} 下的「{target?.account.name}」</DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="ra-name">备注名</Label>
            <Input
              id="ra-name"
              value={name}
              maxLength={30}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">取消</Button>
            </DialogClose>
            <Button type="submit" disabled={busy || !name.trim()}>保存</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
