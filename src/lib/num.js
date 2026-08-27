// Định dạng số kiểu Việt Nam: dấu chấm ngăn cách hàng ngàn. VD: 1000 -> "1.000", 10000 -> "10.000".
export function fmt(n) {
  const num = Math.round(Number(n) || 0)
  const neg = num < 0
  const s = String(Math.abs(num)).replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return neg ? '-' + s : s
}
