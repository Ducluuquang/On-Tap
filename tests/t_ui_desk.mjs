// BẢN MÁY TÍNH, ĐỢT 1 (anh duyệt 7 ảnh mẫu 19/11/2026) — màn ≥ 1024 px: Đăng nhập / Đăng ký / Thanh toán / Quên mật khẩu,
// Chọn người học, khu Phụ huynh (báo cáo, Cài đặt, Góp ý) và trang quản trị /quan-tri. Đợt 2 (21/11/2026): màn của CON cũng dùng khung
// bản máy tính (phần 8); làm bài / trò chơi là khung dọc giữa màn phóng to theo --fit,
// màn < 1024 px giữ nguyên. AI giả, thư giả (MAIL_MOCK_FILE), phông thật.
//  1  Đăng nhập: bảng thương hiệu + ô đăng nhập NGAY; ô trống -> báo lỗi, không gọi máy chủ; Enter đăng nhập; Quên mật khẩu (gửi mã);
//     kéo cửa sổ qua lại mốc 1024 px không mất chữ đang gõ; 390 px vẫn màn đầu cũ (2 nút).
//  2  Đăng ký: lưới 2 cột, gói 2 -> hai khối con cạnh nhau, ô Lớp tự vẽ (không <select>), đi hết tới Thanh toán rồi vào app.
//  3  Chọn người học: thẻ cùng một hàng, PIN -> vào học (màn của con vẫn phóng to).
//  4  Phụ huynh: thanh trên một hàng, 4 ô số liệu khớp trang của con, 7 cột + bấm cột đổi nhận xét, bản đồ kiến thức theo môn,
//     hộp PIN phủ cả cửa sổ, "Con" về cột phóng to, Cài đặt + Góp ý trong thẻ giữa rồi quay lại.
//  5  Quản trị: cột trái (super 8 mục, admin 6 mục), huy hiệu đúng số, Tổng quan "Việc cần xử lý" -> "Trả lời" mở đúng phiếu,
//     trả lời được; Thư viện (bảng, tìm, lọc Lớp / Môn); Người dùng (bảng, mở danh sách con); 390 px giữ menu ngang.
//  6  Mọi cỡ màn (1024, 1280, 1366, 1440, 1920 + 390): không cuộn ngang, không lỗi trang; ảnh tests/out/desk_*.png (1440 px).
import fs from 'node:fs'
import path from 'node:path'
import { pw, OUT_DIR } from './_env.mjs'
import { useRealFonts } from './fonts.mjs'
const OUT = OUT_DIR
const BASE = process.env.BASE || 'http://localhost:4192'
const MAILF = path.join(OUT_DIR, 'mail-4192.jsonl')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const browser = await pw.chromium.launch({ headless: true })
const results = {}
const check = (n, c, x = '') => { results[n] = c ? 'PASS' : 'FAIL'; console.log((c ? '  ✓ ' : '  ✗ ') + n + (c || !x ? '' : '  → ' + x)) }
const RUN = String(Date.now()).slice(-6)
const ip = () => '10.19.' + (Number(RUN) % 250) + '.' + (1 + Math.floor(Math.random() * 200))
async function post(api, action, body = {}, token = '') {
  const r = await fetch(BASE + api, { method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': ip(), ...(token ? { authorization: 'Bearer ' + token } : {}) }, body: JSON.stringify({ action, ...body }) })
  return r.json()
}
const acct = (a, b, t) => post('/api/account', a, b, t)
async function until(fn, ms = 15000, step = 250) { const t0 = Date.now(); for (;;) { const v = await fn(); if (v) return v; if (Date.now() - t0 > ms) return v; await sleep(step) } }
const mails = () => { try { return fs.readFileSync(MAILF, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l)) } catch { return [] } }
const low = (s) => String(s || '').toLocaleLowerCase('vi')   // innerText theo CSS (text-transform: uppercase) -> so không phân biệt hoa thường

// ---------- dữ liệu thử (máy chủ thử, kho thử) ----------
const SUPER = '0912000777', PASS = '12345678', USER = '0931' + RUN, STAFF = '0932' + RUN, REG = '0933' + RUN
const EMAIL = `desk${RUN}@vidu.test`, K1 = 'kD1' + RUN, K2 = 'kD2' + RUN
if (!(await acct('register', { phone: SUPER, pass: PASS, parentName: 'Quản trị', plan: 1, pin: '1', children: [{ id: 'kS' + RUN, name: 'Bé', pin: '1', icon: '🦊', grade: 'Lớp 7' }] })).ok) await acct('login', { id: SUPER, pass: PASS })
const reg = await acct('register', { phone: USER, pass: PASS, email: EMAIL, parentName: 'Chị Lan', province: 'Hà Nội', plan: 3, pin: '3',
  children: [{ id: K1, name: 'An', pin: '7', icon: '🦊', grade: 'Lớp 7', school: 'THCS Lê Lợi' }, { id: K2, name: 'Bình', pin: '', icon: '🐼', grade: 'Lớp 4' }] })
const SUP = (await acct('login', { id: SUPER, pass: PASS })).token
const adm = (a, b = {}, t = SUP) => post('/api/admin', a, b, t)
await adm('settings_set', { aiOn: false })   // phiếu góp ý chờ NGƯỜI trả lời (ONTAP thử ở t_ui_roles)
await adm('staff_add', { phone: STAFF, name: 'Chị Hoa', pass: 'NhanVien#1' })
const STF = (await acct('login', { id: STAFF, pass: 'NhanVien#1' })).token
const UT = reg.token || (await acct('login', { id: USER, pass: PASS })).token
const fb1 = await post('/api/feedback', 'send', { kind: 'bug', who: 'parent', text: `Báo cáo trên điện thoại không hiện thời gian học ${RUN}\nDòng thứ hai`, screen: 'trang phụ huynh' }, UT)
const fb2 = await post('/api/feedback', 'send', { kind: 'idea', who: 'child', child: { id: K1, name: 'An', grade: 'Lớp 7' }, text: `Con muốn có màu nền tối ${RUN}`, screen: 'trang chủ con' }, UT)
await adm('prices_set', { plans: { 1: { month: 99000, year: 0 }, 2: { month: 0, year: 0 }, 3: { month: 0, year: 0 }, 4: { month: 0, year: 0 }, 5: { month: 0, year: 0 } } }, STF)
await post('/api/books', 'create', { title: 'Ngữ văn 7 tập 1 ' + RUN, grade: 'Lớp 7', subject: 'Ngữ văn', kind: 'sgk', pages: 4, file: 'nv7.pdf' }, SUP)
await post('/api/books', 'create', { title: 'Bài tập Toán 5 ' + RUN, grade: 'Lớp 5', subject: 'Toán', kind: 'sbt', pages: 3, file: 't5.pdf' }, STF)
check('dữ liệu thử: tài khoản, 2 góp ý chờ trả lời, đề xuất giá + sách mới của admin chờ duyệt', !!(reg.ok && UT && STF && fb1.ok && fb2.ok), JSON.stringify({ reg: reg.ok, fb1, fb2 }))

// ---------- trình duyệt ----------
const allErrs = []
async function device(name, { width = 1440, height = 900, init = null } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 })
  await useRealFonts(ctx)
  if (init) await ctx.addInitScript(init.fn, init.arg)
  const page = await ctx.newPage()
  page.on('pageerror', (e) => allErrs.push(name + ' pageerror: ' + e.message))
  page.on('console', (m) => { if (m.type() === 'error' && !/favicon|fonts\.g|status of 4\d\d/.test(m.text())) allErrs.push(name + ' console: ' + m.text()) })
  return { name, ctx, page }
}
const noHScroll = (p) => p.evaluate(() => document.scrollingElement.scrollWidth <= document.scrollingElement.clientWidth + 1)
const rect = (p, sel) => p.locator(sel).first().evaluate((e) => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height, t: r.top, b: r.bottom, l: r.left, r: r.right } })
const shot = (p, n) => p.screenshot({ path: `${OUT}/desk_${n}.png`, fullPage: true })
// PDF giả 1 trang (một ảnh JPEG) cho hộp "Nạp sách" — sách giả, kho công khai
async function onePagePdf() {
  const mk = await browser.newPage()
  const img = Buffer.from(await mk.evaluate(() => { const c = document.createElement('canvas'); c.width = 400; c.height = 560; const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, 400, 560); g.fillStyle = '#222'; g.fillText('Sách giả', 40, 60); return c.toDataURL('image/jpeg', 0.8).split(',')[1] }), 'base64')
  await mk.close()
  const parts = [], offs = []; let len = 0
  const add = (b) => { const buf = Buffer.isBuffer(b) ? b : Buffer.from(b, 'latin1'); parts.push(buf); len += buf.length }
  const obj = (id, body) => { offs[id] = len; add(`${id} 0 obj\n`); for (const b of [].concat(body)) add(b); add('\nendobj\n') }
  const cs = 'q 288 0 0 403.2 0 0 cm /Im0 Do Q'
  add('%PDF-1.4\n')
  obj(1, '<< /Type /Catalog /Pages 2 0 R >>'); obj(2, '<< /Type /Pages /Kids [3 0 R] /Count 1 >>')
  obj(3, '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 288 403.2] /Resources << /XObject << /Im0 5 0 R >> >> /Contents 4 0 R >>')
  obj(4, `<< /Length ${cs.length} >>\nstream\n${cs}\nendstream`)
  obj(5, [`<< /Type /XObject /Subtype /Image /Width 400 /Height 560 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${img.length} >>\nstream\n`, img, '\nendstream'])
  const x = len; add('xref\n0 6\n0000000000 65535 f \n'); for (let i = 1; i < 6; i++) add(String(offs[i]).padStart(10, '0') + ' 00000 n \n')
  add(`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${x}\n%%EOF\n`)
  return Buffer.concat(parts)
}

