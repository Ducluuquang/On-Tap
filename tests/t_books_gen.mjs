// DÙNG SÁCH KHI SOẠN CÂU HỎI + LỚP THẬT CỦA CON + MÔN NGỮ VĂN THCS (Việc 2, phần B — 09/11/2026).
//  1  Lời nhắc soạn câu: có đoạn sách -> dặn bám sát sách, chính tả chuẩn, ghi nguồn; không có -> như cũ. Cấp học theo lớp;
//     Ngữ văn lớp 7 -> quy tắc Ngữ văn THCS.
//  2  Trình duyệt: "Ngữ văn" là môn riêng (trước đây là bí danh của Tiếng Việt); con lớp 6–12 thấy môn Ngữ văn.
//  3  Máy chủ (sách giả nạp bằng Message Batches giả): đúng lớp + môn -> lời nhắc có đoạn sách + nguồn; sai lớp / môn / không rõ
//     lớp / chủ đề không có trong sách -> như cũ. Mọi tài khoản dùng chung thư viện. Từ 25/11/2026 /api/ai cần chìa khoá đăng nhập
//     + id con (Chi phí AI): bộ thử gửi chìa khoá của tài khoản thử; tắt giới hạn lượt soạn mới khi thử; xoá ngân hàng câu trước phần 4.
//  4  Tài khoản KHÁC quản trị, con lớp 7: app gửi lớp thật "Lớp 7" (trước đây cứng "4-5"); máy chủ dùng đoạn sách.
// Sách ở đây là SÁCH GIẢ tự viết (kho công khai). Không gọi AI thật.
import { pw, OUT_DIR } from './_env.mjs'
import { useRealFonts } from './fonts.mjs'
import { subjectKey, subjectDisplayName, canonicalSubject, detectSubject, subjectsFromMem, subjectTone, gradeNo } from '../src/lib/subjects.js'
import { subjectRules, bookRule, levelOf, subjKey } from '../api/aiCore.mjs'
const OUT = OUT_DIR
const BASE = process.env.BASE || 'http://localhost:4192'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const results = {}
const check = (n, c, x = '') => { results[n] = c ? 'PASS' : 'FAIL'; console.log((c ? '  ✓ ' : '  ✗ ') + n + (c || !x ? '' : '  → ' + x)) }
const RUN = String(Date.now()).slice(-6)
const ip = () => '10.12.' + (Number(RUN) % 250) + '.' + (1 + Math.floor(Math.random() * 200))
async function post(base, path, body, token = '') {
  const r = await fetch(base + path, { method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': ip(), ...(token ? { authorization: 'Bearer ' + token } : {}) }, body: JSON.stringify(body) })
  let j = {}
  try { j = await r.json() } catch { j = {} }
  return { ...j, _status: r.status }
}
const acct = (action, body, token) => post(BASE, '/api/account', { action, ...body }, token)
const books = (action, body, token) => post(BASE, '/api/books', { action, ...body }, token)
const ocr = async (body) => (await fetch(BASE + '/__mock/ocr', body ? { method: 'POST', body: JSON.stringify(body) } : {})).json()
function jpeg(w, h, pad = 2000) {
  const head = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 16, 0x4a, 0x46, 0x49, 0x46, 0, 1, 1, 0, 0, 1, 0, 1, 0, 0, 0xff, 0xc0, 0, 11, 8, h >> 8, h & 255, w >> 8, w & 255, 1, 1, 0x11, 0])
  return Buffer.concat([head, Buffer.alloc(pad, 0x55), Buffer.from([0xff, 0xd9])]).toString('base64')
}
const half = (page, h) => ({ page, half: h, b64: jpeg(1100, 760) })

