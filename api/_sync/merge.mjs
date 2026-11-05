// Ôn Tập (05/11/2026): GỘP DỮ LIỆU HỌC của MỘT con giữa các máy — máy chủ (/api/account, hành động "data") dùng.
// Mỗi máy gửi bản dữ liệu của mình; máy chủ gộp với bản đang lưu rồi trả bản gộp cho máy (src/lib/datasync.js).
// Nguyên tắc: không mất bài, không cộng trùng.
//  - Khái niệm (bản đồ kiến thức) và bộ từ Vở Spelling: theo id; giữ bản SỬA SAU (updatedAt lớn hơn). Mục bị xoá có
//    "dấu xoá" (dead: id -> lúc xoá); chỉ mục sửa SAU lúc xoá mới sống lại.
//  - Thời gian học + nhật ký từng ngày: mỗi máy giữ bộ đếm RIÊNG (dev[mã máy]) chỉ tăng; gộp lấy số lớn hơn của từng
//    máy; tổng = cộng các máy -> hai máy cùng học không bị cộng trùng, gửi lại nhiều lần không sao.
//  - Lịch ôn từng từ (Vở Spelling): giữ bản ôn gần nhất; điểm cao nhất: lấy số lớn hơn.
//  - "Xoá hết dữ liệu & làm lại từ đầu": resetAt (lúc xoá) — mọi thứ cũ hơn lúc đó bị bỏ ở mọi máy (trừ bộ từ mẫu).
//  - Cài đặt phụ huynh (tài liệu riêng "_settings"): bản đổi sau cùng.
// Hàm thuần (không đọc kho): gộp(a, b) cho cùng kết quả dù thứ tự a, b; gộp thêm lần nữa không đổi gì.

const BAD = new Set(["__proto__", "constructor", "prototype"]);
const FIELDS = ["reviewed", "correct", "wrong", "sec"];
const isObj = (x) => !!x && typeof x === "object" && !Array.isArray(x);
const num = (x) => { const n = Number(x); return Number.isFinite(n) ? n : 0; };
const int = (x, lo, hi) => Math.max(lo, Math.min(hi, Math.round(num(x))));
export const okId = (k) => typeof k === "string" && /^[A-Za-z0-9_.:-]{1,120}$/.test(k) && !BAD.has(k);
const okKey = (n) => (k) => typeof k === "string" && k.length >= 1 && k.length <= n && !BAD.has(k);
const okDay = (k) => typeof k === "string" && /^\d{4}-\d{2}-\d{2}$/.test(k);

// Chuỗi JSON với khoá sắp xếp: so bằng nhau / chọn bản thắng khi hoà giờ sửa (không phụ thuộc thứ tự khoá).
export function stable(x) {
  if (Array.isArray(x)) return "[" + x.map(stable).join(",") + "]";
  if (isObj(x)) return "{" + Object.keys(x).sort().filter((k) => x[k] !== undefined).map((k) => JSON.stringify(k) + ":" + stable(x[k])).join(",") + "}";
  return x === undefined ? "null" : JSON.stringify(x);
}

// Bản đồ đã lọc: chỉ khoá hợp lệ, giá trị qua hàm làm sạch (null -> bỏ), tối đa cap mục.
function mapOf(m, okK, cleanV, cap) {
  const out = {};
  if (!isObj(m)) return out;
  let n = 0;
  for (const k of Object.keys(m)) {
    if (n >= cap) break;
    if (!okK(k)) continue;
    const v = cleanV(m[k]);
    if (v == null) continue;
    out[k] = v; n++;
  }
  return out;
}
const objOrNull = (v) => (isObj(v) ? v : null);
function deadOf(m) {
  const ent = Object.entries(mapOf(m, okId, (v) => (num(v) > 0 ? num(v) : null), 50000)).sort((p, q) => q[1] - p[1] || (p[0] < q[0] ? -1 : 1)).slice(0, 5000);
  const out = {};
  for (const [k, v] of ent) out[k] = v;
  return out;
}
const cleanLog = (v) => (isObj(v) ? { reviewed: int(v.reviewed, 0, 1e6), correct: int(v.correct, 0, 1e6), wrong: int(v.wrong, 0, 1e6), sec: int(v.sec, 0, 1e7) } : null);
const cleanDev = (e) => (isObj(e)
  ? { e: Math.max(0, num(e.e)), days: mapOf(e.days, okDay, (v) => int(v, 0, 1e7), 5000), log: mapOf(e.log, okDay, (d) => objOrNull(d) && mapOf(d, okKey(60), cleanLog, 60), 5000) }
  : null);
