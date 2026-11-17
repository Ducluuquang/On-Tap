// Trang quản trị /quan-tri (17/11/2026): chìa khoá đăng nhập của quản trị lưu RIÊNG (không đụng tài khoản đang dùng app trên máy).
const KEY = 'ontap.admin.token.v1'
export const getAdminToken = () => { try { return localStorage.getItem(KEY) || '' } catch { return '' } }
export const setAdminToken = (t) => { try { if (t) localStorage.setItem(KEY, t); else localStorage.removeItem(KEY) } catch { /* noop */ } }

async function post(url, body, token, timeoutMs = 30000) {
  const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null
  const timer = ctrl ? setTimeout(() => ctrl.abort(), timeoutMs) : null
  try {
    const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', ...(token ? { authorization: 'Bearer ' + token } : {}) }, body: JSON.stringify(body), signal: ctrl ? ctrl.signal : undefined })
    let j = {}
    try { j = await r.json() } catch { j = {} }
    return { ...j, ok: r.ok && j.ok === true }
  } catch { return { ok: false, error: 'network' } } finally { if (timer) clearTimeout(timer) }
}
export const adminCall = (action, body = {}) => post('/api/admin', { action, ...body }, getAdminToken())
// Đăng nhập bằng tài khoản Ôn Tập (số điện thoại / email + mật khẩu) rồi hỏi máy chủ có phải quản trị không.
export async function adminLogin(id, pass) {
  const r = await post('/api/account', { action: 'login', id, pass }, '')
  if (!r.ok) return { ok: false, error: r.error || 'bad_login' }
  const w = await post('/api/admin', { action: 'whoami' }, r.token)
  if (!w.ok) return { ok: false, error: w.error || 'not_admin' }
  setAdminToken(r.token)
  return { ok: true, name: w.name }
}
export async function getPricesPublic() {
  try { const r = await fetch('/api/admin'); const j = await r.json(); return j && j.ok ? j.prices : null } catch { return null }
}
export const vnd = (n) => (Number(n) || 0).toLocaleString('vi-VN') + 'đ'
