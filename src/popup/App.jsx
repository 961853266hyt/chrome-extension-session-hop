import { useCallback, useEffect, useState } from 'react'
import { Settings, Globe } from 'lucide-react'
import { getActiveTab } from '../lib/domain'
import { getDomainCookies, removeCookies, applyAccount, detectActiveAccount } from '../lib/cookies'
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
import { useI18n } from '@/lib/i18n'
import { getErrorMessage } from '@/lib/errors'
import CookieSettings from './CookieSettings'
import AccountSidebar from './AccountSidebar'

const COLLAPSE_KEY = 'popupSidebarCollapsed'

export default function App() {
  const { t } = useI18n()
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
      notify('error', getErrorMessage(e, t))
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
        notify('error', t('popup.enterNameFirst'))
        return
      }
      const cookies = await getDomainCookies(scope, patterns)
      if (cookies.length === 0) {
        notify('error', patterns?.length ? t('popup.noManagedCookie') : t('popup.selectCookieFirst'))
        return
      }
      await saveAccount(scope, name, cookies)
      setNewName('')
      if (!matching.includes(scope)) setMatching((m) => [...m, scope].sort())
      await loadScope(scope)
      notify('ok', t('popup.savedAccount', { name, count: cookies.length }))
    })

  const handleSwitch = (acc) =>
    run(async () => {
      const failed = await applyAccount(scope, acc.cookies, patterns)
      await loadScope(scope)
      if (tab?.id) await chrome.tabs.reload(tab.id)
      notify('ok', failed > 0
        ? t('popup.switchedWithFailures', { count: failed })
        : t('popup.switchedTo', { name: acc.name }))
    })

  const handleUpdate = (acc) =>
    run(async () => {
      const cookies = await getDomainCookies(scope, patterns)
      if (cookies.length === 0) {
        notify('error', patterns?.length ? t('popup.noCurrentCookie') : t('popup.selectCookieFirst'))
        return
      }
      await updateAccountCookies(scope, acc.id, cookies)
      await loadScope(scope)
      notify('ok', t('popup.syncedCurrentCookie', { name: acc.name }))
    })

  const handleLogout = () =>
    run(async () => {
      const cookies = await getDomainCookies(scope, patterns)
      if (cookies.length === 0) {
        notify('error', t('popup.noLogoutCookie'))
        return
      }
      // 当前登录态没对应任何已存账号时，清掉就找不回来了，先确认
      if (
        activeId === null &&
        !confirm(t('popup.confirmLogoutUnsaved'))
      )
        return
      await removeCookies(cookies)
      await loadScope(scope)
      if (tab?.id) await chrome.tabs.reload(tab.id)
      notify('ok', t('popup.loggedOut', { count: cookies.length }))
    })

  const handleDelete = (acc) => {
    if (!confirm(t('popup.confirmDeleteAccount', { name: acc.name }))) return
    run(async () => {
      await deleteAccount(scope, acc.id)
      await loadScope(scope)
      notify('ok', t('popup.deleted'))
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
        <p className="text-sm font-medium">{t('popup.unsupportedTitle')}</p>
        <p className="text-xs text-muted-foreground">{t('popup.unsupportedDesc')}</p>
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
        onLogout={handleLogout}
        onDelete={handleDelete}
      />

      {/* 主区域 */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="border-b px-4 pb-3 pt-3.5">
          <div className="mb-2.5 flex items-center justify-between">
            <h1 className="text-sm font-semibold tracking-tight">SessionHop</h1>
            <Button variant="ghost" size="icon-sm" title={t('popup.openOptions')} onClick={openOptions}>
              <Settings />
            </Button>
          </div>

          <div className="flex items-center gap-2.5 rounded-lg border bg-card px-3 py-2">
            <SiteIcon tab={tab} host={host} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-medium leading-tight" title={host}>{host}</p>
              <p className="truncate font-mono text-[11px] text-muted-foreground" title={t('popup.scopeTitle', { scope })}>
                {scope}
              </p>
            </div>
            {patterns?.length ? (
              <Badge variant="secondary" className="shrink-0 cursor-pointer" title={t('popup.managedCookieTitle', { count: patterns.length, names: patterns.join(', ') })}
                onClick={() => setView(view === 'cookies' ? 'list' : 'cookies')}>
                {t('popup.managedCookieBadge', { count: patterns.length })}
              </Badge>
            ) : (
              <Badge variant="destructive" className="shrink-0 cursor-pointer" title={t('popup.noCookieTitle')}
                onClick={() => setView(view === 'cookies' ? 'list' : 'cookies')}>
                {t('popup.noCookieBadge')}
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
                notify('ok', names.length
                  ? t('popup.savedCookieSettings', { count: names.length })
                  : t('popup.savedNoCookieSettings'))
              }}
            />
          ) : accounts.length === 0 ? (
            <div className="flex h-full min-h-36 flex-col items-center justify-center gap-1.5 text-center">
              <Globe className="mb-1 size-5 text-muted-foreground/60" />
              <p className="text-[13px] font-medium">{t('popup.noAccountsTitle')}</p>
              <p className="text-xs leading-relaxed text-muted-foreground">
                {t('popup.noAccountsDesc')}
              </p>
            </div>
          ) : (
            <div className="flex h-full flex-col justify-center gap-3 text-center">
              {activeAccount ? (
                <div className="rounded-xl border bg-card p-4">
                  <span className="mx-auto mb-2 flex size-11 items-center justify-center rounded-lg bg-primary text-base font-semibold text-primary-foreground">
                    {activeAccount.name.slice(0, 2).toUpperCase()}
                  </span>
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{t('popup.currentLogin')}</p>
                  <p className="mt-0.5 text-sm font-semibold">{activeAccount.name}</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {t('common.cookieCount', { count: activeAccount.cookies.length })}
                  </p>
                </div>
              ) : (
                <div className="rounded-xl border border-dashed p-4">
                  <p className="text-[13px] font-medium">{t('popup.unknownAccountTitle')}</p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    {t('popup.unknownAccountDesc')}
                  </p>
                </div>
              )}
              <p className="text-[11px] text-muted-foreground">
                {collapsed ? t('popup.expandHint') : ''}{t('popup.switchHint')}
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
                placeholder={t('popup.namePlaceholder')}
                value={newName}
                maxLength={30}
                onChange={(e) => setNewName(e.target.value)}
                disabled={busy}
              />
              <Button type="submit" disabled={busy || !newName.trim()}>
                {t('common.save')}
              </Button>
            </form>
          </div>
        )}
      </div>

      <NameDialog
        open={!!renameTarget}
        onOpenChange={(open) => !open && setRenameTarget(null)}
        title={t('popup.renameTitle')}
        description={renameTarget ? t('popup.renameDescription', { scope, name: renameTarget.name }) : ''}
        initialName={renameTarget?.name ?? ''}
        busy={busy}
        onSubmit={(name) =>
          run(async () => {
            await renameAccount(scope, renameTarget.id, name)
            setRenameTarget(null)
            await loadScope(scope)
            notify('ok', t('popup.renamed'))
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
