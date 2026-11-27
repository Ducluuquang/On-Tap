// CHI PHÍ AI qua giao diện thật (25/11/2026). AI giả, kho thử.
//  A  /quan-tri 1440 px (super admin): menu "💸 Chi phí AI" ở nhóm "Chỉ super admin"; Tổng quan (Hôm nay / 7 / 30 ngày, bảng ngày,
//     loại việc, token theo model, tài khoản tốn nhất); Cài đặt (đổi model Toán bằng ô chọn tự vẽ, giới hạn); Ngân hàng câu (tìm,
//     xem câu, xoá có hỏi lại); Thử model (hai cột, đánh dấu Sai, lưu đánh giá, bảng tổng kết); Người dùng có cột Tiền AI 30 ngày.
//  B  390 px: cùng mục, không tràn ngang; Thử model là hai thẻ "Sonnet" / "Haiku" chuyển qua lại. Admin thường không thấy mục này.
//  C  Con ôn 2 lượt cùng chủ đề qua giao diện -> lượt 2 KHÔNG gọi AI, câu khác lượt 1.
//  D  Quá giới hạn lượt soạn mới -> màn nhẹ nhàng "Hôm nay con đã ôn đủ … chủ đề mới rồi!" + nút về Bắt đầu ôn.
import { pw, OUT_DIR } from './_env.mjs'
import { useRealFonts } from './fonts.mjs'
import { check, finish, gen, adm, mock, account, superToken, RUN, store, restoreCfg, BASE, SUPER, PASS, sleep, vnToday, acct, spelling } from './_ai.mjs'

const OUT = OUT_DIR
const browser = await pw.chromium.launch({ headless: true })
const allErrs = []
async function device(name, { width = 1440, height = 900, seed = null } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 })
  await useRealFonts(ctx)
  if (seed) await ctx.addInitScript((kv) => { if (window.top !== window) return; if (sessionStorage.getItem('s')) return; sessionStorage.setItem('s', '1'); localStorage.clear(); for (const [k, v] of Object.entries(kv)) localStorage.setItem(k, v) }, seed)
  const page = await ctx.newPage()
  page.on('pageerror', (e) => allErrs.push(name + ' pageerror: ' + e.message))
  page.on('console', (m) => { if (m.type() === 'error' && !/favicon|fonts\.g|status of 4\d\d/.test(m.text())) allErrs.push(name + ' console: ' + m.text()) })
  return { name, ctx, page }
}
async function until(fn, ms = 15000, step = 300) { const t0 = Date.now(); for (;;) { const v = await fn(); if (v) return v; if (Date.now() - t0 > ms) return v; await sleep(step) } }
async function adminLogin(d, phone, pass) {
  await d.page.goto(BASE + '/quan-tri', { waitUntil: 'networkidle' })
  await d.page.fill('.adm-login input[placeholder="Số điện thoại hoặc email"]', phone)
  await d.page.fill('.adm-login input[type=password]', pass)
  await d.page.click('.adm-login button.cta')
  await d.page.waitForSelector('.adm-tabs', { timeout: 10000 })
  await until(async () => /Super admin|Admin/.test(await d.page.locator('.adm-me').innerText()), 8000)
}
const txt = (d, sel) => d.page.locator(sel).first().innerText().catch(() => '')
const noHScroll = (d) => d.page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)

const tS = await superToken()
await restoreCfg(tS)
// số liệu hôm nay: một phụ huynh soạn câu + Vở Spelling
const PU = '0981' + RUN, KU = 'kU' + RUN
const tU = await account(PU, [{ id: KU, grade: 'Lớp 4' }])
const NAME = 'Làm tròn số ' + RUN
await gen({ subject: 'Toán', grade: 'Lớp 4', topic: 'Số tự nhiên', concepts: [{ name: NAME, details: [] }], count: 10 }, { token: tU, childId: KU })
await spelling({ mode: 'topic', topic: 'fruits', count: 5 }, tU)

