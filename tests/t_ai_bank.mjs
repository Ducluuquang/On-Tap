// CHI PHÍ AI — Việc 2 (25/11/2026): NGÂN HÀNG CÂU HỎI theo khái niệm (api/_qbank.mjs). AI giả, kho thử.
//  1  Lượt 1: gọi AI MỘT lần (chia đợt 5 câu, "Mã đề" ở CUỐI lời nhắc), số câu = phần thiếu + 10, lưu theo khái niệm.
//  2  Lượt 2 cùng khái niệm (đã gặp 10 câu dùng thật): KHÔNG gọi AI, câu khác lượt 1, tiền loại "gen" không tăng.
//  3  Con của tài khoản khác, cùng lớp + môn + dạng + ý nhỏ -> dùng chung; khác lớp / dạng / ý nhỏ -> ngân hàng khác.
//  4  Đủ 40 câu thì không soạn thêm; con gặp hết -> lấy câu gặp LÂU NHẤT, đảo 4 lựa chọn (đáp án vẫn đúng).
//  5  Chế độ nâng cao (master) lưu riêng; câu sai quy cách không vào ngân hàng; nhiều khái niệm chia câu đúng thứ tự.
//  6  Hai máy cùng soạn một lúc không làm hỏng ngân hàng; xoá ngân hàng (có nhật ký) -> lần sau soạn lại.
// Đối chứng: bản cũ (trước 25/11/2026) lượt 2 vẫn gọi AI -> phần 2 HỎNG.
import { check, finish, gen, adm, mock, account, superToken, RUN, askedN, aiDay, vnToday, store, restoreCfg } from './_ai.mjs'

const tS = await superToken()
await restoreCfg(tS)
await adm('ai_cfg_set', { genLimit: 0 }, tS)   // bộ thử này soạn nhiều lượt cho một con: bỏ giới hạn lượt soạn mới (Việc 3 thử riêng ở t_ai_limit)
const PA = '0941' + RUN, PB = '0942' + RUN
const KA = 'kA' + RUN, KA5 = 'kA5' + RUN, KB = 'kB' + RUN
const tA = await account(PA, [{ id: KA, grade: 'Lớp 4' }, { id: KA5, grade: 'Lớp 5' }])
const tB = await account(PB, [{ id: KB, grade: 'Lớp 4' }])
const NAME = 'Rút gọn phân số ' + RUN
const base = { subject: 'Toán', grade: 'Lớp 4', topic: 'Phân số', concepts: [{ name: NAME, details: ['6/8', '4/10'] }], count: 10, format: 'choice' }
const ids = (r) => (r.questions || []).map((q) => q.id)
const listOf = async (q) => (await adm('ai_bank_list', { q }, tS)).list || []
const today = vnToday()

