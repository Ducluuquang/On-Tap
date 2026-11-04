// Ô CHỌN TỰ VẼ, chữ to (anh báo 04/11/2026, ảnh "Thách đấu ngẫu nhiên": "drop list chữ quá nhỏ").
// Danh sách xổ xuống của trình duyệt (<select>) do trình duyệt tự vẽ, không theo cỡ chữ của trang (nhất là máy tính)
// -> mọi ô chọn được vẽ ngay trong trang, chữ trong danh sách to bằng chữ trong ô.
//  S  Vở Spelling · Thách đấu ngẫu nhiên: Trình độ / Trò chơi / Số phút không còn danh sách của trình duyệt; danh sách
//     "Trình độ" có 2 nhóm + 8 mức, chữ 16px như trong ô, dòng cao ≥ 44px, đánh dấu mức đang chọn; chọn bằng chạm và bàn phím;
//     bấm ra ngoài / Esc thì đóng; "Tìm bạn thi" gửi đúng lựa chọn lên máy chủ; màn 320px không tràn ngang.
//  O  Phòng thi, chủ phòng đang mở danh sách thì có bạn vào phòng -> danh sách không tự đóng; chọn xong bạn kia thấy đúng.
//  C  Vở Spelling · Thêm bộ từ theo chủ đề: ô Trình độ + Số từ chọn được, giữ đúng khi màn vẽ lại.
//  R  Ôn Tập · Đăng ký: ô "Lớp" tự vẽ (12 lớp, chữ to), tô đỏ khi chưa chọn; điện thoại 390px + máy tính (app phóng to).
//  A  Ôn Tập · Nội dung đã đọc được: ô "Môn" tự vẽ, danh sách nổi không bị cắt, đổi môn được.
// Đối chứng: chạy với bản cũ (BASE=…) thì các phần trên phải hỏng (bản cũ còn <select>).
import { pw, OUT_DIR } from './_env.mjs'
import { useRealFonts } from './fonts.mjs'
const OUT = OUT_DIR
const BASE = process.env.BASE || 'http://localhost:4192'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const browser = await pw.chromium.launch({ headless: true })
const results = {}
const check = (n, c, x = '') => { results[n] = c ? 'PASS' : 'FAIL'; console.log((c ? '  ✓ ' : '  ✗ ') + n + (c || !x ? '' : '  → ' + x)) }
const only = process.argv[2] || 'all'
const RUN = Date.now().toString(36).slice(-4)
const ctxs = []
// mỗi phần chạy riêng: lỗi bất ngờ (vd bản cũ không có ô tự vẽ) ghi thành 1 kiểm tra HỎNG rồi chạy tiếp phần sau
async function part(key, title, fn) {
  if (only !== 'all' && only !== key) return
  console.log('— ' + title)
  try { await fn() } catch (e) { if (process.env.DEBUG) console.log(e); check(`${key.toUpperCase()}: chạy hết phần "${title}"`, false, String(e && e.message || e).split("\n")[0]) }
  while (ctxs.length) await ctxs.pop().close().catch(() => {})
}
const watchErrs = (page, errs) => {
  page.on('pageerror', (e) => errs.push('pageerror: ' + e.message))
  page.on('console', (m) => { if (m.type() === 'error' && !/favicon|fonts\.g|status of 4\d\d/.test(m.text())) errs.push('console: ' + m.text()) })
}

