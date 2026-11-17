// THƯ VIỆN SÁCH — hàm thuần (không cần máy chủ): gợi ý từ tên file, chi phí, cắt đôi trang tại hàng trắng, ghép chữ trang,
// chia đoạn theo tiêu đề, tìm đúng đoạn sách theo chủ đề (ưu tiên SGK > SBT > SGV, ≤ 3.500 ký tự), lời nhắc chép chữ.
// (Dùng sách khi soạn câu hỏi, lớp thật, Ngữ văn THCS: tests/t_books_gen.mjs.)
// Sách dùng ở đây là SÁCH GIẢ tự viết (kho công khai: không đưa nội dung sách thật vào).
import { guessFromFilename, costText } from '../src/lib/books.js'
import { findCutRow } from '../src/lib/bookCut.js'
import { gradeNum, subjGroup, cleanHalf, assemblePages, chunkBook, pickExcerpt } from '../api/_books/core.mjs'
import { ocrPrompt, jpegSize, adminPhones } from '../api/books.mjs'

const results = {}
const check = (n, c, x = '') => { results[n] = c ? 'PASS' : 'FAIL'; console.log((c ? '  ✓ ' : '  ✗ ') + n + (c || !x ? '' : '  → ' + x)) }

console.log('— 1. Gợi ý từ tên file + chi phí')
const g1 = guessFromFilename('07-sgk-ngu-van-7-tap-mot.pdf')
check('"07-sgk-ngu-van-7-tap-mot.pdf" -> Lớp 7, Ngữ văn, SGK, tập 1, tên "Ngữ văn 7 tập 1"', g1.grade === 'Lớp 7' && g1.subject === 'Ngữ văn' && g1.kind === 'sgk' && g1.volume === 1 && g1.title === 'Ngữ văn 7 tập 1', JSON.stringify(g1))
const g2 = guessFromFilename('07-sgv-ngu-van-7-tap-mot.pdf')
check('"07-sgv-ngu-van-7-tap-mot.pdf" -> SGV', g2.kind === 'sgv' && g2.grade === 'Lớp 7' && g2.title === 'Ngữ văn 7 tập 1', JSON.stringify(g2))
const g3 = guessFromFilename('Bài tập Ngữ Văn 7 Tập 1.pdf')
check('"Bài tập Ngữ Văn 7 Tập 1.pdf" -> SBT, Lớp 7, Ngữ văn, tập 1', g3.kind === 'sbt' && g3.grade === 'Lớp 7' && g3.subject === 'Ngữ văn' && g3.title === 'Ngữ văn 7 tập 1', JSON.stringify(g3))
const g4 = guessFromFilename('sgk-toan-10-tap-hai.pdf'), g5 = guessFromFilename('Lich su va Dia li 5.pdf')
check('"sgk-toan-10-tap-hai.pdf" -> Toán 10 tập 2; "Lich su va Dia li 5.pdf" -> Lịch sử và Địa lí, Lớp 5', g4.title === 'Toán 10 tập 2' && g4.grade === 'Lớp 10' && g5.subject === 'Lịch sử và Địa lí' && g5.grade === 'Lớp 5', JSON.stringify([g4, g5]))
check('chi phí 142 trang: ~1,35 USD (≈ 35.500đ)', costText(142) === '~1,35 USD (≈ 35.500đ)', costText(142))

console.log('— 2. Cắt đôi trang tại hàng ít mực nhất (42–58%)')
function page(w, h, lines) { // lines: [y0, y1] các dòng chữ (đen); còn lại trắng
  const g = new Uint8Array(w * h).fill(255)
  for (const [a, b] of lines) for (let y = a; y < b; y++) for (let x = 0; x < w; x++) g[y * w + x] = (x % 7 < 4) ? 20 : 255
  return g
}
const W = 200, Hh = 1000
// dòng chữ đều đặn, chừa khoảng trắng rộng ở 460–490 (46–49%)
const lines = []
for (let y = 40; y < 960; y += 30) if (!(y + 18 > 460 && y < 490)) lines.push([y, y + 18])
const cut = findCutRow(page(W, Hh, lines), W, Hh)
check('khoảng trắng rộng 46–49% -> cắt ở giữa khoảng trắng (không cắt ngang dòng chữ)', cut >= 463 && cut <= 487 && !lines.some(([a, b]) => cut >= a && cut < b), String(cut))
const dense = []
for (let y = 0; y < 1000; y += 10) dense.push([y, y + 7])
const cut2 = findCutRow(page(W, Hh, dense), W, Hh)
check('chữ dày đặc -> vẫn cắt vào khe giữa hai dòng, trong 42–58%', cut2 >= 420 && cut2 <= 580 && !dense.some(([a, b]) => cut2 >= a && cut2 < b), String(cut2))
// ảnh quét thật: nền giấy ngà có nhiễu (225–245), chữ xám đậm, khe trắng 52–55%
let seed = 7
const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648)
const noisy = new Uint8Array(W * Hh)
const nl = []
for (let y = 30; y < 980; y += 26) if (!(y + 17 > 520 && y < 550)) nl.push([y, y + 17])
for (let y = 0; y < Hh; y++) for (let x = 0; x < W; x++) noisy[y * W + x] = nl.some(([a, b]) => y >= a && y < b) && x % 5 < 3 ? 40 + rnd() * 40 : 225 + rnd() * 20
const cutN = findCutRow(noisy, W, Hh)
check('ảnh quét có nhiễu nền giấy, khe trắng ở 52–55% -> cắt giữa khe đó', cutN >= 520 && cutN <= 550 && !nl.some(([a, b]) => cutN >= a && cutN < b), String(cutN))
check('trang trắng -> cắt chính giữa', findCutRow(page(W, Hh, []), W, Hh) === 500)
const tail = [[0, 600], [700, 1000]]   // khoảng trắng ở 60–70% (ngoài vùng 42–58%) -> không cắt ở đó
const cut3 = findCutRow(page(W, Hh, tail), W, Hh)
check('khoảng trắng nằm ngoài 42–58% -> không cắt ra ngoài vùng cho phép', cut3 >= 420 && cut3 <= 580, String(cut3))

