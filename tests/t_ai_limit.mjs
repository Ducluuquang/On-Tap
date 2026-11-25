// CHI PHÍ AI — Việc 3 (25/11/2026): GIỚI HẠN LƯỢT SOẠN MỚI mỗi con mỗi ngày + TRẦN TIỀN mỗi tài khoản mỗi ngày. AI giả, ngày giả.
//  1  Giới hạn 2: lượt soạn mới thứ 3 -> { questions: [], limited: true } khi chủ đề chưa có câu; lượt lấy đủ câu từ ngân hàng không tính.
//  2  Quá giới hạn mà ngân hàng có câu (con đã gặp hết) -> lấy câu đã gặp (lâu nhất trước), không soạn mới.
//  3  Mỗi con đếm riêng; sang ngày mới (giờ Việt Nam) tính lại; childId không thuộc tài khoản -> 400.
//  4  Trần tiền ngày: vượt -> /api/ai và /api/spelling trả { error: "limit" }; thử model của super admin không tính trần.
import { check, finish, gen, adm, mock, day, account, superToken, RUN, store, restoreCfg, spelling, ai } from './_ai.mjs'

const tS = await superToken()
await restoreCfg(tS)
const D1 = '2031-0' + (1 + (Number(RUN) % 9)) + '-1' + (Number(RUN) % 9)   // "hôm nay" giả (giờ Việt Nam)
const D2 = D1.slice(0, 8) + '2' + D1.slice(9)
await day(D1)
const P = '0951' + RUN, K1 = 'kL1' + RUN, K2 = 'kL2' + RUN
const tok = await account(P, [{ id: K1, grade: 'Lớp 3' }, { id: K2, grade: 'Lớp 3' }])
const set = await adm('ai_cfg_set', { genLimit: 2 }, tS)
check('super admin đặt giới hạn 2 lượt soạn mới / con / ngày', set.ok && set.cfg.genLimit === 2, JSON.stringify(set))
const p = (n) => ({ subject: 'Toán', grade: 'Lớp 3', topic: 'Nhân chia', concepts: [{ name: `Bảng nhân ${n} ${RUN}`, details: [] }], count: 10, format: 'choice' })
const ids = (r) => (r.questions || []).map((q) => q.id)

console.log('— 1. Giới hạn 2 lượt soạn mới')
const a1 = await gen(p(2), { token: tok, childId: K1 })
const a2 = await gen(p(3), { token: tok, childId: K1 })
const cnt = Number((await store([['GET', `ai:g:${D1}:${P}:${K1}`]]))[0])
check('lượt soạn mới 1, 2 -> soạn bình thường; bộ đếm ai:g:<ngày>:<số>:<con> = 2, hạn 2 ngày', a1.source.fresh === 13 && a2.source.fresh === 13 && !a1.limited && !a2.limited && cnt === 2 && (await store([['TTL', `ai:g:${D1}:${P}:${K1}`]]))[0] > 86400, JSON.stringify([a1.source, a2.source, cnt]))
const m0 = (await mock()).msgs
const a3 = await gen(p(4), { token: tok, childId: K1 })
check('lượt soạn mới thứ 3 (chủ đề chưa có câu) -> { questions: [], limited: true, genLimit: 2 }, KHÔNG gọi AI', a3._status === 200 && a3.questions.length === 0 && a3.limited === true && a3.genLimit === 2 && (await mock()).msgs === m0, JSON.stringify(a3).slice(0, 200))
const a4 = await gen(p(2), { token: tok, childId: K1, recent: ids(a1).slice(0, 10) })
check('ôn lại chủ đề đã có câu (lấy đủ từ ngân hàng) -> vẫn được, không gọi AI, không tính lượt', a4.questions.length === 13 && a4.source.fresh === 0 && !a4.limited && (await mock()).msgs === m0 && Number((await store([['GET', `ai:g:${D1}:${P}:${K1}`]]))[0]) === 2, JSON.stringify(a4.source))

