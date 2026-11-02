// Rời phòng khi mạng chậm (lỗi tìm thấy khi thử trên Vercel): câu trả lời muộn của phòng cũ KHÔNG được kéo con quay lại phòng.
//  L1 Scrabble với Bạn AI: đã đặt 1 từ, máy chủ trả lời "sync" chậm -> Rời phòng -> ở lại màn Thi đấu; Ôn Tập vẫn ghi từ + thời gian đã chơi
//  L2 Scrabble: đang gửi nước đi (chậm) thì Rời phòng -> ở lại màn Thi đấu
//  L3 câu hỏi "sync" tới máy chủ SAU khi rời (phòng đã đóng) -> không hiện "Phòng … đã đóng"
//  L4 phòng 2 bạn: bạn (không phải chủ phòng) rời khi mạng chậm -> về màn Thi đấu; chủ phòng thấy bạn đã rời
//  L5 thách đấu ngẫu nhiên: "Huỷ tìm" khi mạng chậm -> về màn Thi đấu
//  L6 rời phòng rồi tạo phòng mới ngay (câu trả lời của phòng cũ về sau) -> vẫn ở phòng MỚI
// BASE=http://localhost:4195 để chạy với bản cũ (đối chứng: phải thấy lỗi).
import { pw, OUT_DIR } from './_env.mjs'
import * as E from '../api/_scrabble/engine.mjs'
import { useRealFonts } from './fonts.mjs'
const BASE = process.env.BASE || 'http://localhost:4192'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const browser = await pw.chromium.launch({ headless: true })
const results = {}
const check = (n, c, x = '') => { results[n] = c ? 'PASS' : 'FAIL'; console.log((c ? '  ✓ ' : '  ✗ ') + n + (c || !x ? '' : '  → ' + x)) }
const only = process.argv[2] || 'all'
const dict = await E.getDict()
const RUN = Date.now().toString(36).slice(-4)

async function kid({ id, name, icon, grade }) {
  id = id + RUN
  const ACC = { username: '09' + id, password: '1', phone: '09' + id, parentPass: '1', plan: 1, pin: '3', children: [{ id, name, pin: '', icon, grade }] }
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 })
  await useRealFonts(ctx)
  await ctx.addInitScript(({ ACC, id }) => {
    if (window.top !== window) return
    if (sessionStorage.getItem('s')) return; sessionStorage.setItem('s', '1'); localStorage.clear()
    localStorage.setItem('ontap.account.v1', JSON.stringify(ACC)); localStorage.setItem('ontap.session.v1', '1'); localStorage.setItem('ontap.activechild.v1', id)
  }, { ACC, id })
  // mạng chậm giả: delay[action] = { ms, mode: 'resp' (máy chủ trả lời ngay, câu trả lời về chậm) | 'req' (câu hỏi tới máy chủ chậm) }
  const delay = {}
  await ctx.route('**/api/arena', async (route) => {
    let body = {}; try { body = route.request().postDataJSON() || {} } catch {}
    const d = delay[body.action]
    if (!d) return route.continue()
    if (d.mode === 'req') { await sleep(d.ms); return route.continue().catch(() => {}) }
    const resp = await route.fetch(); await sleep(d.ms); return route.fulfill({ response: resp }).catch(() => {})
  })
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
  return { ctx, page, fr, errs, name, id, delay }
}
const ev = (k, f, a) => k.fr.evaluate(f, a)
const arenaState = (k) => ev(k, () => { const A = window.Arena._A; return { code: A.code, screen: A.screen, status: A.st ? A.st.status : null, syncing: A.syncing, err: A.err, text: (document.querySelector('#view') || {}).textContent || '', saved: localStorage.getItem(Object.keys(localStorage).find((x) => x.startsWith('ontap.arena.v1')) || '') } })
const sbState = (k) => ev(k, () => { const st = window.Arena._A.st; return st && st.round && st.round.sb ? { ...st.round.sb, me: st.me } : null })
function bestMove(sb, rack) {
  const { moves } = E.findMoves({ board: sb.board }, rack, dict, 1500)
  let best = null
  for (const mv of moves) { if (mv.some((t) => t.b)) continue; const r = E.checkMove({ board: sb.board, racks: { x: rack } }, 'x', mv, dict); if (r.ok && (!best || r.score > best.score)) best = { ...r, tiles: mv } }
  return best
}
async function tapMove(k, tiles) {
  const rack = (await sbState(k)).rack, used = new Set()
  for (const t of tiles) {
    const r = [...rack].findIndex((ch, x) => ch === t.l && !used.has(x)); used.add(r)
    await k.fr.click(`[data-sbr="${r}"]`)
    await k.fr.click(`[data-sbc="${t.i}"]`)
  }
}
async function openSolo(k) {
  await k.fr.waitForSelector('.gcard.sbcard', { timeout: 8000 })
  await k.fr.click('.gcard.sbcard'); await k.fr.waitForSelector('.sb-menu')
  await k.fr.selectOption('#sb-min', '10')
  await k.fr.click('[data-arena="solo"]')
  await k.fr.waitForSelector('#sb-board', { timeout: 9000 })
  await k.fr.waitForFunction(() => { const st = window.Arena._A.st; return st && Date.now() + window.Arena._A.offset >= st.round.start }, null, { timeout: 8000 })
}
// Mở ván Scrabble với Bạn ONTAP và tìm sẵn một nước đi hợp lệ cho bộ chữ của con.
// Hiếm khi bộ 7 chữ rút ngẫu nhiên không xếp được từ nào (không tính quân trắng) -> mở ván mới (tối đa 5 lần), không làm hỏng phép thử.
async function soloWithMove(opts) {
  for (let i = 0; i < 5; i++) {
    const K = await kid({ ...opts, id: opts.id + (i ? 'r' + i : '') })
    await openSolo(K)
    const s = await sbState(K)
    const mv = bestMove(s, s.rack)
    if (mv) return { K, s, mv }
    console.log('    (bộ chữ "' + s.rack + '" không xếp được từ nào, mở ván mới)')
    await K.ctx.close()
  }
  throw new Error('5 ván liền bộ chữ không xếp được từ nào')
}
// sau khi rời: ở màn Thi đấu (menu), không còn mã phòng, không hiện phòng cũ / "đã đóng" / "không còn nữa"
async function staysOut(k, label, oldCode, waitMs = 3200, screen = 'menu') {
  await sleep(waitMs)
  const s = await arenaState(k)
  const ok = s.code === '' && s.screen === screen && (await k.fr.locator('.ar-cards').count()) === 1 && !/đã đóng|không còn nữa/.test(s.text) && !(s.saved || '').includes(oldCode)
  check(label, ok, JSON.stringify({ code: s.code, screen: s.screen, status: s.status, err: s.err, text: s.text.slice(0, 90) }))
}
const stats = async (k) => { const st = JSON.parse(await k.page.evaluate((id) => localStorage.getItem('ontap.stats.v2::' + id), k.id) || '{}'); return Object.values(st.log || {})[0] || {} }

