// File "sua 26 Oct 2026" — thử qua giao diện thật (Vở Spelling trong Ôn Tập, điện thoại 390px):
//  N1 trang chính: thẻ Scrabble KHÔNG còn đứng cạnh "Thi đấu với bạn"; Scrabble là thẻ trong danh sách "Chọn trò chơi"
//  N2 bấm thẻ Scrabble -> màn Scrabble; nút quay lại về danh sách trò chơi; màn Thi đấu chỉ còn 3 lựa chọn (không có Scrabble)
//  N3 chơi Scrabble với Bạn ONTAP (nhãn "máy"), rời phòng -> về màn Scrabble
//  N4 phòng thi: gợi ý "Để ONTAP chọn chủ đề", phạm vi từ "ONTAP tạo", nút "Thêm Bạn ONTAP"
//  N5 trò Xếp chữ: lúc chơi chỉ có chữ xáo trộn + "Gợi ý 1 chữ"; xếp xong mới hiện hình + nghĩa
//  N6 không còn chữ "AI" ở mọi màn đã đi qua (trang chính, tạo bộ từ, Thi đấu, Scrabble, phòng, trò chơi)
import { pw, OUT_DIR } from './_env.mjs'
import { useRealFonts } from './fonts.mjs'
const OUT = OUT_DIR
const BASE = process.env.BASE || 'http://localhost:4192'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const browser = await pw.chromium.launch({ headless: true })
const results = {}
const check = (n, c, x = '') => { results[n] = c ? 'PASS' : 'FAIL'; console.log((c ? '  ✓ ' : '  ✗ ') + n + (c || !x ? '' : '  → ' + x)) }
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
// chữ "AI" (đứng riêng) trên màn hình đang hiện, kể cả chữ trong nút / nhãn / ô gợi ý (aria-label, title, placeholder)
const aiWords = (k) => ev(k, () => {
  const txt = [document.body.innerText]
  for (const el of document.querySelectorAll('[aria-label],[title],[placeholder]')) txt.push(el.getAttribute('aria-label') || '', el.getAttribute('title') || '', el.getAttribute('placeholder') || '')
  const all = txt.join('\n'); const out = []
  for (const m of all.matchAll(/(.{0,30})\bAI\b(.{0,30})/g)) out.push(m[0])
  return out
})
const seenAI = []
const noAI = async (k, where) => { const w = await aiWords(k); if (w.length) seenAI.push(where + ': ' + w.join(' | ')); return w.length === 0 }

const A = await kid({ id: 'kidN', name: 'Alex', icon: '🦊', grade: 'Lớp 7' })
console.log('— N1. Trang chính Vở Spelling')
await A.fr.waitForSelector('.gcard.sbcard', { timeout: 8000 })
const home = await ev(A, () => ({ entries: [...document.querySelectorAll('.arena-entry')].map((e) => e.textContent.replace(/\s+/g, ' ').trim()), cards: [...document.querySelectorAll('.ggrid .gcard')].map((e) => e.querySelector('.gt').textContent), sbInGrid: !!document.querySelector('.ggrid .gcard.sbcard') }))
check('cạnh thẻ "Thi đấu với bạn" không còn thẻ Scrabble (chỉ 1 thẻ Thi đấu)', home.entries.length === 1 && /Thi đấu với bạn/.test(home.entries[0]) && !/Scrabble/.test(home.entries[0]), JSON.stringify(home.entries))
check('Scrabble là thẻ cuối trong danh sách "Chọn trò chơi" (12 trò)', home.sbInGrid && home.cards.length === 12 && home.cards.at(-1) === 'Scrabble', JSON.stringify(home.cards))
check('trang chính không còn chữ "AI"', await noAI(A, 'trang chính'))
await A.page.screenshot({ path: `${OUT}/n1_home.png`, fullPage: false })
await A.fr.evaluate(() => document.querySelector('.gcard.sbcard').scrollIntoView({ block: 'center' }))
await A.page.screenshot({ path: `${OUT}/n1_grid.png` })

