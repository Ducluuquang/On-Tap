// Giao diện mới (anh duyệt hình mẫu 28/10/2026) — thử qua giao diện thật của Ôn Tập (điện thoại 390px + màn hẹp):
//  H  Trang chủ của con: logo + tên con, lời chào + khẩu hiệu (sửa được), "Việc chính hôm nay" (mục tiêu phút, thanh tiến độ,
//     nút vàng "Bắt đầu ôn", số chủ đề chờ ôn), chuỗi ngày + phần thưởng (ô đánh số), Việc khác (Thêm bài học, Xem báo cáo),
//     Môn học của con (màu riêng, số cần ôn, chạm vào môn -> màn Bắt đầu ôn của môn đó); không còn "Đổi người học" trong khung.
//  R  Bắt đầu ôn: Cách 1 (gợi ý + "Ôn ngay"), "hoặc", Cách 2 (3 bước), riêng Tiếng Anh, Master, Tuỳ chỉnh thêm, thanh dính đáy.
//  W  Màn hẹp 320/360/375/390/430: không tràn ngang; từ 360px tên môn + tên mức ôn nằm một dòng.
//  T  Thanh trên cùng (anh báo 04/11/2026, iPhone): "Con | Phụ huynh", "Đổi người học", "Đăng xuất" luôn MỘT HÀNG, cao bằng
//     nhau, thẳng mép khung — từ 280px (iPhone bật "Thu phóng màn hình" = 320px) tới màn máy tính; cả khi phông web chưa tải.
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
const iso = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10) }

// bài học mẫu giống hình mẫu: Toán 3 cần ôn, Tiếng Việt 1, Tiếng Anh 6, Lịch sử 3 (tổng 13)
function concept(name, subject, kind, i) {
  const base = { id: 'c' + i + '-' + RUN, name, subject, topic: name, difficulty: 'Cơ bản', importance: 'Quan trọng', details: [], learnedOn: iso(2), updatedAt: Date.now(), learnedInApp: true }
  if (kind === 'new') return { ...base, mastery: 0, pts: 0, hist: '', reviews: 0, correct: 0, wrong: 0 }
  if (kind === 'weak') return { ...base, mastery: 50, pts: 50, hist: '1010', reviews: 2, correct: 2, wrong: 2 }
  return { ...base, mastery: 90, pts: 90, hist: '1111111111', reviews: 5, correct: 10, wrong: 0 }
}
const MEM = [
  ['Phân số', 'Toán', 'weak'], ['Số thập phân', 'Toán', 'new'], ['Tìm x', 'Toán', 'weak'], ['Diện tích hình chữ nhật', 'Toán', 'ok'],
  ['Chính tả âm đầu', 'Tiếng Việt', 'weak'], ['Từ đồng nghĩa', 'Tiếng Việt', 'ok'],
  ['Thì hiện tại đơn', 'Tiếng Anh', 'weak'], ['Thì quá khứ hoàn thành', 'Tiếng Anh', 'weak'], ['Câu bị động', 'Tiếng Anh', 'new'],
  ['Mạo từ a an the', 'Tiếng Anh', 'new'], ['So sánh hơn', 'Tiếng Anh', 'weak'], ['Giới từ chỉ thời gian', 'Tiếng Anh', 'new'], ['Đại từ nhân xưng', 'Tiếng Anh', 'ok'],
  ['Nhà Trần', 'Lịch sử', 'weak'], ['Chiến thắng Bạch Đằng', 'Lịch sử', 'new'], ['Nhà Lý', 'Lịch sử', 'weak'],
].map(([n, s, k], i) => concept(n, s, k, i))
// thời gian học: hôm nay 10 phút; 3 ngày trước đó mỗi ngày đủ 15 phút -> chuỗi 3 ngày
const statsWith = (todayMin, streak) => { const days = {}; if (todayMin) days[iso(0)] = todayMin * 60; for (let k = 1; k <= streak; k++) days[iso(k)] = 16 * 60; return { goalMin: 15, days, log: {} } }

async function kid({ id = 'kidH', name = 'Alex', icon = '🦊', grade = 'Lớp 7', mem = MEM, stats = statsWith(10, 3), width = 390, height = 844, realFonts = true, mobile = false } = {}) {
  id = id + RUN
  const ACC = { username: '09' + id, password: '1', phone: '09' + id, parentPass: '1', plan: 1, pin: '3', children: [{ id, name, pin: '', icon, grade }] }
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 2, ...(mobile ? { isMobile: true, hasTouch: true } : {}) })
  if (realFonts) await useRealFonts(ctx)
  else await ctx.route(/fonts\.(googleapis|gstatic)\.com/, (route) => route.fulfill({ status: 200, contentType: 'text/css', body: '' }))   // không có phông web -> phông dự phòng
  await ctx.addInitScript(({ ACC, id, mem, stats }) => {
    if (window.top !== window) return
    if (sessionStorage.getItem('s')) return; sessionStorage.setItem('s', '1'); localStorage.clear()
    localStorage.setItem('ontap.account.v1', JSON.stringify(ACC)); localStorage.setItem('ontap.session.v1', '1'); localStorage.setItem('ontap.activechild.v1', id)
    localStorage.setItem('ontap.memory.v2::' + id, JSON.stringify(mem)); localStorage.setItem('ontap.stats.v2::' + id, JSON.stringify(stats))
  }, { ACC, id, mem, stats })
  const page = await ctx.newPage()
  const errs = [], ai = []
  page.on('request', (r) => { if (r.url().includes('/api/ai') && r.method() === 'POST') { try { ai.push(JSON.parse(r.postData() || '{}')) } catch { ai.push({}) } } })
  page.on('pageerror', (e) => errs.push('pageerror: ' + e.message))
  page.on('console', (m) => { if (m.type() === 'error' && !/favicon|fonts\.g|status of 4\d\d|status of 5\d\d/.test(m.text())) errs.push('console: ' + m.text()) })
  await page.goto(BASE + '/', { waitUntil: 'networkidle' })
  await page.waitForSelector('.kh-cta', { timeout: 10000 })
  return { ctx, page, errs, id, ai }
}
const txt = (k, sel) => k.page.locator(sel).first().innerText()
const noOverflow = (k) => k.page.evaluate(() => { const d = document.scrollingElement; return d.scrollWidth <= d.clientWidth + 1 })
const tiles = (k, root) => k.page.$$eval(root + ' .sj-tile', (els) => els.map((e) => ({ name: e.querySelector('b').textContent, state: e.querySelector('small').textContent, tone: [...e.classList].find((c) => c.startsWith('tone-')), on: e.classList.contains('on') })))

