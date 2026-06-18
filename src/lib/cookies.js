import { queryDomain, cookieInScope } from './pattern'

// 根据 cookie 自身的 domain/path/secure 还原出可用于 set/remove 的 URL
function cookieUrl(cookie) {
  const host = cookie.domain.startsWith('.') ? cookie.domain.slice(1) : cookie.domain
  return `${cookie.secure ? 'https' : 'http'}://${host}${cookie.path}`
}

/**
 * 判断某 Cookie 名是否落在配置的「要管理」名单内。
 * - patterns 为空 / 未配置：返回 false，必须由用户明确选择 Cookie 名
 * - 支持 `前缀*` 通配，如 `__Secure-*`
 */
export function matchCookieName(name, patterns) {
  if (!patterns || patterns.length === 0) return false
  return patterns.some((p) =>
    p.endsWith('*') ? name.startsWith(p.slice(0, -1)) : name === p,
  )
}

/** 读取作用域（通配模式）下的 Cookie（含 HttpOnly），再按 cookie 名 patterns 过滤 */
export async function getDomainCookies(scope, namePatterns) {
  const all = await chrome.cookies.getAll({ domain: queryDomain(scope) })
  return all.filter((c) => cookieInScope(scope, c) && matchCookieName(c.name, namePatterns))
}

/** 删除指定的一组 Cookie */
export async function removeCookies(cookies) {
  await Promise.all(
    cookies.map((c) =>
      chrome.cookies
        .remove({ url: cookieUrl(c), name: c.name, storeId: c.storeId })
        .catch(() => {}),
    ),
  )
}

/**
 * 写回一组 Cookie。返回写入失败的数量（个别 Cookie 因 __Host- 前缀、
 * sameSite 限制等原因可能失败，不影响整体）。
 */
export async function restoreCookies(cookies) {
  let failed = 0
  for (const c of cookies) {
    const details = {
      url: cookieUrl(c),
      name: c.name,
      value: c.value,
      path: c.path,
      secure: c.secure,
      httpOnly: c.httpOnly,
      storeId: c.storeId,
    }
    // hostOnly 的 Cookie 不能显式传 domain，否则会变成带点的 domain cookie
    if (!c.hostOnly) details.domain = c.domain
    // 会话 Cookie 不传 expirationDate
    if (!c.session && c.expirationDate) details.expirationDate = c.expirationDate
    if (c.sameSite && c.sameSite !== 'unspecified') details.sameSite = c.sameSite
    try {
      await chrome.cookies.set(details)
    } catch (e) {
      failed += 1
      console.warn('写入 Cookie 失败:', c.name, e)
    }
  }
  return failed
}

/**
 * 启发式判断当前登录态对应哪个已存账号：受管理 Cookie 的 name→value
 * 与某账号完全一致即视为「当前」。返回账号 id 或 null。
 */
export async function detectActiveAccount(scope, accounts, namePatterns) {
  if (!accounts?.length) return null
  const current = await getDomainCookies(scope, namePatterns)
  if (current.length === 0) return null
  const values = new Map(current.map((c) => [c.name, c.value]))
  const hit = accounts.find(
    (a) => a.cookies.length > 0 && a.cookies.every((c) => values.get(c.name) === c.value),
  )
  return hit?.id ?? null
}

/**
 * 切换到目标账号：只清除作用域内「受管理」的 Cookie，再写回目标账号的 Cookie，
 * 不会动作用域外或无关的 Cookie（分析/追踪等）。返回写入失败数量。
 */
export async function applyAccount(scope, targetCookies, namePatterns) {
  const current = await chrome.cookies.getAll({ domain: queryDomain(scope) })
  const targetNames = new Set(targetCookies.map((c) => c.name))
  // 清除：作用域内、且命中名单或目标账号里存在的同名 Cookie（防配置漂移残留）
  const toRemove = current.filter(
    (c) =>
      cookieInScope(scope, c) &&
      (matchCookieName(c.name, namePatterns) || targetNames.has(c.name)),
  )
  await removeCookies(toRemove)
  return restoreCookies(targetCookies)
}
