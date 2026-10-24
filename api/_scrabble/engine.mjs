// Ôn Tập: luật + chấm điểm + Bạn AI của trò SCRABBLE (chốt 24/10/2026 — "như ngoài đời").
//  - Bộ 100 quân: 98 chữ + 2 quân trắng (đủ số lượng và điểm như bộ Scrabble tiếng Anh thật).
//  - Bàn 15×15 với ô nhân điểm thật: ×3 cả từ, ×2 cả từ (★ giữa bàn), ×3 chữ, ×2 chữ.
//  - Mỗi người 7 chữ; đặt được từ nào thì từ đó hiện trên bàn và bốc thêm cho đủ 7.
//  - Bỏ lượt = trả cả giá chữ vào túi, bốc ngẫu nhiên lại (yêu cầu của anh).
//  - Điểm: điểm từng chữ × ô nhân, cộng cả các từ phụ ghép theo chiều kia; đặt hết 7 chữ một lượt +50.
// Không dùng gì ngoài Node — chạy được ở máy chủ Vercel và máy thử.
import crypto from "node:crypto";

export const N = 15, CENTER = 112, RACK = 7, BINGO = 50;
export const VALUES = { A: 1, B: 3, C: 3, D: 2, E: 1, F: 4, G: 2, H: 4, I: 1, J: 8, K: 5, L: 1, M: 3, N: 1, O: 1, P: 3, Q: 10, R: 1, S: 1, T: 1, U: 1, V: 4, W: 4, X: 8, Y: 4, Z: 10, "?": 0 };
const COUNTS = { A: 9, B: 2, C: 2, D: 4, E: 12, F: 2, G: 3, H: 2, I: 9, J: 1, K: 1, L: 4, M: 2, N: 6, O: 8, P: 2, Q: 1, R: 6, S: 4, T: 6, U: 4, V: 2, W: 2, X: 1, Y: 2, Z: 1, "?": 2 };
export const TILES = Object.entries(COUNTS).map(([l, n]) => l.repeat(n)).join("");   // 100 quân

// Ô nhân điểm (giống bàn thật). "TW" ×3 cả từ, "DW" ×2 cả từ, "TL" ×3 chữ, "DL" ×2 chữ.
export const PREMIUM = (() => {
  const P = new Array(225).fill("");
  const put = (t, list) => { for (const [r, c] of list) P[r * N + c] = t; };
  put("TW", [[0, 0], [0, 7], [0, 14], [7, 0], [7, 14], [14, 0], [14, 7], [14, 14]]);
  put("DW", [[1, 1], [2, 2], [3, 3], [4, 4], [1, 13], [2, 12], [3, 11], [4, 10], [13, 1], [12, 2], [11, 3], [10, 4], [13, 13], [12, 12], [11, 11], [10, 10], [7, 7]]);
  put("TL", [[1, 5], [1, 9], [5, 1], [5, 5], [5, 9], [5, 13], [9, 1], [9, 5], [9, 9], [9, 13], [13, 5], [13, 9]]);
  put("DL", [[0, 3], [0, 11], [2, 6], [2, 8], [3, 0], [3, 7], [3, 14], [6, 2], [6, 6], [6, 8], [6, 12], [7, 3], [7, 11], [8, 2], [8, 6], [8, 8], [8, 12], [11, 0], [11, 7], [11, 14], [12, 6], [12, 8], [14, 3], [14, 11]]);
  return P;
})();

// Ô trên bàn: "." trống; "A"–"Z" quân chữ thường; "a"–"z" quân trắng đã chọn làm chữ đó (0 điểm).
const cellValue = (ch) => (ch >= "a" && ch <= "z" ? 0 : VALUES[ch] || 0);
export const rackValue = (rack) => [...String(rack || "")].reduce((a, ch) => a + (VALUES[ch] || 0), 0);

function shuffleStr(s) {
  const a = [...s];
  for (let i = a.length - 1; i > 0; i--) { const j = crypto.randomInt(i + 1); [a[i], a[j]] = [a[j], a[i]]; }
  return a.join("");
}
function draw(sb, k) {
  const n = Math.max(0, Math.min(k, sb.bag.length));
  const take = sb.bag.slice(sb.bag.length - n);
  sb.bag = sb.bag.slice(0, sb.bag.length - n);
  return take;
}