console.log('— 1. Lượt 1: soạn mới, lưu theo khái niệm')
const d0 = await aiDay(today)
const r1 = await gen(base, { token: tA, childId: KA })
const m1 = await mock()
check('lượt 1: trả count + 3 = 13 câu, mỗi câu có id "<8 ký tự khoá>.<số>", nguồn: 13 câu soạn mới', r1.questions.length === 13 && r1.questions.every((q) => /^[0-9a-f]{8}\.[0-9a-z]+$/.test(q.id)) && r1.source.fresh === 13 && r1.source.bank === 0 && r1.limited === false, JSON.stringify(r1.source))
check('lượt 1: AI được nhờ đúng 13 (thiếu) + 10 (dự phòng) = 23 câu, chia đợt 5 câu (5+5+5+5+3)', askedN(m1.gen) === 23 && m1.gen.map((g) => Number(/Tạo (\d+) câu/.exec(g.prompt)[1])).sort().join(',') === '3,5,5,5,5', m1.gen.map((g) => (/Tạo (\d+) câu/.exec(g.prompt) || [])[1]).join(','))
const lastLine = (m1.gen[0].prompt.trim().split('\n').pop() || '')
check('"Mã đề" ngẫu nhiên nằm ở CUỐI lời nhắc (phần đầu các đợt giống nhau)', /^\(Mã đề \w+/.test(lastLine) && !m1.gen[0].prompt.startsWith('(Mã đề'), lastLine)
const L1 = await listOf(NAME)
check('ngân hàng của khái niệm có 23 câu (Toán, Lớp 4, trắc nghiệm)', L1.length === 1 && L1[0].n === 23 && L1[0].subject === 'Toán' && L1[0].grade === 'Lớp 4' && L1[0].format === 'choice', JSON.stringify(L1))
const bank1 = await adm('ai_bank_get', { key: L1[0].key }, tS)
check('mỗi câu trong ngân hàng: id cố định, đề, 4 lựa chọn, đáp án (chữ), giải thích, khái niệm, model, thời điểm', bank1.ok && bank1.items.every((q) => q.id.startsWith(L1[0].key.slice(0, 8) + '.') && q.q && q.options.length === 4 && q.options.includes(q.answer) && q.explain && q.concept === NAME && q.model === 'claude-sonnet-5-5' && q.at > 0), JSON.stringify(bank1.items && bank1.items[0]))
const d1 = await aiDay(today)
check('chi phí lượt 1: tiền loại "gen" tăng, 1 lượt soạn mới, 23 câu soạn mới', (d1['usd:gen'] || 0) > (d0['usd:gen'] || 0) && (d1.gen_runs || 0) - (d0.gen_runs || 0) === 1 && (d1.new_q || 0) - (d0.new_q || 0) === 23, JSON.stringify([d0, d1]))

console.log('— 2. Lượt 2 cùng khái niệm: không gọi AI')
const used1 = ids(r1).slice(0, 10)           // app dùng 10 câu, đẩy id vào "đã gặp"
const msgs1 = (await mock()).msgs
const r2 = await gen(base, { token: tA, childId: KA, recent: used1 })
const m2 = await mock()
check('lượt 2: KHÔNG gọi AI (số lời gọi AI giữ nguyên), 13 câu đều từ ngân hàng', m2.msgs === msgs1 && r2.questions.length === 13 && r2.source.bank === 13 && r2.source.fresh === 0, JSON.stringify([m2.msgs, msgs1, r2.source]))
check('lượt 2: câu KHÁC 10 câu con đã làm ở lượt 1', ids(r2).every((id) => !used1.includes(id)) && new Set(r2.questions.map((q) => q.q)).size === 13, JSON.stringify(ids(r2)))
const d2 = await aiDay(today)
check('chi phí lượt 2: tiền loại "gen" KHÔNG tăng (= 0 đồng), không thêm lượt soạn mới, +13 câu từ ngân hàng', d2['usd:gen'] === d1['usd:gen'] && d2.gen_runs === d1.gen_runs && (d2.bank_q || 0) - (d1.bank_q || 0) === 13, JSON.stringify([d1, d2]))

console.log('— 3. Dùng chung / tách ngân hàng')
const msgs2 = (await mock()).msgs
const r3 = await gen(base, { token: tB, childId: KB })
check('con của tài khoản KHÁC, cùng khái niệm (lớp 4, Toán, trắc nghiệm, cùng ý nhỏ) -> dùng chung ngân hàng, không gọi AI', (await mock()).msgs === msgs2 && r3.questions.length === 13 && ids(r3).every((id) => id.startsWith(L1[0].key.slice(0, 8))), JSON.stringify(r3.source))
const variants = [
  ['khác lớp (Lớp 5)', { ...base, grade: 'Lớp 5' }, KA5],
  ['khác dạng (tự điền)', { ...base, format: 'open' }, KA],
  ['khác ý nhỏ', { ...base, concepts: [{ name: NAME, details: ['6/8', '9/12'] }] }, KA],
]
for (const [label, p, kid] of variants) {
  const before = (await mock()).msgs
  const r = await gen(p, { token: tA, childId: kid })
  check(`${label} -> ngân hàng khác, phải soạn mới`, (await mock()).msgs > before && r.source.fresh === 13 && !ids(r).some((id) => id.startsWith(L1[0].key.slice(0, 8))), JSON.stringify(r.source))
}
const tStr = await gen({ ...base, concepts: [`  ${NAME.toUpperCase()}  `.replace(/ +/g, '  ')].map((n) => ({ name: n, details: ['4/10', '6/8'] })) }, { token: tA, childId: KA, recent: used1 })
check('tên khái niệm khác hoa / thường / khoảng trắng, ý nhỏ khác thứ tự -> vẫn CÙNG ngân hàng', tStr.source.fresh === 0 && ids(tStr).every((id) => id.startsWith(L1[0].key.slice(0, 8))), JSON.stringify(tStr.source))
const L3 = await listOf(NAME)
check('danh sách ngân hàng: 4 ngân hàng cho khái niệm này (lớp 4 trắc nghiệm, lớp 5, tự điền, ý nhỏ khác)', L3.length === 4, JSON.stringify(L3.map((x) => [x.grade, x.format, x.n])))

console.log('— 4. Đủ 40 câu: không soạn thêm, lấy câu gặp lâu nhất')
const all23 = bank1.items.map((q) => q.id)
const r4 = await gen(base, { token: tA, childId: KA, recent: all23 })   // gặp hết 23 câu -> soạn thêm 23 (thiếu 13 + 10), ngân hàng chỉ giữ 40
const L4 = (await listOf(NAME)).find((x) => x.key === L1[0].key)
check('gặp hết 23 câu -> soạn thêm; ngân hàng chỉ giữ tối đa 40 câu', r4.source.fresh === 13 && L4.n === 40, JSON.stringify([r4.source, L4 && L4.n]))
const bank40 = await adm('ai_bank_get', { key: L1[0].key }, tS)
const seenAll = bank40.items.map((q) => q.id).reverse()   // "đã gặp": mới nhất trước -> câu ĐẦU ngân hàng là gặp lâu nhất
const msgs4 = (await mock()).msgs
const r5 = await gen(base, { token: tA, childId: KA, recent: seenAll })
const oldest13 = seenAll.slice(-13)
const sameOrder = r5.questions.filter((q) => { const o = bank40.items.find((x) => x.id === q.id); return o && o.options.join('|') === q.options.join('|') }).length
check('đủ 40 câu + con gặp hết -> KHÔNG gọi AI, trả 13 câu gặp LÂU NHẤT', (await mock()).msgs === msgs4 && r5.questions.length === 13 && ids(r5).every((id) => oldest13.includes(id)) && r5.limited === false, JSON.stringify([r5.source, ids(r5).slice(0, 4), oldest13.slice(0, 4)]))
check('…4 lựa chọn được đảo thứ tự, đáp án vẫn đúng (vẫn là "Đúng", nằm trong 4 lựa chọn)', r5.questions.every((q) => q.answer === 'Đúng' && q.options.includes('Đúng') && new Set(q.options).size === 4) && sameOrder < 13, `giữ nguyên thứ tự: ${sameOrder}/13`)

console.log('— 5. Master, câu sai quy cách, nhiều khái niệm')
const M = { ...base, master: true, concepts: [{ name: NAME, details: ['6/8', '4/10'] }, { name: 'Quy đồng mẫu số ' + RUN, details: [] }] }
const before5 = (await mock()).msgs
const r6 = await gen(M, { token: tA, childId: KA })
const L6 = (await adm('ai_bank_list', { q: 'Quy đồng mẫu số ' + RUN }, tS)).list.filter((x) => x.master)
check('chế độ nâng cao (master) -> ngân hàng riêng cho cả bộ khái niệm (cờ master), phải soạn mới', (await mock()).msgs > before5 && r6.source.fresh === 13 && L6.length === 1 && L6[0].concept.includes(NAME) && L6[0].concept.includes('Quy đồng'), JSON.stringify(L6))
const r6b = await gen(M, { token: tA, childId: KA, recent: ids(r6).slice(0, 10) })
check('master lượt 2 -> lấy từ ngân hàng master, không gọi AI', r6b.source.fresh === 0 && r6b.questions.length === 13 && ids(r6b).every((id) => id.startsWith(L6[0].key.slice(0, 8))), JSON.stringify(r6b.source))
await mock('/bad/1')   // mỗi lần AI trả lời (mỗi đợt) có 1 câu sai quy cách: 5 đợt -> 5 câu sai
const BADN = 'Phân số thập phân ' + RUN
const r7 = await gen({ ...base, concepts: [{ name: BADN, details: [] }] }, { token: tA, childId: KA })
await mock('/bad/0')
const L7 = await listOf(BADN)
const b7 = L7.length ? await adm('ai_bank_get', { key: L7[0].key }, tS) : { items: [] }
check('câu sai quy cách (lựa chọn trùng / đáp án không nằm trong lựa chọn) KHÔNG vào ngân hàng: 23 câu soạn, 18 câu lưu', L7.length === 1 && L7[0].n === 18 && b7.items.every((q) => !/SAI quy cách/.test(q.q)) && r7.questions.every((q) => !/SAI quy cách/.test(q.q)), JSON.stringify([L7[0] && L7[0].n, r7.questions.length]))
const C1 = 'Cộng phân số ' + RUN, C2 = 'Trừ phân số ' + RUN
const r8 = await gen({ ...base, concepts: [{ name: C1, details: [] }, { name: C2, details: [] }] }, { token: tA, childId: KA })
const n1 = r8.questions.filter((q) => q.concept === C1).length, n2 = r8.questions.filter((q) => q.concept === C2).length
check('2 khái niệm: 13 câu chia 7 (khái niệm cần ôn trước) + 6, xen kẽ; mỗi khái niệm một ngân hàng', n1 === 7 && n2 === 6 && r8.questions[0].concept === C1 && r8.questions[1].concept === C2 && (await listOf(C1)).length === 1 && (await listOf(C2)).length === 1, `${n1} ${n2}`)
const nC2 = (await listOf(C2))[0].n
const r8b = await gen({ ...base, concepts: [{ name: C2, details: [] }] }, { token: tB, childId: KB })
check(`…con khác ôn riêng khái niệm thứ 2: dùng hết ${nC2} câu có sẵn của khái niệm đó, chỉ soạn phần còn thiếu`, r8b.source.bank === nC2 && r8b.source.fresh === 13 - nC2 && r8b.questions.length === 13, JSON.stringify([nC2, r8b.source]))

console.log('— 6. Hai máy cùng lúc; xoá ngân hàng')
const RACE = 'Hỗn số ' + RUN
const rr = await Promise.all([gen({ ...base, concepts: [{ name: RACE, details: [] }] }, { token: tA, childId: KA }), gen({ ...base, concepts: [{ name: RACE, details: [] }] }, { token: tB, childId: KB })])
const LR = await listOf(RACE)
const bR = LR.length ? await adm('ai_bank_get', { key: LR[0].key }, tS) : { items: [] }
const idsR = bR.items.map((q) => q.id)
check('hai máy cùng soạn một khái niệm cùng lúc -> một ngân hàng, gộp đủ câu của cả hai (≤ 40), id không trùng, đề không trùng', rr.every((r) => r.questions.length === 13) && LR.length === 1 && bR.items.length === 40 && new Set(idsR).size === idsR.length && new Set(bR.items.map((q) => q.q)).size === idsR.length, JSON.stringify([LR.length, bR.items.length]))
const raw = (await store([['GET', 'qb:' + LR[0].key]]))[0]
check('ngân hàng lưu nén gzip ("gz:…"), có hạn 180 ngày', /^gz:/.test(raw) && (await store([['TTL', 'qb:' + LR[0].key]]))[0] > 170 * 86400)
const del = await adm('ai_bank_del', { key: L7[0].key }, tS)
const after = await listOf(BADN)
const chg = await adm('chg_list', {}, tS)
check('xoá ngân hàng -> mất khỏi danh sách; nhật ký thay đổi ghi "Xoá ngân hàng câu hỏi"', del.ok && after.length === 0 && chg.changes.some((c) => c.type === 'ai_bank_del' && c.title.includes(BADN) && c.by === '0912000777'), JSON.stringify(del))
const before6 = (await mock()).msgs
const r9 = await gen({ ...base, concepts: [{ name: BADN, details: [] }] }, { token: tA, childId: KA })
check('…lần ôn sau khái niệm đó -> ONTAP soạn lại câu mới', (await mock()).msgs > before6 && r9.source.fresh === 13, JSON.stringify(r9.source))
const notF = await adm('ai_bank_get', { key: '0000000000000000' }, tS)
check('xem ngân hàng không có -> not_found', notF.ok === false && notF.error === 'not_found')
await restoreCfg(tS)
finish()