console.log('— 1. Lời nhắc soạn câu: có / không có đoạn sách; lớp thật; Ngữ văn THCS')
const ex = '[SGK Ngữ văn 7 tập 1, tr. 31]\n# Thực hành tiếng Việt: Từ láy\nTừ láy là từ được tạo bởi các tiếng giống nhau về âm hoặc vần.'
const br = bookRule(ex)
check('có đoạn sách -> lời nhắc kèm đoạn sách + dặn bám sát sách, chính tả chuẩn (chữ quét có thể sai), ghi nguồn ngắn', br.includes('ĐOẠN SÁCH THAM KHẢO') && br.includes(ex) && /BÁM SÁT/.test(br) && /chính tả CHUẨN/.test(br) && /SGK Ngữ văn 7 tập 1, tr\. 12/.test(br) /* ví dụ ghi nguồn */ && /CÓ THỂ SAI/.test(br))
check('không có đoạn sách -> lời nhắc như cũ (không thêm gì)', bookRule('') === '' && bookRule('   ') === '')
check('cấp học theo lớp: Lớp 3 tiểu học, Lớp 7 THCS, Lớp 11 THPT, không rõ ("4-5") tiểu học', levelOf('Lớp 3') === 'tiểu học' && levelOf('Lớp 7') === 'THCS' && levelOf('Lớp 11') === 'THPT' && levelOf('4-5') === 'tiểu học')
const nv = subjectRules('Ngữ văn', 'Lớp 7')
check('Ngữ văn lớp 7 -> quy tắc Ngữ văn THCS (đọc hiểu: thể loại, nhân vật, ngôi kể…; thực hành tiếng Việt: trạng ngữ, số từ, phó từ, từ láy; tri thức ngữ văn; 1 đáp án có căn cứ trong văn bản)',
  /Ngữ văn THCS/.test(nv) && ['thể loại', 'nhân vật', 'chi tiết', 'ngôi kể', 'chủ đề', 'biện pháp tu từ', 'trạng ngữ', 'số từ', 'phó từ', 'từ láy', 'TRI THỨC NGỮ VĂN'].every((x) => nv.includes(x)) && /1 đáp án đúng, có CĂN CỨ/.test(nv) && !/tiểu học/.test(nv), nv)
check('"Tiếng Việt" của con lớp 7 cũng ra quy tắc Ngữ văn THCS; Tiếng Việt lớp 4 vẫn quy tắc tiểu học như cũ', /Ngữ văn THCS/.test(subjectRules('Tiếng Việt', 'Lớp 7')) && /tiểu học lớp Lớp 4/.test(subjectRules('Tiếng Việt', 'Lớp 4')) && /tiểu học lớp 4-5/.test(subjectRules('Tiếng Việt', '4-5')))
check('Toán / môn khác lớp 8 -> chương trình THCS (không ghi "tiểu học")', /THCS lớp Lớp 8/.test(subjectRules('Lịch sử', 'Lớp 8')) && !/tiểu học/.test(subjectRules('Lịch sử', 'Lớp 8')) && subjKey('Ngữ văn') === 'ngu-van' && subjKey('Tiếng Việt') === 'tieng-viet')

console.log('— 2. Môn "Ngữ văn" riêng ở trình duyệt (trước đây là bí danh của Tiếng Việt)')
check('"Ngữ văn" / "ngu van" / "Văn học" -> môn Ngữ văn (không còn thành Tiếng Việt); "Tiếng Việt" giữ nguyên', subjectKey('Ngữ văn') === 'ngu-van' && subjectDisplayName('ngu van') === 'Ngữ văn' && canonicalSubject('Văn học') === 'Ngữ văn' && subjectDisplayName('Tiếng Việt') === 'Tiếng Việt' && subjectTone('Ngữ văn') === 'rose')
const dsub = detectSubject('Ngữ văn 7: Từ láy')
check('nhãn "Ngữ văn 7: Từ láy" -> môn Ngữ văn, Lớp 7', dsub && dsub.subject === 'Ngữ văn' && dsub.grade === 'Lớp 7' && dsub.rest === 'Từ láy', JSON.stringify(dsub))
const names = (l) => l.map((x) => x.name).join(',')
check('trang chủ con lớp 7 (chưa có bài Tiếng Việt): môn nổi bật Toán, Ngữ văn, Tiếng Anh; con lớp 4: Toán, Tiếng Việt, Tiếng Anh',
  names(subjectsFromMem([], 'Lớp 7')) === 'Toán,Ngữ văn,Tiếng Anh' && names(subjectsFromMem([], 'Lớp 4')) === 'Toán,Tiếng Việt,Tiếng Anh' && names(subjectsFromMem([])) === 'Toán,Tiếng Việt,Tiếng Anh' && gradeNo('Lớp 7') === 7)
