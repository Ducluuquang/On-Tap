// BÁO CÁO NGÀY (anh yêu cầu 27/11/2026): số liệu học + câu hỏi + tiền AI trong ngày, email mỗi tối (Vercel cron).
// AI giả (MOCK=1), kho thử, thư KHÔNG gửi thật (MAIL_MOCK_FILE = tests/out/mail-4192.jsonl). "Hôm nay" giả = một ngày năm 2041.
//  1  Dữ liệu thử: 2 tài khoản, 3 con; nhật ký học hôm nay (một con học trên 2 máy) + hôm qua; generate lượt 1 soạn mới,
//     lượt 2 cùng khái niệm lấy từ ngân hàng; Vở Spelling. Đếm ở máy chủ: ai:d (sessions, asked, bank_used, fresh_used),
//     rp:u:<ngày>:<số> (+ EXPIRE 40 ngày), rp:a:<ngày> (generate + hành động "data").
//  2  report_get: câu đã làm, phút, đúng %, theo môn, gia đình / con / lượt ôn, asked / bank_used / fresh_used / new_q, token, tiền,
//     theo loại việc, trung bình mỗi lượt / mỗi con, hôm qua tách đúng, so với hôm qua / trung bình 7 ngày, bảng từng gia đình
//     (số điện thoại che, các con), ngân hàng hiện có; ngày khác / ngày sai; không sửa dữ liệu học.
//  3  Quyền: người dùng thường -> không phải quản trị; admin thường -> "not_super".
//  4  Đường hẹn giờ GET /api/admin?job=report: CRON_SECRET sai / thiếu -> 401; đúng -> thư đúng tiêu đề + số liệu; lần 2 không gửi lại;
//     chưa có CRON_SECRET: trước 20:00 không chạy, sau 20:00 chạy; tắt email báo cáo -> không gửi; không có email -> không gửi, không lỗi;
//     chưa cài Gmail (máy chủ 4194 MAIL=0) -> "mail_off"; "Gửi thử" (report_send) gửi ngay, không tính lần gửi trong ngày.
//  5  vercel.json: hợp lệ, đúng MỘT cách hẹn giờ cho đường báo cáo (crons 14:00 UTC = 21:00 giờ VN, không có "schedules").
import fs from 'node:fs'
import path from 'node:path'
import { check, finish, gen, adm, mock, day, account, superToken, RUN, store, restoreCfg, spelling, aiDay, post, acct, BASE, sleep } from './_ai.mjs'
import { ROOT } from './_env.mjs'

const MAIL = path.join(ROOT, 'tests', 'out', 'mail-4192.jsonl')
const mails = () => (fs.existsSync(MAIL) ? fs.readFileSync(MAIL, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)) : [])
const B2 = 'http://localhost:4194'
const shift = (d, k) => new Date(Date.parse(d + 'T12:00:00Z') + k * 86400000).toISOString().slice(0, 10)
const dmy = (d) => `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`
const job = async (auth, base = BASE) => { const r = await fetch(base + '/api/admin?job=report', { headers: auth ? { authorization: auth } : {} }); let j = {}; try { j = await r.json() } catch { /* */ } return { ...j, _status: r.status } }
const hour = (h, base = BASE) => fetch(base + '/__mock/hour/' + h)
const cron = (c) => fetch(BASE + '/__mock/cron/' + c)

const tS = await superToken()
await restoreCfg(tS)
const supBefore = (await adm('settings_get', {}, tS)).settings
const D = '2041-' + String(1 + (Number(RUN) % 12)).padStart(2, '0') + '-' + String(1 + (Number(RUN) % 28)).padStart(2, '0')
const Y = shift(D, -1)
// ngày thử sạch (chạy lại cùng ngày giả không cộng dồn)
const days9 = Array.from({ length: 9 }, (_, i) => shift(D, -i))
await store(days9.flatMap((d) => [['DEL', 'ai:d:' + d], ['DEL', 'rp:a:' + d], ['DEL', 'rp:sent:' + d]]))
await mock('/usage?in=1000&out=500')

