// CHI PHÍ AI — Việc 4 (25/11/2026): chọn model theo môn (cfg:ai) + trang "Thử model" (ai_try, ai_try_save). AI giả.
//  1  Mặc định tất cả Sonnet. Đặt Haiku cho Toán -> soạn Toán dùng model haiku mới nhất; Tiếng Việt vẫn Sonnet.
//     Haiku cho chấm câu tự gõ / Vở Spelling -> các việc đó dùng haiku. Đổi cài đặt ghi nhật ký thay đổi.
//  2  ai_try: soạn CÙNG LÚC bằng Sonnet và Haiku, cùng đầu vào (có đoạn sách nếu có), trả hai danh sách + token, tiền, giây;
//     KHÔNG lưu vào ngân hàng câu.
//  3  Admin thường -> "not_super"; người dùng thường -> không phải quản trị.
//  4  Lưu đánh giá -> ai:try:log (200 lần gần nhất) + bảng tổng kết môn × model.
import { check, finish, gen, adm, mock, account, superToken, RUN, store, restoreCfg, spelling, post, DEFAULT_CFG } from './_ai.mjs'

const tS = await superToken()
await restoreCfg(tS)
const P = '0971' + RUN, K = 'kM' + RUN
const tok = await account(P, [{ id: K, grade: 'Lớp 5' }])

console.log('— 1. Model theo môn')
const c0 = await adm('ai_cfg_get', {}, tS)
check('mặc định: TẤT CẢ Sonnet (Toán, Tiếng Việt, Tiếng Anh, Ngữ văn, môn khác, Vở Spelling, chấm câu tự gõ); giới hạn 5; trần 10.000đ; tỷ giá 26.000',
  c0.ok && Object.values(c0.cfg.models).every((m) => m === 'sonnet') && Object.keys(c0.cfg.models).length === 7 && c0.cfg.genLimit === 5 && c0.cfg.capVnd === 10000 && c0.cfg.rate === 26000, JSON.stringify(c0.cfg))
const s1 = await adm('ai_cfg_set', { models: { toan: 'haiku', judge: 'haiku', spelling: 'haiku' } }, tS)
check('đặt "Tiết kiệm (Haiku)" cho Toán, chấm câu tự gõ, Vở Spelling', s1.ok && s1.cfg.models.toan === 'haiku' && s1.cfg.models['tieng-viet'] === 'sonnet' && s1.cfg.models.judge === 'haiku', JSON.stringify(s1))
await mock('/reset')
await gen({ subject: 'Toán', grade: 'Lớp 5', topic: 'Số thập phân', concepts: [{ name: 'Cộng số thập phân ' + RUN, details: [] }], count: 5 }, { token: tok, childId: K })
const mT = (await mock()).gen.map((g) => g.model)
await mock('/reset')
await gen({ subject: 'Tiếng Việt', grade: 'Lớp 5', topic: 'Từ loại', concepts: [{ name: 'Danh từ ' + RUN, details: [] }], count: 5 }, { token: tok, childId: K })
const mV = (await mock()).gen.map((g) => g.model)
check('soạn câu Toán -> model claude-haiku-5-5; Tiếng Việt -> vẫn claude-sonnet-5-5', mT.length > 0 && mT.every((m) => m === 'claude-haiku-5-5') && mV.length > 0 && mV.every((m) => m === 'claude-sonnet-5-5'), JSON.stringify([mT, mV]))
const tq = await adm('ai_bank_list', { q: 'Cộng số thập phân ' + RUN }, tS)
const tb = await adm('ai_bank_get', { key: tq.list[0].key }, tS)
check('ngân hàng ghi model đã soạn từng câu (claude-haiku-5-5)', tb.ok && tb.items.every((q) => q.model === 'claude-haiku-5-5'))
await post('/api/ai', { action: 'judge', payload: { question: '2+3', correct: '5', answer: 'năm' } }, tok)
const sp = await spelling({ mode: 'topic', topic: 'animals', count: 5 }, tok)
const mk = await mock()
check('chấm câu tự gõ -> haiku; Vở Spelling -> haiku', (mk.judge.at(-1) || {}).model === 'claude-haiku-5-5' && sp.status === 200 && (mk.spell.at(-1) || {}).model === 'claude-haiku-5-5', JSON.stringify([(mk.judge.at(-1) || {}).model, (mk.spell.at(-1) || {}).model]))
await adm('ai_cfg_set', { models: { spelling: 'sonnet' } }, tS)
await spelling({ mode: 'topic', topic: 'animals', count: 5 }, tok)
check('Vở Spelling đặt lại Sonnet -> claude-sonnet-5-5 như cũ', ((await mock()).spell.at(-1) || {}).model === 'claude-sonnet-5-5')
const bad = await adm('ai_cfg_set', { rate: 5 }, tS)
check('giá trị sai (tỷ giá 5đ) -> từ chối "bad_value"', bad.ok === false && bad.error === 'bad_value')
const chg = await adm('chg_list', {}, tS)
const lg = chg.changes.find((c) => c.type === 'ai_cfg')
check('đổi cài đặt ghi nhật ký thay đổi ("Đổi cài đặt chi phí AI": cũ -> mới, ai làm)', !!lg && lg.by === '0912000777' && lg.status === 'applied' && lg.before && lg.after && chg.types.ai_cfg === 'Đổi cài đặt chi phí AI', JSON.stringify(lg).slice(0, 300))