/* ======== A. 1440 px ======== */
console.log('— A. /quan-tri 1440 px')
const A = await device('A')
await adminLogin(A, SUPER, PASS)
const nav = await A.page.locator('.dk-nav').innerText()
check('menu: "Chi phí AI" nằm ở nhóm "Chỉ super admin" (sau "Quản trị viên", trước "Cài đặt")', /Chỉ super admin[\s\S]*Quản trị viên[\s\S]*Chi phí AI[\s\S]*Cài đặt/i.test(nav), nav)
await A.page.click('.adm-tab:has-text("Chi phí AI")')
await A.page.waitForSelector('[data-testid=rp-summary]', { timeout: 10000 })   // tab đầu từ 27/11/2026: Báo cáo ngày
await A.page.click('.aic-subs .chip:has-text("Tổng quan")')
await A.page.waitForSelector('[data-testid=aic-today]', { timeout: 10000 })
const today = await txt(A, '[data-testid=aic-today]')
const days = await txt(A, '[data-testid=aic-days]')
check('Tổng quan: ô "Hôm nay" (đồng + USD nhỏ), 7 ngày, 30 ngày', /Hôm nay/i.test(today) && /\d+đ/.test(today) && /\$\d+\.\d+/.test(today) && /đ/.test(await txt(A, '[data-testid=aic-7]')) && /đ/.test(await txt(A, '[data-testid=aic-30]')), today)
check('bảng 30 ngày: ngày · tiền · lời gọi · lượt soạn mới · câu từ ngân hàng · câu soạn mới; hôm nay có số', /Ngày[\s\S]*Tiền[\s\S]*Lời gọi[\s\S]*Lượt soạn mới[\s\S]*Câu từ ngân hàng[\s\S]*Câu soạn mới/i.test(days) && (await A.page.locator(`[data-testid=aic-days] tr[data-day="${vnToday()}"]`).count()) === 1, days.slice(0, 300))
const kinds = await txt(A, '[data-testid=aic-kinds]'), models = await txt(A, '[data-testid=aic-models]'), top = await txt(A, '[data-testid=aic-top]')
check('theo loại việc (Soạn câu ôn, Vở Spelling…), token theo model (claude-sonnet-5-5), tài khoản tốn nhất tháng có phụ huynh vừa dùng', /Soạn câu ôn/.test(kinds) && /Vở Spelling/.test(kinds) && /claude-sonnet-5-5/.test(models) && top.includes(PU), [kinds, models, top].join(' | ').slice(0, 400))
check('ghi chú: Anthropic Console tính ngày theo giờ UTC', /Anthropic Console tính ngày theo giờ UTC; muốn so thì so phần tăng trong cùng một khoảng thời gian/.test(await txt(A, '.aic-note')))
await A.page.screenshot({ path: `${OUT}/aicost_1440_stats.png`, fullPage: true })

// Cài đặt
await A.page.click('.aic-subs .chip:has-text("Cài đặt")')
await A.page.waitForSelector('[data-testid=aic-cfg]')
check('Cài đặt: 7 dòng model (Toán, Tiếng Việt, Tiếng Anh, Ngữ văn, Các môn khác, Vở Spelling, Chấm câu tự gõ), không có <select>', (await A.page.locator('.aic-mrow').count()) === 7 && (await A.page.locator('[data-testid=aic-cfg] select').count()) === 0 && /Chính xác \(Sonnet\)/.test(await txt(A, '.aic-mrow[data-group=toan]')))
await A.page.click('.aic-mrow[data-group=toan] .sel-btn')
await A.page.click('.aic-mrow[data-group=toan] .sel-opt:has-text("Tiết kiệm (Haiku)")')
await A.page.fill('#aic-lim', '2')
await A.page.click('[data-testid=aic-cfg] button:has-text("Lưu cài đặt")')
await until(async () => /Đã lưu/.test(await txt(A, '[data-testid=aic-cfg]')))
const cf = (await adm('ai_cfg_get', {}, tS)).cfg
check('đổi Toán -> Tiết kiệm (Haiku), giới hạn 2 -> "Đã lưu", máy chủ có cài đặt mới', cf.models.toan === 'haiku' && cf.genLimit === 2 && cf.models['tieng-viet'] === 'sonnet', JSON.stringify(cf))
await A.page.screenshot({ path: `${OUT}/aicost_1440_cfg.png`, fullPage: true })
await restoreCfg(tS)

