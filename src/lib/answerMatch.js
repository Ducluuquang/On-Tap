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
  // Bỏ "số 0 đệm" khi đọc số: "hai triệu KHÔNG TRĂM năm mươi nghìn" = "hai triệu năm mươi nghìn".
  t = t.replace(/\bkhong (tram|chuc|nghin|trieu|ti|ty|muoi)\b/g, ' ')
  return t.replace(/\s*\/\s*/g, '/').replace(/\s+/g, ' ').trim() // gộp "3 / 4" -> "3/4"
}

// true nếu CHẮC CHẮN khớp (giống hệt sau chuẩn hoá, hoặc cùng một GIÁ TRỊ SỐ nguyên/thập phân).
// false = chưa chắc → để lớp 2 (chấm bằng nghĩa) quyết định.
// LƯU Ý: KHÔNG so giá trị với phân số dạng a/b (vì "3/4" và "3/8" khác nhau) — chỉ khớp chuỗi.
export function localMatch(typed, correct) {
  const a = canon(typed), b = canon(correct)
  if (!a) return false
  if (a === b) return true
  // Bỏ dấu chấm ngăn cách hàng ngàn + khoảng trắng; dấu phẩy = thập phân (chuẩn VN).
  const clean = (s) => s.replace(/[.\s]/g, '').replace(',', '.')
  const na = clean(a), nb = clean(b)
  // Chỉ so giá trị khi CẢ HAI là số nguyên/thập phân thuần (không có dấu "/").
  if (/^-?\d+(\.\d+)?$/.test(na) && /^-?\d+(\.\d+)?$/.test(nb)) return Number(na) === Number(nb)
  return false
}