/* ======== 1. Đăng nhập ======== */
console.log('— 1. Đăng nhập (màn rộng)')
{
  const D = await device('login')
  const calls = []
  D.page.on('request', (r) => { if (r.url().includes('/api/account') && r.method() === 'POST') calls.push(r.postData() || '') })
  await D.page.goto(BASE + '/', { waitUntil: 'networkidle' })
  const st = await D.page.evaluate(() => ({ brand: !!document.querySelector('.dk-brand'), phone: !!document.querySelector('.phone'), stage: !!document.querySelector('.stage'),
    inp: !!document.querySelector('.auth-landing input[placeholder="Số điện thoại hoặc email"]'), h1: document.querySelector('.dk-brand h1')?.textContent, fit: getComputedStyle(document.querySelector('.dk-root')).zoom }))
  check('1440: mở app là thấy NGAY ô đăng nhập + bảng thương hiệu "Ôn tập thông minh cho con" (không nằm trong cột điện thoại, không phóng to)', st.brand && st.inp && !st.phone && !st.stage && st.h1 === 'Ôn tập thông minh cho con' && String(st.fit) === '1', JSON.stringify(st))
  const L = await D.page.evaluate(() => { const b = document.querySelector('.dk-brand').getBoundingClientRect(); const c = document.querySelector('.auth-landing').getBoundingClientRect(); return { bw: b.width, cw: c.width, cx: c.left } })
  check('bảng trái rộng 46% (≥ 520 px), thẻ đăng nhập ≤ 460 px nằm bên phải', Math.abs(L.bw - 1440 * 0.46) <= 2 && L.cw <= 460.5 && L.cx > L.bw, JSON.stringify(L))
  await shot(D.page, 'login')
  const n0 = calls.length
  await D.page.click('.auth-landing button:has-text("Đăng nhập")')
  const e1 = await D.page.locator('.auth-landing .err').innerText().catch(() => '')
  check('bấm Đăng nhập khi ô trống -> báo lỗi, không gọi máy chủ', /Nhập số điện thoại/.test(e1) && calls.slice(n0).every((c) => !/"login"/.test(c)), e1)
  // kéo cửa sổ qua lại mốc 1024 px: chữ đang gõ vẫn còn
  await D.page.fill('.auth-landing input[placeholder="Số điện thoại hoặc email"]', USER)
  await D.page.setViewportSize({ width: 800, height: 900 }); await sleep(300)
  const narrow = { phone: await D.page.locator('.phone .auth-card').count(), v: await D.page.inputValue('input[placeholder="Số điện thoại hoặc email"]').catch(() => '') }
  await D.page.setViewportSize({ width: 1440, height: 900 }); await sleep(300)
  const wide = await D.page.inputValue('.auth-landing input[placeholder="Số điện thoại hoặc email"]').catch(() => '')
  check('kéo cửa sổ xuống 800 px rồi lên lại 1440 px: bố cục tự đổi, số đang gõ vẫn còn', narrow.phone === 1 && narrow.v === USER && wide === USER, JSON.stringify({ narrow, wide }))
  // Quên mật khẩu -> gửi mã (thư giả)
  await D.page.click('.auth-landing button:has-text("Quên mật khẩu?")')
  await D.page.fill('.dk-forgot input[placeholder="Số điện thoại hoặc email đã đăng ký"]', USER)
  const m0 = mails().length
  await D.page.click('.dk-forgot button.cta:has-text("Gửi mã")')
  const sent = await until(async () => (await D.page.locator('.dk-forgot .auth-sent').count()) === 1)
  const ms = mails().slice(m0)
  check('"Quên mật khẩu?" -> cùng bố cục chia đôi, gửi mã 6 số tới email đã đăng ký (thư giả)', sent && (await D.page.locator('.dk-brand').count()) === 1 && ms.length === 1 && ms[0].to === EMAIL, JSON.stringify(ms.map((m) => m.to)))
  await shot(D.page, 'forgot')
  await D.page.click('.dk-forgot button:has-text("← Quay lại đăng nhập")')
  await D.page.click('.auth-landing button:has-text("Đăng ký tài khoản phụ huynh")')
  check('"Đăng ký tài khoản phụ huynh" mở Đăng ký (bảng trái 3 bước)', await until(async () => (await D.page.locator('.dk-steps li').count()) === 3 && (await D.page.locator('[data-testid=reg-price]').count()) === 1))
  await D.page.click('.dk-foot button:has-text("← Quay lại")')
  await D.page.fill('.auth-landing input[placeholder="Số điện thoại hoặc email"]', USER)
  await D.page.fill('.auth-landing input[placeholder="Mật khẩu 8 số"]', PASS)
  await D.page.press('.auth-landing input[placeholder="Mật khẩu 8 số"]', 'Enter')
  check('Enter -> đăng nhập được, sang "Ai học hôm nay?"', await until(async () => (await D.page.locator('.dk-pick .pick-grid').count()) === 1))
  // 3. chọn người học
  console.log('— 3. Chọn người học')
  await D.page.waitForSelector('.dk-cards .pick-card')
  const cards = await D.page.$$eval('.dk-cards .pick-card', (els) => els.map((e) => { const r = e.getBoundingClientRect(); return { t: Math.round(r.top), w: Math.round(r.width), txt: e.innerText.replace(/\s+/g, ' ') } }))
  const tb = await rect(D.page, '.dk-tb')
  check('thanh trên cao 72 px; các thẻ con (rộng 236 px) + thẻ "Thêm con" cùng một hàng', Math.round(tb.h) === 72 && cards.length === 3 && new Set(cards.map((c) => c.t)).size === 1 && cards.every((c) => c.w === 236) && /Thêm con/.test(cards[2].txt), JSON.stringify(cards))
  await shot(D.page, 'picker')
  await D.page.click('.pick-card:has-text("An")')
  const pinBox = await rect(D.page, '.pick-pinbox')
  await D.page.fill('.pick-pinbox input', '7'); await D.page.click('.pick-pinbox button.cta')
  await D.page.waitForSelector('.kh-cta', { timeout: 10000 })
  check('bấm thẻ An -> nhập PIN (thẻ ≤ 460 px giữa màn) -> vào học: trang chủ của con bản máy tính (thanh trên bản máy tính, không còn cột điện thoại)', pinBox.w <= 460.5 && Math.abs(pinBox.l + pinBox.w / 2 - 720) <= 2 && (await D.page.locator('.dk-tb .ds-seg').count()) === 1 && (await D.page.locator('.dk-kh').count()) === 1 && (await D.page.locator('.stage').count()) === 0, JSON.stringify({ pinBox }))
  await D.ctx.close()
}
{ // 390 px: màn đầu cũ
  const M = await device('login390', { width: 390, height: 844 })
  await M.page.goto(BASE + '/', { waitUntil: 'networkidle' })
  const btns = await M.page.$$eval('.auth-landing button', (els) => els.map((e) => e.textContent.trim()))
  check('390 px: vẫn màn đầu cũ (2 nút Đăng nhập / Đăng ký, không có bảng thương hiệu)', btns.join('|') === 'Đăng nhập|Đăng ký' && (await M.page.locator('.dk-brand').count()) === 0 && (await M.page.locator('.phone').count()) === 1, btns.join('|'))
  await M.ctx.close()
}