// con đã đăng nhập, mở thẳng Ôn Tập; spelling=true: vào luôn Vở Spelling (khung trong Ôn Tập)
async function kid({ id, name = 'Hoa', icon = '🌸', grade = 'Lớp 7', width = 390, height = 844, spelling = true, mem = null } = {}) {
  id = id + RUN
  const ACC = { username: '09' + id, password: '1', phone: '09' + id, parentPass: '1', plan: 1, pin: '3', children: [{ id, name, pin: '', icon, grade }] }
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 2 }); ctxs.push(ctx)
  await useRealFonts(ctx)
  await ctx.addInitScript(({ ACC, id, mem }) => {
    if (window.top !== window) return
    if (sessionStorage.getItem('s')) return; sessionStorage.setItem('s', '1'); localStorage.clear()
    localStorage.setItem('ontap.account.v1', JSON.stringify(ACC)); localStorage.setItem('ontap.session.v1', '1'); localStorage.setItem('ontap.activechild.v1', id)
    if (mem) localStorage.setItem('ontap.memory.v2::' + id, JSON.stringify(mem))
  }, { ACC, id, mem })
  const page = await ctx.newPage()
  const errs = []
  watchErrs(page, errs)
  await page.goto(BASE + '/', { waitUntil: 'networkidle' })
  await page.waitForSelector('.kh-cta', { timeout: 10000 })
  if (!spelling) return { ctx, page, errs }
  await page.click('.kh-cta')
  await page.locator('button:has-text("Tiếng Anh")').first().click()
  await page.click('.cr-vocab')
  await page.waitForSelector('iframe.spelling-frame')
  let fr = null
  for (let i = 0; i < 50 && !fr; i++) { fr = page.frames().find((x) => x.url().includes('/spelling/')); if (!fr) await sleep(100) }
  await fr.waitForSelector('#view .page, #view .home', { timeout: 10000 })
  return { ctx, page, fr, errs }
}
async function toRandom(K) {
  await K.fr.waitForSelector('.arena-entry:not(.sbe)', { timeout: 8000 })
  await K.fr.click('.arena-entry:not(.sbe)'); await K.fr.waitForSelector('.ar-cards')
  await K.fr.click('[data-arena="randomform"]'); await K.fr.waitForSelector('#ar-rlevel-pick', { timeout: 5000 })
}
// trạng thái các ô chọn tự vẽ của Vở Spelling
const vsState = (fr) => fr.evaluate(() => {
  const vis = (e) => { const r = e.getBoundingClientRect(); return r.width > 2 && r.height > 2 && getComputedStyle(e).opacity !== '0' }
  return {
    shownSelects: [...document.querySelectorAll('#view select')].filter(vis).length,
    btns: [...document.querySelectorAll('#view .vs-pick-btn')].map((b) => b.textContent.trim()),
    open: [...document.querySelectorAll('#view .vs-pick.open')].map((p) => (p.querySelector('select') || {}).id),
    focus: document.activeElement ? document.activeElement.id || document.activeElement.textContent.trim() : '',
  }
})
const vsList = (fr, selId) => fr.evaluate((selId) => {
  const sel = document.getElementById(selId), box = sel.closest('.vs-pick'), btn = box.querySelector('.vs-pick-btn')
  const items = [...box.querySelectorAll('.vs-pick-list > *')]
  return {
    bfs: parseFloat(getComputedStyle(btn).fontSize), expanded: btn.getAttribute('aria-expanded'),
    groups: items.filter((e) => e.classList.contains('vs-pick-grp')).map((e) => e.textContent.trim()),
    opts: items.filter((e) => e.classList.contains('vs-pick-opt')).map((e) => ({ t: e.textContent.trim(), fs: parseFloat(getComputedStyle(e).fontSize), h: Math.round(e.getBoundingClientRect().height), sel: e.getAttribute('aria-selected'), clip: e.scrollWidth > e.clientWidth + 1 })),
    nativeGroups: [...sel.querySelectorAll('optgroup')].map((g) => g.label), nativeOpts: [...sel.options].map((o) => o.textContent),
  }
}, selId)

