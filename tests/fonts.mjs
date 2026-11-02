// Phông thật cho ảnh chụp thử (máy thử không ra mạng Google Fonts): trả lời các yêu cầu fonts.googleapis.com bằng
// @font-face lấy từ gói @fontsource (Be Vietnam Pro, Andika, Patrick Hand) cài riêng cho phép thử:
//   npm install --prefix tests/.deps @fontsource/be-vietnam-pro @fontsource/andika @fontsource/patrick-hand
// (tests/run-all.sh tự cài nếu thiếu). Không có phông thì trình duyệt dùng phông dự phòng — các phép thử "chữ nằm một dòng"
// của t_ui28 có thể sai lệch, nên luôn cài phông trước khi chạy.
import fs from 'node:fs'
import path from 'node:path'
import { TESTS } from './_env.mjs'
const ROOT = process.env.FONTS_DIR || path.join(TESTS, '.deps', 'node_modules', '@fontsource')
if (!fs.existsSync(ROOT)) console.warn('  (chưa có phông thật ở ' + ROOT + ' — chạy: npm install --prefix tests/.deps @fontsource/be-vietnam-pro @fontsource/andika @fontsource/patrick-hand)')
const FAM = { 'Be Vietnam Pro': 'be-vietnam-pro', Andika: 'andika', 'Patrick Hand': 'patrick-hand' }
function cssFor(url) {
  const u = new URL(url)
  let out = ''
  for (const fam of u.searchParams.getAll('family')) {
    const [name, spec] = fam.split(':')
    const pkg = FAM[name.replace(/\+/g, ' ')]
    if (!pkg) continue
    const weights = spec && spec.startsWith('wght@') ? spec.slice(5).split(';') : ['400']
    for (const w of weights) {
      const f = path.join(ROOT, pkg, w + '.css')
      if (!fs.existsSync(f)) continue
      out += fs.readFileSync(f, 'utf8').replace(/url\(\.\/files\/([^)]+)\)/g, (_, file) => `url(https://fonts.gstatic.com/local/${pkg}/${file})`) + '\n'
    }
  }
  return out
}
export async function useRealFonts(ctx) {
  await ctx.route(/fonts\.googleapis\.com\/css2/, (route) => route.fulfill({ status: 200, contentType: 'text/css', body: cssFor(route.request().url()) }))
  await ctx.route(/fonts\.gstatic\.com\/local\//, (route) => {
    const m = /\/local\/([^/]+)\/([^?]+)/.exec(route.request().url())
    const f = m && path.join(ROOT, m[1], 'files', m[2])
    if (!f || !fs.existsSync(f)) return route.fulfill({ status: 404, body: '' })
    route.fulfill({ status: 200, contentType: f.endsWith('.woff2') ? 'font/woff2' : 'font/woff', body: fs.readFileSync(f) })
  })
  await ctx.route(/fonts\.gstatic\.com\/(?!local\/)/, (route) => route.abort())
}
