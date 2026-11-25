// CHI PHÍ AI — Việc 1 (25/11/2026): đếm token THẬT của mọi lời gọi AI, quy ra tiền theo bảng giá, cộng vào kho
// theo tài khoản / ngày (giờ Việt Nam) / loại việc / model; ai_stats; cột "Tiền AI 30 ngày". AI giả trả "usage" đặt được.
//  1  Bảng giá (hàm thuần): Sonnet 5.5, Sonnet 5, Haiku 5.5 (≤ / > 100.000 token), ghi / đọc cache, Message Batches nửa giá, tên lạ.
//  2  Soạn câu: số lời gọi × giá đúng -> ai:d (tổng, loại "gen", token theo model, lượt soạn mới), ai:c (tài khoản), ai:m (tháng).
//  3  Vở Spelling (luồng): token từ message_start / message_delta -> loại "spelling" + tài khoản.
//  4  Thi đấu (AI tạo bộ từ) -> loại "arena"; ONTAP trả lời góp ý -> "cskh"; đọc sách (Message Batches) -> "books" nửa giá.
//  5  ai_stats (super admin) + cột Tiền AI 30 ngày ở mục Người dùng.
import { check, finish, gen, adm, mock, day, account, superToken, RUN, store, restoreCfg, spelling, aiDay, post, sleep } from './_ai.mjs'
import { costMicro, priceOf, vnDay } from '../api/_aicost.mjs'

console.log('— 1. Bảng giá (micro-USD)')
check('Sonnet 5.5: 1.000 token vào + 500 ra = 1000×2 + 500×10 = 7.000 micro-USD', costMicro('claude-sonnet-5-5', { input_tokens: 1000, output_tokens: 500 }) === 7000)
check('Sonnet 5.5 cache: ghi 1.000 (2,5) + đọc 1.000 (0,10) = 2.600; Sonnet 5 đọc cache 1.000 = 200', costMicro('claude-sonnet-5-5', { cache_creation_input_tokens: 1000, cache_read_input_tokens: 1000 }) === 2600 && costMicro('claude-sonnet-5', { cache_read_input_tokens: 1000 }) === 200)
check('Haiku 5.5 (lời nhắc ≤ 100.000): 1.000 vào + 500 ra = 100 + 250 = 350; cache ghi 1.000 = 125, đọc 1.000 = 10', costMicro('claude-haiku-5-5', { input_tokens: 1000, output_tokens: 500 }) === 350 && costMicro('claude-haiku-5-5', { cache_creation_input_tokens: 1000 }) === 125 && costMicro('claude-haiku-5-5', { cache_read_input_tokens: 1000 }) === 10)
check('Haiku 5.5 lời nhắc > 100.000 token: 120.000 vào × 0,50 + 1.000 ra × 2,50 = 62.500', costMicro('claude-haiku-5-5', { input_tokens: 120000, output_tokens: 1000 }) === 62500 && costMicro('claude-haiku-5-5', { input_tokens: 99000, cache_read_input_tokens: 2000 }) === Math.round(99000 * 0.5 + 2000 * 0.05))
check('Message Batches nửa giá: Sonnet 5.5 1.000 + 500 = 3.500', costMicro('claude-sonnet-5-5', { input_tokens: 1000, output_tokens: 500 }, { batch: true }) === 3500)
check('model lạ / tên có ngày phát hành: lạ -> giá Sonnet 5.5 (thà tính cao); "claude-haiku-5-5-20261001" -> giá Haiku', costMicro('claude-opus-9', { input_tokens: 1000, output_tokens: 500 }) === 7000 && costMicro('', { input_tokens: 1000 }) === 2000 && priceOf('claude-haiku-5-5-20261001').in === 0.1)
check('ngày theo giờ Việt Nam: 17:30 UTC = 00:30 hôm sau ở VN', (process.env.AI_FAKE_DAY = '', vnDay(Date.parse('2026-11-25T17:30:00Z'))) === '2026-11-26' && vnDay(Date.parse('2026-11-25T16:59:00Z')) === '2026-11-25')

const tS = await superToken()
await restoreCfg(tS)
const D = '2040-' + String(1 + (Number(RUN) % 12)).padStart(2, '0') + '-' + String(1 + (Number(RUN) % 28)).padStart(2, '0')
await day(D)
await mock('/usage?in=1000&out=500')
const P = '0961' + RUN, K = 'kC' + RUN
const tok = await account(P, [{ id: K, grade: 'Lớp 4' }])

