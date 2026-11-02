// Luật nhà qua giao diện thật (Scrabble với Bạn ONTAP, điện thoại 390px), làm lại đúng cảnh trong ảnh anh gửi:
//  26/10: bàn có FLARE, COAX, MILE, MA; giá P A D U G T J; chạm đặt P-A-D dọc + U-G ngang rồi bấm "Đặt từ".
//  31/10: bàn có HAIRIER, IDOL, EEL; giá P E D F O Y F; đặt PEELED (cột) + FOR (hàng 9) ở HAI CHỖ trong một lượt.
import { pw, OUT_DIR } from './_env.mjs'
import { execFileSync } from 'node:child_process'
import { useRealFonts } from './fonts.mjs'
const OUT = OUT_DIR
const BASE = 'http://localhost:4192'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const browser = await pw.chromium.launch({ headless: true })
const results = {}
const check = (n, c, x = '') => { results[n] = c ? 'PASS' : 'FAIL'; console.log((c ? '  ✓ ' : '  ✗ ') + n + (c || !x ? '' : '  → ' + x)) }
const rget = (k) => execFileSync('redis-cli', ['-p', '6390', '--raw', 'GET', k]).toString().trim()
const rset = (k, v) => execFileSync('redis-cli', ['-p', '6390', 'SET', k, v, 'EX', '3600']).toString().trim()
const N = 15, at = (r, c) => r * N + c
function board(list) { const b = '.'.repeat(225).split(''); for (const [r, c, w, d] of list) [...w].forEach((ch, k) => { b[d === 'h' ? at(r, c + k) : at(r + k, c)] = ch }); return b.join('') }
const B1 = board([[7, 5, 'FLARE', 'h'], [5, 7, 'COAX', 'v'], [4, 9, 'MILE', 'v'], [4, 9, 'MA', 'h']])
const RUN = Date.now().toString(36).slice(-4)

async function kid({ id, name, icon, grade }) {
  id = id + RUN
  const ACC = { username: '09' + id, password: '1', phone: '09' + id, parentPass: '1', plan: 1, pin: '3', children: [{ id, name, pin: '', icon, grade }] }
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })
  await useRealFonts(ctx)
  await ctx.addInitScript(({ ACC, id }) => {
    if (window.top !== window) return
    if (sessionStorage.getItem('s')) return; sessionStorage.setItem('s', '1'); localStorage.clear()
    localStorage.setItem('ontap.account.v1', JSON.stringify(ACC)); localStorage.setItem('ontap.session.v1', '1'); localStorage.setItem('ontap.activechild.v1', id)
  }, { ACC, id })
  const page = await ctx.newPage()
  const errs = []
  page.on('pageerror', (e) => errs.push('pageerror: ' + e.message))
  page.on('console', (m) => { if (m.type() === 'error' && !/favicon|fonts\.g|status of 4(09|22)/.test(m.text())) errs.push('console: ' + m.text()) })
  await page.goto(BASE + '/', { waitUntil: 'networkidle' })
  await page.click('.kh-cta')
  await page.locator('button:has-text("Tiếng Anh")').first().click()
  await page.click('.cr-vocab')
  await page.waitForSelector('iframe.spelling-frame')
  let fr = null
  for (let i = 0; i < 50 && !fr; i++) { fr = page.frames().find((x) => x.url().includes('/spelling/')); if (!fr) await sleep(100) }
  await fr.waitForSelector('.home .setcard .name')
  return { ctx, page, fr, errs }
}
const ev = (k, f, a) => k.fr.evaluate(f, a)
const sbState = (k) => ev(k, () => { const st = window.Arena._A.st; return st && st.round && st.round.sb ? { ...st.round.sb, me: st.me, code: st.code, n: st.round.n } : null })
async function tap(k, cells) {   // chạm chữ trên giá rồi chạm ô
  const rack = (await sbState(k)).rack, used = new Set()
  for (const [r, c, l] of cells) {
    const x = [...rack].findIndex((ch, j) => ch === l && !used.has(j)); used.add(x)
    await k.fr.click(`[data-sbr="${x}"]`); await k.fr.click(`[data-sbc="${at(r, c)}"]`)
  }
}

