// Định dạng số kiểu Việt Nam: dấu chấm ngăn cách hàng ngàn. VD: 1000 -> "1.000", 10000 -> "10.000".
export function fmt(n) {
  const num = Math.round(Number(n) || 0)
  const neg = num < 0
  const s = String(Math.abs(num)).replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return neg ? '-' + s : s
}

// Chèn dấu chấm ngăn cách hàng ngàn cho MỌI số nguyên >= 4 chữ số nằm TRONG một đoạn văn bản.
// VD: "Số 1000000 và 7 846" -> "Số 1.000.000 và 7.846".
// Giữ nguyên: phân số (3/4), số thập phân (0,5), và số <= 3 chữ số (không đụng).
export function dotNumbers(str) {
  if (str == null) return str
  return String(str).replace(
    /(^|[^\d.,/])(\d{1,3}(?: \d{3})+|\d{4,})(?![\d.,/])/g,
    (all, pre, num) => pre + fmt(Number(num.replace(/\s+/g, ''))),
  )
}
