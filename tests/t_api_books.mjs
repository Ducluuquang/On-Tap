// THƯ VIỆN SÁCH — máy chủ (api/books.mjs + api/ai.mjs) với kho thử + Message Batches GIẢ (không gọi AI thật, không gửi ảnh đi đâu).
//  1  Quyền: chưa đăng nhập / tài khoản thường / máy chủ chưa có ADMIN_PHONES -> không nạp, không xoá, không thấy danh sách.
//  2  Quản trị nạp sách giả 3 trang: 1 batch, sonnet mới nhất + tắt thinking kiểu model nhận được, lời nhắc chép chữ đúng;
//     nửa trang lỗi + nửa trang bị cắt -> báo thiếu, gửi lại (dài hơn) -> đọc xong; chỉ còn chữ nén (book:t), phần tạm bị xoá.
//  3  Giới hạn: > 24 ảnh, không phải JPEG, ảnh > 1,2 MP, trang ngoài sách, yêu cầu > 4,4 MB.
//  4  Nửa trang lỗi 3 lần -> bỏ qua (ghi "không đọc được"), sách vẫn xong.
//  5  Đang đọc (batch chưa xong): tiến độ; "list" khi chưa có gì mới tốn ít lệnh kho; xoá sách -> huỷ batch, xoá sạch kho.
const BASE = process.env.BASE || 'http://localhost:4192'
const BASE_NOADMIN = process.env.BASE_NOADMIN || 'http://localhost:4194'
const SHIM = 'http://127.0.0.1:4199'
const results = {}
const check = (n, c, x = '') => { results[n] = c ? 'PASS' : 'FAIL'; console.log((c ? '  ✓ ' : '  ✗ ') + n + (c || !x ? '' : '  → ' + x)) }
const RUN = String(Date.now()).slice(-6)
const ip = () => '10.9.' + (Number(RUN) % 250) + '.' + (1 + Math.floor(Math.random() * 200))
async function post(base, path, body, token = '') {
  const r = await fetch(base + path, { method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': ip(), ...(token ? { authorization: 'Bearer ' + token } : {}) }, body: typeof body === 'string' ? body : JSON.stringify(body) })
  let j = {}
  try { j = await r.json() } catch { j = {} }
  return { ...j, _status: r.status }
}
const acct = (action, body, token, base = BASE) => post(base, '/api/account', { action, ...body }, token)
const books = (action, body, token, base = BASE) => post(base, '/api/books', { action, ...body }, token)
const ocr = async (body) => (await fetch(BASE + '/__mock/ocr', body ? { method: 'POST', body: JSON.stringify(body) } : {})).json()
const store = async (cmds) => (await (await fetch(SHIM + '/pipeline', { method: 'POST', headers: { authorization: 'Bearer test-token' }, body: JSON.stringify(cmds) })).json()).map((x) => x.result)
async function account(phone, pass) {
  const r = await acct('register', { phone, pass, parentName: 'Thử', plan: 1, pin: '1', children: [{ id: 'k' + phone.slice(-6), name: 'Bé', pin: '1', icon: '🦊', grade: 'Lớp 7' }] })
  if (r.ok) return r.token
  const l = await acct('login', { id: phone, pass })
  return l.token
}
// ảnh JPEG giả (chỉ có phần đầu khung ghi kích thước + đệm cho đủ dung lượng)
function jpeg(w, h, pad = 2000) {
  const head = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 16, 0x4a, 0x46, 0x49, 0x46, 0, 1, 1, 0, 0, 1, 0, 1, 0, 0, 0xff, 0xc0, 0, 11, 8, h >> 8, h & 255, w >> 8, w & 255, 1, 1, 0x11, 0])
  return Buffer.concat([head, Buffer.alloc(pad, 0x55), Buffer.from([0xff, 0xd9])]).toString('base64')
}
const half = (page, h, w = 1100, hh = 760) => ({ page, half: h, b64: jpeg(w, hh) })

const ADMIN = '0912000777', PASS = '12345678', USER = '0916' + RUN
const tA = await account(ADMIN, PASS)
const tU = await account(USER, PASS)
check('chuẩn bị: tài khoản quản trị (trong ADMIN_PHONES của máy chủ thử) + tài khoản thường', !!tA && !!tU)
await ocr({ reset: true })

