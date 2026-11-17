// Đăng nhập nhiều máy (anh yêu cầu 01/11/2026) — thử qua giao diện thật, mỗi "máy" là một trình duyệt riêng (kho riêng):
//  A đăng ký -> B, C đăng nhập bằng số điện thoại / email; sai mật khẩu; đăng ký trùng số; thêm con + PIN phụ huynh ở A
//  -> B thấy; đổi mật khẩu ở A -> B phải đăng nhập lại; QUÊN MẬT KHẨU Ở MỌI MÁY (10/11/2026): trình duyệt MỚI nhận mã 6 số
//  qua email (thư giả: tests/out/mail-4192.jsonl) -> đặt lại -> vào app, A + B phải đăng nhập lại; sai mã; hai ô không khớp;
//  gửi lại mã sau 60 giây; tài khoản chưa có email (máy đã đăng nhập dùng cách cũ, máy mới không có); máy chủ chưa cài gửi
//  email (4194); tài khoản cũ (chỉ có trên máy) tự lên máy chủ; hai máy từng đăng ký riêng cùng số -> gộp con,
//  không mất dữ liệu; máy chủ chưa có kho -> đăng nhập bằng tài khoản trên máy như trước.
import { pw, OUT_DIR } from './_env.mjs'
import { execFileSync } from 'node:child_process'
import { useRealFonts } from './fonts.mjs'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
const OUT = OUT_DIR
const BASE = 'http://localhost:4192', NOSTORE = 'http://localhost:4193', NOMAIL = 'http://localhost:4194'
const MAILS = path.join(path.dirname(fileURLToPath(import.meta.url)), 'out', 'mail-4192.jsonl')
const lastMail = (to) => { try { return fs.readFileSync(MAILS, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)).filter((m) => m.to === to).pop() || null } catch { return null } }
const codeOf = (m) => ((m && m.subject) || '').match(/(\d{6})$/)?.[1] || ''
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const browser = await pw.chromium.launch({ headless: true })
const results = {}
const check = (n, c, x = '') => { results[n] = c ? 'PASS' : 'FAIL'; console.log((c ? '  ✓ ' : '  ✗ ') + n + (c || !x ? '' : '  → ' + x)) }
const RUN = String(Date.now()).slice(-6)
const P = '0911' + RUN, E = `ba${RUN}@vidu.com`, PL = '0922' + RUN, PM = '0933' + RUN
const rdel = (k) => execFileSync('redis-cli', ['-p', '6390', 'DEL', k]).toString().trim()
// Ô chọn tự vẽ (SelectPicker, thay <select> 04/11/2026): bấm ô rồi chọn đúng dòng
async function pickIn(root, label) {
  await root.locator('.sel-btn').first().click()
  await root.locator('.sel-opt').filter({ hasText: new RegExp('^' + label + '$') }).click()
}
async function api(action, body = {}, token = '') {
  const r = await fetch(BASE + '/api/account', { method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': '10.77.' + (Number(RUN) % 250) + '.1', ...(token ? { authorization: 'Bearer ' + token } : {}) }, body: JSON.stringify({ action, ...body }) })
  return r.json()
}
const allErrs = []
async function device(name, { base = BASE, seed = null } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 })
  await useRealFonts(ctx)
  if (seed) await ctx.addInitScript((kv) => { if (window.top !== window) return; if (sessionStorage.getItem('s')) return; sessionStorage.setItem('s', '1'); localStorage.clear(); for (const [k, v] of Object.entries(kv)) localStorage.setItem(k, v) }, seed)
  const page = await ctx.newPage()
  page.on('pageerror', (e) => allErrs.push(name + ' pageerror: ' + e.message))
  page.on('console', (m) => { if (m.type() === 'error' && !/favicon|fonts\.g/.test(m.text())) allErrs.push(name + ' console: ' + m.text()) })
  await page.goto(base + '/', { waitUntil: 'networkidle' })
  return { name, ctx, page, base }
}
const ls = (d, k) => d.page.evaluate((k) => localStorage.getItem(k), k)
const accOf = async (d) => JSON.parse((await ls(d, 'ontap.account.v1')) || 'null')
const kidNames = (d) => d.page.$$eval('.pick-card:not(.add) .pick-name', (els) => els.map((e) => e.textContent))
async function waitPicker(d) { await d.page.waitForSelector('.pick-grid', { timeout: 10000 }) }
async function login(d, id, pass) {
  if (await d.page.locator('.auth-landing').count()) await d.page.click('.auth-landing button:has-text("Đăng nhập")')
  await d.page.fill('input[placeholder="Số điện thoại hoặc email"]', id)
  await d.page.fill('input[placeholder="Mật khẩu 8 số"]', pass)
  await d.page.click('.auth-card button.cta:has-text("Đăng nhập")')
}
async function logoutFromPicker(d) { await d.page.click('.pick .ds-logout'); await d.page.waitForSelector('.auth-card', { timeout: 8000 }) }
async function register(d, { phone, email, pass, parent, kids }) {
  await d.page.click('.auth-landing button:has-text("Đăng ký")')
  await d.page.fill('input[placeholder="VD: Nguyễn Văn A"]', parent)
  await d.page.fill('input[placeholder="VD: 0912345678"]', phone)
  await d.page.fill('input[placeholder="8 chữ số"]', pass)
  await d.page.fill('input[placeholder="Nhập lại 8 chữ số"]', pass)
  await d.page.fill('input[placeholder="email@vidu.com"]', email)
  await d.page.fill('input[placeholder="VD: TP. Hồ Chí Minh"]', 'TP. Hồ Chí Minh')
  await d.page.click(`.reg-plan .chip:has-text("${kids.length} học sinh")`)
  for (let i = 0; i < kids.length; i++) {
    const box = d.page.locator('.reg-kid').nth(i)
    await box.locator('input[placeholder="VD: Anna"]').fill(kids[i].name)
    await box.locator('input[placeholder="VD: 7 hoặc 12"]').fill(kids[i].pin)
    await box.locator('.icon-opt').nth(i).click()
    await pickIn(box, 'Lớp 5')
    await box.locator('input[placeholder="VD: Tiểu học Kim Đồng"]').fill('TH Kim Đồng')
    await box.locator('.reg-types .chip').first().click()
  }
  await d.page.click('button.cta:has-text("Tiếp theo")')
}
async function openSettings(d, kidName, kidPin, parentPin) {
  await d.page.click(`.pick-card:has-text("${kidName}")`)
  await d.page.fill('.pick-pinbox input', kidPin); await d.page.click('.pick-pinbox button.cta')
  await d.page.waitForSelector('.kh-cta', { timeout: 8000 })
  await d.page.click('.ds-seg button:has-text("Phụ huynh")')
  await d.page.waitForSelector('.modal input', { timeout: 5000 })
  await d.page.fill('.modal input.pin-in', parentPin); await d.page.click('.modal .modal-btns .cta:not(.ghost)')
  await d.page.click('button:has-text("Mục tiêu")')
  await d.page.waitForSelector('.set-sec', { timeout: 5000 })
}

