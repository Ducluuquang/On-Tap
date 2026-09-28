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

// Các môn KHÁC (khung chung) — tên CHUẨN + cách gọi khác, để "Lịch Sử", "lịch sử", "History"
// đều về MỘT tên "Lịch sử" (không tách thành nhiều môn trong báo cáo).
const OTHER_SUBJECTS = [
  { name: 'Lịch sử và Địa lí', aliases: ['lich su va dia li', 'lich su va dia ly', 'lich su dia li', 'lich su dia ly'] },
  { name: 'Lịch sử', aliases: ['lich su', 'history'] },
  { name: 'Địa lý', aliases: ['dia ly', 'dia li', 'geography'] },
  { name: 'Khoa học', aliases: ['khoa hoc', 'science'] },
  { name: 'Tự nhiên và Xã hội', aliases: ['tu nhien va xa hoi', 'tu nhien xa hoi', 'tnxh'] },
  { name: 'Đạo đức', aliases: ['dao duc'] },
  { name: 'Tin học', aliases: ['tin hoc'] },
  { name: 'Công nghệ', aliases: ['cong nghe'] },
  { name: 'Âm nhạc', aliases: ['am nhac'] },
  { name: 'Mĩ thuật', aliases: ['mi thuat', 'my thuat'] },
]

// Tên môn CHUẨN (dùng khi lưu & hiển thị). Môn lạ -> viết hoa chữ đầu.
export function canonicalSubject(name) {
  const raw = String(name || '').replace(/\s+/g, ' ').trim()
  if (!raw) return ''
  const k = subjectKey(raw)
  if (k !== 'default') return PROFILES[k].name
  const n = norm(raw)
  for (const s of OTHER_SUBJECTS) if (norm(s.name) === n || s.aliases.includes(n)) return s.name
  const d = detectSubject(raw) // vd "Lịch sử 5", "History grade 4" -> tên môn chuẩn
  if (d && !d.rest) return d.subject
  return raw.charAt(0).toLocaleUpperCase('vi') + raw.slice(1)
}

// Bảng tra "cách gọi -> tên môn", xếp cách gọi DÀI trước (để "Lịch sử và Địa lí" thắng "Lịch sử").
const ALIAS_INDEX = (() => {
  const rows = []
  for (const p of Object.values(PROFILES)) for (const a of [norm(p.name), ...p.aliases]) rows.push({ alias: a, name: p.name })
  for (const s of OTHER_SUBJECTS) for (const a of [norm(s.name), ...s.aliases]) rows.push({ alias: a, name: s.name })
  rows.push({ alias: 'maths', name: PROFILES.toan.name })
  return rows.sort((x, y) => y.alias.split(' ').length - x.alias.split(' ').length || y.alias.length - x.alias.length)
})()
// Chữ được phép đứng SAU tên môn trong nhãn (số lớp, bài, tập, ôn tập, kiểm tra…).
const LABEL_FILLER = new Set(['lop', 'grade', 'class', 'unit', 'bai', 'tuan', 'tiet', 'chuong', 'lesson', 'hoc', 'ki', 'ky', 'hk',
  'phan', 'part', 'tap', 'so', 'on', 'kiem', 'tra', 'de', 'thi', 'giua', 'cuoi', 'vocabulary', 'grammar', 'words', 'word',
  'tu', 'vung', 'ngu', 'phap'])

// ĐỌC MÔN TỪ NỘI DUNG NHẬP VÀO: nếu đầu nội dung có NHÃN MÔN (vd "Tiếng Anh 7: Thì quá khứ đơn",
// "Toán lớp 4 - Phân số", dòng đầu chỉ ghi "Lịch sử") thì lấy ĐÚNG môn đó -> không thể gán nhầm.
// Trả về { subject, grade, rest } (rest = phần nội dung sau nhãn) hoặc null nếu không có nhãn môn rõ ràng.
export function detectSubject(text) {
  const s = String(text || '').trim()
  if (!s) return null
  const lines = s.split(/\r?\n/)
  const first = lines[0].trim()
  let head, rest
  const m = first.match(/^(.{1,60}?)\s*(?::|\s[-–—|]\s)\s*(.*)$/)
  if (m) { head = m[1]; rest = [m[2], ...lines.slice(1)].join('\n').trim() }
  else if (first.split(/\s+/).length <= 5) { head = first; rest = lines.slice(1).join('\n').trim() }
  else return null
  const tokens = norm(head).replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean)
  if (!tokens.length) return null
  for (const { alias, name } of ALIAS_INDEX) {
    const at = alias.split(' ')
    if (at.length > tokens.length || !at.every((w, i) => tokens[i] === w)) continue
    const tail = tokens.slice(at.length)
    // Sau tên môn chỉ được là số lớp/bài/tập… -> mới đúng là NHÃN môn (tránh nhận nhầm câu thường).
    if (!tail.every((w) => /^\d+$/.test(w) || LABEL_FILLER.has(w))) continue
    let grade = ''
    for (let i = 0; i < tail.length; i++) {
      if (/^\d+$/.test(tail[i]) && (i === 0 || ['lop', 'grade', 'class'].includes(tail[i - 1]))) { grade = tail[i]; break }
    }
    const g = Number(grade)
    return { subject: name, grade: g >= 1 && g <= 12 ? 'Lớp ' + g : '', rest }
  }
  return null
}

// Tên hiển thị CHUẨN: 3 môn nổi bật -> tên chuẩn; môn khác -> tên chuẩn (Lịch Sử/History -> "Lịch sử").
export function subjectDisplayName(name) {
  const k = subjectKey(name)
  if (k === 'default') return canonicalSubject(name) || 'Môn khác'
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