// ======================= H — trang chủ =======================
if (only === 'all' || only === 'h') {
  console.log('— H. Trang chủ của con')
  const K = await kid()
  await K.page.screenshot({ path: `${OUT}/h_home.png`, fullPage: true })
  const phone = await txt(K, '.phone')
  check('đầu trang: logo Ôn Tập + "🦊 Alex · Lớp 7"', (await K.page.locator('.kh-top .brand-logo').count()) === 1 && /Alex/.test(await txt(K, '.kh-kid')) && /Lớp 7/.test(await txt(K, '.kh-kid')), await txt(K, '.kh-kid'))
  check('không còn nút "Đổi người học" trong khung (chỉ còn ở thanh trên cùng)', !/Đổi người học/.test(phone) && (await K.page.locator('.demoswitch :text("Đổi người học")').count()) === 1)
  check('lời chào "Chào Alex! 👋" + khẩu hiệu trong ngoặc kép', /Chào Alex! 👋/.test(await txt(K, '.kh-greet h1')) && /“Tương lai khóc hay cười/.test(await txt(K, '.kh-greet .slogan')))
  check('tiêu đề vùng: Việc chính hôm nay · Việc khác · Môn học của con', /Việc chính hôm nay/i.test(phone) && /Việc khác/i.test(phone) && /Môn học của con/i.test(phone))
  const today = await txt(K, '.kh-today')
  const barW = await K.page.$eval('.kh-bar i', (e) => e.style.width)
  check('việc chính: "Mục tiêu: học đủ 15 phút", "10 / 15 phút", thanh tiến độ 2/3', /Mục tiêu: học đủ 15 phút/.test(today) && /10 \/ 15 phút/.test(today) && Math.abs(parseFloat(barW) - 66.67) < 0.5, `${today} | ${barW}`)
  check('nút vàng to "▶ Bắt đầu ôn" + "Có 13 chủ đề đang chờ con ôn"', /Bắt đầu ôn/.test(await txt(K, '.kh-cta')) && /Có 13 chủ đề đang chờ con ôn/.test(today), today)
  const rw = await txt(K, '.kh-reward')
  const dots = await K.page.$$eval('.kh-dots i', (els) => els.map((e) => e.textContent + (e.classList.contains('on') ? '*' : '')))
  check('phần thưởng: "🔥 Chuỗi 3 ngày", "Ngày thứ 7: nhận quà 🎁", 7 ô số 1–7, tô cam 3 ô', /Chuỗi 3 ngày/.test(rw) && /Ngày thứ 7: nhận quà/.test(rw) && dots.join(',') === '1*,2*,3*,4,5,6,7', dots.join(','))
  check('câu nhắc: "Mỗi ngày học đủ 15 phút là tô thêm 1 ô."', /Mỗi ngày học đủ 15 phút là tô thêm 1 ô\./.test(rw))
  const sj = await tiles(K, '.kh')
  check('môn học: Toán 3 cần ôn (xanh dương), Tiếng Việt 1 (hồng), Tiếng Anh 6 (xanh lá), Lịch sử 3 (vàng)',
    JSON.stringify(sj.map((t) => [t.name, t.state, t.tone])) === JSON.stringify([['Toán', '3 cần ôn', 'tone-blue'], ['Tiếng Việt', '1 cần ôn', 'tone-rose'], ['Tiếng Anh', '6 cần ôn', 'tone-green'], ['Lịch sử', '3 cần ôn', 'tone-gold']]), JSON.stringify(sj))
  // khẩu hiệu sửa được
  await K.page.click('.kh-greet .slogan')
  await K.page.fill('.kh-greet .slogan-input', 'Học đều mỗi ngày!')
  await K.page.press('.kh-greet .slogan-input', 'Enter')
  const saved = JSON.parse(await K.page.evaluate(() => localStorage.getItem('ontap.settings.v1')) || '{}')
  check('bấm khẩu hiệu để sửa: lưu lại và hiện ngay', /“Học đều mỗi ngày!”/.test(await txt(K, '.kh-greet .slogan')) && saved.slogan === 'Học đều mỗi ngày!', JSON.stringify(saved))
  // Việc khác
  await K.page.click('.kh-tile.tone-blue')
  await K.page.waitForFunction(() => !document.querySelector('.kh-cta'), null, { timeout: 5000 })
  const cap = await txt(K, '.phone')
  check('ô "Thêm bài học" -> màn thêm bài học', /bài học|Chụp|ảnh/i.test(cap), cap.slice(0, 120))
  await K.page.click('.phone .back'); await K.page.waitForSelector('.kh-cta')
  await K.page.click('.kh-tile.tone-purple')
  await K.page.waitForFunction(() => !document.querySelector('.kh-cta'), null, { timeout: 5000 })
  check('ô "Xem báo cáo" -> báo cáo học tập', /báo cáo|Thời gian học/i.test(await txt(K, '.phone')))
  await K.page.click('.phone .back'); await K.page.waitForSelector('.kh-cta')
  // chạm vào môn -> Bắt đầu ôn của môn đó
  await K.page.click('.kh .sj-tile.tone-rose')
  await K.page.waitForSelector('.screen.cr')
  check('chạm "Tiếng Việt" ở trang chủ -> Bắt đầu ôn, chọn sẵn Tiếng Việt (gợi ý: 1 chủ đề cần ôn)', /📖 Tiếng Việt/.test(await txt(K, '.cr-hero-subj')) && /1 chủ đề cần ôn/.test(await txt(K, '.cr-hero')) && (await tiles(K, '.cr-self')).find((t) => t.on)?.name === 'Tiếng Việt')
  // dòng tên chủ đề chỉ ghi chủ đề CẦN ÔN cho khớp con số (không ghi "Từ đồng nghĩa" đã vững)
  const tvSub = (await txt(K, '.cr-hero-sub')).trim()
  check('thẻ gợi ý Tiếng Việt: "1 chủ đề cần ôn" chỉ ghi "Chính tả âm đầu" (không ghi chủ đề đã vững)', tvSub === 'Chính tả âm đầu', tvSub)
  await K.page.click('.phone .back'); await K.page.waitForSelector('.kh-cta')
  // nút to -> môn đang cần ôn nhiều nhất (Tiếng Anh)
  await K.page.click('.kh-cta'); await K.page.waitForSelector('.screen.cr')
  check('nút "Bắt đầu ôn" -> gợi ý sẵn môn cần ôn nhiều nhất (Tiếng Anh, 6 chủ đề)', /🔤 Tiếng Anh/.test(await txt(K, '.cr-hero-subj')) && /6 chủ đề cần ôn/.test(await txt(K, '.cr-hero')))
  check('H không lỗi trang', K.errs.length === 0, K.errs.join(' | '))
  await K.ctx.close()

  // đạt mục tiêu hôm nay + chặng sau của phần thưởng
  const K2 = await kid({ id: 'kidH2', stats: statsWith(20, 8) })   // hôm nay đạt (20 phút) -> chuỗi 9 ngày
  const t2 = await txt(K2, '.kh-today'), rw2 = await txt(K2, '.kh-reward')
  const d2 = await K2.page.$$eval('.kh-dots i', (els) => els.map((e) => e.textContent + (e.classList.contains('on') ? '*' : '')))
  check('đạt mục tiêu hôm nay: "Đạt rồi ✓ (20 phút)", thanh đầy', /Đạt rồi ✓ \(20 phút\)/.test(t2) && (await K2.page.$eval('.kh-bar i', (e) => e.style.width)) === '100%', t2)
  check('chuỗi 9 ngày: chặng 8–15 (8 ô), tô 2 ô, "Ngày thứ 15: nhận quà"', /Chuỗi 9 ngày/.test(rw2) && /Ngày thứ 15: nhận quà/.test(rw2) && d2.join(',') === '8*,9*,10,11,12,13,14,15', d2.join(','))
  await K2.ctx.close()
  const K3 = await kid({ id: 'kidH3', stats: statsWith(0, 20) })   // chuỗi 20 ngày -> chặng 15–30 (thanh liền)
  const rw3 = await txt(K3, '.kh-reward')
  check('chuỗi 20 ngày: chặng dài vẽ thanh liền "5/15 ngày", "Ngày thứ 30: nhận quà"', /Chuỗi 20 ngày/.test(rw3) && /5\/15 ngày/.test(rw3) && /Ngày thứ 30/.test(rw3) && (await K3.page.locator('.kh-rw-bar').count()) === 1, rw3)
  await K3.ctx.close()
  // con mới, chưa có bài
  const K4 = await kid({ id: 'kidH4', mem: [], stats: { goalMin: 20, days: {}, log: {} } })
  const t4 = await txt(K4, '.kh-today'), sj4 = await tiles(K4, '.kh')
  check('con mới: "Thêm bài học đầu tiên để bắt đầu ôn nhé!", mục tiêu theo cài đặt (20 phút), 3 môn "chưa có bài"', /Thêm bài học đầu tiên/.test(t4) && /học đủ 20 phút/.test(t4) && /0 \/ 20 phút/.test(t4) && sj4.length === 3 && sj4.every((t) => t.state === 'chưa có bài'), t4 + JSON.stringify(sj4))
  check('con mới: chuỗi 0 ngày, 7 ô trống, "Mỗi ngày học đủ 20 phút…"', /Chuỗi 0 ngày/.test(await txt(K4, '.kh-reward')) && /học đủ 20 phút là tô thêm 1 ô/.test(await txt(K4, '.kh-reward')) && (await K4.page.locator('.kh-dots i.on').count()) === 0)
  await K4.ctx.close()
}

