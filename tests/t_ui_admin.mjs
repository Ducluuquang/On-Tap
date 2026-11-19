// TRANG QUẢN TRỊ /quan-tri + GÓP Ý qua giao diện thật (17/11/2026).
//  1  /quan-tri: sai mật khẩu -> báo lỗi; quản trị đăng nhập -> 5 mục; Tổng quan; Người dùng (tìm); màn điện thoại không tràn ngang.
//  2  Định giá: đặt giá gói 1 + 2 -> trang đăng ký của app hiện đúng giá (gói chưa đặt: "Giá: liên hệ").
//  3  Góp ý: học sinh gửi từ trang chủ (kèm ảnh chụp màn hình), phụ huynh gửi từ trang báo cáo -> trang quản trị thấy 2 phiếu,
//     xem ảnh, trả lời -> app hiện chấm đỏ, mở ra thấy câu trả lời, hết chấm đỏ -> nhắn tiếp -> quản trị đóng phiếu + bài học;
//     tải toàn bộ nhật ký (JSON) cho AI học.
import { pw, OUT_DIR } from './_env.mjs'
import { useRealFonts } from './fonts.mjs'
const OUT = OUT_DIR
const BASE = process.env.BASE || 'http://localhost:4192'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const browser = await pw.chromium.launch({ headless: true })
const results = {}
const check = (n, c, x = '') => { results[n] = c ? 'PASS' : 'FAIL'; console.log((c ? '  ✓ ' : '  ✗ ') + n + (c || !x ? '' : '  → ' + x)) }
const RUN = String(Date.now()).slice(-6)
const ip = () => '10.14.' + (Number(RUN) % 250) + '.' + (1 + Math.floor(Math.random() * 200))
async function acct(action, body = {}, token = '') {
  const r = await fetch(BASE + '/api/account', { method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': ip(), ...(token ? { authorization: 'Bearer ' + token } : {}) }, body: JSON.stringify({ action, ...body }) })
  return r.json()
}
async function until(fn, ms = 15000, step = 300) { const t0 = Date.now(); for (;;) { const v = await fn(); if (v) return v; if (Date.now() - t0 > ms) return v; await sleep(step) } }
const ADMIN = '0912000777', PASS = '12345678', USER = '0922' + RUN, KID = 'kidF' + RUN
if (!(await acct('register', { phone: ADMIN, pass: PASS, parentName: 'Quản trị', plan: 1, pin: '1', children: [{ id: 'kA' + RUN, name: 'Bé', pin: '1', icon: '🦊', grade: 'Lớp 7' }] })).ok) await acct('login', { id: ADMIN, pass: PASS })
await acct('register', { phone: USER, pass: PASS, parentName: 'Ba Minh', plan: 1, pin: '3', children: [{ id: KID, name: 'Minh', pin: '7', icon: '🦊', grade: 'Lớp 4' }] })
{ // bộ thử này kiểm tra NGƯỜI trả lời góp ý: tắt ONTAP tự trả lời (ONTAP thử ở t_api_roles / t_ui_roles)
  const t = (await acct('login', { id: ADMIN, pass: PASS })).token
  await fetch(BASE + '/api/admin', { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + t }, body: JSON.stringify({ action: 'settings_set', aiOn: false }) })
}

const allErrs = []
async function device(name, { width = 390, height = 844 } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, acceptDownloads: true })
  await useRealFonts(ctx)
  const page = await ctx.newPage()
  page.on('pageerror', (e) => allErrs.push(name + ' pageerror: ' + e.message))
  page.on('console', (m) => { if (m.type() === 'error' && !/favicon|fonts\.g|status of 4\d\d/.test(m.text())) allErrs.push(name + ' console: ' + m.text()) })
  return { name, ctx, page }
}
async function adminLogin(d, pass = PASS) {
  await d.page.goto(BASE + '/quan-tri', { waitUntil: 'networkidle' })
  await d.page.fill('.adm-login input[placeholder="Số điện thoại hoặc email"]', ADMIN)
  await d.page.fill('.adm-login input[type=password]', pass)
  await d.page.click('.adm-login button.cta')
}
const tab = async (d, label) => { await d.page.click(`.adm-tab:has-text("${label}")`); await sleep(400) }
const noOverflow = (d) => d.page.evaluate(() => document.scrollingElement.scrollWidth <= document.scrollingElement.clientWidth + 1)

