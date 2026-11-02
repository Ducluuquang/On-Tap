// Thử bộ luật Scrabble (api/_scrabble/engine.mjs): bộ quân, ô nhân điểm, từ điển, kiểm tra nước đi, tính điểm,
// bốc thêm chữ, bỏ lượt = đổi cả giá, hết ván, và Bạn AI tự chơi cả ván (mọi nước đều hợp lệ).
import * as E from '../api/_scrabble/engine.mjs'
const res = {}; const check = (n, c, x = '') => { res[n] = !!c; console.log((c ? '  ✓ ' : '  ✗ ') + n + (c ? '' : '  → ' + x)) }
const t0 = Date.now()
const dict = await E.getDict()
console.log(`  (từ điển: ${dict.count} từ, ${dict.nodes} nút, nạp ${Date.now() - t0}ms)`)

// ---- bộ quân + bàn
const cnt = (ch) => [...E.TILES].filter((x) => x === ch).length
check('bộ 100 quân: 98 chữ + 2 quân trắng', E.TILES.length === 100 && cnt('?') === 2 && cnt('E') === 12 && cnt('A') === 9 && cnt('Q') === 1 && cnt('Z') === 1)
check('tổng điểm các quân = 187 (như bộ thật)', [...E.TILES].reduce((a, ch) => a + E.VALUES[ch], 0) === 187, [...E.TILES].reduce((a, ch) => a + E.VALUES[ch], 0))
const pc = (t) => E.PREMIUM.filter((x) => x === t).length
check('ô nhân điểm: 8 ×3 từ, 17 ×2 từ (có ★), 12 ×3 chữ, 24 ×2 chữ', pc('TW') === 8 && pc('DW') === 17 && pc('TL') === 12 && pc('DL') === 24 && E.PREMIUM[112] === 'DW')
check('bàn đối xứng (lật ngang, lật dọc, chéo)', E.PREMIUM.every((p, i) => { const r = Math.floor(i / 15), c = i % 15; return p === E.PREMIUM[r * 15 + 14 - c] && p === E.PREMIUM[(14 - r) * 15 + c] && p === E.PREMIUM[c * 15 + r] }))
// ---- từ điển
check('từ điển: cat/house/played thông dụng, qi ít gặp, xyz không có', E.wordKind(dict, 'cat') === 2 && E.wordKind(dict, 'HOUSE') === 2 && E.wordKind(dict, 'played') === 2 && E.wordKind(dict, 'qi') === 1 && E.wordKind(dict, 'xyz') === 0)
check('từ điển có số nhiều, quá khứ: cats, dogs, jumped, running', ['cats', 'dogs', 'jumped', 'running', 'butter', 'spices'].every((w) => E.wordKind(dict, w) > 0))

// ---- nước đi
const g = (racks, board) => { const sb = E.newGame(Object.keys(racks), 1000); for (const [p, r] of Object.entries(racks)) sb.racks[p] = r; if (board) sb.board = board; return sb }
const H = (r, c, s) => [...s].map((ch, k) => ({ i: r * 15 + c + k, l: ch.toUpperCase(), b: ch === ch.toLowerCase() ? 1 : 0 }))
const V = (r, c, s) => [...s].map((ch, k) => ({ i: (r + k) * 15 + c, l: ch.toUpperCase(), b: ch === ch.toLowerCase() ? 1 : 0 }))
let sb = g({ a: 'CATXYZE', b: 'DOGSEAR' })
let m = E.checkMove(sb, 'a', H(7, 6, 'CAT'), dict)
check('lượt đầu CAT qua ô ★: (3+1+1)×2 = 10 điểm', m.ok && m.score === 10 && m.words[0].w === 'CAT', JSON.stringify(m))
check('lượt đầu không qua ô ★ -> báo lỗi', E.checkMove(sb, 'a', H(3, 3, 'CAT'), dict).error === 'center')
check('lượt đầu đặt 1 chữ -> báo phải ít nhất 2 chữ', E.checkMove(sb, 'a', H(7, 7, 'C'), dict).error === 'short')
check('2 chữ chéo nhau, không thành từ -> báo chữ nào cũng phải ghép vào một từ', E.checkMove(sb, 'a', [{ i: 112, l: 'C' }, { i: 128, l: 'A' }], dict).error === 'alone')
check('2 chữ cách nhau một ô trống, không thành từ -> báo lỗi', E.checkMove(sb, 'a', [{ i: 111, l: 'C' }, { i: 113, l: 'A' }], dict).error === 'alone')
const bw = E.checkMove(sb, 'a', H(7, 6, 'TXA'), dict)
check('từ không có trong từ điển -> báo đúng từ sai', bw.error === 'word' && bw.msg.includes('TXA'), JSON.stringify(bw))
check('chữ không có trên giá -> báo lỗi', E.checkMove(sb, 'a', H(7, 6, 'DOG'), dict).error === 'rack')
let sbBlank = g({ a: '?ATXYZE' })
m = E.checkMove(sbBlank, 'a', H(7, 6, 'cAT'), dict)
check('quân trắng làm chữ C: 0 điểm -> (0+1+1)×2 = 4', m.ok && m.score === 4, JSON.stringify(m))
m = E.checkMove(g({ a: 'PLAYERS' }), 'a', H(7, 4, 'PLAYERS'), dict)
check('đặt hết 7 chữ (PLAYERS) được +50: (3+1+1+4+1+1+1)×2+50 = 74', m.ok && m.score === 74 && m.bingo === 50, JSON.stringify(m))

