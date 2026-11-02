// Thử máy chủ Scrabble (api/arena.mjs + api/_scrabble/engine.mjs) qua đúng đường gọi của máy con:
// phòng 2 bạn + Bạn AI, giá chữ giữ kín, đặt từ hợp lệ / sai luật, bỏ lượt đổi chữ, Bạn AI tự đi (luôn kém bạn thật),
// chủ phòng kết thúc + vương miện, chơi với Bạn AI (solo), thách đấu ngẫu nhiên Scrabble, quá giờ lượt / vắng mặt,
// ai cũng bỏ lượt 2 lần thì hết ván, 2 lệnh đặt từ cùng lúc không bị áp dụng 2 lần, tối đa 4 người.
import * as E from '../api/_scrabble/engine.mjs'
const BASE = 'http://localhost:4192/api/arena', FAST = 'http://localhost:4194/api/arena', SHIM = 'http://127.0.0.1:4199'
const res = {}; const check = (n, c, x = '') => { res[n] = !!c; console.log((c ? '  ✓ ' : '  ✗ ') + n + (c ? '' : '  → ' + x)) }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
async function post(who, body, base = BASE) {
  const r = await fetch(base, { method: 'POST', headers: { 'content-type': 'application/json', ...(who && who.token ? { authorization: 'Bearer ' + who.token } : {}) }, body: JSON.stringify({ pid: who && who.pid, ...(who && who.prof), ...body }) })
  return { ...(await r.json()), http: r.status }
}
const hello = async (prof, base) => ({ ...(await post(null, { action: 'hello', ...prof }, base)), prof })
const stats = async () => (await (await fetch(SHIM + '/stats')).json()).commands
const dict = await E.getDict()
// tìm một nước hợp lệ cho người chơi (dùng đúng bộ luật), chọn nước nhiều điểm nhất
function bestMove(sbv, rack, pid) {
  const sb = { board: sbv.board, racks: { [pid]: rack } }
  const { moves } = E.findMoves(sb, rack, dict, 1500)
  let best = null
  for (const mv of moves) { const r = E.checkMove(sb, pid, mv, dict); if (r.ok && (!best || r.score > best.score)) best = { ...r, tiles: mv } }
  return best
}