// ======== 1. Máy A đăng ký ========
console.log('— 1. Máy A đăng ký (gói 2 con)')
const A = await device('A')
await register(A, { phone: P, email: E, pass: '12345678', parent: 'Ba An', kids: [{ name: 'An', pin: '11' }, { name: 'Bình', pin: '22' }] })
await A.page.waitForSelector('button.cta:has-text("Hoàn tất")', { timeout: 8000 })
await A.page.click('button.cta:has-text("Hoàn tất")')
await waitPicker(A)
check('máy A: đăng ký xong vào màn chọn con (An, Bình)', JSON.stringify(await kidNames(A)) === '["An","Bình"]', JSON.stringify(await kidNames(A)))
const tokA = await ls(A, 'ontap.acctoken.v1')
check('máy A: nhận chìa khoá máy chủ; tài khoản đã có trên máy chủ (đăng nhập bằng API được)', !!tokA && (await api('login', { id: P, pass: '12345678' })).ok)
const idsA = (await accOf(A)).children.map((c) => c.id)

// ======== 2. Máy B đăng nhập bằng số điện thoại ========
console.log('— 2. Máy khác đăng nhập')
const B = await device('B')
await login(B, P, '12345678')
await waitPicker(B)
const accB = await accOf(B)
check('máy B (chưa từng đăng ký): đăng nhập bằng số điện thoại -> thấy đủ An, Bình', JSON.stringify(await kidNames(B)) === '["An","Bình"]', JSON.stringify(await kidNames(B)))
check('máy B: đúng tài khoản (tên phụ huynh, cùng id các con, PIN con) + có chìa khoá', /Ba An/.test(await B.page.textContent('.hello')) && JSON.stringify(accB.children.map((c) => c.id)) === JSON.stringify(idsA) && accB.children[0].pin === '11' && !!(await ls(B, 'ontap.acctoken.v1')))
await logoutFromPicker(B)
await login(B, ' ' + E.toUpperCase() + ' ', '12345678')
await waitPicker(B)
check('máy B: đăng xuất rồi đăng nhập bằng EMAIL (viết hoa) -> vào được', (await kidNames(B)).length === 2)
const C = await device('C')
await login(C, P, '11111111')
await C.page.waitForSelector('.auth-card .err', { timeout: 8000 })
check('máy C: sai mật khẩu -> báo "Sai số điện thoại / email hoặc mật khẩu."', /Sai số điện thoại \/ email hoặc mật khẩu/.test(await C.page.textContent('.auth-card .err')))
await login(C, P, '12345678')
await waitPicker(C)
check('máy C: gõ lại đúng mật khẩu -> vào được', (await kidNames(C)).length === 2)
await C.page.screenshot({ path: `${OUT}/acc_c_picker.png` })