check('con lớp 7 đã có bài ghi "Tiếng Việt" -> vẫn hiện Tiếng Việt như trước (không mất bài)', names(subjectsFromMem([{ subject: 'Tiếng Việt', name: 'x' }], 'Lớp 7')) === 'Toán,Tiếng Việt,Tiếng Anh')


/* ---------- chuẩn bị: quản trị nạp sách giả "Ngữ văn 7 tập 1" (SGK, 3 trang) ---------- */
const ADMIN = '0912000777', PASS = '12345678', USER = '0918' + RUN, KIDN = 'kidN' + RUN
let ra = await acct('register', { phone: ADMIN, pass: PASS, parentName: 'Quản trị', plan: 1, pin: '1', children: [{ id: 'kA' + RUN, name: 'Bé', pin: '1', icon: '🦊', grade: 'Lớp 7' }] })
const tA = ra.ok ? ra.token : (await acct('login', { id: ADMIN, pass: PASS })).token
const tUser = (await acct('register', { phone: USER, pass: PASS, parentName: 'Ba', plan: 1, pin: '3', children: [{ id: KIDN, name: 'Minh', pin: '7', icon: '🦊', grade: 'Lớp 7' }] })).token
const TITLE = 'Ngữ văn 7 tập 1'
await ocr({ books: { [TITLE]: {
  1: ['# Bài 2. Mèo mướp và chú gà trống\nMèo mướp nằm phơi nắng bên hiên nhà, gà trống gáy vang.', 'Gà trống rủ mèo mướp đi thăm cánh đồng lúa chín vàng.\n[Trang in: 30]'],
  2: ['# Thực hành tiếng Việt: Từ láy\nTừ láy là từ được tạo bởi các tiếng giống nhau về âm hoặc vần, ví dụ: lấp lánh, rì rào, xinh xắn.', 'Bài tập 1. Tìm từ láy trong câu "Suối chảy rì rào bên bãi cỏ xanh".\n[Trang in: 31]'],
  3: ['[Trống]', '# Bài 3. Số từ\nSố từ là những từ chỉ số lượng và thứ tự của sự vật.\n[Trang in: 32]'],
} } })
const cb = await books('create', { title: TITLE, grade: 'Lớp 7', subject: 'Ngữ văn', kind: 'sgk', pages: 3 }, tA)
await books('upload', { id: cb.book.id, items: [1, 2, 3].flatMap((p) => [half(p, 1), half(p, 2)]) }, tA)
const ready = (await books('poll', { id: cb.book.id }, tA)).book
check('chuẩn bị: sách giả SGK "Ngữ văn 7 tập 1" đã đọc xong trong thư viện chung', ready && ready.status === 'ready', JSON.stringify(ready))

console.log('— 3. Máy chủ soạn câu hỏi dùng sách (mọi tài khoản dùng chung)')
await fetch(BASE + '/__mock/ai/reset')
await post(BASE, '/api/admin', { action: 'ai_cfg_set', genLimit: 0 }, tA)   // bộ thử soạn 7 lượt mới liền cho một con: bỏ giới hạn lượt soạn mới (đặt lại 5 ở cuối)
const gen = async (payload) => {
  const r = await post(BASE, '/api/ai', { action: 'generate', payload: { count: 3, format: 'choice', ...payload }, childId: KIDN }, tUser)
  const m = await (await fetch(BASE + '/__mock/ai')).json()
  return { qs: r.questions || [], prompt: (m.gen.at(-1) || {}).prompt || '' }
}
const g1 = await gen({ subject: 'Ngữ văn', grade: 'Lớp 7', topic: 'Từ láy', concepts: [{ name: 'Từ láy', details: ['rì rào', 'lấp lánh'] }] })
check('con lớp 7, Ngữ văn, chủ đề "Từ láy" -> lời nhắc có ĐOẠN SÁCH đúng đoạn (SGK <tên>, tr. 31) + dặn bám sát sách, chính tả chuẩn',
  g1.qs.length === 6 /* 3 câu + 3 dự phòng (ngân hàng câu, 25/11/2026) */ && g1.prompt.includes('ĐOẠN SÁCH THAM KHẢO') && g1.prompt.includes(`[SGK ${TITLE}, tr. 31]`) && g1.prompt.includes('Từ láy là từ được tạo bởi') && !g1.prompt.includes('Mèo mướp nằm phơi nắng'), g1.prompt.slice(0, 600))
