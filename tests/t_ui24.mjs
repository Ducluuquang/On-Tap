// 24/10/2026 — thử qua giao diện thật (mỗi bạn một trình duyệt riêng, Vở Spelling trong Ôn Tập):
//  S1 Scrabble với Bạn AI: thẻ Scrabble ở trang chính → luật chơi → chơi ngay; đặt từ bằng cách chạm; Bạn AI tự đi;
//     đặt sai luật báo lỗi; bỏ lượt đổi chữ; kết thúc ván → vương miện + bàn cờ cuối ván; Ôn Tập ghi báo cáo.
//  S2 Phòng Scrabble 2 bạn (điện thoại + máy tính): mời bằng mã, hai bàn cờ giống nhau, gõ phím trên máy tính, kết thúc → vương miện.
//  S3 Trò "Xếp câu": xếp đúng / sai (đỏ) / gợi ý, xong ván có điểm, Ôn Tập ghi báo cáo.
//  S4 Thi đấu "Tìm từ" và "Lật thẻ": tìm được từ / lật đúng cặp là cộng điểm NGAY (hết giờ giữa chừng vẫn được tính).
//  S5 Màn hẹp 320/375/430: bàn cờ, giá chữ, trò Xếp câu không tràn ngang.
import { pw, OUT_DIR } from './_env.mjs'
import * as E from '../api/_scrabble/engine.mjs'
import { useRealFonts } from './fonts.mjs'
const OUT = OUT_DIR
const BASE = 'http://localhost:4192'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const browser = await pw.chromium.launch({ headless: true })
const results = {}
const check = (n, c, x = '') => { results[n] = c ? 'PASS' : 'FAIL'; console.log((c ? '  ✓ ' : '  ✗ ') + n + (c || !x ? '' : '  → ' + x)) }
const only = process.argv[2] || 'all'
const dict = await E.getDict()

async function kid({ id, name, icon, grade, base = BASE, width = 390, height = 844, extra = null }) {
  const ACC = { username: '09' + id, password: '1', phone: '09' + id, parentPass: '1', plan: 1, pin: '3', children: [{ id, name, pin: '', icon, grade }] }
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 2 })
  await useRealFonts(ctx)
  await ctx.addInitScript(({ ACC, id, extra }) => {
    if (window.top !== window) return
    if (sessionStorage.getItem('s')) return; sessionStorage.setItem('s', '1'); localStorage.clear()
    localStorage.setItem('ontap.account.v1', JSON.stringify(ACC)); localStorage.setItem('ontap.session.v1', '1'); localStorage.setItem('ontap.activechild.v1', id)
    if (extra) for (const [k, v] of Object.entries(extra)) localStorage.setItem(k, v)
  }, { ACC, id, extra })
  const page = await ctx.newPage()
  const errs = []
  page.on('pageerror', (e) => errs.push('pageerror: ' + e.message))
  page.on('console', (m) => { if (m.type() === 'error' && !/favicon|fonts\.g|status of 4(09|22)/.test(m.text())) errs.push('console: ' + m.text()) })
  await page.goto(base + '/', { waitUntil: 'networkidle' })
  await page.click('.kh-cta')
  await page.locator('button:has-text("Tiếng Anh")').first().click()
  await page.click('.cr-vocab')
  await page.waitForSelector('iframe.spelling-frame')
  let fr = null
  for (let i = 0; i < 50 && !fr; i++) { fr = page.frames().find((x) => x.url().includes('/spelling/')); if (!fr) await sleep(100) }
  await fr.waitForSelector('.home .setcard .name')
  fr.on && 0
  return { ctx, page, fr, errs, name, id }
}
const ev = (k, f, a) => k.fr.evaluate(f, a)
const sbState = (k) => ev(k, () => { const st = window.Arena._A.st; return st && st.round && st.round.sb ? { ...st.round.sb, me: st.me, status: st.status, start: st.round.start, now: Date.now() + window.Arena._A.offset } : null })
function bestMove(sb, rack, noBlank) {
  const { moves } = E.findMoves({ board: sb.board }, rack, dict, 1500)
  let best = null
  for (const mv of moves) { if (noBlank && mv.some((t) => t.b)) continue; const r = E.checkMove({ board: sb.board, racks: { x: rack } }, 'x', mv, dict); if (r.ok && (!best || r.score > best.score)) best = { ...r, tiles: mv } }
  return best
}
// đặt từ bằng cách chạm: chạm chữ trên giá rồi chạm ô (quân trắng: chọn chữ trong bảng)
async function tapMove(k, tiles) {
  const rack = (await sbState(k)).rack, used = new Set()
  for (const t of tiles) {
    const want = t.b ? '?' : t.l
    const r = [...rack].findIndex((ch, x) => ch === want && !used.has(x)); used.add(r)
    await k.fr.click(`[data-sbr="${r}"]`)
    await k.fr.click(`[data-sbc="${t.i}"]`)
    if (t.b) await k.fr.click(`[data-sbl="${t.l}"]`)
  }
}
const noOverflow = (k) => ev(k, () => { const d = document.scrollingElement; return d.scrollWidth <= d.clientWidth + 1 })
const waitTurn = async (k, timeout = 15000) => k.fr.waitForFunction(() => { const st = window.Arena._A.st, sb = st && st.round && st.round.sb; return !!sb && sb.order[sb.turn] === st.me && Date.now() + window.Arena._A.offset >= st.round.start && !document.querySelector('[data-sb="play"]')?.textContent.includes('Đang') }, null, { timeout })