/* ---------- Từ điển: một cây chữ (trie) cho cả "mọi từ" (con đặt) và "từ thông dụng" (Bạn AI dùng) ---------- */
let DICT = null;
export function buildDict(text) {
  const words = String(text).split("\n");
  let cap = 1;
  for (const w of words) cap += w.length;
  const letter = new Uint8Array(cap), term = new Uint8Array(cap), first = new Int32Array(cap).fill(-1), next = new Int32Array(cap).fill(-1), last = new Int32Array(cap).fill(-1);
  let n = 1, count = 0;
  const childOf = (node, l) => { for (let c = first[node]; c >= 0; c = next[c]) { if (letter[c] === l) return c; if (letter[c] > l) return -1; } return -1; };
  for (let raw of words) {
    let kind = 2;
    if (raw.charCodeAt(0) === 42) { kind = 1; raw = raw.slice(1); }   // "*" = từ ít gặp
    if (!/^[a-z]{2,15}$/.test(raw)) continue;
    let node = 0;
    for (let k = 0; k < raw.length; k++) {
      const l = raw.charCodeAt(k) - 97;
      const lc = last[node];
      if (lc >= 0 && letter[lc] === l) { node = lc; continue; }
      if (lc >= 0 && letter[lc] > l) {   // danh sách không theo thứ tự: tìm/chèn đúng chỗ (dự phòng)
        const found = childOf(node, l);
        if (found >= 0) { node = found; continue; }
        let prev = -1, c = first[node];
        while (c >= 0 && letter[c] < l) { prev = c; c = next[c]; }
        letter[n] = l; next[n] = c;
        if (prev < 0) first[node] = n; else next[prev] = n;
        node = n++;
        continue;
      }
      letter[n] = l;
      if (lc >= 0) next[lc] = n; else first[node] = n;
      last[node] = n;
      node = n++;
    }
    if (kind > term[node]) term[node] = kind;
    count++;
  }
  return { letter, term, first, next, nodes: n, count, childOf };
}
export async function getDict() {
  if (DICT) return DICT;
  const mod = await import("./words.mjs");
  DICT = buildDict(mod.default);
  return DICT;
}
// 0 = không phải từ, 1 = từ ít gặp, 2 = từ thông dụng
export function wordKind(dict, w) {
  let node = 0;
  const s = String(w).toLowerCase();
  for (let k = 0; k < s.length; k++) { node = dict.childOf(node, s.charCodeAt(k) - 97); if (node < 0) return 0; }
  return dict.term[node];
}

/* ---------- Ván mới ---------- */
export function newGame(order, now) {
  const sb = { v: 1, board: ".".repeat(225), bag: shuffleStr(TILES), racks: {}, order: order.slice(), turn: 0, turnStart: now, scores: {}, passes: 0, moves: [], words: {}, last: [], over: 0, reason: "", outBy: "" };
  for (const pid of order) { sb.racks[pid] = draw(sb, RACK); sb.scores[pid] = 0; sb.words[pid] = []; }
  return sb;
}

/* ---------- Kiểm tra một nước đi + tính điểm ----------
   tiles: [{ i: ô 0–224, l: chữ "A"–"Z", b: 1 nếu dùng quân trắng }] */