check('đoạn sách trong lời nhắc ≤ 3.500 ký tự; quy tắc Ngữ văn THCS (không ghi "tiểu học")', (() => { const a = g1.prompt.indexOf('<<<'), b = g1.prompt.indexOf('>>>'); return a > 0 && b - a <= 3510 })() && /Ngữ văn THCS/.test(g1.prompt) && !/tiểu học/.test(g1.prompt))
check('người dùng chỉ nhận câu hỏi (không nhận nguyên văn sách)', !JSON.stringify(g1.qs).includes('Từ láy là từ được tạo bởi'))
const g2 = await gen({ subject: 'Tiếng Việt', grade: 'Lớp 7', topic: 'Từ láy', concepts: ['Từ láy'] })
check('bài ghi môn "Tiếng Việt" của con lớp 7 -> vẫn dùng sách Ngữ văn 7', g2.prompt.includes(`[SGK ${TITLE}, tr. 31]`))
const g3 = await gen({ subject: 'Ngữ văn', grade: 'Lớp 6', topic: 'Từ láy', concepts: ['Từ láy'] })
const g4 = await gen({ subject: 'Toán', grade: 'Lớp 7', topic: 'Từ láy', concepts: ['Từ láy'] })
const g5 = await gen({ subject: 'Ngữ văn', grade: '4-5', topic: 'Từ láy', concepts: ['Từ láy'] })
const g6 = await gen({ subject: 'Ngữ văn', grade: 'Lớp 7', topic: 'Phân số', concepts: ['Rút gọn phân số'] })
check('sai lớp (6) / sai môn (Toán) / không rõ lớp / chủ đề không có trong sách -> lời nhắc như cũ (không có đoạn sách)', [g3, g4, g5, g6].every((g) => g.prompt && !g.prompt.includes('ĐOẠN SÁCH')), [g3, g4, g5, g6].map((g) => g.prompt.includes('ĐOẠN SÁCH')).join(','))
check('không rõ lớp ("4-5") -> vẫn quy tắc tiểu học như trước', /tiểu học/.test(g5.prompt))