/* ======== 2. Đăng ký ======== */
console.log('— 2. Đăng ký + Thanh toán (màn rộng)')
{
  const D = await device('reg')
  await D.page.goto(BASE + '/', { waitUntil: 'networkidle' })
  await D.page.click('.auth-landing button:has-text("Đăng ký")')
  await D.page.waitForSelector('.dk-reg-inner')
  const r1 = await rect(D.page, 'input[placeholder="VD: Nguyễn Văn A"]'), r2 = await rect(D.page, 'input[placeholder="VD: 0912345678"]')
  check('khối "Thông tin phụ huynh" lưới 2 cột: Họ và tên | Số điện thoại cùng một hàng', Math.abs(r1.t - r2.t) < 1 && r2.l > r1.r, JSON.stringify({ r1, r2 }))
  await D.page.click('.reg-plan .chip:has-text("2 học sinh")')
  const kids = await D.page.$$eval('.reg-kid', (els) => els.map((e) => { const r = e.getBoundingClientRect(); return { t: Math.round(r.top), l: Math.round(r.left) } }))
  const sub = await D.page.locator('.dk-sec-h small').innerText()
  check('gói 2: hai khối con nằm cạnh nhau, góc phải ghi "Gói 2 học sinh → điền 2 khối"', kids.length === 2 && kids[0].t === kids[1].t && kids[1].l > kids[0].l && /Gói 2 học sinh → điền 2 khối/.test(sub), JSON.stringify({ kids, sub }))
  const nSel = await D.page.locator('select').count()
  const gw = await rect(D.page, '.reg-kid .sel-pick')
  check('ô Lớp là danh sách tự vẽ rộng 150 px (không có <select>)', nSel === 0 && Math.round(gw.w) === 150, JSON.stringify({ nSel, w: gw.w }))
  await D.page.fill('input[placeholder="VD: Nguyễn Văn A"]', 'Anh Tuấn')
  await D.page.fill('input[placeholder="VD: 0912345678"]', REG)
  await D.page.fill('input[placeholder="8 chữ số"]', PASS)
  await D.page.fill('input[placeholder="Nhập lại 8 chữ số"]', PASS)
  await D.page.fill('input[placeholder="email@vidu.com"]', `reg${RUN}@vidu.test`)
  await D.page.fill('input[placeholder="VD: TP. Hồ Chí Minh"]', 'Đà Nẵng')
  const warn = await D.page.locator('.dk-foot .auth-hint--warn').count()
  const nextOff = await D.page.locator('.dk-foot button:has-text("Tiếp theo: Thanh toán →")').isDisabled()
  check('còn thiếu mục: nút "Tiếp theo: Thanh toán →" mờ + dòng "Còn mục được tô màu chưa điền."', warn === 1 && nextOff)
  for (const [i, nm, ic, g] of [[0, 'Mai', '🐼', 'Lớp 3'], [1, 'Nam', '🦁', 'Lớp 8']]) {
    const k = D.page.locator('.reg-kid').nth(i)
    await k.locator('input[placeholder="VD: Anna"]').fill(nm)
    await k.locator('input[placeholder="VD: 7 hoặc 12"]').fill(String(i + 5))
    await k.locator(`.icon-opt:has-text("${ic}")`).click()
    await k.locator('.sel-btn').click(); await k.locator('.sel-opt').filter({ hasText: new RegExp('^' + g + '$') }).click()
    await k.locator('input[placeholder="VD: Tiểu học Kim Đồng"]').fill('Trường ' + nm)
    await k.locator('.reg-types .chip:has-text("Công lập")').click()
  }
  await shot(D.page, 'register')
  await D.page.click('.dk-foot button:has-text("Tiếp theo: Thanh toán →")')
  await D.page.waitForSelector('.dk-paybox', { timeout: 10000 })
  const step = await D.page.locator('.dk-steps li.on').innerText()
  const pw2 = await rect(D.page, '.dk-paybox')
  check('sang Thanh toán: bảng trái tô sáng bước 2, thẻ bên phải ≤ 560 px', /Thanh toán/.test(step) && pw2.w <= 560.5, JSON.stringify({ step, w: pw2.w }))
  await shot(D.page, 'pay')
  await D.page.click('.dk-paybox button.cta:has-text("Hoàn tất")')
  const pick = await until(async () => (await D.page.locator('.dk-cards .pick-card').count()) === 2)   // gói 2 đủ 2 con: không còn thẻ "Thêm con"
  const names = await D.page.$$eval('.dk-cards .pick-name', (els) => els.map((e) => e.textContent))
  check('Hoàn tất -> tài khoản tạo trên máy chủ, vào "Ai học hôm nay?" thấy 2 con Mai, Nam', pick && names.join(',') === 'Mai,Nam' && (await acct('login', { id: REG, pass: PASS })).ok, names.join(','))
  await D.ctx.close()
}

/* ======== 4. Phụ huynh ======== */
console.log('— 4. Khu Phụ huynh (màn rộng)')
const day = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10) }
const mk = (i, name, subject, mastery, reviews, details) => ({ id: 'c' + i + RUN, name, subject, topic: name, mastery, reviews, details, learnedOn: day(3), updatedAt: Date.now() - i * 1000 })
const MEM = [mk(1, 'Trạng ngữ', 'Ngữ văn', 58, 3, ['chức năng', 'vị trí']), mk(2, 'Bầy chim chìa vôi', 'Ngữ văn', 70, 2, ['nhân vật']), mk(3, 'Thơ bốn chữ', 'Ngữ văn', 85, 4, ['vần']),
  mk(4, 'Góc ở vị trí đặc biệt', 'Toán', 64, 2, ['góc kề bù']), mk(5, 'Số hữu tỉ', 'Toán', 96, 6, ['so sánh']), mk(6, 'Unit 1 · Hobbies', 'Tiếng Anh', 0, 0, ['collect', 'gardening'])]
const MINS = [22, 25, 0, 18, 21, 24, 9]
const STATS = { goalMin: 20, days: Object.fromEntries(MINS.map((m, i) => [day(6 - i), m * 60]).filter(([, v]) => v)),
  log: { [day(0)]: { 'Ngữ văn': { reviewed: 10, correct: 7, wrong: 3, sec: 300 } }, [day(1)]: { 'Toán': { reviewed: 8, correct: 7, wrong: 1, sec: 1440 } } } }
const LK = 'kL' + RUN
const LACC = { username: '09dk' + RUN, password: '1', phone: '09dk' + RUN, parentPass: '1', parentName: 'Chị Lan', plan: 2, pin: '3',
  children: [{ id: LK, name: 'An', pin: '', icon: '🦊', grade: 'Lớp 7' }, { id: LK + 'b', name: 'Bình', pin: '', icon: '🐼', grade: 'Lớp 4' }] }
