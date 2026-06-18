import { useEffect, useState } from 'react'
import { X, Sparkles, Plus } from 'lucide-react'
import { setCookieNames } from '../lib/domain-config'
import { queryDomain, cookieInScope } from '../lib/pattern'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { useI18n } from '@/lib/i18n'

// 启发式：HttpOnly 或名字像登录态的，默认推荐勾选
const AUTH_RE = /sess|auth|token|sid|login|uid|user|csrf|jwt|account|secure|remember|passport|ticket/i
function isLikelyAuth(c) {
  return c.httpOnly || AUTH_RE.test(c.name)
}

export default function CookieSettings({ domain, config, onSaved, onClose }) {
  const { t } = useI18n()
  const [cookies, setCookies] = useState([])
  const [selected, setSelected] = useState(() => new Set())
  const [extras, setExtras] = useState([]) // 配置里但当前页不存在的名字/通配
  const [custom, setCustom] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    chrome.cookies.getAll({ domain: queryDomain(domain) }).then((all) => {
      const list = all.filter((c) => cookieInScope(domain, c))
      const byName = [...new Map(list.map((c) => [c.name, c])).values()].sort((a, b) =>
        a.name.localeCompare(b.name),
      )
      setCookies(byName)
      if (config?.cookieNames?.length) {
        const present = new Set()
        const extra = []
        for (const p of config.cookieNames) {
          if (byName.some((c) => c.name === p)) present.add(p)
          else extra.push(p)
        }
        setSelected(present)
        setExtras(extra)
      } else {
        setSelected(new Set(byName.filter(isLikelyAuth).map((c) => c.name)))
      }
      setLoading(false)
    })
  }, [domain, config])

  function toggle(name) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }

  function addCustom() {
    const v = custom.trim()
    if (v && !extras.includes(v) && !selected.has(v)) setExtras((e) => [...e, v])
    setCustom('')
  }

  async function save() {
    const names = await setCookieNames(domain, [...selected, ...extras])
    onSaved(names)
  }

  const total = selected.size + extras.length

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[13px] font-semibold">{t('cookieSettings.title')}</p>
        </div>
        <Button variant="ghost" size="icon-sm" title={t('common.close')} onClick={onClose}>
          <X />
        </Button>
      </div>

      {loading ? (
        <p className="py-8 text-center text-xs text-muted-foreground">{t('cookieSettings.loading')}</p>
      ) : (
        <>
          <div className="flex gap-1.5">
            <Button variant="outline" size="sm" className="flex-1"
              onClick={() => setSelected(new Set(cookies.filter(isLikelyAuth).map((c) => c.name)))}>
              <Sparkles /> {t('cookieSettings.smartRecommend')}
            </Button>
            <Button variant="outline" size="sm" className="flex-1"
              onClick={() => setSelected(new Set(cookies.map((c) => c.name)))}>
              {t('cookieSettings.selectAll')}
            </Button>
            <Button variant="outline" size="sm" className="flex-1" onClick={() => setSelected(new Set())}>
              {t('common.clear')}
            </Button>
          </div>

          <ul className="max-h-56 divide-y overflow-y-auto rounded-lg border">
            {cookies.length === 0 && (
              <li className="px-3 py-5 text-center text-xs text-muted-foreground">
                {t('cookieSettings.empty')}
              </li>
            )}
            {cookies.map((c) => (
              <li key={c.name}>
                <label className="flex cursor-pointer items-center gap-2.5 px-3 py-2 transition-colors hover:bg-accent/50">
                  <input
                    type="checkbox"
                    className="size-3.5 shrink-0 accent-primary"
                    checked={selected.has(c.name)}
                    onChange={() => toggle(c.name)}
                  />
                  <span className="min-w-0 flex-1 truncate font-mono text-xs" title={c.name}>
                    {c.name}
                  </span>
                  {c.httpOnly && (
                    <Badge variant="secondary" className="shrink-0 px-1.5 text-[10px]">
                      HttpOnly
                    </Badge>
                  )}
                </label>
              </li>
            ))}
          </ul>

          {extras.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {extras.map((p) => (
                <Badge key={p} variant="secondary" className="font-mono">
                  {p}
                  <button
                    className="ml-0.5 cursor-pointer opacity-60 hover:opacity-100"
                    onClick={() => setExtras((e) => e.filter((x) => x !== p))}
                    title={t('common.remove')}
                  >
                    <X className="size-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}

          <form
            className="flex gap-1.5"
            onSubmit={(e) => {
              e.preventDefault()
              addCustom()
            }}
          >
            <Input
              className="h-8 flex-1 font-mono text-xs"
              placeholder={t('cookieSettings.addPlaceholder')}
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
            />
            <Button type="submit" variant="outline" size="sm" disabled={!custom.trim()}>
              <Plus /> {t('common.add')}
            </Button>
          </form>

          <Button className="w-full" onClick={save}>
            {t('cookieSettings.saveSettings', {
              status: total > 0 ? t('common.selectedCount', { count: total }) : t('common.noneSelected'),
            })}
          </Button>
        </>
      )}
    </div>
  )
}