const PA = '0971' + RUN, PB = '0973' + String((Number(RUN) + 345) % 1e6).padStart(6, '0')
const KA1 = 'kA1' + RUN, KA2 = 'kA2' + RUN, KB1 = 'kB1' + RUN
const doc = (dev, log) => ({ v: 1, resetAt: 0, mem: { items: {}, dead: {} }, recent: [], goal: null, dev: { [dev]: { e: 1, days: {}, log } }, spell: null })
const L = (reviewed, correct, sec) => ({ reviewed, correct, wrong: reviewed - correct, sec })
const calls = async () => (await mock()).gen.length

console.log('— 1. Dữ liệu thử + đếm ở máy chủ')
const tA = await account(PA, [{ id: KA1, name: 'An', grade: 'Lớp 4' }, { id: KA2, name: 'Bình', grade: 'Lớp 2' }])
const tB = await account(PB, [{ id: KB1, name: 'Chi', grade: 'Lớp 5' }])
// HÔM QUA: An học Toán 10 câu (5 đúng) 5 phút + một lượt soạn mới
await day(Y)
await acct('data', { child: KA1, doc: doc('mA', { [Y]: { 'Toán': L(10, 5, 300) } }) }, tA)
let c0 = await calls()
const gy = await gen({ subject: 'Toán', grade: 'Lớp 4', topic: 'Hình', concepts: [{ name: 'Chu vi hôm qua ' + RUN, details: [] }], count: 10 }, { token: tA, childId: KA1 })
const callsY = (await calls()) - c0
// HÔM NAY
await day(D)
const logA1 = { [Y]: { 'Toán': L(10, 5, 300) }, [D]: { 'Toán': L(20, 17, 600), 'Tiếng Anh': L(10, 8, 300) } }
await acct('data', { child: KA1, doc: doc('mA', logA1) }, tA)
await acct('data', { child: KA2, doc: doc('mA', { [D]: { 'Toán': L(15, 12, 540) } }) }, tA)
// Chi học trên HAI máy: tổng phải cộng hai máy (không cộng trùng khi gửi lại)
await acct('data', { child: KB1, doc: doc('mX', { [D]: { 'Tiếng Việt': L(30, 24, 1080) } }) }, tB)
await acct('data', { child: KB1, doc: doc('mY', { [D]: { 'Tiếng Việt': L(10, 10, 120) } }) }, tB)
await acct('data', { child: KB1, doc: doc('mY', { [D]: { 'Tiếng Việt': L(10, 10, 120) } }) }, tB)
const NAME = 'Làm tròn số ' + RUN
c0 = await calls()
const g1 = await gen({ subject: 'Toán', grade: 'Lớp 4', topic: 'Số', concepts: [{ name: NAME, details: [] }], count: 10 }, { token: tA, childId: KA1 })
const calls1 = (await calls()) - c0
const g2 = await gen({ subject: 'Toán', grade: 'Lớp 4', topic: 'Số', concepts: [{ name: NAME, details: [] }], count: 10 }, { token: tA, childId: KA1, recent: g1.questions.slice(0, 10).map((q) => q.id) })
const calls2 = (await calls()) - c0 - calls1
c0 = await calls()
const g3 = await gen({ subject: 'Tiếng Việt', grade: 'Lớp 5', topic: 'Từ loại', concepts: [{ name: 'Danh từ ' + RUN, details: [] }], count: 5 }, { token: tB, childId: KB1 })
const calls3 = (await calls()) - c0
const sp = await spelling({ mode: 'topic', topic: 'fruits', count: 5 }, tB)
await sleep(200)
check('lượt 1 soạn mới (13 câu đưa ra, 23 câu soạn), lượt 2 cùng khái niệm lấy 13 câu từ ngân hàng, không gọi AI', g1.source.fresh === 13 && g1.source.bank === 0 && calls1 === 5 && g2.source.bank === 13 && calls2 === 0, JSON.stringify([g1.source, g2.source, calls1, calls2]))
const bu = (g, n) => Math.min(g.source.bank, n), fu = (g, n) => Math.min(g.source.fresh, n - bu(g, n))
const exp = {
  asked: 25, bank_used: bu(g1, 10) + bu(g2, 10) + bu(g3, 5), fresh_used: fu(g1, 10) + fu(g2, 10) + fu(g3, 5),
  callsA: calls1 + calls2, callsB: calls3, sp: 7000,
}
check('đối chiếu tay: lượt 1 = 0 ngân hàng + 10 mới; lượt 2 = 10 ngân hàng + 0 mới; lượt 3 (5 câu) = 0 + 5', exp.bank_used === 10 && exp.fresh_used === 15, JSON.stringify(exp))
const dd = await aiDay(D)
check('lượt 3 (Tiếng Việt, 5 câu): soạn mới 8 + 10 để dành = 18 câu', g3.source.fresh === 8 && calls3 >= 1, JSON.stringify([g3.source, calls3]))
check('ai:d:<hôm nay>: sessions 3, asked 25, bank_used 10, fresh_used 15; bank_q 13 / new_q 41 / gen_runs 2 như cũ', dd.sessions === 3 && dd.asked === 25 && dd.bank_used === 10 && dd.fresh_used === 15 && dd.bank_q === 13 && dd.gen_runs === 2 && dd.new_q === 41, JSON.stringify(dd))
const newQ3 = 18
const [uA, uB, ttlU, aSet, ttlA, aSetY] = await store([['HGETALL', `rp:u:${D}:${PA}`], ['HGETALL', `rp:u:${D}:${PB}`], ['TTL', `rp:u:${D}:${PA}`], ['SMEMBERS', 'rp:a:' + D], ['TTL', 'rp:a:' + D], ['SMEMBERS', 'rp:a:' + Y]])
const hA = Object.fromEntries(Array.from({ length: uA.length / 2 }, (_, i) => [uA[2 * i], Number(uA[2 * i + 1])]))
const hB = Object.fromEntries(Array.from({ length: uB.length / 2 }, (_, i) => [uB[2 * i], Number(uB[2 * i + 1])]))
check(`rp:u:<ngày>:<số> tài khoản A: 2 lượt, 20 câu xin, 10 ngân hàng + 10 mới, 23 câu soạn, ${exp.callsA * 7000} micro-USD, token ${exp.callsA * 1000} / ${exp.callsA * 500}`,
  hA.sessions === 2 && hA.asked === 20 && hA.bank_used === 10 && hA.fresh_used === 10 && hA.new_q === 23 && hA.usd === exp.callsA * 7000 && hA.in === exp.callsA * 1000 && hA.out === exp.callsA * 500, JSON.stringify(hA))