const seed = { fn: ({ LACC, MEM, STATS, LK }) => {
  if (sessionStorage.getItem('s')) return; sessionStorage.setItem('s', '1'); localStorage.clear()
  localStorage.setItem('ontap.account.v1', JSON.stringify(LACC)); localStorage.setItem('ontap.session.v1', '1')
  localStorage.setItem('ontap.memory.v2::' + LK, JSON.stringify(MEM)); localStorage.setItem('ontap.stats.v2::' + LK, JSON.stringify(STATS))
}, arg: { LACC, MEM, STATS, LK } }
const gate = async (p) => { await p.waitForSelector('.modal input.pin-in', { timeout: 5000 }); await p.fill('.modal input.pin-in', '3'); await p.click('.modal .modal-btns .cta:not(.ghost)') }
{
  const D = await device('parent', { init: seed })
  await D.page.goto(BASE + '/', { waitUntil: 'networkidle' })
  await D.page.click('.pick-card:has-text("An")')
  await D.page.waitForSelector('.kh-cta', { timeout: 10000 })
  const kid = await D.page.evaluate(() => ({ now: Number(document.querySelector('.kh-bar').getAttribute('aria-valuenow')), goal: document.querySelector('.kh-goal em').textContent,
    streak: document.querySelector('.kh-rw-row b').textContent, wait: document.querySelector('.kh-sub').textContent }))
  await D.page.click('.ds-seg button:has-text("Phụ huynh")')
  await D.page.waitForSelector('.modal input.pin-in')
  const ov = await D.page.evaluate(() => { const m = document.querySelector('.modal-back'); const r = m.getBoundingClientRect(); return { pos: getComputedStyle(m).position, r: [r.left, r.top, r.width, r.height], inStage: !!m.closest('.stage') } })
  check('hộp mã PIN phụ huynh phủ CẢ CỬA SỔ (position: fixed, không nằm trong cột phóng to)', ov.pos === 'fixed' && ov.r.join(',') === '0,0,1440,900' && !ov.inStage, JSON.stringify(ov))
  await gate(D.page)
  await D.page.waitForSelector('.dk-dash', { timeout: 10000 })
  const bar = await D.page.evaluate(() => {
    const els = [document.querySelector('.dk-tb .ds-seg'), ...document.querySelectorAll('.dk-tb .ds-logout')]
    const rs = els.map((e) => e.getBoundingClientRect())
    return { n: els.length, labels: els.map((e) => e.innerText.replace(/\s+/g, ' ').trim()), h: rs.map((r) => Math.round(r.height)), tops: rs.map((r) => Math.round(r.top)), logo: !!document.querySelector('.dk-tb img.dk-tb-logo'), phone: !!document.querySelector('.phone') }
  })
  check('thanh trên bản máy tính: logo + "Con | Phụ huynh" + "Đổi người học" + "Đăng xuất" cùng MỘT hàng, ba ô cao 44 px', bar.logo && !bar.phone && bar.n === 3 && bar.labels.join('|') === 'Con Phụ huynh|Đổi người học|Đăng xuất' && bar.h.every((h) => h === 44) && new Set(bar.tops).size === 1, JSON.stringify(bar))
  const kp = await D.page.evaluate(() => Object.fromEntries([...document.querySelectorAll('.dk-kpi')].map((e) => [e.dataset.k, e.querySelector('.v').textContent.replace(/\s+/g, ' ').trim() + ' | ' + e.querySelector('.s').textContent])))
  const kStreak = (/Chuỗi (\d+) ngày/.exec(kid.streak) || [])[1], kWait = (/Có (\d+) chủ đề/.exec(kid.wait) || [])[1]
  check(`ô "Hôm nay" = phút hôm nay / mục tiêu như trang con (${kid.now} / 20 phút)`, kp.today.startsWith(`${kid.now} / 20 phút`) && kid.now === 9 && /Còn 11 phút nữa là đạt mục tiêu/.test(kp.today), kp.today)
  check(`ô "Đạt mục tiêu liên tiếp" = số ở trang con (🔥 ${kStreak} ngày)`, kp.streak.startsWith(`🔥 ${kStreak} ngày`) && kStreak === '2' && /Còn 5 ngày nữa tới quà/.test(kp.streak), kp.streak + ' / ' + kid.streak)
  check(`ô "Chủ đề cần ôn" = dòng "Có ${kWait} chủ đề đang chờ con ôn" của trang con, đếm theo môn`, kp.need.startsWith(`${kWait} / 6 chủ đề`) && kWait === '4' && /Ngữ văn 2 · Toán 1 · Tiếng Anh 1/.test(kp.need), kp.need)
  check('ô "Tổng thời gian học" + "7 ngày qua"', /^1 giờ 59 phút/.test(kp.total) && /7 ngày qua: 1 giờ 59 phút/.test(kp.total), kp.total)
  const bars = await D.page.locator('.dk-bar').count()
  const t0 = await D.page.locator('.dk-note-h h3').innerText()
  await D.page.locator('.dk-bar').nth(1).click()
  const t1 = await D.page.locator('.dk-note-h h3').innerText()
  const d1 = new Date(day(5) + 'T00:00:00')
  check('biểu đồ 7 cột; bấm một cột -> tiêu đề khung nhận xét đổi sang ngày đó', bars === 7 && /hôm nay/.test(t0) && t1.includes(`${d1.getDate()}/${d1.getMonth() + 1}`) && t1 !== t0, `${bars} | ${t0} -> ${t1}`)
  await D.page.locator('.dk-bar').nth(6).click()
  const grps = await D.page.$$eval('.dk-grp', (els) => els.map((e) => e.dataset.subject))
  check('bản đồ kiến thức: mỗi môn một thẻ (3 môn), có chip chọn môn', grps.length === 3 && (await D.page.locator('.dk-kmap .chip').count()) === 4, grps.join(','))
  await D.page.click('.dk-kmap .chip:has-text("Toán")')
  const g2 = await D.page.locator('.dk-grp').count()
  const note2 = await D.page.locator('.dk-note').innerText()
  check('chọn chip "Toán": bản đồ còn 1 môn, khung nhận xét lọc theo cùng môn', g2 === 1 && !/Ngữ văn/.test(note2), note2.slice(0, 120))
  await D.page.click('.dk-kmap .chip:has-text("Tất cả")')
  await shot(D.page, 'parent')
  // Cài đặt + Góp ý
  await D.page.click('.dk-acts button:has-text("Mục tiêu")')
  await D.page.waitForSelector('.dk-narrow .backhead')
  const nw = await rect(D.page, '.dk-narrow')
  check('"⚙️ Mục tiêu & bật/tắt trắc nghiệm" -> Cài đặt trong thẻ trắng giữa (≤ 760 px), thanh trên vẫn bản máy tính', nw.w <= 760.5 && Math.abs(nw.l + nw.w / 2 - 720) <= 2 && /Cài đặt/.test(await D.page.locator('.dk-narrow').innerText()) && (await D.page.locator('.dk-tb .ds-seg').count()) === 1, JSON.stringify(nw))
  await shot(D.page, 'settings')
  await D.page.click('.dk-narrow .backhead .back')
  await D.page.waitForSelector('.dk-dash')
  await D.page.click('.dk-acts .pd-fb')
  await D.page.waitForSelector('.dk-narrow [data-testid=feedback]')
  check('"💬 Góp ý / báo lỗi" -> trang Góp ý trong thẻ giữa', (await D.page.locator('.dk-narrow [data-testid=feedback]').count()) === 1)
  await D.page.click('.dk-narrow .backhead .back')
  check('quay lại -> trang báo cáo', await until(async () => (await D.page.locator('.dk-dash').count()) === 1))
  // "Con" -> về cột phóng to
  await D.page.click('.dk-tb .ds-seg button:has-text("Con")')
  await D.page.waitForSelector('.kh-cta', { timeout: 10000 })
  check('bấm "Con" -> về trang chủ của con (bản máy tính, ô "Con" sáng)', (await D.page.locator('.dk-kh').count()) === 1 && /Con/.test(await D.page.locator('.dk-tb .ds-seg button.on').innerText()))
  await D.ctx.close()
}

