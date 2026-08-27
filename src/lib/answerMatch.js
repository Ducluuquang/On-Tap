// So khớp đáp án TỰ ĐIỀN ngay trên máy (nhanh, không cần mạng) —
// hiểu các cách đọc số tiếng Việt khác nhau nhưng cùng nghĩa.
// Trường hợp khó/không chắc sẽ để AI chấm tiếp (judgeAnswer).

const norm = (s) => String(s).trim().toLowerCase().replace(/\s+/g, ' ').replace(/[.．。,;:!?]+$/, '')
const stripD = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd')

// Đồng nghĩa cách đọc số (sau khi đã bỏ dấu):
//  tư = bốn (4) · lăm = năm (5) · ngàn = nghìn · lẻ = linh (0 ở giữa)
//  (mươi/mười, mốt/một tự trùng nhau sau khi bỏ dấu)
const SYN = [
  [/\btu\b/g, 'bon'],
  [/\blam\b/g, 'nam'],
  [/\bngan\b/g, 'nghin'],
  [/\ble\b/g, 'linh'],
]

export function canon(s) {
  let t = stripD(norm(s)).replace(/[^a-z0-9/.,\s]/g, ' ').replace(/\s+/g, ' ').trim()
  for (const [re, to] of SYN) t = t.replace(re, to)
  return t.replace(/\s+/g, ' ').trim()
}

// true nếu chắc chắn khớp (đúng giá trị / chỉ khác cách đọc). false = chưa chắc, nên hỏi AI.
export function localMatch(typed, correct) {
  const a = canon(typed), b = canon(correct)
  if (!a) return false
  if (a === b) return true
  const na = a.replace(/\s/g, '').replace(',', '.'), nb = b.replace(/\s/g, '').replace(',', '.')
  if (na === nb) return true
  const fa = parseFloat(na), fb = parseFloat(nb)
  return !Number.isNaN(fa) && !Number.isNaN(fb) && fa === fb
}