// ======================= L1 =======================
if (only === 'all' || only === 'l1') {
  console.log('— L1. Scrabble với Bạn AI: rời phòng khi "sync" trả lời chậm')
  const { K, mv } = await soloWithMove({ id: 'kidL1', name: 'Lan', icon: '🐰', grade: 'Lớp 5' })
  await tapMove(K, mv.tiles)
  await K.fr.click('[data-sb="play"]')
  await K.fr.waitForFunction(() => /điểm!/.test(document.querySelector('#sb-msg')?.textContent || ''), null, { timeout: 8000 })
  await sleep(1200)
  await K.fr.click('[data-sb="shuffle"]')   // một lần chạm nữa: có thời gian chơi
  const code = (await arenaState(K)).code
  K.delay.sync = { ms: 2200, mode: 'resp' }
  await K.fr.waitForFunction(() => window.Arena._A.syncing === true, null, { timeout: 6000 })
  await K.fr.click('[data-arena="leave"]'); await K.fr.click('[data-arena="leaveyes"]')
  const s0 = await arenaState(K)
  check('bấm Rời phòng: về màn Scrabble ngay', s0.screen === 'sbmenu' && s0.code === '', JSON.stringify(s0).slice(0, 160))
  await staysOut(K, 'câu trả lời muộn của phòng cũ không kéo con quay lại bàn cờ (sau 3 giây vẫn ở màn Scrabble)', code, 3200, 'sbmenu')
  K.delay.sync = null
  const day = await stats(K)
  check(`rời giữa ván: Ôn Tập vẫn ghi từ đã đặt ("${mv.words[0].w}") + thời gian chơi`, day['Tiếng Anh'] && day['Tiếng Anh'].reviewed >= 1 && day['Tiếng Anh'].sec > 0, JSON.stringify(day))
  check('L1 không lỗi trang', K.errs.length === 0, K.errs.join(' | '))
  await K.ctx.close()
}