// ======================= R — Bắt đầu ôn =======================
if (only === 'all' || only === 'r') {
  console.log('— R. Bắt đầu ôn')
  const K = await kid({ id: 'kidR' })
  await K.page.click('.kh-cta'); await K.page.waitForSelector('.screen.cr')
  await K.page.screenshot({ path: `${OUT}/r_review.png`, fullPage: true })
  const all = await txt(K, '.screen.cr')
  check('Cách 1 "Nhanh nhất: ôn theo gợi ý" — hoặc — Cách 2 "Tự chọn bài ôn"', /Cách 1\s*Nhanh nhất: ôn theo gợi ý/i.test(all) && /hoặc/.test(await txt(K, '.cr-or')) && /Cách 2\s*Tự chọn bài ôn/i.test(all), all.slice(0, 200))
  const hero = await txt(K, '.cr-hero')
  check('thẻ gợi ý: nhãn môn, "6 chủ đề cần ôn", tên chủ đề, "10 câu", "~8 phút", nút "▶ Ôn ngay"', /🔤 Tiếng Anh/.test(hero) && /6 chủ đề cần ôn/.test(hero) && /Thì|Câu|Mạo từ|So sánh|Giới từ/.test(hero) && /10 câu/.test(hero) && /~8 phút/.test(hero) && /Ôn ngay/.test(hero), hero)
  const steps = await K.page.$$eval('.cr-step h3', (els) => els.map((e) => e.textContent.trim()))
  check('3 bước đánh số: 1 Chọn môn · 2 Con muốn ôn gì? · 3 Ôn bao nhiêu câu?', steps.join('|') === '1Chọn môn|2Con muốn ôn gì?|3Ôn bao nhiêu câu?', steps.join('|'))
  const sj = await tiles(K, '.cr-self')
  check('bước 1: 4 ô môn có màu + số cần ôn; Tiếng Anh đang chọn có dấu ✓', sj.length === 4 && sj.find((t) => t.on)?.name === 'Tiếng Anh' && (await K.page.locator('.cr-self .sj-tile.on .sj-ck').count()) === 1 && sj.map((t) => t.state).join(',') === '3 cần ôn,1 cần ôn,6 cần ôn,3 cần ôn', JSON.stringify(sj))
  const en = await txt(K, '.cr-en')
  check('riêng Tiếng Anh: Trò chơi từ vựng (Vở Spelling · 11 trò + Scrabble) + "Đề bài viết bằng: Tiếng Việt / Tiếng Anh"', /Riêng môn Tiếng Anh/i.test(en) && /Trò chơi từ vựng/.test(en) && /Vở Spelling · 11 trò \+ Scrabble/.test(en) && /Đề bài viết bằng:/.test(en) && (await K.page.locator('.cr-segb button.on').innerText()) === 'Tiếng Việt', en)
  await K.page.click('.cr-segb button:has-text("Tiếng Anh")')
  check('đổi "Đề bài viết bằng" sang Tiếng Anh', (await K.page.locator('.cr-segb button.on').innerText()) === 'Tiếng Anh')
  const lv = await K.page.$$eval('.cr-lvc', (els) => els.map((e) => e.querySelector('b').textContent + '=' + e.querySelector('em').textContent))
  check('bước 2: 4 ô có giải thích + "Thử thách Master" vàng cả hàng', lv.length === 5 && lv[0] === 'Cần ôn nhất=Phần con chưa vững' && lv[1] === 'Câu từng sai=Làm lại câu đã sai' && lv[2] === 'Chưa học=Bài mới thêm, chưa ôn' && lv[3] === 'Ôn tổng hợp=Trộn tất cả các bài' && /Thử thách Master/.test(lv[4]) && (await K.page.locator('.cr-lvc.master').count()) === 1, lv.join(' | '))
  const cnt = await K.page.$$eval('.chip-count', (els) => els.map((e) => e.innerText.replace(/\s+/g, ' ')))
  check('bước 3: 10/15/20/25 câu kèm phút', cnt.join('|') === '10 câu ~8 phút|15 câu ~12 phút|20 câu ~16 phút|25 câu ~20 phút', cnt.join('|'))
  check('Tuỳ chỉnh thêm thu gọn: "Chủ đề cụ thể · thời gian · kiểu chơi, games"', /Tuỳ chỉnh thêm/.test(await txt(K, '.cr-adv')) && /Chủ đề cụ thể · thời gian · kiểu chơi, games/.test(await txt(K, '.cr-adv')))
  let sticky = await txt(K, '.cr-sticky')
  check('thanh dính đáy: "Tiếng Anh · Cần ôn nhất" / "10 câu · khoảng 8 phút" + "Bắt đầu →"', /Tiếng Anh · Cần ôn nhất/.test(sticky) && /10 câu · khoảng 8 phút/.test(sticky) && /Bắt đầu →/.test(sticky), sticky)
  // đổi môn -> thẻ gợi ý + dấu ✓ đổi theo, vùng Tiếng Anh ẩn
  await K.page.click('.cr-self .sj-tile.tone-blue')
  check('chọn Toán: thẻ gợi ý "🔢 Toán · 3 chủ đề cần ôn", ✓ sang Toán, ẩn vùng Tiếng Anh', /🔢 Toán/.test(await txt(K, '.cr-hero-subj')) && /3 chủ đề cần ôn/.test(await txt(K, '.cr-hero')) && (await tiles(K, '.cr-self')).find((t) => t.on)?.name === 'Toán' && (await K.page.locator('.cr-en').count()) === 0)
  const toanSub = (await txt(K, '.cr-hero-sub')).trim()
  check('thẻ gợi ý Toán ghi 2 chủ đề cần ôn yếu nhất: "Số thập phân • Phân số"', toanSub === 'Số thập phân • Phân số', toanSub)
  await K.page.click('.cr-lvc:has-text("Câu từng sai")')
  await K.page.click('.chip-count:has-text("15 câu")')
  sticky = await txt(K, '.cr-sticky')
  check('chọn "Câu từng sai" + 15 câu: thanh đáy "Toán · Câu từng sai" / "15 câu · khoảng 12 phút"', /Toán · Câu từng sai/.test(sticky) && /15 câu · khoảng 12 phút/.test(sticky) && !(await K.page.locator('.cr-sticky-cta').isDisabled()), sticky)
  await K.page.click('.cr-lvc.master')
  check('Thử thách Master: hiện lời dặn, tự mở Tuỳ chỉnh thêm, thanh đáy "Toán · Thử thách Master"', (await K.page.locator('.cr-master-note').count()) === 1 && (await K.page.locator('.cr-adv.open').count()) === 1 && /Toán · Thử thách Master/.test(await txt(K, '.cr-sticky')))
  const adv = await txt(K, '.cr-adv')
  check('Tuỳ chỉnh thêm có: Yêu cầu cụ thể, Phạm vi bài học, Kiểu chơi, Games', /Yêu cầu cụ thể/i.test(adv) && /Phạm vi bài học/i.test(adv) && /Kiểu chơi/i.test(adv) && /Games/i.test(adv), adv.slice(0, 300))
  await K.page.screenshot({ path: `${OUT}/r_master.png`, fullPage: true })
  // danh sách chọn chủ đề (tự vẽ, chữ to — không dùng <select> của trình duyệt vì chữ trong danh sách xổ ra rất nhỏ)
  check('ô "Thêm chủ đề từ bản đồ kiến thức" không còn là <select>', (await K.page.locator('.cr-adv select').count()) === 0 && /Thêm chủ đề từ bản đồ kiến thức/.test(await txt(K, '.cr-pick')))
  await K.page.click('.cr-pick .cr-select')
  const opts = await K.page.$$eval('.cr-pick-opt', (els) => els.map((e) => ({ t: e.textContent.trim(), fs: parseFloat(getComputedStyle(e).fontSize), h: e.getBoundingClientRect().height })))
  const boxFs = await K.page.$eval('.cr-pick .cr-select', (e) => parseFloat(getComputedStyle(e).fontSize))
  check('mở danh sách: có chủ đề Toán, chữ to bằng chữ trong ô (≥ 15px), dòng cao ≥ 40px', opts.length >= 2 && opts.every((o) => o.fs >= 15 && o.fs === boxFs && o.h >= 40), JSON.stringify(opts) + ' box ' + boxFs)
  await K.page.screenshot({ path: `${OUT}/r_topic_pick.png`, fullPage: false })
  await K.page.click(`.cr-pick-opt >> nth=0`)
  const inV = await K.page.inputValue('.cr-input')
  check('chọn 1 chủ đề -> điền vào ô Yêu cầu cụ thể, danh sách đóng lại', inV === opts[0].t && (await K.page.locator('.cr-pick-list').count()) === 0, inV)
  await K.page.click('.cr-pick .cr-select'); await K.page.click(`.cr-pick-opt >> nth=1`)
  const inV2 = await K.page.inputValue('.cr-input')
  check('chọn thêm chủ đề thứ 2 (Master) -> nối bằng dấu phẩy', inV2 === opts[0].t + ', ' + opts[1].t, inV2)
  await K.page.click('.cr-pick .cr-select'); await K.page.click('.cr-hero')
  check('chạm ra ngoài -> danh sách đóng', (await K.page.locator('.cr-pick-list').count()) === 0)
  await K.page.fill('.cr-input', '')
  await K.page.click('.cr-lvc:has-text("Cần ôn nhất")')
  await K.page.click('.cr-adv-toggle')
  check('đóng lại Tuỳ chỉnh thêm', (await K.page.locator('.cr-adv.open').count()) === 0)
  // ÔN NGAY theo gợi ý -> vào bài ôn đúng môn
  await K.page.click('.cr-hero-cta')
  await K.page.waitForFunction(() => !document.querySelector('.screen.cr'), null, { timeout: 8000 })
  await sleep(600)
  await K.page.waitForFunction(() => true, null, { timeout: 100 })
  for (let i = 0; i < 40 && !K.ai.length; i++) await sleep(100)
  const q1 = K.ai[0] || {}
  check('"Ôn ngay" -> vào bài ôn: soạn 10 câu môn Toán, đúng các chủ đề cần ôn của Toán', /Đang chuẩn bị/.test(await txt(K, '.phone')) && JSON.stringify(q1).includes('Toán') && JSON.stringify(q1).includes('Phân số') && !JSON.stringify(q1).includes('Thì hiện tại đơn'), JSON.stringify(q1).slice(0, 300))
  check('R không lỗi trang', K.errs.length === 0, K.errs.join(' | '))
  await K.ctx.close()

  // thanh đáy "Bắt đầu →"
  const K2 = await kid({ id: 'kidR2' })
  await K2.page.click('.kh .sj-tile.tone-gold'); await K2.page.waitForSelector('.screen.cr')
  await K2.page.click('.chip-count:has-text("20 câu")')
  await K2.page.click('.cr-sticky-cta')
  await K2.page.waitForFunction(() => !document.querySelector('.screen.cr'), null, { timeout: 8000 })
  await sleep(600)
  for (let i = 0; i < 40 && !K2.ai.length; i++) await sleep(100)
  const p2 = (K2.ai[0] || {}).payload || {}, q2 = JSON.stringify(p2)
  check('"Bắt đầu →" (Lịch sử, 20 câu) -> soạn bài môn Lịch sử (Nhà Trần, Nhà Lý…), từ 20 câu trở lên (app xin dư vài câu dự phòng)', p2.subject === 'Lịch sử' && (p2.concepts || []).includes('Nhà Trần') && p2.count >= 20 && p2.count <= 26 && !q2.includes('Phân số'), q2.slice(0, 300))
  await K2.ctx.close()

  // Lỗi 02/11/2026: chọn chủ đề cụ thể ở "Yêu cầu cụ thể" rồi bấm "Ôn ngay" (Cách 1) -> trước đây vẫn ra "phần yếu nhất" (lạc đề)
  const K4 = await kid({ id: 'kidR4' })
  await K4.page.click('.kh-cta'); await K4.page.waitForSelector('.screen.cr')
  await K4.page.click('.cr-self .sj-tile.tone-blue')
  await K4.page.click('.cr-adv-toggle')
  await K4.page.click('.cr-pick .cr-select'); await K4.page.click('.cr-pick-opt:has-text("Diện tích hình chữ nhật")')
  const h4 = await txt(K4, '.cr-hero')
  check('chọn "Diện tích hình chữ nhật" ở Yêu cầu cụ thể -> thẻ Cách 1 đổi thành "Theo yêu cầu của con: Diện tích hình chữ nhật"', /Theo yêu cầu của con/.test(h4) && /Diện tích hình chữ nhật/.test(h4) && !/Số thập phân/.test(h4), h4)
  await K4.page.locator('.cr-hero').screenshot({ path: `${OUT}/r_hero_req.png` })
  await K4.page.click('.cr-hero-cta')
  await K4.page.waitForFunction(() => !document.querySelector('.screen.cr'), null, { timeout: 8000 })
  for (let i = 0; i < 40 && !K4.ai.length; i++) await sleep(100)
  const p4 = (K4.ai[0] || {}).payload || {}
  const c4 = JSON.stringify(p4.concepts || [])
  check('…bấm "Ôn ngay" -> soạn đúng "Diện tích hình chữ nhật" (không ra Phân số / Số thập phân)', p4.subject === 'Toán' && c4.includes('Diện tích hình chữ nhật') && !c4.includes('Phân số') && !c4.includes('Số thập phân'), c4)
  await K4.ctx.close()

  // môn chưa có bài
  const K3 = await kid({ id: 'kidR3', mem: [] })
  await K3.page.click('.kh-cta'); await K3.page.waitForSelector('.screen.cr')
  const h3 = await txt(K3, '.cr-hero'), s3 = await txt(K3, '.cr-sticky')
  check('chưa có bài: thẻ gợi ý "Chưa có bài học môn Toán", không có nút Ôn ngay; "Bắt đầu →" mờ + lời nhắc', /Chưa có bài học môn Toán/.test(h3) && (await K3.page.locator('.cr-hero-cta').count()) === 0 && (await K3.page.locator('.cr-sticky-cta').isDisabled()) && /chưa có bài học/.test(s3), h3 + ' | ' + s3)
  await K3.page.click('.phone .back')
  check('nút quay lại -> trang chủ', (await K3.page.locator('.kh-cta').count()) === 1)
  await K3.ctx.close()
}

