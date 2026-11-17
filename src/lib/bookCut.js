// Chọn hàng cắt đôi trang sách (09/11/2026), trong khoảng 42–58% chiều cao:
//  1. độ đậm mực từng hàng = tổng (255 - độ sáng), lấy mẫu mỗi 2 px ngang;
//  2. các hàng "trắng nhất" (mực ≤ mức ít nhất + một chút nhiễu nền giấy) là ứng viên;
//  3. chọn ứng viên nằm GIỮA khe trắng rộng nhất (xa dòng chữ nhất) -> không cắt ngang dòng chữ, kể cả chân chữ g, y;
//     bằng nhau thì chọn hàng gần giữa trang nhất.
// gray: Uint8Array w*h; chỉ cần các hàng trong khoảng [42% - MARGIN, 58% + MARGIN] (cột chẵn).
export const MARGIN = 60
export function cutRange(h) { return [Math.floor(h * 0.42), Math.min(h - 1, Math.ceil(h * 0.58))] }
export function findCutRow(gray, w, h) {
  const [lo, hi] = cutRange(h)
  const a = Math.max(0, lo - MARGIN), b = Math.min(h - 1, hi + MARGIN)
  const ink = new Float64Array(h)
  for (let y = a; y <= b; y++) {
    let s = 0
    const row = y * w
    for (let x = 0; x < w; x += 2) s += 255 - gray[row + x]
    ink[y] = s
  }
  let m = Infinity
  for (let y = lo; y <= hi; y++) if (ink[y] < m) m = ink[y]
  const tol = Math.max(m * 0.15, (w / 2) * 2)
  const white = (y) => ink[y] <= m + tol
  let best = -1, bestC = -1
  for (let y = lo; y <= hi; y++) {
    if (!white(y)) continue
    let up = 0, dn = 0
    while (y - up - 1 >= a && white(y - up - 1) && up < MARGIN) up++
    while (y + dn + 1 <= b && white(y + dn + 1) && dn < MARGIN) dn++
    const c = Math.min(up, dn)
    if (c > bestC || (c === bestC && Math.abs(y - h / 2) < Math.abs(best - h / 2))) { best = y; bestC = c }
  }
  return best < 0 ? Math.round(h / 2) : best
}