console.log('— 2. Thử model')
await mock('/reset')
const qb0 = (await store([['HLEN', 'qb:idx']]))[0]
const tr = await adm('ai_try', { subject: 'Toán', grade: 'Lớp 4', topic: 'Phân số', concepts: 'Rút gọn phân số ' + RUN + ', So sánh phân số ' + RUN, format: 'choice', count: 8 }, tS)
const mg = (await mock()).gen
check('ai_try: hai danh sách Sonnet + Haiku, mỗi bên 8 câu đúng quy cách', tr.ok && tr.sonnet.questions.length === 8 && tr.haiku.questions.length === 8 && tr.sonnet.questions.every((q) => q.ok && q.options.length === 4) && tr.sonnet.model === 'claude-sonnet-5-5' && tr.haiku.model === 'claude-haiku-5-5', JSON.stringify(tr).slice(0, 300))
check('…cùng đầu vào: lời nhắc của hai model giống nhau (trừ mã đề), cùng 2 khái niệm', mg.length === 4 && mg.filter((g) => g.model === 'claude-haiku-5-5').length === 2 && mg.every((g) => g.prompt.includes('Rút gọn phân số ' + RUN) && g.prompt.includes('So sánh phân số ' + RUN)), JSON.stringify(mg.map((g) => g.model)))
check('…kèm token, tiền (đồng) và số giây; Haiku rẻ hơn Sonnet (cùng số token: 700 vs 14.000 micro-USD)', tr.sonnet.inTok === 2000 && tr.sonnet.outTok === 1000 && tr.sonnet.usd === 14000 && tr.haiku.usd === 700 && tr.sonnet.vnd === 364 && tr.haiku.vnd === 18 && tr.sonnet.sec > 0 && tr.rate === 26000, JSON.stringify([tr.sonnet.usd, tr.haiku.usd, tr.sonnet.vnd, tr.haiku.vnd, tr.sonnet.sec]))
check('ai_try KHÔNG lưu vào ngân hàng câu', (await store([['HLEN', 'qb:idx']]))[0] === qb0 && !(await adm('ai_bank_list', { q: 'Rút gọn phân số ' + RUN }, tS)).list.length)
const tr0 = await adm('ai_try', { subject: 'Toán', grade: 'Lớp 4', topic: 'x', concepts: '  ' }, tS)
check('chưa gõ khái niệm -> "no_concepts"', tr0.ok === false && tr0.error === 'no_concepts')
const tr3 = await adm('ai_try', { subject: 'Toán', grade: 'Lớp 4', topic: 'x', concepts: 'a, b, c, d, e', count: 99 }, tS)
check('tối đa 3 khái niệm, 20 câu', tr3.ok && tr3.input.concepts.length === 3 && tr3.input.count === 20 && tr3.sonnet.questions.length === 20, JSON.stringify(tr3.input))

