// Thi đấu: NHIỀU TỪ, KHÔNG LẶP LẠI (25/10/2026 — anh chụp trò "Đoán từ": khoảng 10 từ là hết rồi lặp lại).
// Chơi nhanh qua giao diện thật (mỗi bạn một trình duyệt, Vở Spelling trong Ôn Tập), AI giả trả lời đúng lời dặn "không lặp lại":
//  M1 phòng 2 bạn "Đoán từ" 2 phút: mỗi bạn giải liền rất nhiều từ (gấp mấy lần bộ 25 từ đầu) — không từ nào lặp lại,
//     máy tự xin thêm từ mới, hai bạn nhận cùng bộ từ thêm, điểm cộng đúng
//  M2 phạm vi "10 từ mới nhất" (từ của mình) + "Nghe – Viết": 10 từ đó chơi trước, rồi sang từ khác, không lặp lại
//  M3 "Trang trọng hay thân mật": các cặp không lặp lại giữa các lượt trong ván
// BASE=http://localhost:4195 (bản đang chạy trên mạng) để đối chứng M1: phải thấy từ bị lặp lại.
import { pw, OUT_DIR } from './_env.mjs'
import { useRealFonts } from './fonts.mjs'
const BASE = process.env.BASE || 'http://localhost:4192'
const MOCK = BASE + '/__mock/ai'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const browser = await pw.chromium.launch({ headless: true })
const results = {}
const check = (n, c, x = '') => { results[n] = c ? 'PASS' : 'FAIL'; console.log((c ? '  ✓ ' : '  ✗ ') + n + (c || !x ? '' : '  → ' + x)) }
const only = process.argv[2] || 'all'
const RUN = Date.now().toString(36).slice(-4)
const mock = async (p = '') => (await fetch(MOCK + p)).json()

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
  return { ctx, page, fr, errs, name, id }
}
const ev = (k, f, a) => k.fr.evaluate(f, a)
async function room(A, B, { game, minutes, req }) {
  await A.fr.waitForSelector('.arena-entry:not(.sbe)'); await A.fr.click('.arena-entry:not(.sbe)'); await A.fr.waitForSelector('.ar-cards')
  await A.fr.click('[data-arena="create"]'); await A.fr.waitForSelector('.ar-digits')
  const code = (await A.fr.textContent('.ar-digits')).replace(/\D/g, '')
  await B.fr.waitForSelector('.arena-entry:not(.sbe)'); await B.fr.click('.arena-entry:not(.sbe)'); await B.fr.waitForSelector('.ar-cards')
  await B.fr.click('[data-arena="joinform"]'); await B.fr.fill('#ar-code', code); await B.fr.click('[data-arena="join"]')
  await A.fr.waitForFunction(() => document.querySelectorAll('#ar-players .ar-pl').length === 2, null, { timeout: 8000 })
  await A.fr.selectOption('#ar-game', game); await A.fr.selectOption('#ar-min', String(minutes)); await A.fr.fill('#ar-req', req)
  await A.fr.waitForFunction(({ game, minutes, req }) => { const c = window.Arena._A.st.cfg; return c.game === game && c.minutes === minutes && (c.req || '') === req }, { game, minutes, req }, { timeout: 8000 })
  return code
}
// Tự chơi: giải ngay từ đang hỏi (gõ đúng từ / chọn đúng), rồi sang từ tiếp. Ghi lại mọi từ máy đã chấm (móc vào onRecord).
const STEP = {
  wordle: () => { if (!G.cur) return 'wait'; for (const ch of G.cur.w.toLowerCase()) G.keyFn({ key: ch, preventDefault() {} }); G.keyFn({ key: 'Enter', preventDefault() {} }); return 'solved' },
  register: () => { if (!G.reg || !document.querySelector('[data-reg]:not([disabled])')) return 'wait'; G.keyFn({ key: G.reg.side === 'inf' ? '1' : '2', preventDefault() {} }); return 'solved' },
}
async function autoPlay(k, game, { pace = 900, until }) {
  let n = 0
  while (Date.now() < until) {
    const r = await ev(k, ({ game, step }) => {
      const A = window.Arena._A
      if (A.play && A.play.f) return 'done'
      if (S.view !== 'game' || !G || !G.arena) return 'wait'
      if (!G.arena.__rec) { const h = G.arena, orig = h.onRecord; h.onRecord = function (ctx, w, c) { (window.__played = window.__played || []).push({ w: String(w.w), c, game: ctx.def.id }); return orig.apply(this, arguments) }; h.__rec = 1 }
      if (document.querySelector('#g-next')) { const b = document.querySelector('#g-next'); if (G.keyFn) G.keyFn({ key: 'Enter', preventDefault() {} }); if (document.querySelector('#g-next') === b) b.click(); return 'next' }
      if (game === 'bee') {
        if (!G.cur || !document.querySelector('#g-in')) return 'wait'
        return 'bee:' + G.cur.w
      }
      return (0, eval)('(' + step + ')')()
    }, { game, step: String(STEP[game] || '') }).catch(() => 'wait')
    if (r === 'done') break
    if (r.startsWith('bee:')) {
      const w = r.slice(4)
      try { await k.fr.fill('#g-in', w); await k.fr.press('#g-in', 'Enter') } catch { /* hết giờ */ }
      await k.fr.waitForFunction((prev) => !G || !G.cur || G.cur.w !== prev || S.view !== 'game', w, { timeout: 5000 }).catch(() => {})
      n++; await sleep(pace); continue
    }
    if (r === 'solved') { n++; await sleep(pace) } else await sleep(120)
  }
  return n
}
const played = (k) => ev(k, () => window.__played || [])
const dupsOf = (arr) => { const c = {}; for (const x of arr) c[x.toLowerCase()] = (c[x.toLowerCase()] || 0) + 1; return Object.entries(c).filter(([, v]) => v > 1).map(([w, v]) => w + '×' + v) }
const waitStatus = (k, s, timeout = 20000) => k.fr.waitForFunction((x) => window.Arena._A.st && window.Arena._A.st.status === x, s, { timeout })

