// Luật nhà: 26/10/2026 một lượt được ghép NHIỀU từ nối liền nhau (hình chữ L, chữ T…);
// 31/10/2026 (anh gửi ảnh PEELED + FOR): đặt ở NHIỀU CHỖ cũng được, không cần nối liền nhau, miễn mỗi từ chạm chữ có sẵn và có nghĩa.
// Thử thẳng bộ luật api/_scrabble/engine.mjs; điểm được đối chiếu với một bộ tính điểm viết riêng trong file thử này.
import * as E from '../api/_scrabble/engine.mjs'
const res = {}; const check = (n, c, x = '') => { res[n] = !!c; console.log((c ? '  ✓ ' : '  ✗ ') + n + (c ? '' : '  → ' + x)) }
const dict = await E.getDict()
const N = 15, at = (r, c) => r * N + c
function board(list) { const b = '.'.repeat(225).split(''); for (const [r, c, w, d] of list) [...w].forEach((ch, k) => { b[d === 'h' ? at(r, c + k) : at(r + k, c)] = ch }); return b.join('') }
const g = (racks, b) => { const sb = E.newGame(Object.keys(racks), 1000); for (const [p, r] of Object.entries(racks)) sb.racks[p] = r; if (b) sb.board = b; return sb }
const T = (...cells) => cells.map(([r, c, l]) => ({ i: at(r, c), l: l.toUpperCase(), b: l === l.toLowerCase() ? 1 : 0 }))
// bộ tính điểm riêng (không dùng code của engine): mọi từ ngang/dọc ≥ 2 chữ đi qua chữ mới; ô nhân điểm chỉ cho chữ mới
function ref(bd, tiles) {
  const tmp = bd.split(''), isNew = new Set()
  for (const t of tiles) { tmp[t.i] = t.b ? t.l.toLowerCase() : t.l; isNew.add(t.i) }
  const val = (ch) => (ch >= 'a' && ch <= 'z' ? 0 : E.VALUES[ch])
  const words = new Map()
  for (const t of tiles) for (const [dr, dc] of [[0, 1], [1, 0]]) {
    let r = Math.floor(t.i / N), c = t.i % N
    while (r - dr >= 0 && c - dc >= 0 && tmp[(r - dr) * N + c - dc] !== '.') { r -= dr; c -= dc }
    const cells = []
    while (r < N && c < N && tmp[r * N + c] !== '.') { cells.push(r * N + c); r += dr; c += dc }
    if (cells.length >= 2) words.set(dr + ':' + cells[0], cells)
  }
  let total = 0; const ws = []
  for (const cells of words.values()) {
    let s = 0, m = 1
    for (const i of cells) { let v = val(tmp[i]); if (isNew.has(i)) { const p = E.PREMIUM[i]; if (p === 'DL') v *= 2; else if (p === 'TL') v *= 3; else if (p === 'DW') m *= 2; else if (p === 'TW') m *= 3 } s += v }
    total += s * m; ws.push(cells.map((i) => tmp[i].toUpperCase()).join(''))
  }
  return { total: total + (tiles.length === 7 ? 50 : 0), words: ws.sort() }
}
const same = (m, bd, tiles) => { const r = ref(bd, tiles); return m.ok && m.score === r.total && m.words.map((x) => x.w).sort().join(',') === r.words.join(',') }

// ---- 1. đúng bàn cờ trong ảnh anh gửi: FLARE, COAX, MILE, MA có sẵn; anh đặt P A D (dọc) + U G (ngang)
const B1 = board([[7, 5, 'FLARE', 'h'], [5, 7, 'COAX', 'v'], [4, 9, 'MILE', 'v'], [4, 9, 'MA', 'h']])
const mv1 = T([4, 11, 'P'], [5, 11, 'A'], [6, 11, 'D'], [6, 12, 'U'], [6, 13, 'G'])
let sb = g({ a: 'PADUGTJ', b: 'EEEEEEE' }, B1)
let m = E.checkMove(sb, 'a', mv1, dict)
check('ảnh của anh: đặt P-A-D dọc + U-G ngang trong MỘT lượt -> hợp lệ', m.ok, JSON.stringify(m))
check('ghép được 3 từ: PAD, DUG (từ chính) + MAP (từ phụ)', m.ok && m.main === 2 && m.words.map((x) => x.w).join(',') === 'PAD,DUG,MAP', JSON.stringify(m.words))
check('điểm: MAP 7 + PAD 6 + DUG 6 (U ở ô ×2 chữ) = 19', m.ok && m.score === 19 && same(m, B1, mv1) && E.PREMIUM[at(6, 12)] === 'DL', `${m.score} vs ${ref(B1, mv1).total}`)
E.applyPlay(sb, 'a', m, 5000)
const lg = sb.moves.at(-1)
check('sau khi đặt: bàn có PAD + DUG, cộng 19 điểm, bốc thêm đủ 7 chữ', sb.board[at(4, 11)] === 'P' && sb.board[at(6, 13)] === 'G' && sb.scores.a === 19 && sb.racks.a.length === 7 && sb.racks.a.startsWith('TJ'))
check('danh sách từ của con ghi cả PAD và DUG; nhật ký ghi 2 từ chính', sb.words.a.join(',') === 'PAD,DUG' && lg.m === 2 && lg.w.join(',') === 'PAD,DUG,MAP', JSON.stringify(lg))