// ======================= S — Thách đấu ngẫu nhiên =======================
await part('s', 'S. Vở Spelling · Thách đấu ngẫu nhiên', async () => {
  const K = await kid({ id: 'kidS' })
  const sent = []
  K.page.on('request', (r) => { if (r.url().includes('/api/arena') && r.method() === 'POST') { try { const b = JSON.parse(r.postData() || '{}'); if (b.action === 'random') sent.push(b) } catch { /* noop */ } } })
  await toRandom(K)
  const s0 = await vsState(K.fr)
  check('S: 3 ô chọn tự vẽ, không còn danh sách của trình duyệt; hiện đúng "Lớp 6–9 · THCS (A2)" (lớp 7) · "Nghe – Viết" · "2 phút"',
    s0.shownSelects === 0 && s0.btns.length === 3 && /^Lớp 6.9 · THCS \(A2\)$/.test(s0.btns[0]) && /^Nghe . Viết$/.test(s0.btns[1]) && s0.btns[2] === '2 phút', JSON.stringify(s0))
  await K.page.screenshot({ path: `${OUT}/pick_random.png` })

  await K.fr.click('#ar-rlevel-pick'); await sleep(300)
  const L = await vsList(K.fr, 'ar-rlevel')
  check('S: mở "Trình độ": đủ 2 nhóm "Theo lớp ở trường", "Nâng cao · chuẩn quốc tế" + 8 mức, đúng thứ tự như trước',
    L.expanded === 'true' && L.groups.length === 2 && L.groups[0] === 'Theo lớp ở trường' && JSON.stringify(L.groups) === JSON.stringify(L.nativeGroups) && L.opts.length === 8 && JSON.stringify(L.opts.map((o) => o.t)) === JSON.stringify(L.nativeOpts), JSON.stringify(L))
  check(`S: chữ trong danh sách TO BẰNG chữ trong ô (${L.bfs}px ≥ 16px), mỗi dòng cao ≥ 44px, không cắt chữ`, L.bfs >= 16 && L.opts.every((o) => o.fs === L.bfs && o.h >= 44 && !o.clip), JSON.stringify(L.opts))
  check('S: dòng đang chọn có đánh dấu (Lớp 6–9 · THCS (A2))', L.opts.filter((o) => o.sel === 'true').map((o) => o.t).join('|') === s0.btns[0], JSON.stringify(L.opts.map((o) => o.sel)))
  await K.page.screenshot({ path: `${OUT}/pick_level_open.png` })

  await K.fr.click('.vs-pick-opt:has-text("B2 · IELTS")')
  const s1 = await vsState(K.fr)
  const v1 = await K.fr.evaluate(() => ({ v: document.querySelector('#ar-rlevel').value, lvl: window.Arena._A.rnd.level }))
  check('S: chạm "B2 · IELTS 5.5–6.5" -> danh sách đóng, ô hiện B2, giá trị đổi đúng (b2)', s1.open.length === 0 && /^B2 · IELTS 5\.5.6\.5$/.test(s1.btns[0]) && v1.v === 'b2' && v1.lvl === 'b2' && s1.focus === 'ar-rlevel-pick', JSON.stringify({ s1, v1 }))

  await K.fr.click('#ar-rgame-pick'); await K.fr.click('.vs-pick-opt:has-text("Scrabble")')
  await K.fr.waitForFunction(() => (document.querySelector('#ar-rmin-pick') || {}).textContent === '20 phút', null, { timeout: 4000 }).catch(() => {})
  const s2 = await vsState(K.fr)
  check('S: chọn trò Scrabble -> màn vẽ lại, ô Số phút thành "20 phút", Trình độ vẫn B2', s2.btns.length === 3 && /^Scrabble/.test(s2.btns[1]) && s2.btns[2] === '20 phút' && /^B2 /.test(s2.btns[0]) && s2.shownSelects === 0, JSON.stringify(s2))

  // bàn phím: ↓ mở danh sách tại dòng đang chọn, ↓ sang dòng dưới, Enter chọn; Esc đóng không đổi
  await K.fr.focus('#ar-rmin-pick'); await K.page.keyboard.press('ArrowDown'); await sleep(100)
  const k1 = await vsState(K.fr)
  await K.page.keyboard.press('ArrowDown'); await sleep(50)
  const k2 = await vsState(K.fr)
  await K.page.keyboard.press('Enter'); await sleep(100)
  const k3 = await vsState(K.fr)
  const kv = await K.fr.evaluate(() => ({ v: document.querySelector('#ar-rmin').value, m: window.Arena._A.rnd.minutes }))
  check('S: bàn phím: ↓ mở ở dòng "20 phút", ↓ sang "30 phút", Enter chọn 30 phút, con trỏ về lại ô',
    k1.open[0] === 'ar-rmin' && k1.focus === '20 phút' && k2.focus === '30 phút' && k3.open.length === 0 && k3.btns[2] === '30 phút' && kv.v === '30' && kv.m === 30 && k3.focus === 'ar-rmin-pick', JSON.stringify({ k1, k2, k3, kv }))
  await K.page.keyboard.press('ArrowDown'); await sleep(50); await K.page.keyboard.press('ArrowDown'); await K.page.keyboard.press('Escape'); await sleep(100)
  const k4 = await vsState(K.fr)
  check('S: Esc đóng danh sách, giữ nguyên 30 phút', k4.open.length === 0 && k4.btns[2] === '30 phút' && (await K.fr.inputValue('#ar-rmin')) === '30', JSON.stringify(k4))

  await K.fr.click('#ar-rlevel-pick'); await K.fr.click('.page-h h1'); await sleep(100)
  const o1 = await vsState(K.fr)
  await K.fr.click('label[for="ar-rlevel-pick"]'); await sleep(100)
  const o2 = await vsState(K.fr)
  await K.page.keyboard.press('Escape')
  check('S: bấm ra ngoài -> đóng; bấm vào chữ "Trình độ" -> mở danh sách', o1.open.length === 0 && o2.open[0] === 'ar-rlevel', JSON.stringify({ o1, o2 }))

  await K.fr.click('[data-arena="random"]')
  await K.fr.waitForFunction(() => window.Arena._A.st && window.Arena._A.st.status === 'waiting', null, { timeout: 10000 })
  check('S: "Tìm bạn thi" gửi đúng lựa chọn lên máy chủ: trình độ b2, Scrabble, 30 phút', sent.length >= 1 && sent[0].level === 'b2' && sent[0].game === 'scrabble' && Number(sent[0].minutes) === 30, JSON.stringify(sent))
  await K.fr.locator('[data-arena="leaveyes"]').first().click().catch(() => {})
  check('S: không lỗi trang', K.errs.length === 0, K.errs.join(' | '))

  // màn hẹp 320px: danh sách không làm tràn ngang, chữ không bị cắt (tên dài xuống dòng)
  const N = await kid({ id: 'kidSn', width: 320, height: 700 })
  await toRandom(N)
  await N.fr.click('#ar-rgame-pick'); await sleep(200)
  const G = await vsList(N.fr, 'ar-rgame')
  const nov = await N.fr.evaluate(() => document.scrollingElement.scrollWidth <= document.scrollingElement.clientWidth + 1)
  check('S: 320px: danh sách Trò chơi không tràn ngang, không cắt chữ, chữ vẫn 16px', nov && G.opts.length >= 10 && G.opts.every((o) => !o.clip && o.fs >= 16), JSON.stringify({ nov, G: G.opts.slice(0, 3) }))
  await N.page.screenshot({ path: `${OUT}/pick_320_game.png`, fullPage: false })
})

