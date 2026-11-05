// ĐỒNG BỘ DỮ LIỆU HỌC GIỮA CÁC MÁY qua giao diện thật (05/11/2026). Mỗi "máy" một trình duyệt riêng (kho riêng).
//  1  Máy A (máy con học từ trước, có sẵn bài học + giờ học) đăng nhập -> dữ liệu tự lên máy chủ.
//  2  Máy B (điện thoại phụ huynh, chưa có gì) đăng nhập, chọn con -> thấy đúng bài học, môn cần ôn, giờ học.
//  3  A ôn 10 câu ("Ôn ngay") -> B mở lại app thấy 10 câu vừa ôn + điểm Phân số; giờ học không cộng trùng.
//  4  B (phụ huynh) đổi mục tiêu 15 -> 20 phút -> A mở lại app thấy "học đủ 20 phút".
//  5  A tạo bộ từ trong Vở Spelling -> B mở Vở Spelling thấy bộ từ đó.
//  6  B "Xoá hết dữ liệu & làm lại từ đầu" -> A mở lại app: trống, học lại từ đầu.
import { pw, OUT_DIR } from './_env.mjs'
import { useRealFonts } from './fonts.mjs'
const OUT = OUT_DIR
const BASE = process.env.BASE || 'http://localhost:4192'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const browser = await pw.chromium.launch({ headless: true })
const results = {}
const check = (n, c, x = '') => { results[n] = c ? 'PASS' : 'FAIL'; console.log((c ? '  ✓ ' : '  ✗ ') + n + (c || !x ? '' : '  → ' + x)) }
const RUN = String(Date.now()).slice(-6)
const P = '0915' + RUN, PASS = '12345678', KID = 'kidD' + RUN
const iso = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10) }
const TODAY = iso(0)
async function api(action, body = {}, token = '') {
  const r = await fetch(BASE + '/api/account', { method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': '10.6.' + (Number(RUN) % 250) + '.' + (1 + Math.floor(Math.random() * 200)), ...(token ? { authorization: 'Bearer ' + token } : {}) }, body: JSON.stringify({ action, ...body }) })
  return r.json()
}
const reg = await api('register', { phone: P, pass: PASS, parentName: 'Ba An', plan: 1, pin: '3', children: [{ id: KID, name: 'An', pin: '7', icon: '🦊', grade: 'Lớp 5' }] })
const TOKEN = reg.token
const srvDoc = async () => (await api('data', { child: KID, rev: 0 }, TOKEN)).doc

// dữ liệu học CŨ trên máy A (học từ trước khi có đồng bộ)
const c = (id, name, subject, kind) => ({ id: id + RUN, name, subject, topic: name, difficulty: 'Cơ bản', importance: 'Quan trọng', details: [], learnedOn: iso(3), updatedAt: Date.now() - 86400000, learnedInApp: true,
  ...(kind === 'weak' ? { mastery: 50, pts: 50, hist: '1010', reviews: 2, correct: 2, wrong: 2 } : kind === 'new' ? { mastery: 0, pts: 0, hist: '', reviews: 0, correct: 0, wrong: 0 } : { mastery: 90, pts: 90, hist: '1111111111', reviews: 5, correct: 10, wrong: 0 }) })
const MEM_A = [c('ps', 'Phân số', 'Toán', 'weak'), c('stp', 'Số thập phân', 'Toán', 'new'), c('htd', 'Thì hiện tại đơn', 'Tiếng Anh', 'weak'), c('nt', 'Nhà Trần', 'Lịch sử', 'ok')]
const STATS_A = { goalMin: 15, days: { [iso(1)]: 900, [TODAY]: 300 }, log: { [TODAY]: { 'Toán': { reviewed: 5, correct: 3, wrong: 2, sec: 300 } } } }

const allErrs = []
async function device(name, seed = null) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 })
  await useRealFonts(ctx)
  if (seed) await ctx.addInitScript((kv) => { if (window.top !== window) return; if (sessionStorage.getItem('s')) return; sessionStorage.setItem('s', '1'); localStorage.clear(); for (const [k, v] of Object.entries(kv)) localStorage.setItem(k, v) }, seed)
  // AI giả cho "Ôn ngay": 12 câu trắc nghiệm Phân số (đáp án đúng = lựa chọn đầu)
  await ctx.route('**/api/ai', (r) => r.fulfill({ contentType: 'application/json', body: JSON.stringify({ questions: Array.from({ length: 12 }, (_, i) => ({ q: `Câu ${i + 1}: ${i + 2}/${i + 5} rút gọn được không? (${RUN}-${i})`, options: ['Có', 'Không', 'Chưa biết', 'Tuỳ'], answer: 0, explain: 'Xét ước chung.', concept: 'Phân số' })) }) }))
  const page = await ctx.newPage()
  page.on('pageerror', (e) => allErrs.push(name + ' pageerror: ' + e.message))
  page.on('console', (m) => { if (m.type() === 'error' && !/favicon|fonts\.g|status of 4\d\d/.test(m.text())) allErrs.push(name + ' console: ' + m.text()) })
  await page.goto(BASE + '/', { waitUntil: 'networkidle' })
  return { name, ctx, page }
}
const ls = (d, k) => d.page.evaluate((k) => localStorage.getItem(k), k)
const lsJ = async (d, k, fb) => { const v = await ls(d, k); return v == null ? fb : JSON.parse(v) }
const memOf = (d) => lsJ(d, 'ontap.memory.v2::' + KID, [])
const statsOf = (d) => lsJ(d, 'ontap.stats.v2::' + KID, { days: {}, log: {} })
async function until(fn, ms = 15000, step = 300) { const t0 = Date.now(); for (;;) { const v = await fn(); if (v) return v; if (Date.now() - t0 > ms) return v; await sleep(step) } }
async function login(d) {
  if (await d.page.locator('.auth-landing').count()) await d.page.click('.auth-landing button:has-text("Đăng nhập")')
  await d.page.fill('input[placeholder="Số điện thoại hoặc email"]', P)
  await d.page.fill('input[placeholder="Mật khẩu 8 số"]', PASS)
  await d.page.click('.auth-card button.cta:has-text("Đăng nhập")')
  await d.page.waitForSelector('.pick-grid', { timeout: 10000 })
  await d.page.click('.pick-card:has-text("An")')
  await d.page.fill('.pick-pinbox input', '7'); await d.page.click('.pick-pinbox button.cta')
  await d.page.waitForSelector('.kh-cta', { timeout: 10000 })
}
async function reopen(d) { await d.page.reload({ waitUntil: 'networkidle' }); await d.page.waitForSelector('.kh-cta', { timeout: 10000 }) }
async function parentSettings(d) {
  await d.page.click('.ds-seg button:has-text("Phụ huynh")')
  await d.page.waitForSelector('.modal input', { timeout: 5000 })
  await d.page.fill('.modal input.pin-in', '3'); await d.page.click('.modal .modal-btns .cta:not(.ghost)')
  await d.page.click('button:has-text("Mục tiêu")')
  await d.page.waitForSelector('.set-sec', { timeout: 5000 })
}
const tiles = (d) => d.page.$$eval('.kh .sj-tile', (els) => els.map((e) => e.querySelector('b').textContent + ':' + e.querySelector('small').textContent))

