// ĐĂNG NHẬP NHIỀU MÁY (anh yêu cầu 01/11/2026): tài khoản phụ huynh (thông tin, gói, PIN phụ huynh, danh sách con)
// lưu ở máy chủ (/api/account). Máy nào cũng đăng nhập được bằng số điện thoại hoặc email + mật khẩu.
// Trên máy vẫn giữ một bản tài khoản (ontap.account.v1) để mở app không cần mạng, như trước.
// Bài học, báo cáo, bộ từ của từng con vẫn lưu trên máy con học (khoá <tên kho>::<id con>), CHƯA đồng bộ giữa các máy.
//
// Máy giữ: ontap.acctoken.v1 (chìa khoá máy chủ cấp khi đăng nhập/đăng ký — giữ cả khi đăng xuất, để "Quên mật khẩu"
// trên máy này vẫn làm được), ontap.acctsync.v1 ({ dirty: có thay đổi chưa gửi, conflict: lý do chưa đồng bộ được }),
// ontap.accounts.prev.v1 (bản sao tài khoản cũ của máy khi máy chuyển sang tài khoản khác — không mất danh sách con).

const TOKEN = 'ontap.acctoken.v1'
const STATE = 'ontap.acctsync.v1'
const PREV = 'ontap.accounts.prev.v1'
const ENDPOINT = '/api/account'

const read = (k) => { try { return localStorage.getItem(k) } catch { return null } }
const write = (k, v) => { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v) } catch { /* noop */ } }

export const getToken = () => read(TOKEN) || ''
export const setToken = (t) => write(TOKEN, t || null)
// Số điện thoại nằm trong chìa khoá (phần đầu, base64url) — để biết chìa khoá này của tài khoản nào.
export function tokenPhone(t) {
  try {
    const b = String(t || '').split('.')[0].replace(/-/g, '+').replace(/_/g, '/')
    return atob(b + '==='.slice((b.length + 3) % 4))
  } catch { return '' }
}
export function getSyncState() { try { return JSON.parse(read(STATE) || '{}') || {} } catch { return {} } }
export function setSyncState(patch) { write(STATE, JSON.stringify({ ...getSyncState(), ...patch, at: Date.now() })) }

export const onlyDigits = (s) => String(s == null ? '' : s).replace(/\D+/g, '')
export const validPhone = (p) => /^\d{8,12}$/.test(String(p || ''))
export const phoneOf = (acc) => (acc ? String(acc.phone || acc.username || '') : '')
const passOf = (acc) => (acc ? acc.parentPass || acc.password || '' : '')

// Gọi máy chủ. Mất mạng / máy chủ chưa gắn kho / kho lỗi -> { offline: true } (máy dùng tài khoản trên máy như cũ).
export async function call(action, body = {}, token = '', timeoutMs = 10000) {
  const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null
  const timer = ctrl ? setTimeout(() => ctrl.abort(), timeoutMs) : null
  try {
    const r = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(token ? { authorization: 'Bearer ' + token } : {}) },
      body: JSON.stringify({ action, ...body }),
      signal: ctrl ? ctrl.signal : undefined,
    })
    let j = {}
    try { j = await r.json() } catch { j = {} }
    if (r.status >= 500 || ['no_store', 'store_error', 'store_limit'].includes(j.error)) return { offline: true, error: j.error || 'server' }
    return { ...j, ok: r.ok && j.ok === true }
  } catch {
    return { offline: true, error: 'network' }
  } finally { if (timer) clearTimeout(timer) }
}