// Ngân hàng câu
await A.page.click('.aic-subs .chip:has-text("Ngân hàng câu")')
await A.page.waitForSelector('[data-testid=aic-bank-total]')
await A.page.fill('input[aria-label="Tìm theo tên khái niệm"]', NAME)
await A.page.click('.aic-filter button:has-text("Tìm")')
await until(async () => (await A.page.locator('[data-testid=aic-bank-list] [data-bank]').count()) === 1)
const row = await txt(A, '[data-testid=aic-bank-list] [data-bank]')
check('Ngân hàng câu: tổng (khái niệm, câu, lượt dùng); tìm theo tên -> 1 dòng: khái niệm, Toán, Lớp 4, Trắc nghiệm, 23 câu', /Khái niệm[\s\S]*Câu hỏi[\s\S]*Lượt dùng/i.test(await txt(A, '[data-testid=aic-bank-total]')) && row.includes(NAME) && /Toán/.test(row) && /Lớp 4/.test(row) && /Trắc nghiệm/.test(row) && /\b23\b/.test(row), row)
await A.page.click('[data-testid=aic-bank-list] [data-bank]')
await A.page.waitForSelector('[data-testid=aic-bank-detail] [data-qid]')
const det = await txt(A, '[data-testid=aic-bank-detail]')
check('bấm vào -> xem từng câu: đề, 4 lựa chọn (tô đáp án đúng), giải thích, model đã soạn', (await A.page.locator('[data-testid=aic-bank-detail] [data-qid]').count()) === 23 && (await A.page.locator('[data-testid=aic-bank-detail] .aic-opts li.ok').count()) === 23 && /Giải thích giả/.test(det) && /claude-sonnet-5-5/.test(det), det.slice(0, 300))
await A.page.screenshot({ path: `${OUT}/aicost_1440_bank.png`, fullPage: true })
await A.page.click('.aic-del')
check('"Xoá ngân hàng này" -> hỏi xác nhận trước', /Xoá hết 23 câu/.test(await txt(A, '[data-testid=aic-del-ask]')))
await A.page.click('[data-testid=aic-del-ask] button:has-text("Xoá")')
await until(async () => /Đã xoá ngân hàng/.test(await txt(A, '[data-testid=aic-bank]')))
check('xoá -> ngân hàng biến mất (máy chủ)', !(await adm('ai_bank_list', { q: NAME }, tS)).list.length)