// ======== 3. Đăng ký trùng số ========
const D = await device('D')
await register(D, { phone: P, email: 'khac' + RUN + '@vidu.com', pass: '55556666', parent: 'Người khác', kids: [{ name: 'X', pin: '1' }] })
await D.page.waitForSelector('.auth-card .err', { timeout: 8000 })
check('máy D: đăng ký bằng số đã có tài khoản -> báo "đã có tài khoản… chọn Đăng nhập", không sang trang thanh toán', /đã có tài khoản/.test(await D.page.textContent('.auth-card .err')) && (await D.page.locator('button:has-text("Hoàn tất")').count()) === 0)
await D.page.screenshot({ path: `${OUT}/acc_d_taken.png` })

// ======== 4. Máy A thêm con + đặt PIN phụ huynh -> máy B thấy ========
console.log('— 4. Thêm con ở máy A, máy B thấy')
await api('update', { account: { plan: 3 } }, tokA)            // (như phụ huynh nâng gói lên 3 con)
await A.page.reload({ waitUntil: 'networkidle' }); await waitPicker(A)
await A.page.waitForSelector('.pick-card.add', { timeout: 8000 })
await A.page.click('.pick-card.add')
await A.page.waitForSelector('.modal input.pin-in'); await A.page.fill('.modal input.pin-in', '5'); await A.page.click('.modal .modal-btns .cta:not(.ghost)')
await A.page.fill('input[placeholder="VD: Bin"]', 'Chi'); await A.page.fill('input[placeholder="VD: 7 hoặc 12"]', '33')
await A.page.locator('.icon-opt').nth(2).click(); await pickIn(A.page, 'Lớp 3')
await A.page.fill('input[placeholder="VD: Tiểu học Kim Đồng"]', 'TH Kim Đồng'); await A.page.locator('.reg-types .chip').first().click()
await A.page.click('button.cta:has-text("Thêm con")')
await A.page.waitForFunction(() => [...document.querySelectorAll('.pick-name')].some((e) => e.textContent === 'Chi'), null, { timeout: 8000 })
await sleep(800)
const srv = await api('get', {}, tokA)
check('máy A: thêm con Chi + đặt PIN phụ huynh 5 -> máy chủ có 3 con, PIN 5', srv.ok && srv.account.children.map((c) => c.name).join(',') === 'An,Bình,Chi' && srv.account.pin === '5', JSON.stringify(srv.account && srv.account.children.map((c) => c.name)))
await B.page.reload({ waitUntil: 'networkidle' }); await waitPicker(B)
await B.page.waitForFunction(() => document.querySelectorAll('.pick-card:not(.add)').length === 3, null, { timeout: 8000 }).catch(() => {})
check('máy B mở lại app -> thấy con mới Chi, PIN phụ huynh 5', JSON.stringify(await kidNames(B)) === '["An","Bình","Chi"]' && (await accOf(B)).pin === '5', JSON.stringify(await kidNames(B)))