// ======================= L2 =======================
if (only === 'all' || only === 'l2') {
  console.log('— L2. Scrabble: đang gửi nước đi (chậm) thì rời phòng')
  const { K, mv } = await soloWithMove({ id: 'kidL2', name: 'Minh', icon: '🐯', grade: 'Lớp 6' })
  await tapMove(K, mv.tiles)
  const code = (await arenaState(K)).code
  K.delay.sb_move = { ms: 2200, mode: 'resp' }
  K.delay.sync = { ms: 2200, mode: 'resp' }
  await K.fr.click('[data-sb="play"]')
  await K.fr.waitForFunction(() => /Đang/.test(document.querySelector('[data-sb="play"]')?.textContent || ''), null, { timeout: 3000 })
  await K.fr.click('[data-arena="leave"]'); await K.fr.click('[data-arena="leaveyes"]')
  await staysOut(K, 'câu trả lời muộn của nước đi không kéo con quay lại bàn cờ', code, 3200, 'sbmenu')
  check('L2 không lỗi trang', K.errs.length === 0, K.errs.join(' | '))
  await K.ctx.close()
}

// ======================= L3 =======================
if (only === 'all' || only === 'l3') {
  console.log('— L3. Câu hỏi "sync" tới máy chủ sau khi phòng đã đóng')
  const K = await kid({ id: 'kidL3', name: 'Nam', icon: '🐼', grade: 'Lớp 3' })
  await openSolo(K)
  const code = (await arenaState(K)).code
  K.delay.sync = { ms: 1500, mode: 'req' }
  await K.fr.waitForFunction(() => window.Arena._A.syncing === true, null, { timeout: 6000 })
  await K.fr.click('[data-arena="leave"]'); await K.fr.click('[data-arena="leaveyes"]')
  await staysOut(K, 'không hiện "Phòng … đã đóng" / "Phòng không còn nữa" sau khi tự rời phòng', code, 3200, 'sbmenu')
  check('L3 không lỗi trang', K.errs.length === 0, K.errs.join(' | '))
  await K.ctx.close()
}

// ======================= L4 =======================
if (only === 'all' || only === 'l4') {
  console.log('— L4. Phòng 2 bạn: bạn (không phải chủ phòng) rời khi mạng chậm')
  const A = await kid({ id: 'kidL4a', name: 'Alex', icon: '🦊', grade: 'Lớp 7' })
  const B = await kid({ id: 'kidL4b', name: 'Bin', icon: '🐻', grade: 'Lớp 4' })
  await A.fr.waitForSelector('.arena-entry:not(.sbe)', { timeout: 8000 })
  await A.fr.click('.arena-entry:not(.sbe)'); await A.fr.waitForSelector('.ar-cards')
  await A.fr.click('[data-arena="create"]'); await A.fr.waitForSelector('.ar-digits')
  const code = (await A.fr.textContent('.ar-digits')).replace(/\D/g, '')
  await B.fr.waitForSelector('.arena-entry:not(.sbe)', { timeout: 8000 })
  await B.fr.click('.arena-entry:not(.sbe)'); await B.fr.waitForSelector('.ar-cards')
  await B.fr.click('[data-arena="joinform"]'); await B.fr.fill('#ar-code', code); await B.fr.click('[data-arena="join"]')
  await B.fr.waitForSelector('#ar-players')
  await A.fr.waitForFunction(() => window.Arena._A.st.players.length === 2, null, { timeout: 8000 })
  B.delay.sync = { ms: 2200, mode: 'resp' }
  await B.fr.waitForFunction(() => window.Arena._A.syncing === true, null, { timeout: 6000 })
  await B.fr.click('[data-arena="leave"]'); await B.fr.click('[data-arena="leaveyes"]')
  await staysOut(B, 'bạn rời phòng khi mạng chậm: về màn Thi đấu, không quay lại phòng', code)
  await A.fr.waitForFunction(() => window.Arena._A.st.players.length === 1, null, { timeout: 8000 }).catch(() => {})
  const a = await arenaState(A)
  check('chủ phòng thấy bạn đã rời (còn 1 người), phòng vẫn mở', a.code === code && a.status === 'lobby' && (await ev(A, () => window.Arena._A.st.players.length)) === 1, JSON.stringify(a).slice(0, 160))
  // chủ phòng rời khi mạng chậm
  A.delay.sync = { ms: 2200, mode: 'resp' }
  await A.fr.waitForFunction(() => window.Arena._A.syncing === true, null, { timeout: 6000 })
  await A.fr.click('[data-arena="leave"]'); await A.fr.click('[data-arena="leaveyes"]')
  await staysOut(A, 'chủ phòng rời khi mạng chậm: về màn Thi đấu', code)
  check('L4 không lỗi trang', A.errs.length + B.errs.length === 0, A.errs.concat(B.errs).join(' | '))
  await A.ctx.close(); await B.ctx.close()
}