/* ======== 0. Lần đầu tạo tài khoản quản trị ======== */
console.log('— 0. Lần đầu: tạo tài khoản quản trị trên /quan-tri')
await fetch('http://127.0.0.1:4199/pipeline', { method: 'POST', headers: { authorization: 'Bearer test-token' }, body: JSON.stringify([['DEL', 'acct:u:0912000779']]) })
const S = await device('S')
await S.page.goto(BASE + '/quan-tri', { waitUntil: 'networkidle' })
await S.page.fill('.adm-login input[placeholder="Số điện thoại hoặc email"]', '0912000779')
await S.page.fill('.adm-login input[type=password]', 'MatKhau#2026')
await S.page.click('.adm-login button.cta')
check('chưa có tài khoản -> báo sai + chỉ cách: bấm "Lần đầu: tạo tài khoản quản trị"', await until(async () => /Lần đầu: tạo tài khoản quản trị/.test(await S.page.locator('.adm-login .err').innerText().catch(() => ''))))
await S.page.click('.adm-setup-link')
await S.page.fill('input[aria-label="Số điện thoại quản trị"]', '+84 912 000 779')
await S.page.fill('input[aria-label="Mật khẩu mới"]', 'MatKhau#2026')
await S.page.fill('input[aria-label="Nhập lại mật khẩu"]', 'MatKhau#2026')
await S.page.fill('input[aria-label="Mã cài đặt"]', 'sai-ma-cai-dat')
await S.page.click('.adm-login button.cta')
check('sai mã cài đặt -> "Mã cài đặt chưa đúng (là giá trị ADMIN_SETUP_CODE …)"', await until(async () => /Mã cài đặt chưa đúng/.test(await S.page.locator('.adm-login .err').innerText().catch(() => ''))))
await S.page.screenshot({ path: `${OUT}/admin_setup.png` })
await S.page.fill('input[aria-label="Mã cài đặt"]', 'ma-cai-dat-thu-123')
await S.page.click('.adm-login button.cta')
check('đúng mã -> tạo tài khoản, vào thẳng trang quản trị', await until(async () => (await S.page.locator('.adm-tabs').count()) === 1))
await S.page.click('button:has-text("Đăng xuất")')
await S.page.fill('.adm-login input[placeholder="Số điện thoại hoặc email"]', '+84912000779')
await S.page.fill('.adm-login input[type=password]', 'MatKhau#2026')
await S.page.click('.adm-login button.cta')
check('đăng xuất rồi đăng nhập lại bằng số (gõ dạng +84) + mật khẩu vừa tạo -> vào được', await until(async () => (await S.page.locator('.adm-tabs').count()) === 1))
await S.ctx.close()