// ======== 5. Đổi mật khẩu ở A -> B phải đăng nhập lại ========
console.log('— 5. Đổi mật khẩu ở máy A')
await openSettings(A, 'An', '11', '5')
await A.page.evaluate(() => { document.scrollingElement.scrollTop = 0; document.querySelector('.phone').scrollTop = 0 })
check('Cài đặt máy A: "✓ Đăng nhập được trên mọi máy"', /Đăng nhập được trên mọi máy/.test(await A.page.textContent('.set-sync')), await A.page.textContent('.set-sec'))
await A.page.screenshot({ path: `${OUT}/acc_a_settings.png` })
await A.page.fill('input[placeholder="Mật khẩu hiện tại"]', '00000000'); await A.page.fill('input[placeholder="Mật khẩu mới"]', '87654321'); await A.page.fill('input[placeholder="Nhập lại mật khẩu mới"]', '87654321')
await A.page.click('button.cta:has-text("Đổi mật khẩu")')
await A.page.waitForSelector('.set-sec .err', { timeout: 8000 })
check('đổi mật khẩu với mật khẩu hiện tại sai -> báo "chưa đúng"', /chưa đúng/.test(await A.page.textContent('.set-sec .err')))
await A.page.fill('input[placeholder="Mật khẩu hiện tại"]', '12345678')
await A.page.click('button.cta:has-text("Đổi mật khẩu")')
await A.page.waitForSelector('.set-sec .ok-msg', { timeout: 8000 })
check('đổi mật khẩu đúng -> "Đã đổi mật khẩu ✓ Các máy khác cần đăng nhập lại…"', /Đã đổi mật khẩu/.test(await A.page.textContent('.set-sec .ok-msg')))
await B.page.reload({ waitUntil: 'networkidle' })
await B.page.waitForSelector('.auth-notice', { timeout: 10000 }).catch(() => {})
check('máy B mở lại app -> tự đăng xuất, nhắn "Mật khẩu tài khoản đã được đổi trên máy khác…"', /đã được đổi trên máy khác/.test((await B.page.textContent('.auth-notice').catch(() => '')) || ''))
await B.page.screenshot({ path: `${OUT}/acc_b_relogin.png` })
await login(B, P, '12345678')
await B.page.waitForSelector('.auth-card .err', { timeout: 8000 })
check('máy B: mật khẩu cũ không vào được nữa', /Sai/.test(await B.page.textContent('.auth-card .err')))
await login(B, P, '87654321')
await waitPicker(B)
check('máy B: mật khẩu mới -> vào được', (await kidNames(B)).length === 3)

// ======== 6. Quên mật khẩu ở mọi máy: mã 6 số qua email (10/11/2026) ========
console.log('— 6. Quên mật khẩu (trình duyệt mới, mã qua email)')
async function openForgot(d) {
  if (await d.page.locator('.auth-landing').count()) await d.page.click('.auth-landing button:has-text("Đăng nhập")')
  await d.page.click('button:has-text("Quên mật khẩu?")')
  await d.page.waitForSelector('input[placeholder="Số điện thoại hoặc email đã đăng ký"]', { timeout: 5000 })
}
async function sendCodeUI(d, id) {
  await d.page.fill('input[placeholder="Số điện thoại hoặc email đã đăng ký"]', id)
  await d.page.click('.auth-card button.cta:has-text("Gửi mã")')
}
async function fillCode(d, code, p1, p2) {
  await d.page.fill('input[placeholder="6 chữ số trong email"]', code)
  await d.page.fill('input[placeholder="8 chữ số"]', p1); await d.page.fill('input[placeholder="Nhập lại 8 chữ số"]', p2)
  await d.page.click('.auth-card button.cta:has-text("Đặt lại mật khẩu")')
}
const errText = (d) => d.page.textContent('.auth-card .err').catch(() => '')
const F = await device('F')
F.page.on('request', (r) => { if (r.url().endsWith('/api/account')) F.calls = (F.calls || 0) + 1 })
await openForgot(F)
await sendCodeUI(F, P)
await F.page.waitForSelector('.auth-sent', { timeout: 8000 })
const sentTxt = await F.page.textContent('.auth-sent')
const maskE = 'b***@vidu.com'
check('máy MỚI (chưa từng đăng nhập): gửi mã -> "Đã gửi mã 6 số tới b***@vidu.com. Mở hộp thư (xem cả mục Thư rác/Spam). Mã dùng được 15 phút."',
  sentTxt === `Đã gửi mã 6 số tới ${maskE}. Mở hộp thư (xem cả mục Thư rác/Spam). Mã dùng được 15 phút.`, sentTxt)