// ======================= O — phòng thi, có bạn vào lúc đang chọn =======================
await part('o', 'O. Phòng thi: đang mở danh sách thì có bạn vào phòng', async () => {
  const A = await kid({ id: 'kidOA', name: 'An', icon: '🦊' })
  await A.fr.waitForSelector('.arena-entry:not(.sbe)', { timeout: 8000 })
  await A.fr.click('.arena-entry:not(.sbe)'); await A.fr.waitForSelector('.ar-cards')
  await A.fr.click('[data-arena="create"]'); await A.fr.waitForSelector('.ar-digits', { timeout: 10000 })
  const code = (await A.fr.textContent('.ar-digits')).replace(/\D/g, '')
  await A.fr.waitForSelector('#ar-level-pick', { timeout: 8000 })
  await A.fr.click('#ar-level-pick')
  const B = await kid({ id: 'kidOB', name: 'Bình', icon: '🐼', grade: 'Lớp 5' })
  await B.fr.waitForSelector('.arena-entry:not(.sbe)', { timeout: 8000 })
  await B.fr.click('.arena-entry:not(.sbe)'); await B.fr.waitForSelector('.ar-cards')
  await B.fr.click('[data-arena="joinform"]'); await B.fr.fill('#ar-code', code); await B.fr.click('[data-arena="join"]')
  await A.fr.waitForFunction(() => /Bình/.test((document.querySelector('#ar-players') || {}).textContent || ''), null, { timeout: 20000 })
  await sleep(2500)   // thêm vài nhịp hỏi máy chủ
  const s = await vsState(A.fr)
  check('O: chủ phòng đang mở danh sách Trình độ, bạn Bình vào phòng -> danh sách vẫn mở, đã thấy Bình trong phòng', s.open[0] === 'ar-level', JSON.stringify(s))
  await A.fr.click('.vs-pick-opt:has-text("C1 · IELTS")')
  let seen = true
  try { await B.fr.waitForFunction(() => /C1 · IELTS 7\.0.8\.0/.test((document.querySelector('#view') || {}).textContent || ''), null, { timeout: 20000 }) } catch { seen = false }
  check('O: chủ phòng chọn C1 -> bạn Bình thấy "Trình độ: C1 · IELTS 7.0–8.0"', seen, (await B.fr.textContent('#view')).slice(0, 300))
  await sleep(1500)
  const s2 = await vsState(A.fr)
  check('O: chọn xong, màn chủ phòng vẽ lại bình thường (ô Trình độ = C1, không còn danh sách mở)', s2.open.length === 0 && s2.btns.some((b) => /^C1 · IELTS/.test(b)) && s2.shownSelects === 0, JSON.stringify(s2))
  check('O: không lỗi trang', A.errs.length + B.errs.length === 0, A.errs.concat(B.errs).join(' | '))
})