const bad = (error, msg) => ({ ok: false, error, msg });
export function checkMove(sb, pid, tiles, dict) {
  const board = sb.board;
  if (!Array.isArray(tiles) || tiles.length < 1 || tiles.length > RACK) return bad("tiles", "Con chưa đặt chữ nào lên bàn.");
  const seen = new Set(), place = [];
  for (const t of tiles) {
    const i = Number(t && t.i), l = String((t && t.l) || "").toUpperCase(), b = !!(t && t.b);
    if (!Number.isInteger(i) || i < 0 || i > 224 || seen.has(i) || !/^[A-Z]$/.test(l)) return bad("tiles", "Chữ đặt chưa hợp lệ.");
    if (board[i] !== ".") return bad("occupied", "Ô này đã có chữ rồi.");
    seen.add(i);
    place.push({ i, l, b: b ? 1 : 0, ch: b ? l.toLowerCase() : l });
  }
  const rack = [...String((sb.racks && sb.racks[pid]) || "")];
  for (const p of place) {
    const k = rack.indexOf(p.b ? "?" : p.l);
    if (k < 0) return bad("rack", "Con không có đủ các chữ này trên giá.");
    rack.splice(k, 1);
  }
  const rows = new Set(place.map((p) => Math.floor(p.i / N))), cols = new Set(place.map((p) => p.i % N));
  if (rows.size > 1 && cols.size > 1) return bad("line", "Các chữ phải nằm trên cùng một hàng ngang hoặc một cột dọc.");
  const tmp = board.split("");
  for (const p of place) tmp[p.i] = p.ch;
  const filled = (r, c) => r >= 0 && r < N && c >= 0 && c < N && tmp[r * N + c] !== ".";
  const isNew = new Set(place.map((p) => p.i));
  const empty = !/[^.]/.test(board);
  // hướng chính: hàng ngang nếu các chữ cùng hàng (hoặc 1 chữ có hàng xóm ngang), không thì cột dọc
  let dir;
  if (place.length > 1) dir = rows.size === 1 ? 0 : 1;
  else { const r = Math.floor(place[0].i / N), c = place[0].i % N; dir = filled(r, c - 1) || filled(r, c + 1) ? 0 : 1; }
  const step = dir === 0 ? [0, 1] : [1, 0];
  const rc = (i) => [Math.floor(i / N), i % N];
  // liền nhau: từ chữ đầu tới chữ cuối không có ô trống
  const idx = place.map((p) => p.i).sort((a, b) => a - b);
  const [r0, c0] = rc(idx[0]), [r1, c1] = rc(idx[idx.length - 1]);
  for (let r = r0, c = c0; r <= r1 && c <= c1; r += step[0], c += step[1]) if (!filled(r, c)) return bad("gap", "Các chữ phải liền nhau, không để ô trống ở giữa.");
  // từ (đọc theo một chiều) đi qua ô (r,c)
  const wordAt = (r, c, dr, dc) => {
    let sr = r, sc = c;
    while (filled(sr - dr, sc - dc)) { sr -= dr; sc -= dc; }
    const cells = [];
    for (let rr = sr, cc = sc; filled(rr, cc); rr += dr, cc += dc) cells.push(rr * N + cc);
    return cells;
  };
  const words = [];
  const main = wordAt(r0, c0, step[0], step[1]);
  if (main.length >= 2) words.push(main);
  for (const p of place) {
    const [r, c] = rc(p.i);
    const cross = wordAt(r, c, step[1], step[0]);
    if (cross.length >= 2) words.push(cross);
  }
  if (!words.length) return bad("short", "Phải ghép thành từ có ít nhất 2 chữ.");
  if (empty) {
    if (!isNew.has(CENTER)) return bad("center", "Lượt đầu tiên phải có một chữ đặt vào ô ★ ở giữa bàn.");
  } else {
    const touches = place.some((p) => { const [r, c] = rc(p.i); return [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]].some(([rr, cc]) => filled(rr, cc) && !isNew.has(rr * N + cc)); });
    if (!touches) return bad("connect", "Từ mới phải nối vào chữ đã có trên bàn.");
  }
  const wrong = [], out = [];
  let total = 0;
  for (const cells of words) {
    const w = cells.map((i) => tmp[i].toUpperCase()).join("");
    if (!wordKind(dict, w)) { if (!wrong.includes(w)) wrong.push(w); continue; }
    let sum = 0, mult = 1;
    for (const i of cells) {
      let v = cellValue(tmp[i]);
      if (isNew.has(i)) {
        const pm = PREMIUM[i];
        if (pm === "DL") v *= 2; else if (pm === "TL") v *= 3; else if (pm === "DW") mult *= 2; else if (pm === "TW") mult *= 3;
      }
      sum += v;
    }
    out.push({ w, s: sum * mult });
    total += sum * mult;
  }
  if (wrong.length) return bad("word", wrong.length === 1 ? `Từ “${wrong[0]}” không có trong từ điển.` : `Các từ ${wrong.map((w) => "“" + w + "”").join(", ")} không có trong từ điển.`);
  const bingo = place.length === RACK ? BINGO : 0;
  return { ok: true, place, words: out, score: total + bingo, bingo, rackLeft: rack.join("") };
}