check('màn hình chỉ hiện email đã che (không hiện email đầy đủ)', !(await F.page.textContent('.auth-card')).includes(E))
const resendTxt = await F.page.textContent('.f-resend')
check('"Gửi lại mã" chưa bấm được ngay (đợi 60 giây)', (await F.page.locator('.f-resend').isDisabled()) && /Gửi lại mã \(sau (59|60) giây\)/.test(resendTxt), resendTxt)
await F.page.screenshot({ path: `${OUT}/acc_f_code.png` })
const codeF = codeOf(lastMail(E))
check('thư mã đã tới email đã đăng ký', /^\d{6}$/.test(codeF))
const wrongF = codeF === '000000' ? '111111' : '000000'
await fillCode(F, wrongF, '24682468', '24682468')
await F.page.waitForSelector('.auth-card .err', { timeout: 8000 })
check('sai mã -> "Mã chưa đúng. Còn 4 lần thử."', (await errText(F)) === 'Mã chưa đúng. Còn 4 lần thử.', await errText(F))
const callsBefore = F.calls
await fillCode(F, codeF, '24682468', '24682467')
await F.page.waitForFunction(() => /chưa khớp/.test(document.querySelector('.auth-card .err')?.textContent || ''), null, { timeout: 5000 }).catch(() => {})
check('hai ô mật khẩu mới không khớp -> báo "chưa khớp", không gửi lên máy chủ', /Hai ô mật khẩu mới chưa khớp/.test(await errText(F)) && F.calls === callsBefore, await errText(F))
await fillCode(F, codeF, '2468', '2468')
check('mật khẩu mới không đủ 8 số -> báo "ĐÚNG 8 chữ số"', /ĐÚNG 8 chữ số/.test(await errText(F)))
await fillCode(F, codeF, '24682468', '24682468')
await waitPicker(F)
check('đúng mã -> đặt mật khẩu mới và VÀO APP LUÔN, thấy đủ An, Bình, Chi', JSON.stringify(await kidNames(F)) === '["An","Bình","Chi"]', JSON.stringify(await kidNames(F)))
check('máy mới nhận chìa khoá + tài khoản đúng (cùng id các con)', !!(await ls(F, 'ontap.acctoken.v1')) && JSON.stringify((await accOf(F)).children.slice(0, 2).map((c) => c.id)) === JSON.stringify(idsA))
check('mật khẩu mới dùng được ở mọi máy, mật khẩu cũ thì không', (await api('login', { id: E, pass: '24682468' })).ok && !(await api('login', { id: P, pass: '87654321' })).ok)
await A.page.reload({ waitUntil: 'networkidle' })
await A.page.waitForSelector('.auth-notice', { timeout: 10000 }).catch(() => {})
check('máy A (cũ) mở lại -> tự đăng xuất, "đã được đổi trên máy khác"', /đã được đổi trên máy khác/.test((await A.page.textContent('.auth-notice').catch(() => '')) || ''))
await B.page.reload({ waitUntil: 'networkidle' })
await B.page.waitForSelector('.auth-notice', { timeout: 10000 }).catch(() => {})
check('máy B (cũ) mở lại -> cũng phải đăng nhập lại', /đã được đổi trên máy khác/.test((await B.page.textContent('.auth-notice').catch(() => '')) || ''))
await login(A, E, '24682468'); await waitPicker(A)
check('máy A đăng nhập lại bằng email + mật khẩu mới -> vào được', (await kidNames(A)).length === 3)
// gửi lại mã sau 60 giây (đồng hồ giả của trình duyệt)
const R = await device('R')
await R.page.clock.install()
await openForgot(R)
await sendCodeUI(R, E.toUpperCase())
await R.page.waitForSelector('.auth-sent', { timeout: 8000 })
const code1R = codeOf(lastMail(E))
check('gửi mã bằng email (viết hoa) cũng được', /^\d{6}$/.test(code1R) && /b\*\*\*@vidu\.com/.test(await R.page.textContent('.auth-sent')))
await R.page.clock.fastForward(61000)
await R.page.waitForFunction(() => document.querySelector('.f-resend')?.textContent === 'Gửi lại mã', null, { timeout: 5000 }).catch(() => {})
check('sau 60 giây nút "Gửi lại mã" bấm được', !(await R.page.locator('.f-resend').isDisabled()), await R.page.textContent('.f-resend'))
const nMail = (fs.readFileSync(MAILS, 'utf8').match(/\n/g) || []).length
await R.page.click('.f-resend')
await R.page.waitForFunction(() => /sau \d+ giây/.test(document.querySelector('.f-resend')?.textContent || ''), null, { timeout: 8000 }).catch(() => {})
const code2R = codeOf(lastMail(E))
check('bấm "Gửi lại mã" -> thư mới, nút lại phải đợi', (fs.readFileSync(MAILS, 'utf8').match(/\n/g) || []).length === nMail + 1 && /sau \d+ giây/.test(await R.page.textContent('.f-resend')))
await fillCode(R, code2R, '13571357', '13571357')
await waitPicker(R)
check('mã mới (gửi lại) dùng được -> vào app', (await kidNames(R)).length === 3)
await R.ctx.close()
// tài khoản CHƯA có email: máy đã đăng nhập dùng cách cũ; máy mới không có cách cũ
const PN = '0955' + RUN
await api('register', { phone: PN, pass: '12121212', parentName: 'Ba Nê', children: [{ id: 'c-ne-ui', name: 'Nê', pin: '4', icon: '🐸', grade: 'Lớp 2', school: 'TH', schoolType: 'Công lập' }] })
const S = await device('S')
await login(S, PN, '12121212'); await waitPicker(S)
await logoutFromPicker(S)
await openForgot(S)
await sendCodeUI(S, PN)
await S.page.waitForSelector('.auth-card .err', { timeout: 8000 })
check('tài khoản chưa có email -> báo "chưa có email nên chưa gửi được mã"', /chưa có email nên chưa gửi được mã/.test(await errText(S)), await errText(S))
check('máy đã từng đăng nhập tài khoản đó -> có nút "Đặt mật khẩu mới ngay trên máy này" (cách cũ)', (await S.page.locator('.f-old').count()) === 1)
await S.page.screenshot({ path: `${OUT}/acc_s_noemail.png` })
await S.page.click('.f-old')
await S.page.fill('input[placeholder="8 chữ số"]', '34343434'); await S.page.fill('input[placeholder="Nhập lại 8 chữ số"]', '34343434')
await S.page.click('.auth-card button.cta:has-text("Đặt lại mật khẩu")')
await waitPicker(S)
check('cách cũ: đặt mật khẩu mới trên máy này -> vào app, mật khẩu mới dùng được ở mọi máy', JSON.stringify(await kidNames(S)) === '["Nê"]' && (await api('login', { id: PN, pass: '34343434' })).ok)
const T = await device('T')
await openForgot(T)
await sendCodeUI(T, PN)
await T.page.waitForSelector('.auth-card .err', { timeout: 8000 })
check('máy MỚI, tài khoản chưa có email -> báo rõ, KHÔNG có nút cách cũ, không đổi được mật khẩu', /chưa có email/.test(await errText(T)) && (await T.page.locator('.f-old').count()) === 0 && (await api('login', { id: PN, pass: '34343434' })).ok)
await T.ctx.close()
// máy chủ chưa cài gửi email
const U = await device('U', { base: NOMAIL })
await openForgot(U)
await sendCodeUI(U, P)
await U.page.waitForSelector('.auth-card .err', { timeout: 8000 })
check('máy chủ chưa cài gửi email -> báo "Máy chủ chưa cài gửi email…", không có nút cách cũ (máy mới)', /Máy chủ chưa cài gửi email/.test(await errText(U)) && (await U.page.locator('.f-old').count()) === 0, await errText(U))
await U.page.screenshot({ path: `${OUT}/acc_u_mailoff.png` })
await U.ctx.close()
rdel('acct:u:' + PN)

