// GÓP Ý / BÁO LỖI (17/11/2026) — phía người dùng: gọi /api/feedback bằng chìa khoá đăng nhập của app (src/lib/sync.js).
import { getToken } from './sync.js'
import { imageToBase64 } from './aiClient.js'

export async function fbCall(action, body = {}, timeoutMs = 20000) {
  const token = getToken()
  if (!token) return { ok: false, error: 'bad_token' }
  const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null
  const timer = ctrl ? setTimeout(() => ctrl.abort(), timeoutMs) : null
  try {
    const r = await fetch('/api/feedback', { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + token }, body: JSON.stringify({ action, ...body }), signal: ctrl ? ctrl.signal : undefined })
    let j = {}
    try { j = await r.json() } catch { j = {} }
    return { ...j, ok: r.ok && j.ok === true }
  } catch { return { ok: false, error: 'network' } } finally { if (timer) clearTimeout(timer) }
}
// Bối cảnh gửi kèm (giúp xử lý lỗi + để AI chăm sóc khách hàng học sau này): màn hình đang dùng, loại máy.
export const fbMeta = (screen) => ({ screen, ua: (typeof navigator !== 'undefined' ? navigator.userAgent : '').slice(0, 160) })
// Ảnh chụp màn hình -> JPEG nhỏ (≤ 1000 px, ~100–250 KB)
export async function shotB64(file) {
  const { b64 } = await imageToBase64(file, 1000, 0.7)
  return b64
}
// Số phiếu có câu trả lời mới (chấm đỏ). Nhớ 2 phút để không hỏi máy chủ mỗi lần về trang chủ.
// Học sinh chỉ thấy phiếu của mình; phụ huynh thấy mọi phiếu của tài khoản -> nhớ riêng theo người xem.
const UKEY = 'ontap.fbunread.v1'
export const viewerOf = (who, child) => (who === 'child' ? { who: 'child', child: { id: child ? child.id : '' } } : { who: 'parent' })
const vk = (v) => (v.who === 'child' ? 'c:' + v.child.id : 'p')
function readCache() { try { return JSON.parse(sessionStorage.getItem(UKEY) || '{}') || {} } catch { return {} } }
export function cachedUnread(v) { const x = readCache()[vk(v)]; return x && Date.now() - x.at < 120000 ? x.n : null }
export function setUnreadCache(v, n) { try { sessionStorage.setItem(UKEY, JSON.stringify({ ...readCache(), [vk(v)]: { n, at: Date.now() } })) } catch { /* noop */ } }
export async function fetchUnread(v) {
  const c = cachedUnread(v)
  if (c != null) return c
  const r = await fbCall('unread', v)
  const n = r.ok ? r.unread : 0
  if (r.ok) setUnreadCache(v, n)
  return n
}
