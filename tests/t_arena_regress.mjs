// Thử lại Thi đấu qua giao diện (các trò thường) sau khi thêm Scrabble + Xếp câu:
//  R1 phòng 2 bạn "Nghe – Viết" 1 phút: đếm ngược, thanh điểm, hết giờ, kết quả 2 máy giống nhau, vương miện, Ôn Tập ghi báo cáo
//  R2 thách đấu ngẫu nhiên: 1 phút không có ai -> Bạn AI (nhãn AI) vào, con thắng
//  R3 chưa gắn kho: không hiện thẻ Thi đấu và thẻ Scrabble
//  R4 kho hết lượt giữa ván Scrabble: báo "Thi đấu đang tạm nghỉ", thoát ván, không treo
import { pw, OUT_DIR } from './_env.mjs'
import { useRealFonts } from './fonts.mjs'
const OUT = OUT_DIR
const BASE = 'http://localhost:4192', SHIM = 'http://127.0.0.1:4199'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const browser = await pw.chromium.launch({ headless: true })
const results = {}
const check = (n, c, x = '') => { results[n] = c ? 'PASS' : 'FAIL'; console.log((c ? '  ✓ ' : '  ✗ ') + n + (c || !x ? '' : '  → ' + x)) }
const only = process.argv[2] || 'all'
async function kid({ id, name, icon, grade, base = BASE, width = 390, height = 844 }) {
  const ACC = { username: '09' + id, password: '1', phone: '09' + id, parentPass: '1', plan: 1, pin: '3', children: [{ id, name, pin: '', icon, grade }] }
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 2 })
  await useRealFonts(ctx)
  await ctx.addInitScript(({ ACC, id }) => {
    if (window.top !== window) return
    if (sessionStorage.getItem('s')) return; sessionStorage.setItem('s', '1'); localStorage.clear()
    localStorage.setItem('ontap.account.v1', JSON.stringify(ACC)); localStorage.setItem('ontap.session.v1', '1'); localStorage.setItem('ontap.activechild.v1', id)
  }, { ACC, id })
  const page = await ctx.newPage()
  const errs = []
  page.on('pageerror', (e) => errs.push('pageerror: ' + e.message))
  page.on('console', (m) => { if (m.type() === 'error' && !/favicon|fonts\.g|status of 503/.test(m.text())) errs.push('console: ' + m.text()) })
  await page.goto(base + '/', { waitUntil: 'networkidle' })
  await page.click('.kh-cta')
  await page.locator('button:has-text("Tiếng Anh")').first().click()
  await page.click('.cr-vocab')
  await page.waitForSelector('iframe.spelling-frame')
  let fr = null
  for (let i = 0; i < 50 && !fr; i++) { fr = page.frames().find((x) => x.url().includes('/spelling/')); if (!fr) await sleep(100) }
  await fr.waitForSelector('.home .setcard .name')
  return { ctx, page, fr, errs, name }
}
const A_ = (k, f) => k.fr.evaluate(f)
async function playBee(k, maxMs = 90000) {
  const end = Date.now() + maxMs
  let n = 0
  while (Date.now() < end) {
    const st = await A_(k, () => ({ view: S.view, w: G && G.cur ? G.cur.w : null, f: !!(window.Arena._A.play && window.Arena._A.play.f) }))
    if (st.f) break
    if (st.view !== 'game' || !st.w) { await sleep(150); continue }
    n++
    try { await k.fr.fill('#g-in', st.w); await k.fr.press('#g-in', 'Enter') } catch { /* hết giờ */ }
    await k.fr.waitForFunction((prev) => !G || !G.cur || G.cur.w !== prev || S.view !== 'game', st.w, { timeout: 5000 }).catch(() => {})
  }
  return n
}
const waitStatus = (k, s, timeout = 15000) => k.fr.waitForFunction((x) => window.Arena._A.st && window.Arena._A.st.status === x, s, { timeout })