console.log('— 1. Quyền')
const n0 = await books('list', {}, '')
const nU = await books('list', {}, tU)
check('chưa đăng nhập -> bad_token; tài khoản thường -> admin:false, không có danh sách sách', n0.error === 'bad_token' && nU.ok === true && nU.admin === false && !('books' in nU), JSON.stringify([n0, nU]))
const deny = await Promise.all([books('create', { title: 'X', grade: 'Lớp 7', subject: 'Ngữ văn', kind: 'sgk', pages: 2 }, tU), books('upload', { id: 'b000000000000', items: [half(1, 1)] }, tU), books('delete', { id: 'b000000000000' }, tU), books('poll', { id: 'b000000000000' }, tU)])
check('tài khoản thường: tạo / gửi ảnh / xoá / hỏi tiến độ -> not_admin', deny.every((r) => r.error === 'not_admin'), JSON.stringify(deny.map((r) => r.error)))
const bad = await post(BASE, '/api/books', { action: 'list' }, 'MDkxMjAwMDc3Nw.1.' + 'x'.repeat(43))
check('chìa khoá giả -> bad_token', bad.error === 'bad_token', JSON.stringify(bad))
const lN = await books('list', {}, tA, BASE_NOADMIN), cN = await books('create', { title: 'X', grade: 'Lớp 7', subject: 'Ngữ văn', kind: 'sgk', pages: 2 }, tA, BASE_NOADMIN)
check('máy chủ CHƯA có ADMIN_PHONES: cả số quản trị cũng không phải quản trị, không tạo được sách', lN.admin === false && cN.error === 'not_admin', JSON.stringify([lN, cN]))

console.log('— 2. Nạp sách giả, đọc chữ, đọc lại nửa trang lỗi / bị cắt')
const TITLE = 'Sách thử ' + RUN
const badInfo = await Promise.all([books('create', { title: TITLE, grade: 'Lớp 13', subject: 'Ngữ văn', kind: 'sgk', pages: 3 }, tA), books('create', { title: TITLE, grade: 'Lớp 7', subject: 'Ngữ văn', kind: 'abc', pages: 3 }, tA), books('create', { title: TITLE, grade: 'Lớp 7', subject: 'Ngữ văn', kind: 'sgk', pages: 0 }, tA), books('create', { title: TITLE, grade: 'Lớp 7', subject: 'Ngữ văn', kind: 'sgk', pages: 5000 }, tA)])
check('thông tin sai (lớp 13, loại lạ, 0 trang, 5000 trang) -> từ chối', badInfo.map((r) => r.error).join(',') === 'bad_info,bad_info,bad_pages,bad_pages', badInfo.map((r) => r.error).join(','))
const cr = await books('create', { title: TITLE, grade: 'Lớp 7', subject: 'Ngữ văn', kind: 'sgk', pages: 3, file: '07-sgk-ngu-van-7-tap-mot.pdf' }, tA)
const A = cr.book
check('tạo sách: 3 trang = 6 nửa trang cần gửi', cr.ok && A.status === 'reading' && A.progress.total === 6 && A.progress.missing.join(',') === 'p1h1,p1h2,p2h1,p2h2,p3h1,p3h2', JSON.stringify(cr))
await ocr({ books: { [TITLE]: {
  1: ['# Bài 2. Mèo mướp và chú gà trống\nMèo mướp nằm phơi nắng bên hiên nhà, gà trống gáy vang.', 'Gà trống rủ mèo mướp đi thăm cánh đồng lúa chín vàng.\n[Trang in: 30]'],
  2: ['# Thực hành tiếng Việt: Từ láy\nTừ láy là từ được tạo bởi các tiếng giống nhau về âm hoặc vần, ví dụ: lấp lánh, rì rào, xinh xắn.', 'Bài tập 1. Tìm từ láy trong câu "Suối chảy rì rào bên bãi cỏ xanh".\n[Trang in: 31]'],
  3: ['[Trống]', '# Bài 3. Số từ\nSố từ là những từ chỉ số lượng và thứ tự của sự vật.\n[Trang in: 32]'],
} }, fail: [TITLE + '|p2h1'], cut: [TITLE + '|p3h2'] })
const up1 = await books('upload', { id: A.id, items: [1, 2, 3].flatMap((p) => [half(p, 1), half(p, 2)]) }, tA)
const st1 = await ocr()
const b1 = st1.batches.at(-1)
check('gửi 6 nửa trang -> MỘT batch 6 yêu cầu; máy chủ ghi "đang đọc" 6', up1.ok && up1.sent === 6 && b1 && b1.items.length === 6 && up1.book.progress.inflight === 6 && up1.book.progress.missing.length === 0, JSON.stringify([up1.error, up1.book && up1.book.progress]))
const it0 = b1.items[0]
check('yêu cầu đọc chữ: model sonnet mới nhất (claude-sonnet-5-5), thinking {type:"between_tools"} (model không nhận "disabled"), max_tokens 4096',
  b1.items.every((x) => x.model === 'claude-sonnet-5-5' && x.thinking && x.thinking.type === 'between_tools' && x.max_tokens === 4096), JSON.stringify(it0))