/* ======== 1. Trang quản trị ======== */
console.log('— 1. Trang quản trị /quan-tri')
const A = await device('A', { width: 1280, height: 860 })
await adminLogin(A, '99999999')
const wrong = await until(async () => /Sai số điện thoại/.test(await A.page.locator('.adm-login').innerText()))
check('sai mật khẩu -> "Sai số điện thoại / email hoặc mật khẩu."', wrong)
await adminLogin(A)
await A.page.waitForSelector('.adm-tabs', { timeout: 10000 })
const tabs = await A.page.$$eval('.adm-tab', (els) => els.map((e) => e.textContent))
check('super admin đăng nhập -> 8 mục: Tổng quan · Thư viện sách · Người dùng · Góp ý · Định giá · Duyệt & nhật ký · Quản trị viên · Cài đặt', tabs.join('|') === '📊 Tổng quan|📚 Thư viện sách|👪 Người dùng|💬 Góp ý|💰 Định giá|✅ Duyệt & nhật ký|👥 Quản trị viên|⚙️ Cài đặt', tabs.join('|'))
await A.page.waitForSelector('[data-testid=adm-overview]', { timeout: 10000 })
// bản máy tính (19/11/2026): nhãn các ô số liệu viết IN HOA bằng CSS -> innerText in hoa: so không phân biệt hoa thường
const ov = (await A.page.locator('[data-testid=adm-overview]').innerText()).toLocaleLowerCase('vi')
check('Tổng quan: số tài khoản, học sinh, đăng ký mới, dùng app 7 ngày, góp ý chờ, sách, theo gói; doanh thu ghi rõ "chưa ghép cổng thanh toán"', /tài khoản phụ huynh/.test(ov) && /học sinh/.test(ov) && /đăng ký mới/.test(ov) && /7 ngày qua/.test(ov) && /dùng app 7 ngày/.test(ov) && /góp ý đang chờ/.test(ov) && /sách trong thư viện/.test(ov) && /theo gói/.test(ov) && /chưa ghép cổng thanh toán/.test(ov), ov)
await A.page.screenshot({ path: `${OUT}/admin_overview.png` })
await tab(A, 'Người dùng')
await A.page.fill('[data-testid=adm-users] input', USER)
await A.page.click('[data-testid=adm-users] button.cta')
const found = await until(async () => { const t = await A.page.locator('[data-testid=adm-users]').innerText(); return /1 tài khoản khớp/.test(t) && t.includes('Ba Minh') ? t : null })
await A.page.click('.adm-user')
const kids = await A.page.locator('.adm-kids').innerText().catch(() => '')
check('Người dùng: tìm theo số -> 1 tài khoản "Ba Minh", bấm vào thấy con "Minh · Lớp 4"', !!found && /Minh · Lớp 4/.test(kids), (found || '') + ' | ' + kids)
const M = await device('M')
await adminLogin(M)
await M.page.waitForSelector('.adm-tabs', { timeout: 10000 })
let okW = true
for (const t of ['Tổng quan', 'Người dùng', 'Góp ý', 'Định giá']) { await tab(M, t); await sleep(500); if (!(await noOverflow(M))) okW = false }
check('màn điện thoại 390px: mọi mục không tràn ngang', okW)
await M.ctx.close()

/* ======== 2. Định giá ======== */
console.log('— 2. Định giá gói')
await tab(A, 'Định giá')
await A.page.waitForSelector('[data-testid=adm-price] table')
await A.page.fill('input[aria-label="Gói 1 hàng tháng"]', '99000')
await A.page.fill('input[aria-label="Gói 1 hàng năm"]', '990000')
await A.page.fill('input[aria-label="Gói 2 hàng tháng"]', '179000')
await A.page.fill('input[aria-label="Gói 2 hàng năm"]', '0')
for (const id of [3, 4, 5]) { await A.page.fill(`input[aria-label="Gói ${id} hàng tháng"]`, '0'); await A.page.fill(`input[aria-label="Gói ${id} hàng năm"]`, '0') }
await A.page.click('[data-testid=adm-price] button.cta')
const saved = await until(async () => /Đã lưu bảng giá/.test(await A.page.locator('[data-testid=adm-price]').innerText()))
check('Định giá: nhập giá gói 1 (99.000đ / 990.000đ), gói 2 (179.000đ / tháng) -> "Đã lưu bảng giá ✓"', saved && /99\.000đ/.test(await A.page.locator('[data-testid=adm-price]').innerText()))
await A.page.screenshot({ path: `${OUT}/admin_price.png` })
const R = await device('R')
await R.page.goto(BASE + '/', { waitUntil: 'networkidle' })
await R.page.click('.auth-landing button:has-text("Đăng ký")').catch(() => {})
await R.page.waitForSelector('[data-testid=reg-price]', { timeout: 10000 })
const p1 = await until(async () => { const t = await R.page.locator('[data-testid=reg-price]').innerText(); return /99\.000đ/.test(t) ? t : null })
await R.page.click('.reg-plan .chip:has-text("2 học sinh")')
const p2 = await R.page.locator('[data-testid=reg-price]').innerText()
await R.page.click('.reg-plan .chip:has-text("3 học sinh")')
const p3 = await R.page.locator('[data-testid=reg-price]').innerText()
check('trang đăng ký của app: gói 1 "99.000đ / tháng · 990.000đ / năm"; gói 2 "179.000đ / tháng"; gói 3 "Giá: liên hệ"', /99\.000đ \/ tháng · 990\.000đ \/ năm/.test(p1 || '') && /179\.000đ \/ tháng/.test(p2) && !/năm/.test(p2) && /Giá: liên hệ/.test(p3), [p1, p2, p3].join(' | '))
await R.ctx.close()