check(`tài khoản B: 1 lượt + Vở Spelling (tiền ${exp.callsB * 7000 + 7000}); hạn 40 ngày`, sp.status === 200 && hB.sessions === 1 && hB.asked === 5 && hB.usd === exp.callsB * 7000 + 7000 && hB.in === (exp.callsB + 1) * 1000 && ttlU > 39 * 86400 && ttlU <= 40 * 86400, JSON.stringify([hB, ttlU]))
check('rp:a:<hôm nay> có cả hai số (data + generate), hạn 40 ngày; rp:a:<hôm qua> có số A', aSet.includes(PA) && aSet.includes(PB) && aSet.length === 2 && ttlA > 39 * 86400 && aSetY.length === 1 && aSetY[0] === PA, JSON.stringify([aSet, ttlA, aSetY]))

console.log('— 2. report_get')
const docBefore = await store([['GET', `acct:d:${PB}:${KB1}`], ['GET', `acct:dr:${PB}:${KB1}`]])
const r = await adm('report_get', {}, tS)
const rate = r.rate
const usdToday = (exp.callsA + exp.callsB) * 7000 + 7000
check('mặc định hôm nay (ngày giả), tỷ giá 26.000', r.ok && r.day === D && r.today === D && rate === 26000, JSON.stringify([r.ok, r.error, r.day]))
const s = r.study || {}
check('Học: 2 gia đình, 3 con, 3 lượt ôn, 85 câu (71 đúng, 14 sai) đúng 84%, 2.640 giây = 44 phút', s.families === 2 && s.kids === 3 && s.sessions === 3 && s.reviewed === 85 && s.correct === 71 && s.wrong === 14 && s.pct === 84 && s.sec === 2640 && s.min === 44, JSON.stringify(s).slice(0, 400))
const bs = Object.fromEntries((s.bySubject || []).map((t) => [t.subject, t]))
check('theo môn: Tiếng Việt 40 câu 85% 20 phút (2 máy cộng đúng) · Toán 35 câu 83% 19 phút (2 con) · Tiếng Anh 10 câu 80% 5 phút', (s.bySubject || []).length === 3 && bs['Tiếng Việt'].reviewed === 40 && bs['Tiếng Việt'].pct === 85 && bs['Tiếng Việt'].min === 20 && bs['Toán'].reviewed === 35 && bs['Toán'].pct === 83 && bs['Toán'].kids === 2 && bs['Toán'].min === 19 && bs['Tiếng Anh'].reviewed === 10 && bs['Tiếng Anh'].pct === 80 && s.bySubject[0].subject === 'Tiếng Việt', JSON.stringify(s.bySubject))
const q = r.q || {}
check(`Câu hỏi: 25 câu đưa cho con = 10 ngân hàng + 15 mới soạn; ONTAP soạn mới ${23 + newQ3} (để dành ${23 + newQ3 - 15})`, q.asked === 25 && q.bank_used === 10 && q.fresh_used === 15 && q.new_q === 23 + newQ3 && q.spare === 23 + newQ3 - 15 && q.gen_runs === 2, JSON.stringify(q))
const bl = await adm('ai_bank_list', {}, tS)
check('ngân hàng hiện có = mục Ngân hàng câu (câu, khái niệm)', q.bankNow && q.bankNow.questions === bl.total.questions && q.bankNow.concepts === bl.total.concepts && q.bankNow.concepts >= 3, JSON.stringify([q.bankNow, bl.total]))
const a = r.ai || {}
const kinds = Object.fromEntries((a.kinds || []).map((k) => [k.kind, k]))
check(`AI: ${usdToday} micro-USD, token vào ${(exp.callsA + exp.callsB + 1) * 1000} / ra ${(exp.callsA + exp.callsB + 1) * 500}; theo loại việc gen + spelling`, a.usd === usdToday && a.in === (exp.callsA + exp.callsB + 1) * 1000 && a.out === (exp.callsA + exp.callsB + 1) * 500 && a.calls === exp.callsA + exp.callsB + 1 && kinds.gen.usd === (exp.callsA + exp.callsB) * 7000 && kinds.spelling.usd === 7000 && kinds.spelling.n === 1, JSON.stringify(a).slice(0, 400))
check('trung bình mỗi lượt ôn = tiền / 3, mỗi con = tiền / 3', a.perSession === Math.round(usdToday / 3) && a.perKid === Math.round(usdToday / 3), JSON.stringify([a.perSession, a.perKid]))
const c = r.cmp || {}
check(`hôm qua tách đúng: 1 con, 10 câu, 5 phút, 50%, 1 lượt, tiền ${callsY * 7000}`, c.yday && c.yday.kids === 1 && c.yday.reviewed === 10 && c.yday.min === 5 && c.yday.pct === 50 && c.yday.sessions === 1 && c.yday.usd === callsY * 7000 && gy.source.fresh === 13, JSON.stringify(c.yday))
check('trung bình 7 ngày trước (hôm qua … 7 ngày trước): câu 10/7 = 1,4; con 0,1; phút 0,7; tiền / 7', c.avg7 && c.avg7.reviewed === 1.4 && c.avg7.kids === 0.1 && c.avg7.min === 0.7 && c.avg7.usd === Math.round(callsY * 7000 / 7) && c.avg7.pct === 50, JSON.stringify(c.avg7))
check('hôm nay để so: 3 con, 85 câu, 44 phút, tiền', c.cur && c.cur.kids === 3 && c.cur.reviewed === 85 && c.cur.min === 44 && c.cur.usd === usdToday, JSON.stringify(c.cur))
const fA = (r.families || []).find((f) => f.phone === '09xx…' + PA.slice(-3)), fB = (r.families || []).find((f) => f.phone === '09xx…' + PB.slice(-3))
check('bảng gia đình: số điện thoại che (09xx…123), không lộ số đầy đủ', r.families.length === 2 && fA && fB && !JSON.stringify(r.families).includes(PA) && !JSON.stringify(r).includes(PB), JSON.stringify(r.families).slice(0, 300))
check('gia đình A: tên phụ huynh, con An + Bình, 45 câu, 24 phút, 2 lượt, 10 ngân hàng / 10 mới, tiền', fA.name === 'PH ' + PA.slice(-4) && fA.kids.map((k) => k.name).sort().join(',') === 'An,Bình' && fA.reviewed === 45 && Math.round(fA.sec / 60) === 24 && fA.sessions === 2 && fA.bank_used === 10 && fA.fresh_used === 10 && fA.usd === exp.callsA * 7000, JSON.stringify(fA))
check('gia đình B: con Chi, 40 câu, 20 phút, 1 lượt, 0 / 5, tiền gồm Vở Spelling; xếp sau A (ít câu hơn)', fB.kids.length === 1 && fB.kids[0].name === 'Chi' && fB.reviewed === 40 && Math.round(fB.sec / 60) === 20 && fB.sessions === 1 && fB.fresh_used === 5 && fB.usd === exp.callsB * 7000 + 7000 && r.families[0].phone === fA.phone, JSON.stringify(fB))
const ry = await adm('report_get', { day: Y }, tS)
check('chọn ngày hôm qua: 1 gia đình, 1 con (An), 10 câu, 5 phút, 1 lượt', ry.ok && ry.day === Y && ry.study.kids === 1 && ry.study.families === 1 && ry.study.reviewed === 10 && ry.study.min === 5 && ry.study.sessions === 1 && ry.families.length === 1 && ry.families[0].kids[0].name === 'An' && ry.ai.usd === callsY * 7000, JSON.stringify(ry.study))
const bad = await Promise.all([adm('report_get', { day: shift(D, 1) }, tS), adm('report_get', { day: shift(D, -30) }, tS), adm('report_get', { day: '2041-13-45' }, tS), adm('report_get', { day: 'x' }, tS)])
const ok29 = await adm('report_get', { day: shift(D, -29) }, tS)
check('ngày sau hôm nay / quá 30 ngày / sai -> "bad_day"; 29 ngày trước được', bad.every((x) => x.ok === false && x.error === 'bad_day') && ok29.ok && ok29.study.reviewed === 0, JSON.stringify(bad.map((x) => x.error)))
const docAfter = await store([['GET', `acct:d:${PB}:${KB1}`], ['GET', `acct:dr:${PB}:${KB1}`]])
check('chỉ ĐỌC: dữ liệu học + số phiên bản không đổi', docAfter[0] === docBefore[0] && docAfter[1] === docBefore[1])

