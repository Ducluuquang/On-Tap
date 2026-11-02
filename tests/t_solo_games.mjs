// Chơi một mình (không thi đấu) "Tìm từ" và "Lật thẻ" tới hết bàn: điểm + danh sách từ + báo cáo Ôn Tập vẫn đúng sau khi đổi cách ghi.
import { pw, OUT_DIR } from './_env.mjs'
import { useRealFonts } from './fonts.mjs'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const browser = await pw.chromium.launch({ headless: true })
const results = {}; const check = (n, c, x = '') => { results[n] = c ? 'PASS' : 'FAIL'; console.log((c ? '  ✓ ' : '  ✗ ') + n + (c || !x ? '' : '  → ' + x)) }
const id = 'kidSolo', ACC = { username: '09' + id, password: '1', phone: '09' + id, parentPass: '1', plan: 1, pin: '3', children: [{ id, name: 'Su', pin: '', icon: '🐱', grade: 'Lớp 4' }] }
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } })
await useRealFonts(ctx)
await ctx.addInitScript(({ ACC, id }) => { if (window.top !== window) return; if (sessionStorage.getItem('s')) return; sessionStorage.setItem('s', '1'); localStorage.clear(); localStorage.setItem('ontap.account.v1', JSON.stringify(ACC)); localStorage.setItem('ontap.session.v1', '1'); localStorage.setItem('ontap.activechild.v1', id) }, { ACC, id })
const page = await ctx.newPage(); const errs = []
page.on('pageerror', (e) => errs.push(e.message))
await page.goto('http://localhost:4192/', { waitUntil: 'networkidle' })
await page.click('.kh-cta'); await page.locator('button:has-text("Tiếng Anh")').first().click(); await page.click('.cr-vocab')
await page.waitForSelector('iframe.spelling-frame')
let fr = null; for (let i = 0; i < 50 && !fr; i++) { fr = page.frames().find((x) => x.url().includes('/spelling/')); if (!fr) await sleep(100) }
await fr.waitForSelector('.home .setcard .name')
const stats = async () => { const st = JSON.parse(await page.evaluate((k) => localStorage.getItem(k), 'ontap.stats.v2::' + id) || '{}'); return (Object.values(st.log || {})[0] || {})['Tiếng Anh'] || { reviewed: 0, correct: 0 } }
// Tìm từ: tìm 2 từ rồi "Chịu, xem đáp án" -> Xem điểm
await fr.click('.gcard:has-text("Tìm từ")'); await fr.waitForSelector('#ws-grid')
const info = await fr.evaluate(() => ({ n: Math.round(Math.sqrt(document.querySelectorAll('#ws-grid .c').length)), cells: [...document.querySelectorAll('#ws-grid .c')].map((c) => c.textContent), list: [...document.querySelectorAll('#ws-list span')].map((s) => s.textContent) }))
const N = info.n, at = (r, c) => info.cells[r * N + c]
let found = 0
for (const w of info.list.slice(0, 2)) {
  const W = w.replace(/[^a-z]/gi, '').toUpperCase(); let hit = null
  for (let r = 0; r < N && !hit; r++) for (let c = 0; c < N && !hit; c++) for (const [dr, dc] of [[0, 1], [1, 0], [1, 1]]) { let ok = true; for (let k = 0; k < W.length; k++) { const rr = r + dr * k, cc = c + dc * k; if (rr >= N || cc >= N || at(rr, cc) !== W[k]) { ok = false; break } } if (ok) { hit = [r * N + c, (r + dr * (W.length - 1)) * N + c + dc * (W.length - 1)]; break } }
  if (hit) { await fr.click(`#ws-grid [data-c="${hit[0]}"]`); await fr.click(`#ws-grid [data-c="${hit[1]}"]`); found++; await sleep(250) }
}
await fr.click('#ws-give'); await fr.click('#ws-end')
await fr.waitForFunction(() => S.view === 'result', null, { timeout: 5000 })
const rs = await fr.evaluate(() => ({ score: S.result.score, items: S.result.items.length, ok: S.result.items.filter((i) => i.credit >= 1).length, total: G === null }))
check(`Tìm từ (chơi một mình): tìm ${found}/${info.list.length} từ -> điểm ${rs.score}, đủ ${info.list.length} từ trong kết quả`, rs.items === info.list.length && rs.ok === found && rs.score === Math.round(20 * found / info.list.length) / 2, JSON.stringify(rs))
let s1 = await stats()
check('Tìm từ: Ôn Tập ghi đúng số từ / số đúng', s1.reviewed === info.list.length && s1.correct === found, JSON.stringify(s1))
// Lật thẻ: lật hết các cặp
await fr.click('[data-act="home"]'); await fr.waitForSelector('.ggrid')
await fr.click('.gcard:has-text("Lật thẻ")'); await fr.waitForSelector('.mem')
const pool = await fr.evaluate(() => G.words.slice(0, 6).map((w) => ({ w: w.w, vi: w.vi })))
for (const p of pool) {
  const idx = await fr.evaluate((p) => { const cards = [...document.querySelectorAll('.mem .card')]; const a = cards.findIndex((c) => !c.classList.contains('done') && c.querySelector('.f').textContent.trim() === p.w); const b = cards.findIndex((c, i) => i !== a && !c.classList.contains('done') && c.querySelector('.f').textContent.includes(p.vi || p.w)); return [a, b] }, p)
  await fr.click(`.mem [data-card="${idx[0]}"]`); await fr.click(`.mem [data-card="${idx[1]}"]`); await sleep(1100)
}
await fr.waitForFunction(() => S.view === 'result', null, { timeout: 6000 })
const rm = await fr.evaluate(() => ({ score: S.result.score, items: S.result.items.length, ok: S.result.items.filter((i) => i.credit >= 1).length }))
check(`Lật thẻ (chơi một mình): lật hết ${pool.length} cặp -> 10 điểm, ${pool.length} từ trong kết quả`, rm.score === 10 && rm.items === pool.length && rm.ok === pool.length, JSON.stringify(rm))
const s2 = await stats()
check('Lật thẻ: Ôn Tập cộng thêm đúng số từ', s2.reviewed === s1.reviewed + pool.length && s2.correct === s1.correct + pool.length, JSON.stringify(s2))
check('không lỗi trang', errs.length === 0, errs.join(' | '))
await browser.close()
const fails = Object.entries(results).filter(([, v]) => v !== 'PASS')
console.log(fails.length ? `${fails.length} FAILED` : `ALL PASS ✓ (${Object.keys(results).length} checks)`)