// ======================= C — Thêm bộ từ theo chủ đề =======================
await part('c', 'C. Vở Spelling · Thêm bộ từ theo chủ đề', async () => {
  const K = await kid({ id: 'kidC' })
  const toTopic = async () => {
    if (await K.fr.locator('[data-act="new"][data-mode="topic"]').count()) await K.fr.click('[data-act="new"][data-mode="topic"]')
    else { await K.fr.click('[data-act="new"]'); await K.fr.click('[data-mode-tab="topic"]') }
    await K.fr.waitForSelector('#c-level-pick', { timeout: 8000 })
  }
  await toTopic()
  const s0 = await vsState(K.fr)
  check('C: ô "Trình độ" + "Số từ" tự vẽ, không còn danh sách của trình duyệt', s0.shownSelects === 0 && s0.btns.length === 2, JSON.stringify(s0))
  await K.fr.click('#c-count-pick'); await sleep(200)
  const L = await vsList(K.fr, 'c-count')
  check('C: danh sách Số từ: 10 · 15 · 20 · 50 · 100, chữ to bằng trong ô', JSON.stringify(L.opts.map((o) => o.t)) === '["10","15","20","50","100"]' && L.opts.every((o) => o.fs === L.bfs && o.h >= 44), JSON.stringify(L))
  await K.fr.click('.vs-pick-opt:has-text("50")')
  await K.fr.click('#c-level-pick'); await K.fr.click('.vs-pick-opt:has-text("Lớp 10")')
  // vẽ lại màn (đổi sang "Gõ từ" rồi quay lại "Theo chủ đề"): lựa chọn vẫn giữ
  await K.fr.click('[data-mode-tab="type"]'); await K.fr.click('[data-mode-tab="topic"]'); await K.fr.waitForSelector('#c-level-pick')
  const s1 = await vsState(K.fr)
  check('C: chọn 50 từ + "Lớp 10–12 · THPT (B1)" -> vẽ lại màn vẫn giữ đúng', /^Lớp 10.12 · THPT \(B1\)$/.test(s1.btns[0]) && s1.btns[1] === '50', JSON.stringify(s1))
  check('C: không lỗi trang', K.errs.length === 0, K.errs.join(' | '))
})