// ---- 2. góc chữ L là chữ có sẵn: HE có sẵn, đặt R O (ngang) + A T (dọc dưới chữ E) -> HERO + EAT
const B2 = board([[7, 6, 'HE', 'h']])
const mv2 = T([7, 8, 'R'], [7, 9, 'O'], [8, 7, 'A'], [9, 7, 'T'])
m = E.checkMove(g({ a: 'ROATXYZ' }, B2), 'a', mv2, dict)
check('chữ L nối qua chữ có sẵn (E): HERO + EAT -> hợp lệ, điểm đúng', m.ok && m.main === 2 && same(m, B2, mv2), JSON.stringify(m))

// ---- 3. lượt đầu hình chữ L qua ô ★ (chữ C ở góc, trên ô ×2 từ): CAT + COW, mỗi từ đều được nhân đôi
const mv3 = T([7, 7, 'C'], [7, 8, 'A'], [7, 9, 'T'], [8, 7, 'O'], [9, 7, 'W'])
m = E.checkMove(g({ a: 'CATOWXY' }), 'a', mv3, dict)
check('lượt đầu hình chữ L: CAT (3+1+1)×2=10 + COW (3+1+4)×2=16 = 26', m.ok && m.score === 26 && same(m, '.'.repeat(225), mv3), JSON.stringify(m))
check('lượt đầu chữ L không qua ô ★ -> báo lỗi ô ★', E.checkMove(g({ a: 'CATOWXY' }), 'a', T([2, 2, 'C'], [2, 3, 'A'], [2, 4, 'T'], [3, 2, 'O'], [4, 2, 'W']), dict).error === 'center')

// ---- 4. (31/10) hai chỗ khác nhau trong một lượt, mỗi từ chạm chữ có sẵn -> cho phép
const B4 = board([[7, 6, 'CAT', 'h'], [7, 8, 'TOE', 'v'], [9, 8, 'EGG', 'h']])
const mv4 = T([7, 9, 'S'], [9, 11, 'S'])
m = E.checkMove(g({ a: 'SSXYZQJ' }, B4), 'a', mv4, dict)
check('CATS và EGGS ở hai chỗ khác nhau (mỗi từ chạm chữ có sẵn) -> hợp lệ, 2 từ chính, điểm đúng', m.ok && m.main === 2 && m.words.map((x) => x.w).sort().join(',') === 'CATS,EGGS' && same(m, B4, mv4), JSON.stringify(m))
m = E.checkMove(g({ a: 'SSXYZQJ' }, B4), 'a', T([7, 9, 'S']), dict)
check('chỉ CATS (một chỗ) -> vẫn hợp lệ', m.ok && m.words[0].w === 'CATS', JSON.stringify(m))
// hai từ có chung chữ T có sẵn (CATS + TOES) -> cho phép
m = E.checkMove(g({ a: 'SSXYZQJ' }, B4.slice(0, at(9, 9)) + '..' + B4.slice(at(9, 11))), 'a', T([7, 9, 'S'], [10, 8, 'S']), dict)
check('CATS + TOES (chung chữ T có sẵn) -> hợp lệ', m.ok && m.words.map((x) => x.w).sort().join(',') === 'CATS,TOES', JSON.stringify(m))
// một từ đứng riêng, không chạm chữ nào có sẵn -> không cho, nói rõ từ nào
m = E.checkMove(g({ a: 'SATXYZQ' }, B4), 'a', T([7, 9, 'S'], [1, 1, 'A'], [1, 2, 'T']), dict)
check('CATS + "AT" đứng riêng ở góc bàn -> báo “AT” phải chạm vào chữ đã có', !m.ok && m.error === 'connect' && m.msg.includes('“AT”') && /chạm vào chữ đã có/.test(m.msg), JSON.stringify(m))
// một trong hai từ sai -> báo đúng từ sai
m = E.checkMove(g({ a: 'SXYZQJK' }, B4), 'a', T([7, 9, 'S'], [9, 11, 'X']), dict)
check('CATS + EGGX -> báo từ “EGGX” không có trong từ điển', !m.ok && m.error === 'word' && m.msg.includes('EGGX') && !m.msg.includes('CATS'), JSON.stringify(m))

