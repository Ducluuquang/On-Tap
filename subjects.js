// "Lớp môn học" (subject layer) — phần giao diện.
// 3 môn có HỒ SƠ KỸ: Toán, Tiếng Việt, Tiếng Anh.
// MỌI môn khác dùng HỒ SƠ CHUNG (generic) -> thêm hàng chục môn vẫn chạy ngay, không phải viết riêng.
// (Quy tắc RA ĐỀ riêng theo môn nằm ở phía máy chủ: api/aiCore.mjs -> subjectRules.)

// Bỏ dấu + thường hoá để so tên môn không phụ thuộc dấu/hoa-thường.
function norm(s) {
  return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').trim()
}

// Các chế độ trắc nghiệm/điền + game dùng chung.
const GAMES = ['falling', 'balloon', 'sushi', 'boss', 'quickfire', 'mario']

// Hồ sơ 3 môn nổi bật.
const PROFILES = {
  toan: {
    key: 'toan', name: 'Toán', icon: '🔢',
    aliases: ['toan', 'math', 'mathematics', 'toan hoc', 'so hoc'],
    // Toán: KHÔNG có "Tìm lỗi sai" (đã chốt: chưa hợp Toán).
    modes: ['quiz', 'typed', ...GAMES],
  },
  'tieng-viet': {
    key: 'tieng-viet', name: 'Tiếng Việt', icon: '📖',
    aliases: ['tieng viet', 'vietnamese', 'ngu van', 'chinh ta', 'tap doc', 'luyen tu va cau', 'tap lam van'],
    modes: ['quiz', 'typed', 'finderror', ...GAMES],
  },
  'tieng-anh': {
    key: 'tieng-anh', name: 'Tiếng Anh', icon: '🔤',
    aliases: ['tieng anh', 'english', 'anh van', 'anh ngu'],
    modes: ['quiz', 'typed', 'finderror', ...GAMES],
  },
}

// Hồ sơ CHUNG cho mọi môn khác (Khoa học, Lịch sử, Địa lý, Đạo đức…).
const DEFAULT_PROFILE = {
  key: 'default', name: 'Môn khác', icon: '📚',
  aliases: [],
  // An toàn: không bật "Tìm lỗi sai" cho môn chưa có hồ sơ riêng.
  modes: ['quiz', 'typed', ...GAMES],
}

// 3 môn hiển thị sẵn trong giao diện.
export const FEATURED_SUBJECTS = [PROFILES.toan, PROFILES['tieng-viet'], PROFILES['tieng-anh']]

// Tên môn (hoặc khoá) -> khoá hồ sơ ('toan' | 'tieng-viet' | 'tieng-anh' | 'default').
export function subjectKey(nameOrKey) {
  const n = norm(nameOrKey)
  if (!n) return 'default'
  if (PROFILES[n]) return n // đã là khoá
  for (const key of Object.keys(PROFILES)) {
    const p = PROFILES[key]
    if (norm(p.name) === n) return key
    if (p.aliases.some((a) => n === a || (a.length >= 4 && n.includes(a)))) return key
  }
  return 'default'
}

export function subjectProfile(nameOrKey) {
  return PROFILES[subjectKey(nameOrKey)] || DEFAULT_PROFILE
}

// Tên hiển thị: 3 môn nổi bật -> tên chuẩn; môn khung-chung -> GIỮ NGUYÊN tên gốc (vd "Khoa học").
export function subjectDisplayName(name) {
  const k = subjectKey(name)
  if (k === 'default') return (name && String(name).trim()) || 'Môn khác'
  return PROFILES[k].name
}

// Biểu tượng hiển thị theo môn.
export function subjectIcon(name) {
  return subjectProfile(name).icon
}

// Các chế độ chơi/ôn phù hợp với môn.
export function subjectModes(name) {
  return subjectProfile(name).modes
}

// Danh sách môn để CHỌN khi ôn: LUÔN có 3 môn nổi bật (Toán, Tiếng Việt, Tiếng Anh)
// + các môn khác con ĐÃ có bài (vd Khoa học, Lịch sử). Kèm số khái niệm mỗi môn.
export function subjectsFromMem(mem) {
  const seen = new Map() // displayName -> { name, icon, count }
  for (const p of FEATURED_SUBJECTS) seen.set(p.name, { name: p.name, icon: p.icon, count: 0 })
  for (const c of mem || []) {
    const dn = subjectDisplayName(c.subject)
    const cur = seen.get(dn) || { name: dn, icon: subjectIcon(c.subject), count: 0 }
    cur.count += 1
    seen.set(dn, cur)
  }
  return [...seen.values()]
}
