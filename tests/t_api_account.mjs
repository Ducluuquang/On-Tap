// Đăng nhập nhiều máy (anh yêu cầu 01/11/2026): thử thẳng máy chủ /api/account (Redis thật qua lớp giả Upstash).
// Đăng ký, đăng nhập bằng số điện thoại / email, sai mật khẩu, chìa khoá giả, cập nhật (thêm con, đổi email, PIN),
// đổi mật khẩu (chìa khoá cũ hết hiệu lực), quên mật khẩu trên máy đã đăng nhập, chuyển tài khoản cũ lên máy chủ,
// chống dò mật khẩu, chống spam đăng ký, mật khẩu không lưu dạng chữ, máy chủ chưa gắn kho.
import { execFileSync } from 'node:child_process'
const BASE = 'http://localhost:4192/api/account', NOSTORE = 'http://localhost:4193/api/account'
const res = {}; const check = (n, c, x = '') => { res[n] = !!c; console.log((c ? '  ✓ ' : '  ✗ ') + n + (c ? '' : '  → ' + x)) }
const RUN = String(Date.now()).slice(-6)
const IP = '10.9.' + (Number(RUN) % 250) + '.'
let ipN = 1
async function call(action, body = {}, { token, base = BASE, ip } = {}) {
  const r = await fetch(base, { method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': ip || IP + (ipN++ % 250), ...(token ? { authorization: 'Bearer ' + token } : {}) }, body: JSON.stringify({ action, ...body }) })
  let j = {}; try { j = await r.json() } catch {}
  return { ...j, http: r.status }
}
const rget = (k) => execFileSync('redis-cli', ['-p', '6390', '--raw', 'GET', k]).toString().trim()
const rdel = (k) => execFileSync('redis-cli', ['-p', '6390', 'DEL', k]).toString().trim()
const P1 = '0901' + RUN, P2 = '0902' + RUN, P3 = '0903' + RUN, P4 = '0904' + RUN
const E1 = `ba${RUN}@vidu.com`, E2 = `me${RUN}@vidu.com`
const kid = (id, name, extra = {}) => ({ id, name, pin: '7', icon: '🦊', grade: 'Lớp 5', school: 'TH Kim Đồng', schoolType: 'Công lập', ...extra })

// ---- 0. trạng thái ----
let g = await fetch(BASE).then((r) => r.json())
check('GET /api/account: có kho -> accounts:true', g.ok && g.accounts === true, JSON.stringify(g))
g = await fetch(NOSTORE).then((r) => r.json())
check('máy chủ chưa gắn kho -> accounts:false', g.ok && g.accounts === false, JSON.stringify(g))
let j = await call('login', { id: P1, pass: '12345678' }, { base: NOSTORE })
check('máy chủ chưa gắn kho: đăng nhập trả {ok:false, error:"no_store"} (HTTP 200, máy dùng tài khoản trên máy như cũ)', j.http === 200 && j.ok === false && j.error === 'no_store', JSON.stringify(j))

// ---- 1. đăng ký ----
j = await call('check', { phone: P1, email: E1 })
check('trước khi đăng ký: số điện thoại + email chưa có tài khoản', j.ok && j.phoneTaken === false && j.emailTaken === false, JSON.stringify(j))
const reg = await call('register', { phone: P1, email: E1.toUpperCase(), pass: '12345678', parentName: 'Ba Alex', province: 'TP. HCM', plan: 2, children: [kid('c-alex1', 'Alex'), kid('c-bin1', 'Bin', { pin: '12' })] })
check('đăng ký: ok, có chìa khoá, trả tài khoản (2 con, email viết thường)', reg.ok && reg.token && reg.account.phone === P1 && reg.account.email === E1 && reg.account.children.length === 2 && reg.account.plan === 2, JSON.stringify(reg).slice(0, 200))
check('tài khoản trả về KHÔNG có mật khẩu / mã băm / muối', reg.ok && !('hash' in reg.account) && !('salt' in reg.account) && !JSON.stringify(reg).includes('12345678'))
const stored = rget('acct:u:' + P1)
check('trong kho: chỉ có mã băm scrypt + muối, KHÔNG có mật khẩu dạng chữ', stored.includes('"hash"') && stored.includes('"salt"') && !stored.includes('12345678'), stored.slice(0, 120))
check('trong kho: email trỏ về số điện thoại', rget('acct:e:' + E1) === P1)
j = await call('check', { phone: P1, email: E1 })
check('sau khi đăng ký: báo số điện thoại + email đã có tài khoản', j.ok && j.phoneTaken === true && j.emailTaken === true, JSON.stringify(j))
j = await call('register', { phone: P1, email: 'khac' + RUN + '@vidu.com', pass: '11112222', children: [kid('c-x1', 'X')] })
check('đăng ký lại cùng số điện thoại -> phone_taken', j.ok === false && j.error === 'phone_taken', JSON.stringify(j))
j = await call('register', { phone: P2, email: E1, pass: '11112222', children: [kid('c-x2', 'X')] })
check('đăng ký số khác nhưng email đã dùng -> email_taken (không tạo tài khoản)', j.ok === false && j.error === 'email_taken' && rget('acct:u:' + P2) === '', JSON.stringify(j))

// ---- 2. đăng nhập ở "máy khác" ----
j = await call('login', { id: P1, pass: '12345678' })
check('đăng nhập bằng số điện thoại + mật khẩu -> ok, nhận đủ 2 con (đúng id), PIN con', j.ok && j.token && j.account.children.map((c) => c.id + ':' + c.pin).join(',') === 'c-alex1:7,c-bin1:12', JSON.stringify(j).slice(0, 200))
j = await call('login', { id: ' ' + E1.toUpperCase() + ' ', pass: '12345678' })
check('đăng nhập bằng email (viết hoa, có khoảng trắng) -> ok', j.ok && j.account.phone === P1, JSON.stringify(j).slice(0, 160))
j = await call('login', { id: '0901 ' + RUN.slice(0, 3) + '-' + RUN.slice(3), pass: '12345678' })
check('đăng nhập bằng số điện thoại có dấu cách / gạch -> ok', j.ok, JSON.stringify(j).slice(0, 160))
j = await call('login', { id: P1, pass: '12345679' })
check('sai mật khẩu -> bad_login', j.ok === false && j.error === 'bad_login', JSON.stringify(j))
j = await call('login', { id: '0999' + RUN, pass: '12345678' })
check('số điện thoại chưa đăng ký -> bad_login (giống sai mật khẩu, không lộ số nào đã đăng ký)', j.ok === false && j.error === 'bad_login', JSON.stringify(j))
j = await call('login', { id: 'khongco' + RUN + '@vidu.com', pass: '12345678' })
check('email chưa đăng ký -> bad_login', j.ok === false && j.error === 'bad_login', JSON.stringify(j))

// ---- 3. chìa khoá ----
let tok = reg.token
j = await call('get', {}, { token: tok })
check('get bằng chìa khoá -> tài khoản mới nhất', j.ok && j.account.phone === P1, JSON.stringify(j).slice(0, 120))
j = await call('get', {}, { token: tok.slice(0, -2) + (tok.endsWith('AA') ? 'BB' : 'AA') })
check('chìa khoá bị sửa -> bad_token', j.ok === false && j.error === 'bad_token', JSON.stringify(j))
j = await call('get', {})
check('không có chìa khoá -> bad_token', j.ok === false && j.error === 'bad_token', JSON.stringify(j))
const fake = Buffer.from(P2).toString('base64url') + tok.slice(tok.indexOf('.'))
j = await call('get', {}, { token: fake })
check('dùng chữ ký của tài khoản này cho số điện thoại khác -> bad_token', j.ok === false && j.error === 'bad_token', JSON.stringify(j))

// ---- 4. cập nhật: thêm con, đổi PIN, đổi email ----
j = await call('update', { account: { email: E2, pin: '5', children: [kid('c-alex1', 'Alex'), kid('c-bin1', 'Bin', { pin: '12' }), kid('c-na1', 'Na')] } }, { token: tok })
check('cập nhật: thêm con Na, PIN phụ huynh 5, email mới -> ok', j.ok && j.account.children.length === 3 && j.account.pin === '5' && j.account.email === E2 && j.account.parentName === 'Ba Alex' && j.account.plan === 2, JSON.stringify(j).slice(0, 220))
check('email cũ không còn trỏ về tài khoản; email mới trỏ đúng', rget('acct:e:' + E1) === '' && rget('acct:e:' + E2) === P1)
j = await call('login', { id: E2, pass: '12345678' })
check('đăng nhập bằng email mới -> ok, thấy 3 con', j.ok && j.account.children.length === 3, JSON.stringify(j).slice(0, 120))
j = await call('login', { id: E1, pass: '12345678' })
check('email cũ không đăng nhập được nữa', j.ok === false && j.error === 'bad_login', JSON.stringify(j))
const reg2 = await call('register', { phone: P2, email: E1, pass: '22223333', children: [kid('c-y1', 'Y')] })
check('email cũ đã trống -> tài khoản khác đăng ký được', reg2.ok, JSON.stringify(reg2).slice(0, 120))
j = await call('update', { account: { email: E1 } }, { token: tok })
check('đổi email sang email của tài khoản khác -> email_taken, giữ email cũ', j.ok === false && j.error === 'email_taken' && rget('acct:e:' + E2) === P1, JSON.stringify(j))
j = await call('update', { account: { children: [] } }, { token: tok })
check('gửi danh sách con rỗng -> giữ nguyên các con (không bao giờ mất hết con)', j.ok && j.account.children.length === 3, JSON.stringify(j).slice(0, 160))
j = await call('update', { account: { children: [kid('bad id!', 'X'), kid('c-alex1', '  Alex   Nguyễn  ', { pin: '1a2b' }), ...Array.from({ length: 20 }, (_, k) => kid('c-many' + k, 'K' + k))] } }, { token: tok })
check('làm sạch: bỏ id lạ, gọn tên, PIN chỉ còn số, tối đa 12 con', j.ok && j.account.children.length === 12 && j.account.children[0].name === 'Alex Nguyễn' && j.account.children[0].pin === '12' && !j.account.children.some((c) => c.id === 'bad id!'), JSON.stringify(j.account && j.account.children[0]))
await call('update', { account: { children: [kid('c-alex1', 'Alex'), kid('c-bin1', 'Bin', { pin: '12' }), kid('c-na1', 'Na')] } }, { token: tok })

// ---- 5. đổi mật khẩu: chìa khoá cũ ở máy khác hết hiệu lực ----
const other = (await call('login', { id: P1, pass: '12345678' })).token   // "máy khác" đang đăng nhập
j = await call('password', { cur: '00000000', next: '87654321' }, { token: tok })
check('đổi mật khẩu với mật khẩu hiện tại sai -> bad_password', j.ok === false && j.error === 'bad_password', JSON.stringify(j))
j = await call('password', { cur: '12345678', next: '87654321' }, { token: tok })
check('đổi mật khẩu đúng -> ok + chìa khoá mới', j.ok && j.token && j.token !== tok, JSON.stringify(j).slice(0, 120))
const tok2 = j.token
j = await call('get', {}, { token: other })
check('máy khác (chìa khoá cũ) -> bad_token (phải đăng nhập lại bằng mật khẩu mới)', j.ok === false && j.error === 'bad_token', JSON.stringify(j))
check('đăng nhập bằng mật khẩu cũ -> bad_login; mật khẩu mới -> ok', (await call('login', { id: P1, pass: '12345678' })).error === 'bad_login' && (await call('login', { id: P1, pass: '87654321' })).ok)

// ---- 6. quên mật khẩu trên máy đã đăng nhập (máy còn chìa khoá hợp lệ) ----
j = await call('reset', { next: '24681357' }, { token: other })
check('quên mật khẩu bằng chìa khoá cũ (mật khẩu đã đổi ở máy khác) -> bad_token', j.ok === false && j.error === 'bad_token', JSON.stringify(j))
j = await call('reset', { next: '24681357' }, { token: tok2 })
check('quên mật khẩu trên máy đang đăng nhập -> ok, mật khẩu mới dùng được ở mọi máy', j.ok && j.token && (await call('login', { id: E2, pass: '24681357' })).ok, JSON.stringify(j).slice(0, 120))
const tok3 = j.token

// ---- 7. chống dò mật khẩu ----
for (let k = 0; k < 10; k++) await call('login', { id: P1, pass: '0000000' + k })
j = await call('login', { id: P1, pass: '24681357' })
check('sai 10 lần liền -> tạm khoá (đúng mật khẩu cũng phải đợi), báo slow_down', j.ok === false && j.error === 'slow_down', JSON.stringify(j))
j = await call('login', { id: E2, pass: '24681357' })
check('đăng nhập bằng email cũng bị khoá (đếm theo tài khoản)', j.ok === false && j.error === 'slow_down', JSON.stringify(j))
rdel('acct:rl:fail:' + P1)
check('hết thời gian khoá -> đăng nhập lại được', (await call('login', { id: P1, pass: '24681357' })).ok)
const fixedIp = '10.250.' + (Number(RUN) % 250) + '.9'
let lastReg = null
for (let k = 0; k < 21; k++) lastReg = await call('register', { phone: '08' + RUN + String(k).padStart(2, '0'), pass: '12345678', children: [kid('c-s' + k, 'S')] }, { ip: fixedIp })
check('một địa chỉ mạng đăng ký quá 20 lần / giờ -> slow_down', lastReg.ok === false && lastReg.error === 'slow_down', JSON.stringify(lastReg))

// ---- 8. tài khoản cũ (chỉ có trên một máy) tự chuyển lên máy chủ ----
j = await call('claim', { phone: P3, email: `cu${RUN}@vidu.com`, pass: '13572468', parentName: 'Mẹ Bơ', plan: 1, pin: '3', children: [kid('c-bo1', 'Bơ')] })
check('chuyển tài khoản cũ lên máy chủ (chưa có) -> tạo mới, created:true, có chìa khoá', j.ok && j.created === true && j.token && j.account.children[0].id === 'c-bo1' && j.account.pin === '3', JSON.stringify(j).slice(0, 160))
j = await call('login', { id: P3, pass: '13572468' })
check('sau đó máy khác đăng nhập được tài khoản cũ này', j.ok && j.account.children[0].name === 'Bơ', JSON.stringify(j).slice(0, 120))
j = await call('claim', { phone: P3, pass: '13572468', children: [kid('c-bo2', 'Bơ')] })
check('máy thứ hai (đã đăng ký riêng cùng số, cùng mật khẩu) -> created:false + tài khoản máy chủ để gộp', j.ok && j.created === false && j.token && j.account.children[0].id === 'c-bo1', JSON.stringify(j).slice(0, 160))
j = await call('claim', { phone: P3, pass: '99999999', children: [kid('c-bo3', 'Bơ')] })
check('cùng số nhưng khác mật khẩu -> phone_taken (không đụng tài khoản trên máy chủ)', j.ok === false && j.error === 'phone_taken' && JSON.parse(rget('acct:u:' + P3)).children[0].id === 'c-bo1', JSON.stringify(j))
j = await call('claim', { phone: P4, email: E2, pass: '13572468', children: [kid('c-mo1', 'Mơ')] })
check('chuyển lên máy chủ mà email đã thuộc tài khoản khác -> vẫn tạo, bỏ email (emailOk:false)', j.ok && j.created === true && j.account.email === '' && j.emailOk === false && rget('acct:e:' + E2) === P1, JSON.stringify(j).slice(0, 160))

// ---- 9. yêu cầu sai dạng ----
j = await call('register', { phone: '12ab', pass: '12345678' })
check('số điện thoại sai dạng -> 400 bad_phone', j.http === 400 && j.error === 'bad_phone', JSON.stringify(j))
j = await call('register', { phone: '0905' + RUN, pass: '12' })
check('mật khẩu quá ngắn -> 400 bad_pass', j.http === 400 && j.error === 'bad_pass', JSON.stringify(j))
j = await call('get', {}, { token: tok3 })
check('chìa khoá sau "quên mật khẩu" vẫn dùng được', j.ok, JSON.stringify(j).slice(0, 80))

for (const p of [P1, P2, P3, P4]) rdel('acct:u:' + p)
console.log(Object.values(res).every(Boolean) ? `ALL PASS ✓ (${Object.keys(res).length} checks)` : 'FAILED: ' + Object.entries(res).filter(([, v]) => !v).map(([k]) => k).join(' | '))