// ---- 4b. đúng bàn cờ trong ảnh anh gửi 31/10: HAIRIER, IDOL, EEL có sẵn; con đặt P, E, D (cột) + F, O (hàng 9)
const BU = board([[3, 6, 'HAIRIER', 'v'], [7, 6, 'IDOL', 'h'], [5, 9, 'EEL', 'v']])
const mvU = T([4, 9, 'P'], [8, 9, 'E'], [9, 9, 'D'], [9, 4, 'F'], [9, 5, 'O'])
let sbU = g({ kid: 'PEDFOYF', ai: 'EEEEEEE' }, BU)
m = E.checkMove(sbU, 'kid', mvU, dict)
check('ảnh của anh 31/10: PEELED + FOR trong MỘT lượt -> hợp lệ', m.ok && m.main === 2 && m.words.map((x) => x.w).join(',') === 'PEELED,FOR', JSON.stringify(m))
check('điểm: PEELED 13 (D ở ô ×3 chữ) + FOR 8 (O ở ô ×3 chữ) = 21', m.ok && m.score === 21 && same(m, BU, mvU) && E.PREMIUM[at(9, 9)] === 'TL' && E.PREMIUM[at(9, 5)] === 'TL', `${m.score} vs ${ref(BU, mvU).total}`)
E.applyPlay(sbU, 'kid', m, 9000)
check('sau khi đặt: danh sách từ của con có PEELED và FOR, nhật ký ghi 2 từ chính, còn Y F trên giá + bốc thêm', sbU.words.kid.join(',') === 'PEELED,FOR' && sbU.moves.at(-1).m === 2 && sbU.racks.kid.startsWith('YF') && sbU.racks.kid.length === 7, JSON.stringify(sbU.moves.at(-1)))

// ---- 4c. lượt đầu: thêm một từ đứng riêng ngoài từ qua ô ★ -> không cho
m = E.checkMove(g({ a: 'CATDOGX' }), 'a', T([7, 6, 'C'], [7, 7, 'A'], [7, 8, 'T'], [2, 2, 'D'], [2, 3, 'O'], [2, 4, 'G']), dict)
check('lượt đầu CAT qua ô ★ + DOG đứng riêng -> báo “DOG” phải nối với từ qua ô ★', !m.ok && m.error === 'connect' && m.msg.includes('“DOG”') && m.msg.includes('★'), JSON.stringify(m))

// ---- 5. một chữ đứng lẻ, không ghép vào từ nào -> không cho
m = E.checkMove(g({ a: 'SQXYZJK' }, B4), 'a', T([7, 9, 'S'], [12, 2, 'Q']), dict)
check('một chữ đứng lẻ ngoài bàn -> báo chữ nào cũng phải ghép vào một từ', !m.ok && m.error === 'alone' && /ghép vào một từ/.test(m.msg), JSON.stringify(m))

// ---- 6. có một từ sai trong các từ ghép -> báo đúng từ sai
m = E.checkMove(g({ a: 'PADUQGT' }, B1), 'a', T([4, 11, 'P'], [5, 11, 'A'], [6, 11, 'D'], [6, 12, 'U'], [6, 13, 'Q']), dict)
check('PAD + DUQ (không có) -> báo từ “DUQ” không có trong từ điển', !m.ok && m.error === 'word' && m.msg.includes('DUQ') && !m.msg.includes('PAD'), JSON.stringify(m))

// ---- 7. các lỗi khác: chữ không ghép thành từ -> "phải ghép vào một từ"; một chữ lượt đầu -> "ít nhất 2 chữ"
check('một hàng để trống ở giữa (không thành từ) -> báo phải ghép vào một từ', E.checkMove(g({ a: 'CATXYZE' }), 'a', T([7, 6, 'C'], [7, 8, 'A']), dict).error === 'alone')
check('hai chữ chéo nhau (không thành từ) -> báo phải ghép vào một từ', E.checkMove(g({ a: 'CATXYZE' }), 'a', T([7, 7, 'C'], [8, 8, 'A']), dict).error === 'alone')
check('lượt đầu 1 chữ -> báo phải ít nhất 2 chữ', E.checkMove(g({ a: 'CATXYZE' }), 'a', T([7, 7, 'C']), dict).error === 'short')
check('1 chữ không sát chữ nào -> báo phải nối vào chữ có sẵn', E.checkMove(g({ a: 'SATXYZE' }, B4), 'a', T([1, 1, 'S']), dict).error === 'connect')

