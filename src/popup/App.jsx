import { useCallback, useEffect, useState } from 'react'
import { Settings2, Plus, Globe } from 'lucide-react'
import { getActiveTab } from '../lib/domain'
import { getDomainCookies, applyAccount, detectActiveAccount } from '../lib/cookies'
import { getDomainConfig, getAllConfigs } from '../lib/domain-config'
import { bestMatch, matchHost } from '../lib/pattern'
import {
  getAllAccounts, getAccountsForDomain, saveAccount, updateAccountCookies,
  renameAccount, deleteAccount,
} from '../lib/storage'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Toast } from '@/components/toast'
import { NameDialog } from '@/components/name-dialog'
import CookieSettings from './CookieSettings'
import AccountSidebar from './AccountSidebar'

const COLLAPSE_KEY = 'popupSidebarCollapsed'

export default function App() {
  const [tab, setTab] = useState(null)
  const [host, setHost] = useState(null)
  const [root, setRoot] = useState(null)
  const [matching, setMatching] = useState([])
  const [scope, setScope] = useState('')
  const [config, setConfig] = useState(null)
  const [accounts, setAccounts] = useState([])
  const [activeId, setActiveId] = useState(null)
  const [newName, setNewName] = useState('')
  const [busy, setBusy] = useState(false)
  const [view, setView] = useState('list') // 'list' | 'cookies'
  const [collapsed, setCollapsed] = useState(false)
  const [renameTarget, setRenameTarget] = useState(null)
  const [message, setMessage] = useState(null)

  const patterns = config?.cookieNames

  const loadScope = useCallback(async (s) => {
    const cfg = await getDomainConfig(s)
    const accs = await getAccountsForDomain(s)
    setConfig(cfg)
    setAccounts(accs)
    setActiveId(await detectActiveAccount(s, accs, cfg?.cookieNames))
  }, [])

  useEffect(() => {
    ;(async () => {
      const stored = await chrome.storage.local.get(COLLAPSE_KEY)
      setCollapsed(!!stored[COLLAPSE_KEY])
      const { tab, host, root } = await getActiveTab()
      setTab(tab)
      setHost(host)
      setRoot(root)
      if (!host) return
      const [accs, cfgs] = await Promise.all([getAllAccounts(), getAllConfigs()])
      const keys = [...new Set([...Object.keys(accs), ...Object.keys(cfgs)])]
      const hits = keys.filter((p) => matchHost(p, host)).sort()
      setMatching(hits)
      const s = bestMatch(hits, host) ?? root
      setScope(s)
      await loadScope(s)
    })()
  }, [loadScope])

  function notify(type, text) {
    setMessage({ type, text })
    setTimeout(() => setMessage(null), 2600)
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

  const toggleSidebar = () => {
    setCollapsed((c) => {
      const next = !c
      chrome.storage.local.set({ [COLLAPSE_KEY]: next })
      return next
    })
  }

  const switchScope = (s) =>
    run(async () => {
      if (s === scope) return
      setScope(s)
      setView('list')
      await loadScope(s)
    })

  const handleSave = () =>
    run(async () => {
      const name = newName.trim()
      if (!name) {
        notify('error', '请先输入备注名')
        return
      }
      const cookies = await getDomainCookies(scope, patterns)
      if (cookies.length === 0) {
        notify('error', patterns?.length ? '没匹配到受管理的 Cookie，请检查 Cookie 组或是否已登录' : '当前作用域下没有 Cookie，可能尚未登录')
        return
      }
      await saveAccount(scope, name, cookies)
      setNewName('')
      if (!matching.includes(scope)) setMatching((m) => [...m, scope].sort())
      await loadScope(scope)
      notify('ok', `已保存「${name}」（${cookies.length} 条 Cookie）`)
    })

  const handleSwitch = (acc) =>
    run(async () => {
      const failed = await applyAccount(scope, acc.cookies, patterns)
      await loadScope(scope)
      if (tab?.id) await chrome.tabs.reload(tab.id)
      notify('ok', failed > 0 ? `已切换，${failed} 条 Cookie 写入失败` : `已切换到「${acc.name}」`)
    })

  const handleUpdate = (acc) =>
    run(async () => {
      const cookies = await getDomainCookies(scope, patterns)
      if (cookies.length === 0) {
        notify('error', '当前没有可保存的 Cookie')
        return
      }
      await updateAccountCookies(scope, acc.id, cookies)
      await loadScope(scope)
      notify('ok', `已用当前登录态覆盖「${acc.name}」`)
    })

  const handleDelete = (acc) => {
    if (!confirm(`删除账号「${acc.name}」？`)) return
    run(async () => {
      await deleteAccount(scope, acc.id)
      await loadScope(scope)
      notify('ok', '已删除')
    })
  }

  const openOptions = async () => {
    try {
      await chrome.runtime.openOptionsPage()
    } catch {
      await chrome.tabs.create({ url: chrome.runtime.getURL('src/options/index.html') })
    }
  }

  if (host === null) {
    return (
      <div className="flex min-h-44 flex-col items-center justify-center gap-1 bg-background p-6 text-foreground">
        <p className="text-sm font-medium">当前页面不支持</p>
        <p className="text-xs text-muted-foreground">仅支持 http / https 网页</p>
      </div>
    )
  }

  const activeAccount = accounts.find((a) => a.id === activeId)

  return (
    <div className="flex h-[520px] bg-background text-foreground">
      <AccountSidebar
        accounts={accounts}
        activeId={activeId}
        collapsed={collapsed}
        busy={busy}
        onToggle={toggleSidebar}
        onSwitch={handleSwitch}
        onUpdate={handleUpdate}
        onRename={setRenameTarget}
        onDelete={handleDelete}
      />

      {/* 主区域 */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="border-b px-4 pb-3 pt-3.5">
          <div className="mb-2.5 flex items-center justify-between">
            <h1 className="text-sm font-semibold tracking-tight">账号切换助手</h1>
            <Button variant="ghost" size="icon-sm" title="打开管理页" onClick={openOptions}>
              <Settings2 />
            </Button>
          </div>

          <div className="flex items-center gap-2.5 rounded-lg border bg-card px-3 py-2">
            <SiteIcon tab={tab} host={host} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-medium leading-tight" title={host}>{host}</p>
              <p className="truncate font-mono text-[11px] text-muted-foreground" title={`作用域 ${scope}`}>
                {scope}
              </p>
            </div>
            {patterns?.length ? (
              <Badge variant="secondary" className="shrink-0 cursor-pointer" title={`管理 ${patterns.length} 个 Cookie：${patterns.join(', ')}，点击编辑`}
                onClick={() => setView(view === 'cookies' ? 'list' : 'cookies')}>
                {patterns.length} 个 Cookie
              </Badge>
            ) : (
              <Badge variant="destructive" className="shrink-0 cursor-pointer" title="未设置 Cookie 组，将保存全部 Cookie。点击选择"
                onClick={() => setView(view === 'cookies' ? 'list' : 'cookies')}>
                全部 Cookie
              </Badge>
            )}
          </div>

          {matching.length > 1 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {matching.map((p) => (
                <button
                  key={p}
                  disabled={busy}
                  onClick={() => switchScope(p)}
                  className={`cursor-pointer rounded-full border px-2.5 py-0.5 font-mono text-[11px] transition-colors ${
                    p === scope
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'bg-background text-muted-foreground hover:bg-accent'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          )}
        </header>

        <main className="flex-1 overflow-y-auto px-4 py-3">
          {view === 'cookies' ? (
            <CookieSettings
              domain={scope}
              config={config}
              onClose={() => setView('list')}
              onSaved={(names) => {
                setConfig({ cookieNames: names })
                if (!matching.includes(scope)) setMatching((m) => [...m, scope].sort())
                setView('list')
                loadScope(scope)
                notify('ok', names.length ? `已设置管理 ${names.length} 个 Cookie` : '已设为管理全部 Cookie')
              }}
            />
          ) : accounts.length === 0 ? (
            <div className="flex h-full min-h-36 flex-col items-center justify-center gap-1.5 text-center">
              <Globe className="mb-1 size-5 text-muted-foreground/60" />
              <p className="text-[13px] font-medium">还没有保存账号</p>
              <p className="text-xs leading-relaxed text-muted-foreground">
                先在网页上登录，再在下方输入备注名保存
              </p>
            </div>
          ) : (
            <div className="flex h-full flex-col justify-center gap-3 text-center">
              {activeAccount ? (
                <div className="rounded-xl border bg-card p-4">
                  <span className="mx-auto mb-2 flex size-11 items-center justify-center rounded-lg bg-primary text-base font-semibold text-primary-foreground">
                    {activeAccount.name.slice(0, 2).toUpperCase()}
                  </span>
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">当前登录</p>
                  <p className="mt-0.5 text-sm font-semibold">{activeAccount.name}</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {activeAccount.cookies.length} 条 Cookie
                  </p>
                </div>
              ) : (
                <div className="rounded-xl border border-dashed p-4">
                  <p className="text-[13px] font-medium">未识别当前登录账号</p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    点左侧账号即可一键切换
                  </p>
                </div>
              )}
              <p className="text-[11px] text-muted-foreground">
                {collapsed ? '展开左栏查看备注 · ' : ''}从左侧选择账号快速切换
              </p>
            </div>
          )}
        </main>

        {view === 'list' && (
          <div className="border-t px-4 py-3">
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault()
                handleSave()
              }}
            >
              <Input
                className="h-9 flex-1"
                placeholder="备注名，如：工作号"
                value={newName}
                maxLength={30}
                onChange={(e) => setNewName(e.target.value)}
                disabled={busy}
              />
              <Button type="submit" disabled={busy || !newName.trim()}>
                <Plus /> 保存当前
              </Button>
            </form>
            <div className="mt-2 flex items-center justify-between">
              <span className="text-[11px] text-muted-foreground">
                {accounts.length > 0 ? `${accounts.length} 个账号` : '登录后保存即可一键切换'}
              </span>
              <button
                className="cursor-pointer text-[11px] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                onClick={openOptions}
              >
                管理页 →
              </button>
            </div>
          </div>
        )}
      </div>

      <NameDialog
        open={!!renameTarget}
        onOpenChange={(open) => !open && setRenameTarget(null)}
        title="重命名账号"
        description={renameTarget ? `${scope} 下的「${renameTarget.name}」` : ''}
        initialName={renameTarget?.name ?? ''}
        busy={busy}
        onSubmit={(name) =>
          run(async () => {
            await renameAccount(scope, renameTarget.id, name)
            setRenameTarget(null)
            await loadScope(scope)
            notify('ok', '已改名')
          })
        }
      />

      <Toast message={message} className="bottom-3" />
    </div>
  )
}

function SiteIcon({ tab, host }) {
  const [broken, setBroken] = useState(false)
  const url = tab?.favIconUrl
  if (url && /^https?:/.test(url) && !broken) {
    return (
      <img
        src={url}
        alt=""
        className="size-7 shrink-0 rounded-md border bg-card object-contain p-0.5"
        onError={() => setBroken(true)}
      />
    )
  }
  return (
    <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-foreground text-[12px] font-bold text-background">
      {(host?.[0] ?? '?').toUpperCase()}
    </span>
  )
}
