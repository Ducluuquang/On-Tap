// Đăng nhập nhiều máy (anh yêu cầu 01/11/2026): thử thẳng máy chủ /api/account (Redis thật qua lớp giả Upstash).
// Đăng ký, đăng nhập bằng số điện thoại / email, sai mật khẩu, chìa khoá giả, cập nhật (thêm con, đổi email, PIN),
// đổi mật khẩu (chìa khoá cũ hết hiệu lực), quên mật khẩu trên máy đã đăng nhập, chuyển tài khoản cũ lên máy chủ,
// chống dò mật khẩu, chống spam đăng ký, mật khẩu không lưu dạng chữ, máy chủ chưa gắn kho.
// Phần 10 (10/11/2026): QUÊN MẬT KHẨU Ở MỌI MÁY bằng mã 6 số gửi tới email ("forgot_send" / "forgot_reset").
// Thư KHÔNG gửi thật: máy chủ thử ghi thư vào tests/out/mail-4192.jsonl; máy chủ 4194 = chưa cài gửi email (MAIL=0).
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
const BASE = 'http://localhost:4192/api/account', NOSTORE = 'http://localhost:4193/api/account', NOMAIL = 'http://localhost:4194/api/account'
const TDIR = path.dirname(fileURLToPath(import.meta.url))
const MAILS = path.join(TDIR, 'out', 'mail-4192.jsonl'), SLOG = path.join(TDIR, 'out', 's4192.log')
const mails = () => { try { return fs.readFileSync(MAILS, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)) } catch { return [] } }
const lastMail = (to) => mails().filter((m) => m.to === to).pop() || null
const codeOf = (m) => ((m && m.subject) || '').match(/(\d{6})$/)?.[1] || ''
const rttl = (k) => Number(execFileSync('redis-cli', ['-p', '6390', 'TTL', k]).toString().trim())
const rcmd = (...a) => execFileSync('redis-cli', ['-p', '6390', ...a]).toString().trim()
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

// ---- 10. QUÊN MẬT KHẨU Ở MỌI MÁY: mã 6 số gửi tới email đã đăng ký (10/11/2026) ----
const P5 = '0905' + RUN, E5 = `quen${RUN}@gmail.com`, P6 = '0906' + RUN, P7 = '0907' + RUN, E7 = `loi${RUN}@fail.test`
const reg5 = await call('register', { phone: P5, email: E5, pass: '11112222', parentName: 'Mẹ Quên', children: [kid('c-q1', 'Quỳnh')] })
const oldTok5 = (await call('login', { id: P5, pass: '11112222' })).token     // "máy cũ" đang đăng nhập
const before = mails().length
j = await call('forgot_send', { id: P5 })
let m = lastMail(E5), code = codeOf(m)
check('gửi mã bằng SỐ ĐIỆN THOẠI -> ok, chỉ trả email đã che (q***@gmail.com), không trả mã', j.ok && j.to === 'q***@gmail.com' && j.ttl === 900 && !JSON.stringify(j).includes(code) && !JSON.stringify(j).includes(E5), JSON.stringify(j))
check('thư tới đúng email đã đăng ký: người gửi "Ôn Tập", tiêu đề "Mã đặt lại mật khẩu Ôn Tập: <6 số>", nội dung có mã, 15 phút, "Nếu không phải anh/chị yêu cầu…"',
  mails().length === before + 1 && m && /^"Ôn Tập" </.test(m.from) && /^\d{6}$/.test(code) && m.text.includes(code) && /15 phút/.test(m.text) && /Nếu không phải anh\/chị yêu cầu, hãy bỏ qua thư này\./.test(m.text), JSON.stringify(m))