console.log('— 3. Lời nhắc chép chữ + kiểm ảnh')
const op = ocrPrompt('Ngữ văn 7 tập 1', 12, 2)
check('lời nhắc: "Đây là nửa dưới của trang 12 trong sách Ngữ văn 7 tập 1. Chép lại CHÍNH XÁC…" đủ các ý anh duyệt', op.startsWith('Đây là nửa dưới của trang 12 trong sách Ngữ văn 7 tập 1. Chép lại CHÍNH XÁC toàn bộ chữ') &&
  ['đúng dấu tiếng Việt', 'giữ xuống dòng của thơ', "'KẾT NỐI TRI THỨC VỚI CUỘC SỐNG'", "'# '", "'[Lề] '", "'[Chú thích] '", "'[Hình: …]'", 'bảng dạng Markdown', "'[Trang in: số]'", "'[Trống]'"].every((x) => op.includes(x)), op)
const jp = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 4, 0, 0, 0xff, 0xc0, 0, 11, 8, 0x02, 0xf0, 0x04, 0x4c, 3, 1, 0x22, 0, 0xff, 0xd9])
check('đọc kích thước JPEG (1100 × 752); không phải JPEG -> null', JSON.stringify(jpegSize(jp)) === '{"h":752,"w":1100}' && jpegSize(Buffer.from('%PDF-1.4')) === null)
process.env.ADMIN_PHONES = ' 0912 000 777, 0912.000.778 ;abc'
const ap = adminPhones()
delete process.env.ADMIN_PHONES
check('ADMIN_PHONES: tách dấu phẩy, bỏ khoảng trắng / dấu chấm; chưa có biến -> không ai là quản trị', ap.join(',') === '0912000777,0912000778' && adminPhones().length === 0, ap.join(','))