/* ======== 3. Góp ý hai chiều ======== */
console.log('— 3. Góp ý: học sinh + phụ huynh gửi, quản trị trả lời')
const C = await device('C')
await C.page.goto(BASE + '/', { waitUntil: 'networkidle' })
await C.page.click('.auth-landing button:has-text("Đăng nhập")')
await C.page.fill('input[placeholder="Số điện thoại hoặc email"]', USER)
await C.page.fill('input[placeholder="Mật khẩu 8 số"]', PASS)
await C.page.click('.auth-card button.cta:has-text("Đăng nhập")')
await C.page.waitForSelector('.pick-grid', { timeout: 10000 })
await C.page.click('.pick-card:has-text("Minh")'); await C.page.fill('.pick-pinbox input', '7'); await C.page.click('.pick-pinbox button.cta')
await C.page.waitForSelector('.kh-cta', { timeout: 10000 })
check('trang chủ của con có nút "💬 Góp ý / báo lỗi cho Ôn Tập" (chưa có chấm đỏ)', (await C.page.locator('.kh-fb').count()) === 1 && (await C.page.locator('.kh-fb .dot').count()) === 0)
await C.page.click('.kh-fb')
await C.page.waitForSelector('[data-testid=feedback]')
await C.page.click('[data-testid=feedback] .chip:has-text("Báo lỗi")')
await C.page.fill('textarea[aria-label="Nội dung góp ý"]', 'Con bấm Bắt đầu ôn thì bị trắng màn hình ' + RUN)
const shot = await C.page.screenshot()
await C.page.locator('.fb-shot input[type=file]').setInputFiles({ name: 'man-hinh.png', mimeType: 'image/png', buffer: shot })
await until(async () => /man-hinh\.png/.test(await C.page.locator('[data-testid=feedback]').innerText()))
await C.page.click('[data-testid=feedback] button.cta:has-text("Gửi góp ý")')
const sent = await until(async () => /Đã gửi ✓ Cảm ơn con/.test(await C.page.locator('[data-testid=feedback]').innerText()))
check('học sinh gửi báo lỗi kèm ảnh chụp màn hình -> "Đã gửi ✓ Cảm ơn con!"', sent)
await C.page.screenshot({ path: `${OUT}/fb_child_sent.png` })
// phụ huynh gửi từ trang báo cáo
await C.page.click('.backhead .back')
await C.page.click('.ds-seg button:has-text("Phụ huynh")')
await C.page.waitForSelector('.modal input', { timeout: 5000 })
await C.page.fill('.modal input.pin-in', '3'); await C.page.click('.modal .modal-btns .cta:not(.ghost)')
await C.page.waitForSelector('.pd-fb', { timeout: 10000 })
await C.page.click('.pd-fb')
await C.page.waitForSelector('[data-testid=feedback]')
await C.page.click('[data-testid=feedback] .chip:has-text("Kiến nghị")')
await C.page.fill('textarea[aria-label="Nội dung góp ý"]', 'Phụ huynh đề nghị thêm báo cáo theo tuần ' + RUN)
await C.page.click('[data-testid=feedback] button.cta:has-text("Gửi góp ý")')
check('phụ huynh gửi kiến nghị từ trang báo cáo ("💬 Góp ý / báo lỗi cho Ôn Tập")', await until(async () => /Đã gửi ✓ Cảm ơn anh\/chị/.test(await C.page.locator('[data-testid=feedback]').innerText())))

