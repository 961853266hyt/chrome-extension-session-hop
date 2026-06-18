import { appError } from './errors'

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
    label: configs[pattern]?.label ?? '',
    cookieNames: configs[pattern]?.cookieNames ?? [],
    accounts: accounts[pattern] ?? [],
  }))
}

/** 新建一个空作用域（仅域名通配 + Cookie 组，账号后续再存）。已存在时报错 */
export async function createScope(pattern, cookieNames = []) {
  const d = await chrome.storage.local.get([A, C])
  if (d[A]?.[pattern] || d[C]?.[pattern]) {
    throw appError('scopeExists', { pattern })
  }
  const configs = d[C] ?? {}
  configs[pattern] = { cookieNames }
  await chrome.storage.local.set({ [C]: configs })
}

/**
 * 导入团队预设：批量创建作用域（仅域名通配 + Cookie 组，不含任何账号数据）。
 * 已存在的作用域跳过、不覆盖成员自己的数据。返回 { created, skipped }。
 */
export async function importPreset(jsonText) {
  let parsed
  try {
    parsed = JSON.parse(jsonText)
  } catch {
    throw appError('jsonFileInvalid')
  }
  const list = parsed?.scopes
  if (!Array.isArray(list)) {
    throw appError('scopesMissing')
  }
  const d = await chrome.storage.local.get([A, C])
  const accounts = d[A] ?? {}
  const configs = d[C] ?? {}
  let created = 0
  let skipped = 0
  for (const s of list) {
    const pattern = typeof s?.pattern === 'string' ? s.pattern.trim().toLowerCase() : ''
    if (!pattern) continue
    if (accounts[pattern] || configs[pattern]) {
      skipped += 1
      continue
    }
    const names = Array.isArray(s.cookieNames)
      ? [...new Set(s.cookieNames.map((n) => String(n).trim()).filter(Boolean))]
      : []
    const label = typeof s.label === 'string' ? s.label.trim() : ''
    configs[pattern] = { cookieNames: names, ...(label ? { label } : {}) }
    created += 1
  }
  await chrome.storage.local.set({ [C]: configs })
  return { created, skipped }
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