/* ======== 5. Quản trị ======== */
console.log('— 5. Trang quản trị /quan-tri (màn rộng)')
async function adminIn(d, phone, pass) {
  await d.page.goto(BASE + '/quan-tri', { waitUntil: 'networkidle' })
  await d.page.fill('.adm-login input[placeholder="Số điện thoại hoặc email"]', phone)
  await d.page.fill('.adm-login input[type=password]', pass)
  await d.page.click('.adm-login button.cta')
  await d.page.waitForSelector('.adm-tabs', { timeout: 10000 })
}
const tab = async (d, label) => { await d.page.click(`.adm-tab:has-text("${label}")`); await sleep(500) }
{
  const D = await device('admin')
  await D.page.goto(BASE + '/quan-tri', { waitUntil: 'networkidle' })
  const lg = await D.page.evaluate(() => ({ brand: document.querySelector('.dk-brand h1')?.textContent, w: document.querySelector('.adm-login').getBoundingClientRect().width }))
  check('đăng nhập quản trị: chia đôi, bên trái "Quản trị hệ thống Ôn Tập", thẻ đăng nhập 460 px', lg.brand === 'Quản trị hệ thống Ôn Tập' && Math.round(lg.w) === 460, JSON.stringify(lg))
  await shot(D.page, 'admin_login')
  await adminIn(D, SUPER, PASS)
  await D.page.waitForSelector('[data-testid=adm-todo]')
  await D.page.waitForSelector('.dk-aside .adm-me')
  const side = await D.page.evaluate(() => { const a = document.querySelector('.dk-aside'); const r = a.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height), pos: getComputedStyle(a).position,
    tabs: [...a.querySelectorAll('.adm-tab')].map((t) => t.textContent), me: a.querySelector('.adm-me').innerText, sup: !!a.querySelector('.dk-nav .dk-aside-t') } })
  check('cột trái 268 px cao bằng màn hình (dính khi cuộn): logo, 8 mục, nhóm "Chỉ super admin", đáy ghi tên + "Super admin" + Đăng xuất',
    side.w === 268 && side.h === 900 && side.pos === 'sticky' && side.tabs.join('|') === '📊 Tổng quan|📚 Thư viện sách|👪 Người dùng|💬 Góp ý|💰 Định giá|✅ Duyệt & nhật ký|👥 Quản trị viên|⚙️ Cài đặt' && side.sup && /Super admin/.test(side.me) && /Đăng xuất/.test(side.me), JSON.stringify(side))
  const bd = await adm('badges')
  const badge = async () => D.page.evaluate(() => Object.fromEntries([...document.querySelectorAll('.adm-tab[data-badge]')].map((t) => [t.textContent, t.dataset.badge + '|' + getComputedStyle(t, '::after').content])))
  const b1 = await until(async () => { const b = await badge(); return b['💬 Góp ý'] && b['✅ Duyệt & nhật ký'] ? b : null })
  check(`huy hiệu: "💬 Góp ý" = ${bd.fb} phiếu chờ trả lời, "✅ Duyệt & nhật ký" = ${bd.chg} thay đổi chờ duyệt (vẽ bằng ::after, chữ nút giữ nguyên)`, bd.ok && bd.fb >= 2 && bd.chg >= 2 && b1 && b1['💬 Góp ý'] === `${bd.fb}|"${bd.fb}"` && b1['✅ Duyệt & nhật ký'] === `${bd.chg}|"${bd.chg}"`, JSON.stringify({ bd, b1 }))
  const todo = await D.page.locator('[data-testid=adm-todo]').innerText()
  check('Tổng quan: "Việc cần xử lý" có phiếu chờ trả lời (💬 Báo lỗi · Phụ huynh) + thay đổi chờ duyệt (⏳ Chờ duyệt · Đổi bảng giá), số đếm ở góc phải',
    todo.includes(`Báo cáo trên điện thoại không hiện thời gian học ${RUN}`) && !todo.includes('Dòng thứ hai') && /Chờ duyệt · Đổi bảng giá/.test(todo) && todo.includes(`${bd.fb} góp ý đang chờ trả lời · ${bd.chg} thay đổi chờ duyệt`), todo.slice(0, 400))
  const ovt = low(await D.page.locator('[data-testid=adm-overview]').innerText())
  check('Tổng quan: 4 ô số liệu (Tài khoản phụ huynh, Học sinh, Đăng ký mới, Dùng app 7 ngày), Theo gói, sách, doanh thu "chưa ghép cổng thanh toán"',
    ['tài khoản phụ huynh', 'học sinh', 'đăng ký mới', '7 ngày qua', 'dùng app 7 ngày', 'theo gói', 'sách trong thư viện', 'chưa ghép cổng thanh toán'].every((w) => ovt.includes(w)), ovt.slice(0, 300))
  await shot(D.page, 'admin_overview')
  // "Trả lời" -> mở đúng phiếu
  await D.page.click(`[data-testid=adm-todo] li[data-fb="${fb1.thread.id}"] button:has-text("Trả lời")`)
  await D.page.waitForSelector('[data-testid=adm-thread]')
  const sel = await D.page.locator('.adm-fbi.on').getAttribute('data-fb')
  const th = await D.page.locator('[data-testid=adm-thread]').innerText()
  check('bấm "Trả lời" -> mục Góp ý, đúng phiếu đó đang mở ở khung phải (người gửi, số điện thoại, email, màn hình)', sel === fb1.thread.id && th.includes('Báo cáo trên điện thoại không hiện thời gian học ' + RUN) && th.includes('Phụ huynh · Chị Lan') && th.includes(USER) && th.includes(EMAIL) && /màn trang phụ huynh/.test(th), sel + ' | ' + th.slice(0, 200))
  const chips = await D.page.$$eval('.dk-fbchips .chip', (els) => els.map((e) => e.textContent))
  const lst = await adm('fb_list', { status: 'open' })
  check('chip lọc có số đếm (counts của máy chủ)', chips[0] === 'Đang mở' + lst.counts.open && chips[1] === 'Chờ trả lời' + lst.counts.new && chips[4] === 'Tất cả' + lst.counts.all, chips.join(' | '))
  await shot(D.page, 'admin_fb')
  await D.page.fill('textarea[aria-label="Trả lời"]', 'Ôn Tập đã sửa, anh/chị mở lại app nhé.')
  await D.page.click('[data-testid=adm-thread] button:has-text("Gửi trả lời")')
  await until(async () => /Ôn Tập đã sửa/.test(await D.page.locator('[data-testid=adm-thread]').innerText()))
  const b2 = await until(async () => { const b = await badge(); return Number((b['💬 Góp ý'] || '0').split('|')[0]) === bd.fb - 1 ? b : null })
  check('trả lời được -> phiếu hết 🔴, huy hiệu "Góp ý" giảm 1', !!b2 && !/🔴/.test(await D.page.locator(`.adm-fbi[data-fb="${fb1.thread.id}"]`).innerText()), JSON.stringify(b2))
  await D.page.click('.dk-kb summary')
  check('"📘 Hiểu biết hệ thống" mở khung ngang trang dưới tiêu đề', await until(async () => /Quên mật khẩu/.test(await D.page.locator('.adm-kb-t').innerText().catch(() => ''))))
  await D.page.click('.dk-kb summary')
  // Thư viện
  await tab(D, 'Thư viện sách')
  await D.page.waitForSelector('.dk-libtable')
  const rows = async () => D.page.$$eval('.dk-libtable .lib-book', (els) => els.map((e) => e.querySelector('.lib-title').textContent))
  const all = await rows()
  const sum = await D.page.locator('.dk-sum').innerText()
  check('Thư viện: 4 ô số liệu + bảng (Loại · Tên sách · Lớp · Môn · Số trang · Tình trạng)', all.some((t) => t.includes('Ngữ văn 7 tập 1 ' + RUN)) && all.some((t) => t.includes('Bài tập Toán 5 ' + RUN)) && /sách trong thư viện/.test(sum) && /đang đọc chữ/.test(sum)
    && low(await D.page.locator('.dk-libtable thead').innerText()).replace(/\s+/g, ' ').includes('loại tên sách lớp môn số trang tình trạng'), all.join(' | '))
  await D.page.fill('.dk-tools input[aria-label="Tìm theo tên sách"]', 'ngu van 7 TAP 1 ' + RUN)
  const s1 = await rows()
  check('tìm theo tên không phân biệt dấu ("ngu van 7 TAP 1") -> chỉ còn sách đó', s1.length === 1 && s1[0].includes('Ngữ văn 7 tập 1'), s1.join(' | '))
  await D.page.fill('.dk-tools input[aria-label="Tìm theo tên sách"]', RUN)
  await D.page.click('.dk-tools button[aria-label="Lọc theo lớp"]'); await D.page.click('.dk-tools .sel-opt:text-is("Lớp 5")')
  const s2 = await rows()
  await D.page.click('.dk-tools button[aria-label="Lọc theo lớp"]'); await D.page.click('.dk-tools .sel-opt:text-is("Tất cả lớp")')
  await D.page.click('.dk-tools button[aria-label="Lọc theo môn"]'); await D.page.click('.dk-tools .sel-opt:text-is("Ngữ văn")')
  const s3 = await rows()
  check('lọc Lớp 5 -> chỉ sách Toán 5; lọc Môn Ngữ văn -> chỉ sách Ngữ văn', s2.length === 1 && s2[0].includes('Toán 5') && s3.length === 1 && s3[0].includes('Ngữ văn 7'), [s2, s3].join(' / '))
  await D.page.click('.dk-tools button[aria-label="Lọc theo môn"]'); await D.page.click('.dk-tools .sel-opt:text-is("Tất cả môn")')
  await D.page.locator('.lib-add input[type=file]').setInputFiles({ name: '07-sgk-ngu-van-7-tap-hai.pdf', mimeType: 'application/pdf', buffer: await onePagePdf() })
  await D.page.waitForSelector('.dk-modal-back .lib-form [data-testid=lib-cost]', { timeout: 15000 })
  const fm = await D.page.evaluate(() => { const b = document.querySelector('.dk-modal-back'), f = b.querySelector('.lib-form').getBoundingClientRect(); return { pos: getComputedStyle(b).position, cx: Math.round(f.left + f.width / 2), cy: Math.round(f.top + f.height / 2), w: Math.round(f.width), txt: b.innerText } })
  check('chọn PDF -> form nạp sách là hộp nổi giữa màn (nền mờ), gợi ý từ tên file + số trang + chi phí', fm.pos === 'fixed' && Math.abs(fm.cx - 720) <= 2 && Math.abs(fm.cy - 450) <= 2 && /1 trang/.test(fm.txt) && /Ngữ văn 7 tập 2/.test(await D.page.inputValue('.lib-form input[aria-label="Tên sách"]')), JSON.stringify(fm).slice(0, 300))
  await shot(D.page, 'admin_library_form')
  await D.page.click('.lib-form button:has-text("Huỷ")')
  check('…bấm Huỷ -> hộp đóng', (await D.page.locator('.dk-modal-back').count()) === 0)
  const pend = D.page.locator('.lib-book', { hasText: 'Bài tập Toán 5 ' + RUN })
  check('super admin thấy "👁️ Xem & duyệt" ở sách của admin (chờ duyệt) -> mở mục Duyệt & nhật ký', (await pend.locator('button:has-text("Xem & duyệt")').count()) === 1)
  await shot(D.page, 'admin_library')
  await pend.locator('button:has-text("Xem & duyệt")').click()
  check('…bấm vào -> mục "Duyệt & nhật ký"', await until(async () => (await D.page.locator('[data-testid=adm-chg]').count()) === 1))
  // Người dùng
  await tab(D, 'Người dùng')
  await D.page.waitForSelector('.dk-table')
  await D.page.fill('[data-testid=adm-users] input', USER)
  await D.page.click('[data-testid=adm-users] button.cta')
  const one = await until(async () => { const t = await D.page.locator('[data-testid=adm-users]').innerText(); return /1 tài khoản khớp/.test(t) && t.includes('Chị Lan') ? t : null })
  await D.page.click('.adm-user')
  const kids = await D.page.locator('.adm-kids').innerText().catch(() => '')
  const hd = low(await D.page.locator('.dk-table thead').innerText()).replace(/\s+/g, ' ')
  check('Người dùng: bảng (Phụ huynh · Số điện thoại · Email · Tỉnh/TP · Gói · Đăng ký · Dùng gần nhất), tìm -> 1 tài khoản, bấm hàng -> danh sách con ngay dưới', !!one && hd.includes('phụ huynh số điện thoại email tỉnh/tp gói đăng ký dùng gần nhất') && /An · Lớp 7 · THCS Lê Lợi/.test(kids) && /Bình · Lớp 4/.test(kids), hd + ' | ' + kids)
  await shot(D.page, 'admin_users')
  for (const t of ['Định giá', 'Duyệt & nhật ký', 'Quản trị viên', 'Cài đặt']) { await tab(D, t); await sleep(300); await shot(D.page, 'admin_' + t.split(' ')[0].normalize('NFD').replace(/[̀-ͯ]/g, '').replace('đ', 'd').toLowerCase()) }
  await D.ctx.close()
  // admin: 6 mục
  const A = await device('staff')
  await adminIn(A, STAFF, 'NhanVien#1')
  await A.page.waitForSelector('.dk-aside')
  const t6 = await A.page.$$eval('.adm-tab', (els) => els.map((e) => e.textContent))
  check('admin (không phải super): 6 mục, không có nhóm "Chỉ super admin", đáy ghi "Admin"', t6.length === 6 && !t6.some((t) => /Quản trị viên|Cài đặt/.test(t)) && (await A.page.locator('.dk-nav .dk-aside-t').count()) === 0 && (await A.page.locator('.adm-me em').innerText()) === 'Admin', t6.join('|'))
  await A.ctx.close()
  // 390 px: menu ngang cũ
  const M = await device('admin390', { width: 390, height: 844 })
  await adminIn(M, SUPER, PASS)
  const m = await M.page.evaluate(() => ({ aside: !!document.querySelector('.dk-aside'), top: !!document.querySelector('.adm-top'), wrap: getComputedStyle(document.querySelector('.adm-tabs')).flexWrap, badge: document.querySelectorAll('.adm-tab[data-badge]').length }))
  check('390 px: giữ trang quản trị cũ (thanh trên + menu ngang)', !m.aside && m.top && m.wrap === 'wrap' && m.badge === 0, JSON.stringify(m))
  await M.ctx.close()
}