console.log('— 2. Soạn câu: tiền theo token thật')
const d0 = await aiDay(D)
const g = await gen({ subject: 'Toán', grade: 'Lớp 4', topic: 'Đo độ dài', concepts: [{ name: 'Đổi đơn vị đo ' + RUN, details: [] }], count: 10 }, { token: tok, childId: K })
const calls = (await mock()).gen.length
const d1 = await aiDay(D)
check(`soạn 23 câu = ${calls} lời gọi Sonnet 5.5 × 7.000 = ${calls * 7000} micro-USD vào loại "gen" của ngày ${D}`, g.source.fresh === 13 && calls === 5 && d1['usd:gen'] - (d0['usd:gen'] || 0) === calls * 7000 && d1['n:gen'] - (d0['n:gen'] || 0) === calls, JSON.stringify(d1))
check('…tổng ngày (usd, số lời gọi), token theo model (vào 1.000 / ra 500 mỗi lời gọi), 1 lượt soạn mới, 23 câu soạn mới, 0 câu ngân hàng', d1.usd === calls * 7000 && d1.calls === calls && d1['in:claude-sonnet-5-5'] === calls * 1000 && d1['out:claude-sonnet-5-5'] === calls * 500 && d1.gen_runs === 1 && d1.new_q === 23 && !d1.bank_q, JSON.stringify(d1))
const [cP, mP, ttlD, ttlC, ttlM] = await store([['HGET', 'ai:c:' + P, D], ['ZSCORE', 'ai:m:' + D.slice(0, 7), P], ['TTL', 'ai:d:' + D], ['TTL', 'ai:c:' + P], ['TTL', 'ai:m:' + D.slice(0, 7)]])
check('tài khoản: ai:c:<số>[ngày] = 35.000 micro-USD; tháng: ai:m:<tháng> số → 35.000; hạn 120 / 40 / 70 ngày', Number(cP) === calls * 7000 && Number(mP) === calls * 7000 && ttlD > 119 * 86400 && ttlC > 39 * 86400 && ttlC <= 40 * 86400 && ttlM > 69 * 86400, JSON.stringify([cP, mP, ttlD, ttlC, ttlM]))
const g2 = await gen({ subject: 'Toán', grade: 'Lớp 4', topic: 'Đo độ dài', concepts: [{ name: 'Đổi đơn vị đo ' + RUN, details: [] }], count: 10 }, { token: tok, childId: K, recent: g.questions.slice(0, 10).map((q) => q.id) })
const d2 = await aiDay(D)
check('lượt lấy từ ngân hàng: không thêm tiền, +13 câu ngân hàng', g2.source.bank === 13 && d2.usd === d1.usd && d2.bank_q === 13, JSON.stringify(d2))
await mock('/usage?in=2000&out=1000&cw=1000&cr=4000')
await post('/api/ai', { action: 'judge', payload: { question: '1+1', correct: '2', answer: 'hai' } }, tok)
const d3 = await aiDay(D)
const jc = 2000 * 2 + 1000 * 10 + 1000 * 2.5 + 4000 * 0.1
check(`chấm câu tự gõ: token có cache (2.000 vào, 1.000 ra, ghi cache 1.000, đọc cache 4.000) = ${jc} -> loại "judge"; token vào gồm cả cache`, d3['usd:judge'] === jc && d3['n:judge'] === 1 && d3['in:claude-sonnet-5-5'] - d2['in:claude-sonnet-5-5'] === 7000, JSON.stringify(d3))
await mock('/usage?in=1000&out=500')

console.log('— 3. Vở Spelling (luồng)')
const sp = await spelling({ mode: 'topic', topic: 'fruits', count: 5 }, tok)
await sleep(200)
const d4 = await aiDay(D)
const cP4 = Number((await store([['HGET', 'ai:c:' + P, D]]))[0])
check('Vở Spelling: token vào (message_start) 1.000 + ra (message_delta) 500 = 7.000 -> loại "spelling" + tiền của tài khoản', sp.status === 200 && d4['usd:spelling'] === 7000 && d4['n:spelling'] === 1 && cP4 === calls * 7000 + jc + 7000, JSON.stringify([d4, cP4]))