check('lời nhắc: "Đây là nửa trên của trang 1 trong sách <tên>. Chép lại CHÍNH XÁC toàn bộ chữ…"; ảnh 1100×760', it0.prompt.startsWith(`Đây là nửa trên của trang 1 trong sách ${TITLE}. Chép lại CHÍNH XÁC toàn bộ chữ`) && it0.w === 1100 && it0.h === 760, it0.prompt)
const dup = await books('upload', { id: A.id, items: [half(1, 1)] }, tA)
check('gửi lại nửa trang đang đọc -> không tạo batch mới (không tốn tiền 2 lần)', dup.ok && dup.sent === 0 && (await ocr()).batches.length === st1.batches.length, JSON.stringify(dup))
const p1 = await books('poll', { id: A.id }, tA)
check('batch xong: 4 nửa trang xong; nửa trang LỖI (p2h1) + nửa trang BỊ CẮT (p3h2) -> báo cần gửi lại', p1.ok && p1.book.status === 'reading' && p1.book.progress.done === 4 && p1.book.progress.inflight === 0 && p1.book.progress.missing.join(',') === 'p2h1,p3h2', JSON.stringify(p1.book && p1.book.progress))
const up2 = await books('upload', { id: A.id, items: [half(2, 1), half(3, 2)] }, tA)
const b2 = (await ocr()).batches.at(-1)
check('đọc lại 2 nửa trang -> lần 2 cho dài hơn (max_tokens 8192)', up2.ok && up2.sent === 2 && b2.items.length === 2 && b2.items.every((x) => x.max_tokens === 8192), JSON.stringify(b2 && b2.items.map((x) => [x.cid, x.max_tokens])))
const lA = await books('list', {}, tA)
const A2 = (lA.books || []).find((x) => x.id === A.id)
check('mở lại Cài đặt ("list" hỏi tiến độ) -> sách đọc xong: 6/6, không nửa trang lỗi', lA.admin === true && A2 && A2.status === 'ready' && A2.progress.done === 6 && A2.progress.failed === 0 && A2.chars > 100, JSON.stringify(A2))
const [txt, hh, jj, idx] = await store([['GET', 'book:t:' + A.id], ['EXISTS', 'book:h:' + A.id], ['EXISTS', 'book:j:' + A.id], ['HGET', 'book:idx', A.id]])
check('kho: chỉ còn chữ cả cuốn đã NÉN (book:t, "gz:"), phần tạm (book:h, book:j) đã xoá; không lưu ảnh', /^gz:/.test(txt || '') && hh === 0 && jj === 0 && !/b64|jpeg/i.test(idx), String(txt).slice(0, 20))
const keys = await store([['KEYS', 'book:*']])
check('kho không có khoá ảnh nào', !keys[0].some((k) => /img|image|jpg/i.test(k)), keys[0].join(','))
const again = await books('upload', { id: A.id, items: [half(1, 1)] }, tA)
check('sách đã đọc xong -> gửi ảnh nữa không tạo batch', again.ok && again.sent === 0)

