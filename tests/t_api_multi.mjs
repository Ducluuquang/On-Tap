// Luật nhà: 26/10/2026 ghép nhiều từ trong một lượt; 31/10/2026 đặt ở nhiều chỗ cũng được (mỗi từ chạm chữ có sẵn, có nghĩa).
// Thử qua máy chủ /api/arena (đúng đường gọi của máy con). Bày đúng bàn cờ trong ảnh anh gửi (sửa thẳng trong Redis).
import { execFileSync } from 'node:child_process'
const BASE = 'http://localhost:4192/api/arena'
const res = {}; const check = (n, c, x = '') => { res[n] = !!c; console.log((c ? '  ✓ ' : '  ✗ ') + n + (c ? '' : '  → ' + x)) }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
async function post(who, body) {
  const r = await fetch(BASE, { method: 'POST', headers: { 'content-type': 'application/json', ...(who && who.token ? { authorization: 'Bearer ' + who.token } : {}) }, body: JSON.stringify({ pid: who && who.pid, ...(who && who.prof), ...body }) })
  return { ...(await r.json()), http: r.status }
}
const hello = async (prof) => ({ ...(await post(null, { action: 'hello', ...prof })), prof })
const rget = (k) => execFileSync('redis-cli', ['-p', '6390', '--raw', 'GET', k]).toString().trim()
const rset = (k, v) => execFileSync('redis-cli', ['-p', '6390', 'SET', k, v, 'EX', '3600']).toString().trim()
const N = 15, at = (r, c) => r * N + c
function board(list) { const b = '.'.repeat(225).split(''); for (const [r, c, w, d] of list) [...w].forEach((ch, k) => { b[d === 'h' ? at(r, c + k) : at(r + k, c)] = ch }); return b.join('') }
const B1 = board([[7, 5, 'FLARE', 'h'], [5, 7, 'COAX', 'v'], [4, 9, 'MILE', 'v'], [4, 9, 'MA', 'h']])
const T = (...cells) => cells.map(([r, c, l]) => ({ i: at(r, c), l, b: 0 }))

const A = await hello({ name: 'Alex', icon: '🦊', grade: 'Lớp 7' })
let s = await post(A, { action: 'solo', minutes: 20 })
const code = s.code, n = s.round.n
await sleep(Math.max(0, s.round.start - s.now) + 300)
// bày bàn cờ như ảnh: tới lượt Alex, giá chữ P A D U G T J
const meta = JSON.parse(rget('arena:room:' + code))
const sb = meta.round.sb
const bagBefore = sb.bag.length
sb.board = B1; sb.racks[A.pid] = 'PADUGTJ'; sb.turn = sb.order.indexOf(A.pid); sb.turnStart = Date.now(); sb.v++
rset('arena:room:' + code, JSON.stringify(meta))
s = await post(A, { action: 'sync', code })
check('bàn cờ giống ảnh, tới lượt Alex, giá P A D U G T J', s.round.sb.board === B1 && s.round.sb.rack === 'PADUGTJ' && s.round.sb.order[s.round.sb.turn] === A.pid, JSON.stringify(s.round.sb.rack))
// một chữ đứng lẻ (không ghép thành từ nào) -> báo lỗi rõ, không mất lượt
let j = await post(A, { action: 'sb_move', code, n, tiles: T([4, 11, 'P'], [10, 2, 'A']) })
check('MAP + một chữ A đứng lẻ ở góc -> báo "phải ghép vào một từ", không mất lượt', j.http === 422 && j.bad === 'alone' && j.code === code && /ghép vào một từ/.test(j.msg) && j.round.sb.order[j.round.sb.turn] === A.pid, JSON.stringify({ http: j.http, bad: j.bad, code: j.code, msg: j.msg }))
// đặt như anh: P-A-D dọc + U-G ngang
j = await post(A, { action: 'sb_move', code, n, tiles: T([4, 11, 'P'], [5, 11, 'A'], [6, 11, 'D'], [6, 12, 'U'], [6, 13, 'G']) })
const last = j.round && j.round.sb.moves.filter((m) => m.p === A.pid).at(-1)
check('đặt P-A-D + U-G trong một lượt -> máy chủ nhận (200)', j.http === 200 && last && last.k === 'play', JSON.stringify(j).slice(0, 200))
check('nhật ký: 2 từ chính PAD, DUG + từ phụ MAP, +19 điểm', last && last.w.join(',') === 'PAD,DUG,MAP' && last.m === 2 && last.s === 19, JSON.stringify(last))
check('điểm của Alex +19; giá bốc thêm đủ 7 chữ (giữ T J); túi bớt 5 chữ', j.round.sb.scores[A.pid] === 19 && j.round.sb.rack.length === 7 && j.round.sb.rack.startsWith('TJ') && j.round.sb.bag === bagBefore - 5, JSON.stringify({ sc: j.round.sb.scores[A.pid], rack: j.round.sb.rack, bag: j.round.sb.bag, bagBefore }))
check('danh sách từ của Alex có PAD và DUG (Ôn Tập tính 2 từ)', JSON.stringify(j.round.sb.words[A.pid]) === JSON.stringify(['PAD', 'DUG']) && j.scores[A.pid].d === 2, JSON.stringify(j.round.sb.words))
check('bàn cờ có đủ 5 chữ vừa đặt', ['P', 'A', 'D', 'U', 'G'].every((l, k) => j.round.sb.board[[at(4, 11), at(5, 11), at(6, 11), at(6, 12), at(6, 13)][k]] === l))
// Bạn AI vẫn đi bình thường (nước một hàng) và vẫn kém Alex
await sleep(4500)
s = await post(A, { action: 'sync', code })
const aiMove = s.round.sb.moves.filter((m) => m.p !== A.pid).at(-1)
const aiPid = s.round.sb.order.find((p) => p !== A.pid)
check('Bạn AI đi tiếp (đặt từ hoặc bỏ lượt), điểm vẫn kém Alex', aiMove && ['play', 'pass'].includes(aiMove.k) && (s.round.sb.scores[aiPid] || 0) < s.round.sb.scores[A.pid], JSON.stringify({ aiMove, sc: s.round.sb.scores }))
j = await post(A, { action: 'sb_end', code, n })
const rk = (j.last && j.last.rank) || []
check('kết thúc ván: kết quả ghi 2 từ của Alex trong ván (PAD, DUG)', j.status === 'results' && (j.last.sb.words[A.pid] || []).join(',') === 'PAD,DUG' && (rk.find((x) => x.pid === A.pid) || {}).w === 2, JSON.stringify(j.last && j.last.sb && j.last.sb.words))
await post(A, { action: 'leave', code })