const browser = await pw.chromium.launch({ headless: true })
const allErrs = []
async function device(seed = null) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 })
  await useRealFonts(ctx)
  // bài học có sẵn trên máy từ trước khi đăng nhập (đăng nhập xong tự lên máy chủ)
  if (seed) await ctx.addInitScript((kv) => { if (window.top !== window) return; if (sessionStorage.getItem('s')) return; sessionStorage.setItem('s', '1'); localStorage.clear(); for (const [k, v] of Object.entries(kv)) localStorage.setItem(k, v) }, seed)
  const page = await ctx.newPage()
  page.on('pageerror', (e) => allErrs.push('pageerror: ' + e.message))
  page.on('console', (m) => { if (m.type() === 'error' && !/favicon|fonts\.g|status of 4\d\d/.test(m.text())) allErrs.push('console: ' + m.text()) })
  await page.goto(BASE + '/', { waitUntil: 'networkidle' })
  return { ctx, page }
}
async function login(d, phone) {
  if (await d.page.locator('.auth-landing').count()) await d.page.click('.auth-landing button:has-text("Đăng nhập")')
  await d.page.fill('input[placeholder="Số điện thoại hoặc email"]', phone)
  await d.page.fill('input[placeholder="Mật khẩu 8 số"]', PASS)
  await d.page.click('.auth-card button.cta:has-text("Đăng nhập")')
  await d.page.waitForSelector('.pick-grid', { timeout: 10000 })
  await d.page.click('.pick-card:has-text("Minh")')
  await d.page.fill('.pick-pinbox input', '7'); await d.page.click('.pick-pinbox button.cta')
  await d.page.waitForSelector('.kh-cta', { timeout: 10000 })
}
/* ======== 4. Tài khoản KHÁC (không phải quản trị), con lớp 7 ôn Ngữ văn qua giao diện ======== */
// ngân hàng câu (25/11/2026): xoá câu "Từ láy" đã soạn ở phần 3 để con phần 4 phải soạn mới (thấy lời nhắc có đoạn sách)
for (const x of (await post(BASE, '/api/admin', { action: 'ai_bank_list', q: 'Từ láy' }, tA)).list || []) await post(BASE, '/api/admin', { action: 'ai_bank_del', key: x.key }, tA)
console.log('— 4. Tài khoản khác: con lớp 7 ôn Ngữ văn')
const MEMN = [{ id: 'tl1', name: 'Từ láy', subject: 'Ngữ văn', topic: 'Thực hành tiếng Việt', details: ['lấp lánh', 'rì rào'], difficulty: 'Cơ bản', importance: 'Quan trọng', learnedOn: new Date().toISOString().slice(0, 10), updatedAt: Date.now(), learnedInApp: true, mastery: 40, pts: 40, hist: '10', reviews: 1, correct: 1, wrong: 1 }]
const K = await device({ ['ontap.memory.v2::' + KIDN]: JSON.stringify(MEMN) })
await login(K, USER)
const P2 = K.page
const tiles = await P2.$$eval('.kh .sj-tile b', (els) => els.map((e) => e.textContent))
check('trang chủ con lớp 7: môn "Ngữ văn" (không gộp vào Tiếng Việt)', tiles.includes('Ngữ văn') && !tiles.includes('Tiếng Việt'), tiles.join(','))
await fetch(BASE + '/__mock/ai/reset')
const aiReqs = []
P2.on('request', (r) => { if (r.url().endsWith('/api/ai') && r.method() === 'POST') aiReqs.push(JSON.parse(r.postData() || '{}')) })
await P2.click('.kh-cta'); await P2.waitForSelector('.cr-hero-cta')
await P2.click('.cr-hero-cta')
await P2.waitForSelector('.opts .opt', { timeout: 30000 })
const gp = aiReqs.find((x) => x.action === 'generate')
check('app gửi LỚP THẬT của con: grade "Lớp 7", môn "Ngữ văn" (trước đây cứng "4-5")', gp && gp.payload.grade === 'Lớp 7' && gp.payload.subject === 'Ngữ văn', JSON.stringify(gp && gp.payload).slice(0, 200))
const genLog = (await (await fetch(BASE + '/__mock/ai')).json()).gen
const pr = (genLog.at(-1) || {}).prompt || ''
check('máy chủ soạn câu có ĐOẠN SÁCH "Từ láy" của SGK Ngữ văn 7 tập 1 (tr. 31) + quy tắc Ngữ văn THCS', /ĐOẠN SÁCH THAM KHẢO/.test(pr) && /\[SGK Ngữ văn 7 tập 1, tr\. 31\]/.test(pr) && /Từ láy là từ được tạo bởi/.test(pr) && /Ngữ văn THCS/.test(pr), pr.slice(0, 500))
check('con chỉ thấy câu hỏi, không thấy nguyên văn sách', !/Từ láy là từ được tạo bởi/.test(await P2.locator('.screen').innerText()))
await P2.screenshot({ path: `${OUT}/books_child_review.png` })


check('không có lỗi trang / lỗi console', allErrs.length === 0, allErrs.join(' | '))
await browser.close()
await books('delete', { id: cb.book.id }, tA)
await post(BASE, '/api/admin', { action: 'ai_cfg_set', genLimit: 5 }, tA)
const fails = Object.entries(results).filter(([, v]) => v !== 'PASS')
console.log(fails.length ? `\n${fails.length} FAIL` : `\nALL PASS (${Object.keys(results).length} kiểm tra)`)
process.exit(fails.length ? 1 : 0)