// ======== 7. Tài khoản cũ (chỉ có trên một máy) tự lên máy chủ ========
console.log('— 7. Tài khoản cũ tự lên máy chủ')
const legacy = (phone, kids, mem) => ({
  'ontap.account.v1': JSON.stringify({ username: phone, password: '13572468', phone, parentPass: '13572468', parentName: 'Mẹ Lan', email: '', plan: kids.length, children: kids }),
  'ontap.session.v1': '1', ...mem,
})
const G = await device('G', { seed: legacy(PL, [{ id: 'c-lan-old', name: 'Lan', pin: '', icon: '🐰', grade: 'Lớp 2' }], { 'ontap.memory.v2::c-lan-old': '[{"id":"x1","name":"Phép cộng","subject":"Toán"}]' }) })
await waitPicker(G)
await G.page.waitForFunction(() => !!localStorage.getItem('ontap.acctoken.v1'), null, { timeout: 10000 }).catch(() => {})
check('máy có tài khoản cũ: mở app -> tự chuyển tài khoản lên máy chủ (có chìa khoá), dữ liệu học giữ nguyên', !!(await ls(G, 'ontap.acctoken.v1')) && (await ls(G, 'ontap.memory.v2::c-lan-old')) !== null)
const H = await device('H')
await login(H, PL, '13572468'); await waitPicker(H)
check('máy khác đăng nhập tài khoản cũ đó -> thấy con Lan (cùng id)', JSON.stringify(await kidNames(H)) === '["Lan"]' && (await accOf(H)).children[0].id === 'c-lan-old')