const A = await hello({ name: 'Alex', icon: '🦊', grade: 'Lớp 7' }), B = await hello({ name: 'Bin', icon: '🐻', grade: 'Lớp 4' })
let s = await post(A, { action: 'create' }); const code = s.code
await post(B, { action: 'join', code })
let j = await post(A, { action: 'config', code, game: 'scrabble' })
check('chọn Scrabble: số phút mặc định 20', j.cfg.game === 'scrabble' && j.cfg.minutes === 20, JSON.stringify(j.cfg))
j = await post(A, { action: 'config', code, minutes: 150 })
check('Scrabble: số phút giới hạn 5–90', j.cfg.minutes === 90, j.cfg.minutes)
j = await post(A, { action: 'config', code, minutes: 15 })
j = await post(B, { action: 'ai_add', code })
check('chỉ chủ phòng thêm được Bạn AI', j.http === 403)
j = await post(A, { action: 'ai_add', code })
const ai1 = j.players.find((p) => p.ai)
check('chủ phòng thêm Bạn AI: có nhãn AI, biểu tượng 🤖', j.players.length === 3 && ai1 && ai1.icon === '🤖' && /^Bạn ONTAP /.test(ai1.name))
j = await post(A, { action: 'ai_remove', code, ai: ai1.pid })
check('bớt Bạn AI', j.players.length === 2 && !j.players.some((p) => p.ai))
j = await post(A, { action: 'ai_add', code })
const ai = j.players.find((p) => p.ai)
j = await post(A, { action: 'start', code, n: 0 })
check('bắt đầu ván Scrabble: bàn trống 15×15, mỗi người 7 chữ, túi còn 79', j.status === 'playing' && j.round.game === 'scrabble' && j.round.sb.board === '.'.repeat(225) && j.round.sb.rack.length === 7 && Object.values(j.round.sb.counts).every((c) => c === 7) && j.round.sb.bag === 79, JSON.stringify(j.round && j.round.sb).slice(0, 300))
check('thứ tự: các bạn thật đi trước, Bạn AI đi sau cùng', j.round.sb.order.length === 3 && j.round.sb.order[2] === ai.pid && j.round.sb.order.slice(0, 2).sort().join() === [A.pid, B.pid].sort().join())
const n = j.round.n
const vb = await post(B, { action: 'sync', code })
check('giá chữ giữ kín: mỗi bạn chỉ thấy giá của mình, túi chỉ thấy số chữ', vb.round.sb.rack.length === 7 && !('racks' in vb.round.sb) && typeof vb.round.sb.bag === 'number' && !JSON.stringify(vb).includes('"racks"'), JSON.stringify(vb.round.sb).slice(0, 200))
const early = await post(A, { action: 'sb_pass', code, n })
check('chưa hết đếm ngược thì chưa đi được', early.http === 409 && early.error === 'not_started', JSON.stringify(early).slice(0, 120))
await sleep(Math.max(0, j.round.start - j.now) + 300)
let st = await post(A, { action: 'sync', code })
const first = st.round.sb.order[st.round.sb.turn]
const P = first === A.pid ? A : B, Q = first === A.pid ? B : A
const wrongTurn = await post(Q, { action: 'sb_pass', code, n })
check('chưa tới lượt thì không đi được', wrongTurn.http === 409 && wrongTurn.error === 'not_turn' && /Chưa tới lượt/.test(wrongTurn.msg))
let pv = await post(P, { action: 'sync', code })
const bad1 = await post(P, { action: 'sb_move', code, n, tiles: [{ i: 0, l: pv.round.sb.rack.replace('?', 'E')[0] }, { i: 1, l: pv.round.sb.rack.replace('?', 'E')[1] }] })
check('lượt đầu không qua ô ★ -> báo lỗi, không mất lượt', bad1.http === 422 && /ô ★/.test(bad1.msg) && bad1.round.sb.turn === pv.round.sb.turn, JSON.stringify(bad1).slice(0, 160))
const mv = bestMove(pv.round.sb, pv.round.sb.rack, P.pid)
const c0 = await stats()
j = await post(P, { action: 'sb_move', code, n, tiles: mv.tiles })
const used = mv.tiles.length
check(`đặt từ "${mv.words[0].w}": điểm đúng (${mv.score}), từ hiện trên bàn, bốc thêm cho đủ 7, túi bớt ${used}`, j.http === 200 && j.round.sb.scores[P.pid] === mv.score && mv.tiles.every((t) => j.round.sb.board[t.i].toUpperCase() === t.l) && j.round.sb.rack.length === 7 && j.round.sb.bag === 79 - used && j.round.sb.order[j.round.sb.turn] === Q.pid, JSON.stringify(j).slice(0, 300))
console.log(`    (một lần đặt từ tốn ${(await stats()) - c0} lệnh kho)`)
check('nước đi ghi vào nhật ký (từ + điểm)', j.round.sb.moves.at(-1).k === 'play' && j.round.sb.moves.at(-1).w[0] === mv.words[0].w && j.round.sb.moves.at(-1).s === mv.score)
check('điểm của bạn hiện cho cả phòng', j.scores[P.pid].p === mv.score)
let qv = await post(Q, { action: 'sync', code })
const far = qv.round.sb.rack.replace('?', 'E')
const bad2 = await post(Q, { action: 'sb_move', code, n, tiles: [{ i: 0, l: far[0] }, { i: 1, l: far[1] }] })
check('đặt rời, không chạm chữ nào đã có -> báo lỗi "phải chạm vào chữ đã có trên bàn"', bad2.http === 422 && bad2.bad === 'connect' && /chạm vào chữ đã có trên bàn/.test(bad2.msg), JSON.stringify(bad2).slice(0, 160))
const rackBefore = qv.round.sb.rack
const c1 = await stats()
j = await post(Q, { action: 'sync', code })
console.log(`    (một lần hỏi máy chủ lúc chơi Scrabble tốn ${(await stats()) - c1} lệnh kho)`)
j = await post(Q, { action: 'sb_pass', code, n })
check('bỏ lượt: đổi cả 7 chữ, túi giữ nguyên, sang lượt Bạn AI', j.round.sb.rack.length === 7 && j.round.sb.bag === 79 - used && j.round.sb.order[j.round.sb.turn] === ai.pid && j.round.sb.moves.at(-1).k === 'pass' && j.round.sb.moves.at(-1).x === 7, JSON.stringify(j.round.sb.moves.at(-1)) + ' ' + rackBefore + '->' + j.round.sb.rack)
await sleep(3000)
j = await post(A, { action: 'sync', code })
const am = j.round.sb.moves.at(-1)
check('tới lượt Bạn AI: tự đi sau ~2,5 giây', am.p === ai.pid && (am.k === 'play' || am.k === 'pass') && j.round.sb.order[j.round.sb.turn] !== ai.pid, JSON.stringify(am))
const best = Math.max(j.round.sb.scores[A.pid], j.round.sb.scores[B.pid])
check('Bạn AI luôn kém bạn thật dẫn đầu', j.round.sb.scores[ai.pid] < best, JSON.stringify(j.round.sb.scores))
if (am.k === 'play') console.log(`    Bạn AI đặt "${am.w[0]}" +${am.s}`)
// 2 lệnh đặt từ cùng lúc của cùng một bạn: chỉ một lệnh được áp dụng
const cur = j.round.sb.order[j.round.sb.turn] === A.pid ? A : B
let cv = await post(cur, { action: 'sync', code })
const mv2 = bestMove(cv.round.sb, cv.round.sb.rack, cur.pid)
if (mv2) {
  const [r1, r2] = await Promise.all([post(cur, { action: 'sb_move', code, n, tiles: mv2.tiles }), post(cur, { action: 'sb_move', code, n, tiles: mv2.tiles })])
  const oks = [r1, r2].filter((x) => x.http === 200).length
  const after = await post(cur, { action: 'sync', code })
  check('2 lệnh đặt từ cùng lúc: chỉ áp dụng 1 lần', oks === 1 && after.round.sb.moves.filter((m) => m.k === 'play' && m.p === cur.pid).length >= 1 && after.round.sb.scores[cur.pid] === cv.round.sb.scores[cur.pid] + mv2.score, `${r1.http}/${r1.error} ${r2.http}/${r2.error}`)
}
// chủ phòng kết thúc ván -> kết quả + vương miện
j = await post(B, { action: 'sb_end', code, n })
check('bạn không phải chủ phòng không kết thúc ván được', j.http === 403)
const before = await post(A, { action: 'sync', code })
j = await post(A, { action: 'sb_end', code, n })
const rank = j.last && j.last.rank
check('chủ phòng kết thúc ván: có kết quả, xếp hạng theo điểm, giữ nguyên điểm (không trừ)', j.status === 'results' && j.last.game === 'scrabble' && rank.length === 3 && rank.every((x) => x.p === before.round.sb.scores[x.pid]) && rank[0].p >= rank[1].p, JSON.stringify(j.last).slice(0, 300))
check('người thắng (vương miện) là bạn thật, Bạn AI không thắng', !rank[0].ai)
check('tổng điểm cả buổi cộng điểm Scrabble', j.totals[rank[0].pid] === rank[0].p)
check('kết quả có bàn cờ cuối ván + các từ đã đặt', j.last.sb.board.length === 225 && j.last.sb.board !== '.'.repeat(225) && Array.isArray(j.last.sb.words[P.pid]))
check('hết ván: giá chữ, túi chữ không còn gửi về máy', !j.round.sb.rack && j.round.sb.bag === 0)
// tối đa 4 người
await post(A, { action: 'ai_add', code }); await post(A, { action: 'ai_add', code })
j = await post(A, { action: 'start', code })
check('Scrabble quá 4 người (tính cả Bạn AI) -> báo không bắt đầu được', j.http === 409 && j.error === 'sb_players', JSON.stringify(j).slice(0, 100))
await post(A, { action: 'leave', code })