// Tài khoản trên máy -> phần gửi lên máy chủ (không gửi mật khẩu trừ khi đăng ký / chuyển tài khoản cũ).
export function toRemote(acc) {
  return {
    phone: phoneOf(acc), email: (acc && acc.email) || '', parentName: (acc && acc.parentName) || '', province: (acc && acc.province) || '',
    plan: (acc && acc.plan) || ((acc && acc.children) || []).length || 1, pin: (acc && acc.pin) || '',
    children: ((acc && acc.children) || []).map((c) => ({ id: c.id, name: c.name, pin: c.pin || '', icon: c.icon || '', grade: c.grade || '', school: c.school || '', schoolType: c.schoolType || '' })),
  }
}
// Tài khoản máy chủ -> bản trên máy (giữ các mục riêng của máy; mật khẩu giữ bản trên máy hoặc mật khẩu vừa gõ).
export function fromRemote(remote, local, pass) {
  const same = local && phoneOf(local) === remote.phone
  const pw = pass != null ? pass : same ? passOf(local) : ''
  return {
    ...(same ? local : {}),
    username: remote.phone, phone: remote.phone, email: remote.email || '', parentName: remote.parentName || '', province: remote.province || '',
    plan: remote.plan || 1, pin: remote.pin || '', children: remote.children || [], password: pw, parentPass: pw, rev: remote.rev || 1,
  }
}

// So tên con: không phân biệt hoa thường / khoảng trắng, nhưng GIỮ dấu (Lan ≠ Lân) để không gộp nhầm hai con.
const fold = (s) => String(s || '').normalize('NFC').toLowerCase().replace(/\s+/g, ' ').trim()
// Máy này có dữ liệu học tập của con (bất kỳ khoá nào "...::<id con>") không?
export function childHasData(id) {
  if (!id) return false
  try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.endsWith('::' + id)) return true } } catch { /* noop */ }
  return false
}
// GỘP danh sách con khi tài khoản trên máy và trên máy chủ cùng số điện thoại.
// Máy chủ là gốc. Con chỉ có trên máy (id khác): nếu máy chủ có con CÙNG TÊN mà máy này chưa có dữ liệu của con đó
// -> chuyển dữ liệu của con trên máy sang id đó (remap); không thì thêm con đó vào tài khoản (giữ id + dữ liệu).
// Không bao giờ làm mất dữ liệu học tập đã có trên máy.
export function mergeChildren(localKids = [], remoteKids = [], hasData = childHasData) {
  const out = remoteKids.map((c) => ({ ...c }))
  const ids = new Set(out.map((c) => c.id)), localIds = new Set(localKids.map((c) => c.id))
  const remaps = [], appended = [], taken = new Set()
  for (const lc of localKids) {
    if (!lc || !lc.id || ids.has(lc.id)) continue
    const twin = out.find((rc) => !localIds.has(rc.id) && !taken.has(rc.id) && fold(rc.name) && fold(rc.name) === fold(lc.name) && !hasData(rc.id))
    if (twin) { remaps.push([lc.id, twin.id]); taken.add(twin.id) }
    else { out.push({ ...lc }); ids.add(lc.id); appended.push(lc.id) }
  }
  return { children: out, remaps, appended }
}
// Chuyển mọi dữ liệu "...::<from>" sang "...::<to>" (chỉ khi chỗ mới còn trống) — kể cả con đang học.
export function remapChildData(from, to) {
  if (!from || !to || from === to) return
  try {
    const keys = []
    for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.endsWith('::' + from)) keys.push(k) }
    for (const k of keys) {
      const nk = k.slice(0, k.length - from.length) + to
      if (localStorage.getItem(nk) == null) localStorage.setItem(nk, localStorage.getItem(k))
      localStorage.removeItem(k)
    }
    if (localStorage.getItem('ontap.activechild.v1') === from) localStorage.setItem('ontap.activechild.v1', to)
  } catch { /* noop */ }
}
// Máy chuyển sang tài khoản khác: cất bản tài khoản cũ (để đăng nhập lại không cần mạng, không mất danh sách con).
export function backupAccount(acc) {
  const ph = phoneOf(acc)
  if (!ph) return
  try { const all = JSON.parse(read(PREV) || '{}') || {}; all[ph] = acc; write(PREV, JSON.stringify(all)) } catch { /* noop */ }
}
export function backupAccounts() { try { return Object.values(JSON.parse(read(PREV) || '{}') || {}) } catch { return [] } }
export function dropBackup(phone) {
  try { const all = JSON.parse(read(PREV) || '{}') || {}; if (all[phone]) { delete all[phone]; write(PREV, JSON.stringify(all)) } } catch { /* noop */ }
}
// Tài khoản trên máy có khớp tên đăng nhập (số điện thoại hoặc email) + mật khẩu không (dùng khi mất mạng).
export function matchesLogin(acc, id, pass) {
  if (!acc || !pass) return false
  const u = String(id || '').trim(), em = u.toLowerCase()
  const okUser = (validPhone(onlyDigits(u)) && onlyDigits(u) === phoneOf(acc)) || u === phoneOf(acc) || (em.includes('@') && em === String(acc.email || '').trim().toLowerCase())
  return okUser && (pass === acc.parentPass || pass === acc.password)
}