if (only === 'all' || only === 'r1') {
  console.log('— R1. Phòng 2 bạn, Nghe – Viết 1 phút')
  const A = await kid({ id: 'kidR1a', name: 'Alex', icon: '🦊', grade: 'Lớp 7' }), B = await kid({ id: 'kidR1b', name: 'Bin', icon: '🐻', grade: 'Lớp 4' })
  await A.fr.waitForSelector('.arena-entry:not(.sbe)'); await A.fr.click('.arena-entry:not(.sbe)'); await A.fr.waitForSelector('.ar-cards')
  check('menu Thi đấu có 3 lựa chọn (Scrabble đã chuyển vào danh sách trò chơi)', (await A.fr.locator('.ar-card').count()) === 3 && !(await A.fr.textContent('.ar-cards')).includes('Scrabble'))
  await A.fr.click('[data-arena="create"]'); await A.fr.waitForSelector('.ar-digits')
  const code = (await A.fr.textContent('.ar-digits')).replace(/\D/g, '')
  check('danh sách trò trong phòng có "Xếp câu" và "Scrabble"', /Xếp câu/.test(await A.fr.textContent('#ar-game')) && /Scrabble/.test(await A.fr.textContent('#ar-game')))
  await B.fr.waitForSelector('.arena-entry:not(.sbe)'); await B.fr.click('.arena-entry:not(.sbe)'); await B.fr.waitForSelector('.ar-cards')
  await B.fr.click('[data-arena="joinform"]'); await B.fr.fill('#ar-code', code); await B.fr.click('[data-arena="join"]')
  await A.fr.waitForFunction(() => document.querySelectorAll('#ar-players .ar-pl').length === 2, null, { timeout: 8000 })
  await A.fr.selectOption('#ar-game', 'bee'); await A.fr.selectOption('#ar-min', '1'); await A.fr.fill('#ar-req', 'Fruits')
  await A.fr.waitForFunction(() => /Fruits/.test(document.querySelector('#ar-rule').textContent) && window.Arena._A.st.cfg.minutes === 1, null, { timeout: 6000 })
  // đổi sang Scrabble rồi đổi lại: bảng số phút đổi theo
  await A.fr.selectOption('#ar-game', 'scrabble')
  await A.fr.waitForFunction(() => document.querySelector('#ar-min') && document.querySelector('#ar-min').value === '20' && !document.querySelector('#ar-req'), null, { timeout: 6000 })
  check('chọn Scrabble: ẩn phạm vi từ, thời gian cả ván 20 phút', true)
  await A.fr.selectOption('#ar-game', 'bee')
  await A.fr.waitForFunction(() => document.querySelector('#ar-req') && window.Arena._A.st.cfg.game === 'bee', null, { timeout: 6000 })
  await A.fr.selectOption('#ar-min', '1')
  await A.fr.waitForFunction(() => window.Arena._A.st.cfg.minutes === 1, null, { timeout: 6000 })
  await A.fr.click('[data-arena="start"]')
  await Promise.all([waitStatus(A, 'playing'), waitStatus(B, 'playing')])
  await Promise.all([A.fr.waitForSelector('#ar-bar', { timeout: 12000 }), B.fr.waitForSelector('#ar-bar', { timeout: 12000 })])
  check('trong ván: thanh trên có đồng hồ + điểm của cả hai bạn', /⏱/.test(await A.fr.textContent('#ar-bar')) && /Bin/.test(await A.fr.textContent('#ar-bar')))
  const [na, nb] = await Promise.all([playBee(A), playBee(B, 20000)])
  await Promise.all([waitStatus(A, 'results', 30000), waitStatus(B, 'results', 30000)])
  const ra = await A_(A, () => window.Arena._A.st.last.rank.map((r) => r.n + ':' + r.p).join(','))
  const rb = await A_(B, () => window.Arena._A.st.last.rank.map((r) => r.n + ':' + r.p).join(','))
  check('hết giờ: kết quả ván giống nhau ở hai máy, Alex nhất', ra === rb && ra.startsWith('Alex:'), ra + ' | ' + rb)
  const stA = JSON.parse(await A.page.evaluate(() => localStorage.getItem('ontap.stats.v2::kidR1a')) || '{}')
  check('Ôn Tập ghi buổi thi vào báo cáo Tiếng Anh', (Object.values(stA.log || {})[0] || {})['Tiếng Anh'] && na > 3)
  await A.fr.click('[data-arena="finish"]')
  await Promise.all([A.fr.waitForSelector('.ar-final', { timeout: 8000 }), B.fr.waitForSelector('.ar-final', { timeout: 8000 })])
  check('cuối buổi: trao vương miện cho Alex ở cả hai máy', (await A.fr.textContent('.ar-winner')).includes('Alex') && (await B.fr.textContent('.ar-winner')).includes('Alex'))
  check('R1 không lỗi trang', A.errs.length === 0 && B.errs.length === 0, A.errs.concat(B.errs).join(' | '))
  await A.fr.click('[data-arena="leave"]'); await A.fr.click('[data-arena="leaveyes"]')
  await A.ctx.close(); await B.ctx.close()
  void nb
}

