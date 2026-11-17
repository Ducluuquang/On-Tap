// THƯ VIỆN SÁCH DÙNG CHUNG (09/11/2026) — phần trình duyệt: gọi /api/books (chỉ quản trị nạp / xoá sách, ở trang /quan-tri
// từ 17/11/2026, dùng chìa khoá đăng nhập của trang quản trị),
// gợi ý thông tin sách từ tên file, ước tính chi phí đọc chữ. Phần vẽ PDF nằm riêng ở src/lib/bookIngest.js (chỉ nạp
// khi quản trị mở màn Thư viện sách, không làm nặng app).
import { getAdminToken } from './adminApi.js'

export const COST_USD_PER_PAGE = 0.0095   // ~0,0095 USD mỗi trang (2 nửa trang, Message Batches nửa giá)
export const VND_PER_PAGE = 250           // ≈ 250đ mỗi trang
export const KIND_LABEL = { sgk: 'Sách giáo khoa (SGK)', sbt: 'Sách bài tập (SBT)', sgv: 'Sách giáo viên (SGV)' }
export const KIND_SHORT = { sgk: 'SGK', sbt: 'SBT', sgv: 'SGV' }
export const BOOK_SUBJECTS = ['Ngữ văn', 'Tiếng Việt', 'Toán', 'Tiếng Anh', 'Khoa học tự nhiên', 'Lịch sử và Địa lí', 'Lịch sử', 'Địa lí',
  'Khoa học', 'Tự nhiên và Xã hội', 'Giáo dục công dân', 'Đạo đức', 'Tin học', 'Công nghệ', 'Vật lí', 'Hoá học', 'Sinh học',
  'Hoạt động trải nghiệm', 'Âm nhạc', 'Mĩ thuật']

export async function booksCall(action, body = {}, timeoutMs = 60000) {
  const token = getAdminToken()
  if (!token) return { ok: false, error: 'bad_token' }
  const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null
  const timer = ctrl ? setTimeout(() => ctrl.abort(), timeoutMs) : null
  try {
    const r = await fetch('/api/books', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer ' + token },
      body: JSON.stringify({ action, ...body }),
      signal: ctrl ? ctrl.signal : undefined,
    })
    let j = {}
    try { j = await r.json() } catch { j = {} }
    if (r.status === 413) return { ok: false, error: 'too_large' }
    return { ...j, ok: r.ok && j.ok === true, status: r.status }
  } catch {
    return { ok: false, error: 'network', offline: true }
  } finally { if (timer) clearTimeout(timer) }
}

const fold = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd')
const SUBJ_ALIAS = [...BOOK_SUBJECTS].sort((a, b) => b.length - a.length).map((n) => [fold(n).replace(/[^a-z0-9 ]+/g, ' '), n])
  .concat([['dia ly', 'Địa lí'], ['vat ly', 'Vật lí'], ['hoa hoc', 'Hoá học'], ['my thuat', 'Mĩ thuật'], ['toan hoc', 'Toán'], ['gdcd', 'Giáo dục công dân'], ['khtn', 'Khoa học tự nhiên']])
const VOL = { mot: 1, '1': 1, hai: 2, '2': 2, ba: 3, '3': 3, bon: 4, '4': 4 }

// Gợi ý từ tên file: "07-sgk-ngu-van-7-tap-mot.pdf" -> { grade: 'Lớp 7', subject: 'Ngữ văn', kind: 'sgk', volume: 1, title: 'Ngữ văn 7 tập 1' }
//                    "Bài tập Ngữ Văn 7 Tập 1.pdf"  -> { ..., kind: 'sbt' }
export function guessFromFilename(name) {
  const base = fold(String(name || '').replace(/\.[a-z0-9]{2,4}$/i, '')).replace(/[^a-z0-9]+/g, ' ').trim()
  const w = ` ${base} `
  const kind = / sgv | giao vien /.test(w) ? 'sgv' : / sbt | bai tap | vo bai tap /.test(w) ? 'sbt' : 'sgk'
  let subject = '', after = ''
  for (const [a, n] of SUBJ_ALIAS) {
    const i = w.indexOf(` ${a} `)
    if (i >= 0) { subject = n; after = w.slice(i + a.length + 1); break }
  }
  let g = Number((/^\s*(\d{1,2})\s/.exec(after) || [])[1] || 0)
  if (!(g >= 1 && g <= 12)) g = Number((/(?:^| )lop (\d{1,2})(?: |$)/.exec(base) || [])[1] || 0)
  if (!(g >= 1 && g <= 12)) g = Number((/^(\d{1,2}) /.exec(base) || [])[1] || 0)
  if (!(g >= 1 && g <= 12)) g = 0
  const vm = / tap (mot|hai|ba|bon|\d) /.exec(w)
  const volume = vm ? VOL[vm[1]] || 0 : 0
  const title = subject ? `${subject}${g ? ' ' + g : ''}${volume ? ' tập ' + volume : ''}` : String(name || '').replace(/\.[a-z0-9]{2,4}$/i, '').trim()
  return { grade: g ? 'Lớp ' + g : '', subject, kind, volume, title }
}

export function costText(pages) {
  const usd = pages * COST_USD_PER_PAGE, vnd = Math.round((pages * VND_PER_PAGE) / 500) * 500
  return `~${usd.toFixed(2).replace('.', ',')} USD (≈ ${vnd.toLocaleString('vi-VN')}đ)`
}