// Thử model
await A.page.click('.aic-subs .chip:has-text("Thử model")')
await A.page.waitForSelector('[data-testid=aic-try] form')
check('Thử model: ô chọn môn / lớp / dạng là danh sách tự vẽ (không <select>)', (await A.page.locator('[data-testid=aic-try] select').count()) === 0 && (await A.page.locator('[data-testid=aic-try] .sel-pick').count()) === 3)
await A.page.fill('#aic-topic', 'Phân số')
await A.page.fill('#aic-concepts', 'Rút gọn phân số, So sánh phân số')
await A.page.click('[data-testid=aic-try] button:has-text("Thử")')
await A.page.waitForSelector('[data-testid=aic-try-haiku] [data-qi]', { timeout: 20000 })
const colS = await A.page.locator('[data-testid=aic-try-sonnet]').boundingBox(), colH = await A.page.locator('[data-testid=aic-try-haiku]').boundingBox()
check('hai cột cạnh nhau (Sonnet trái, Haiku phải), mỗi cột 10 câu + tiền (đồng)', colS && colH && Math.abs(colS.y - colH.y) < 5 && colH.x > colS.x + colS.width - 5 && (await A.page.locator('[data-testid=aic-try-sonnet] [data-qi]').count()) === 10 && /\d+đ/.test(await txt(A, '[data-testid=aic-try-cost-haiku]')), JSON.stringify([colS, colH]))
await A.page.locator('[data-testid=aic-try-haiku] .aic-wrong').nth(0).click()
await A.page.locator('[data-testid=aic-try-haiku] .aic-wrong').nth(2).click()
check('bấm "Sai" -> câu được đánh dấu (2 câu sai ở Haiku)', (await A.page.locator('[data-testid=aic-try-haiku] li.bad').count()) === 2 && /2 câu sai/.test(await txt(A, '[data-testid=aic-try-haiku] .aic-col-m')))
await A.page.screenshot({ path: `${OUT}/aicost_1440_try.png`, fullPage: true })
await A.page.waitForSelector('[data-testid=aic-try-save]', { timeout: 15000 }).catch(async () => { await A.page.screenshot({ path: `${OUT}/aicost_1440_try_fail.png`, fullPage: true }) })
await A.page.click('[data-testid=aic-try-save]')
await until(async () => (await A.page.locator('[data-testid=aic-try-sum] tr[data-row="Toán|haiku"]').count()) === 1)
const sumRow = await txt(A, '[data-testid=aic-try-sum] tr[data-row="Toán|haiku"]')
check('"Lưu đánh giá" -> bảng tổng kết có dòng Toán · Haiku (tổng câu, câu sai, tỷ lệ sai, tiền TB / 10 câu)', /Toán/.test(sumRow) && /Haiku/.test(sumRow) && /%/.test(sumRow) && /đ/.test(sumRow), sumRow)

// Người dùng: cột Tiền AI 30 ngày
await A.page.click('.adm-tab:has-text("Người dùng")')
await A.page.waitForSelector('[data-testid=adm-users] table')
await A.page.fill('[data-testid=adm-users] input', PU)
await A.page.click('[data-testid=adm-users] button:has-text("Tìm")')
await until(async () => (await A.page.locator(`[data-ai30="${PU}"]`).count()) === 1)
const ai30 = await txt(A, `[data-ai30="${PU}"]`)
check('Người dùng: cột "Tiền AI 30 ngày" (đồng) có số của phụ huynh vừa dùng', /Tiền AI 30 ngày/i.test(await txt(A, '[data-testid=adm-users] thead')) && /^[1-9][\d.]*đ$/.test(ai30.trim()), ai30)
check('A không lỗi trang', !allErrs.some((e) => e.startsWith('A ')), allErrs.join(' | '))

/* ======== B. 390 px ======== */
console.log('— B. /quan-tri 390 px')
const B = await device('B', { width: 390, height: 844 })
await adminLogin(B, SUPER, PASS)
await B.page.click('.adm-tab:has-text("Chi phí AI")')
await B.page.waitForSelector('[data-testid=rp-summary]')
await B.page.click('.aic-subs .chip:has-text("Tổng quan")')
await B.page.waitForSelector('[data-testid=aic-today]')
check('390 px: Tổng quan hiện đủ, không tràn ngang', (await noHScroll(B)) && /đ/.test(await txt(B, '[data-testid=aic-today]')))
await B.page.screenshot({ path: `${OUT}/aicost_390_stats.png`, fullPage: true })
await B.page.click('.aic-subs .chip:has-text("Thử model")')
await B.page.fill('#aic-concepts', 'Từ đồng nghĩa')
await B.page.click('[data-testid=aic-try] .sel-pick >> nth=0')
await B.page.click('.sel-opt:has-text("Tiếng Việt")')
await B.page.click('[data-testid=aic-try] button:has-text("Thử")')
await B.page.waitForSelector('[data-testid=aic-try-sonnet] [data-qi]', { timeout: 20000 })
const oneCol = (await B.page.locator('[data-testid=aic-try-haiku]').count()) === 0
await B.page.click('.aic-tabs .chip:has-text("Haiku")')
await B.page.waitForSelector('[data-testid=aic-try-haiku] [data-qi]')
check('390 px Thử model: hai thẻ "Sonnet" / "Haiku" chuyển qua lại (mỗi lần một cột), không tràn ngang', oneCol && (await B.page.locator('[data-testid=aic-try-sonnet]').count()) === 0 && (await noHScroll(B)))
await B.page.screenshot({ path: `${OUT}/aicost_390_try.png`, fullPage: true })
await B.page.click('.aic-subs .chip:has-text("Cài đặt")')
await B.page.waitForSelector('[data-testid=aic-cfg]')
check('390 px Cài đặt + Ngân hàng câu không tràn ngang', await noHScroll(B))
await B.page.click('.aic-subs .chip:has-text("Ngân hàng câu")')
await B.page.waitForSelector('[data-testid=aic-bank-total]')
check('…', await noHScroll(B))
const SP = '0982' + RUN
await adm('staff_add', { phone: SP, name: 'NV', pass: 'NhanVien#1' }, tS)
const C = await device('C')
await adminLogin(C, SP, 'NhanVien#1')
check('admin thường: không có mục "Chi phí AI"', (await C.page.locator('.adm-tab:has-text("Chi phí AI")').count()) === 0)
await C.ctx.close()
await adm('staff_remove', { phone: SP }, tS)
check('B không lỗi trang', !allErrs.some((e) => e.startsWith('B ')), allErrs.join(' | '))

