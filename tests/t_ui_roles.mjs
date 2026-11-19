// HAI CẤP QUẢN TRỊ + ONTAP CHĂM SÓC KHÁCH HÀNG qua giao diện thật (18/11/2026). AI giả, thư giả.
//  1  Super admin: mục "Quản trị viên" thêm admin; mục "Cài đặt" nhập email nhận báo + bật ONTAP.
//  2  Admin đăng nhập: 6 mục (không có Quản trị viên / Cài đặt); đề xuất giá -> "chờ duyệt"; trang đăng ký vẫn giá cũ.
//  3  Super admin: "Duyệt & nhật ký" thấy giá cũ / mới -> Duyệt -> trang đăng ký hiện giá mới; nhật ký ghi lại.
//  4  Con gửi câu hỏi cách dùng -> ONTAP trả lời ngay trong app ("🤖 ONTAP"); kiến nghị -> ONTAP báo đã chuyển đội ngũ,
//     quản trị thấy "⚠️ ONTAP chuyển người" + email báo.
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
const ip = () => '10.16.' + (Number(RUN) % 250) + '.' + (1 + Math.floor(Math.random() * 200))
async function acct(action, body = {}, token = '') {
  const r = await fetch(BASE + '/api/account', { method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': ip(), ...(token ? { authorization: 'Bearer ' + token } : {}) }, body: JSON.stringify({ action, ...body }) })
  return r.json()
}
async function until(fn, ms = 15000, step = 300) { const t0 = Date.now(); for (;;) { const v = await fn(); if (v) return v; if (Date.now() - t0 > ms) return v; await sleep(step) } }
const mails = () => { try { return fs.readFileSync(MAILF, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l)) } catch { return [] } }
const SUPER = '0912000777', PASS = '12345678', STAFF = '0926' + RUN, USER = '0927' + RUN, KID = 'kidR' + RUN
if (!(await acct('register', { phone: SUPER, pass: PASS, parentName: 'Quản trị', plan: 1, pin: '1', children: [{ id: 'kS' + RUN, name: 'Bé', pin: '1', icon: '🦊', grade: 'Lớp 7' }] })).ok) await acct('login', { id: SUPER, pass: PASS })
await acct('register', { phone: USER, pass: PASS, parentName: 'Ba Huy', plan: 1, pin: '3', children: [{ id: KID, name: 'Huy', pin: '7', icon: '🦊', grade: 'Lớp 5' }] })
const allErrs = []
async function device(name, { width = 1280, height = 860 } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 })
  await useRealFonts(ctx)
  const page = await ctx.newPage()
  page.on('pageerror', (e) => allErrs.push(name + ' pageerror: ' + e.message))
  page.on('console', (m) => { if (m.type() === 'error' && !/favicon|fonts\.g|status of 4\d\d/.test(m.text())) allErrs.push(name + ' console: ' + m.text()) })
  return { ctx, page }
}
async function adminLogin(d, phone, pass) {
  await d.page.goto(BASE + '/quan-tri', { waitUntil: 'networkidle' })
  if (await d.page.locator('.adm-tabs').count()) { await d.page.click('button:has-text("Đăng xuất")') }
  await d.page.fill('.adm-login input[placeholder="Số điện thoại hoặc email"]', phone)
  await d.page.fill('.adm-login input[type=password]', pass)
  await d.page.click('.adm-login button.cta')
  await d.page.waitForSelector('.adm-tabs', { timeout: 10000 })
}
const tab = async (d, label) => { await d.page.click(`.adm-tab:has-text("${label}")`); await sleep(500) }
const regPrice = async () => {
  const R = await device('R', { width: 390, height: 844 })
  await R.page.goto(BASE + '/', { waitUntil: 'networkidle' })
  await R.page.click('.auth-landing button:has-text("Đăng ký")').catch(() => {})
  await R.page.waitForSelector('[data-testid=reg-price]', { timeout: 10000 })
  await sleep(800)
  const t = await R.page.locator('[data-testid=reg-price]').innerText()
  await R.ctx.close()
  return t
}