// ======================= S1 =======================
if (only === 'all' || only === 's1') {
  console.log('— S1. Scrabble với Bạn AI')
  const A = await kid({ id: 'kidS1', name: 'Alex', icon: '🦊', grade: 'Lớp 7' })
  await A.fr.waitForSelector('.gcard.sbcard', { timeout: 8000 })
  check('danh sách trò chơi có thẻ "Scrabble"', (await A.fr.textContent('.gcard.sbcard')).includes('Scrabble'))
  await A.page.screenshot({ path: `${OUT}/s1_home.png` })
  await A.fr.click('.gcard.sbcard')
  await A.fr.waitForSelector('.sb-menu')
  const rules = await A.fr.textContent('.sb-rules')
  check('màn Scrabble: luật chơi (100 quân, 7 chữ, bỏ lượt = đổi chữ, vương miện) + Chơi với Bạn AI', /100 quân/.test(rules) && /7 chữ/.test(rules) && /đổi cả 7 chữ/.test(rules) && /vương miện/.test(rules) && (await A.fr.locator('[data-arena="solo"]').count()) === 1)
  await A.page.screenshot({ path: `${OUT}/s1_menu.png` })
  await A.fr.selectOption('#sb-min', '10')
  await A.fr.click('[data-arena="solo"]')
  await A.fr.waitForSelector('#sbp')
  await A.fr.waitForSelector('#sb-board', { timeout: 9000 })
  let s = await sbState(A)
  check('chơi với Bạn ONTAP: bàn 15×15 (225 ô), giá 7 chữ, con đi trước, có Bạn ONTAP (nhãn "máy")', (await A.fr.locator('#sb-board .sbc').count()) === 225 && (await A.fr.locator('#sb-rack .rk').count()) === 7 && s.order[s.turn] === s.me && /Bạn ONTAP/.test(await A.fr.textContent('#sb-pls')) && (await A.fr.textContent('#sb-pls .ai-tag')) === 'máy')
  check('đồng hồ cả ván 10 phút + số chữ trong túi', /⏱ (9|10):/.test(await A.fr.textContent('#sb-clock')) && (await A.fr.textContent('.sb-top')).includes('🎒 86'), await A.fr.textContent('.sb-top'))
  check('báo "Tới lượt con"', (await A.fr.textContent('#sb-st')).includes('Tới lượt con'))
  await A.page.screenshot({ path: `${OUT}/s1_board.png` })
  // đặt sai luật: 2 chữ ở góc bàn (không qua ô ★)
  const r0 = s.rack
  const tA = [...r0].findIndex((c) => c !== '?'), tB = [...r0].findIndex((c, x) => c !== '?' && x !== tA)
  await A.fr.click(`[data-sbr="${tA}"]`); await A.fr.click('[data-sbc="0"]')
  await A.fr.click(`[data-sbr="${tB}"]`); await A.fr.click('[data-sbc="1"]')
  check('chữ đặt thử hiện màu vàng trên bàn, giá còn 5 chữ', (await A.fr.locator('#sb-board .t.pend').count()) === 2 && (await A.fr.locator('#sb-rack .rk:not(.gone)').count()) === 5)
  await A.fr.click('[data-sb="play"]')
  await A.fr.waitForFunction(() => /ô ★/.test(document.querySelector('#sb-msg').textContent), null, { timeout: 6000 })
  check('đặt sai luật: báo lỗi rõ ràng, không mất lượt', (await A.fr.textContent('#sb-msg')).includes('ô ★') && (await sbState(A)).turn === s.turn)
  await A.fr.click('[data-sb="recall"]')
  check('"Thu lại": chữ về giá', (await A.fr.locator('#sb-board .t.pend').count()) === 0 && (await A.fr.locator('#sb-rack .rk:not(.gone)').count()) === 7)
  // chạm chữ vừa đặt để lấy lại
  await A.fr.click(`[data-sbr="${tA}"]`); await A.fr.click('[data-sbc="112"]'); await A.fr.click('[data-sbc="112"]')
  check('chạm chữ vừa đặt: chữ về giá', (await A.fr.locator('#sb-board .t.pend').count()) === 0)
  // đặt từ đúng
  s = await sbState(A)
  const mv = bestMove(s, s.rack)
  await tapMove(A, mv.tiles)
  await A.fr.click('[data-sb="play"]')
  await A.fr.waitForFunction(() => /điểm!/.test(document.querySelector('#sb-msg')?.textContent || ''), null, { timeout: 8000 })
  s = await sbState(A)
  check(`đặt "${mv.words[0].w}": từ hiện trên bàn, +${mv.score} điểm, bốc thêm đủ 7 chữ`, mv.tiles.every((t) => s.board[t.i].toUpperCase() === t.l) && s.scores[s.me] === mv.score && s.rack.length === 7 && (await A.fr.textContent('#sb-msg')).includes('+' + mv.score), await A.fr.textContent('#sb-msg'))
  await A.page.screenshot({ path: `${OUT}/s1_after_move.png` })
  // Bạn AI tự đi
  await A.fr.waitForFunction(() => { const sb = window.Arena._A.st.round.sb; return sb.moves.length >= 2 && sb.order[sb.turn] === window.Arena._A.st.me }, null, { timeout: 15000 })
  s = await sbState(A)
  const aiPid = s.order.find((p) => p !== s.me), am = s.moves.at(-1)
  check('Bạn AI tự đi (đặt từ hoặc bỏ lượt), rồi tới lượt con', am.p === aiPid && ['play', 'pass'].includes(am.k))
  check('Bạn AI luôn kém con', (s.scores[aiPid] || 0) < s.scores[s.me], JSON.stringify(s.scores))
  check('nhật ký nước đi hiện tên + từ + điểm', (await A.fr.textContent('.sb-log')).includes(mv.words[0].w))
  // thêm một nước nối vào chữ có sẵn
  s = await sbState(A)
  const mv2 = bestMove(s, s.rack)
  if (mv2) {
    await tapMove(A, mv2.tiles)
    await A.fr.click('[data-sb="play"]')
    await A.fr.waitForFunction((n) => window.Arena._A.st.round.sb.moves.length > n, s.moves.length, { timeout: 8000 })
    const s2 = await sbState(A)
    check(`nước thứ hai "${mv2.words[0].w}" nối vào chữ có sẵn: +${mv2.score}`, s2.scores[s2.me] === s.scores[s.me] + mv2.score)
  }
  // bỏ lượt = đổi chữ
  await waitTurn(A, 20000)
  s = await sbState(A)
  await A.fr.click('[data-sb="pass"]')
  await A.fr.waitForSelector('[data-sb="passyes"]')
  check('bỏ lượt phải bấm xác nhận "đổi cả 7 chữ"', (await A.fr.textContent('.confirm')).includes('đổi cả 7 chữ'))
  await A.fr.click('[data-sb="passyes"]')
  await A.fr.waitForFunction((n) => window.Arena._A.st.round.sb.moves.length > n, s.moves.length, { timeout: 8000 })
  const sp = await sbState(A)
  check('bỏ lượt: giá chữ đổi mới (vẫn 7 chữ), nhật ký ghi "bỏ lượt, đổi 7 chữ"', sp.rack.length === 7 && sp.moves.some((m) => m.p === sp.me && m.k === 'pass' && m.x === 7) && (await A.fr.textContent('.sb-log')).includes('đổi 7 chữ'))
  // quân trắng (nếu có trên giá): chọn chữ
  // kết thúc ván
  await A.fr.click('[data-sb="end"]')
  await A.fr.click('[data-sb="endyes"]')
  await A.fr.waitForSelector('.sb-res', { timeout: 10000 })
  const res = await A.fr.textContent('.page.arena')
  check('kết thúc ván: vương miện 👑 cho con, "Con thắng ván Scrabble"', (await A.fr.locator('.sb-res .ar-crown').count()) === 1 && res.includes('Con thắng ván Scrabble'), res.slice(0, 200))
  check('kết quả có điểm từng bạn, bàn cờ cuối ván, các từ đã đặt', (await A.fr.locator('.sb-board.mini .sbc').count()) === 225 && res.includes(mv.words[0].w) && res.includes('Tổng điểm cả buổi'))
  await A.page.screenshot({ path: `${OUT}/s1_results.png`, fullPage: false })
  await A.fr.evaluate(() => document.querySelector('.sb-res').scrollIntoView())
  await A.page.screenshot({ path: `${OUT}/s1_results2.png` })
  const stA = JSON.parse(await A.page.evaluate(() => localStorage.getItem('ontap.stats.v2::kidS1')) || '{}')
  const day = Object.values(stA.log || {})[0] || {}
  check('Ôn Tập ghi ván Scrabble vào báo cáo Tiếng Anh (số từ đã đặt, thời gian)', day['Tiếng Anh'] && day['Tiếng Anh'].reviewed >= 1 && day['Tiếng Anh'].sec > 0, JSON.stringify(day))
  check('S1 không lỗi trang', A.errs.length === 0, A.errs.join(' | '))
  await A.fr.click('[data-arena="leave"]'); await A.fr.click('[data-arena="leaveyes"]')
  await A.ctx.close()
}