/* ======== C. Con ôn 2 lượt cùng chủ đề ======== */
console.log('— C. Con ôn 2 lượt cùng chủ đề')
const iso = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10) }
const concept = (id, name, subject) => ({ id: id + RUN, name, subject, topic: name, difficulty: 'Cơ bản', importance: 'Quan trọng', details: [], learnedOn: iso(3), updatedAt: Date.now() - 86400000, learnedInApp: true, mastery: 40, pts: 40, hist: '1010', reviews: 2, correct: 2, wrong: 2 })
async function kidDevice(name, phone, kid, mem) {
  await acct('register', { phone, pass: PASS, parentName: 'Ba ' + name, plan: 1, pin: '3', children: [{ id: kid, name: 'An', pin: '7', icon: '🦊', grade: 'Lớp 4' }] })
  const d = await device(name, { width: 390, height: 844, seed: { ['ontap.memory.v2::' + kid]: JSON.stringify(mem) } })
  await d.page.goto(BASE + '/', { waitUntil: 'networkidle' })
  if (await d.page.locator('.auth-landing').count()) await d.page.click('.auth-landing button:has-text("Đăng nhập")')
  await d.page.fill('input[placeholder="Số điện thoại hoặc email"]', phone)
  await d.page.fill('input[placeholder="Mật khẩu 8 số"]', PASS)
  await d.page.click('.auth-card button.cta:has-text("Đăng nhập")')
  await d.page.waitForSelector('.pick-grid', { timeout: 10000 })
  await d.page.click('.pick-card:has-text("An")')
  await d.page.fill('.pick-pinbox input', '7'); await d.page.click('.pick-pinbox button.cta')
  await d.page.waitForSelector('.kh-cta', { timeout: 10000 })
  return d
}
async function review(d, answer = true) {
  await d.page.click('.kh-cta'); await d.page.waitForSelector('.cr-hero-cta')
  await d.page.click('.cr-hero-cta')
  await d.page.waitForSelector('.opts .opt, [data-testid=limit-screen]', { timeout: 25000 })
  if (!answer || (await d.page.locator('[data-testid=limit-screen]').count())) return []
  const qs = []
  for (let i = 0; i < 10; i++) {
    qs.push((await d.page.locator('.q-text, .question, .qcard h2').first().innerText().catch(() => '')) || '')
    await d.page.locator('.opts .opt').first().click()
    await d.page.locator('button:has-text("Câu tiếp theo"), button:has-text("Xem kết quả")').first().click()
  }
  return qs
}
const KID = 'kidAI' + RUN, PK = '0983' + RUN, CN = 'Phép chia có dư ' + RUN
const K = await kidDevice('K', PK, KID, [concept('cd', CN, 'Toán')])
await mock('/reset')
const q1 = await review(K)
const m1 = await mock()
const recentIds = (await K.page.evaluate((k) => JSON.parse(localStorage.getItem(k) || '[]'), 'ontap.recentq.v2::' + KID)).filter((s) => /^[0-9a-f]{8}\./.test(s))
check('lượt 1: ONTAP soạn mới (có gọi AI), con làm 10 câu; app ghi 10 id câu ngân hàng vào "câu đã gặp"', m1.gen.length > 0 && q1.length === 10 && recentIds.length === 10, JSON.stringify([m1.gen.length, recentIds.length]))
await K.page.reload({ waitUntil: 'networkidle' }); await K.page.waitForSelector('.kh-cta', { timeout: 10000 })
const t0 = Date.now()
const q2 = await review(K)
const m2 = await mock()
check(`lượt 2 cùng chủ đề: KHÔNG gọi AI (${m2.msgs} = ${m1.msgs} lời gọi), câu hiện ngay (${((Date.now() - t0) / 1000).toFixed(1)} giây cả lượt)`, m2.msgs === m1.msgs && q2.length === 10, JSON.stringify([m1.msgs, m2.msgs]))
const recent2 = (await K.page.evaluate((k) => JSON.parse(localStorage.getItem(k) || '[]'), 'ontap.recentq.v2::' + KID)).filter((s) => /^[0-9a-f]{8}\./.test(s))
check('lượt 2: 10 câu KHÁC 10 câu lượt 1 (id ngân hàng không trùng)', recent2.length === 20 && new Set(recent2).size === 20, JSON.stringify(recent2.slice(0, 4)))
const st = await adm('ai_stats', {}, tS)
check('Chi phí AI ghi lượt 2: câu từ ngân hàng tăng, lượt soạn mới không tăng', st.ok && st.days[0].bank_q >= 13, JSON.stringify(st.days[0]).slice(0, 200))
await K.page.screenshot({ path: `${OUT}/aicost_kid_review2.png` })
check('C không lỗi trang', !allErrs.some((e) => e.startsWith('K ')), allErrs.join(' | '))

