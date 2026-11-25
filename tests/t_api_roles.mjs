// HAI CẤP QUẢN TRỊ + DUYỆT THAY ĐỔI + ONTAP CHĂM SÓC KHÁCH HÀNG — máy chủ (anh duyệt 18/11/2026). AI giả, thư giả (không gửi thật).
//  1  Super admin (ADMIN_PHONES) thêm / bỏ admin; admin không làm được việc của super admin.
//  2  Bảng giá: admin đề xuất -> chờ duyệt (giá công khai chưa đổi) -> super admin duyệt / từ chối; super admin đổi thì áp dụng ngay.
//  3  Sách: admin nạp -> đọc xong vẫn CHỜ DUYỆT (ONTAP chưa dùng khi soạn câu) -> xem thử -> duyệt thì dùng; từ chối thì không;
//     admin xoá -> chờ duyệt; super admin nạp / xoá -> ngay. Nhật ký thay đổi ghi ai làm, ai duyệt.
//  4  ONTAP chăm sóc khách hàng: câu hỏi cách dùng -> trả lời ngay, không cần người; cần thay đổi / gấp -> chuyển người + email quản trị;
//     lời nhắc có "Hiểu biết hệ thống" + bài học; AI lỗi -> chờ người; tắt ONTAP -> không tự trả lời. Email chỉ super admin sửa.
import fs from 'node:fs'
import path from 'node:path'
import { OUT_DIR } from './_env.mjs'
const BASE = process.env.BASE || 'http://localhost:4192'
const SHIM = 'http://127.0.0.1:4199'
const MAILF = path.join(OUT_DIR, 'mail-4192.jsonl')
const results = {}
const check = (n, c, x = '') => { results[n] = c ? 'PASS' : 'FAIL'; console.log((c ? '  ✓ ' : '  ✗ ') + n + (c || !x ? '' : '  → ' + x)) }
const RUN = String(Date.now()).slice(-6)
const ip = () => '10.15.' + (Number(RUN) % 250) + '.' + (1 + Math.floor(Math.random() * 200))
async function post(p, body, token = '') {
  const r = await fetch(BASE + p, { method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': ip(), ...(token ? { authorization: 'Bearer ' + token } : {}) }, body: JSON.stringify(body) })
  let j = {}
  try { j = await r.json() } catch { j = {} }
  return j
}
const acct = (action, body, token) => post('/api/account', { action, ...body }, token)
const adm = (action, body, token) => post('/api/admin', { action, ...body }, token)
const books = (action, body, token) => post('/api/books', { action, ...body }, token)
const fb = (action, body, token) => post('/api/feedback', { action, ...body }, token)
const ocr = async (body) => (await fetch(BASE + '/__mock/ocr', body ? { method: 'POST', body: JSON.stringify(body) } : {})).json()
const store = async (cmds) => (await (await fetch(SHIM + '/pipeline', { method: 'POST', headers: { authorization: 'Bearer test-token' }, body: JSON.stringify(cmds) })).json()).map((x) => x.result)
const prices = async () => (await (await fetch(BASE + '/api/admin')).json()).prices.plans
const mails = () => { try { return fs.readFileSync(MAILF, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l)) } catch { return [] } }
function jpeg(w, h) {
  const head = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 16, 0x4a, 0x46, 0x49, 0x46, 0, 1, 1, 0, 0, 1, 0, 1, 0, 0, 0xff, 0xc0, 0, 11, 8, h >> 8, h & 255, w >> 8, w & 255, 1, 1, 0x11, 0])
  return Buffer.concat([head, Buffer.alloc(1500, 0x55), Buffer.from([0xff, 0xd9])]).toString('base64')
}
const PASS = '12345678'
async function account(phone, extra = {}) {
  const r = await acct('register', { phone, pass: PASS, parentName: 'PH ' + phone.slice(-4), plan: 1, pin: '1', children: [{ id: 'k' + phone.slice(-6), name: 'An', pin: '1', icon: '🦊', grade: 'Lớp 9' }], ...extra })
  return r.ok ? r.token : (await acct('login', { id: phone, pass: PASS })).token
}