/* ======== 6. Mọi cỡ màn ======== */
console.log('— 6. Mọi cỡ màn: không cuộn ngang')
for (const [w, h] of [[1024, 768], [1280, 800], [1366, 768], [1440, 900], [1920, 1080], [390, 844]]) {
  const bad = []
  const D = await device('w' + w, { width: w, height: h, init: seed })
  const p = D.page
  const ok = async (n) => { await sleep(250); if (!(await noHScroll(p))) bad.push(n) }
  await p.goto(BASE + '/', { waitUntil: 'networkidle' }); await ok('chọn người học')
  await p.click('button.pick-parent'); await gate(p)
  await p.waitForSelector(w >= 1024 ? '.dk-dash' : '.parenthead'); await ok('phụ huynh')
  await p.click('.ds-logout:has-text("Đăng xuất")'); await p.waitForSelector('.auth-card'); await ok('đăng nhập')
  if (w >= 1024) { await p.click('.auth-landing button:has-text("Đăng ký")') } else { await p.click('.auth-landing button:has-text("Đăng ký")') }
  await p.click('.reg-plan .chip:has-text("2 học sinh")'); await ok('đăng ký')
  const A = await device('a' + w, { width: w, height: h })
  await adminIn(A, SUPER, PASS); await sleep(600)
  for (const t of ['Tổng quan', 'Góp ý', 'Thư viện sách', 'Người dùng', 'Định giá', 'Duyệt & nhật ký', 'Quản trị viên', 'Cài đặt']) {
    await A.page.click(`.adm-tab:has-text("${t}")`); await sleep(700)
    if (!(await noHScroll(A.page))) bad.push('quản trị/' + t)
  }
  if (w === 1024) {
    const g = await A.page.evaluate(() => ({ side: Math.round(document.querySelector('.dk-aside').getBoundingClientRect().width) }))
    if (g.side !== 232) bad.push('cột trái 1024px = ' + g.side)
  }
  check(`${w}×${h}: không cuộn ngang (đăng nhập, đăng ký, chọn người học, phụ huynh, 8 mục quản trị)`, bad.length === 0, bad.join(', '))
  await A.ctx.close(); await D.ctx.close()
}