// ======== 1. A đăng nhập -> dữ liệu cũ lên máy chủ ========
console.log('— 1. Máy A (có dữ liệu cũ) đăng nhập')
const A = await device('A', { ['ontap.memory.v2::' + KID]: JSON.stringify(MEM_A), ['ontap.stats.v2::' + KID]: JSON.stringify(STATS_A) })
await login(A)
const d1 = await until(async () => { const d = await srvDoc(); return d && Object.keys(d.mem.items).length === 4 ? d : null })
const secs = (doc) => Object.values((doc && doc.dev) || {}).reduce((s, e) => s + ((e.days || {})[TODAY] || 0), 0)
check('máy A đăng nhập -> bài học (4 chủ đề) + giờ học (300 giây hôm nay) tự lên máy chủ', !!d1 && secs(d1) === 300, JSON.stringify(d1 || {}).slice(0, 200))

// ======== 2. B (chưa có gì) đăng nhập -> thấy dữ liệu của A ========
console.log('— 2. Máy B (điện thoại phụ huynh) đăng nhập')
const B = await device('B')
await login(B)
const bm = await until(async () => { const m = await memOf(B); return m.length === 4 ? m : null })
await sleep(400)
const bt = await tiles(B)
check('máy B: thấy đủ 4 chủ đề của A; trang chủ: Toán 2 cần ôn, Tiếng Anh 1, Lịch sử đã vững', !!bm && bt.includes('Toán:2 cần ôn') && bt.includes('Tiếng Anh:1 cần ôn') && bt.some((t) => t.startsWith('Lịch sử:')), JSON.stringify(bt))
const bs = await statsOf(B)
check('máy B: giờ học hôm qua 900 giây, hôm nay 300 giây + nhật ký 5 câu Toán', bs.days[iso(1)] === 900 && bs.days[TODAY] === 300 && bs.log[TODAY]['Toán'].reviewed === 5, JSON.stringify(bs))
await B.page.screenshot({ path: `${OUT}/data_b_home.png` })