// ======================= S2 =======================
if (only === 'all' || only === 's2') {
  console.log('— S2. Phòng Scrabble 2 bạn (điện thoại + máy tính)')
  const A = await kid({ id: 'kidS2a', name: 'Alex', icon: '🦊', grade: 'Lớp 7' })
  const B = await kid({ id: 'kidS2b', name: 'Bin', icon: '🐻', grade: 'Lớp 4', width: 1280, height: 900 })
  await A.fr.waitForSelector('.gcard.sbcard', { timeout: 8000 })
  await A.fr.click('.gcard.sbcard'); await A.fr.waitForSelector('.sb-menu')
  await A.fr.click('[data-arena="sbroom"]')
  await A.fr.waitForSelector('.ar-digits')
  const code = (await A.fr.textContent('.ar-digits')).replace(/\D/g, '')
  await A.fr.waitForFunction(() => window.Arena._A.st && window.Arena._A.st.cfg.game === 'scrabble', null, { timeout: 6000 })
  check('tạo phòng Scrabble: chọn sẵn Scrabble, 20 phút, không có ô phạm vi từ', (await A.fr.inputValue('#ar-game')) === 'scrabble' && (await A.fr.inputValue('#ar-min')) === '20' && (await A.fr.locator('#ar-req').count()) === 0)
  check('chủ phòng có nút "Thêm Bạn AI"', (await A.fr.locator('[data-arena="aiadd"]').count()) === 1)
  await A.page.screenshot({ path: `${OUT}/s2_lobby_owner.png` })
  await B.fr.waitForSelector('.arena-entry', { timeout: 8000 })
  await B.fr.click('.arena-entry:not(.sbe)'); await B.fr.waitForSelector('.ar-cards')
  await B.fr.click('[data-arena="joinform"]'); await B.fr.fill('#ar-code', code); await B.fr.click('[data-arena="join"]')
  await B.fr.waitForSelector('#ar-players')
  check('bạn vào phòng thấy: Scrabble, thời gian cả ván, luật ngắn', (await B.fr.textContent('.ar-set')).includes('Scrabble') && (await B.fr.textContent('.ar-set')).includes('20 phút'))
  await A.fr.waitForFunction(() => document.querySelectorAll('#ar-players .ar-pl').length === 2, null, { timeout: 8000 })
  await A.fr.click('[data-arena="start"]')
  await Promise.all([A.fr.waitForSelector('#sb-board', { timeout: 12000 }), B.fr.waitForSelector('#sb-board', { timeout: 12000 })])
  check('cả hai thấy bàn cờ chung', true)
  await B.page.screenshot({ path: `${OUT}/s2_desktop_board.png` })
  for (let turn = 0; turn < 3; turn++) {
    const sa = await sbState(A)
    const P = sa.order[sa.turn] === sa.me ? A : B, Q = P === A ? B : A
    await waitTurn(P)
    const s = await sbState(P)
    const mv = bestMove(s, s.rack, P === B)
    if (P === B) {
      // máy tính: chạm ô đầu tiên rồi gõ chữ (quân trắng: gõ chữ cần thay)
      const sorted = mv.tiles.slice().sort((x, y) => x.i - y.i)
      const vertical = sorted.length > 1 && sorted[1].i - sorted[0].i >= 15
      await B.fr.click(`[data-sbc="${sorted[0].i}"]`)
      if (vertical) await B.fr.click(`[data-sbc="${sorted[0].i}"]`)
      for (const t of sorted) {
        const hasLetter = s.rack.includes(t.l) && !t.b
        await B.fr.locator('body').press(hasLetter ? t.l.toLowerCase() : t.l.toLowerCase())
      }
      await B.fr.locator('body').press('Enter')
    } else {
      await tapMove(A, mv.tiles)
      await A.fr.click('[data-sb="play"]')
    }
    await Q.fr.waitForFunction((n) => window.Arena._A.st.round.sb.moves.length > n, s.moves.length, { timeout: 10000 })
    const sq = await sbState(Q)
    check(`lượt ${turn + 1}: ${P === A ? 'Alex (chạm)' : 'Bin (gõ phím)'} đặt "${mv.words[0].w}" — bạn kia thấy ngay trên bàn của mình`, mv.tiles.every((t) => sq.board[t.i].toUpperCase() === t.l) && sq.scores[s.me] === s.scores[s.me] + mv.score, JSON.stringify(sq.moves.at(-1)))
  }
  await A.page.screenshot({ path: `${OUT}/s2_phone_board.png` })
  await B.page.screenshot({ path: `${OUT}/s2_desktop_board2.png` })
  check('bạn không phải chủ phòng không có nút "Kết thúc ván"', (await B.fr.locator('[data-sb="end"]').count()) === 0)
  await A.fr.click('[data-sb="end"]'); await A.fr.click('[data-sb="endyes"]')
  await Promise.all([A.fr.waitForSelector('.sb-res', { timeout: 10000 }), B.fr.waitForSelector('.sb-res', { timeout: 10000 })])
  const ra = await ev(A, () => window.Arena._A.st.last.rank.map((r) => r.n + ':' + r.p).join(','))
  const rb = await ev(B, () => window.Arena._A.st.last.rank.map((r) => r.n + ':' + r.p).join(','))
  const win = await A.fr.textContent('.sb-res .ar-winner')
  check('kết thúc: hai máy cùng kết quả, vương miện cho bạn nhiều điểm hơn', ra === rb && win.includes(ra.split(',')[0].split(':')[0]), ra + ' | ' + rb + ' | ' + win)
  await B.page.screenshot({ path: `${OUT}/s2_desktop_results.png` })
  check('S2 không lỗi trang', A.errs.length === 0 && B.errs.length === 0, A.errs.concat(B.errs).join(' | '))
  await A.fr.click('[data-arena="leave"]'); await A.fr.click('[data-arena="leaveyes"]')
  await A.ctx.close(); await B.ctx.close()
}