// ======================= M1 =======================
if (only === 'all' || only === 'm1') {
  console.log(`— M1. Phòng 2 bạn "Đoán từ" 2 phút, chơi thật nhanh (${BASE})`)
  await mock('/reset').catch(() => {})
  const A = await kid({ id: 'kidM1a', name: 'Alex', icon: '🦊', grade: 'Lớp 7' }), B = await kid({ id: 'kidM1b', name: 'Bin', icon: '🐻', grade: 'Lớp 4' })
  await room(A, B, { game: 'wordle', minutes: 2, req: '' })
  const calls0 = ((await mock().catch(() => ({ calls: [] }))).calls || []).length
  await A.fr.click('[data-arena="start"]')
  await A.fr.waitForFunction(() => S.view === 'game' && G && G.arena && G.def.id === 'wordle', null, { timeout: 20000 })
  const st = await ev(A, () => ({ end: window.Arena._A.st.round.end, now: Date.now() + window.Arena._A.offset, base: (window.Arena._A.words[window.Arena._A.st.round.n] || []).length }))
  const until = Date.now() + (st.end - st.now) + 1500
  const [na, nb] = await Promise.all([autoPlay(A, 'wordle', { pace: 700, until }), autoPlay(B, 'wordle', { pace: 1000, until })])
  await waitStatus(A, 'results', 25000).catch(() => {})
  const pa = (await played(A)).map((x) => x.w), pb = (await played(B)).map((x) => x.w)
  console.log(`    Alex chơi ${pa.length} từ, Bin chơi ${pb.length} từ (bộ đầu ${st.base} từ)`)
  check(`Alex chơi được rất nhiều từ (${pa.length}) — hơn hẳn bộ 25 từ đầu`, pa.length >= 60, String(pa.length))
  check('Alex: không từ nào lặp lại trong cả ván', dupsOf(pa).length === 0, dupsOf(pa).join(', '))
  check('Bin: không từ nào lặp lại trong cả ván', pb.length >= 40 && dupsOf(pb).length === 0, `${pb.length} · ${dupsOf(pb).join(', ')}`)
  const xa = await ev(A, () => { const A_ = window.Arena._A, X = A_.xw || {}; return (X[A_.st.round ? A_.st.round.n : A_.wn] || X[A_.wn] || []).map((w) => w.w) })
  const xb = await ev(B, () => { const A_ = window.Arena._A, X = A_.xw || {}; return (X[A_.st.round ? A_.st.round.n : A_.wn] || X[A_.wn] || []).map((w) => w.w) })
  if (!BASE.endsWith('4195')) {
    const calls = ((await mock()).calls || []).length - calls0
    check(`máy tự xin thêm từ mới khi sắp hết (AI tạo thêm ${calls - 1} lần)`, calls >= 3 && xa.length >= 50, `calls ${calls} · extra ${xa.length}`)
    check('hai bạn nhận cùng một bộ từ thêm (cả phòng dùng chung)', xa.length > 0 && xa.join(',') === xb.join(','), `${xa.length} vs ${xb.length}`)
    const fin = await ev(A, () => { const st = window.Arena._A.st, last = st.last || {}; return { rank: last.rank || [], status: st.status } })
    const ra = fin.rank.find((x) => x.n === 'Alex') || {}
    const goodA = (await played(A)).filter((x) => x.c >= 1).length
    check(`điểm của Alex = 10 × số từ đúng (${goodA} từ → ${goodA * 10} điểm)`, fin.status === 'results' && ra.p === goodA * 10, JSON.stringify(ra))
  }
  check('M1 không lỗi trang', A.errs.length + B.errs.length === 0, A.errs.concat(B.errs).join(' | '))
  await A.ctx.close(); await B.ctx.close()
}