// áp dụng CAT rồi các nước nối tiếp
sb = g({ a: 'CATXYZE', b: 'SDOGEAR' })
const bag0 = sb.bag.length
E.applyPlay(sb, 'a', E.checkMove(sb, 'a', H(7, 6, 'CAT'), dict), 2000)
check('đặt CAT: điểm 10, bốc thêm cho đủ 7 chữ, túi bớt 3, tới lượt bạn kế', sb.scores.a === 10 && sb.racks.a.length === 7 && sb.racks.a.startsWith('XYZE') && sb.bag.length === bag0 - 3 && sb.order[sb.turn] === 'b' && sb.board.slice(111, 114) === 'CAT')
m = E.checkMove(sb, 'b', [{ i: 114, l: 'S' }], dict)
check('thêm S thành CATS: 3+1+1+1 = 6 (ô ★ đã dùng, không nhân nữa)', m.ok && m.score === 6 && m.words[0].w === 'CATS', JSON.stringify(m))
check('đặt chữ không nối vào chữ có sẵn -> báo lỗi', E.checkMove(sb, 'b', H(0, 0, 'DOG'), dict).error === 'connect')
// DOG dọc, chữ O nằm dưới A? -> tạo từ phụ. Đặt "D" ở (6,7) và "G" ở (8,7) quanh chữ A? (A ở 7,7) -> DAG? không phải từ
m = E.checkMove(sb, 'b', V(8, 6, 'SEA'), dict)
// S dưới C (C ở 7,6): từ chính SEA (dọc) + từ phụ? S ở (8,6): hàng ngang (8,5),(8,7) trống -> không có từ phụ; nhưng dọc C-S-E-A = "CSEA"
check('đặt dọc sát chữ có sẵn tạo từ dài hơn: CSEA không có -> báo lỗi', !m.ok && m.error === 'word', JSON.stringify(m))
m = E.checkMove(sb, 'b', V(8, 8, 'OE'), dict)   // T(7,8) + O(8,8) + E(9,8) = "TOE"
check('nối dọc từ chữ T: TOE = 1+1+1 = 3 (ô (8,8) ×2 chữ: O 1×2 -> 4)', m.ok && m.words[0].w === 'TOE' && m.score === 4, JSON.stringify(m))
// từ phụ: đặt "AD" ngang ở hàng 8, cột 7-8 -> A dưới A? (7,7)=A,(8,7)=A -> "AA"? ; dùng "DOG" ngang ở hàng 8 bắt đầu cột 5: D(8,5) O(8,6) G(8,7): từ phụ dọc C-O = "CO"? (7,6)=C,(8,6)=O -> "CO" không phải từ trong mọi từ điển
const sb2 = g({ a: 'TOXEEEE', b: 'NOXEEEE' }, sb.board)
m = E.checkMove(sb2, 'a', H(8, 7, 'TO'), dict)   // T(8,7) dưới A(7,7): "AT" dọc; O(8,8) dưới T(7,8): "TO" dọc; ngang "TO"
check('từ phụ được tính: TO (ngang) + AT + TO (dọc)', m.ok && m.words.length === 3 && m.words.map((x) => x.w).sort().join(',') === 'AT,TO,TO', JSON.stringify(m))
const expect = (() => { // TO ngang: T(8,7) không nhân, O(8,8) DL -> 1 + 2 = 3; AT dọc: A1 + T1 = 2; TO dọc: T1 + O(2) = 3 -> 8
  return 8 })()
check('điểm có từ phụ: 3 + 2 + 3 = 8', m.ok && m.score === expect, JSON.stringify(m))