// ======================= S3 =======================
if (only === 'all' || only === 's3') {
  console.log('— S3. Trò "Xếp câu"')
  const C = await kid({ id: 'kidS3', name: 'Chi', icon: '🐰', grade: 'Lớp 3' })
  check('danh sách trò có "Xếp câu"', (await C.fr.textContent('.ggrid')).includes('Xếp câu'))
  await C.fr.click('.gcard:has-text("Xếp câu")')
  await C.fr.waitForSelector('#g-bank .wc')
  const words = await ev(C, () => G.words.length)
  const sentence = async () => ev(C, () => G.cur.ex.replace(/\s+/g, ' ').trim().split(' '))
  // câu 1: xếp đúng ngay
  let toks = await sentence()
  check('câu bị xáo trộn: đủ các chữ của câu ví dụ, có ô trống cho từng chữ', (await C.fr.locator('#g-bank .wc').count()) === toks.length && (await C.fr.locator('#g-ans .wc.slot').count()) === toks.length)
  await C.page.screenshot({ path: `${OUT}/s3_start.png` })
  for (const t of toks) { const btn = C.fr.locator('#g-bank .wc:not(.used)', { hasText: t }).filter({ hasText: new RegExp('^' + t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$') }).first(); await btn.click() }
  await C.fr.waitForSelector('#g-next', { timeout: 5000 })
  check('xếp đúng: câu hiện màu xanh, có "Nghe câu" và nút sang câu tiếp', (await C.fr.locator('#g-ans .wc.good').count()) === toks.length && (await C.fr.textContent('.fb')).length > 0)
  await C.page.screenshot({ path: `${OUT}/s3_ok.png` })
  await C.fr.click('#g-next')
  // câu 2: xếp sai một lần (đảo hai chữ đầu) -> đỏ -> giữ phần đúng -> dùng gợi ý cho xong
  toks = await sentence()
  await C.fr.waitForSelector('#g-bank .wc')
  const order = toks.slice(); if (order.length > 2 && order[0] !== order[1]) [order[0], order[1]] = [order[1], order[0]]
  for (const t of order) { await C.fr.locator('#g-bank .wc:not(.used)').filter({ hasText: new RegExp('^' + t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$') }).first().click() }
  await C.fr.waitForSelector('#g-ans .wc.bad', { timeout: 4000 })
  check('xếp sai: chữ sai chỗ hiện đỏ, báo "Thử lại"', (await C.fr.textContent('.fb')).includes('Thử lại'))
  await C.page.screenshot({ path: `${OUT}/s3_bad.png` })
  await C.fr.waitForFunction(() => !document.querySelector('#g-ans .wc.bad'), null, { timeout: 4000 })
  for (let k = 0; k < 20 && !(await C.fr.locator('#g-next').count()); k++) { await C.fr.click('#g-hint'); await sleep(350) }
  check('dùng "Gợi ý 1 chữ" xếp xong câu', (await C.fr.locator('#g-next').count()) === 1)
  // các câu còn lại: xếp đúng
  for (let n = 2; n < words; n++) {
    await C.fr.click('#g-next')
    await C.fr.waitForSelector('#g-bank .wc')
    toks = await sentence()
    for (const t of toks) { await C.fr.locator('#g-bank .wc:not(.used)').filter({ hasText: new RegExp('^' + t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$') }).first().click() }
    await C.fr.waitForSelector('#g-next', { timeout: 5000 })
  }
  await C.fr.click('#g-next')
  await C.fr.waitForFunction(() => S.view === 'result', null, { timeout: 5000 })
  const score = await ev(C, () => S.result.score)
  check(`xong ván Xếp câu: có điểm (${score}/10), câu sai một lần được nửa điểm`, score > 0 && score < 10)
  await C.page.screenshot({ path: `${OUT}/s3_result.png` })
  const stC = JSON.parse(await C.page.evaluate(() => localStorage.getItem('ontap.stats.v2::kidS3')) || '{}')
  const day = Object.values(stC.log || {})[0] || {}
  check('Ôn Tập ghi ván Xếp câu vào báo cáo Tiếng Anh', day['Tiếng Anh'] && day['Tiếng Anh'].reviewed === words && day['Tiếng Anh'].correct === words - 1, JSON.stringify(day))
  check('S3 không lỗi trang', C.errs.length === 0, C.errs.join(' | '))
  await C.ctx.close()
}

// ======================= S4 =======================
if (only === 'all' || only === 's4') {
  console.log('— S4. Thi đấu "Tìm từ" + "Lật thẻ": cộng điểm ngay')
  const A = await kid({ id: 'kidS4a', name: 'Alex', icon: '🦊', grade: 'Lớp 7' })
  const B = await kid({ id: 'kidS4b', name: 'Bin', icon: '🐻', grade: 'Lớp 4' })
  await A.fr.waitForSelector('.arena-entry', { timeout: 8000 })
  await A.fr.click('.arena-entry:not(.sbe)'); await A.fr.waitForSelector('.ar-cards')
  await A.fr.click('[data-arena="create"]'); await A.fr.waitForSelector('.ar-digits')
  const code = (await A.fr.textContent('.ar-digits')).replace(/\D/g, '')
  await B.fr.waitForSelector('.arena-entry', { timeout: 8000 })
  await B.fr.click('.arena-entry:not(.sbe)'); await B.fr.waitForSelector('.ar-cards')
  await B.fr.click('[data-arena="joinform"]'); await B.fr.fill('#ar-code', code); await B.fr.click('[data-arena="join"]')
  await A.fr.waitForFunction(() => document.querySelectorAll('#ar-players .ar-pl').length === 2, null, { timeout: 8000 })
  for (const game of ['search', 'memory']) {
    await A.fr.selectOption('#ar-game', game); await A.fr.selectOption('#ar-min', '1')
    await A.fr.fill('#ar-req', 'Fruits')
    await A.fr.waitForFunction((g) => window.Arena._A.st.cfg.game === g && window.Arena._A.st.cfg.minutes === 1, game, { timeout: 6000 })
    await A.fr.click('[data-arena="start"]')
    await A.fr.waitForSelector(game === 'search' ? '#ws-grid' : '.mem', { timeout: 12000 })
    await B.fr.waitForSelector(game === 'search' ? '#ws-grid' : '.mem', { timeout: 12000 })
    let found = 0
    if (game === 'search') {
      // tìm 2 từ trong bảng (đọc chữ trên bảng), chạm chữ đầu rồi chữ cuối
      const info = await ev(A, () => ({ n: Math.round(Math.sqrt(document.querySelectorAll('#ws-grid .c').length)), cells: [...document.querySelectorAll('#ws-grid .c')].map((c) => c.textContent), list: [...document.querySelectorAll('#ws-list span')].map((s) => s.textContent) }))
      const N = info.n, at = (r, c) => info.cells[r * N + c]
      for (const w of info.list.slice(0, 2)) {
        const W = w.replace(/[^a-z]/gi, '').toUpperCase()
        let hit = null
        for (let r = 0; r < N && !hit; r++) for (let c = 0; c < N && !hit; c++) for (const [dr, dc] of [[0, 1], [1, 0], [1, 1]]) {
          let ok = true
          for (let k = 0; k < W.length; k++) { const rr = r + dr * k, cc = c + dc * k; if (rr >= N || cc >= N || at(rr, cc) !== W[k]) { ok = false; break } }
          if (ok) { hit = [r * N + c, (r + dr * (W.length - 1)) * N + c + dc * (W.length - 1)]; break }
        }
        if (!hit) continue
        await A.fr.click(`#ws-grid [data-c="${hit[0]}"]`); await A.fr.click(`#ws-grid [data-c="${hit[1]}"]`)
        found++
        await sleep(300)
      }
    } else {
      const pool = await ev(A, () => G.words.map((w) => ({ w: w.w, vi: w.vi })))
      for (const p of pool.slice(0, 2)) {
        const idx = await ev(A, (p) => { const cards = [...document.querySelectorAll('.mem .card')]; const a = cards.findIndex((c) => c.querySelector('.f').textContent.trim() === p.w); const b = cards.findIndex((c, i) => i !== a && c.querySelector('.f').textContent.includes(p.vi || p.w)); return [a, b] }, p)
        if (idx[0] < 0 || idx[1] < 0) continue
        await A.fr.click(`.mem [data-card="${idx[0]}"]`); await A.fr.click(`.mem [data-card="${idx[1]}"]`)
        found++
        await sleep(1200)
      }
    }
    const pts = await ev(A, () => window.Arena._A.play.pts)
    check(`"${game === 'search' ? 'Tìm từ' : 'Lật thẻ'}": ${found} ${game === 'search' ? 'từ tìm được' : 'cặp lật đúng'} là cộng ngay ${found * 10} điểm (chưa xong cả bàn)`, found === 2 && pts === found * 10, `found ${found} pts ${pts}`)
    await A.fr.waitForFunction((p) => (document.querySelector('#ar-bar') || {}).textContent?.includes(String(p)), pts, { timeout: 4000 }).catch(() => {})
    check(`"${game === 'search' ? 'Tìm từ' : 'Lật thẻ'}": thanh điểm trên cùng hiện điểm mới`, (await A.fr.textContent('#ar-bar')).includes(String(pts)))
    // hết giờ giữa chừng: kết quả ván vẫn tính số điểm đã có
    await Promise.all([A.fr.waitForFunction(() => window.Arena._A.st.status === 'results', null, { timeout: 80000 }), B.fr.waitForFunction(() => window.Arena._A.st.status === 'results', null, { timeout: 80000 })])
    const rank = await ev(A, () => window.Arena._A.st.last.rank.map((r) => ({ n: r.n, p: r.p })))
    check(`"${game === 'search' ? 'Tìm từ' : 'Lật thẻ'}": hết giờ giữa chừng, kết quả ván vẫn tính ${pts} điểm của Alex`, rank.find((r) => r.n === 'Alex').p === pts, JSON.stringify(rank))
  }
  check('S4 không lỗi trang', A.errs.length === 0 && B.errs.length === 0, A.errs.concat(B.errs).join(' | '))
  await A.fr.click('[data-arena="leave"]'); await A.fr.click('[data-arena="leaveyes"]')
  await A.ctx.close(); await B.ctx.close()
}

// ======================= S5 =======================
if (only === 'all' || only === 's5') {
  console.log('— S5. Màn hẹp: không tràn ngang')
  for (const width of [320, 375, 430]) {
    const K = await kid({ id: 'kidS5' + width, name: 'Kiên', icon: '🐯', grade: 'Lớp 5', width, height: 800 })
    await K.fr.waitForSelector('.gcard.sbcard', { timeout: 8000 })
    const homeOk = await noOverflow(K)
    await K.fr.click('.gcard.sbcard'); await K.fr.waitForSelector('.sb-menu')
    const menuOk = await noOverflow(K)
    await K.fr.click('[data-arena="solo"]'); await K.fr.waitForSelector('#sb-board', { timeout: 12000 })
    await K.fr.evaluate(() => window.scrollTo(0, 0)); await K.page.screenshot({ path: `${OUT}/s5_${width}_top.png` })
    const topOk = await ev(K, () => { const t = document.querySelector('.sb-t').getBoundingClientRect(), c = document.querySelector('#sb-clock').getBoundingClientRect(); return !(t.right > c.left + 1 && t.bottom > c.top + 1 && t.top < c.bottom - 1) })
    check(`${width}px: tiêu đề "Scrabble" không bị đồng hồ đè lên`, topOk)
    const s = await sbState(K)
    const mv = bestMove(s, s.rack)
    await tapMove(K, mv.tiles)
    const boardOk = await noOverflow(K)
    const geo = await ev(K, () => { const b = document.querySelector('#sb-board').getBoundingClientRect(), r = document.querySelector('#sb-rack').getBoundingClientRect(), c = document.querySelector('#sb-board .sbc').getBoundingClientRect(); return { bw: b.width, rw: r.width, cell: c.width, vw: document.documentElement.clientWidth } })
    await K.page.screenshot({ path: `${OUT}/s5_${width}_board.png` })
    await K.fr.click('[data-sb="play"]')
    await K.fr.waitForFunction(() => /điểm!/.test(document.querySelector('#sb-msg')?.textContent || ''), null, { timeout: 8000 })
    await K.fr.click('[data-sb="end"]'); await K.fr.click('[data-sb="endyes"]'); await K.fr.waitForSelector('.sb-res', { timeout: 10000 })
    const resOk = await noOverflow(K)
    await K.page.screenshot({ path: `${OUT}/s5_${width}_results.png` })
    await K.fr.click('[data-arena="leave"]'); await K.fr.click('[data-arena="leaveyes"]')
    await K.fr.waitForSelector('.ar-cards', { timeout: 8000 })
    await K.fr.click('[data-act="home"]')
    await K.fr.waitForSelector('.ggrid', { timeout: 8000 })
    await K.fr.click('.gcard:has-text("Xếp câu")'); await K.fr.waitForSelector('#g-bank .wc')
    const sentOk = await noOverflow(K)
    await K.page.screenshot({ path: `${OUT}/s5_${width}_sentence.png` })
    check(`${width}px: trang chính, màn Scrabble, bàn cờ (ô ${geo.cell.toFixed(1)}px), kết quả, Xếp câu không tràn ngang`, homeOk && menuOk && boardOk && resOk && sentOk && geo.bw <= geo.vw && geo.rw <= geo.vw && geo.cell >= 14, JSON.stringify({ homeOk, menuOk, boardOk, resOk, sentOk, geo }))
    check(`${width}px không lỗi trang`, K.errs.length === 0, K.errs.join(' | '))
    await K.ctx.close()
  }
}

await browser.close()
const fails = Object.entries(results).filter(([, v]) => v !== 'PASS')
console.log(fails.length ? `${fails.length} FAILED: ` + fails.map(([k]) => k).join(' | ') : `ALL PASS ✓ (${Object.keys(results).length} checks)`)