// ======================= M2 =======================
if (only === 'all' || only === 'm2') {
  console.log('— M2. "10 từ mới nhất" (từ của mình) + Nghe – Viết')
  const A = await kid({ id: 'kidM2a', name: 'Alex', icon: '🦊', grade: 'Lớp 7' }), B = await kid({ id: 'kidM2b', name: 'Bin', icon: '🐻', grade: 'Lớp 4' })
  const own = await ev(A, () => { const out = []; for (const s of S.sets || []) for (const w of s.words || []) out.push(w.w); return out })
  await room(A, B, { game: 'bee', minutes: 1, req: '10 từ mới nhất' })
  await A.fr.click('[data-arena="start"]')
  await A.fr.waitForFunction(() => S.view === 'game' && G && G.arena && G.def.id === 'bee', null, { timeout: 20000 })
  const st = await ev(A, () => ({ end: window.Arena._A.st.round.end, now: Date.now() + window.Arena._A.offset }))
  const until = Date.now() + (st.end - st.now) + 1500
  await Promise.all([autoPlay(A, 'bee', { pace: 250, until }), autoPlay(B, 'bee', { pace: 1500, until })])
  await waitStatus(A, 'results', 25000).catch(() => {})
  const pa = (await played(A)).map((x) => x.w)
  const ownSet = new Set(own.map((w) => w.toLowerCase()))
  console.log(`    kho từ của Alex: ${own.length} từ · Alex chơi ${pa.length} từ`)
  check('10 từ đầu tiên đều là từ trong kho của con', pa.length >= 10 && pa.slice(0, 10).every((w) => ownSet.has(w.toLowerCase())), pa.slice(0, 10).join(','))
  check(`chơi hết từ của mình thì sang từ khác (chơi ${pa.length} từ, kho chỉ có ${own.length})`, pa.length > own.length && pa.some((w) => !ownSet.has(w.toLowerCase())), String(pa.length))
  check('không từ nào lặp lại', dupsOf(pa).length === 0, dupsOf(pa).join(', '))
  check('M2 không lỗi trang', A.errs.length + B.errs.length === 0, A.errs.concat(B.errs).join(' | '))
  await A.ctx.close(); await B.ctx.close()
}

// ======================= M3 =======================
if (only === 'all' || only === 'm3') {
  console.log('— M3. "Trang trọng hay thân mật": cặp từ không lặp lại trong ván')
  const A = await kid({ id: 'kidM3a', name: 'Alex', icon: '🦊', grade: 'Lớp 7' }), B = await kid({ id: 'kidM3b', name: 'Bin', icon: '🐻', grade: 'Lớp 4' })
  await room(A, B, { game: 'register', minutes: 2, req: '' })
  await A.fr.click('[data-arena="start"]')
  await A.fr.waitForFunction(() => S.view === 'game' && G && G.arena && G.def.id === 'register', null, { timeout: 20000 })
  const st = await ev(A, () => ({ end: window.Arena._A.st.round.end, now: Date.now() + window.Arena._A.offset }))
  const until = Date.now() + (st.end - st.now) + 1500
  await Promise.all([autoPlay(A, 'register', { pace: 1300, until }), autoPlay(B, 'register', { pace: 1500, until })])
  await waitStatus(A, 'results', 25000).catch(() => {})
  const pa = (await played(A)).map((x) => x.w)
  console.log(`    Alex chơi ${pa.length} cặp`)
  check(`chơi qua nhiều lượt (${pa.length} cặp, mỗi lượt 10 cặp)`, pa.length >= 25, String(pa.length))
  check('không cặp nào lặp lại giữa các lượt', dupsOf(pa).length === 0, dupsOf(pa).join(', '))
  check('M3 không lỗi trang', A.errs.length + B.errs.length === 0, A.errs.concat(B.errs).join(' | '))
  await A.ctx.close(); await B.ctx.close()
}

await browser.close()
const fails = Object.entries(results).filter(([, v]) => v !== 'PASS')
console.log(fails.length ? `FAILED ${fails.length}/${Object.keys(results).length}: ` + fails.map(([k]) => k).join(' | ') : `ALL PASS ✓ (${Object.keys(results).length} checks)`)