/* ======== 7. Màn lớn (anh báo 19/11/2026, ảnh Surface: "nhỏ tí, đọc không ra chữ, khoảng trống mênh mông") ======== */
console.log('— 7. Màn lớn (2K / 4K, trình duyệt thu nhỏ): bản máy tính tự phóng to theo chuẩn 1440 × 900')
for (const [w, h] of [[2880, 1800], [3840, 2160], [2560, 1440]]) {
  const z = Math.max(1, Math.min(3, Math.floor(Math.min(w / 1440, h / 900) * 20) / 20))
  const bad = []
  const A = await device('big' + w, { width: w, height: h })
  await adminIn(A, SUPER, PASS); await A.page.waitForSelector('[data-testid=adm-todo]'); await A.page.waitForSelector('.dk-aside .adm-me')
  const g = await A.page.evaluate(() => { const a = document.querySelector('.dk-aside').getBoundingClientRect(), t = document.querySelector('.dk-ph h1').getBoundingClientRect(), k = document.querySelector('.dk-kpis').getBoundingClientRect()
    return { aw: a.width, ah: a.height, th: t.height, kr: k.right, vw: innerWidth } })
  // cỡ chữ thật trên màn = cỡ mẫu × z: tiêu đề 28 px -> cao ≥ 28 × z; cột trái 268 × z; nội dung kín bề ngang (không trống một nửa màn)
  if (Math.abs(g.aw - 268 * z) > 2 || Math.abs(g.ah - h) > 2 || g.th < 28 * z || g.kr < w - 40 * z - 2) bad.push('quản trị ' + JSON.stringify(g))
  if (!(await noHScroll(A.page))) bad.push('quản trị cuộn ngang')
  await A.page.click('.adm-tab:has-text("Góp ý")'); await A.page.waitForSelector('.dk-fblist'); if (!(await noHScroll(A.page))) bad.push('góp ý cuộn ngang')
  if (w === 3840) await A.page.screenshot({ path: `${OUT}/desk_big_admin_fb.png` })
  await A.ctx.close()
  const D = await device('bigp' + w, { width: w, height: h, init: seed })
  await D.page.goto(BASE + '/', { waitUntil: 'networkidle' })
  const pk = await D.page.evaluate(() => { const c = document.querySelector('.dk-cards .pick-card').getBoundingClientRect(); return { cw: c.width } })
  if (Math.abs(pk.cw - 236 * z) > 2) bad.push('thẻ con ' + JSON.stringify(pk))
  await D.page.click('button.pick-parent'); await gate(D.page); await D.page.waitForSelector('.dk-dash')
  const pd = await D.page.evaluate(() => { const t = document.querySelector('.dk-tb').getBoundingClientRect(), w = document.querySelector('.dk-wrap').getBoundingClientRect(); return { tb: t.height, ww: w.width } })
  if (Math.abs(pd.tb - 72 * z) > 2 || Math.abs(pd.ww - Math.min(1280 * z, w)) > 2) bad.push('phụ huynh ' + JSON.stringify(pd))
  if (!(await noHScroll(D.page))) bad.push('phụ huynh cuộn ngang')
  if (w === 3840) await D.page.screenshot({ path: `${OUT}/desk_big_parent.png` })
  await D.page.click('.dk-tb .ds-seg button:has-text("Con")')   // vào Phụ huynh từ màn chọn người học -> "Con" về màn chọn (như cũ)
  await D.page.click('.pick-card:has-text("An")'); await D.page.waitForSelector('.kh-cta')
  const kf = await D.page.evaluate(() => ({ zoom: Number(getComputedStyle(document.querySelector('.dk')).zoom), cta: document.querySelector('.kh-cta').getBoundingClientRect().height }))
  const kz = z   // màn của con (đợt 2): cùng khung bản máy tính, phóng to theo --dk-z
  if (kf.zoom !== z || kf.cta < 50 * z) bad.push('màn con ' + JSON.stringify(kf))
  await D.ctx.close()
  check(`${w}×${h}: phóng to ${z} lần (quản trị, chọn người học, phụ huynh to đúng tỉ lệ mẫu, kín màn, không cuộn ngang); màn con cũng phóng to ${kz} lần`, bad.length === 0, bad.join(' | '))
}