await tab(A, 'Góp ý')
await A.page.waitForSelector('[data-testid=adm-fb]')
const childFb = A.page.locator('.adm-fbi', { hasText: 'Con bấm Bắt đầu ôn thì bị trắng màn hình ' + RUN })
const parentFb = A.page.locator('.adm-fbi', { hasText: 'Phụ huynh đề nghị thêm báo cáo theo tuần ' + RUN })
await until(async () => (await childFb.count()) === 1)
check('trang quản trị: 2 phiếu mới 🔴 — "Báo lỗi · Học sinh Minh" và "Kiến nghị · Phụ huynh"', /🔴 Báo lỗi · Học sinh Minh/.test(await childFb.innerText()) && /🔴 Kiến nghị · Phụ huynh/.test(await parentFb.innerText()))
await childFb.locator('.adm-first').click()
await A.page.waitForSelector('[data-testid=adm-thread]')
const th = await A.page.locator('[data-testid=adm-thread]').innerText()
check('mở phiếu: ai gửi (học sinh Minh, Lớp 4), số điện thoại, màn hình đang dùng', /Học sinh Minh \(Lớp 4\)/.test(th) && th.includes(USER) && /màn trang chủ con/.test(th), th.slice(0, 300))
await A.page.click('[data-testid=adm-thread] button:has-text("Xem ảnh chụp màn hình")')
check('xem được ảnh chụp màn hình con gửi', await until(async () => (await A.page.locator('.adm-shot').count()) === 1))
await A.page.fill('textarea[aria-label="Trả lời"]', 'Chào Minh! Ôn Tập đã sửa lỗi này, con thử lại nhé.')
await A.page.click('[data-testid=adm-thread] button:has-text("Gửi trả lời")')
await until(async () => /Ôn Tập đã sửa lỗi này/.test(await A.page.locator('[data-testid=adm-thread]').innerText()))
await A.page.screenshot({ path: `${OUT}/admin_fb.png`, fullPage: true })

