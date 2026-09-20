// Đăng nhập đơn giản (lưu trên máy). Tên đăng nhập & mật khẩu mặc định = số điện thoại.
// Lưu ý: bản này lưu theo từng thiết bị (localStorage). Đăng nhập đồng bộ nhiều máy
// sẽ cần cơ sở dữ liệu (Supabase) ở bước sau.

const ACC = 'ontap.account.v1'
const SES = 'ontap.session.v1'

// Tạo id ngẫu nhiên cho một tài khoản con.
export function newChildId() {
  return 'c-' + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-3)
}

// NÂNG CẤP tài khoản CŨ (1 học sinh, chưa có danh sách con) -> cấu trúc MỚI có nhiều con.
// Giữ nguyên mọi thông tin cũ; con đầu tiên lấy từ acc.student. KHÔNG làm mất dữ liệu.
export function normalizeAccount(acc) {
  if (!acc) return acc
  if (Array.isArray(acc.children) && acc.children.length) {
    // Đã đúng cấu trúc mới — chỉ đảm bảo có các trường phụ huynh.
    return { plan: acc.plan || acc.children.length || 1, parentPass: acc.parentPass || acc.password || '', ...acc }
  }
  const st = acc.student || {}
  const child = {
    id: newChildId(),
    name: (st.name || '').trim() || 'Bé',
    grade: st.grade || '', school: st.school || '', schoolType: st.schoolType || '',
    pin: '', // tài khoản cũ chưa đặt PIN -> để trống (vào thẳng, đặt PIN sau trong Cài đặt)
  }
  return {
    ...acc,
    parentPass: acc.parentPass || acc.password || '',
    plan: acc.plan || 1,
    children: [child],
  }
}

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