/* ---------- Áp dụng nước đi / bỏ lượt / hết ván ---------- */
function nextTurn(sb, now) { sb.turn = (sb.turn + 1) % sb.order.length; sb.turnStart = now; }
function log(sb, m) { sb.moves.push(m); if (sb.moves.length > 40) sb.moves = sb.moves.slice(-40); }
export function applyPlay(sb, pid, res, now) {
  const b = sb.board.split("");
  for (const p of res.place) b[p.i] = p.ch;
  sb.board = b.join("");
  sb.racks[pid] = res.rackLeft + draw(sb, RACK - res.rackLeft.length);
  sb.scores[pid] = (sb.scores[pid] || 0) + res.score;
  (sb.words[pid] || (sb.words[pid] = [])).push(res.words[0].w);
  sb.passes = 0;
  log(sb, { p: pid, k: "play", w: res.words.map((x) => x.w), s: res.score, c: res.place.map((p) => p.i), t: now, ...(res.bingo ? { bingo: 1 } : {}) });
  sb.last = res.place.map((p) => p.i);
  sb.v++;
  if (!sb.bag.length && !sb.racks[pid].length) { sb.over = 1; sb.reason = "out"; sb.outBy = pid; }
  else nextTurn(sb, now);
}
// Bỏ lượt (con bấm, hết giờ lượt, hoặc vắng mặt): đổi cả giá chữ một cách ngẫu nhiên (khi túi còn chữ).
export function applyPass(sb, pid, now, kind) {
  const rack = sb.racks[pid] || "";
  let swapped = 0;
  if (sb.bag.length && rack.length) {
    sb.bag = shuffleStr(sb.bag + rack);
    sb.racks[pid] = draw(sb, rack.length);
    swapped = rack.length;
  }
  sb.passes = (sb.passes || 0) + 1;
  log(sb, { p: pid, k: kind || "pass", x: swapped, t: now });
  sb.last = [];
  sb.v++;
  if (sb.passes >= 2 * sb.order.length) { sb.over = 1; sb.reason = "passes"; }
  else nextTurn(sb, now);
}
// Điểm cuối ván. Hết chữ (túi đã cạn và một bạn đặt hết giá): bạn đó được cộng điểm các chữ còn trên giá của các bạn khác,
// các bạn khác bị trừ phần đó — đúng luật thật. Hết giờ, chủ phòng kết thúc, hoặc ai cũng bỏ lượt 2 lần liền: giữ nguyên điểm.
export function finalScores(sb, reason) {
  const out = {};
  for (const pid of sb.order) out[pid] = { base: sb.scores[pid] || 0, adj: 0, left: sb.racks[pid] || "" };
  if (reason === "out" && sb.outBy && out[sb.outBy]) {
    let sum = 0;
    for (const pid of sb.order) if (pid !== sb.outBy) { const v = rackValue(sb.racks[pid]); out[pid].adj = -v; sum += v; }
    out[sb.outBy].adj = sum;
  }
  for (const pid of sb.order) out[pid].total = Math.max(0, out[pid].base + out[pid].adj);
  return out;
}

/* ---------- Bạn AI tìm nước đi (thuật toán Appel–Jacobson: ô neo + kiểm tra chữ theo chiều kia) ----------
   Từ chính chỉ lấy từ THÔNG DỤNG (con đọc là hiểu); từ phụ theo chiều kia chỉ cần có trong từ điển. */