console.log('— N2. Thẻ Scrabble -> màn Scrabble; quay lại; màn Thi đấu')
await A.fr.click('.gcard.sbcard'); await A.fr.waitForSelector('.sb-menu')
const sbm = await A.fr.textContent('.sb-menu')
check('màn Scrabble: "Chơi với Bạn ONTAP", người chơi máy ghi rõ chữ "máy"', /Chơi với Bạn ONTAP/.test(sbm) && /người chơi máy/.test(sbm), sbm.slice(0, 200))
check('màn Scrabble không còn chữ "AI"', await noAI(A, 'màn Scrabble'))
await A.fr.click('.sb-menu .page-h .iconbtn')
await A.fr.waitForSelector('.ggrid', { timeout: 5000 })
check('nút quay lại ở màn Scrabble -> về danh sách trò chơi', (await ev(A, () => S.view)) === 'home')
await A.fr.click('.arena-entry'); await A.fr.waitForSelector('.ar-cards')
const menuTxt = await A.fr.textContent('.ar-cards')
check('màn Thi đấu: 3 lựa chọn, không còn thẻ Scrabble; nói rõ Bạn ONTAP là người chơi máy', (await A.fr.locator('.ar-card').count()) === 3 && !/Scrabble/.test(menuTxt) && /Bạn ONTAP \(người chơi máy\)/.test(menuTxt), menuTxt)
check('màn Thi đấu không còn chữ "AI"', await noAI(A, 'màn Thi đấu'))

console.log('— N3. Scrabble với Bạn ONTAP, rời phòng -> về màn Scrabble')
await A.fr.click('.page-h .iconbtn'); await A.fr.waitForSelector('.ggrid')
await A.fr.click('.gcard.sbcard'); await A.fr.waitForSelector('.sb-menu')
await A.fr.selectOption('#sb-min', '10')
await A.fr.click('[data-arena="solo"]')
await A.fr.waitForSelector('#sb-board', { timeout: 9000 })
const pls = await A.fr.textContent('#sb-pls')
check('người chơi máy hiện "🤖 Bạn ONTAP <tên>" + nhãn "máy"', /🤖\s*Bạn ONTAP \S+/.test(pls) && (await A.fr.textContent('#sb-pls .ai-tag')) === 'máy', pls)
check('bàn Scrabble không còn chữ "AI"', await noAI(A, 'bàn Scrabble'))
await A.page.screenshot({ path: `${OUT}/n3_board.png` })
await A.fr.click('[data-arena="leave"]'); await A.fr.click('[data-arena="leaveyes"]')
await A.fr.waitForSelector('.sb-menu', { timeout: 5000 }).catch(() => {})
check('rời phòng Scrabble -> về màn Scrabble (không sang màn Thi đấu)', (await A.fr.locator('.sb-menu').count()) === 1 && (await ev(A, () => window.Arena._A.code)) === '')

console.log('— N4. Phòng thi: chữ ONTAP thay cho AI')
await A.fr.click('.sb-menu .page-h .iconbtn'); await A.fr.waitForSelector('.ggrid')
await A.fr.click('.arena-entry'); await A.fr.waitForSelector('.ar-cards')
await A.fr.click('[data-arena="create"]'); await A.fr.waitForSelector('.ar-digits')
const chips = await ev(A, () => [...document.querySelectorAll('[data-arena-sug]')].map((b) => b.dataset.arenaSug))
check('ô gợi ý có "Để ONTAP chọn chủ đề"', chips.includes('Để ONTAP chọn chủ đề') && !chips.some((c) => /\bAI\b/.test(c)), JSON.stringify(chips))
await A.fr.fill('#ar-req', 'Fruits')
await A.fr.waitForFunction(() => /Fruits/.test(window.Arena._A.st.cfg.ruleText || ''), null, { timeout: 6000 })
await A.fr.click('[data-arena-sug="Để ONTAP chọn chủ đề"]')
await A.fr.waitForFunction(() => (window.Arena._A.st.cfg.req || '') === '' && /ONTAP tạo theo trình độ/.test(window.Arena._A.st.cfg.ruleText || ''), null, { timeout: 6000 }).catch(() => {})
const rule = await ev(A, () => window.Arena._A.st.cfg.ruleText)
check('bấm "Để ONTAP chọn chủ đề": phạm vi từ "Cả phòng chung bộ từ ONTAP tạo theo trình độ… hết từ thì ONTAP tạo thêm"', /^Cả phòng chung bộ từ ONTAP tạo theo trình độ/.test(rule) && /hết từ thì ONTAP tạo thêm/.test(rule), rule)
check('nút "＋ Thêm Bạn ONTAP"', /Thêm Bạn ONTAP/.test(await A.fr.textContent('[data-arena="aiadd"]')))
await A.fr.click('[data-arena="aiadd"]')
await A.fr.waitForFunction(() => window.Arena._A.st.players.length === 2, null, { timeout: 6000 })
const pl2 = await A.fr.textContent('#ar-players')
check('thêm người chơi máy: "Bạn ONTAP <tên>" + nhãn "máy"', /Bạn ONTAP \S+/.test(pl2) && /máy/.test(pl2), pl2)
check('phòng thi không còn chữ "AI"', await noAI(A, 'phòng thi'))
await A.page.screenshot({ path: `${OUT}/n4_lobby.png` })
await A.fr.click('[data-arena="leave"]'); await A.fr.click('[data-arena="leaveyes"]')
await A.fr.waitForSelector('.ar-cards', { timeout: 5000 })