console.log('— Scrabble: ghép nhiều từ trong một lượt (cảnh trong ảnh anh gửi)')
const A = await kid({ id: 'kidMW', name: 'Alex', icon: '🦊', grade: 'Lớp 7' })
await A.fr.waitForSelector('.gcard.sbcard', { timeout: 8000 })
await A.fr.click('.gcard.sbcard'); await A.fr.waitForSelector('.sb-menu')
const rules = await A.fr.textContent('.sb-rules')
check('luật chơi ghi rõ: một lượt ghép được nhiều từ, một chỗ (hình chữ L) hay nhiều chỗ, mỗi từ chạm chữ có sẵn; luật chuẩn chỉ một hàng', /nhiều từ cùng lúc/.test(rules) && /hình chữ L/.test(rules) && /nhiều chỗ khác nhau/.test(rules) && /chạm vào chữ đã có trên bàn/.test(rules) && !/nối liền/.test(rules) && /một hàng ngang hoặc một cột dọc/.test(rules) && /100 quân/.test(rules), rules)
await A.fr.click('[data-arena="solo"]')
await A.fr.waitForSelector('#sbp')
const note = await A.fr.textContent('#sbp').catch(() => '')
check('màn đếm ngược nhắc: ghép được nhiều từ ở nhiều chỗ, mỗi từ chạm chữ có sẵn', /nhiều từ ở nhiều chỗ, mỗi từ chạm vào chữ có sẵn/.test(note) && !/nối liền/.test(note), note.slice(0, 200))
await A.fr.waitForSelector('#sb-board', { timeout: 9000 })
await A.fr.waitForFunction(() => { const st = window.Arena._A.st; return st && Date.now() + window.Arena._A.offset >= st.round.start }, null, { timeout: 8000 })
// bày bàn cờ như ảnh (sửa trong kho), máy tự lấy về ở lần hỏi phòng sau
let s = await sbState(A)
const meta = JSON.parse(rget('arena:room:' + s.code))
const sb = meta.round.sb
sb.board = B1; sb.racks[s.me] = 'PADUGTJ'; sb.turn = sb.order.indexOf(s.me); sb.turnStart = Date.now(); sb.v++
rset('arena:room:' + s.code, JSON.stringify(meta))
await A.fr.waitForFunction((b) => { const x = window.Arena._A.st.round.sb; return x.board === b && x.rack === 'PADUGTJ' }, B1, { timeout: 8000 })
await A.fr.waitForFunction(() => document.querySelectorAll('#sb-rack .rk:not(.gone)').length === 7 && /Tới lượt con/.test(document.querySelector('#sb-st').textContent), null, { timeout: 8000 })
// 1) MAP + một chữ đứng lẻ (không ghép thành từ) -> báo lỗi, chữ vẫn nằm trên bàn để con sửa
await tap(A, [[4, 11, 'P'], [10, 2, 'A']])
await A.fr.click('[data-sb="play"]')
await A.fr.waitForFunction(() => /ghép vào một từ/.test(document.querySelector('#sb-msg').textContent), null, { timeout: 6000 })
check('một chữ đứng lẻ -> báo "Chữ nào con đặt cũng phải ghép vào một từ", không mất lượt', /Chữ nào con đặt cũng phải ghép vào một từ/.test(await A.fr.textContent('#sb-msg')) && (await A.fr.locator('#sb-board .t.pend').count()) === 2 && /Tới lượt con/.test(await A.fr.textContent('#sb-st')))
await A.fr.click('[data-sb="recall"]')
// 2) đặt như anh: P-A-D dọc + U-G ngang
await tap(A, [[4, 11, 'P'], [5, 11, 'A'], [6, 11, 'D'], [6, 12, 'U'], [6, 13, 'G']])
check('5 chữ vàng trên bàn (P-A-D dọc, U-G ngang), giá còn T và J', (await A.fr.locator('#sb-board .t.pend').count()) === 5 && (await A.fr.locator('#sb-rack .rk:not(.gone)').count()) === 2)
await A.page.screenshot({ path: `${OUT}/mw_before.png` })
await A.fr.click('[data-sb="play"]')
await A.fr.waitForFunction(() => /điểm!/.test(document.querySelector('#sb-msg')?.textContent || ''), null, { timeout: 8000 })
const msg = await A.fr.textContent('#sb-msg')
check('bấm "Đặt từ": nhận cả 2 từ, báo "PAD, DUG +19 điểm!"', msg.includes('PAD, DUG +19 điểm!'), msg)
s = await sbState(A)
check('điểm của con 19, bốc thêm đủ 7 chữ', s.scores[s.me] === 19 && s.rack.length === 7 && (await A.fr.locator('#sb-rack .rk:not(.gone)').count()) === 7, JSON.stringify({ sc: s.scores, rack: s.rack }))
const log = await A.fr.textContent('.sb-log')
check('nhật ký: "đặt PAD, DUG (+ MAP) +19"', /PAD, DUG\s*\(\+ MAP\)\s*\+19/.test(log), log)
await A.page.screenshot({ path: `${OUT}/mw_after.png` })
// Bạn AI đi tiếp bình thường
await A.fr.waitForFunction(() => { const x = window.Arena._A.st.round.sb; return x.order[x.turn] === window.Arena._A.st.me && x.moves.length >= 2 }, null, { timeout: 15000 })
s = await sbState(A)
const aiPid = s.order.find((p) => p !== s.me)
check('Bạn AI đi tiếp rồi tới lượt con; Bạn AI vẫn kém con', (s.scores[aiPid] || 0) < s.scores[s.me], JSON.stringify(s.scores))
// kết thúc ván: kết quả có PAD, DUG trong các từ của con
await A.fr.click('[data-sb="end"]'); await A.fr.click('[data-sb="endyes"]')
await A.fr.waitForSelector('.sb-res', { timeout: 10000 })
const resTxt = await A.fr.textContent('.page.arena')
check('kết quả ván: vương miện cho con, danh sách từ có PAD, DUG', (await A.fr.locator('.sb-res .ar-crown').count()) === 1 && /PAD/.test(resTxt) && /DUG/.test(resTxt), resTxt.slice(0, 200))
const stA = JSON.parse(await A.page.evaluate((id) => localStorage.getItem('ontap.stats.v2::' + id), 'kidMW' + RUN) || '{}')
const day = Object.values(stA.log || {})[0] || {}
check('Ôn Tập ghi 2 từ của lượt này (PAD, DUG) vào báo cáo', day['Tiếng Anh'] && day['Tiếng Anh'].reviewed >= 2, JSON.stringify(day))
check('không lỗi trang', A.errs.length === 0, A.errs.join(' | '))
await A.fr.click('[data-arena="leave"]'); await A.fr.click('[data-arena="leaveyes"]')

