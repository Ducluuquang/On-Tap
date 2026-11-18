// TRANG QUẢN TRỊ + GÓP Ý — máy chủ (api/admin.mjs, api/feedback.mjs) với kho thử.
//  1  Quyền: chưa đăng nhập / tài khoản thường / máy chủ chưa có ADMIN_PHONES -> không dùng được việc quản trị; bảng giá công khai đọc được.
//  2  Người dùng: tài khoản cũ (trước khi có danh mục) vẫn hiện; tìm theo số / email; lần dùng gần nhất; không lộ mật khẩu băm.
//  3  Tổng quan + định giá gói.
//  4  Góp ý hai chiều: gửi (kèm ảnh, bối cảnh), quản trị xem / trả lời, người gửi thấy trả lời (chưa xem -> đã xem), nhắn tiếp,
//     đóng phiếu + bài học, tải toàn bộ nhật ký (không kèm số điện thoại), nhật ký không hết hạn; không xem được phiếu người khác;
//     giới hạn 20 tin / ngày.
const BASE = process.env.BASE || 'http://localhost:4192'
const BASE_NOADMIN = process.env.BASE_NOADMIN || 'http://localhost:4194'
const SHIM = 'http://127.0.0.1:4199'
const results = {}
const check = (n, c, x = '') => { results[n] = c ? 'PASS' : 'FAIL'; console.log((c ? '  ✓ ' : '  ✗ ') + n + (c || !x ? '' : '  → ' + x)) }
const RUN = String(Date.now()).slice(-6)
const ip = () => '10.13.' + (Number(RUN) % 250) + '.' + (1 + Math.floor(Math.random() * 200))
async function post(base, path, body, token = '') {
  const r = await fetch(base + path, { method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': ip(), ...(token ? { authorization: 'Bearer ' + token } : {}) }, body: JSON.stringify(body) })
  let j = {}
  try { j = await r.json() } catch { j = {} }
  return { ...j, _status: r.status }
}
const acct = (action, body, token) => post(BASE, '/api/account', { action, ...body }, token)
const adm = (action, body, token, base = BASE) => post(base, '/api/admin', { action, ...body }, token)
const fb = (action, body, token) => post(BASE, '/api/feedback', { action, ...body }, token)
const store = async (cmds) => (await (await fetch(SHIM + '/pipeline', { method: 'POST', headers: { authorization: 'Bearer test-token' }, body: JSON.stringify(cmds) })).json()).map((x) => x.result)
const PASS = '12345678'
async function account(phone, extra = {}) {
  const r = await acct('register', { phone, pass: PASS, parentName: 'PH ' + phone.slice(-4), plan: 2, pin: '1', province: 'Hà Nội', children: [{ id: 'k1' + phone.slice(-6), name: 'An', pin: '1', icon: '🦊', grade: 'Lớp 7', school: 'THCS A' }, { id: 'k2' + phone.slice(-6), name: 'Bình', pin: '2', icon: '🐼', grade: 'Lớp 3' }], ...extra })
  return r.ok ? r.token : (await acct('login', { id: phone, pass: PASS })).token
}
const PNG = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d4944415478da63f8ffff3f0005fe02fea7d6a4b40000000049454e44ae426082', 'hex').toString('base64')

const tA = await account('0912000777')
await adm('settings_set', { aiOn: false }, tA)   // bộ thử này kiểm tra NGƯỜI trả lời; ONTAP tự trả lời thử ở t_api_roles
const U1 = '0919' + RUN, U2 = '0920' + RUN
const t1 = await account(U1, { email: `ph${RUN}@vidu.test` })
const t2 = await account(U2)
check('chuẩn bị: tài khoản quản trị + 2 tài khoản thường', !!tA && !!t1 && !!t2)

console.log('— 1. Quyền')
const acts = ['whoami', 'overview', 'users', 'prices_set', 'fb_list', 'fb_get', 'fb_reply', 'fb_status', 'fb_export']
const r0 = await Promise.all(acts.map((a) => adm(a, {}, '')))
const r1 = await Promise.all(acts.map((a) => adm(a, {}, t1)))
const r2 = await Promise.all(acts.map((a) => adm(a, {}, tA, BASE_NOADMIN)))
check('chưa đăng nhập -> bad_token; tài khoản thường -> not_admin (mọi việc quản trị)', r0.every((r) => r.error === 'bad_token') && r1.every((r) => r.error === 'not_admin'), JSON.stringify([r0.map((r) => r.error), r1.map((r) => r.error)]))
check('máy chủ CHƯA có ADMIN_PHONES: số quản trị cũng bị từ chối', r2.every((r) => r.error === 'not_admin'), JSON.stringify(r2.map((r) => r.error)))
const w = await adm('whoami', {}, tA)
check('quản trị: whoami -> admin', w.ok && w.admin === true && w.phone === '0912000777')
const pub = await (await fetch(BASE + '/api/admin')).json()
check('bảng giá công khai (GET, không cần đăng nhập): 5 gói, tháng / năm', pub.ok && Object.keys(pub.prices.plans).join() === '1,2,3,4,5' && 'month' in pub.prices.plans['1'])

console.log('— 2. Người dùng')
// tài khoản CŨ (tạo trước khi có danh mục acct:idx): ghi thẳng vào kho, không có trong danh mục
const OLD = '0921' + RUN
await store([['SET', 'acct:u:' + OLD, JSON.stringify({ v: 1, phone: OLD, email: '', parentName: 'Tài khoản cũ', plan: 1, children: [{ id: 'kOld', name: 'Cũ', grade: 'Lớp 5' }], salt: 'x', hash: 'y', pwv: 1, rev: 1, created: Date.now() - 40 * 86400000, updated: Date.now() - 40 * 86400000 })], ['DEL', 'acct:idx:ok']])
const us = await adm('users', {}, tA)
const all = []
for (let off = 0; off < 5000; off += 30) { const r = await adm('users', { offset: all.length }, tA); if (!r.users.length) break; all.push(...r.users) }
const us2 = await adm('users', {}, tA)
check(`danh sách tài khoản: ${us.total} tài khoản, có cả tài khoản cũ (quét kho lần đầu) và tài khoản mới`, us.ok && all.some((u) => u.phone === OLD) && all.some((u) => u.phone === U1) && all.length === us2.total && new Set(all.map((u) => u.phone)).size === all.length, JSON.stringify([us.total, us2.total, all.length]))
check('mới nhất lên đầu', all.findIndex((u) => u.phone === U2) < all.findIndex((u) => u.phone === OLD))
const u1 = all.find((u) => u.phone === U1)
check('thông tin tài khoản: tên, email, tỉnh, gói, các con (tên, lớp, trường), ngày đăng ký, lần dùng gần nhất', u1 && u1.parentName === 'PH ' + U1.slice(-4) && u1.email === `ph${RUN}@vidu.test` && u1.province === 'Hà Nội' && u1.plan === 2 && u1.children.length === 2 && u1.children[0].grade === 'Lớp 7' && u1.children[0].school === 'THCS A' && u1.created > 0 && u1.seen > 0, JSON.stringify(u1))
check('KHÔNG lộ mật khẩu băm / muối / PIN', !JSON.stringify(all).match(/"(hash|salt|pin|pwv)"/))
const s1 = await adm('users', { q: U1.slice(1) }, tA), s2 = await adm('users', { q: `PH${RUN}@VIDU.TEST` }, tA), s3 = await adm('users', { q: '0000000000999' }, tA)
check('tìm theo một phần số điện thoại / đúng email (không phân biệt hoa thường) / không có kết quả', s1.users.length === 1 && s1.users[0].phone === U1 && s2.users.length === 1 && s2.users[0].phone === U1 && s3.total === 0, JSON.stringify([s1.total, s2.total, s3.total]))
const seenBefore = u1.seen
await new Promise((r) => setTimeout(r, 20))
await acct('get', {}, t1)
const seenAfter = (await adm('users', { q: U1 }, tA)).users[0].seen
check('mở app (account "get") -> cập nhật lần dùng gần nhất', seenAfter > seenBefore)

console.log('— 3. Tổng quan + định giá')
const ov = await adm('overview', {}, tA)
check(`tổng quan: ${ov.users} tài khoản, ${ov.kids} học sinh, ${ov.new7} mới 7 ngày, ${ov.active7} dùng 7 ngày; doanh thu chưa có (null)`, ov.ok && ov.users === us2.total && ov.kids >= 5 && ov.new7 >= 3 && ov.new30 >= ov.new7 && ov.users - ov.new30 >= 1 && ov.active7 >= 3 && ov.byPlan['2'] >= 2 && ov.revenue === null, JSON.stringify(ov).slice(0, 300))
const bad = await adm('prices_set', { plans: { 1: { month: -5, year: 100 } } }, tA)
const ok = await adm('prices_set', { plans: { 1: { month: 99000, year: 990000 }, 2: { month: 179000, year: 1790000 } } }, tA)
const pub2 = await (await fetch(BASE + '/api/admin')).json()
check('định giá: giá âm bị từ chối; lưu giá gói 1, 2 -> bảng giá công khai đổi ngay; gói chưa đặt = 0', bad.error === 'bad_price' && ok.ok && pub2.prices.plans['1'].month === 99000 && pub2.prices.plans['2'].year === 1790000 && pub2.prices.plans['3'].month === 0, JSON.stringify(pub2.prices))
const deny = await adm('prices_set', { plans: { 1: { month: 1, year: 1 } } }, t1)
check('tài khoản thường không đổi được giá', deny.error === 'not_admin' && (await (await fetch(BASE + '/api/admin')).json()).prices.plans['1'].month === 99000)

console.log('— 4. Góp ý hai chiều')
const e1 = await fb('send', { kind: 'bug', text: '  ', who: 'parent' }, t1)
const e2 = await fb('send', { kind: 'bug', text: 'Lỗi thử', img: Buffer.from('không phải ảnh').toString('base64') }, t1)
const e0 = await fb('send', { kind: 'bug', text: 'Lỗi thử' }, '')
check('góp ý rỗng / ảnh sai dạng / chưa đăng nhập -> từ chối', e1.error === 'empty' && e2.error === 'bad_img' && e0.error === 'bad_token', JSON.stringify([e1.error, e2.error, e0.error]))
const f1 = await fb('send', { kind: 'bug', text: 'Bấm "Bắt đầu ôn" thì màn hình trắng.\nDòng 2.', who: 'parent', img: PNG, screen: 'trang phụ huynh', ua: 'Mozilla/5.0 (iPhone)' }, t1)
const f2 = await fb('send', { kind: 'idea', text: 'Con muốn có thêm trò chơi Toán', who: 'child', child: { id: 'k1' + U1.slice(-6) }, screen: 'trang chủ con' }, t1)
check('phụ huynh gửi báo lỗi (kèm ảnh, giữ xuống dòng); học sinh gửi kiến nghị (ghi tên con)', f1.ok && f1.thread.msgs[0].img === true && f1.thread.msgs[0].text.includes('\nDòng 2.') && f2.ok && f2.thread.who === 'child' && f2.thread.msgs[0].who === 'An', JSON.stringify([f1, f2]).slice(0, 300))
const kidId = 'k1' + U1.slice(-6)
const mc = await fb('mine', { who: 'child', child: { id: kidId } }, t1), mo = await fb('mine', { who: 'child', child: { id: 'k2' + U1.slice(-6) } }, t1), mp = await fb('mine', { who: 'parent' }, t1)
const rx = await fb('reply', { id: f1.thread.id, text: 'con chen vao', who: 'child', child: { id: kidId } }, t1)
check('cùng tài khoản: con chỉ thấy phiếu của mình (con khác không thấy, không nhắn vào phiếu của phụ huynh); phụ huynh thấy cả 2', mc.threads.length === 1 && mc.threads[0].id === f2.thread.id && mo.threads.length === 0 && mp.threads.length === 2 && rx.error === 'not_found', JSON.stringify([mc.threads.length, mo.threads.length, mp.threads.length, rx.error]))
const L = await adm('fb_list', {}, tA)
const li = L.threads.find((t) => t.id === f1.thread.id)
check('quản trị: hộp thư có 2 phiếu mới (chờ trả lời), kèm số điện thoại', L.ok && L.pending >= 2 && li && li.pending && li.phone === U1 && L.threads.some((t) => t.id === f2.thread.id && t.who === 'child'), JSON.stringify(L).slice(0, 300))
const G = await adm('fb_get', { id: f1.thread.id }, tA)
const im = await adm('fb_img', { id: f1.thread.id, n: 0 }, tA)
check('xem phiếu: bối cảnh (màn hình, máy, gói, số con), tên + email phụ huynh, ảnh chụp màn hình', G.ok && G.thread.ctx.screen === 'trang phụ huynh' && /iPhone/.test(G.thread.ctx.ua) && G.thread.ctx.kids === 2 && G.thread.user.email === `ph${RUN}@vidu.test` && im.ok && im.img === PNG, JSON.stringify(G.thread).slice(0, 300))
const other = await Promise.all([fb('reply', { id: f1.thread.id, text: 'chen vào' }, t2), fb('img', { id: f1.thread.id, n: 0 }, t2)])
const mine2 = await fb('mine', {}, t2)
check('tài khoản khác không xem / nhắn vào phiếu của người khác', other.every((r) => r.error === 'not_found') && mine2.ok && mine2.threads.length === 0)
const un0 = await fb('unread', {}, t1)
const rep = await adm('fb_reply', { id: f1.thread.id, text: 'Cảm ơn anh/chị, Ôn Tập đã sửa lỗi này.' }, tA)
const un1 = await fb('unread', {}, t1)
const unKid = await fb('unread', { who: 'child', child: { id: kidId } }, t1)
const M = await fb('mine', {}, t1)
const mt = M.threads.find((t) => t.id === f1.thread.id)
check('trả lời phiếu của phụ huynh không làm hiện chấm đỏ ở máy của con', unKid.unread === 0)
check('quản trị trả lời -> người gửi có 1 câu trả lời chưa xem (chấm đỏ), thấy tin "Ôn Tập" trong "Góp ý của tôi"', un0.unread === 0 && rep.ok && un1.unread === 1 && M.unread === 1 && mt.unread && mt.status === 'answered' && mt.msgs.at(-1).by === 'admin' && /đã sửa/.test(mt.msgs.at(-1).text), JSON.stringify([un0, un1, mt]).slice(0, 300))
const L2 = await adm('fb_list', { status: 'new' }, tA)
check('phiếu đã trả lời không còn trong "Chờ trả lời"', !L2.threads.some((t) => t.id === f1.thread.id))
const sn = await fb('seen', { id: f1.thread.id }, t1)
check('người gửi mở phiếu -> hết chấm đỏ', sn.ok && sn.unread === 0 && (await fb('unread', {}, t1)).unread === 0)
const ur = await fb('reply', { id: f1.thread.id, text: 'Vẫn còn lỗi trên iPad.', who: 'parent' }, t1)
const L3 = await adm('fb_list', { status: 'new' }, tA)
check('người gửi nhắn tiếp -> phiếu lại "chờ trả lời" ở trang quản trị', ur.ok && ur.thread.msgs.length === 3 && L3.threads.some((t) => t.id === f1.thread.id && t.pending))
const st = await adm('fb_status', { id: f1.thread.id, status: 'done', lesson: 'Màn trắng khi bắt đầu ôn trên iPad cũ: do trình duyệt cũ. Hướng dẫn cập nhật iPadOS.' }, tA)
const L4 = await adm('fb_list', {}, tA), L5 = await adm('fb_list', { status: 'done' }, tA)
check('đóng phiếu + ghi bài học -> ra khỏi "Đang mở", vào "Đã xong"', st.ok && st.thread.status === 'done' && !L4.threads.some((t) => t.id === f1.thread.id) && L5.threads.some((t) => t.id === f1.thread.id))
const bs = await adm('fb_status', { id: f1.thread.id, status: 'xyz' }, tA)
check('trạng thái lạ -> từ chối', bs.error === 'bad_status')
const X = await adm('fb_export', {}, tA)
const xt = X.threads.find((t) => t.id === f1.thread.id)
check('tải toàn bộ nhật ký cho AI học: đủ cuộc trò chuyện (3 tin), loại, trạng thái, bối cảnh, BÀI HỌC; KHÔNG kèm số điện thoại / email', X.ok && xt && xt.conversation.length === 3 && xt.conversation[1].from === 'Ôn Tập (người)' && xt.kind === 'Báo lỗi' && xt.status === 'Đã xong' && /iPadOS/.test(xt.lesson) && !JSON.stringify(X).includes(U1) && !JSON.stringify(X).includes('vidu.test'), JSON.stringify(xt).slice(0, 300))
const [ttl1, ttl2] = await store([['TTL', 'fb:t:' + f1.thread.id], ['TTL', 'fb:img:' + f1.thread.id + ':0']])
check('nhật ký + ảnh lưu vĩnh viễn (không hết hạn)', ttl1 === -1 && ttl2 === -1, JSON.stringify([ttl1, ttl2]))
const kb = await adm('kb', {}, tA), kbU = await adm('kb', {}, t1)
check('"Hiểu biết hệ thống" cho chăm sóc khách hàng: quản trị đọc được; tài khoản thường không', kb.ok && /Quên mật khẩu/.test(kb.text) && /Bài học \/ cách xử lý/.test(kb.text) && kbU.error === 'not_admin')
let lim = null
for (let i = 0; i < 25 && !lim; i++) { const r = await fb('send', { kind: 'other', text: 'Thử giới hạn ' + i }, t2); if (!r.ok) lim = { i, e: r.error } }
check('mỗi tài khoản tối đa 20 tin nhắn góp ý / ngày', lim && lim.i === 20 && lim.e === 'slow_down', JSON.stringify(lim))

console.log('— 5. Lần đầu tạo tài khoản quản trị (mã cài đặt ADMIN_SETUP_CODE)')
const CODE = 'ma-cai-dat-thu-123', NEWADM = '0912000779'
await store([['DEL', 'acct:u:' + NEWADM], ['DEL', 'acct:rl:fail:' + NEWADM]])
const st0 = await adm('setup', { phone: NEWADM, pass: 'MatKhau#2026', code: CODE }, '', BASE_NOADMIN)
const st1 = await adm('setup', { phone: NEWADM, pass: 'MatKhau#2026', code: 'sai-ma-123' }, '')
const st2 = await adm('setup', { phone: U1, pass: 'MatKhau#2026', code: CODE }, '')
const st3 = await adm('setup', { phone: NEWADM, pass: '1234567', code: CODE }, '')
check('máy chủ chưa có ADMIN_SETUP_CODE -> tắt; sai mã -> bad_code; số không có trong ADMIN_PHONES -> từ chối; mật khẩu < 8 ký tự -> từ chối',
  st0.error === 'setup_off' && st1.error === 'bad_code' && st2.error === 'not_admin_phone' && st3.error === 'bad_pass' && !(await store([['EXISTS', 'acct:u:' + NEWADM]]))[0], JSON.stringify([st0, st1, st2, st3].map((x) => x.error)))
const st4 = await adm('setup', { phone: '+84 912 000 779', pass: 'MatKhau#2026', code: CODE }, '')
const w4 = await adm('whoami', {}, st4.token)
const lg4 = await acct('login', { id: NEWADM, pass: 'MatKhau#2026' })
check('đúng mã + số "+84 912 000 779" (ADMIN_PHONES cũng ghi dạng +84) -> tạo tài khoản quản trị 0912000779, vào trang quản trị luôn; đăng nhập lại bằng mật khẩu đó được', st4.ok && st4.created === true && st4.phone === NEWADM && w4.ok && lg4.ok, JSON.stringify([st4.error, w4.error, lg4.error]))
const uAll = await adm('users', { q: NEWADM }, tA), ov2 = await adm('overview', {}, tA)
check('tài khoản chỉ để quản trị: không có con, không nằm trong danh sách người dùng / tổng quan', uAll.users.length === 0 && ov2.users === ov.users && JSON.parse((await store([['GET', 'acct:u:' + NEWADM]]))[0]).children.length === 0, JSON.stringify([uAll.total, ov2.users, ov.users]))
const st5 = await adm('setup', { phone: NEWADM, pass: 'MatKhauMoi#99', code: CODE }, '')
const lgOld = await acct('login', { id: NEWADM, pass: 'MatKhau#2026' }), lgNew = await acct('login', { id: NEWADM, pass: 'MatKhauMoi#99' })
const wOld = await adm('whoami', {}, st4.token)
check('quên mật khẩu quản trị: dùng lại mã cài đặt -> đặt mật khẩu mới; mật khẩu cũ + phiên cũ hết hiệu lực', st5.ok && st5.created === false && !lgOld.ok && lgNew.ok && wOld.error === 'bad_token', JSON.stringify([st5.created, lgOld.ok, lgNew.ok, wOld.error]))
const fixed = async (body) => (await fetch(BASE + '/api/admin', { method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': '10.99.' + (Number(RUN) % 250) + '.7' }, body: JSON.stringify({ action: 'setup', ...body }) })).json()
let rl = null
for (let i = 0; i < 12 && !rl; i++) { const r = await fixed({ phone: NEWADM, pass: 'MatKhau#2026', code: 'doan-ma-' + i }); if (r.error === 'slow_down') rl = i }
const rlOk = await fixed({ phone: NEWADM, pass: 'MatKhau#2026', code: CODE })
check('đoán mã: mỗi địa chỉ mạng sai tối đa 10 lần / giờ (lần 11 bị chặn, kể cả đúng mã)', rl === 10 && rlOk.error === 'slow_down', JSON.stringify([rl, rlOk.error]))

const fails = Object.entries(results).filter(([, v]) => v !== 'PASS')
console.log(fails.length ? `\n${fails.length} FAIL` : `\nALL PASS (${Object.keys(results).length} kiểm tra)`)
process.exit(fails.length ? 1 : 0)