const fc = rget('acct:fc:' + P5)
check('kho chỉ giữ HMAC của mã (không có mã dạng chữ), hết hạn 900 giây', fc.length >= 40 && !fc.includes(code) && rttl('acct:fc:' + P5) > 890 && rttl('acct:fc:' + P5) <= 900, fc + ' ttl ' + rttl('acct:fc:' + P5))
j = await call('forgot_send', { id: ' ' + E5.toUpperCase() + ' ' })
m = lastMail(E5); const code2 = codeOf(m)
check('gửi mã bằng EMAIL (viết hoa, có khoảng trắng) -> ok, mã mới thay mã cũ', j.ok && j.to === 'q***@gmail.com' && /^\d{6}$/.test(code2), JSON.stringify(j))
if (code !== code2) { j = await call('forgot_reset', { id: P5, code, next: '33334444' }); check('mã cũ (đã gửi mã mới) không dùng được nữa', j.ok === false && j.error === 'code_wrong', JSON.stringify(j)) }
rdel('acct:ft:' + P5)
const wrong = code2 === '000000' ? '111111' : '000000'
j = await call('forgot_reset', { id: P5, code: wrong, next: '33334444' })
check('sai mã -> code_wrong, còn 4 lần', j.ok === false && j.error === 'code_wrong' && j.left === 4, JSON.stringify(j))
j = await call('forgot_reset', { id: P5, code: code2, next: '12ab' })
check('mật khẩu mới sai dạng -> bad_pass, KHÔNG làm mất mã', j.ok === false && j.error === 'bad_pass' && rget('acct:fc:' + P5) !== '', JSON.stringify(j))
j = await call('forgot_reset', { id: P5, code: code2, next: '1234567' })
check('mật khẩu mới không đủ 8 số -> bad_pass, mã vẫn còn', j.ok === false && j.error === 'bad_pass' && rget('acct:fc:' + P5) !== '', JSON.stringify(j))
j = await call('forgot_reset', { id: E5, code: code2, next: '33334444' })
check('đúng mã (nhập bằng email) -> ok, chìa khoá mới, tài khoản đủ con', j.ok && j.token && j.token !== oldTok5 && j.account.phone === P5 && j.account.children[0].id === 'c-q1', JSON.stringify(j).slice(0, 160))
const tok5 = j.token
const acc5 = JSON.parse(rget('acct:u:' + P5))
check('pwv + 1 và rev + 1; mã đã xoá khỏi kho', acc5.pwv === 2 && acc5.rev === reg5.account.rev + 1 && rget('acct:fc:' + P5) === '' && rget('acct:ft:' + P5) === '', JSON.stringify({ pwv: acc5.pwv, rev: acc5.rev }))
j = await call('get', {}, { token: oldTok5 })
check('máy cũ (chìa khoá cũ) -> bad_token (tự đăng xuất)', j.ok === false && j.error === 'bad_token', JSON.stringify(j))
check('chìa khoá mới dùng được; mật khẩu mới đăng nhập được, mật khẩu cũ thì không', (await call('get', {}, { token: tok5 })).ok && (await call('login', { id: P5, pass: '33334444' })).ok && (await call('login', { id: P5, pass: '11112222' })).error === 'bad_login')
j = await call('forgot_reset', { id: P5, code: code2, next: '55556666' })
check('dùng lại mã đã dùng -> code_expired', j.ok === false && j.error === 'code_expired', JSON.stringify(j))
// sai 5 lần -> huỷ mã
await call('forgot_send', { id: P5 }); const code3 = codeOf(lastMail(E5)); const w3 = code3 === '999999' ? '888888' : '999999'
const lefts = []
for (let k = 0; k < 4; k++) lefts.push((await call('forgot_reset', { id: P5, code: w3, next: '55556666' })).left)
j = await call('forgot_reset', { id: P5, code: w3, next: '55556666' })
check('sai 4 lần: còn 4,3,2,1 lần; sai lần thứ 5 -> code_locked, mã bị huỷ', lefts.join(',') === '4,3,2,1' && j.ok === false && j.error === 'code_locked' && rget('acct:fc:' + P5) === '', lefts.join(',') + ' ' + JSON.stringify(j))
j = await call('forgot_reset', { id: P5, code: code3, next: '55556666' })
check('sau khi bị huỷ, mã đúng cũng không dùng được (code_expired), mật khẩu không đổi', j.ok === false && j.error === 'code_expired' && (await call('login', { id: P5, pass: '33334444' })).ok, JSON.stringify(j))
// hết hạn
rdel('acct:rl:fs:' + P5)
await call('forgot_send', { id: P5 }); const code4 = codeOf(lastMail(E5))
rcmd('PEXPIRE', 'acct:fc:' + P5, '1'); await new Promise((r) => setTimeout(r, 30))
j = await call('forgot_reset', { id: P5, code: code4, next: '55556666' })
check('mã quá 15 phút (hết hạn) -> code_expired', j.ok === false && j.error === 'code_expired', JSON.stringify(j))
// mỗi tài khoản 3 lần gửi / giờ
rdel('acct:rl:fs:' + P5)
const sends = []
for (let k = 0; k < 4; k++) sends.push(await call('forgot_send', { id: P5 }))
check('mỗi tài khoản gửi tối đa 3 lần / giờ: lần thứ 4 -> send_limit (khác địa chỉ mạng cũng vậy)', sends.slice(0, 3).every((x) => x.ok) && sends[3].ok === false && sends[3].error === 'send_limit', JSON.stringify(sends[3]))
// mỗi địa chỉ mạng 10 lần gửi / giờ
const ipF = '10.251.' + (Number(RUN) % 250) + '.7'
const ipSends = []
for (let k = 0; k < 11; k++) ipSends.push(await call('forgot_send', { id: '0988' + RUN + String(k).padStart(2, '0') }, { ip: ipF }))
rdel('acct:rl:fs:' + P5)
const ipLast = await call('forgot_send', { id: P5 }, { ip: ipF })
check('mỗi địa chỉ mạng gửi tối đa 10 lần / giờ: lần 11 -> send_limit (kể cả tài khoản có thật)', ipSends.slice(0, 10).every((x) => x.error === 'not_found') && ipSends[10].error === 'send_limit' && ipLast.error === 'send_limit', JSON.stringify(ipSends[10]) + JSON.stringify(ipLast))
// chưa đăng ký / chưa có email / chưa cài gửi email / gửi lỗi
j = await call('forgot_send', { id: '0999' + RUN })
check('số chưa đăng ký -> not_found', j.ok === false && j.error === 'not_found', JSON.stringify(j))
j = await call('forgot_send', { id: 'khongco' + RUN + '@vidu.com' })
check('email chưa đăng ký -> not_found', j.ok === false && j.error === 'not_found', JSON.stringify(j))
await call('register', { phone: P6, pass: '12121212', children: [kid('c-ne1', 'Nê')] })
j = await call('forgot_send', { id: P6 })
check('tài khoản chưa có email -> no_email (không tạo mã)', j.ok === false && j.error === 'no_email' && rget('acct:fc:' + P6) === '', JSON.stringify(j))
rdel('acct:rl:fs:' + P5)
j = await call('forgot_send', { id: P5 }, { base: NOMAIL })
check('máy chủ chưa cài gửi email (thiếu MAIL_USER / MAIL_APP_PASSWORD) -> mail_off', j.ok === false && j.error === 'mail_off', JSON.stringify(j))
j = await call('forgot_send', { id: P5 }, { base: NOSTORE })
check('máy chủ chưa gắn kho -> no_store', j.ok === false && j.error === 'no_store', JSON.stringify(j))
await call('register', { phone: P7, email: E7, pass: '12121212', children: [kid('c-lo1', 'Lô')] })
j = await call('forgot_send', { id: P7 })
check('gửi thư lỗi -> mail_error, mã vừa tạo bị xoá', j.ok === false && j.error === 'mail_error' && rget('acct:fc:' + P7) === '', JSON.stringify(j))
j = await call('forgot_reset', { id: P6, code: '123456', next: '55556666' })
check('đặt lại khi chưa gửi mã -> code_expired; sai dạng mã -> bad_code', j.error === 'code_expired' && (await call('forgot_reset', { id: P5, code: '12a', next: '55556666' })).error === 'bad_code', JSON.stringify(j))
// forgot_reset dùng chung giới hạn đăng nhập theo địa chỉ mạng (60 lần / 10 phút)
const ipR = '10.252.' + (Number(RUN) % 250) + '.3'
let lastR = null
for (let k = 0; k < 61; k++) lastR = await call(k % 2 ? 'login' : 'forgot_reset', k % 2 ? { id: P6, pass: '00000000' } : { id: P6, code: '123456', next: '55556666' }, { ip: ipR })
check('forgot_reset tính chung giới hạn đăng nhập theo địa chỉ mạng -> slow_down', lastR.ok === false && lastR.error === 'slow_down', JSON.stringify(lastR))
// nhật ký máy chủ không chứa mã
const allCodes = mails().map(codeOf).filter(Boolean)
const slog = fs.readFileSync(SLOG, 'utf8')
check('nhật ký máy chủ không chứa mã nào đã gửi, không có MAIL_APP_PASSWORD', allCodes.length > 0 && !allCodes.some((c) => slog.includes(c)) && !/MAIL_APP_PASSWORD|app.?pass/i.test(slog), allCodes.filter((c) => slog.includes(c)).join(','))
for (const p of [P5, P6, P7]) { rdel('acct:u:' + p); rdel('acct:fc:' + p); rdel('acct:ft:' + p) }
rdel('acct:e:' + E5); rdel('acct:e:' + E7)

for (const p of [P1, P2, P3, P4]) rdel('acct:u:' + p)
console.log(Object.values(res).every(Boolean) ? `ALL PASS ✓ (${Object.keys(res).length} checks)` : 'FAILED: ' + Object.entries(res).filter(([, v]) => !v).map(([k]) => k).join(' | '))