// ---- 31/10: đúng ván trong ảnh anh gửi (HAIRIER, IDOL, EEL có sẵn): đặt PEELED (cột) + FOR (hàng) ở hai chỗ trong một lượt
const BU = board([[3, 6, 'HAIRIER', 'v'], [7, 6, 'IDOL', 'h'], [5, 9, 'EEL', 'v']])
const K = await hello({ name: 'Bin', icon: '🐻', grade: 'Lớp 6' })
let s2 = await post(K, { action: 'solo', minutes: 20 })
const code2 = s2.code, n2 = s2.round.n
await sleep(Math.max(0, s2.round.start - s2.now) + 300)
const meta2 = JSON.parse(rget('arena:room:' + code2))
const sb2 = meta2.round.sb
sb2.board = BU; sb2.racks[K.pid] = 'PEDFOYF'; sb2.turn = sb2.order.indexOf(K.pid); sb2.turnStart = Date.now(); sb2.v++
rset('arena:room:' + code2, JSON.stringify(meta2))
// một từ đứng riêng không chạm chữ nào -> báo rõ từ nào, không mất lượt
j = await post(K, { action: 'sb_move', code: code2, n: n2, tiles: T([4, 9, 'P'], [8, 9, 'E'], [9, 9, 'D'], [13, 1, 'F'], [13, 2, 'Y']) })
check('PEELED + "FY" đứng riêng ở góc -> báo “FY” phải chạm vào chữ đã có, không mất lượt', j.http === 422 && j.bad === 'connect' && /“FY”/.test(j.msg) && j.round.sb.order[j.round.sb.turn] === K.pid, JSON.stringify({ http: j.http, bad: j.bad, msg: j.msg }))
j = await post(K, { action: 'sb_move', code: code2, n: n2, tiles: T([4, 9, 'P'], [8, 9, 'E'], [9, 9, 'D'], [9, 4, 'F'], [9, 5, 'O']) })
const last2 = j.round && j.round.sb.moves.filter((m) => m.p === K.pid).at(-1)
check('ván trong ảnh: PEELED + FOR ở hai chỗ -> máy chủ nhận, 2 từ chính, +21 điểm', j.http === 200 && last2 && last2.k === 'play' && last2.w.join(',') === 'PEELED,FOR' && last2.m === 2 && last2.s === 21, JSON.stringify(last2 || j).slice(0, 220))
check('điểm của Bin 21; danh sách từ có PEELED và FOR (Ôn Tập tính 2 từ); giá còn Y F + bốc thêm', j.round.sb.scores[K.pid] === 21 && JSON.stringify(j.round.sb.words[K.pid]) === JSON.stringify(['PEELED', 'FOR']) && j.scores[K.pid].d === 2 && j.round.sb.rack.startsWith('YF') && j.round.sb.rack.length === 7, JSON.stringify({ sc: j.round.sb.scores[K.pid], w: j.round.sb.words[K.pid], rack: j.round.sb.rack }))
await post(K, { action: 'leave', code: code2 })
console.log(Object.values(res).every(Boolean) ? `ALL PASS ✓ (${Object.keys(res).length} checks)` : 'FAILED: ' + Object.entries(res).filter(([, v]) => !v).map(([k]) => k).join(' | '))