console.log('— 4. Thi đấu, ONTAP góp ý, đọc sách')
const AR = (process.env.BASE || 'http://localhost:4192') + '/api/arena'
const apost = async (who, body) => (await fetch(AR, { method: 'POST', headers: { 'content-type': 'application/json', ...(who && who.token ? { authorization: 'Bearer ' + who.token } : {}) }, body: JSON.stringify({ pid: who && who.pid, ...(who && who.prof), ...body }) })).json()
const hello = async (prof) => ({ ...(await apost(null, { action: 'hello', ...prof })), prof })
const a = await hello({ name: 'An' + RUN.slice(-3), icon: '🦊', grade: 'Lớp 5' }), b = await hello({ name: 'Bo' + RUN.slice(-3), icon: '🐻', grade: 'Lớp 5' })
const room = await apost(a, { action: 'create' })
await apost(b, { action: 'join', code: room.code })
await apost(a, { action: 'config', code: room.code, req: 'Fruits', game: 'bee', minutes: 1 })
const st = await apost(a, { action: 'start', code: room.code })
const d5 = await aiDay(D)
check('Thi đấu: AI tạo bộ từ chủ đề "Fruits" -> loại "arena" (7.000 micro-USD, không gắn tài khoản)', st.ok !== false && d5['usd:arena'] === 7000 && d5['n:arena'] === 1, JSON.stringify([st.error, d5['usd:arena']]))
await adm('settings_set', { aiOn: true }, tS)   // bộ thử trước có thể đã tắt ONTAP tự trả lời góp ý
const fb = await post('/api/feedback', { action: 'send', kind: 'other', text: 'Làm sao để ôn môn Toán ạ?', who: 'parent', screen: 'dashboard', ua: 'test' }, tok)
await sleep(300)
const d6 = await aiDay(D)
const cP6 = Number((await store([['HGET', 'ai:c:' + P, D]]))[0])
check('ONTAP trả lời góp ý -> loại "cskh"; KHÔNG tính vào tiền của tài khoản khách', fb.ok && d6['usd:cskh'] === 7000 && d6['n:cskh'] === 1 && cP6 === cP4, JSON.stringify([fb.ok, fb.error, d6['usd:cskh'], cP6, cP4]))
function jpeg(w, h) {
  const head = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 16, 0x4a, 0x46, 0x49, 0x46, 0, 1, 1, 0, 0, 1, 0, 1, 0, 0, 0xff, 0xc0, 0, 11, 8, h >> 8, h & 255, w >> 8, w & 255, 1, 1, 0x11, 0])
  return Buffer.concat([head, Buffer.alloc(1500, 0x55), Buffer.from([0xff, 0xd9])]).toString('base64')
}
const bk = await post('/api/books', { action: 'create', title: 'Sách giả chi phí ' + RUN, grade: 'Lớp 4', subject: 'Toán', kind: 'sgk', pages: 1 }, tS)
await post('/api/books', { action: 'upload', id: bk.book.id, items: [{ page: 1, half: 1, b64: jpeg(1100, 760) }, { page: 1, half: 2, b64: jpeg(1100, 760) }] }, tS)
const pl = await post('/api/books', { action: 'poll', id: bk.book.id }, tS)
const d7 = await aiDay(D)
check('đọc sách (Message Batches, 2 nửa trang) -> loại "books" NỬA GIÁ: 2 × 3.500 = 7.000', pl.book && pl.book.status === 'ready' && d7['usd:books'] === 7000 && d7['n:books'] === 2, JSON.stringify([pl.book && pl.book.status, d7['usd:books'], d7['n:books']]))
const pl2 = await post('/api/books', { action: 'poll', id: bk.book.id }, tS)
check('…hỏi tiến độ lần nữa không cộng trùng', pl2.ok !== false && (await aiDay(D))['usd:books'] === 7000)
await post('/api/books', { action: 'delete', id: bk.book.id }, tS)

console.log('— 5. ai_stats + cột Tiền AI 30 ngày')
const s = await adm('ai_stats', {}, tS)
const today = s.days && s.days[0]
check('ai_stats: 30 ngày, ngày đầu = hôm nay (giờ VN), số liệu khớp kho; tỷ giá 26.000', s.ok && s.days.length === 30 && today.day === D && today.usd === d7.usd && today.calls === d7.calls && today.gen_runs === 1 && today.bank_q === 13 && today.new_q === 23 && s.rate === 26000, JSON.stringify(today).slice(0, 300))
check('ai_stats: theo loại việc (gen, judge, spelling, arena, cskh, books) + token theo model', ['gen', 'judge', 'spelling', 'arena', 'cskh', 'books'].every((k) => today.kinds[k] && today.kinds[k].usd > 0) && today.models['claude-sonnet-5-5'].in > 0, JSON.stringify(today.kinds))
const top = (s.top || []).find((t) => t.phone === P)
check('ai_stats: 10 tài khoản tốn nhất tháng có tài khoản này (tên phụ huynh, số con, tiền)', !!top && top.usd === cP6 && top.name === 'PH ' + P.slice(-4) && top.kids === 1, JSON.stringify(s.top))
const us = await adm('users', { q: P }, tS)
const u = (us.users || []).find((x) => x.phone === P)
check('mục Người dùng (super admin): Tiền AI 30 ngày của tài khoản = tiền đã ghi', !!u && u.ai30 === cP6 && us.rate === 26000, JSON.stringify(u))
const staffPhone = '0962' + RUN
await adm('staff_add', { phone: staffPhone, name: 'NV', pass: 'NhanVien#1' }, tS)
const tA = (await post('/api/account', { action: 'login', id: staffPhone, pass: 'NhanVien#1' })).token
const us2 = await adm('users', { q: P }, tA)
check('admin thường xem Người dùng: không có cột tiền AI', us2.ok && us2.users.length === 1 && us2.users[0].ai30 === undefined, JSON.stringify(us2.users))
await adm('staff_remove', { phone: staffPhone }, tS)
await restoreCfg(tS)
finish()