/* ======== D. Quá giới hạn ======== */
console.log('— D. Quá giới hạn lượt soạn mới')
const KID2 = 'kidLim' + RUN, PL = '0984' + RUN
const L = await kidDevice('L', PL, KID2, [concept('cm', 'Chia số có hai chữ số ' + RUN, 'Toán')])
await adm('ai_cfg_set', { genLimit: 1 }, tS)
await store([['SET', `ai:g:${vnToday()}:${PL}:${KID2}`, '1', 'EX', '172800']])   // con đã dùng 1 lượt soạn mới hôm nay
const msgsL = (await mock()).msgs
await review(L, false)
const lim = await txt(L, '[data-testid=limit-screen]')
check('quá giới hạn (1 chủ đề mới / ngày), chủ đề chưa có câu -> màn nhẹ nhàng: "Hôm nay con đã ôn đủ 1 chủ đề mới rồi! Con ôn lại các chủ đề đã học nhé, mai ONTAP soạn tiếp."; không gọi AI, không có nút "Thử lại"',
  /Hôm nay con đã ôn đủ 1 chủ đề mới rồi!/.test(lim) && /Con ôn lại các chủ đề đã học nhé, mai ONTAP soạn tiếp\./.test(lim) && !/Thử lại/.test(lim) && (await mock()).msgs === msgsL && (await L.page.locator('.opts .opt').count()) === 0, lim)
await L.page.screenshot({ path: `${OUT}/aicost_kid_limit.png` })
await L.page.click('[data-testid=limit-screen] button:has-text("Về Bắt đầu ôn")')
await L.page.waitForSelector('.screen.cr', { timeout: 5000 })
check('nút "Về Bắt đầu ôn" -> màn Bắt đầu ôn', (await L.page.locator('.screen.cr').count()) === 1)
check('D không lỗi trang', !allErrs.some((e) => e.startsWith('L ')), allErrs.join(' | '))
await restoreCfg(tS)
await browser.close()
finish()