const tS = await account('0912000777')          // super admin (ADMIN_PHONES của máy chủ thử)
const STAFF = '0923' + RUN, PARENT_STAFF = '0924' + RUN, USER = '0925' + RUN
const tU = await account(USER)
await account(PARENT_STAFF)

console.log('— 1. Super admin / admin')
const w0 = await adm('whoami', {}, tS)
check('số trong ADMIN_PHONES -> Super admin', w0.ok && w0.role === 'super')
const a0 = await adm('staff_add', { phone: STAFF, name: 'Lan', pass: '' }, tS)
const a1 = await adm('staff_add', { phone: STAFF, name: 'Lan', pass: 'NhanVien#1' }, tS)
const a2 = await adm('staff_add', { phone: '0912000777', name: 'x' }, tS)
const a3 = await adm('staff_add', { phone: PARENT_STAFF, name: 'Phụ huynh làm admin' }, tS)
check('thêm admin: số chưa có tài khoản cần mật khẩu ban đầu ≥ 8 ký tự -> tạo tài khoản; số đã là super admin -> từ chối; số đã có tài khoản phụ huynh -> cấp quyền, giữ tài khoản', a0.error === 'bad_pass' && a1.ok && a1.created === true && a2.error === 'is_super' && a3.ok && a3.created === false, JSON.stringify([a0, a1, a2, a3].map((x) => x.error || x.created)))
const tA = (await acct('login', { id: STAFF, pass: 'NhanVien#1' })).token
const w1 = await adm('whoami', {}, tA)
check('admin đăng nhập /quan-tri bằng số + mật khẩu ban đầu -> vai "admin"', w1.ok && w1.role === 'admin', JSON.stringify(w1))
const sl = await adm('staff_list', {}, tS)
check('danh sách quản trị viên: super admin (từ ADMIN_PHONES) + 2 admin', sl.ok && sl.staff.some((x) => x.phone === '0912000777' && x.role === 'super') && sl.staff.some((x) => x.phone === STAFF && x.role === 'admin' && x.name === 'Lan') && sl.staff.some((x) => x.phone === PARENT_STAFF))
const deny = await Promise.all(['staff_list', 'staff_add', 'staff_remove', 'settings_set', 'chg_approve', 'chg_reject'].map((a) => adm(a, { phone: USER, id: 'c000000000000' }, tA)))
const allow = await Promise.all(['overview', 'users', 'fb_list', 'chg_list', 'settings_get'].map((a) => adm(a, {}, tA)))
check('admin KHÔNG làm được việc của super admin (quản trị viên, cài đặt, duyệt) nhưng làm được việc hằng ngày', deny.every((r) => r.error === 'not_super') && allow.every((r) => r.ok), JSON.stringify([deny.map((r) => r.error), allow.map((r) => r.ok)]))
const usersList = await adm('users', { q: STAFF }, tS)
check('tài khoản chỉ để quản trị không nằm trong danh sách người dùng', usersList.users.length === 0)

console.log('— 2. Bảng giá: admin đề xuất, super admin duyệt')
await adm('prices_set', { plans: { 1: { month: 100000, year: 1000000 } } }, tS)
const base = await prices()
const p1 = await adm('prices_set', { plans: { 1: { month: 120000, year: 1200000 } } }, tA)
const p2 = await adm('prices_set', { plans: { 1: { month: 130000, year: 1300000 } } }, tA)
const pend = await adm('prices_pending', {}, tA)
check('super admin đổi giá -> áp dụng ngay (100.000đ)', base['1'].month === 100000)
check('admin đổi giá -> "chờ duyệt", giá công khai VẪN 100.000đ; đề xuất thứ 2 thay đề xuất thứ 1', p1.ok && p1.pending && p2.pending && (await prices())['1'].month === 100000 && pend.change && pend.change.after['1'].month === 130000 && pend.change.before['1'].month === 100000, JSON.stringify(pend.change && pend.change.after['1']))
const own = await adm('chg_approve', { id: p2.change.id }, tA)
check('admin không tự duyệt được', own.error === 'not_super')
const ap = await adm('chg_approve', { id: p2.change.id, note: 'Đồng ý' }, tS)
check('super admin duyệt -> giá công khai thành 130.000đ', ap.ok && ap.change.status === 'approved' && (await prices())['1'].month === 130000)
const p3 = await adm('prices_set', { plans: { 1: { month: 1, year: 1 } } }, tA)
const rj = await adm('chg_reject', { id: p3.change.id, note: 'Giá sai' }, tS)
const again = await adm('chg_approve', { id: p3.change.id }, tS)
check('super admin từ chối -> giá không đổi; duyệt lại phiếu đã xử lý -> not_pending', rj.ok && rj.change.status === 'rejected' && (await prices())['1'].month === 130000 && again.error === 'not_pending')

