// Ghi nhớ các câu hỏi ĐÃ RA gần đây (theo "canon" — dạng chuẩn hoá của câu),
// để những lần ôn sau ưu tiên câu MỚI, tránh lặp lại y hệt các lần trước.
// Chỉ lưu chuỗi rút gọn của câu hỏi, không lưu đáp án — rất nhẹ.

const KEY = 'ontap.recentq.v2'
const CAP = 80 // nhớ tối đa 80 câu gần nhất

export function resetRecent() {
  try { localStorage.removeItem(KEY) } catch { /* noop */ }
}

export function loadRecent() {
  try {
    const r = JSON.parse(localStorage.getItem(KEY) || '[]')
    return Array.isArray(r) ? r : []
  } catch { return [] }
}

// Đưa các câu vừa dùng lên đầu danh sách "đã gặp", cắt bớt còn CAP câu.
export function pushRecent(keys) {
  try {
    const add = (keys || []).filter(Boolean)
    if (!add.length) return
    const cur = loadRecent().filter((k) => !add.includes(k))
    const merged = [...add, ...cur].slice(0, CAP)
    localStorage.setItem(KEY, JSON.stringify(merged))
  } catch { /* noop */ }
}