// ======== 3. A ôn 10 câu -> B thấy ========
console.log('— 3. Máy A ôn 10 câu "Ôn ngay"')
await A.page.click('.kh-cta'); await A.page.waitForSelector('.cr-hero-cta')
await A.page.click('.cr-hero-cta')
await A.page.waitForSelector('.opts .opt', { timeout: 20000 })
for (let i = 0; i < 10; i++) {
  await A.page.locator('.opts .opt').first().click()
  await A.page.locator('button:has-text("Câu tiếp theo"), button:has-text("Xem kết quả")').first().click()
}
await A.page.waitForSelector('.screen', { timeout: 5000 })
const aStats = await until(async () => { const s = await statsOf(A); return s.log[TODAY] && s.log[TODAY]['Toán'].reviewed === 15 ? s : null }, 5000)
const d3 = await until(async () => { const d = await srvDoc(); return d && Object.values(d.dev).some((e) => (e.log[TODAY] || {})['Toán'] && e.log[TODAY]['Toán'].reviewed === 15) ? d : null }, 15000)
check('A ôn xong 10 câu -> sau vài giây máy chủ có 15 câu Toán hôm nay (5 cũ + 10 mới)', !!aStats && !!d3, JSON.stringify(d3 ? d3.dev : null).slice(0, 300))
await reopen(B)
const bs3 = await until(async () => { const s = await statsOf(B); return s.log[TODAY] && s.log[TODAY]['Toán'].reviewed === 15 ? s : null })
const bps = (await memOf(B)).find((x) => x.name === 'Phân số'), aps = (await memOf(A)).find((x) => x.name === 'Phân số')
check('B mở lại app -> nhật ký hôm nay 15 câu Toán; kết quả Phân số giống hệt A (thêm 10 câu: đúng + sai = 14)', !!bs3 && !!bps && !!aps && bps.correct === aps.correct && bps.wrong === aps.wrong && bps.correct + bps.wrong === 14 && bps.mastery === aps.mastery, JSON.stringify({ log: bs3 && bs3.log[TODAY], b: bps && [bps.correct, bps.wrong, bps.mastery], a: aps && [aps.correct, aps.wrong, aps.mastery] }))
const secA = (await statsOf(A)).days[TODAY], secB = (await statsOf(B)).days[TODAY]
check(`giờ học hôm nay giống nhau ở hai máy (${secA} = ${secB} giây) và không cộng trùng (đúng = máy chủ)`, secA === secB && secA === secs(await srvDoc()) && secA >= 300, `${secA} ${secB}`)   // bài ôn tự động rất nhanh: có khi chỉ thêm 0–2 giây

// ======== 4. B đổi mục tiêu 15 -> 20 phút -> A thấy ========
console.log('— 4. Phụ huynh (máy B) đổi mục tiêu')
await parentSettings(B)
await B.page.locator('.goal-btn').nth(1).click()
const g4 = await until(async () => { const d = await srvDoc(); return d && d.goal && d.goal.v === 20 ? d.goal : null })
await B.page.screenshot({ path: `${OUT}/data_b_settings.png` })
const syncLine = await B.page.locator('.set-sec .set-sync').last().textContent().catch(() => '')
check('B: mục tiêu 20 phút lên máy chủ; Cài đặt ghi "Bài học, báo cáo, bộ từ của An có trên mọi máy"', !!g4 && /có trên mọi máy/.test(syncLine), syncLine)
await reopen(A)
const goalA = await until(async () => /học đủ 20 phút/.test(await A.page.textContent('.kh-goal')) || null, 10000)
check('A mở lại app -> "Mục tiêu: học đủ 20 phút"', !!goalA, await A.page.textContent('.kh-goal'))