const cleanSetStats = (st) => (isObj(st)
  ? { words: mapOf(st.words, okKey(120), objOrNull, 20000), best: mapOf(st.best, okKey(40), (v) => (Number.isFinite(Number(v)) ? Number(v) : null), 100), updatedAt: Math.max(0, num(st.updatedAt)) }
  : null);
function cleanSpell(s) {
  if (!isObj(s)) return null;
  return { sets: mapOf(s.sets, okId, objOrNull, 2000), stats: mapOf(s.stats, okId, cleanSetStats, 2000), dead: deadOf(s.dead) };
}

// Làm sạch tài liệu máy gửi lên (máy cũ / máy lỗi gửi thiếu, sai kiểu cũng không làm hỏng bản trên máy chủ).
export function cleanDoc(d) {
  d = isObj(d) ? d : {};
  const mem = isObj(d.mem) ? d.mem : {};
  const out = {
    v: 1,
    resetAt: Math.max(0, num(d.resetAt)),
    mem: { items: mapOf(mem.items, okId, objOrNull, 10000), dead: deadOf(mem.dead) },
    recent: Array.isArray(d.recent) ? [...new Set(d.recent.filter((s) => typeof s === "string" && s && s.length <= 500))].slice(0, 80) : [],
    goal: isObj(d.goal) && num(d.goal.v) >= 1 ? { v: int(d.goal.v, 1, 600), at: Math.max(0, num(d.goal.at)) } : null,
    dev: mapOf(d.dev, okId, cleanDev, 100),
    spell: cleanSpell(d.spell),
  };
  if (isObj(d.settings) && isObj(d.settings.v)) out.settings = { v: d.settings.v, at: Math.max(0, num(d.settings.at)) };
  return out;
}

