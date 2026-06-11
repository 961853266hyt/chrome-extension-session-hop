// 存储结构：chrome.storage.local 中 accounts = { [rootDomain]: Account[] }
// Account: { id, name, domain, cookies, createdAt, updatedAt }

const KEY = 'accounts'

export async function getAllAccounts() {
  const data = await chrome.storage.local.get(KEY)
  return data[KEY] ?? {}
}

export async function getAccountsForDomain(domain) {
  const all = await getAllAccounts()
  return all[domain] ?? []
}

export async function saveAccount(domain, name, cookies) {
  const all = await getAllAccounts()
  const list = all[domain] ?? []
  const now = Date.now()
  const account = {
    id: crypto.randomUUID(),
    name,
    domain,
    cookies,
    createdAt: now,
    updatedAt: now,
  }
  all[domain] = [...list, account]
  await chrome.storage.local.set({ [KEY]: all })
  return account
}

export async function updateAccountCookies(domain, id, cookies) {
  const all = await getAllAccounts()
  all[domain] = (all[domain] ?? []).map((a) =>
    a.id === id ? { ...a, cookies, updatedAt: Date.now() } : a,
  )
  await chrome.storage.local.set({ [KEY]: all })
}

export async function renameAccount(domain, id, name) {
  const all = await getAllAccounts()
  all[domain] = (all[domain] ?? []).map((a) =>
    a.id === id ? { ...a, name, updatedAt: Date.now() } : a,
  )
  await chrome.storage.local.set({ [KEY]: all })
}

export async function deleteAccount(domain, id) {
  const all = await getAllAccounts()
  all[domain] = (all[domain] ?? []).filter((a) => a.id !== id)
  if (all[domain].length === 0) delete all[domain]
  await chrome.storage.local.set({ [KEY]: all })
}

/** 导出为 JSON 字符串。domain 为空时导出全部域名的账号 */
export async function exportAccounts(domain) {
  const all = await getAllAccounts()
  const accounts = domain ? { [domain]: all[domain] ?? [] } : all
  return JSON.stringify(
    { app: 'sessionhop', version: 1, exportedAt: new Date().toISOString(), accounts },
    null,
    2,
  )
}

/** 导入 JSON，按域名合并追加（重新生成 id 避免冲突）。返回导入的账号数 */
export async function importAccounts(jsonText) {
  let parsed
  try {
    parsed = JSON.parse(jsonText)
  } catch {
    throw new Error('不是有效的 JSON 文件')
  }
  const incoming = parsed?.accounts
  if (!incoming || typeof incoming !== 'object') {
    throw new Error('文件格式不正确，缺少 accounts 字段')
  }
  const all = await getAllAccounts()
  let count = 0
  for (const [domain, list] of Object.entries(incoming)) {
    if (!Array.isArray(list)) continue
    for (const acc of list) {
      if (!acc?.name || !Array.isArray(acc.cookies)) continue
      const now = Date.now()
      all[domain] = all[domain] ?? []
      all[domain].push({
        id: crypto.randomUUID(),
        name: acc.name,
        domain,
        cookies: acc.cookies,
        createdAt: acc.createdAt ?? now,
        updatedAt: now,
      })
      count += 1
    }
  }
  await chrome.storage.local.set({ [KEY]: all })
  return count
}