console.log('— 3. Quyền')
const SP = '0974' + RUN
await adm('staff_add', { phone: SP, name: 'NV', pass: 'NhanVien#1' }, tS)
const tAd = (await post('/api/account', { action: 'login', id: SP, pass: 'NhanVien#1' })).token
const byAd = await Promise.all(['report_get', 'report_send'].map((x) => adm(x, {}, tAd)))
const byU = await Promise.all(['report_get', 'report_send'].map((x) => adm(x, {}, tA)))
check('admin thường -> "not_super"; người dùng thường -> "not_admin" (không phải quản trị)', byAd.every((x) => x.ok === false && x.error === 'not_super') && byU.every((x) => x.ok === false && x.error === 'not_admin'), JSON.stringify([byAd, byU].map((l) => l.map((x) => x.error))))
await adm('staff_remove', { phone: SP }, tS)

console.log('— 4. Thư mỗi tối (GET /api/admin?job=report)')
const EM = 'bao-cao-' + RUN + '@example.com'
await adm('settings_set', { alertEmails: EM }, tS)
await adm('ai_cfg_set', { reportOn: true }, tS)
await cron('cron-secret-thu-' + RUN)
let m0 = mails().length
const j1 = await job(''), j2 = await job('Bearer sai-roi'), j3 = await job('cron-secret-thu-' + RUN)
check('có CRON_SECRET: thiếu / sai header (kể cả thiếu chữ Bearer) -> 401, không gửi thư', j1._status === 401 && j2._status === 401 && j3._status === 401 && mails().length === m0, JSON.stringify([j1._status, j2._status, j3._status]))
const j4 = await job('Bearer cron-secret-thu-' + RUN)
const ms = mails().slice(m0)
const mm = ms[0] || {}
const vndToday = Math.round((usdToday / 1e6) * 26000)
const dong = (x) => String(x).replace(/\B(?=(\d{3})+(?!\d))/g, '.') + 'đ'
check(`đúng header -> gửi 1 thư tới email quản trị, tiêu đề "[Ôn Tập] Báo cáo ${dmy(D)}: 3 con · 85 câu · 44 phút · AI ${dong(vndToday)}"`, j4._status === 200 && j4.ok && j4.sent === 1 && ms.length === 1 && mm.to === EM && mm.subject === `[Ôn Tập] Báo cáo ${dmy(D)}: 3 con · 85 câu · 44 phút · AI ${dong(vndToday)}`, JSON.stringify([j4, mm.subject]))
const t = mm.text || ''
const parts = [
  ['câu tóm tắt', t.startsWith(`Hôm nay 3 con học 44 phút, làm 85 câu (đúng 84%). ONTAP tốn ${dong(vndToday)}`)],
  ['học', /2 gia đình, 3 con, 3 lượt ôn/.test(t) && /Tiếng Việt: 40 câu, đúng 85%, 20 phút/.test(t)],
  ['câu hỏi', /Câu đưa cho con: 25 = từ ngân hàng 10 \(40%\) \+ mới soạn 15 \(60%\)/.test(t) && t.includes(`ONTAP soạn mới ${23 + newQ3} câu (${23 + newQ3 - 15} câu để dành cho lần sau)`)],
  ['token', t.includes(`Token: vào ${dong((exp.callsA + exp.callsB + 1) * 1000).slice(0, -1)}, ra ${dong((exp.callsA + exp.callsB + 1) * 500).slice(0, -1)}`)],
  ['so sánh', /Hôm qua: con tăng 2 \(200%\), câu tăng 75 \(750%\)/.test(t) && /tiền AI tăng [\d.]+đ/.test(t) && /Trung bình 7 ngày trước: con tăng 2,9 \(gấp 30 lần\), câu tăng 83,6 \(gấp 60,7 lần\)/.test(t)],
  ['gia đình', t.includes('09xx…' + PA.slice(-3)) && t.includes('An, Bình') && !t.includes(PA) && !t.includes(PB)],
  ['đường dẫn', /https?:\/\/localhost:4192\/quan-tri/.test(t)],
]
check('nội dung thư: câu tóm tắt, học (2 gia đình, 3 lượt ôn, đúng 84%, theo môn), câu hỏi (25 = 10 + 15), AI (token, tiền), so sánh, gia đình (số che), đường dẫn /quan-tri',
  parts.every((x) => x[1]), parts.filter((x) => !x[1]).map((x) => x[0]).join(', ') + ' || ' + t.slice(800, 2000))
