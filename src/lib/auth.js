// Đăng nhập đơn giản (lưu trên máy). Tên đăng nhập & mật khẩu mặc định = số điện thoại.
// Lưu ý: bản này lưu theo từng thiết bị (localStorage). Đăng nhập đồng bộ nhiều máy
// sẽ cần cơ sở dữ liệu (Supabase) ở bước sau.

const ACC = 'ontap.account.v1'
const SES = 'ontap.session.v1'

export function loadAccount() {
  try { const r = localStorage.getItem(ACC); return r ? JSON.parse(r) : null } catch { return null }
}
export function saveAccount(a) {
  try { localStorage.setItem(ACC, JSON.stringify(a)) } catch { /* noop */ }
}
export function loadSession() {
  try { return localStorage.getItem(SES) === '1' } catch { return false }
}
export function setSession(on) {
  try { if (on) localStorage.setItem(SES, '1'); else localStorage.removeItem(SES) } catch { /* noop */ }
}