// ======================= W — màn hẹp =======================
if (only === 'all' || only === 'w') {
  console.log('— W. Màn hẹp')
  // tên môn / tên mức ôn có nằm MỘT dòng không (giống hình mẫu) — từ 360px trở lên
  const oneLine = (k, sel) => k.page.$$eval(sel, (els) => els.filter((e) => { const cs = getComputedStyle(e); const lh = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.3; return e.getBoundingClientRect().height > lh * 1.5 }).map((e) => e.textContent.trim()))
  for (const w of [320, 360, 375, 390, 430]) {
    const K = await kid({ id: 'kidW' + w, width: w, height: 760 })
    const homeOk = await noOverflow(K)
    const wrapHome = await oneLine(K, '.kh .sj-body b')
    await K.page.screenshot({ path: `${OUT}/w${w}_home.png`, fullPage: true })
    await K.page.click('.kh-cta'); await K.page.waitForSelector('.screen.cr')
    await K.page.click('.cr-lvc.master')   // mở hết: vùng Tiếng Anh + Master + Tuỳ chỉnh thêm
    const crOk = await noOverflow(K)
    // các ô không bị chữ tràn ra ngoài
    const clipped = await K.page.$$eval('.sj-body b, .sj-body small, .cr-lvb b, .cr-lvb em, .cc-n, .cc-t, .kh-tile b, .kh-tile em, .kh-goal, .kh-rw-row, .cr-sticky-cta, .kh-cta', (els) => els.filter((e) => e.scrollWidth > e.clientWidth + 1 || e.getBoundingClientRect().right > document.documentElement.clientWidth + 1).map((e) => e.innerText.slice(0, 24)))
    await K.page.screenshot({ path: `${OUT}/w${w}_review.png`, fullPage: true })
    check(`${w}px: trang chủ + Bắt đầu ôn không tràn ngang, ô không bị tràn chữ`, homeOk && crOk && clipped.length === 0, `${homeOk} ${crOk} ${clipped.join(',')}`)
    if (w >= 360) {
      const wrapCr = await oneLine(K, '.cr-self .sj-body b, .cr-lvb b')
      check(`${w}px: tên môn ("Tiếng Việt", "Tiếng Anh"…) và tên mức ôn ("Cần ôn nhất"…) nằm một dòng như hình mẫu`, wrapHome.length === 0 && wrapCr.length === 0, 'xuống dòng: ' + [...wrapHome, ...wrapCr].join(', '))
    }
    await K.ctx.close()
  }
}