// ---- 8. đặt 1 chữ ghép 2 từ: từ chính là từ dài hơn
m = E.checkMove(g({ a: 'SXYZQJK' }, B4.slice(0, at(9, 9)) + '..' + B4.slice(at(9, 11))), 'a', T([10, 8, 'S']), dict)
check('đặt S dưới TOE: TOES, điểm đúng', m.ok && m.main === 1 && m.words[0].w === 'TOES' && same(m, B4.slice(0, at(9, 9)) + '..' + B4.slice(at(9, 11)), T([10, 8, 'S'])), JSON.stringify(m))

// ---- 9. đặt hết 7 chữ hình chữ T: thưởng 50
const mv9 = T([7, 5, 'S'], [7, 6, 'T'], [7, 7, 'A'], [7, 8, 'R'], [8, 7, 'N'], [9, 7, 'T'], [10, 7, 'S'])   // STAR + ANTS (chữ T)
m = E.checkMove(g({ a: 'STARNTS' }), 'a', mv9, dict)
check('đặt hết 7 chữ hình chữ T (STAR + ANTS) -> +50, điểm đúng', m.ok && m.bingo === 50 && same(m, '.'.repeat(225), mv9), JSON.stringify(m))

// ---- 10. nhiều nước ngẫu nhiên: mọi nước hợp lệ đều có điểm khớp bộ tính điểm riêng
let n = 0, bad = 0, bent = 0
for (let k = 0; k < 6000; k++) {
  const sbx = g({ a: 'AEIRSTN' }, B1)
  const cells = []
  const free = []; for (let i = 0; i < 225; i++) if (sbx.board[i] === '.') free.push(i)
  // chọn 2–4 ô trống sát chữ có sẵn hoặc sát nhau
  const near = free.filter((i) => { const r = Math.floor(i / N), c = i % N; return [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]].some(([a, b]) => a >= 0 && a < N && b >= 0 && b < N && sbx.board[a * N + b] !== '.') })
  const start = near[Math.floor(Math.random() * near.length)]; cells.push(start)
  const want = 2 + Math.floor(Math.random() * 3)
  while (cells.length < want) { const base = cells[Math.floor(Math.random() * cells.length)], r = Math.floor(base / N), c = base % N; const opts = [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]].filter(([a, b]) => a >= 0 && a < N && b >= 0 && b < N && sbx.board[a * N + b] === '.' && !cells.includes(a * N + b)); if (!opts.length) break; const [a, b] = opts[Math.floor(Math.random() * opts.length)]; cells.push(a * N + b) }
  const letters = [...'AEIRSTN'].sort(() => Math.random() - 0.5)
  const tiles = cells.map((i, j) => ({ i, l: letters[j], b: 0 }))
  const mm = E.checkMove(sbx, 'a', tiles, dict)
  if (mm.ok) { n++; if (!same(mm, B1, tiles)) bad++; if (new Set(cells.map((i) => Math.floor(i / N))).size > 1 && new Set(cells.map((i) => i % N)).size > 1) bent++ }
}
check(`6000 nước ngẫu nhiên (hình bất kỳ): ${n} nước hợp lệ (${bent} nước hình chữ L/T), điểm đều khớp`, n > 20 && bent > 3 && bad === 0, `${n} hợp lệ, ${bent} cong, ${bad} lệch`)
// ---- 11. (31/10) nhiều nước ngẫu nhiên đặt ở HAI CHỖ: so quyết định cho/không cho + điểm với bộ luật viết riêng
// Bộ luật riêng (không dùng code kiểm tra của engine, chỉ dùng chung từ điển): chữ nào cũng nằm trong một từ ≥ 2 chữ;
// gom cụm bằng cách loang theo các từ có chữ mới; mỗi cụm phải có ô chữ cũ; mọi từ có trong từ điển.
function refRule(bd, tiles) {
  const tmp = bd.split(''), isNew = new Set(tiles.map((t) => t.i))
  for (const t of tiles) tmp[t.i] = t.b ? t.l.toLowerCase() : t.l
  const wordOf = (i, dr, dc) => { let r = Math.floor(i / N), c = i % N; while (r - dr >= 0 && c - dc >= 0 && tmp[(r - dr) * N + c - dc] !== '.') { r -= dr; c -= dc } const cells = []; while (r < N && c < N && tmp[r * N + c] !== '.') { cells.push(r * N + c); r += dr; c += dc } return cells }
  const formed = (cells) => cells.length >= 2 && cells.some((i) => isNew.has(i))
  const all = new Map()
  for (const t of tiles) for (const [dr, dc] of [[0, 1], [1, 0]]) { const w = wordOf(t.i, dr, dc); if (formed(w)) all.set(dr + ':' + w[0], w) }
  if (!all.size) return { ok: false, error: tiles.length > 1 ? 'alone' : 'connect' }
  if (tiles.some((t) => ![...all.values()].some((w) => w.includes(t.i)))) return { ok: false, error: 'alone' }
  const seen = new Set()
  for (const t of tiles) {
    if (seen.has(t.i)) continue
    const q = [t.i]; seen.add(t.i); let old = false
    while (q.length) { const x = q.pop(); if (!isNew.has(x)) old = true; for (const [dr, dc] of [[0, 1], [1, 0]]) { const w = wordOf(x, dr, dc); if (!formed(w)) continue; for (const c of w) if (!seen.has(c)) { seen.add(c); q.push(c) } } }
    if (!old) return { ok: false, error: 'connect' }
  }
  for (const w of all.values()) if (!E.wordKind(dict, w.map((i) => tmp[i].toUpperCase()).join(''))) return { ok: false, error: 'word' }
  return { ok: true }
}
let n2 = 0, ok2 = 0, two = 0, mism = 0, badScore = 0, floatRej = 0
const firstMism = []
const nearOf = (bd, i) => { const r = Math.floor(i / N), c = i % N; return [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]].some(([a, b]) => a >= 0 && a < N && b >= 0 && b < N && bd[a * N + b] !== '.') }
for (let k = 0; k < 8000; k++) {
  const sbx = g({ a: 'AEIRSTN' }, BU)
  const bd = sbx.board
  const free = []; for (let i = 0; i < 225; i++) if (bd[i] === '.') free.push(i)
  const near = free.filter((i) => nearOf(bd, i))
  const cells = []
  const grow = (start, size) => { const cl = [start]; cells.push(start); while (cl.length < size) { const base = cl[Math.floor(Math.random() * cl.length)], r = Math.floor(base / N), c = base % N; const opts = [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]].filter(([a, b]) => a >= 0 && a < N && b >= 0 && b < N && bd[a * N + b] === '.' && !cells.includes(a * N + b)); if (!opts.length) break; const [a, b] = opts[Math.floor(Math.random() * opts.length)]; cl.push(a * N + b); cells.push(a * N + b) } }
  grow(near[Math.floor(Math.random() * near.length)], 1 + Math.floor(Math.random() * 3))
  const pool2 = (Math.random() < 0.6 ? near : free).filter((i) => !cells.includes(i))
  grow(pool2[Math.floor(Math.random() * pool2.length)], 1 + Math.floor(Math.random() * 3))
  const letters = [...'AEIRSTN'].sort(() => Math.random() - 0.5)
  const tiles = cells.slice(0, 7).map((i, j) => ({ i, l: letters[j], b: 0 }))
  const mm = E.checkMove(sbx, 'a', tiles, dict), rr = refRule(bd, tiles)
  n2++
  if (mm.ok !== rr.ok || (!mm.ok && mm.error !== rr.error)) { mism++; if (firstMism.length < 3) firstMism.push(JSON.stringify({ tiles: tiles.map((t) => [Math.floor(t.i / N), t.i % N, t.l]), eng: mm.ok || mm.error, ref: rr.ok || rr.error })) }
  if (mm.ok) { ok2++; if (!same(mm, bd, tiles)) badScore++; const rows = new Set(tiles.map((t) => Math.floor(t.i / N))), cols = new Set(tiles.map((t) => t.i % N)); if (rows.size > 1 && cols.size > 1 && mm.main >= 2) two++ }
  if (!mm.ok && mm.error === 'connect') floatRej++
}
check(`8000 nước ngẫu nhiên ở hai chỗ: engine và bộ luật riêng quyết định giống nhau hết; ${ok2} nước hợp lệ (${two} nước nhiều từ ở nhiều chỗ), điểm đều khớp; ${floatRej} nước bị từ chối vì có từ đứng riêng`, mism === 0 && badScore === 0 && ok2 > 30 && two > 5 && floatRej > 30, `${mism} lệch quyết định ${firstMism.join(' ; ')}, ${badScore} lệch điểm`)
console.log(Object.values(res).every(Boolean) ? `ALL PASS ✓ (${Object.keys(res).length} checks)` : 'FAILED: ' + Object.entries(res).filter(([, v]) => !v).map(([k]) => k).join(' | '))