console.log('— 2. Quá giới hạn mà ngân hàng có câu (con đã gặp hết)')
const seen = [...ids(a4), ...ids(a1)]   // mới nhất trước: lượt a4 rồi a1 (23 câu = cả ngân hàng)
const a5 = await gen(p(2), { token: tok, childId: K1, recent: seen })
check('gặp hết 23 câu, cần soạn mà quá giới hạn -> limited, KHÔNG gọi AI, trả 13 câu đã gặp (gặp lâu nhất trước)', a5.limited === true && a5.questions.length === 13 && (await mock()).msgs === m0 && ids(a5).every((id) => seen.slice(-13).includes(id)), JSON.stringify([a5.source, a5.limited]))

console.log('— 3. Đếm riêng từng con; sang ngày mới; childId sai')
const b1 = await gen(p(4), { token: tok, childId: K2 })
check('con thứ hai cùng tài khoản: đếm riêng -> vẫn soạn được chủ đề mới', b1.source.fresh === 13 && !b1.limited, JSON.stringify(b1.source))
await day(D2)
const c1 = await gen(p(5), { token: tok, childId: K1 })
check('sang ngày mới (giờ Việt Nam) -> con 1 soạn mới được lại (bộ đếm ngày mới = 1)', c1.source.fresh === 13 && !c1.limited && Number((await store([['GET', `ai:g:${D2}:${P}:${K1}`]]))[0]) === 1, JSON.stringify(c1.source))
const bad = await gen(p(6), { token: tok, childId: 'kOther' + RUN })
check('childId không thuộc tài khoản -> 400 "bad_child" (không lách được giới hạn)', bad._status === 400 && bad.error === 'bad_child')
await adm('ai_cfg_set', { genLimit: 0 }, tS)
const z = await Promise.all([6, 7, 8].map((n) => gen(p(n), { token: tok, childId: K1 })))
check('giới hạn 0 = không giới hạn -> soạn mới thoải mái', z.every((r) => r.source.fresh === 13 && !r.limited))

console.log('— 4. Trần tiền mỗi ngày')
const spent = Number((await store([['HGET', 'ai:c:' + P, D2]]))[0])
// trần = capVnd × số con (2) ÷ tỷ giá; đặt trần nhỏ hơn số đã tiêu hôm nay
const cap = Math.max(1, Math.floor((spent / 1e6) * 26000 / 2) - 1)
await adm('ai_cfg_set', { capVnd: cap }, tS)
const L1 = await gen(p(9), { token: tok, childId: K1 })
const L2 = await spelling({ mode: 'topic', topic: 'fruits', count: 5 }, tok)
const L3 = await ai({ action: 'extract_text', text: 'phân số' }, tok)
check(`đã tiêu ${Math.round(spent / 1e6 * 26000)}đ hôm nay, trần ${cap}đ × 2 con -> /api/ai và /api/spelling trả 429 { error: "limit" }`, L1._status === 429 && L1.error === 'limit' && L2.status === 429 && /"limit"/.test(L2.text) && L3.error === 'limit', JSON.stringify([L1._status, L1.error, L2.status, L3.error]))
const P2 = '0952' + RUN
const tok2 = await account(P2, [{ id: 'kM' + RUN, grade: 'Lớp 3' }])
const other = await gen(p(10), { token: tok2, childId: 'kM' + RUN })
check('tài khoản khác (chưa tiêu) vẫn dùng được: trần tính theo từng tài khoản', other._status === 200 && other.source.fresh === 13, JSON.stringify(other.source))
const tr = await adm('ai_try', { subject: 'Toán', grade: 'Lớp 3', topic: 'Nhân', concepts: 'Bảng nhân 2', count: 5 }, tS)
const supSpent = Number((await store([['HGET', 'ai:c:0912000777', D2]]))[0] || 0)
check('"Thử model" của super admin không bị trần chặn và không cộng vào tiền của tài khoản nào', tr.ok && tr.sonnet.questions.length > 0 && supSpent === 0, JSON.stringify([tr.ok, tr.error, supSpent]))
await adm('ai_cfg_set', { capVnd: 10000 }, tS)
const back = await gen(p(11), { token: tok, childId: K1 })
check('đặt lại trần 10.000đ / con -> dùng lại được', back._status === 200 && back.questions.length === 13)
await restoreCfg(tS)
check('đặt lại mặc định: giới hạn 5, trần 10.000đ, tỷ giá 26.000', (await adm('ai_cfg_get', {}, tS)).cfg.genLimit === 5)
finish()