/* ======== 8. Màn của con (bản máy tính đợt 2, 21/11/2026) ======== */
console.log('— 8. Màn của con trên máy tính')
const AIQ = (r) => r.fulfill({ contentType: 'application/json', body: JSON.stringify({ questions: Array.from({ length: 13 }, (_, i) => ({ q: `Câu ${i + 1}: ${i + 2} + ${i + 3} = ?`, options: [String(2 * i + 5), String(2 * i + 6), String(2 * i + 7), String(2 * i + 8)], answer: 0, explain: 'Cộng hai số.', concept: 'Góc ở vị trí đặc biệt' })) }) })
for (const [w, h] of [[1440, 900], [1024, 768], [1920, 1080], [2880, 1800], [390, 844]]) {
  const bad = []
  const D = await device('kid' + w, { width: w, height: h, init: seed })
  const p = D.page
  await p.route('**/api/ai', AIQ)
  const hs = async (n) => { await sleep(250); if (!(await noHScroll(p))) bad.push(n + ' cuộn ngang') }
  await p.goto(BASE + '/', { waitUntil: 'networkidle' })
  await p.click('.pick-card:has-text("An")'); await p.waitForSelector('.kh-cta')
  if (w < 1024) {
    const m = await p.evaluate(() => ({ dk: !!document.querySelector('.dk'), phone: !!document.querySelector('.stage .phone'), bar: !!document.querySelector('.demoswitch .ds-seg') }))
    check('390 px: màn của con giữ nguyên (cột điện thoại, thanh trên cũ)', !m.dk && m.phone && m.bar, JSON.stringify(m))
    await D.ctx.close(); continue
  }
  const z = Math.max(1, Math.min(3, Math.floor(Math.min(w / 1440, h / 900) * 20) / 20))
  // trang chủ
  const home = await p.evaluate(() => {
    const R = (s) => { const e = document.querySelector(s); const r = e.getBoundingClientRect(); return { l: Math.round(r.left), t: Math.round(r.top), r: Math.round(r.right), h: Math.round(r.height) } }
    const tiles = [...document.querySelectorAll('.dk-kh .sj-grid .sj-tile')].map((e) => Math.round(e.getBoundingClientRect().top))
    return { today: R('.kh-today'), reward: R('.kh-reward'), cta: R('.kh-cta'), tiles, goal: document.querySelector('.kh-goal em').textContent, wait: document.querySelector('.kh-sub').textContent, bar: !!document.querySelector('.dk-tb .ds-seg') }
  })
  if (!(home.bar && home.reward.l > home.today.r && Math.abs(home.reward.t - home.today.t) < 90 * z && home.tiles.length === 3 && new Set(home.tiles).size === 1 && home.cta.h >= 60 * z && home.goal === '9 / 20 phút' && /Có 4 chủ đề/.test(home.wait))) bad.push('trang chủ ' + JSON.stringify(home))
  await hs('trang chủ'); if (w === 1440) await shot(p, 'kid_home')
  // Bắt đầu ôn: hai cột
  await p.click('.kh-cta'); await p.waitForSelector('.dk-cr')
  const cr = await p.evaluate(() => { const a = document.querySelector('.dk-cr-left .cr-hero').getBoundingClientRect(), b = document.querySelector('.dk-cr-right .cr-self').getBoundingClientRect()
    return { heroR: a.right, selfL: b.left, top: Math.abs(a.top - b.top), sj: new Set([...document.querySelectorAll('.cr-self .sj-tile')].map((e) => Math.round(e.getBoundingClientRect().top))).size, start: !!document.querySelector('.dk-cr-right .cr-sticky-cta') } })
  if (!(cr.selfL > cr.heroR && cr.sj === 1 && cr.start)) bad.push('Bắt đầu ôn ' + JSON.stringify(cr))
  await hs('Bắt đầu ôn'); if (w === 1440) await shot(p, 'kid_custom')
  // làm bài (anh báo 21/11/2026: trong bài vẫn là bản mobile): thẻ chơi rộng giữa màn, câu hỏi to, 4 đáp án xếp 2 × 2
  await p.click('.cr-self .sj-tile:has-text("Toán")'); await p.click('.cr-sticky-cta')
  await p.waitForSelector('.dk-game .opt', { timeout: 20000 })
  const pl = await p.evaluate(() => {
    const r = document.querySelector('.dk-game').getBoundingClientRect(), d = document.scrollingElement
    const o = [...document.querySelectorAll('.dk-game .opt')].map((e) => { const b = e.getBoundingClientRect(); return [Math.round(b.left), Math.round(b.top), Math.round(b.width)] })
    return { l: r.left, r: d.clientWidth - r.right, w: r.width, phone: !!document.querySelector('.phone'), opts: o, qfs: parseFloat(getComputedStyle(document.querySelector('.dk-game .question')).fontSize), seg: !!document.querySelector('.dk-tb .ds-seg') } })
  const cols = new Set(pl.opts.map((o) => o[0])).size, rows = new Set(pl.opts.map((o) => o[1])).size
  if (!(Math.abs(pl.l - pl.r) <= 2 && pl.w >= Math.min(1000 * z, w - 60) && !pl.phone && cols === 2 && rows === 2 && pl.seg)) bad.push('làm bài ' + JSON.stringify(pl))
  await p.locator('.dk-game .opt').first().click(); await sleep(300)
  await hs('làm bài'); if (w === 1440) await shot(p, 'kid_review')
  await p.click('.dk-game .back'); await p.waitForSelector('.dk-kh')
  // báo cáo con tự xem
  await p.click('.kh-tile.tone-purple'); await p.waitForSelector('.dk-dash')
  const rp = await p.evaluate(() => ({ h1: document.querySelector('.dk-hello h1').textContent, kids: document.querySelectorAll('.dk-kidnav').length, acts: document.querySelectorAll('.dk-acts button').length, today: document.querySelector('.dk-kpi[data-k=today] .v').textContent }))
  if (!(rp.h1 === 'Kết quả học của An' && rp.kids === 0 && rp.acts === 0 && /^9 \/ 20 phút/.test(rp.today))) bad.push('báo cáo ' + JSON.stringify(rp))
  await hs('báo cáo'); if (w === 1440) await shot(p, 'kid_report')
  await p.click('.dk-toprow .back'); await p.waitForSelector('.dk-kh')
  // Thêm bài học + Góp ý: thẻ giữa
  await p.click('.kh-tile.tone-blue'); await p.waitForSelector('.dk-narrow .backhead')
  if (!/Thêm bài học/.test(await p.locator('.dk-narrow').innerText())) bad.push('thêm bài học')
  await hs('thêm bài học'); await p.click('.dk-narrow .back'); await p.waitForSelector('.dk-kh')
  await p.click('.kh-fb'); await p.waitForSelector('.dk-narrow [data-testid=feedback]'); await hs('góp ý')
  await p.click('.dk-narrow .back'); await p.waitForSelector('.dk-kh')
  // Vở Spelling: khung cao vừa màn
  await p.click('.kh-cta'); await p.locator('.cr-self .sj-tile:has-text("Tiếng Anh")').click(); await p.click('.cr-vocab')
  await p.waitForSelector('iframe.spelling-frame'); await sleep(1200)
  const sp = await p.evaluate(() => { const r = document.querySelector('iframe.spelling-frame').getBoundingClientRect(); return { b: r.bottom, w: r.width, vh: innerHeight, sh: document.scrollingElement.scrollHeight } })
  if (!(Math.abs(sp.b - (sp.vh - 15 * z)) <= 4 && sp.sh <= sp.vh + 2 && sp.w >= Math.min(1100 * z, w - 60))) bad.push('Vở Spelling ' + JSON.stringify(sp))   // khung rộng: app tự chia cột
  await hs('Vở Spelling'); if (w === 1440) await shot(p, 'kid_spelling')
  check(`${w}×${h}: màn của con bản máy tính (phóng to ${z} lần) — trang chủ lưới rộng, Bắt đầu ôn hai cột, làm bài thẻ rộng (đáp án 2 × 2), báo cáo, Thêm bài học, Góp ý, Vở Spelling rộng + vừa màn; không cuộn ngang`, bad.length === 0, bad.join(' | '))
  await D.ctx.close()
}

// 6 trò chơi + tự điền: thẻ chơi rộng; sân chơi (thả rơi, bắn bóng, Mario) nằm trọn trong cửa sổ cùng câu hỏi
for (const [w, h] of [[1440, 900], [1280, 800], [1920, 1080]]) {
  const bad = []
  const D = await device('game' + w, { width: w, height: h, init: seed })
  const p = D.page
  await p.route('**/api/ai', AIQ)
  await p.goto(BASE + '/', { waitUntil: 'networkidle' }); await p.click('.pick-card:has-text("An")'); await p.waitForSelector('.kh-cta')
  for (const [g, sel] of [['Thả rơi', '.fall-area'], ['Bắn bóng', '.bl-arena'], ['Xếp sushi', '.sushi-arena'], ['Boss Battle', '.boss-stage'], ['Quick Fire', '.dk-game .opts'], ['Mario nhảy', '.mario-arena'], ['Điền đáp án', '.dk-game input']]) {
    await p.click('.dk-tb .ds-seg button:has-text("Con")').catch(() => {})
    if (!(await p.locator('.kh-cta').count())) { await p.goto(BASE + '/', { waitUntil: 'networkidle' }); if (await p.locator('.pick-card').count()) await p.click('.pick-card:has-text("An")') }
    await p.waitForSelector('.kh-cta'); await p.click('.kh-cta'); await p.click('.cr-self .sj-tile:has-text("Toán")')
    await p.click('.cr-adv-toggle'); await p.click(`.cr-adv-body .chip:has-text("${g}")`); await p.click('.cr-sticky-cta')
    try { await p.waitForSelector('.dk-game ' + sel.replace('.dk-game ', ''), { timeout: 20000 }) } catch { bad.push(g + ': không mở được'); continue }
    await sleep(500)
    const r = await p.evaluate((sel) => { const g = document.querySelector('.dk-game').getBoundingClientRect(), a = document.querySelector(sel).getBoundingClientRect(), q = document.querySelector('.dk-game .question')?.getBoundingClientRect()
      return { gw: g.width, gl: g.left, gr: document.scrollingElement.clientWidth - g.right, ab: a.bottom, aw: a.width, qt: q ? q.top : 0, vh: innerHeight, hs: document.scrollingElement.scrollWidth > document.scrollingElement.clientWidth + 1, phone: !!document.querySelector('.phone') } }, sel)
    const fits = ['.fall-area', '.bl-arena', '.mario-arena'].includes(sel) ? r.ab <= r.vh + 1 : true
    if (!(Math.abs(r.gl - r.gr) <= 2 && r.gw >= 900 && !r.hs && !r.phone && fits && r.aw >= 600)) bad.push(g + ' ' + JSON.stringify(r))
    if (w === 1440) await shot(p, 'kid_game_' + g.split(' ')[0].normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace('đ', 'd').toLowerCase())
    await p.click('.dk-game .back')
  }
  check(`${w}×${h}: 6 trò chơi + tự điền trong thẻ chơi rộng giữa màn (không còn khung điện thoại), sân chơi nằm trọn trong cửa sổ, không cuộn ngang`, bad.length === 0, bad.join(' | '))
  await D.ctx.close()
}

check('không có lỗi trang / lỗi console', allErrs.length === 0, allErrs.join(' | '))
await browser.close()
const fails = Object.entries(results).filter(([, v]) => v !== 'PASS')
console.log(fails.length ? `\n${fails.length} FAIL` : `\nALL PASS (${Object.keys(results).length} kiểm tra)`)
process.exit(fails.length ? 1 : 0)
