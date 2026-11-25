// CHI PHÍ AI — Việc 1 (25/11/2026): /api/ai và /api/spelling CHỈ chạy khi đã đăng nhập; trần đầu vào; lỗi không lộ thông báo gốc.
//  1  Không có chìa khoá / chìa khoá sai / chìa khoá cũ sau khi đổi mật khẩu -> 401 { error: "login" } ở /api/ai (mọi action)
//     và /api/spelling (mọi mode); GET /api/spelling (kiểm tra máy chủ) vẫn như cũ.
//  2  Có chìa khoá -> chạy (soạn câu, đọc bài, chấm câu tự gõ, Vở Spelling).
//  3  Trần đầu vào: count ≤ 20, chuỗi ≤ 200 ký tự, extract ≤ 6 ảnh, judge ≤ 500 ký tự mỗi chuỗi; childId sai -> 400.
//  4  Máy chủ AI lỗi -> mã ngắn, KHÔNG trả nguyên thông báo gốc.
// Đối chứng: bản cũ (trước 25/11/2026) gọi AI không cần chìa khoá -> phần 1 HỎNG.
import { check, finish, gen, ai, mock, account, acct, PASS, RUN, spelling, askedN, post } from './_ai.mjs'

await mock('/reset')
const P = '0931' + RUN, KID = 'kA' + RUN
const tok = await account(P, [{ id: KID, grade: 'Lớp 4' }])
const C = (n) => [{ name: 'Phép cộng ' + RUN + ' ' + n, details: ['12 + 7'] }]
const payload = (n, extra = {}) => ({ subject: 'Toán', grade: 'Lớp 4', topic: 'Phép cộng', concepts: C(n), count: 5, format: 'choice', ...extra })

console.log('— 1. Không đăng nhập -> 401 "login"')
const before = (await mock()).msgs
const noTok = await Promise.all([
  gen(payload('a'), { childId: KID }),
  ai({ action: 'extract', items: [{ type: 'image', b64: 'AAAA', media: 'image/jpeg' }] }),
  ai({ action: 'extract_text', text: 'Hôm nay con học phân số' }),
  ai({ action: 'judge', payload: { question: '2+2', correct: '4', answer: 'bốn' } }),
  ai({ action: 'grade', image: 'AAAA' }),
])
check('/api/ai không có chìa khoá: generate / extract / extract_text / judge / grade -> 401 { error: "login" }', noTok.every((r) => r._status === 401 && r.error === 'login'), JSON.stringify(noTok.map((r) => [r._status, r.error])))
const badTok = await gen(payload('a'), { token: 'MDkxMjM0NTY3OA.1.abc', childId: KID })
const junkTok = await gen(payload('a'), { token: 'khong-phai-chia-khoa', childId: KID })
check('/api/ai chìa khoá sai / rác -> 401 "login"', badTok._status === 401 && badTok.error === 'login' && junkTok._status === 401 && junkTok.error === 'login', JSON.stringify([badTok._status, junkTok._status]))
const sp0 = await Promise.all(['topic', 'enrich', 'context', 'register', 'photo'].map((mode) => spelling({ mode, topic: 'fruits', count: 5, items: [{ w: 'apple' }] })))
check('/api/spelling không có chìa khoá: mọi mode (topic, enrich, context, register, photo) -> 401 "login"', sp0.every((r) => r.status === 401 && /"login"/.test(r.text)), JSON.stringify(sp0.map((r) => r.status)))
const spBad = await spelling({ mode: 'topic', topic: 'fruits', count: 5 }, 'khong-phai-chia-khoa')
check('/api/spelling chìa khoá sai -> 401', spBad.status === 401)
const getSp = await (await fetch(process.env.BASE || 'http://localhost:4192/api/spelling')).json().catch(() => null)
check('GET /api/spelling (trang kiểm tra máy chủ) vẫn trả { ok, ai } như cũ, không cần chìa khoá', getSp && getSp.ok === true && getSp.ai === true, JSON.stringify(getSp))
check('các yêu cầu không có chìa khoá KHÔNG gọi tới AI (không tốn tiền)', (await mock()).msgs === before, String((await mock()).msgs - before))
// chìa khoá cũ sau khi đổi mật khẩu
const P2 = '0932' + RUN
const tOld = await account(P2, [{ id: 'kB' + RUN }])
const ch = await acct('password', { cur: PASS, next: '87654321' }, tOld)
const old = await gen(payload('b'), { token: tOld, childId: 'kB' + RUN })
check('chìa khoá cũ sau khi đổi mật khẩu -> 401 "login"', ch.ok && old._status === 401 && old.error === 'login', JSON.stringify([ch.ok, ch.error, old._status]))