console.log('— 3. Giới hạn kích thước')
const many = await books('upload', { id: A.id, items: Array.from({ length: 25 }, (_, i) => half(1 + (i % 3), 1)) }, tA)
const notJ = await books('upload', { id: A.id, items: [{ page: 1, half: 1, b64: Buffer.from('%PDF-1.4 không phải ảnh').toString('base64') }] }, tA)
const big = await books('upload', { id: A.id, items: [half(1, 1, 1300, 1000)] }, tA)
const outP = await books('upload', { id: A.id, items: [half(9, 1)] }, tA)
const huge = await post(BASE, '/api/books', JSON.stringify({ action: 'upload', id: A.id, items: [{ page: 1, half: 1, b64: 'A'.repeat(4500000) }] }), tA)
check('> 24 ảnh / không phải JPEG / ảnh 1,3 MP / trang ngoài sách / yêu cầu > 4,4 MB -> từ chối', many.error === 'bad_items' && notJ.error === 'not_jpeg' && big.error === 'img_too_big' && outP.error === 'bad_items' && huge._status === 413 && huge.error === 'too_large',
  JSON.stringify([many.error, notJ.error, big.error, outP.error, huge._status, huge.error]))

console.log('— 4. Nửa trang lỗi 3 lần')
const TB = 'Sách lỗi ' + RUN
const B = (await books('create', { title: TB, grade: 'Lớp 7', subject: 'Ngữ văn', kind: 'sbt', pages: 1 }, tA)).book
for (let k = 0; k < 3; k++) {
  await ocr({ fail: [TB + '|p1h1'] })
  await books('upload', { id: B.id, items: k === 0 ? [half(1, 1), half(1, 2)] : [half(1, 1)] }, tA)
  await books('poll', { id: B.id }, tA)
}
const pB = (await books('poll', { id: B.id }, tA)).book
check('lỗi 3 lần -> bỏ qua nửa trang đó, sách vẫn đọc xong ("1 nửa trang không đọc được")', pB.status === 'ready' && pB.progress.failed === 1 && pB.progress.done === 1, JSON.stringify(pB))
const again4 = await books('upload', { id: B.id, items: [half(1, 1)] }, tA)
check('không gửi lại lần thứ 4', again4.sent === 0)

console.log('— 5. Đang đọc, số lệnh kho, xoá sách')
await ocr({ hold: true })
const C = (await books('create', { title: 'Sách đang đọc ' + RUN, grade: 'Lớp 8', subject: 'Toán', kind: 'sgk', pages: 1 }, tA)).book
await books('upload', { id: C.id, items: [half(1, 1), half(1, 2)] }, tA)
await fetch(SHIM + '/stats/reset', { method: 'POST' })
const lC = await books('list', {}, tA)
const stats = await (await fetch(SHIM + '/stats')).json()
const cC = lC.books.find((x) => x.id === C.id)
check('batch chưa xong: sách "đang đọc", 2 nửa trang đang đọc', cC && cC.status === 'reading' && cC.progress.inflight === 2 && cC.progress.done === 0, JSON.stringify(cC))
const reading = lC.books.filter((x) => x.status === 'reading').length
check(`"list" khi chưa có gì mới: ${stats.commands} lệnh kho (≤ 2 + 1 mỗi cuốn đang đọc = ${2 + reading})`, stats.commands <= 2 + reading, JSON.stringify(stats))
const bidC = (await ocr()).batches.at(-1).id
const del = await books('delete', { id: C.id }, tA)
const [ex1, ex2, ex3, ex4] = await store([['HEXISTS', 'book:idx', C.id], ['EXISTS', 'book:j:' + C.id], ['EXISTS', 'book:h:' + C.id], ['EXISTS', 'book:t:' + C.id]])
check('xoá sách đang đọc -> huỷ batch đang chạy, xoá sạch khỏi kho', del.ok && (await ocr()).canceled.includes(bidC) && ex1 + ex2 + ex3 + ex4 === 0, JSON.stringify([del, ex1, ex2, ex3, ex4]))
await ocr({ hold: false })
const delB = await books('delete', { id: B.id }, tA)
check('xoá sách đã đọc xong -> mất khỏi danh sách', delB.ok && !(await books('list', {}, tA)).books.some((x) => x.id === B.id))

// dọn
await books('delete', { id: A.id }, tA)
const fails = Object.entries(results).filter(([, v]) => v !== 'PASS')
console.log(fails.length ? `\n${fails.length} FAIL` : `\nALL PASS (${Object.keys(results).length} kiểm tra)`)
process.exit(fails.length ? 1 : 0)