console.log('— N5. Trò Xếp chữ')
await A.fr.click('.page-h .iconbtn'); await A.fr.waitForSelector('.ggrid')
await A.fr.click('.gcard[data-game="scramble"]'); await A.fr.waitForSelector('#g-bank')
const st0 = await ev(A, () => ({ clue: document.querySelector('#g-clue').innerHTML.trim(), say: document.querySelectorAll('#g-stage [data-say]').length, hint: !!document.querySelector('#g-hint'), w: G.cur.w, vi: G.cur.vi, e: G.cur.e, len: G.cur.w.replace(/[^a-z]/gi, '').length }))
check('lúc chơi: không có hình, nghĩa, nút Nghe / Đọc chậm / Nghe câu', st0.clue === '' && st0.say === 0, JSON.stringify(st0))
check('vẫn có nút "Gợi ý 1 chữ"', st0.hint || st0.len <= 2, JSON.stringify(st0))
await A.page.screenshot({ path: `${OUT}/n5_play.png` })
await ev(A, (w) => { for (const ch of w.toLowerCase()) if (/[a-z]/.test(ch)) G.keyFn({ key: ch, preventDefault() {} }) }, st0.w)
await A.fr.waitForFunction(() => document.querySelector('#g-clue') && document.querySelector('#g-clue').innerHTML.trim() !== '', null, { timeout: 4000 }).catch(() => {})
const st1 = await ev(A, () => ({ clue: document.querySelector('#g-clue') ? document.querySelector('#g-clue').textContent : '', fb: (document.querySelector('#g-fb') || {}).textContent || '' }))
check(`xếp xong mới hiện hình + nghĩa ("${st0.vi}")`, st1.clue.includes(st0.vi) && (!st0.e || st1.clue.includes(st0.e)), JSON.stringify(st1))
await A.page.screenshot({ path: `${OUT}/n5_done.png` })
await A.fr.waitForFunction((w) => G && G.cur && G.cur.w !== w, st0.w, { timeout: 5000 }).catch(() => {})
const st2 = await ev(A, () => ({ clue: document.querySelector('#g-clue').innerHTML.trim(), i: G.items.length }))
check('sang từ tiếp theo: lại chỉ có chữ xáo trộn (không hiện nghĩa)', st2.clue === '' && st2.i === 1, JSON.stringify(st2))
check('trò Xếp chữ không còn chữ "AI"', await noAI(A, 'Xếp chữ'))

console.log('— N6. Tạo bộ từ theo chủ đề')
await A.fr.click('[data-act="home"]'); await A.fr.waitForSelector('.ggrid')
await A.fr.click('[data-act="new"][data-mode="type"]')
await A.fr.waitForSelector('#view .sheet, #view .create, #view form', { timeout: 5000 }).catch(() => {})
await sleep(500)
const modeBtn = await A.fr.$('[data-mode="topic"], [data-cmode="topic"]')
if (modeBtn) { await modeBtn.click(); await sleep(400) }
const ct = await A.fr.textContent('#view')
check('màn tạo bộ từ: "Nhờ ONTAP …", không còn chữ "AI"', /ONTAP/.test(ct) && await noAI(A, 'tạo bộ từ'), ct.replace(/\s+/g, ' ').slice(0, 220))
await A.page.screenshot({ path: `${OUT}/n6_create.png` })

check('không lỗi trang', A.errs.length === 0, A.errs.join(' | '))
if (seenAI.length) console.log('    còn chữ AI: ' + seenAI.join(' || '))
await A.ctx.close()
await browser.close()
const fails = Object.entries(results).filter(([, v]) => v !== 'PASS')
console.log(fails.length ? `FAILED ${fails.length}/${Object.keys(results).length}: ` + fails.map(([k]) => k).join(' | ') : `ALL PASS ✓ (${Object.keys(results).length} checks)`)