console.log('— 2. Có chìa khoá -> chạy')
const g1 = await gen(payload('a'), { token: tok, childId: KID })
check('generate có chìa khoá -> 200, đủ count + 3 = 8 câu, mỗi câu có id ngân hàng', g1._status === 200 && g1.questions.length === 8 && g1.questions.every((q) => /^[0-9a-f]{8}\.[0-9a-z]+$/.test(q.id)), JSON.stringify(g1).slice(0, 300))
const ex = await ai({ action: 'extract', items: [{ type: 'image', b64: 'AAAA', media: 'image/jpeg' }] }, tok)
const et = await ai({ action: 'extract_text', text: 'Hôm nay con học phân số' }, tok)
const jd = await ai({ action: 'judge', payload: { question: '2+2', correct: '4', answer: 'bốn' } }, tok)
check('extract / extract_text / judge có chìa khoá -> chạy', ex._status === 200 && ex.concepts && et._status === 200 && jd._status === 200 && jd.correct === true, JSON.stringify([ex._status, et._status, jd._status]))
const sp1 = await spelling({ mode: 'topic', topic: 'fruits', count: 5 }, tok)
check('Vở Spelling có chìa khoá -> luồng chữ (tên bộ + 5 từ)', sp1.status === 200 && sp1.lines[0].name === 'Fruits' && sp1.lines.filter((l) => l.w).length === 5, sp1.text.slice(0, 200))

console.log('— 3. Trần đầu vào')
await mock('/reset')
const long = 'x'.repeat(450)
const g2 = await gen({ ...payload('c'), count: 50, topic: 'Chủ đề ' + long, concepts: [{ name: 'Khái niệm ' + RUN + ' ' + long, details: ['ý nhỏ ' + long] }] }, { token: tok, childId: KID })
const m2 = await mock()
const pr = m2.gen.map((g) => g.prompt).join('\n')
check('generate count 50 -> cắt còn 20: trả 23 câu (20 + 3), AI chỉ được nhờ 23 + 10 = 33 câu', g2.questions.length === 23 && askedN(m2.gen) === 33, `${g2.questions.length} ${askedN(m2.gen)}`)
check('chủ đề / tên khái niệm / ý nhỏ dài 450 ký tự -> lời nhắc chỉ có ≤ 200 ký tự mỗi chuỗi', !pr.includes('x'.repeat(201)) && pr.includes('x'.repeat(150)), String((pr.match(/x+/g) || []).map((s) => s.length).sort((a, b) => b - a)[0]))
const ex7 = await ai({ action: 'extract', items: Array.from({ length: 7 }, () => ({ type: 'image', b64: 'AAAA', media: 'image/jpeg' })) }, tok)
const ex6 = await ai({ action: 'extract', items: Array.from({ length: 6 }, () => ({ type: 'image', b64: 'AAAA', media: 'image/jpeg' })) }, tok)
check('extract 7 ảnh -> 400 "too_many"; 6 ảnh -> chạy', ex7._status === 400 && ex7.error === 'too_many' && ex6._status === 200, JSON.stringify([ex7._status, ex7.error, ex6._status]))
await mock('/reset')
await ai({ action: 'judge', payload: { question: 'Q' + 'q'.repeat(900), correct: 'C' + 'c'.repeat(900), answer: 'A' + 'a'.repeat(900) } }, tok)
const jp = ((await mock()).judge[0] || {}).prompt || ''
check('judge: đề / đáp án mẫu / bài làm dài 900 ký tự -> mỗi chuỗi cắt còn 500', jp.includes('q'.repeat(499)) && !jp.includes('q'.repeat(500)) && !jp.includes('c'.repeat(500)) && !jp.includes('a'.repeat(500)), String(jp.length))
const badKid = await gen(payload('d'), { token: tok, childId: 'con-cua-nguoi-khac' })
const noKid = await gen(payload('d'), { token: tok })
check('generate: childId không thuộc tài khoản / thiếu -> 400 "bad_child"', badKid._status === 400 && badKid.error === 'bad_child' && noKid._status === 400 && noKid.error === 'bad_child', JSON.stringify([badKid._status, noKid._status]))
const badAct = await ai({ action: 'chat', text: 'hi' }, tok)
check('action lạ -> 400 (không thành cổng hỏi AI tự do)', badAct._status === 400)

console.log('— 4. Lỗi của máy chủ AI không lộ ra ngoài')
const leaks = []
for (const t of ['api_error', 'invalid_request_error', 'overloaded_error']) {
  await mock('/err/' + t)
  const a = await ai({ action: 'extract_text', text: 'phân số' }, tok)
  const b = await ai({ action: 'judge', payload: { question: '1+1', correct: '2', answer: '2' } }, tok)
  const s = await spelling({ mode: 'topic', topic: 'fruits', count: 5 }, tok)
  leaks.push({ t, a: [a._status, a.error], b: [b._status, b.error], s: [s.status, s.text.slice(0, 60)], leak: [a._raw, b._raw, s.text].some((x) => /SECRET|org-12345|credit/.test(x)) })
}
await mock('/err/off')
check('AI lỗi (api_error / invalid_request / overloaded) -> /api/ai và /api/spelling trả mã ngắn ("upstream", "bad_request", "overloaded"), không có chữ nào của thông báo gốc',
  leaks.every((l) => !l.leak && /^[a-z_]+$/.test(l.a[1]) && /^[a-z_]+$/.test(l.b[1]) && l.a[0] >= 400 && l.s[0] >= 400) && leaks[0].a[1] === 'upstream' && leaks[1].a[1] === 'bad_request' && leaks[2].a[1] === 'overloaded', JSON.stringify(leaks))
const g4 = await post('/api/ai', { action: 'generate', payload: payload('e'), childId: KID }, tok)
check('generate khi AI hỏng -> vẫn trả JSON gọn (không lộ lỗi gốc)', !/SECRET/.test(g4._raw), g4._raw.slice(0, 200))
await mock('/reset')
finish()