// Scrabble với Bạn AI (solo)
const C = await hello({ name: 'Chi', icon: '🐰', grade: 'Lớp 3' })
j = await post(C, { action: 'solo', minutes: 10 })
check('Scrabble với Bạn AI: tạo phòng + Bạn AI + bắt đầu luôn, con đi trước', j.status === 'playing' && j.round.game === 'scrabble' && j.players.length === 2 && j.players[1].ai && j.round.sb.order[0] === C.pid && j.cfg.minutes === 10, JSON.stringify(j).slice(0, 200))
const solo = j.code
await sleep(Math.max(0, j.round.start - j.now) + 300)
let cv2 = await post(C, { action: 'sync', code: solo })
const m3 = bestMove(cv2.round.sb, cv2.round.sb.rack, C.pid)
j = await post(C, { action: 'sb_move', code: solo, n: 1, tiles: m3.tiles })
check('con đặt từ đầu tiên', j.http === 200 && j.round.sb.scores[C.pid] === m3.score)
await sleep(3200)
j = await post(C, { action: 'sync', code: solo })
check('Bạn AI đi sau con, điểm vẫn thấp hơn con', j.round.sb.moves.length >= 2 && j.round.sb.moves.at(-1).p !== C.pid && j.round.sb.scores[j.players[1].pid] < j.round.sb.scores[C.pid] && j.round.sb.order[j.round.sb.turn] === C.pid, JSON.stringify(j.round.sb.moves))
await post(C, { action: 'leave', code: solo })