// ======================= L5 =======================
if (only === 'all' || only === 'l5') {
  console.log('— L5. Thách đấu ngẫu nhiên: "Huỷ tìm" khi mạng chậm')
  const K = await kid({ id: 'kidL5', name: 'Hoa', icon: '🌸', grade: 'Lớp 12' })
  await K.fr.waitForSelector('.arena-entry:not(.sbe)', { timeout: 8000 })
  await K.fr.click('.arena-entry:not(.sbe)'); await K.fr.waitForSelector('.ar-cards')
  await K.fr.click('[data-arena="randomform"]'); await K.fr.waitForSelector('#ar-rgame')
  await K.fr.selectOption('#ar-rgame', 'context')
  await K.fr.click('[data-arena="random"]')
  await K.fr.waitForFunction(() => window.Arena._A.st && window.Arena._A.st.status === 'waiting', null, { timeout: 8000 })
  const code = (await arenaState(K)).code
  K.delay.sync = { ms: 2200, mode: 'resp' }; K.delay.random = { ms: 2200, mode: 'resp' }
  await K.fr.waitForFunction(() => window.Arena._A.syncing === true, null, { timeout: 8000 })
  await K.fr.locator('[data-arena="leaveyes"]').first().click()
  await staysOut(K, '"Huỷ tìm" khi mạng chậm: về màn Thi đấu, không quay lại màn chờ', code)
  check('L5 không lỗi trang', K.errs.length === 0, K.errs.join(' | '))
  await K.ctx.close()
}

// ======================= L6 =======================
if (only === 'all' || only === 'l6') {
  console.log('— L6. Rời phòng rồi tạo phòng mới ngay')
  const K = await kid({ id: 'kidL6', name: 'Tú', icon: '🐢', grade: 'Lớp 8' })
  await K.fr.waitForSelector('.arena-entry:not(.sbe)', { timeout: 8000 })
  await K.fr.click('.arena-entry:not(.sbe)'); await K.fr.waitForSelector('.ar-cards')
  await K.fr.click('[data-arena="create"]'); await K.fr.waitForSelector('.ar-digits')
  const old = (await K.fr.textContent('.ar-digits')).replace(/\D/g, '')
  K.delay.sync = { ms: 2500, mode: 'resp' }
  await K.fr.waitForFunction(() => window.Arena._A.syncing === true, null, { timeout: 6000 })
  await K.fr.click('[data-arena="leave"]'); await K.fr.click('[data-arena="leaveyes"]')
  await K.fr.waitForSelector('.ar-cards')
  await K.fr.click('[data-arena="create"]')
  await K.fr.waitForFunction((old) => { const d = document.querySelector('.ar-digits'); return d && d.textContent.replace(/\D/g, '') !== old }, old, { timeout: 8000 })
  const fresh = (await K.fr.textContent('.ar-digits')).replace(/\D/g, '')
  await sleep(3500)
  const s = await arenaState(K)
  const digits = ((await K.fr.locator('.ar-digits').textContent().catch(() => '')) || '').replace(/\D/g, '')
  check('câu trả lời muộn của phòng cũ không kéo con về phòng cũ: vẫn ở phòng mới', s.code === fresh && digits === fresh && s.status === 'lobby' && (s.saved || '').includes(fresh), JSON.stringify({ old, fresh, code: s.code, digits, status: s.status }))
  K.delay.sync = null
  await sleep(3500)
  const s2 = await arenaState(K)
  const since = await ev(K, () => Date.now() - window.Arena._A.lastSync)
  check('phòng mới vẫn cập nhật bình thường sau đó (hỏi máy chủ đều đặn)', s2.code === fresh && s2.status === 'lobby' && since < 3200, JSON.stringify({ code: s2.code, status: s2.status, since }))
  await K.fr.click('[data-arena="leave"]'); await K.fr.click('[data-arena="leaveyes"]')
  check('L6 không lỗi trang', K.errs.length === 0, K.errs.join(' | '))
  await K.ctx.close()
}

await browser.close()
const fails = Object.entries(results).filter(([, v]) => v !== 'PASS')
console.log(fails.length ? `FAILED ${fails.length}/${Object.keys(results).length}: ` + fails.map(([k]) => k).join(' | ') : `ALL PASS ✓ (${Object.keys(results).length} checks)`)