console.log('— 4. Ghép chữ trang + chia đoạn + tìm đoạn sách (sách giả)')
check('lớp: "Lớp 7" -> 7, "4-5" -> 0; nhóm môn: Ngữ văn = Tiếng Việt, Toán riêng', gradeNum('Lớp 7') === 7 && gradeNum('lớp 12') === 12 && gradeNum('4-5') === 0 && subjGroup('Ngữ văn') === 'van' && subjGroup('Tiếng Việt') === 'van' && subjGroup('Toán') === 'toan' && subjGroup('Lịch sử') !== subjGroup('Lịch sử và Địa lí'))
const ch = cleanHalf('# Bài 1\nDòng một\n\n\n\nDòng hai\n[Trang in: 9]')
check('nửa trang: lấy số trang in, bỏ dòng "[Trang in]", bỏ "[Trống]"', ch.printed === '9' && ch.text === '# Bài 1\nDòng một\n\nDòng hai' && cleanHalf('[Trống]').text === '')
// SÁCH GIẢ: "Bài 2. Mèo mướp và chú gà trống" + Thực hành tiếng Việt (từ láy) + Bài 3 (số từ)
const SGK = {
  p1h1: '# Bài 2. Mèo mướp và chú gà trống\n[Lề] Văn bản truyện đồng thoại giả\nMèo mướp nằm phơi nắng bên hiên, gà trống gáy vang khắp xóm nhỏ.', p1h2: 'Mèo mướp kể chuyện cho gà trống nghe về chuyến đi xa.\n[Trang in: 30]',
  p2h1: '# Thực hành tiếng Việt: Từ láy\nTừ láy là từ được tạo bởi các tiếng có phần âm hoặc vần giống nhau, ví dụ: lấp lánh, rì rào, xinh xắn.', p2h2: 'Bài tập 1. Tìm từ láy trong đoạn văn về mèo mướp.\n[Trang in: 31]',
  p3h1: '[Trống]', p3h2: '[Trống]',
  p4h1: '# Bài 3. Số từ và phó từ\nSố từ là những từ chỉ số lượng và thứ tự của sự vật, ví dụ: một, hai, thứ nhất.', p4h2: 'Phó từ là những từ chuyên đi kèm động từ, tính từ như: đã, đang, sẽ, rất.\n[Trang in: 33]',
}
const pages = assemblePages(SGK, 4)
check('ghép trang: 3 trang có chữ (trang trống bị bỏ), số trang in 30, 31, 33', pages.length === 3 && pages.map((p) => p.printed).join(',') === '30,31,33', JSON.stringify(pages.map((p) => [p.n, p.printed])))
const mk = (id, kind, halves, n, title = 'Ngữ văn 7 tập 1') => ({ meta: { id, kind, title, grade: 7, subject: 'Ngữ văn' }, chunks: chunkBook({ pages: assemblePages(halves, n) }) })
const sgk = mk('b1', 'sgk', SGK, 4)
check('chia đoạn theo tiêu đề: 3 đoạn (Bài 2, Từ láy, Bài 3) có trang in', sgk.chunks.length === 3 && sgk.chunks[1].head.startsWith('Thực hành tiếng Việt: Từ láy') && sgk.chunks[1].p0 === '31', JSON.stringify(sgk.chunks.map((c) => [c.head, c.p0, c.p1])))
const SBT = { p1h1: '# Bài 2. Thực hành tiếng Việt\nBài tập: Gạch chân từ láy trong câu "Suối chảy rì rào".', p1h2: '# Gợi ý làm bài\nTừ láy trong câu là "rì rào" (láy vần).\n[Trang in: 12]' }
const SGV = { p1h1: '# Hướng dẫn dạy: Từ láy\nGợi ý trả lời: học sinh nêu được các từ láy lấp lánh, rì rào.', p1h2: '[Trang in: 50]' }
const sbt = mk('b2', 'sbt', SBT, 1), sgv = mk('b3', 'sgv', SGV, 1)
const ex = pickExcerpt([sgv, sbt, sgk], { topic: 'Từ láy', concepts: [{ name: 'Từ láy', details: ['lấp lánh', 'rì rào'] }] })
const iS = ex.indexOf('[SGK Ngữ văn 7 tập 1'), iB = ex.indexOf('[SBT Ngữ văn 7 tập 1'), iV = ex.indexOf('[SGV Ngữ văn 7 tập 1')
check('chủ đề "Từ láy" -> đoạn Từ láy của SGK (tr. 31) đứng trước, rồi SBT (gợi ý làm bài), rồi SGV', iS === 0 && iB > iS && iV > iB && ex.includes('[SGK Ngữ văn 7 tập 1, tr. 31]') && ex.includes('Từ láy là từ được tạo bởi') && !ex.includes('Số từ là những từ'), ex)
const ex2 = pickExcerpt([sgk], { topic: 'Số từ', concepts: ['Số từ và phó từ'] })
check('chủ đề "Số từ và phó từ" -> đúng đoạn Bài 3 (tr. 33), không lẫn Từ láy', ex2.includes('tr. 33') && ex2.includes('Phó từ là') && !ex2.includes('Từ láy là'), ex2)
check('chủ đề không có trong sách ("Phân số", "Thì quá khứ đơn") -> không có đoạn sách', pickExcerpt([sgk, sbt, sgv], { topic: 'Phân số', concepts: ['Rút gọn phân số'] }) === '' && pickExcerpt([sgk], { topic: 'Thì quá khứ đơn', concepts: ['Past simple'] }) === '')
// sách dài: tối đa 3.500 ký tự
const BIG = {}
for (let n = 1; n <= 40; n++) { BIG['p' + n + 'h1'] = '# Từ láy phần ' + n + '\n' + ('Từ láy rì rào lấp lánh xinh xắn trong văn bản. ').repeat(30); BIG['p' + n + 'h2'] = '[Trang in: ' + n + ']' }
const ex3 = pickExcerpt([mk('b9', 'sgk', BIG, 40)], { topic: 'Từ láy', concepts: ['Từ láy'] })
check('sách dài, nhiều đoạn khớp -> đoạn sách gửi AI ≤ 3.500 ký tự', ex3.length > 1500 && ex3.length <= 3500, String(ex3.length))

const fails = Object.entries(results).filter(([, v]) => v !== 'PASS')
console.log(fails.length ? `\n${fails.length} FAIL` : `\nALL PASS (${Object.keys(results).length} kiểm tra)`)
process.exit(fails.length ? 1 : 0)