// bỏ lượt = đổi cả giá
sb = g({ a: 'AAAAAAA', b: 'EEEEEEE' })
const bagLen = sb.bag.length
E.applyPass(sb, 'a', 3000, 'pass')
check('bỏ lượt: đổi cả 7 chữ (trả vào túi, bốc lại), túi giữ nguyên số chữ, sang lượt bạn kế', sb.racks.a.length === 7 && sb.bag.length === bagLen && sb.order[sb.turn] === 'b' && sb.passes === 1 && sb.moves.at(-1).x === 7)
let n = 0
while (!sb.over && n < 10) { E.applyPass(sb, sb.order[sb.turn], 3000 + n, 'pass'); n++ }
check('ai cũng bỏ lượt 2 lần liền -> hết ván ("passes")', sb.over === 1 && sb.reason === 'passes' && n === 3, n + ' ' + sb.reason)
const fp = E.finalScores(sb, 'passes')
check('hết ván do bỏ lượt: giữ nguyên điểm (không trừ)', fp.a.adj === 0 && fp.b.adj === 0 && fp.a.total === sb.scores.a)
// hết chữ
sb = g({ a: 'CAT', b: 'QZ' }); sb.bag = ''
E.applyPlay(sb, 'a', E.checkMove(sb, 'a', H(7, 6, 'CAT'), dict), 4000)
const fo = E.finalScores(sb, sb.reason)
check('túi cạn + đặt hết giá -> hết ván; người đặt hết được cộng điểm chữ của bạn (Q+Z = 20)', sb.over && sb.reason === 'out' && fo.a.total === 10 + 20 && fo.b.adj === -20 && fo.b.total === 0, JSON.stringify(fo))
const ft = E.finalScores(sb, 'time')
check('hết giờ / chủ phòng kết thúc: giữ nguyên điểm', ft.a.total === 10 && ft.b.total === 0 && ft.a.adj === 0)

// ---- Bạn AI
sb = g({ ai: 'DOGCATE' })
let t1 = Date.now(); let f = E.findMoves(sb, sb.racks.ai, dict, 1500)
const okAll = f.moves.every((mv) => E.checkMove(sb, 'ai', mv, dict).ok)
check(`AI lượt đầu: tìm được nhiều nước, nước nào cũng hợp lệ (${f.moves.length} nước, ${Date.now() - t1}ms)`, f.moves.length > 20 && okAll && !f.timedOut)
check('AI chỉ ghép từ chính là từ thông dụng', f.moves.every((mv) => { const r = E.checkMove(sb, 'ai', mv, dict); return E.wordKind(dict, r.words[0].w) === 2 }))
// tự chơi cả ván: 2 Bạn AI, luôn chọn nước nhiều điểm nhất
sb = E.newGame(['x', 'y'], 0)
let turns = 0, plays = 0, maxMs = 0, invalid = 0, words = []
while (!sb.over && turns < 200) {
  const p = sb.order[sb.turn]
  const t = Date.now(); const fm = E.findMoves(sb, sb.racks[p], dict, 2500); maxMs = Math.max(maxMs, Date.now() - t)
  let best = null
  for (const mv of fm.moves) { const r = E.checkMove(sb, p, mv, dict); if (!r.ok) { invalid++; continue } if (!best || r.score > best.score) best = r }
  if (best) { E.applyPlay(sb, p, best, turns); plays++; words.push(best.words[0].w) } else E.applyPass(sb, p, turns, 'pass')
  turns++
}
const placed = [...sb.board].filter((ch) => ch !== '.').length
console.log(`    tự chơi: ${turns} lượt, ${plays} lần đặt từ, ${placed} chữ trên bàn, túi còn ${sb.bag.length}, điểm ${JSON.stringify(sb.scores)}, lâu nhất ${maxMs}ms`)
console.log('    vài từ AI đặt: ' + words.slice(0, 18).join(', '))
check('AI tự chơi hết ván: không nước nào sai luật, ván kết thúc', invalid === 0 && sb.over === 1 && plays > 10, `invalid ${invalid} over ${sb.over} plays ${plays}`)
check('mọi chữ trên bàn tạo thành từ hợp lệ (đọc lại cả bàn)', (() => {
  const B = sb.board, ok = (w) => w.length < 2 || E.wordKind(dict, w) > 0
  for (let r = 0; r < 15; r++) for (const w of B.slice(r * 15, r * 15 + 15).split('.')) if (!ok(w)) return false
  for (let c = 0; c < 15; c++) { let col = ''; for (let r = 0; r < 15; r++) col += B[r * 15 + c]; for (const w of col.split('.')) if (!ok(w)) return false }
  return true
})())
check('Bạn AI tìm nước nhanh (lâu nhất dưới 2,5 giây)', maxMs < 2500, maxMs + 'ms')
console.log(Object.values(res).every(Boolean) ? `ALL PASS ✓ (${Object.keys(res).length} checks)` : 'FAILED: ' + Object.entries(res).filter(([, v]) => !v).map(([k]) => k).join(' | '))