console.log('— 3. Sách: admin nạp -> chờ duyệt mới được dùng')
const TB = 'Lịch sử 9 thử ' + RUN
await ocr({ books: { [TB]: { 1: ['# Bài 5. Phong trào giả tưởng ' + RUN + '\nPhong trào giả tưởng ' + RUN + ' diễn ra ở làng Cỏ May năm 1901.', '[Trang in: 20]'] } } })
const cb = await books('create', { title: TB, grade: 'Lớp 9', subject: 'Lịch sử', kind: 'sgk', pages: 1 }, tA)
await books('upload', { id: cb.book.id, items: [{ page: 1, half: 1, b64: jpeg(1100, 760) }, { page: 1, half: 2, b64: jpeg(1100, 760) }] }, tA)
const rb = (await books('poll', { id: cb.book.id }, tA)).book
check('admin nạp sách -> đọc xong nhưng "chờ duyệt" (approved:false)', rb.status === 'ready' && rb.approved === false, JSON.stringify(rb))
await fetch(BASE + '/__mock/ai/reset')
// Chi phí AI (25/11/2026): /api/ai cần chìa khoá + id con; mỗi lần thử một "ý nhỏ" khác để không lấy câu có sẵn trong ngân hàng câu
let genN = 0
const gen = async () => { await post('/api/ai', { action: 'generate', payload: { subject: 'Lịch sử', grade: 'Lớp 9', topic: 'Phong trào giả tưởng ' + RUN, concepts: [{ name: 'Phong trào giả tưởng ' + RUN, details: ['lần thử ' + (++genN)] }], count: 3 }, childId: 'k' + USER.slice(-6) }, tU); await new Promise((r) => setTimeout(r, 600)); return ((await (await fetch(BASE + '/__mock/ai')).json()).gen.at(-1) || {}).prompt || '' }
const g0 = await gen()
check('sách chưa duyệt -> ONTAP KHÔNG dùng khi soạn câu', g0 && !g0.includes('ĐOẠN SÁCH'), g0.slice(0, 120))
const cl = await adm('chg_list', {}, tS)
const cp = cl.changes.find((c) => c.type === 'book_publish' && c.ref === cb.book.id)
const pv = await adm('book_preview', { id: cb.book.id }, tS)
check('mục Duyệt: có "Đưa sách mới vào dùng" chờ duyệt (ai nạp); xem thử chữ ONTAP đọc được', cp && cp.status === 'pending' && cp.by === STAFF && pv.ok && pv.pages[0].text.includes('làng Cỏ May'), JSON.stringify(pv).slice(0, 200))
await adm('chg_approve', { id: cp.id }, tS)
await new Promise((r) => setTimeout(r, 700))
const g1 = await gen()
check('super admin duyệt -> ONTAP dùng đoạn sách khi soạn câu', g1.includes('ĐOẠN SÁCH') && g1.includes('làng Cỏ May'))
// sách thứ 2: từ chối
const cb2 = await books('create', { title: TB + ' B', grade: 'Lớp 9', subject: 'Lịch sử', kind: 'sbt', pages: 1 }, tA)
const cp2 = (await adm('chg_list', {}, tS)).changes.find((c) => c.ref === cb2.book.id)
const early = await adm('chg_approve', { id: cp2.id }, tS)
await adm('chg_reject', { id: cp2.id, note: 'Chữ đọc sai nhiều' }, tS)
const lb = (await books('list', {}, tA)).books.find((x) => x.id === cb2.book.id)
check('duyệt sách chưa đọc xong -> báo chưa được; từ chối -> sách ghi "không duyệt"', early.error === 'not_ready' && lb.rejected === true && lb.approved === false)
// admin xoá -> chờ duyệt
const d1 = await books('delete', { id: cb.book.id }, tA)
const still = (await books('list', {}, tA)).books.find((x) => x.id === cb.book.id)
const cd = (await adm('chg_list', {}, tS)).changes.find((c) => c.type === 'book_delete' && c.ref === cb.book.id && c.status === 'pending')
check('admin xoá sách -> chỉ là YÊU CẦU (sách còn, ghi "đang xin xoá")', d1.ok && d1.pending && still && still.delReq && cd)
await adm('chg_approve', { id: cd.id }, tS)
check('super admin duyệt xoá -> sách bị xoá', !(await books('list', {}, tS)).books.some((x) => x.id === cb.book.id))
const cs = await books('create', { title: TB + ' C', grade: 'Lớp 9', subject: 'Lịch sử', kind: 'sgv', pages: 1 }, tS)
check('super admin nạp sách -> được duyệt ngay (approved:true)', cs.book.approved === true)
const ds = await books('delete', { id: cs.book.id }, tS)
await books('delete', { id: cb2.book.id }, tS)
check('super admin xoá sách -> xoá ngay', ds.gone === true && !(await books('list', {}, tS)).books.some((x) => x.id === cs.book.id))
const log = (await adm('chg_list', {}, tS)).changes
check('nhật ký thay đổi: có áp dụng ngay / đã duyệt / không duyệt, ghi người làm + người duyệt', log.some((c) => c.status === 'applied' && c.by === '0912000777') && log.some((c) => c.status === 'approved' && c.by === STAFF && c.reviewedBy === '0912000777') && log.some((c) => c.status === 'rejected' && c.note === 'Giá sai'))