// ======== 5. A tạo bộ từ trong Vở Spelling -> B thấy ========
console.log('— 5. Vở Spelling: A tạo bộ từ')
async function openSpelling(d) {
  await d.page.click('.kh-cta')
  await d.page.locator('button:has-text("Tiếng Anh")').first().click()
  await d.page.click('.cr-vocab')
  await d.page.waitForSelector('iframe.spelling-frame')
  let fr = null
  for (let i = 0; i < 50 && !fr; i++) { fr = d.page.frames().find((x) => x.url().includes('/spelling/')); if (!fr) await sleep(100) }
  await fr.waitForSelector('#view .home, #view .page', { timeout: 10000 })
  return fr
}
const fa = await openSpelling(A)
await fa.click('[data-act="new"]')
await fa.waitForSelector('#c-text')
// từ riêng của lần chạy: chỉ chữ cái (Vở Spelling bỏ từ có chữ số)
const UNIQ = 'zq' + RUN.split('').map((d) => 'abcdefghij'[Number(d)]).join('')
await fa.fill('#c-text', `sun, moon, ${UNIQ}`)
if (await fa.locator('#c-enrich').count()) await fa.uncheck('#c-enrich')
await fa.click('#c-go')
await fa.waitForSelector('#c-save', { timeout: 10000 })
await fa.click('#c-save')
await until(async () => { const s = await lsJ(A, 'ontap.spelling.v1::' + KID, null); return s && s.sets.some((x) => x.words.some((w) => w.w === UNIQ)) }, 8000)
// về Ôn Tập (nút ‹ của Vở Spelling) -> gửi bộ từ lên
await fa.click('#exitbtn').catch(async () => { await A.page.click('.ds-seg button:has-text("Con")') })
const d5 = await until(async () => { const d = await srvDoc(); return d && d.spell && Object.values(d.spell.sets).some((s) => (s.words || []).some((w) => w.w === UNIQ)) ? d : null })
check('A tạo bộ từ (sun, moon, ' + UNIQ + ') rồi rời Vở Spelling -> bộ từ lên máy chủ', !!d5)
await reopen(B)
const fb = await openSpelling(B)
const bSet = await until(async () => { const s = await lsJ(B, 'ontap.spelling.v1::' + KID, null); return s && s.sets.find((x) => x.words.some((w) => w.w === UNIQ)) }, 10000)
await sleep(300)
const homeB = await fb.textContent('#view')
check('B mở Vở Spelling -> có bộ từ A vừa tạo (sun, moon, ' + UNIQ + '), tên bộ hiện ở trang chính', !!bSet && homeB.includes(bSet.name) && ['sun', 'moon', UNIQ].every((x) => bSet.words.some((w) => w.w === x)), (bSet ? bSet.name + ' | ' : 'không có bộ | ') + homeB.slice(0, 200))
await B.page.screenshot({ path: `${OUT}/data_b_spelling.png` })

// ======== 6. B xoá hết dữ liệu -> A trống ========
console.log('— 6. Phụ huynh xoá hết dữ liệu & làm lại từ đầu')
await reopen(B)
await parentSettings(B)
await B.page.click('button:has-text("Xoá hết dữ liệu")')
await B.page.click('button:has-text("Xoá & làm lại")')
await sleep(400)
if (await B.page.locator('.modal input.pin-in').count()) { await B.page.fill('.modal input.pin-in', '3'); await B.page.click('.modal .modal-btns .cta:not(.ghost)') }   // khu vực phụ huynh đã mở khoá thì không hỏi lại PIN
const d6 = await until(async () => { const d = await srvDoc(); return d && d.resetAt > 0 && !Object.keys(d.mem.items).length && secs(d) === 0 ? d : null })
check('B xoá hết dữ liệu -> máy chủ trống (bài học, giờ học), có mốc "làm lại từ đầu"', !!d6, JSON.stringify(d6 || {}).slice(0, 200))
await reopen(A)
const aEmpty = await until(async () => { const m = await memOf(A), s = await statsOf(A); return !m.length && !Object.keys(s.days || {}).length ? true : null })
check('A mở lại app -> cũng trống (không còn chủ đề, giờ học)', !!aEmpty && /Thêm bài học đầu tiên/.test(await A.page.textContent('.kh')), await A.page.textContent('.kh-today').catch(() => ''))

check('không lỗi trang trên cả hai máy', allErrs.length === 0, allErrs.join(' | '))
await browser.close()
const fails = Object.entries(results).filter(([, v]) => v !== 'PASS')
console.log(fails.length ? `FAILED ${fails.length}/${Object.keys(results).length}: ` + fails.map(([k]) => k).join(' | ') : `ALL PASS ✓ (${Object.keys(results).length} checks)`)