const [sentK, sentTtl] = await store([['GET', 'rp:sent:' + D], ['TTL', 'rp:sent:' + D]])
check('dấu "đã gửi" rp:sent:<ngày> (hạn 3 ngày)', !!sentK && sentTtl > 2 * 86400 && sentTtl <= 3 * 86400, JSON.stringify([sentK, sentTtl]))
m0 = mails().length
const j5 = await job('Bearer cron-secret-thu-' + RUN)
check('gọi lần 2 trong ngày -> không gửi lại', j5._status === 200 && j5.sent === 0 && j5.skipped === 'already' && mails().length === m0, JSON.stringify(j5))
const ts = await adm('report_send', {}, tS)
const mt = mails().slice(m0)
check('"Gửi thử ngay" (super admin): gửi ngay dù tối nay đã gửi, cùng mẫu thư', ts.ok && ts.sent === 1 && mt.length === 1 && mt[0].subject.startsWith(`[Ôn Tập] Báo cáo ${dmy(D)}:`), JSON.stringify(ts))
const rl = await adm('report_get', {}, tS)
check('report_get ghi lần gửi gần nhất + tối nay đã gửi; thư sẵn sàng (có email, đã cài gửi thư, đang bật)', rl.mail.sentToday && rl.mail.last && rl.mail.last.sent === 1 && rl.mail.last.test === true && rl.mail.ready && rl.mail.emails === 1 && rl.mail.on && rl.mail.reason === '', JSON.stringify(rl.mail))
// chưa có CRON_SECRET: chỉ chạy từ 20:00 giờ VN
await cron('off')
await store([['DEL', 'rp:sent:' + D]])
m0 = mails().length
await hour(15)
const j6 = await job('')
await hour(21)
const j7 = await job('')
check('chưa có CRON_SECRET: 15 giờ -> không chạy (too_early); 21 giờ -> gửi', j6._status === 403 && j6.error === 'too_early' && j7._status === 200 && j7.sent === 1 && mails().length === m0 + 1, JSON.stringify([j6, j7]))
// tắt email báo cáo ngày
await store([['DEL', 'rp:sent:' + D]])
await adm('ai_cfg_set', { reportOn: false }, tS)
m0 = mails().length
const j8 = await job('')
const chg = await adm('chg_list', {}, tS)
const lastChg = (chg.changes || []).find((x) => x.type === 'ai_cfg')
const r8 = await adm('report_get', {}, tS)
check('tắt email báo cáo -> không gửi (skipped "off"), không đặt dấu đã gửi; ghi nhật ký thay đổi; report_get ghi lý do', j8._status === 200 && j8.sent === 0 && j8.skipped === 'off' && mails().length === m0 && !(await store([['GET', 'rp:sent:' + D]]))[0] && lastChg && lastChg.before.reportOn === true && lastChg.after.reportOn === false && r8.mail.on === false && r8.mail.reason === 'off', JSON.stringify([j8, lastChg && lastChg.after]))
await adm('ai_cfg_set', { reportOn: true }, tS)
// không có email quản trị
await adm('settings_set', { alertEmails: '' }, tS)
const j9 = await job('')
const r9 = await adm('report_get', {}, tS)
const ts9 = await adm('report_send', {}, tS)
check('không có email quản trị -> không gửi, không lỗi (200, "no_email"); Gửi thử cũng báo "no_email"; tab ghi lý do', j9._status === 200 && j9.ok && j9.sent === 0 && j9.skipped === 'no_email' && mails().length === m0 && r9.mail.reason === 'no_email' && ts9.skipped === 'no_email', JSON.stringify([j9, r9.mail, ts9]))
// chưa cài Gmail của app (máy chủ 4194: MAIL=0), dùng chung kho
await adm('settings_set', { alertEmails: EM }, tS)
await hour(21, B2)
const j10 = await job('', B2)
await hour('off', B2)
check('chưa cài Gmail (mail_off) -> không gửi, không lỗi', j10._status === 200 && j10.ok && j10.sent === 0 && j10.skipped === 'mail_off' && mails().length === m0, JSON.stringify(j10))
// gửi lỗi -> bỏ dấu đã gửi (lần sau thử lại)
await adm('settings_set', { alertEmails: 'loi-' + RUN + '@fail.test' }, tS)
const j11 = await job('')
check('gửi lỗi -> báo lỗi, không giữ dấu "đã gửi"', j11.ok === false && j11.error === 'mail_error' && !(await store([['GET', 'rp:sent:' + D]]))[0], JSON.stringify(j11))
await hour('off')
// GET thường vẫn trả bảng giá
const gp = await (await fetch(BASE + '/api/admin')).json()
check('GET /api/admin (không có job) vẫn trả bảng giá', gp.ok && gp.prices && gp.prices.plans, JSON.stringify(gp).slice(0, 200))

console.log('— 5. vercel.json')
const vj = JSON.parse(fs.readFileSync(path.join(ROOT, 'vercel.json'), 'utf8'))
const crons = (vj.crons || []).filter((x) => x.path.startsWith('/api/admin') && x.path.includes('job=report'))
const scheds = Object.values(vj.schedules || {}).filter((x) => String(x.path || '').includes('job=report'))
check('vercel.json hợp lệ: đường báo cáo hẹn đúng MỘT cách (crons "0 14 * * *" = 21:00 giờ VN), không có schedules trùng', crons.length === 1 && crons[0].schedule === '0 14 * * *' && crons[0].path === '/api/admin?job=report' && scheds.length === 0 && !vj.schedules, JSON.stringify(vj.crons))
check('…các mục cũ của vercel.json giữ nguyên (functions, rewrites /quan-tri)', vj.functions['api/admin.mjs'].includeFiles.includes('_sync') && vj.rewrites.some((x) => x.source === '/quan-tri'))

// trả lại như cũ
await adm('settings_set', { alertEmails: (supBefore.alertEmails || []).join(','), aiOn: supBefore.aiOn }, tS)
await day('off')
finish()