/* ======== 1. Super admin ======== */
console.log('— 1. Super admin: thêm admin, cài đặt')
const S = await device('S')
await adminLogin(S, SUPER, PASS)
const me = await until(async () => { const t = await S.page.locator('.adm-me').innerText(); return /Super admin/.test(t) ? t : null }, 10000) || await S.page.locator('.adm-me').innerText()   // chờ máy chủ trả vai (whoami)
check('đầu trang ghi vai "Super admin"', /Super admin/.test(me), me)
await tab(S, 'Định giá')
await S.page.waitForSelector('[data-testid=adm-price] table')
await S.page.fill('input[aria-label="Gói 1 hàng tháng"]', '150000')
await S.page.click('[data-testid=adm-price] button.cta:has-text("Lưu bảng giá")')
await until(async () => /Đã lưu bảng giá/.test(await S.page.locator('[data-testid=adm-price]').innerText()))
await tab(S, 'Quản trị viên')
await S.page.waitForSelector('[data-testid=adm-staff]')
await S.page.fill('input[aria-label="Số điện thoại admin"]', STAFF)
await S.page.fill('input[aria-label="Tên admin"]', 'Chị Lan')
await S.page.fill('input[aria-label="Mật khẩu ban đầu"]', 'NhanVien#1')
await S.page.click('[data-testid=adm-staff] button.cta:has-text("Thêm admin")')
const added = await until(async () => { const t = await S.page.locator('[data-testid=adm-staff]').innerText(); return /Đã thêm admin ✓/.test(t) && /Chị Lan/.test(t) ? t : null })
check('Quản trị viên: thêm admin "Chị Lan" (tạo tài khoản với mật khẩu ban đầu) -> có trong danh sách, nhãn "Admin"', !!added && /Super admin/.test(added) && /Admin/.test(added), added || '')
await tab(S, 'Cài đặt')
await S.page.waitForSelector('[data-testid=adm-cfg]')
await S.page.fill('input[aria-label="Email nhận báo"]', 'quantri@vidu.test')
await S.page.click('[data-testid=adm-cfg] button:has-text("Lưu email")')
await until(async () => /Đã lưu ✓/.test(await S.page.locator('[data-testid=adm-cfg]').innerText()))
if (!(await S.page.locator('[aria-label="ONTAP tự trả lời"][aria-checked="true"]').count())) await S.page.click('[aria-label="ONTAP tự trả lời"]')
check('Cài đặt: lưu email nhận báo + ONTAP tự trả lời đang BẬT', await until(async () => (await S.page.locator('[aria-label="ONTAP tự trả lời"][aria-checked="true"]').count()) === 1) && (await S.page.locator('input[aria-label="Email nhận báo"]').inputValue()) === 'quantri@vidu.test')
await S.page.screenshot({ path: `${OUT}/roles_cfg.png` })

/* ======== 2. Admin đề xuất giá ======== */
console.log('— 2. Admin: đề xuất giá chờ duyệt')
const A = await device('A')
await adminLogin(A, STAFF, 'NhanVien#1')
const tabs = await A.page.$$eval('.adm-tab', (els) => els.map((e) => e.textContent))
check('admin: 6 mục (không có "Quản trị viên", "Cài đặt"); đầu trang ghi "Admin"', tabs.length === 6 && !tabs.some((t) => /Quản trị viên|Cài đặt/.test(t)) && (await A.page.locator('.adm-me').innerText()).split(/\n|·/).map((x) => x.trim()).includes('Admin'), tabs.join('|'))   // bản máy tính: vai ghi ở đáy cột trái
await tab(A, 'Định giá')
await A.page.waitForSelector('[data-testid=adm-price] table')
await A.page.fill('input[aria-label="Gói 1 hàng tháng"]', '160000')
await A.page.click('[data-testid=adm-price] button.cta:has-text("Gửi đề xuất giá")')
const sent = await until(async () => /chờ super admin duyệt/.test(await A.page.locator('[data-testid=adm-price]').innerText()))
check('admin bấm "Gửi đề xuất giá (chờ duyệt)" -> "Chờ super admin duyệt", hiện đề xuất 160.000đ', sent && /160\.000đ/.test(await A.page.locator('[data-testid=price-pend]').innerText()))
check('trang đăng ký VẪN giá cũ 150.000đ', /150\.000đ \/ tháng/.test(await regPrice()))

/* ======== 3. Super admin duyệt ======== */
console.log('— 3. Super admin duyệt')
await tab(S, 'Duyệt & nhật ký')
await S.page.waitForSelector('[data-testid=adm-chg]')
const pend = S.page.locator('.adm-chg', { hasText: 'Đổi bảng giá' }).first()
const pt = await pend.innerText()
check('"Duyệt & nhật ký": đề xuất "Đổi bảng giá" của Chị Lan, giá cũ 150.000đ → giá mới 160.000đ', /Chị Lan/.test(pt) && /Giá cũ: gói 1: 150\.000đ/.test(pt) && /Giá mới: gói 1: 160\.000đ/.test(pt), pt)
await S.page.screenshot({ path: `${OUT}/roles_approve.png`, fullPage: true })
await pend.locator('button:has-text("Duyệt")').click()
await until(async () => /Đã duyệt ✓/.test(await S.page.locator('[data-testid=adm-chg]').innerText()))
check('super admin bấm Duyệt -> trang đăng ký hiện 160.000đ', /160\.000đ \/ tháng/.test(await regPrice()))
check('nhật ký: "✓ Đã duyệt", ghi người làm + người duyệt', /✓ Đã duyệt/.test(await S.page.locator('.adm-log').first().innerText()) && /Làm: Chị Lan/.test(await S.page.locator('.adm-log').first().innerText()))