if (only === 'all' || only === 'r2') {
  console.log('— R2. Thách đấu ngẫu nhiên: 1 phút không có ai -> Bạn AI')
  const C = await kid({ id: 'kidR2', name: 'Chi', icon: '🐰', grade: 'Lớp 3' })
  await C.fr.waitForSelector('.arena-entry:not(.sbe)'); await C.fr.click('.arena-entry:not(.sbe)'); await C.fr.waitForSelector('.ar-cards')
  await C.fr.click('[data-arena="randomform"]'); await C.fr.waitForSelector('#ar-rlevel')
  check('chọn trình độ mặc định theo lớp (lớp 3 -> tiểu học)', (await C.fr.inputValue('#ar-rlevel')) === 'k35')
  await C.fr.selectOption('#ar-rgame', 'scrabble')
  await C.fr.waitForFunction(() => document.querySelector('#ar-rmin').value === '20', null, { timeout: 4000 })
  check('chọn Scrabble ở thách đấu: thời gian đổi thành 20 phút', true)
  await C.fr.selectOption('#ar-rgame', 'bee')
  await C.fr.waitForFunction(() => document.querySelector('#ar-rmin').value === '2', null, { timeout: 4000 })
  await C.fr.selectOption('#ar-rmin', '1')
  await C.fr.click('[data-arena="random"]')
  await waitStatus(C, 'waiting')
  check('đang chờ: có đồng hồ + nói rõ sau 1 phút Bạn AI vào', /Bạn ONTAP vào thi sau/.test(await C.fr.textContent('#ar-waitnote')))
  await waitStatus(C, 'playing', 80000)
  check('sau 1 phút: Bạn AI vào thi, có ghi rõ là AI', await A_(C, () => window.Arena._A.st.players.some((p) => p.ai && /^Bạn ONTAP /.test(p.name))))
  await C.fr.waitForSelector('#ar-bar', { timeout: 12000 })
  await playBee(C)
  await waitStatus(C, 'results', 30000)
  const rank = await A_(C, () => window.Arena._A.st.last.rank.map((r) => ({ n: r.n, p: r.p, ai: r.ai })))
  check('Chi thắng Bạn AI', !rank[0].ai && rank[0].n === 'Chi' && rank[1].ai && rank[1].p < rank[0].p, JSON.stringify(rank))
  check('R2 không lỗi trang', C.errs.length === 0, C.errs.join(' | '))
  await C.fr.click('[data-arena="leave"]'); await C.fr.click('[data-arena="leaveyes"]')
  await C.ctx.close()
}

if (only === 'all' || only === 'r3') {
  console.log('— R3. Chưa gắn kho dữ liệu')
  const F = await kid({ id: 'kidR3', name: 'Phi', icon: '🐸', grade: 'Lớp 5', base: 'http://localhost:4193' })
  await sleep(1500)
  check('không hiện thẻ Thi đấu và thẻ Scrabble khi máy chủ chưa có kho', (await F.fr.locator('.arena-entry').count()) === 0 && (await F.fr.locator('.gcard.sbcard').count()) === 0)
  check('vẫn có trò "Xếp câu" (không cần kho)', (await F.fr.textContent('.ggrid')).includes('Xếp câu'))
  check('R3 không lỗi trang', F.errs.length === 0, F.errs.join(' | '))
  await F.ctx.close()
}

if (only === 'all' || only === 'r4') {
  console.log('— R4. Kho hết lượt giữa ván Scrabble')
  const limit = (on) => fetch(SHIM + '/limit/' + (on ? 'on' : 'off'), { method: 'POST' })
  const P = await kid({ id: 'kidR4', name: 'Phúc', icon: '🐯', grade: 'Lớp 6' })
  try {
    await P.fr.waitForSelector('.gcard.sbcard'); await P.fr.click('.gcard.sbcard'); await P.fr.waitForSelector('.sb-menu')
    await P.fr.click('[data-arena="solo"]'); await P.fr.waitForSelector('#sb-board', { timeout: 12000 })
    await limit(true)
    await P.fr.waitForFunction(() => (document.querySelector('.page.arena .err') || {}).textContent?.includes('Thi đấu đang tạm nghỉ'), null, { timeout: 12000 })
    const sp = await A_(P, () => ({ view: S.view, screen: window.Arena._A.screen, code: window.Arena._A.code }))
    check('hết lượt giữa ván Scrabble: báo "Thi đấu đang tạm nghỉ", về màn Scrabble (con vào từ thẻ Scrabble)', sp.view === 'arena' && sp.screen === 'sbmenu' && !sp.code, JSON.stringify(sp))
    await P.page.screenshot({ path: `${OUT}/r4_limit.png` })
    check('R4 không lỗi trang (ngoài lỗi 503 cố ý)', P.errs.length === 0, P.errs.join(' | '))
  } finally { await limit(false) }
  await P.ctx.close()
}

await browser.close()
const fails = Object.entries(results).filter(([, v]) => v !== 'PASS')
console.log(fails.length ? `${fails.length} FAILED: ` + fails.map(([k]) => k).join(' | ') : `ALL PASS ✓ (${Object.keys(results).length} checks)`)