export function findMoves(sb, rackStr, dict, budgetMs) {
  const { letter, term, first, next, childOf } = dict;
  const board = sb.board, deadline = Date.now() + (budgetMs || 1500);
  const rack = new Int8Array(27);
  for (const ch of String(rackStr || "")) { if (ch === "?") rack[26]++; else if (/[A-Z]/.test(ch)) rack[ch.charCodeAt(0) - 65]++; }
  const filledAt = (i) => board[i] !== ".";
  const L = (ch) => ch.toUpperCase().charCodeAt(0) - 65;
  const empty = !/[^.]/.test(board);
  const anchor = new Uint8Array(225);
  if (empty) anchor[CENTER] = 1;
  else for (let i = 0; i < 225; i++) {
    if (filledAt(i)) continue;
    const r = Math.floor(i / N), c = i % N;
    if ((r > 0 && filledAt(i - N)) || (r < N - 1 && filledAt(i + N)) || (c > 0 && filledAt(i - 1)) || (c < N - 1 && filledAt(i + 1))) anchor[i] = 1;
  }
  const kindOf = (s) => { let node = 0; for (let k = 0; k < s.length; k++) { node = childOf(node, L(s[k])); if (node < 0) return 0; } return term[node]; };
  const ALL = (1 << 26) - 1;
  const found = new Map();
  let ops = 0, stop = false;
  const tick = () => { if ((++ops & 1023) === 0 && Date.now() > deadline) stop = true; return stop; };
  for (const dir of empty ? [0] : [0, 1]) {
    const at = dir === 0 ? (r, c) => r * N + c : (r, c) => c * N + r;
    const cross = new Int32Array(225).fill(ALL);
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
      const i = at(r, c);
      if (filledAt(i)) continue;
      let up = "", down = "";
      for (let k = r - 1; k >= 0 && filledAt(at(k, c)); k--) up = board[at(k, c)] + up;
      for (let k = r + 1; k < N && filledAt(at(k, c)); k++) down += board[at(k, c)];
      if (!up && !down) continue;
      let mask = 0;
      for (let l = 0; l < 26; l++) if (kindOf(up + String.fromCharCode(65 + l) + down)) mask |= 1 << l;
      cross[i] = mask;
    }
    const tiles = [];
    const record = () => {
      const key = tiles.map((t) => t.i + ":" + t.l + ":" + t.b).sort().join(",");
      if (!found.has(key)) found.set(key, tiles.map((t) => ({ i: t.i, l: String.fromCharCode(65 + t.l), b: t.b })));
    };
    const extend = (r, col, node, anchorCol) => {
      if (stop || tick()) return;
      if (col >= N) { if (col > anchorCol && term[node] === 2 && tiles.length) record(); return; }
      const i = at(r, col);
      if (filledAt(i)) { const nx = childOf(node, L(board[i])); if (nx >= 0) extend(r, col + 1, nx, anchorCol); return; }
      if (col > anchorCol && term[node] === 2 && tiles.length) record();
      const mask = cross[i];
      for (let ch = first[node]; ch >= 0; ch = next[ch]) {
        const l = letter[ch];
        if (!(mask & (1 << l))) continue;
        if (rack[l] > 0) { rack[l]--; tiles.push({ i, l, b: 0 }); extend(r, col + 1, ch, anchorCol); tiles.pop(); rack[l]++; }
        if (rack[26] > 0) { rack[26]--; tiles.push({ i, l, b: 1 }); extend(r, col + 1, ch, anchorCol); tiles.pop(); rack[26]++; }
      }
    };
    const leftPart = (r, anchorCol, node, limit, part) => {
      if (stop) return;
      // các chữ phần bên trái nằm ngay trước ô neo
      const k = part.length;
      for (let j = 0; j < k; j++) tiles.push({ i: at(r, anchorCol - k + j), l: part[j].l, b: part[j].b });
      extend(r, anchorCol, node, anchorCol);
      tiles.length -= k;
      if (limit <= 0) return;
      for (let ch = first[node]; ch >= 0; ch = next[ch]) {
        const l = letter[ch];
        if (rack[l] > 0) { rack[l]--; part.push({ l, b: 0 }); leftPart(r, anchorCol, ch, limit - 1, part); part.pop(); rack[l]++; }
        if (rack[26] > 0) { rack[26]--; part.push({ l, b: 1 }); leftPart(r, anchorCol, ch, limit - 1, part); part.pop(); rack[26]++; }
      }
    };
    const rackSize = rack.reduce((a, b) => a + b, 0);
    for (let r = 0; r < N && !stop; r++) {
      for (let c = 0; c < N && !stop; c++) {
        const i = at(r, c);
        if (filledAt(i) || !anchor[i]) continue;
        if (c > 0 && filledAt(at(r, c - 1))) {
          let s = c - 1;
          while (s > 0 && filledAt(at(r, s - 1))) s--;
          let node = 0;
          for (let k = s; k < c && node >= 0; k++) node = childOf(node, L(board[at(r, k)]));
          if (node >= 0) extend(r, c, node, c);
        } else {
          let limit = 0;
          for (let k = c - 1; k >= 0 && !filledAt(at(r, k)) && !anchor[at(r, k)]; k--) limit++;
          leftPart(r, c, 0, Math.min(limit, rackSize - 1), []);
        }
      }
    }
  }
  return { moves: [...found.values()], timedOut: stop };
}