// ======== 31/10: đúng cảnh trong ảnh anh gửi — PEELED + FOR ở hai chỗ ========
console.log('— Scrabble: đặt từ ở hai chỗ trong một lượt (cảnh trong ảnh anh gửi 31/10)')
const BU = board([[3, 6, 'HAIRIER', 'v'], [7, 6, 'IDOL', 'h'], [5, 9, 'EEL', 'v']])
await A.fr.waitForSelector('.sb-menu', { timeout: 8000 })
await A.fr.click('[data-arena="solo"]')
await A.fr.waitForSelector('#sb-board', { timeout: 9000 })
await A.fr.waitForFunction(() => { const st = window.Arena._A.st; return st && Date.now() + window.Arena._A.offset >= st.round.start }, null, { timeout: 8000 })
s = await sbState(A)
const meta2 = JSON.parse(rget('arena:room:' + s.code))
const sb2 = meta2.round.sb
sb2.board = BU; sb2.racks[s.me] = 'PEDFOYF'; sb2.turn = sb2.order.indexOf(s.me); sb2.turnStart = Date.now(); sb2.v++
rset('arena:room:' + s.code, JSON.stringify(meta2))
await A.fr.waitForFunction((b) => { const x = window.Arena._A.st.round.sb; return x.board === b && x.rack === 'PEDFOYF' }, BU, { timeout: 8000 })
await A.fr.waitForFunction(() => document.querySelectorAll('#sb-rack .rk:not(.gone)').length === 7 && /Tới lượt con/.test(document.querySelector('#sb-st').textContent), null, { timeout: 8000 })
// a) một từ đứng riêng ở góc, không chạm chữ nào -> báo rõ từ nào
await tap(A, [[13, 1, 'F'], [13, 2, 'Y']])
await A.fr.click('[data-sb="play"]')
await A.fr.waitForFunction(() => /phải chạm vào chữ đã có/.test(document.querySelector('#sb-msg').textContent), null, { timeout: 6000 })
check('"FY" đứng riêng ở góc -> báo “FY” phải chạm vào chữ đã có trên bàn, không mất lượt', /Từ “FY” phải chạm vào chữ đã có trên bàn/.test(await A.fr.textContent('#sb-msg')) && /Tới lượt con/.test(await A.fr.textContent('#sb-st')))
await A.fr.click('[data-sb="recall"]')
// b) đặt như con trong ảnh: P, E, D vào cột (PEELED) + F, O vào hàng 9 (FOR)
await tap(A, [[4, 9, 'P'], [8, 9, 'E'], [9, 9, 'D'], [9, 4, 'F'], [9, 5, 'O']])
check('5 chữ vàng ở hai chỗ (cột PEELED, hàng FOR), giá còn Y và F', (await A.fr.locator('#sb-board .t.pend').count()) === 5 && (await A.fr.locator('#sb-rack .rk:not(.gone)').count()) === 2)
await A.page.screenshot({ path: `${OUT}/mw31_before.png` })
await A.fr.click('[data-sb="play"]')
await A.fr.waitForFunction(() => /điểm!/.test(document.querySelector('#sb-msg')?.textContent || ''), null, { timeout: 8000 })
const msg2 = await A.fr.textContent('#sb-msg')
check('bấm "Đặt từ": nhận cả 2 từ, báo "PEELED, FOR +21 điểm!"', msg2.includes('PEELED, FOR +21 điểm!'), msg2)
s = await sbState(A)
check('điểm của con 21, bốc thêm đủ 7 chữ', s.scores[s.me] === 21 && s.rack.length === 7 && (await A.fr.locator('#sb-rack .rk:not(.gone)').count()) === 7, JSON.stringify({ sc: s.scores, rack: s.rack }))
const log2 = await A.fr.textContent('.sb-log')
check('nhật ký: "đặt PEELED, FOR +21"', /PEELED, FOR\s*\+21/.test(log2), log2)
await A.page.screenshot({ path: `${OUT}/mw31_after.png` })
check('không lỗi trang (phần 31/10)', A.errs.length === 0, A.errs.join(' | '))
await A.fr.click('[data-arena="leave"]'); await A.fr.click('[data-arena="leaveyes"]')
await A.ctx.close()
await browser.close()
const fails = Object.entries(results).filter(([, v]) => v !== 'PASS')
console.log(fails.length ? `FAILED ${fails.length}/${Object.keys(results).length}: ` + fails.map(([k]) => k).join(' | ') : `ALL PASS ✓ (${Object.keys(results).length} checks)`)