console.log('— 3. Quyền')
const SP = '0972' + RUN
await adm('staff_add', { phone: SP, name: 'NV', pass: 'NhanVien#1' }, tS)
const tA = (await post('/api/account', { action: 'login', id: SP, pass: 'NhanVien#1' })).token
const acts = ['ai_stats', 'ai_cfg_get', 'ai_cfg_set', 'ai_bank_list', 'ai_bank_get', 'ai_bank_del', 'ai_try', 'ai_try_save']
const byAdmin = await Promise.all(acts.map((a) => adm(a, { key: '0000000000000000', subject: 'Toán', concepts: 'x', rows: [{ tier: 'sonnet' }] }, tA)))
check('admin thường gọi 8 hành động Chi phí AI -> "not_super"', byAdmin.every((r) => r.ok === false && r.error === 'not_super'), JSON.stringify(byAdmin.map((r) => r.error)))
const byUser = await Promise.all(acts.map((a) => adm(a, {}, tok)))
check('người dùng thường -> bị từ chối (không phải quản trị)', byUser.every((r) => r.ok === false && r.error === 'not_admin'), JSON.stringify(byUser.map((r) => r.error)))
await adm('staff_remove', { phone: SP }, tS)

console.log('— 4. Lưu đánh giá + tổng kết')
const before = (await adm('ai_stats', {}, tS)).tries.rows
const pick = (rows, g, t) => rows.find((r) => r.group === g && r.tier === t) || { runs: 0, n: 0, wrong: 0, usd: 0 }
const sv = await adm('ai_try_save', { subject: 'Toán', grade: 'Lớp 4', topic: 'Phân số', rows: [
  { tier: 'sonnet', model: tr.sonnet.model, n: 8, wrong: 1, usd: tr.sonnet.usd }, { tier: 'haiku', model: tr.haiku.model, n: 8, wrong: 3, usd: tr.haiku.usd }] }, tS)
const log = (await store([['LRANGE', 'ai:try:log', '0', '1']]))[0].map((x) => JSON.parse(x))
check('lưu đánh giá -> ai:try:log có ngày, môn, lớp, chủ đề, model, số câu, số câu sai, tiền', sv.ok && log.length === 2 && log.every((x) => x.at && x.subject === 'Toán' && x.grade === 'Lớp 4' && x.topic === 'Phân số' && x.model && x.n === 8) && log.some((x) => x.tier === 'haiku' && x.wrong === 3), JSON.stringify(log))
const sonR = pick(sv.tries.rows, 'Toán', 'sonnet'), haiR = pick(sv.tries.rows, 'Toán', 'haiku'), son0 = pick(before, 'Toán', 'sonnet')
check('bảng tổng kết môn × model: Toán–Sonnet và Toán–Haiku cộng thêm 8 câu, câu sai, tỷ lệ sai, tiền trung bình cho 10 câu',
  sonR.n - son0.n === 8 && sonR.wrong - son0.wrong === 1 && haiR.n >= 8 && haiR.wrongPct > 0 && haiR.usd10 > 0 && sonR.usd10 > haiR.usd10, JSON.stringify([sonR, haiR]))
const sv0 = await adm('ai_try_save', { subject: 'Toán', rows: [{ tier: 'gpt' }] }, tS)
check('lưu đánh giá sai dạng -> từ chối', sv0.ok === false)
const ln = (await store([['LLEN', 'ai:try:log']]))[0]
check('ai:try:log giữ tối đa 200 lần gần nhất', ln <= 200)
await adm('ai_cfg_set', DEFAULT_CFG, tS)
check('đặt lại mặc định (tất cả Sonnet)', Object.values((await adm('ai_cfg_get', {}, tS)).cfg.models).every((m) => m === 'sonnet'))
await restoreCfg(tS)
finish()