/* ======== 4. ONTAP trả lời trong app ======== */
console.log('— 4. ONTAP chăm sóc khách hàng trong app')
const C = await device('C', { width: 390, height: 844 })
await C.page.goto(BASE + '/', { waitUntil: 'networkidle' })
await C.page.click('.auth-landing button:has-text("Đăng nhập")')
await C.page.fill('input[placeholder="Số điện thoại hoặc email"]', USER)
await C.page.fill('input[placeholder="Mật khẩu 8 số"]', PASS)
await C.page.click('.auth-card button.cta:has-text("Đăng nhập")')
await C.page.waitForSelector('.pick-grid', { timeout: 10000 })
await C.page.click('.pick-card:has-text("Huy")'); await C.page.fill('.pick-pinbox input', '7'); await C.page.click('.pick-pinbox button.cta')
await C.page.waitForSelector('.kh-cta', { timeout: 10000 })
await C.page.click('.kh-fb')
await C.page.waitForSelector('[data-testid=feedback]')
await C.page.click('[data-testid=feedback] .chip:has-text("Khác")')
await C.page.fill('textarea[aria-label="Nội dung góp ý"]', 'Làm sao để con ôn môn Toán ạ?')
await C.page.click('[data-testid=feedback] button.cta:has-text("Gửi góp ý")')
const ans = await until(async () => { const t = await C.page.locator('[data-testid=feedback]').innerText(); return /ONTAP đã trả lời con ngay bên dưới/.test(t) && /🤖 ONTAP/.test(t) && /Bắt đầu ôn/.test(t) ? t : null }, 20000)
check('con hỏi cách dùng -> "ONTAP đã trả lời con ngay bên dưới", mở sẵn phiếu có câu trả lời "🤖 ONTAP"', !!ans, (ans || await C.page.locator('[data-testid=feedback]').innerText()).slice(0, 300))
await C.page.screenshot({ path: `${OUT}/roles_child_ontap.png` })
const m0 = mails().length
await C.page.click('[data-testid=feedback] .chip:has-text("Gửi góp ý")')
await C.page.click('[data-testid=feedback] .chip:has-text("Kiến nghị")')
await C.page.fill('textarea[aria-label="Nội dung góp ý"]', 'Con đề nghị thêm trò chơi Toán ' + RUN)
await C.page.click('[data-testid=feedback] button.cta:has-text("Gửi góp ý")')
const esc = await until(async () => /chuyển cho đội ngũ/.test(await C.page.locator('[data-testid=feedback]').innerText()), 20000)
check('con kiến nghị -> ONTAP báo "đã chuyển cho đội ngũ Ôn Tập"', esc)
const ms = mails().slice(m0)
check('-> email báo tới quantri@vidu.test', ms.length === 1 && ms[0].to === 'quantri@vidu.test' && /Cần xử lý: Kiến nghị/.test(ms[0].subject), JSON.stringify(ms))
await tab(S, 'Góp ý')
const row = S.page.locator('.adm-fbi', { hasText: 'Con đề nghị thêm trò chơi Toán ' + RUN })
check('quản trị thấy phiếu "🔴 ⚠️ ONTAP chuyển người" + tóm tắt của ONTAP', await until(async () => (await row.count()) === 1 && /⚠️ ONTAP chuyển người/.test(await row.innerText()) && /🤖 Tóm tắt/.test(await row.innerText())))
await S.page.click('.chip:has-text("Tất cả")'); await sleep(600)
check('(mục "Tất cả") phiếu ONTAP đã tự trả lời ghi "🤖 ONTAP đã trả lời", không chấm đỏ', await until(async () => { const r = S.page.locator('.adm-fbi', { hasText: 'Làm sao để con ôn môn Toán' }).first(); return (await r.count()) && /🤖 ONTAP đã trả lời/.test(await r.innerText()) && !/🔴/.test(await r.innerText()) }))

check('không có lỗi trang / lỗi console', allErrs.length === 0, allErrs.join(' | '))
await browser.close()
const fails = Object.entries(results).filter(([, v]) => v !== 'PASS')
console.log(fails.length ? `\n${fails.length} FAIL` : `\nALL PASS (${Object.keys(results).length} kiểm tra)`)
process.exit(fails.length ? 1 : 0)