// ======== 8. Hai máy từng đăng ký riêng cùng số điện thoại -> gộp con, không mất dữ liệu ========
console.log('— 8. Hai máy từng đăng ký riêng cùng số')
const I = await device('I', { seed: legacy(PM, [{ id: 'c-mai-I', name: 'Mai', pin: '', icon: '🐱', grade: 'Lớp 4' }], { 'ontap.memory.v2::c-mai-I': '[{"id":"m1","name":"Bài của Mai ở máy I","subject":"Toán"}]' }) })
await waitPicker(I)
await I.page.waitForFunction(() => !!localStorage.getItem('ontap.acctoken.v1'), null, { timeout: 10000 }).catch(() => {})
const J = await device('J', { seed: legacy(PM, [{ id: 'c-mai-J', name: 'Mai', pin: '', icon: '🐱', grade: 'Lớp 4' }, { id: 'c-nam-J', name: 'Nam', pin: '', icon: '🐶', grade: 'Lớp 1' }], { 'ontap.memory.v2::c-mai-J': '[{"id":"m2","name":"Bài của Mai ở máy J","subject":"Toán"}]', 'ontap.memory.v2::c-nam-J': '[{"id":"n1","name":"Bài của Nam","subject":"Toán"}]' }) })
await waitPicker(J)
await J.page.waitForFunction(() => JSON.parse(localStorage.getItem('ontap.account.v1') || '{}').children?.some((c) => c.id === 'c-mai-I'), null, { timeout: 10000 }).catch(() => {})
const accJ = await accOf(J)
check('máy J: gộp với tài khoản máy chủ -> Mai (id máy I) + Nam; không còn Mai trùng', JSON.stringify(accJ.children.map((c) => c.id + ':' + c.name)) === JSON.stringify(['c-mai-I:Mai', 'c-nam-J:Nam']), JSON.stringify(accJ.children))
check('máy J: bài của Mai ở máy J chuyển sang id chung (không mất), bài của Nam giữ nguyên', /Bài của Mai ở máy J/.test((await ls(J, 'ontap.memory.v2::c-mai-I')) || '') && (await ls(J, 'ontap.memory.v2::c-mai-J')) === null && /Bài của Nam/.test((await ls(J, 'ontap.memory.v2::c-nam-J')) || ''))
await I.page.reload({ waitUntil: 'networkidle' }); await waitPicker(I)
await I.page.waitForFunction(() => document.querySelectorAll('.pick-card:not(.add)').length === 2, null, { timeout: 8000 }).catch(() => {})
check('máy I mở lại -> thấy thêm Nam; bài của Mai ở máy I giữ nguyên', JSON.stringify(await kidNames(I)) === '["Mai","Nam"]' && /Bài của Mai ở máy I/.test((await ls(I, 'ontap.memory.v2::c-mai-I')) || ''), JSON.stringify(await kidNames(I)))

// ======== 9. Máy chủ chưa có kho: dùng tài khoản trên máy như trước ========
console.log('— 9. Máy chủ chưa gắn kho')
const K = await device('K', { base: NOSTORE, seed: legacy('0944' + RUN, [{ id: 'c-k1', name: 'Khoa', pin: '', icon: '🐯', grade: 'Lớp 3' }], {}) })
await waitPicker(K)
await logoutFromPicker(K)
await login(K, '0944' + RUN, '13572468'); await waitPicker(K)
check('máy chủ chưa có kho: đăng xuất rồi đăng nhập bằng tài khoản trên máy -> vẫn vào được như trước', JSON.stringify(await kidNames(K)) === '["Khoa"]')