// con mở lại app -> chấm đỏ
await C.page.click('.ds-seg button:has-text("Con")')
await C.page.evaluate(() => sessionStorage.removeItem('ontap.fbunread.v1'))
await C.page.reload({ waitUntil: 'networkidle' })
if (await C.page.locator('.pick-grid').count()) { await C.page.click('.pick-card:has-text("Minh")'); await C.page.fill('.pick-pinbox input', '7'); await C.page.click('.pick-pinbox button.cta') }
await C.page.waitForSelector('.kh-cta', { timeout: 10000 })
const dot = await until(async () => (await C.page.locator('.kh-fb .dot').count()) === 1)
check('con mở app -> nút Góp ý có CHẤM ĐỎ (có câu trả lời mới)', dot)
await C.page.click('.kh-fb')
await C.page.waitForSelector('[data-testid=feedback]')
const autoMine = await until(async () => (await C.page.locator('.fb-item.unread').count()) === 1)
check('mở Góp ý -> tự sang "Góp ý của con", phiếu có câu trả lời mới được đánh dấu', autoMine)
await C.page.locator('.fb-item.unread .fb-item-h').click()
const conv = await until(async () => { const t = await C.page.locator('.fb-thread').innerText().catch(() => ''); return /🧑‍💼 Ôn Tập/.test(t) && /đã sửa lỗi này/.test(t) ? t : null })
check('"Góp ý của con" chỉ có phiếu của con (không thấy kiến nghị của phụ huynh)', !/Phụ huynh đề nghị/.test(await C.page.locator('[data-testid=feedback]').innerText()))
check('con thấy câu trả lời "🧑‍💼 Ôn Tập: … đã sửa lỗi này"', !!conv, conv || '')
await C.page.screenshot({ path: `${OUT}/fb_child_reply.png` })
await C.page.fill('textarea[aria-label="Nhắn thêm"]', 'Dạ con thử lại được rồi ạ!')
await C.page.click('.fb-thread button.cta:has-text("Gửi")')
await until(async () => /con thử lại được rồi/.test(await C.page.locator('.fb-thread').innerText()))
await C.page.click('.backhead .back')
await C.page.waitForSelector('.kh-cta')
await C.page.evaluate(() => sessionStorage.removeItem('ontap.fbunread.v1'))
await C.page.reload({ waitUntil: 'networkidle' })
if (await C.page.locator('.pick-grid').count()) { await C.page.click('.pick-card:has-text("Minh")'); await C.page.fill('.pick-pinbox input', '7'); await C.page.click('.pick-pinbox button.cta') }
await C.page.waitForSelector('.kh-cta', { timeout: 10000 }); await sleep(1200)
check('đã xem -> hết chấm đỏ', (await C.page.locator('.kh-fb .dot').count()) === 0)

// quản trị: tin nhắn mới của con, đóng phiếu + bài học, tải nhật ký
await tab(A, 'Tổng quan'); await tab(A, 'Góp ý')
await until(async () => (await childFb.count()) === 1 && /🔴/.test(await childFb.innerText()))
await childFb.locator('.adm-first').click()
await A.page.waitForSelector('[data-testid=adm-thread]')
check('quản trị thấy con nhắn thêm (phiếu lại 🔴 chờ trả lời)', /con thử lại được rồi/.test(await A.page.locator('[data-testid=adm-thread]').innerText()))
await A.page.fill('textarea[aria-label="Bài học"]', 'Màn trắng khi bắt đầu ôn: lỗi tải câu hỏi, đã sửa. Lần sau hướng dẫn con tải lại trang.')
await A.page.click('[data-testid=adm-thread] button:has-text("Đóng phiếu")')
check('đóng phiếu + lưu bài học -> "Đã đóng phiếu ✓ (bài học đã lưu)"', await until(async () => /Đã đóng phiếu ✓/.test(await A.page.locator('[data-testid=adm-fb]').innerText())))
await A.page.click('.adm-kb summary')
check('mục Góp ý có "📘 Hiểu biết hệ thống cho chăm sóc khách hàng" (mở ra đọc được)', await until(async () => /Quên mật khẩu/.test(await A.page.locator('.adm-kb-t').innerText())))
const [dl] = await Promise.all([A.page.waitForEvent('download'), A.page.click('button:has-text("Tải toàn bộ nhật ký")')])
const data = JSON.parse(await (await import('node:fs')).promises.readFile(await dl.path(), 'utf8'))
const ex = data.threads.find((t) => t.conversation[0].text.includes('trắng màn hình ' + RUN))
check('tải toàn bộ nhật ký (JSON): đủ 3 tin nhắn + bài học, không kèm số điện thoại', /^ontap-gop-y-.*\.json$/.test(dl.suggestedFilename()) && ex && ex.conversation.length === 3 && /đã sửa/.test(ex.lesson) && !JSON.stringify(data).includes(USER), dl.suggestedFilename())

check('không có lỗi trang / lỗi console', allErrs.length === 0, allErrs.join(' | '))
await browser.close()
const fails = Object.entries(results).filter(([, v]) => v !== 'PASS')
console.log(fails.length ? `\n${fails.length} FAIL` : `\nALL PASS (${Object.keys(results).length} kiểm tra)`)
process.exit(fails.length ? 1 : 0)