const clockOf = (it) => num(it && it.updatedAt);
function pickNewer(x, y, clock) {
  const cx = clock(x), cy = clock(y);
  if (cx !== cy) return cx > cy ? x : y;
  return stable(x) >= stable(y) ? x : y;   // hoà giờ sửa: chọn cố định (máy nào gộp cũng ra cùng một bản)
}
// Gộp danh sách theo id + dấu xoá: sống nếu sửa SAU lúc xoá; cũ hơn lúc "xoá hết dữ liệu" thì bỏ (trừ mục được miễn).
function mergeLww(A, B, resetAt, exempt) {
  const dead = {};
  for (const m of [A.dead, B.dead]) for (const k of Object.keys(m)) dead[k] = Math.max(dead[k] || 0, m[k]);
  const items = {};
  for (const id of [...new Set([...Object.keys(A.items), ...Object.keys(B.items)])].sort()) {
    const x = A.items[id], y = B.items[id];
    const w = !x ? y : !y ? x : pickNewer(x, y, clockOf);
    const c = clockOf(w);
    if (dead[id] != null && dead[id] >= c) continue;
    if (resetAt && c < resetAt && !exempt(w)) continue;
    items[id] = w;
  }
  // dấu xoá chỉ giữ cho id đã không còn (đỡ phình), tối đa 5000 dấu mới nhất
  const out = {};
  for (const [k, v] of Object.entries(dead).filter(([k]) => !items[k]).sort((p, q) => q[1] - p[1] || (p[0] < q[0] ? -1 : 1)).slice(0, 5000)) out[k] = v;
  return { items, dead: out };
}
const maxMap = (a, b) => { const o = { ...a }; for (const k of Object.keys(b)) o[k] = Math.max(num(o[k]), num(b[k])); return o; };
function maxLog(a, b) {
  const o = {};
  for (const d of [...new Set([...Object.keys(a), ...Object.keys(b)])].sort()) {
    const x = a[d] || {}, y = b[d] || {}, day = {};
    for (const s of [...new Set([...Object.keys(x), ...Object.keys(y)])].sort()) {
      const p = x[s] || {}, q = y[s] || {}, e = {};
      for (const f of FIELDS) e[f] = Math.max(num(p[f]), num(q[f]));
      day[s] = e;
    }
    o[d] = day;
  }
  return o;
}
function mergeDev(A, B, resetAt) {
  const out = {};
  for (const id of [...new Set([...Object.keys(A), ...Object.keys(B)])].sort()) {
    const c = [A[id], B[id]].filter((e) => e && e.e >= resetAt);
    if (!c.length) continue;
    if (c.length === 1) { out[id] = c[0]; continue; }
    const [x, y] = c;
    if (x.e !== y.e) { out[id] = x.e > y.e ? x : y; continue; }   // máy đã bắt đầu lại sau lần "xoá hết": dùng bản mới
    out[id] = { e: x.e, days: maxMap(x.days, y.days), log: maxLog(x.log, y.log) };
  }
  return out;
}
// Lịch ôn một từ: bản ôn gần nhất (l = ngày ôn), rồi bản có lịch sử dài hơn.
function pickWord(p, q) {
  if (num(p.l) !== num(q.l)) return num(p.l) > num(q.l) ? p : q;
  const hp = String(p.h || "").length, hq = String(q.h || "").length;
  if (hp !== hq) return hp > hq ? p : q;
  return stable(p) >= stable(q) ? p : q;
}
function mergeSetStats(x, y) {
  const words = {};
  for (const k of [...new Set([...Object.keys(x.words), ...Object.keys(y.words)])].sort()) {
    const p = x.words[k], q = y.words[k];
    words[k] = !p ? q : !q ? p : pickWord(p, q);
  }
  const best = {};
  for (const k of [...new Set([...Object.keys(x.best), ...Object.keys(y.best)])].sort()) {
    const p = x.best[k], q = y.best[k];
    best[k] = p == null ? q : q == null ? p : Math.max(p, q);
  }
  return { words, best, updatedAt: Math.max(x.updatedAt, y.updatedAt) };
}
function mergeSpell(A, B, resetAt) {
  if (!A && !B) return null;
  const e = { sets: {}, stats: {}, dead: {} };
  const a = A || e, b = B || e;
  const sets = mergeLww({ items: a.sets, dead: a.dead }, { items: b.sets, dead: b.dead }, resetAt, (it) => !!(it && it.example));
  const stats = {};
  for (const id of [...new Set([...Object.keys(a.stats), ...Object.keys(b.stats)])].sort()) {
    if (!sets.items[id]) continue;
    const x = a.stats[id], y = b.stats[id];
    const m = !x ? y : !y ? x : mergeSetStats(x, y);
    if (resetAt && m.updatedAt < resetAt) continue;   // tiến độ cũ hơn lúc "xoá hết dữ liệu"
    stats[id] = m;
  }
  return { sets: sets.items, stats, dead: sets.dead };
}
function pickGoal(x, y, resetAt) {
  const c = [x, y].filter((g) => g && (!resetAt || g.at >= resetAt));
  if (!c.length) return null;
  if (c.length === 1) return c[0];
  if (c[0].at !== c[1].at) return c[0].at > c[1].at ? c[0] : c[1];
  return c[0].v >= c[1].v ? c[0] : c[1];
}
function pickSettings(x, y) {
  if (!x || !y) return x || y || null;
  if (x.at !== y.at) return x.at > y.at ? x : y;
  return stable(x) >= stable(y) ? x : y;
}
// Câu hỏi đã gặp gần đây (để không lặp lại): bản máy vừa gửi trước (mới hơn), rồi bản cũ; tối đa 80 câu.
function mergeRecent(stored, incoming) {
  if (stored.resetAt !== incoming.resetAt) return stored.resetAt > incoming.resetAt ? stored.recent : incoming.recent;
  return [...new Set([...incoming.recent, ...stored.recent])].slice(0, 80);
}

// GỘP: stored = bản đang lưu trên máy chủ, incoming = bản máy vừa gửi. Trả bản đã làm sạch + gộp.
export function mergeDocs(stored, incoming) {
  const a = cleanDoc(stored), b = cleanDoc(incoming);
  const resetAt = Math.max(a.resetAt, b.resetAt);
  const out = {
    v: 1,
    resetAt,
    mem: mergeLww(a.mem, b.mem, resetAt, () => false),
    recent: mergeRecent(a, b),
    goal: pickGoal(a.goal, b.goal, resetAt),
    dev: mergeDev(a.dev, b.dev, resetAt),
    spell: mergeSpell(a.spell, b.spell, resetAt),
  };
  if (a.settings || b.settings) out.settings = pickSettings(a.settings, b.settings);
  return out;
}

// Tổng thời gian học / nhật ký của mọi máy (máy dùng để hiện báo cáo).
export function totalsOf(doc) {
  const days = {}, log = {};
  for (const e of Object.values((doc && doc.dev) || {})) {
    for (const [d, v] of Object.entries(e.days || {})) days[d] = num(days[d]) + num(v);
    for (const [d, subj] of Object.entries(e.log || {})) {
      const day = log[d] || (log[d] = {});
      for (const [s, v] of Object.entries(subj || {})) {
        const t = day[s] || (day[s] = { reviewed: 0, correct: 0, wrong: 0, sec: 0 });
        for (const f of FIELDS) t[f] += num(v && v[f]);
      }
    }
  }
  return { days, log };
}