// ======================= T — thanh trên cùng một hàng (04/11/2026) =======================
// Anh báo: trên iPhone "Đổi người học" + "Đăng xuất" rớt xuống hàng dưới "Con | Phụ huynh" (iPhone bật Thu phóng màn hình
// chỉ rộng 320px). Bản cũ: từ 340px trở xuống bị xuống hàng, và ô Con|Phụ huynh cao hơn hai nút bên phải.
if (only === 'all' || only === 't') {
  console.log('— T. Thanh trên cùng một hàng')
  const barGeo = (k) => k.page.evaluate(() => {
    const R = (e) => e.getBoundingClientRect()
    const phone = R(document.querySelector('.phone'))
    const boxes = [document.querySelector('.demoswitch .ds-seg'), ...document.querySelectorAll('.demoswitch .ds-actions .ds-logout')]
    const rs = boxes.map(R)
    const btns = [...document.querySelectorAll('.demoswitch button')]
    const d = document.scrollingElement
    return {
      labels: btns.map((b) => b.textContent.trim()).join(' · '), n: boxes.length,
      topSpread: Math.max(...rs.map((r) => r.top)) - Math.min(...rs.map((r) => r.top)),
      botSpread: Math.max(...rs.map((r) => r.bottom)) - Math.min(...rs.map((r) => r.bottom)),
      left: rs[0].left - phone.left, right: phone.right - rs[rs.length - 1].right,
      overlap: rs.some((r, i) => i > 0 && r.left < rs[i - 1].right - 0.5),
      clipped: btns.filter((b) => b.scrollWidth > b.clientWidth + 1).map((b) => b.textContent),
      fs: [...new Set(btns.map((b) => parseFloat(getComputedStyle(b).fontSize)))],
      h: rs.map((r) => Math.round(r.height * 10) / 10),
      hScroll: d.scrollWidth > d.clientWidth + 1,
    }
  })
  const cases = [280, 300, 320, 340, 360, 375, 390, 393, 402, 414, 430].map((w) => ({ w, h: 760, mobile: true, realFonts: true }))
    .concat([320, 375].map((w) => ({ w, h: 760, mobile: true, realFonts: false, tag: ' (phông dự phòng)' })))
    .concat([[1366, 650], [1920, 950]].map(([w, h]) => ({ w, h, mobile: false, realFonts: true, tag: ' (máy tính, app phóng to)' })))
  for (const c of cases) {
    const K = await kid({ id: 'kidT' + c.w + (c.realFonts ? '' : 'f'), width: c.w, height: c.h, mobile: c.mobile, realFonts: c.realFonts })
    await K.page.evaluate(() => document.fonts.ready)
    const g = await barGeo(K)
    const name = `${c.w}px${c.tag || ''}`
    check(`${name}: "Con | Phụ huynh", "Đổi người học", "Đăng xuất" cùng MỘT HÀNG, ba ô cao bằng nhau (${g.h.join('/')})`,
      g.labels === 'Con · Phụ huynh · Đổi người học · Đăng xuất' && g.n === 3 && g.topSpread <= 1 && g.botSpread <= 1 && !g.overlap, JSON.stringify(g))
    check(`${name}: thanh thẳng mép trái/phải với khung bên dưới, chữ không bị cắt, không tràn ngang`,
      Math.abs(g.left) <= 2 && Math.abs(g.right) <= 2 && g.clipped.length === 0 && !g.hScroll, JSON.stringify(g))
    // chữ không nhỏ quá: cùng một cỡ cho cả ba ô; từ 320px ≥ 11px, từ 376px (và máy tính) đủ cỡ .84rem (13,44px)
    const minFs = c.w >= 376 ? 13.4 : c.w >= 320 ? 11 : 9
    check(`${name}: cả ba ô cùng cỡ chữ ${g.fs.join('/')}px (≥ ${minFs}px)`, g.fs.length === 1 && g.fs[0] >= minFs, JSON.stringify(g.fs))
    if (c.w === 320 && c.realFonts) await K.page.screenshot({ path: `${OUT}/t320_bar.png`, clip: { x: 0, y: 0, width: 320, height: 120 } })
    check(`${name}: không lỗi trang`, K.errs.length === 0, K.errs.join(' | '))
    await K.ctx.close()
  }
  // Nút "Đăng xuất" ở màn chọn con (không nằm trong thanh trên cùng) giữ kiểu cũ
  {
    const ctx = await browser.newContext({ viewport: { width: 320, height: 700 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true })
    await useRealFonts(ctx)
    const ACC = { username: '09pick' + RUN, password: '1', phone: '09pick' + RUN, parentPass: '1', plan: 1, pin: '3', children: [{ id: 'a' + RUN, name: 'An', pin: '', icon: '🦊', grade: 'Lớp 3' }, { id: 'b' + RUN, name: 'Bình', pin: '', icon: '🐼', grade: 'Lớp 5' }] }
    await ctx.addInitScript((ACC) => { if (sessionStorage.getItem('s')) return; sessionStorage.setItem('s', '1'); localStorage.clear(); localStorage.setItem('ontap.account.v1', JSON.stringify(ACC)); localStorage.setItem('ontap.session.v1', '1') }, ACC)
    const page = await ctx.newPage()
    await page.goto(BASE + '/', { waitUntil: 'networkidle' })
    await page.waitForSelector('.pick .ds-logout', { timeout: 10000 })
    const fs = await page.$eval('.pick .ds-logout', (b) => getComputedStyle(b).fontSize)
    check('màn chọn con: nút "Đăng xuất" trong khung vẫn kiểu cũ (chữ 12,16px ở 320px)', fs === '12.16px', fs)
    await ctx.close()
  }
}

// ======================= D — màn máy tính (02/11/2026) =======================
// App tự phóng to vừa màn hình rộng, nằm giữa, không tràn ngang; thanh "Bắt đầu" nằm ngay sau phần chọn (không lơ lửng xa).
if (only === 'all' || only === 'd') {
  console.log('— D. Màn máy tính')
  const geo = (k) => k.page.evaluate(() => {
    const r = document.querySelector('.phone').getBoundingClientRect(), d = document.scrollingElement
    return { left: r.left, right: d.clientWidth - r.right, width: r.width, vw: d.clientWidth, scrollW: d.scrollWidth, fit: getComputedStyle(document.documentElement).getPropertyValue('--fit') }
  })
  for (const [w, h, minFit] of [[1920, 950, 1.6], [1366, 650, 1.1], [390, 844, 1]]) {
    const K = await kid({ id: 'kidD' + w, width: w, height: h })
    const g = await geo(K)
    check(`${w}×${h}: app phóng to ≥ ${minFit} lần (${g.fit}), nằm giữa, không tràn ngang`, Number(g.fit) >= minFit && (w > 500 ? Math.abs(g.left - g.right) <= 2 : true) && g.scrollW <= g.vw + 1 && (w > 500 ? g.width >= 430 * minFit - 2 : true), JSON.stringify(g))
    await K.page.click('.kh-cta'); await K.page.waitForSelector('.screen.cr')
    const g2 = await geo(K)
    check(`${w}×${h}: màn Bắt đầu ôn cũng nằm giữa, không tràn ngang`, (w > 500 ? Math.abs(g2.left - g2.right) <= 2 : true) && g2.scrollW <= g2.vw + 1, JSON.stringify(g2))
    // đang ở đầu trang: thanh "Bắt đầu" dính đáy cửa sổ (luôn thấy)
    const bar = () => K.page.evaluate(() => { const b = document.querySelector('.cr-sticky').getBoundingClientRect(); const ph = document.querySelector('.phone').getBoundingClientRect(); return { top: b.top, bottom: b.bottom, vh: window.innerHeight, phoneBottom: ph.bottom, left: b.left - ph.left, right: ph.right - b.right } })
    const b1 = await bar()
    check(`${w}×${h}: đầu trang — thanh "Bắt đầu" thấy ngay ở đáy cửa sổ, thẳng mép khung`, Math.abs(b1.bottom - b1.vh) <= 2 && Math.abs(b1.left) <= 2 && Math.abs(b1.right) <= 2, JSON.stringify(b1))
    // cuộn hết trang: thanh nằm sát ngay dưới nội dung, cuối khung (không còn khoảng trống lớn giữa nội dung và nút)
    await K.page.click('.cr-adv-toggle')
    await K.page.evaluate(() => window.scrollTo(0, document.scrollingElement.scrollHeight))
    await sleep(300)
    const b2 = await bar()
    const gap = await K.page.evaluate(() => { const b = document.querySelector('.cr-sticky').getBoundingClientRect(); const s = document.querySelector('.cr-self').getBoundingClientRect(); return b.top - s.bottom })
    check(`${w}×${h}: cuối trang — thanh "Bắt đầu" nằm ngay dưới phần chọn (cách ${Math.round(gap)}px), ở đáy khung`, gap >= -1 && gap < 60 && Math.abs(b2.bottom - b2.phoneBottom) <= 2, JSON.stringify({ ...b2, gap }))
    await K.page.screenshot({ path: `${OUT}/d${w}_review_end.png` })
    if (w === 1920) {
      // trò "Bắn bóng" khi app đang phóng to: kéo cung ngắm quả bóng nào thì bắn trúng đúng quả đó
      // AI giả cho câu hỏi (máy chủ thử chỉ giả AI cho Thi đấu): 13 câu trắc nghiệm Toán
      await K.page.route('**/api/ai', (r) => r.fulfill({ contentType: 'application/json', body: JSON.stringify({ questions: Array.from({ length: 13 }, (_, i) => ({ q: `Câu ${i + 1}: ${i + 2} + ${i + 3} = ?`, options: [String(2 * i + 5), String(2 * i + 6), String(2 * i + 7), String(2 * i + 8)], answer: 0, explain: 'Cộng hai số.', concept: 'Phân số' })) }) }))
      await K.page.evaluate(() => window.scrollTo(0, 0))
      await K.page.click('.cr-self .sj-tile.tone-blue')   // Toán
      await K.page.click('.chip:has-text("Bắn bóng")')
      await K.page.click('.cr-sticky-cta')
      try { await K.page.waitForSelector('.bl-arena .balloon2', { timeout: 30000 }) } catch (e) { await K.page.screenshot({ path: `${OUT}/d1920_balloon_fail.png` }); throw e }
      await sleep(400)
      const top = await K.page.evaluate(() => ({ y: window.scrollY, q: document.querySelector('.bl-q').getBoundingClientRect().top }))
      check('1920: bấm "Bắt đầu" ở cuối trang -> màn trò chơi mở từ ĐẦU TRANG (thấy câu hỏi, không phải kéo lên)', top.y === 0 && top.q > 0 && top.q < 600, JSON.stringify(top))
      const n = await K.page.locator('.bl-arena .balloon2').count()
      const target = n - 1
      await K.page.$eval('.bl-arena', (e) => e.scrollIntoView({ block: 'center' })); await sleep(200)
      const a = await K.page.$eval('.bl-arena', (e) => { const r = e.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height } })
      const bb = await K.page.locator('.bl-arena .balloon2').nth(target).boundingBox()
      const sx = a.x + a.w * 0.5, sy = a.y + a.h * 0.86
      await K.page.mouse.move(sx, sy); await K.page.mouse.down()
      await K.page.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2, { steps: 6 }); await K.page.mouse.up()
      await sleep(1500)
      const shotCls = await K.page.$$eval('.bl-arena .balloon2', (els) => els.map((e) => e.className))
      check('1920: "Bắn bóng" khi phóng to — kéo cung ngắm quả bóng cuối thì trúng đúng quả đó', / (hit|miss)/.test(shotCls[target]), JSON.stringify(shotCls))
      await K.page.screenshot({ path: `${OUT}/d1920_balloon.png` })
    }
    check(`${w}×${h}: không lỗi trang`, K.errs.length === 0, K.errs.join(' | '))
    await K.ctx.close()
  }
}

await browser.close()
const fails = Object.entries(results).filter(([, v]) => v !== 'PASS')
console.log(fails.length ? `FAILED ${fails.length}/${Object.keys(results).length}: ` + fails.map(([k]) => k).join(' | ') : `ALL PASS ✓ (${Object.keys(results).length} checks)`)
