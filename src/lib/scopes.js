// 作用域横跨 accounts 与 domainConfigs 两个存储，这里提供整体的列举 / 改名 / 删除。
const A = 'accounts'
const C = 'domainConfigs'

/** 列出所有作用域及其 Cookie 组、profile 列表，按模式排序 */
export async function listScopes() {
  const d = await chrome.storage.local.get([A, C])
  const accounts = d[A] ?? {}
  const configs = d[C] ?? {}
  const keys = [...new Set([...Object.keys(accounts), ...Object.keys(configs)])].sort()
  return keys.map((pattern) => ({
    pattern,
    cookieNames: configs[pattern]?.cookieNames ?? [],
    accounts: accounts[pattern] ?? [],
  }))
}

/** 新建一个空作用域（仅域名通配 + Cookie 组，账号后续再存）。已存在时报错 */
export async function createScope(pattern, cookieNames = []) {
  const d = await chrome.storage.local.get([A, C])
  if (d[A]?.[pattern] || d[C]?.[pattern]) {
    throw new Error(`作用域「${pattern}」已存在`)
  }
  const configs = d[C] ?? {}
  configs[pattern] = { cookieNames }
  await chrome.storage.local.set({ [C]: configs })
}

/** 重命名作用域（域名通配模式）。目标已存在时合并 profile，配置保留目标原有的 */
export async function renameScope(oldKey, newKeyRaw) {
  const newKey = newKeyRaw.trim()
  if (!newKey || newKey === oldKey) return
  const d = await chrome.storage.local.get([A, C])
  const accounts = d[A] ?? {}
  const configs = d[C] ?? {}

  if (accounts[oldKey]) {
    const moved = accounts[oldKey].map((a) => ({ ...a, domain: newKey }))
    accounts[newKey] = [...(accounts[newKey] ?? []), ...moved]
    delete accounts[oldKey]
  }
  if (configs[oldKey]) {
    if (!configs[newKey]) configs[newKey] = configs[oldKey]
    delete configs[oldKey]
  }
  await chrome.storage.local.set({ [A]: accounts, [C]: configs })
}

/** 删除整个作用域（其 Cookie 组与所有 profile） */
export async function deleteScope(key) {
  const d = await chrome.storage.local.get([A, C])
  const accounts = d[A] ?? {}
  const configs = d[C] ?? {}
  delete accounts[key]
  delete configs[key]
  await chrome.storage.local.set({ [A]: accounts, [C]: configs })
}