// ======================= R — Đăng ký (Ôn Tập): ô Lớp =======================
await part('r', 'R. Ôn Tập · Đăng ký: ô Lớp', async () => {
  for (const [w, h] of [[390, 844], [1366, 650]]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 }); ctxs.push(ctx)
    await useRealFonts(ctx)
    const page = await ctx.newPage(); const errs = []; watchErrs(page, errs)
    await page.goto(BASE + '/', { waitUntil: 'networkidle' })
    await page.click('.auth-landing button:has-text("Đăng ký")')
    await page.click('.reg-plan .chip:has-text("1 học sinh")')
    const box = page.locator('.reg-kid').first()
    const nSel = await page.locator('.auth-card select').count()
    const ph = (await box.locator('.sel-btn').textContent()).trim()
    await page.fill('input[placeholder="VD: Nguyễn Văn A"]', 'Phụ huynh thử')   // bắt đầu điền -> các ô còn thiếu tô đỏ
    const red = await box.locator('.sel-btn').evaluate((b) => b.classList.contains('auth-in--err'))
    check(`R ${w}px: ô Lớp tự vẽ (không còn <select>), chưa chọn hiện "— Chọn lớp —", bắt đầu điền mà chưa chọn lớp thì tô đỏ`, nSel === 0 && ph === '— Chọn lớp —' && red, JSON.stringify({ nSel, ph, red }))
    await box.locator('.sel-btn').click(); await sleep(250)
    const L = await box.evaluate((el) => {
      const btn = el.querySelector('.sel-btn'), fit = Number(getComputedStyle(document.documentElement).getPropertyValue('--fit')) || 1
      const list = el.querySelector('.sel-list'), lr = list.getBoundingClientRect(), pr = document.querySelector('.phone').getBoundingClientRect()
      return { fit, bfs: parseFloat(getComputedStyle(btn).fontSize), inside: lr.left >= pr.left - 1 && lr.right <= pr.right + 1,
        opts: [...el.querySelectorAll('.sel-opt')].map((o) => ({ t: o.textContent.trim(), fs: parseFloat(getComputedStyle(o).fontSize), h: o.getBoundingClientRect().height / fit })) }
    })
    check(`R ${w}px: danh sách 12 lớp (Lớp 1…Lớp 12), chữ to bằng trong ô (${L.bfs}px), dòng cao ≥ 44px, nằm trong khung (app phóng to ${L.fit} lần)`,
      L.opts.length === 12 && L.opts[0].t === 'Lớp 1' && L.opts[11].t === 'Lớp 12' && L.bfs >= 16 && L.opts.every((o) => o.fs === L.bfs && o.h >= 44) && L.inside, JSON.stringify(L))
    if (w === 390) await page.screenshot({ path: `${OUT}/pick_reg_grade.png` })
    await box.locator('.sel-opt').filter({ hasText: /^Lớp 5$/ }).click()
    const after = { t: (await box.locator('.sel-btn').textContent()).trim(), open: await box.locator('.sel-list').count(), red: await box.locator('.sel-btn').evaluate((b) => b.classList.contains('auth-in--err')) }
    check(`R ${w}px: chọn "Lớp 5" -> ô hiện Lớp 5, hết tô đỏ, danh sách đóng`, after.t === 'Lớp 5' && after.open === 0 && !after.red, JSON.stringify(after))
    check(`R ${w}px: không lỗi trang`, errs.length === 0, errs.join(' | '))
  }
})

