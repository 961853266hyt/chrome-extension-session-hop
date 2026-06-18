// 每个作用域（域名通配模式）可配置「要管理的 Cookie 名字」。
// 存储结构：chrome.storage.local 中 domainConfigs = { [pattern]: { cookieNames: string[] } }
// cookieNames 为空数组时表示「未选择 Cookie，不管理任何 Cookie」，但记录本身保留——
// 这样在管理页新建的作用域即使还没有账号、没选 Cookie 也能存在。

const KEY = 'domainConfigs'

export async function getAllConfigs() {
  const data = await chrome.storage.local.get(KEY)
  return data[KEY] ?? {}
}

export async function getDomainConfig(domain) {
  const all = await getAllConfigs()
  return all[domain] ?? null
}

/** 设置某作用域要管理的 Cookie 名字；空数组也会保留记录（含义为不管理任何 Cookie） */
export async function setCookieNames(domain, names) {
  const all = await getAllConfigs()
  const cleaned = [...new Set((names ?? []).map((n) => n.trim()).filter(Boolean))]
  all[domain] = { ...all[domain], cookieNames: cleaned }
  await chrome.storage.local.set({ [KEY]: all })
  return cleaned
}

/** 设置某作用域的别名（label，单个）；留空则清除 */
export async function setLabel(domain, label) {
  const all = await getAllConfigs()
  const cur = all[domain] ?? { cookieNames: [] }
  all[domain] = { ...cur, label: label.trim() || undefined }
  await chrome.storage.local.set({ [KEY]: all })
}
