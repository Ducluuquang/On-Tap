// "Con đang học" — để TÁCH dữ liệu (bản đồ kiến thức, báo cáo, câu đã ra) THEO TỪNG CON.
// Mỗi con có khoá lưu riêng: <khoá gốc>::<id con>. Chưa chọn con -> dùng khoá gốc (tương thích bản cũ).

const AKEY = 'ontap.activechild.v1'
// Các "kho" dữ liệu học tập cần tách theo con (không tách: tài khoản, cài đặt phụ huynh).
export const SCOPED_BASES = ['ontap.memory.v2', 'ontap.stats.v2', 'ontap.recentq.v2']

let active = null
try { active = localStorage.getItem(AKEY) || null } catch { active = null }

export function getActiveChild() { return active }

export function setActiveChild(id) {
  active = id || null
  try {
    if (active) localStorage.setItem(AKEY, active)
    else localStorage.removeItem(AKEY)
  } catch { /* noop */ }
}

// Khoá lưu trữ có gắn id con (nếu đang có con hoạt động). Không có con -> khoá gốc.
export function scopedKey(base) {
  return active ? base + '::' + active : base
}

// DI TRÚ (giữ dữ liệu cũ): copy dữ liệu ở khoá GỐC sang khoá của MỘT con — chỉ khi con đó CHƯA có dữ liệu.
// Dùng khi lần đầu tạo/ nâng cấp danh sách con: dữ liệu con đang dùng không bị mất, chuyển sang "con đầu tiên".
export function migrateGlobalToChild(id) {
  if (!id) return
  try {
    for (const base of SCOPED_BASES) {
      const scoped = base + '::' + id
      if (localStorage.getItem(scoped) == null) {
        const g = localStorage.getItem(base)
        if (g != null) localStorage.setItem(scoped, g)
      }
    }
  } catch { /* noop */ }
}
