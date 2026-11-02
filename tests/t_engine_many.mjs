// Tự chơi nhiều ván (2–4 Bạn AI) để soát lỗi hiếm: mọi nước hợp lệ, bàn luôn đúng từ, bộ quân không mất/không thừa.
import * as E from '../api/_scrabble/engine.mjs'
const dict = await E.getDict()
let games = 0, bad = 0, maxMs = 0, totalTurns = 0, bingos = 0, blanksUsed = 0, reasons = {}
const boardOk = (B) => { const ok = (w) => w.length < 2 || E.wordKind(dict, w) > 0; for (let r = 0; r < 15; r++) for (const w of B.slice(r * 15, r * 15 + 15).split('.')) if (!ok(w)) return false; for (let c = 0; c < 15; c++) { let col = ''; for (let r = 0; r < 15; r++) col += B[r * 15 + c]; for (const w of col.split('.')) if (!ok(w)) return false } return true }
const tileCount = (sb) => { const all = sb.bag + Object.values(sb.racks).join('') + [...sb.board].filter((c) => c !== '.').map((c) => (c >= 'a' && c <= 'z' ? '?' : c)).join(''); return [...all].sort().join('') }
const FULL = [...E.TILES].sort().join('')
for (let gi = 0; gi < 24; gi++) {
  const n = 2 + (gi % 3), order = Array.from({ length: n }, (_, k) => 'p' + k)
  const sb = E.newGame(order, 0)
  let turns = 0
  while (!sb.over && turns < 300) {
    const p = sb.order[sb.turn]
    const t = Date.now(); const fm = E.findMoves(sb, sb.racks[p], dict, 2500); maxMs = Math.max(maxMs, Date.now() - t)
    let best = null
    for (const mv of fm.moves) { const r = E.checkMove(sb, p, mv, dict); if (!r.ok) { bad++; continue } if (!best || r.score > best.score) best = r }
    if (best) { if (best.bingo) bingos++; blanksUsed += best.place.filter((x) => x.b).length; E.applyPlay(sb, p, best, turns) } else E.applyPass(sb, p, turns, 'pass')
    if (tileCount(sb) !== FULL) { bad++; console.log('tile count mismatch at game', gi, 'turn', turns); break }
    turns++
  }
  if (!boardOk(sb.board)) { bad++; console.log('bad board in game', gi) }
  reasons[sb.reason] = (reasons[sb.reason] || 0) + 1
  totalTurns += turns; games++
}
console.log(JSON.stringify({ games, totalTurns, bad, maxMs, bingos, blanksUsed, reasons }))
console.log(bad === 0 ? 'ALL PASS ✓ (24 ván tự chơi, bộ quân luôn đủ 100, bàn luôn đúng từ)' : 'FAILED')