// Gộp tài khoản máy chủ vào bản trên máy; dirty -> giữ các mục máy này vừa sửa (chưa gửi được) rồi gửi lên.
async function mergeAndPush(local, remote, token, dirty) {
  const m = mergeChildren(local.children || [], remote.children || [])
  m.remaps.forEach(([a, b]) => remapChildData(a, b))
  let acc = fromRemote({ ...remote, children: m.children }, local)
  if (dirty) acc = { ...acc, email: local.email || '', pin: local.pin || '', parentName: local.parentName || acc.parentName, province: local.province || acc.province, plan: local.plan || acc.plan }
  if (dirty || m.appended.length) {
    const u = await call('update', { account: toRemote(acc) }, token)
    if (u.ok) { acc = fromRemote(u.account, acc); setSyncState({ dirty: false, conflict: '' }) }
    else if (u.error === 'email_taken') { acc = { ...acc, email: remote.email || '' }; setSyncState({ dirty: false, conflict: '' }) }
    else if (u.error === 'bad_token') return { logout: 'pw_changed' }
    else setSyncState({ dirty: true })
  } else setSyncState({ dirty: false, conflict: '' })
  return { account: acc, remaps: m.remaps }
}

// Đồng bộ khi mở app (đã đăng nhập): tài khoản cũ chưa có trên máy chủ -> chuyển lên; có rồi -> lấy bản mới nhất
// (con thêm ở máy khác hiện ra). Mật khẩu đã đổi ở máy khác -> { logout } (máy này phải đăng nhập lại).
export async function syncNow(local) {
  const phone = phoneOf(local)
  if (!local || !validPhone(phone)) return {}
  let token = getToken()
  if (token && tokenPhone(token) !== phone) token = ''
  if (!token) {
    const pass = passOf(local)
    if (!pass || pass.length < 4) return {}
    const r = await call('claim', { ...toRemote(local), pass })
    if (r.offline) return {}
    if (!r.ok) { setSyncState({ conflict: r.error || 'error' }); return {} }
    setToken(r.token)
    if (r.created) { setSyncState({ dirty: false, conflict: '' }); return { account: fromRemote(r.account, local) } }
    return mergeAndPush(local, r.account, r.token, false)
  }
  const g = await call('get', {}, token)
  if (g.offline) return {}
  if (!g.ok) return g.error === 'bad_token' ? { logout: 'pw_changed' } : {}
  return mergeAndPush(local, g.account, token, !!getSyncState().dirty)
}

// Sau mỗi thay đổi tài khoản trên máy (thêm con, đổi email, đổi PIN): gửi lên máy chủ. Chưa gửi được -> đánh dấu, lần sau gửi.
export async function pushAccount(acc) {
  const token = getToken()
  if (!acc || !validPhone(phoneOf(acc)) || !token || tokenPhone(token) !== phoneOf(acc)) { setSyncState({ dirty: true }); return { offline: true } }
  const u = await call('update', { account: toRemote(acc) }, token)
  if (u.ok) { setSyncState({ dirty: false, conflict: '' }); return { ok: true, account: fromRemote(u.account, acc) } }
  if (u.offline) { setSyncState({ dirty: true }); return { offline: true } }
  return { error: u.error }
}
