// THƯ VIỆN SÁCH qua giao diện thật (trang quản trị /quan-tri -> "📚 Thư viện sách"; từ 17/11/2026 không còn trong Cài đặt phụ huynh), sách PDF GIẢ tự tạo: mỗi trang là MỘT ảnh JPEG
// (giống sách quét thật, không có lớp chữ). Đọc chữ = Message Batches giả của máy chủ thử (không gọi AI thật).
//  1  App của phụ huynh (kể cả tài khoản quản trị): Cài đặt KHÔNG có mục thư viện. Trang /quan-tri: tài khoản thường bị từ chối;
//     quản trị đăng nhập -> "Thư viện sách"; pdf.js chỉ tải khi chọn file.
//  2  Nạp "07-sgk-ngu-van-7-tap-mot.pdf": gợi ý Lớp 7 / Ngữ văn / SGK / "Ngữ văn 7 tập 1", số trang + chi phí ước tính;
//     ảnh gửi đi: rộng ≤ 1100 px, mỗi nửa ≤ 1,15 MP, cắt đúng khe trắng (không cắt ngang dòng chữ), mỗi yêu cầu < 4 MB;
//     một nửa trang lỗi -> app còn giữ file tự gửi lại -> "Đã đọc xong".
//  3  "Bài tập Ngữ Văn 7 Tập 1.pdf" -> SBT; gửi ảnh xong ĐÓNG APP; batch xong (có nửa trang lỗi) -> mở lại trang quản trị thấy tiến độ,
//     nút "Chọn lại file PDF" -> chọn nhầm file khác số trang thì báo, chọn đúng file -> đọc xong.
//  4  Xoá sách qua giao diện.
import { pw, OUT_DIR } from './_env.mjs'
import { useRealFonts } from './fonts.mjs'
const OUT = OUT_DIR
const BASE = process.env.BASE || 'http://localhost:4192'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const browser = await pw.chromium.launch({ headless: true })
const results = {}
const check = (n, c, x = '') => { results[n] = c ? 'PASS' : 'FAIL'; console.log((c ? '  ✓ ' : '  ✗ ') + n + (c || !x ? '' : '  → ' + x)) }
const RUN = String(Date.now()).slice(-6)
const ip = () => '10.11.' + (Number(RUN) % 250) + '.' + (1 + Math.floor(Math.random() * 200))
async function acct(action, body = {}, token = '') {
  const r = await fetch(BASE + '/api/account', { method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': ip(), ...(token ? { authorization: 'Bearer ' + token } : {}) }, body: JSON.stringify({ action, ...body }) })
  return r.json()
}
const ocr = async (body) => (await fetch(BASE + '/__mock/ocr', body ? { method: 'POST', body: JSON.stringify(body) } : {})).json()
async function until(fn, ms = 20000, step = 300) { const t0 = Date.now(); for (;;) { const v = await fn(); if (v) return v; if (Date.now() - t0 > ms) return v; await sleep(step) } }

const ADMIN = '0912000778', USER = '0917' + RUN, PASS = '12345678'
const KIDA = 'kidB' + RUN, KIDU = 'kidU' + RUN
let reg = await acct('register', { phone: ADMIN, pass: PASS, parentName: 'Quản trị', plan: 1, pin: '3', children: [{ id: KIDA, name: 'Minh', pin: '7', icon: '🦊', grade: 'Lớp 7' }] })
if (!reg.ok) {   // chạy lại trên kho thử cũ: tài khoản đã có -> đăng nhập, cập nhật danh sách con
  const l = await acct('login', { id: ADMIN, pass: PASS })
  await acct('update', { account: { children: [{ id: KIDA, name: 'Minh', pin: '7', icon: '🦊', grade: 'Lớp 7' }], pin: '3' } }, l.token)
}
await acct('register', { phone: USER, pass: PASS, parentName: 'Ba', plan: 1, pin: '3', children: [{ id: KIDU, name: 'Minh', pin: '7', icon: '🦊', grade: 'Lớp 7' }] })
await ocr({ reset: true })

/* ---------- PDF giả: mỗi trang một ảnh JPEG 1094×1536 (100 ppi), có khe trắng ở 45,5–49% chiều cao ---------- */
const maker = await browser.newPage()
async function pageJpeg(n, label) {
  const b64 = await maker.evaluate(({ n, label }) => {
    const c = document.createElement('canvas'); c.width = 1094; c.height = 1536
    const g = c.getContext('2d')
    g.fillStyle = '#fbf8f0'; g.fillRect(0, 0, c.width, c.height)
    g.fillStyle = '#222'; g.font = 'bold 40px serif'; g.fillText(`${label} · trang ${n}`, 80, 90)
    g.font = '24px serif'
    for (let y = 150; y < 1460; y += 34) {
      if (y + 26 > 1536 * 0.455 && y < 1536 * 0.49) continue           // khe trắng giữa trang
      g.fillText('Dòng chữ giả của sách thử, có dấu tiếng Việt: lấp lánh, rì rào, xinh xắn ' + y, 80, y + 22)
    }
    return c.toDataURL('image/jpeg', 0.8).split(',')[1]
  }, { n, label })
  return Buffer.from(b64, 'base64')
}
async function makePdf(pages, label) {
  const imgs = []
  for (let i = 1; i <= pages; i++) imgs.push(await pageJpeg(i, label))
  const W = 1094 * 72 / 100, H = 1536 * 72 / 100
  const parts = [], offs = []
  let len = 0
  const add = (b) => { const buf = Buffer.isBuffer(b) ? b : Buffer.from(b, 'latin1'); parts.push(buf); len += buf.length }
  const obj = (id, body) => { offs[id] = len; add(`${id} 0 obj\n`); for (const b of [].concat(body)) add(b); add('\nendobj\n') }
  add('%PDF-1.4\n%\xe2\xe3\xcf\xd3\n')
  const kids = imgs.map((_, i) => `${3 + i * 3} 0 R`).join(' ')
  obj(1, '<< /Type /Catalog /Pages 2 0 R >>')
  obj(2, `<< /Type /Pages /Kids [${kids}] /Count ${pages} >>`)
  imgs.forEach((img, i) => {
    const p = 3 + i * 3, cs = p + 1, im = p + 2
    const content = `q ${W.toFixed(2)} 0 0 ${H.toFixed(2)} 0 0 cm /Im0 Do Q`
    obj(p, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W.toFixed(2)} ${H.toFixed(2)}] /Resources << /XObject << /Im0 ${im} 0 R >> >> /Contents ${cs} 0 R >>`)
    obj(cs, `<< /Length ${content.length} >>\nstream\n${content}\nendstream`)
    obj(im, [`<< /Type /XObject /Subtype /Image /Width 1094 /Height 1536 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${img.length} >>\nstream\n`, img, '\nendstream'])
  })
  const n = 3 + pages * 3
  const xref = len
  add(`xref\n0 ${n}\n0000000000 65535 f \n`)
  for (let i = 1; i < n; i++) add(String(offs[i]).padStart(10, '0') + ' 00000 n \n')
  add(`trailer\n<< /Size ${n} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`)
  return Buffer.concat(parts)
}
const PDF_SGK = await makePdf(4, 'SGK giả')
const PDF_SBT = await makePdf(3, 'SBT giả')
const PDF_WRONG = await makePdf(2, 'Sách khác')
await maker.close()

const allErrs = []
async function device(name) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 })
  await useRealFonts(ctx)
  await ctx.addInitScript(() => { window.__ontapBookPollMs = 1200 })
  const page = await ctx.newPage()
  const reqs = []
  page.on('request', (r) => reqs.push({ url: r.url(), method: r.method(), body: r.method() === 'POST' ? r.postData() || '' : '' }))
  page.on('pageerror', (e) => allErrs.push(name + ' pageerror: ' + e.message))
  page.on('console', (m) => { if (m.type() === 'error' && !/favicon|fonts\.g|status of 4\d\d/.test(m.text())) allErrs.push(name + ' console: ' + m.text()) })
  await page.goto(BASE + '/', { waitUntil: 'networkidle' })
  return { name, ctx, page, reqs }
}
async function login(d, phone) {
  if (await d.page.locator('.auth-landing').count()) await d.page.click('.auth-landing button:has-text("Đăng nhập")')
  await d.page.fill('input[placeholder="Số điện thoại hoặc email"]', phone)
  await d.page.fill('input[placeholder="Mật khẩu 8 số"]', PASS)
  await d.page.click('.auth-card button.cta:has-text("Đăng nhập")')
  await d.page.waitForSelector('.pick-grid', { timeout: 10000 })
  await d.page.click('.pick-card:has-text("Minh")')
  await d.page.fill('.pick-pinbox input', '7'); await d.page.click('.pick-pinbox button.cta')
  await d.page.waitForSelector('.kh-cta', { timeout: 10000 })
}
async function adminPage(d) {   // trang quản trị: đăng nhập nếu cần, mở mục Thư viện sách
  await d.page.goto(BASE + '/quan-tri', { waitUntil: 'networkidle' })
  if (await d.page.locator('.adm-login').count()) {
    await d.page.fill('.adm-login input[placeholder="Số điện thoại hoặc email"]', ADMIN)
    await d.page.fill('.adm-login input[type=password]', PASS)
    await d.page.click('.adm-login button.cta')
  }
  await d.page.waitForSelector('.adm-tabs', { timeout: 10000 })
  await d.page.click('.adm-tab:has-text("Thư viện sách")')
  await d.page.waitForSelector('[data-testid=library]', { timeout: 10000 })
}
async function parentSettings(d) {
  await d.page.click('.ds-seg button:has-text("Phụ huynh")')
  await d.page.waitForSelector('.modal input', { timeout: 5000 })
  await d.page.fill('.modal input.pin-in', '3'); await d.page.click('.modal .modal-btns .cta:not(.ghost)')
  await d.page.click('button:has-text("Mục tiêu")')
  await d.page.waitForSelector('.set-sec', { timeout: 5000 })
}
const bookLi = (d, title) => d.page.locator('.lib-book', { has: d.page.locator('.lib-title', { hasText: title }) }).last()

/* ======== 1. Tài khoản thường / quản trị ======== */
console.log('— 1. Ai thấy Thư viện sách')
const U = await device('U')
await login(U, USER)
await parentSettings(U)
await U.page.waitForLoadState('networkidle'); await sleep(800)
check('app phụ huynh (tài khoản thường): Cài đặt KHÔNG có mục "Thư viện sách", không hỏi /api/books, không tải pdf.js', (await U.page.locator('[data-testid=library]').count()) === 0 && !/Thư viện sách/.test(await U.page.locator('.screen').innerText()) && !U.reqs.some((r) => r.url.endsWith('/api/books') || /Library-|bookIngest|pdf\.worker/.test(r.url)))
await U.page.goto(BASE + '/quan-tri', { waitUntil: 'networkidle' })
await U.page.fill('.adm-login input[placeholder="Số điện thoại hoặc email"]', USER)
await U.page.fill('.adm-login input[type=password]', PASS)
await U.page.click('.adm-login button.cta')
const denied = await until(async () => /không phải quản trị/.test(await U.page.locator('.adm-login').innerText().catch(() => '')), 10000)
check('trang /quan-tri: tài khoản thường đăng nhập -> "Tài khoản này không phải quản trị hệ thống", không vào được', denied && (await U.page.locator('.adm-tabs').count()) === 0)
await U.ctx.close()

const A = await device('A')
await login(A, ADMIN)
await parentSettings(A)
await A.page.waitForLoadState('networkidle'); await sleep(500)
check('app phụ huynh của chính tài khoản quản trị: Cài đặt cũng KHÔNG còn mục thư viện (đã chuyển sang /quan-tri)', (await A.page.locator('[data-testid=library]').count()) === 0 && !A.reqs.some((r) => /bookIngest|pdf\.worker/.test(r.url)))
await adminPage(A)
await A.page.screenshot({ path: `${OUT}/admin_books.png` })
check('trang quản trị: mục "Thư viện sách (dùng chung)" + nút "Nạp sách"; chưa tải pdf.js', /Thư viện sách \(dùng chung\)/i.test(await A.page.locator('[data-testid=library] h3').innerText()) && (await A.page.locator('.lib-add').count()) === 1 && !A.reqs.some((r) => /bookIngest|pdf\.worker/.test(r.url)))

/* ======== 2. Nạp SGK ======== */
console.log('— 2. Nạp SGK, tự gửi lại nửa trang lỗi')
const T1 = 'Ngữ văn 7 tập 1'
await ocr({ books: { [T1]: {
  1: ['# Bài 2. Mèo mướp và chú gà trống\nMèo mướp nằm phơi nắng bên hiên nhà.', 'Gà trống gáy vang khắp xóm.\n[Trang in: 30]'],
  2: ['# Thực hành tiếng Việt: Từ láy\nTừ láy là từ được tạo bởi các tiếng giống nhau về âm hoặc vần, ví dụ: lấp lánh, rì rào.', 'Bài tập 1. Tìm từ láy trong câu "Suối chảy rì rào".\n[Trang in: 31]'],
  3: ['# Bài 3. Số từ\nSố từ là những từ chỉ số lượng và thứ tự.', '[Trang in: 32]'],
  4: ['[Trống]', '[Trống]'],
} }, fail: [T1 + '|p2h2'] })
const nB0 = (await ocr()).batches.length
await A.page.locator('.lib-add input[type=file]').setInputFiles({ name: '07-sgk-ngu-van-7-tap-mot.pdf', mimeType: 'application/pdf', buffer: PDF_SGK })
await A.page.waitForSelector('[data-testid=lib-cost]', { timeout: 20000 })
const form = await A.page.locator('.lib-form').innerText()
const titleVal = await A.page.locator('.lib-form input[aria-label="Tên sách"]').inputValue()
check('gợi ý từ tên file: Lớp 7 · Ngữ văn · Sách giáo khoa (SGK) · tên "Ngữ văn 7 tập 1"', /Lớp 7/.test(form) && /Ngữ văn/.test(form) && /Sách giáo khoa \(SGK\)/.test(form) && titleVal === T1, form + ' | ' + titleVal)
check('trước khi đọc: hiện số trang + chi phí ước tính ("4 trang · … ~0,04 USD (≈ 1.000đ)")', /4 trang · chi phí đọc chữ ước tính ~0,04 USD \(≈ 1\.000đ\)/.test(await A.page.locator('[data-testid=lib-cost]').innerText()), await A.page.locator('[data-testid=lib-cost]').innerText())
check('pdf.js chỉ tải khi chọn file', A.reqs.some((r) => /bookIngest/.test(r.url)))
await A.page.locator('[data-testid=library]').screenshot({ path: `${OUT}/books_form.png` })
await A.page.click('.lib-form button.cta:has-text("Bắt đầu đọc")')
const done1 = await until(async () => /Đã đọc xong/.test(await bookLi(A, T1).innerText().catch(() => '')), 40000)
await A.page.locator('[data-testid=library]').screenshot({ path: `${OUT}/books_done.png` })
const st = await ocr()
const mine = st.batches.slice(nB0).filter((b) => b.items[0].title === T1)
const items = mine.flatMap((b) => b.items)
check('đọc xong qua giao diện: "✓ Đã đọc xong"', done1, await bookLi(A, T1).innerText().catch(() => ''))
check('lần đầu gửi 8 nửa trang (4 trang × 2); nửa trang lỗi p2h2 -> app tự gửi lại (lần 2 dài hơn)', mine.length >= 2 && mine[0].items.length + (mine.length > 2 ? mine[1].items.length : 0) >= 8 && items.filter((x) => x.cid === 'p2h2').length === 2 && items.filter((x) => x.cid === 'p2h2')[1].max_tokens === 8192, JSON.stringify(mine.map((b) => b.items.map((x) => x.cid))))
const first = items.filter((x, i) => items.findIndex((y) => y.cid === x.cid) === i)
const tops = first.filter((x) => x.half === 1), bots = first.filter((x) => x.half === 2)
const H = Math.round(1536 * 1100 / 1094)
check(`ảnh gửi đi: rộng 1100 px, mỗi nửa ≤ 1,15 MP (${first.map((x) => x.w + '×' + x.h).slice(0, 2).join(', ')}…)`, first.length === 8 && first.every((x) => x.w <= 1100 && x.w >= 1000 && x.w * x.h <= 1150000), JSON.stringify(first.map((x) => [x.cid, x.w, x.h])))
check(`cắt đôi đúng khe trắng (45,5–49% chiều cao ≈ ${Math.round(H * 0.455)}–${Math.round(H * 0.49)} px), hai nửa ghép lại đủ trang`, tops.every((x) => x.h >= H * 0.455 && x.h <= H * 0.49) && tops.every((t) => { const b = bots.find((y) => y.page === t.page); return b && Math.abs(t.h + b.h - H) <= 2 }), JSON.stringify(tops.map((x) => x.h)) + ' / ' + H)
const ups = A.reqs.filter((r) => r.url.endsWith('/api/books') && /"action":"upload"/.test(r.body))
check(`mỗi yêu cầu gửi ảnh < 4 MB (${ups.map((r) => (r.body.length / 1e6).toFixed(2)).join(', ')} MB)`, ups.length >= 2 && ups.every((r) => r.body.length < 4000000))

/* ======== 3. SBT: đóng app giữa chừng, chọn lại file ======== */
console.log('— 3. SBT: đóng app khi AI đang đọc, mở lại, chọn lại file')
const T2 = 'Ngữ văn 7 tập 1'
await ocr({ hold: true, fail: [T2 + '|p3h1'] })
await A.page.locator('.lib-add input[type=file]').setInputFiles({ name: 'Bài tập Ngữ Văn 7 Tập 1.pdf', mimeType: 'application/pdf', buffer: PDF_SBT })
await A.page.waitForSelector('[data-testid=lib-cost]', { timeout: 20000 })
const form2 = await A.page.locator('.lib-form').innerText()
check('"Bài tập Ngữ Văn 7 Tập 1.pdf" -> Sách bài tập (SBT), Lớp 7, Ngữ văn', /Sách bài tập \(SBT\)/.test(form2) && /Lớp 7/.test(form2) && /Ngữ văn/.test(form2), form2)
await A.page.click('.lib-form button.cta:has-text("Bắt đầu đọc")')
const sbtLi = () => A.page.locator('.lib-book', { has: A.page.locator('.lib-kind.k-sbt') }).last()
const sent2 = await until(async () => /Đã gửi ảnh xong/.test(await sbtLi().innerText().catch(() => '')), 30000)
check('gửi ảnh xong: "Đã gửi ảnh xong … Anh có thể đóng app"', sent2, await sbtLi().innerText().catch(() => ''))
const sbtId = await sbtLi().getAttribute('data-book')
await A.page.close()
await ocr({ hold: false })
const P2 = await A.ctx.newPage()
P2.on('pageerror', (e) => allErrs.push('A2 pageerror: ' + e.message))
const A2 = { ...A, page: P2 }
await adminPage(A2)   // đã đăng nhập trang quản trị từ trước: vào thẳng
await P2.waitForSelector(`[data-book="${sbtId}"]`, { timeout: 10000 })
const li2 = P2.locator(`[data-book="${sbtId}"]`)
const again = await until(async () => (await li2.locator('.lib-again').count()) > 0, 15000)
check('mở lại trang quản trị: tiến độ "Còn 1 nửa trang cần gửi (đã xong 5/6)" + nút "Chọn lại file PDF"', again && /Còn 1 nửa trang cần gửi \(đã xong 5\/6\)/.test(await li2.innerText()), await li2.innerText())
await P2.locator('[data-testid=library]').screenshot({ path: `${OUT}/books_again.png` })
await li2.locator('.lib-again input[type=file]').setInputFiles({ name: 'khac.pdf', mimeType: 'application/pdf', buffer: PDF_WRONG })
const wrong = await until(async () => /File này có 2 trang/.test(await li2.innerText()), 15000)
check('chọn nhầm file (2 trang) -> báo "File này có 2 trang, sách … cần đúng file 3 trang"', wrong, await li2.innerText())
const nb = (await ocr()).batches.length
await li2.locator('.lib-again input[type=file]').setInputFiles({ name: 'Bài tập Ngữ Văn 7 Tập 1.pdf', mimeType: 'application/pdf', buffer: PDF_SBT })
const done2 = await until(async () => /Đã đọc xong/.test(await li2.innerText()), 30000)
const nbs = (await ocr()).batches.slice(nb)
check('chọn đúng file -> chỉ gửi lại 1 nửa trang (p3h1) -> "✓ Đã đọc xong"', done2 && nbs.length === 1 && nbs[0].items.map((x) => x.cid).join() === 'p3h1', JSON.stringify(nbs.map((b) => b.items.map((x) => x.cid))))

/* ======== 4. Xoá sách ======== */
console.log('— 4. Xoá sách')
const before = await P2.locator('.lib-book').count()
await P2.locator(`[data-book="${sbtId}"] .lib-del`).click()
await P2.locator(`[data-book="${sbtId}"] button.danger:has-text("Xoá sách")`).click()
const gone = await until(async () => (await P2.locator(`[data-book="${sbtId}"]`).count()) === 0, 10000)
check('bấm "🗑️ Xoá" -> "Xoá sách" -> sách mất khỏi danh sách', gone && (await P2.locator('.lib-book').count()) === before - 1)
// dọn: xoá mọi sách thử còn lại
while (await P2.locator('.lib-book .lib-del').count()) {
  const li = P2.locator('.lib-book').first()
  await li.locator('.lib-del').click(); await li.locator('button.danger').click(); await sleep(600)
}

check('không có lỗi trang / lỗi console', allErrs.length === 0, allErrs.join(' | '))
await browser.close()
const fails = Object.entries(results).filter(([, v]) => v !== 'PASS')
console.log(fails.length ? `\n${fails.length} FAIL` : `\nALL PASS (${Object.keys(results).length} kiểm tra)`)
process.exit(fails.length ? 1 : 0)