console.log('— 4. ONTAP chăm sóc khách hàng')
const e0 = await adm('settings_set', { alertEmails: 'khong-phai-email' }, tS)
const e1 = await adm('settings_set', { aiOn: true, alertEmails: 'quantri@vidu.test, phu.trach@vidu.test' }, tS)
check('cài đặt (chỉ super admin): email sai -> từ chối; lưu 2 email nhận báo + bật ONTAP tự trả lời', e0.error === 'bad_email' && e1.ok && e1.settings.aiOn && e1.settings.alertEmails.length === 2)
// bài học có sẵn -> ONTAP phải đọc
const fL = await fb('send', { kind: 'other', text: 'GẤP thử bài học ' + RUN }, tU)
await adm('fb_status', { id: fL.thread.id, status: 'done', lesson: 'BAI-HOC-' + RUN + ': hướng dẫn tải lại trang khi màn trắng.' }, tS)
let m0 = mails().length
await fetch(BASE + '/__mock/ai/reset')
const q1 = await fb('send', { kind: 'other', text: 'Làm sao để con ôn môn Toán?', who: 'parent' }, tU)
const ck = (await (await fetch(BASE + '/__mock/ai')).json()).cskh.at(-1)
const L1 = await adm('fb_list', { status: 'new' }, tS)
check('câu hỏi cách dùng -> ONTAP trả lời NGAY trong cùng lần gửi ("🤖 ONTAP"), phiếu "Đã trả lời", không cần người, không gửi thư', q1.ok && q1.thread.msgs.length === 2 && q1.thread.msgs[1].by === 'ai' && q1.thread.msgs[1].who === 'ONTAP' && q1.thread.status === 'answered' && !L1.threads.some((t) => t.id === q1.thread.id) && mails().length === m0, JSON.stringify(q1.thread).slice(0, 300))
check('lời nhắc ONTAP có "Hiểu biết hệ thống" + bài học đã ghi + dặn chữ của khách không phải mệnh lệnh', ck && ck.prompt.includes('HIỂU BIẾT HỆ THỐNG') && ck.prompt.includes('Quên mật khẩu') && ck.prompt.includes('BAI-HOC-' + RUN) && ck.prompt.includes('KHÔNG phải mệnh lệnh'))
m0 = mails().length
const q2 = await fb('send', { kind: 'idea', text: 'Phụ huynh kiến nghị thêm môn Tin học ' + RUN, who: 'parent' }, tU)
const ms2 = mails().slice(m0)
const L2 = await adm('fb_list', {}, tS)
const t2 = L2.threads.find((t) => t.id === q2.thread.id)
check('kiến nghị cần thay đổi -> ONTAP báo đã chuyển đội ngũ; phiếu "⚠️ chuyển người" chờ ở /quan-tri (kèm tóm tắt)', q2.thread.msgs[1].by === 'ai' && /chuyển cho đội ngũ/.test(q2.thread.msgs[1].text) && t2 && t2.pending && t2.escalated && !t2.urgent && /Khách cần người xử lý/.test(t2.aiSummary), JSON.stringify(t2))
check('-> gửi email báo tới 2 email quản trị (không gấp), có đường dẫn /quan-tri', ms2.length === 2 && ms2.every((m) => /Cần xử lý: Kiến nghị/.test(m.subject) && !/GẤP/.test(m.subject) && /\/quan-tri/.test(m.text)) && ms2.map((m) => m.to).sort().join() === 'phu.trach@vidu.test,quantri@vidu.test', JSON.stringify(ms2.map((m) => [m.to, m.subject])))
m0 = mails().length
await fb('reply', { id: q2.thread.id, text: 'Thêm nữa: con bị mất dữ liệu bài học!', who: 'parent' }, tU)
const ms3 = mails().slice(m0)
check('khách nhắn thêm việc GẤP (mất dữ liệu) -> phiếu thành gấp + email "GẤP"', ms3.length === 2 && ms3.every((m) => /GẤP/.test(m.subject)) && (await adm('fb_list', {}, tS)).threads.find((t) => t.id === q2.thread.id).urgent)
m0 = mails().length
await fb('reply', { id: q2.thread.id, text: 'Đề nghị thêm: báo cáo theo tháng', who: 'parent' }, tU)
check('nhắn thêm vào phiếu đã chuyển người -> không gửi thư trùng', mails().length === m0)
const q4 = await fb('send', { kind: 'bug', text: 'Thử khi AI lỗi [ai-hong]' }, tU)
check('ONTAP lỗi -> không trả lời bừa, phiếu chờ người như trước', q4.ok && q4.thread.msgs.length === 1 && (await adm('fb_list', { status: 'new' }, tS)).threads.some((t) => t.id === q4.thread.id))
await adm('settings_set', { aiOn: false }, tS)
const q5 = await fb('send', { kind: 'other', text: 'Hỏi khi tắt ONTAP' }, tU)
check('tắt "ONTAP tự trả lời" -> không tự trả lời, chờ người', q5.thread.msgs.length === 1 && q5.thread.status === 'new')
const x = await adm('fb_export', {}, tS)
check('nhật ký tải về ghi rõ tin của "ONTAP (AI)", phiếu chuyển người / gấp', x.threads.some((t) => t.id === q2.thread.id && t.escalated && t.urgent && t.conversation.some((m) => m.from === 'ONTAP (AI)')))
await adm('settings_set', { aiOn: true }, tS)
const rm = await adm('staff_remove', { phone: STAFF }, tS)
check('bỏ quyền admin -> người đó không vào /quan-tri được nữa', rm.ok && (await adm('whoami', {}, tA)).error === 'not_admin')
await adm('staff_remove', { phone: PARENT_STAFF }, tS)

const fails = Object.entries(results).filter(([, v]) => v !== 'PASS')
console.log(fails.length ? `\n${fails.length} FAIL` : `\nALL PASS (${Object.keys(results).length} kiểm tra)`)
process.exit(fails.length ? 1 : 0)