// Thách đấu ngẫu nhiên Scrabble giữa 2 bạn thật
const D = await hello({ name: 'Duy', icon: '🐶', grade: 'Lớp 6' }), F = await hello({ name: 'Phi', icon: '🐸', grade: 'Lớp 6' })
const rd = await post(D, { action: 'random', level: 'k69', game: 'scrabble' })
check('thách đấu ngẫu nhiên Scrabble: tạo phòng chờ, 20 phút', rd.status === 'waiting' && rd.cfg.game === 'scrabble' && rd.cfg.minutes === 20)
const rf = await post(F, { action: 'random', level: 'k69', game: 'bee' })
check('bạn cùng trình độ vào: chơi Scrabble theo cách bạn chờ đã chọn', rf.code === rd.code && rf.status === 'playing' && rf.round.game === 'scrabble' && rf.round.sb.order.length === 2)
await post(D, { action: 'leave', code: rd.code })

// Quá giờ lượt / vắng mặt / ai cũng bỏ lượt 2 lần (máy chủ thử rút ngắn: lượt 7 giây, vắng 5 giây)
const G = await hello({ name: 'Gia', icon: '🐼', grade: 'Lớp 5' }, FAST), H = await hello({ name: 'Hà', icon: '🐨', grade: 'Lớp 5' }, FAST)
let g = await post(G, { action: 'create' }, FAST); const fc = g.code
await post(H, { action: 'join', code: fc }, FAST)
await post(G, { action: 'config', code: fc, game: 'scrabble', minutes: 10 }, FAST)
g = await post(G, { action: 'start', code: fc }, FAST)
await sleep(Math.max(0, g.round.start - g.now) + 200)
g = await post(G, { action: 'sync', code: fc }, FAST)
const t1 = g.round.sb.order[g.round.sb.turn]
// cả hai cùng hỏi máy chủ đều đặn nhưng không đi -> hết 7 giây lượt thì tự bỏ lượt
for (let k = 0; k < 4; k++) { await sleep(2000); await post(H, { action: 'sync', code: fc }, FAST); g = await post(G, { action: 'sync', code: fc }, FAST) }
check('quá giờ lượt: máy tự bỏ lượt (đổi chữ), sang bạn kế', g.round.sb.moves.length >= 1 && g.round.sb.moves[0].p === t1 && g.round.sb.moves[0].k === 'time', JSON.stringify(g.round.sb.moves))
// chỉ G hỏi máy chủ; tới lượt H mà H im lặng 5 giây -> bỏ qua lượt H
let waited = 0
while (waited < 20000 && !(g.round.sb.moves.some((m) => m.p === H.pid && m.k === 'away')) && g.status === 'playing') { await sleep(1500); waited += 1500; g = await post(G, { action: 'sync', code: fc }, FAST) }
check('bạn tới lượt nhưng vắng mặt (máy im 5 giây): bỏ qua lượt bạn đó', g.round.sb.moves.some((m) => m.p === H.pid && m.k === 'away'), JSON.stringify(g.round.sb.moves))
// ai cũng bỏ lượt 2 lần liền -> hết ván
waited = 0
while (waited < 40000 && g.status === 'playing') { await sleep(1500); waited += 1500; await post(H, { action: 'sync', code: fc }, FAST); const me = g.round.sb.order[g.round.sb.turn] === G.pid ? G : H; await post(me, { action: 'sb_pass', code: fc, n: 1 }, FAST); g = await post(G, { action: 'sync', code: fc }, FAST) }
check('ai cũng bỏ lượt 2 lần liền -> hết ván, có kết quả', g.status === 'results' && g.last.sb.reason === 'passes', g.status + ' ' + JSON.stringify(g.last && g.last.sb && g.last.sb.reason))
await post(G, { action: 'leave', code: fc }, FAST)
// hết giờ ván -> tự chốt
const I = await hello({ name: 'Ít', icon: '🐯', grade: 'Lớp 2' }, FAST)
let h = await post(I, { action: 'solo', minutes: 5 }, FAST)
check('ván Scrabble có giờ kết thúc theo số phút đã chọn', h.round.end - h.round.start === 5 * 60000)
await post(I, { action: 'leave', code: h.code }, FAST)

console.log(Object.values(res).every(Boolean) ? `ALL PASS ✓ (${Object.keys(res).length} checks)` : 'FAILED: ' + Object.entries(res).filter(([, v]) => !v).map(([k]) => k).join(' | '))