// ======== 10. (03/11) Máy cũ đang ĐĂNG XUẤT: chỉ cần mở app là tài khoản lên máy chủ ========
console.log('— 10. Máy cũ đang đăng xuất')
const PO = '0966' + RUN
const oldOut = legacy(PO, [{ id: 'c-out1', name: 'Tú', pin: '', icon: '🐼', grade: 'Lớp 3' }], {})
oldOut['ontap.session.v1'] = '0'
const L = await device('L', { seed: oldOut })
await L.page.waitForSelector('.auth-landing, .auth-card', { timeout: 8000 })
await L.page.waitForFunction(() => !!localStorage.getItem('ontap.acctoken.v1'), null, { timeout: 10000 }).catch(() => {})
check('máy cũ đang đăng xuất: chỉ mở app (không đăng nhập) -> tài khoản tự lên máy chủ', !!(await ls(L, 'ontap.acctoken.v1')) && (await api('login', { id: PO, pass: '13572468' })).ok)
check('máy cũ vẫn ở màn đăng nhập, tài khoản trên máy giữ nguyên', (await L.page.locator('.pick-grid').count()) === 0 && (await accOf(L)).children[0].id === 'c-out1')
const M = await device('M')
await login(M, PO, '13572468'); await waitPicker(M)
check('máy mới đăng nhập tài khoản đó -> vào được, thấy con Tú', JSON.stringify(await kidNames(M)) === '["Tú"]')

// ======== 11. (03/11) Báo rõ khi số điện thoại / email chưa có trên máy chủ ========
console.log('— 11. Số chưa có trên máy chủ')
const N = await device('N')
await login(N, '0977' + RUN, '12345678')
await N.page.waitForSelector('.auth-card .err', { timeout: 8000 })
check('đăng nhập số chưa có trên máy chủ -> báo "chưa có tài khoản trên máy chủ… mở Ôn Tập trên máy đó một lần"', /chưa có tài khoản trên máy chủ/.test(await N.page.textContent('.auth-card .err')) && /mở Ôn Tập trên máy đó một lần/.test(await N.page.textContent('.auth-card .err')))
await login(N, 'chuaco' + RUN + '@vidu.com', '12345678')
await N.page.waitForFunction(() => /chưa có tài khoản trên máy chủ/.test(document.querySelector('.auth-card .err')?.textContent || ''), null, { timeout: 8000 }).catch(() => {})
check('đăng nhập email chưa có trên máy chủ -> cũng báo rõ', /chưa có tài khoản trên máy chủ/.test(await N.page.textContent('.auth-card .err')))
await login(N, P, '00000000')
await N.page.waitForFunction(() => /Sai số điện thoại/.test(document.querySelector('.auth-card .err')?.textContent || ''), null, { timeout: 8000 }).catch(() => {})
check('số đã có tài khoản mà sai mật khẩu -> vẫn báo "Sai số điện thoại / email hoặc mật khẩu."', /Sai số điện thoại \/ email hoặc mật khẩu/.test(await N.page.textContent('.auth-card .err')))
await N.page.click('button:has-text("Quên mật khẩu?")')
await sendCodeUI(N, '0977' + RUN)
await N.page.waitForSelector('.auth-card .err', { timeout: 8000 })
check('quên mật khẩu với số chưa có trên máy chủ -> báo chưa có tài khoản, mở Ôn Tập trên máy đã đăng ký một lần', /chưa có tài khoản/.test(await N.page.textContent('.auth-card .err')) && /mở Ôn Tập trên máy đó một lần/.test(await N.page.textContent('.auth-card .err')) && (await N.page.locator('.f-old').count()) === 0)
await N.page.screenshot({ path: `${OUT}/acc_n_notserver.png` })
check('không lỗi trang ở mọi máy', allErrs.length === 0, allErrs.slice(0, 4).join(' | '))
for (const ph of [P, PL, PM, PO]) rdel('acct:u:' + ph)
rdel('acct:e:' + E)
await browser.close()
const fails = Object.entries(results).filter(([, v]) => v !== 'PASS')
console.log(fails.length ? `FAILED ${fails.length}/${Object.keys(results).length}: ` + fails.map(([k]) => k).join(' | ') : `ALL PASS ✓ (${Object.keys(results).length} checks)`)