// ======================= A — Nội dung đã đọc được (Ôn Tập): ô Môn =======================
await part('a', 'A. Ôn Tập · Nội dung đã đọc được: ô Môn', async () => {
  const K = await kid({ id: 'kidA', spelling: false })
  await K.page.route('**/api/ai', (r) => r.fulfill({ contentType: 'application/json', body: JSON.stringify({ subject: 'Tiếng Anh', grade: '', topic: 'Animals', concepts: [{ name: 'Từ vựng: Động vật', details: ['cat', 'dog', 'bird'] }, { name: 'Thì hiện tại đơn', details: [] }] }) }))
  await K.page.click('.kh-tile.tone-blue')
  await K.page.click('.cap-card:has-text("Gõ tay")')
  await K.page.fill('textarea.ta', 'Animals: cat, dog, bird')
  await K.page.click('button.cta:has-text("Đọc và ghi nhớ")')
  await K.page.waitForSelector('.u-row-pick .sel-btn', { timeout: 10000 })
  const s0 = { nSel: await K.page.locator('.understood select').count(), t: (await K.page.textContent('.u-row-pick .sel-btn')).trim() }
  check('A: ô Môn tự vẽ (không còn <select>), hiện môn đọc được "Tiếng Anh"', s0.nSel === 0 && s0.t === 'Tiếng Anh', JSON.stringify(s0))
  await K.page.click('.u-row-pick .sel-btn'); await sleep(250)
  const L = await K.page.evaluate(() => {
    const list = document.querySelector('.u-row-pick .sel-list'), lr = list.getBoundingClientRect(), pr = document.querySelector('.phone').getBoundingClientRect()
    const below = document.elementFromPoint(lr.left + lr.width / 2, lr.top + Math.min(lr.height - 4, 60))
    return { abs: getComputedStyle(list).position, inside: lr.left >= pr.left - 1 && lr.right <= pr.right + 1 && lr.bottom <= pr.bottom + 1, onTop: !!(below && list.contains(below)),
      opts: [...list.querySelectorAll('.sel-opt')].map((o) => ({ t: o.textContent.trim(), fs: parseFloat(getComputedStyle(o).fontSize), h: o.getBoundingClientRect().height })) }
  })
  check('A: danh sách môn nổi lên trên, nằm trong khung, không bị che/cắt; có Toán, Tiếng Việt…; chữ ≥ 16px, dòng ≥ 44px',
    L.abs === 'absolute' && L.inside && L.onTop && L.opts.some((o) => o.t === 'Toán') && L.opts.some((o) => o.t === 'Tiếng Việt') && L.opts.every((o) => o.fs >= 16 && o.h >= 44), JSON.stringify(L))
  await K.page.screenshot({ path: `${OUT}/pick_approve_subject.png` })
  await K.page.click('.u-row-pick .sel-opt:text-is("Toán")')
  const t1 = (await K.page.textContent('.u-row-pick .sel-btn')).trim()
  const hint = await K.page.textContent('.screen')
  check('A: chọn "Toán" -> ô hiện Toán + dòng "Đã đổi môn từ "Tiếng Anh" sang "Toán"."', t1 === 'Toán' && /Đã đổi môn từ "Tiếng Anh" sang "Toán"/.test(hint), t1)
  check('A: không lỗi trang', K.errs.length === 0, K.errs.join(' | '))
})

await browser.close()
const fails = Object.entries(results).filter(([, v]) => v !== 'PASS')
console.log(fails.length ? `FAILED ${fails.length}/${Object.keys(results).length}: ` + fails.map(([k]) => k).join(' | ') : `ALL PASS ✓ (${Object.keys(results).length} checks)`)
