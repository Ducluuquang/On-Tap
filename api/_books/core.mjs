// Ôn Tập: THƯ VIỆN SÁCH GIÁO KHOA DÙNG CHUNG (anh duyệt 08–09/11/2026).
// Quản trị nạp sách PDF (ảnh chụp trang) -> máy chủ nhờ AI chép chữ (api/books.mjs) -> CHỈ lưu CHỮ của sách (nén) ở kho.
// Khi soạn câu hỏi (api/ai.mjs, mọi tài khoản): tìm đoạn sách đúng LỚP + MÔN của con, khớp chữ với chủ đề / khái niệm,
// đưa cho AI tham khảo (tối đa ~3.500 ký tự). Không có sách khớp -> soạn như cũ. Người dùng không thấy nguyên văn sách.
//
// Khoá trong kho (chung cho mọi tài khoản):
//   book:idx        HASH  id -> thông tin sách (JSON: tên, lớp, môn, loại, số trang, trạng thái, tiến độ)
//   book:j:<id>     JSON  việc đang đọc (các lượt gửi AI, nửa trang đã xong / đang đọc / số lần thử) — xoá khi đọc xong
//   book:h:<id>     HASH  chữ từng nửa trang ("p12h1") trong lúc đọc — xoá khi đọc xong
//   book:t:<id>     chữ cả cuốn, nén gzip ("gz:" + base64) — dùng khi soạn câu hỏi
//   book:lk:<id>    khoá ngắn khi đang cập nhật một cuốn
import zlib from "node:zlib";
import { redis, redisEnv } from "../_store.mjs";

export const BK = {
  idx: "book:idx",
  job: (id) => "book:j:" + id,
  half: (id) => "book:h:" + id,
  text: (id) => "book:t:" + id,
  lock: (id) => "book:lk:" + id,
};
export const KINDS = { sgk: "SGK", sbt: "SBT", sgv: "SGV" };
export const KIND_ORDER = { sgk: 0, sbt: 1, sgv: 2 };

export const pack = (obj) => "gz:" + zlib.gzipSync(Buffer.from(JSON.stringify(obj), "utf8")).toString("base64");
export function unpack(raw) {
  if (!raw) return null;
  try { return String(raw).startsWith("gz:") ? JSON.parse(zlib.gunzipSync(Buffer.from(String(raw).slice(3), "base64")).toString("utf8")) : JSON.parse(raw); }
  catch { return null; }
}

// Bỏ dấu + thường hoá (đ -> d) để so chữ không phụ thuộc dấu.
export const fold = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d");

// "Lớp 7", "7", "lop 10" -> 7; "4-5" / "" -> 0 (không rõ lớp).
export function gradeNum(g) {
  if (typeof g === "number") return g >= 1 && g <= 12 ? Math.round(g) : 0;
  const s = fold(g).trim();
  const m = /^(?:lop|grade|class)?\s*(\d{1,2})$/.exec(s);
  const n = m ? Number(m[1]) : 0;
  return n >= 1 && n <= 12 ? n : 0;
}

// Nhóm môn để ghép sách với bài của con. Tiếng Việt (tiểu học) và Ngữ văn (THCS/THPT) chung một nhóm "van":
// bài con ghi "Tiếng Việt" mà con học lớp 7 thì vẫn dùng sách Ngữ văn 7 (sách khớp theo LỚP nên không lẫn cấp).
export function subjGroup(subject) {
  const n = fold(subject).replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
  if (!n) return "";
  if (/(^| )(ngu van|tieng viet|van hoc|chinh ta|tap doc|luyen tu va cau|tap lam van)( |$)/.test(n) || n === "van") return "van";
  if (/(^| )(toan|math|mathematics|so hoc|hinh hoc|dai so)( |$)/.test(n)) return "toan";
  if (/tieng anh|english|anh van|anh ngu/.test(n)) return "tieng-anh";
  if (/lich su va dia li|lich su va dia ly|lich su dia l/.test(n)) return "ls-dl";
  return n.replace(/ /g, "-");
}

/* ---------- Chữ của sách -> các đoạn (theo tiêu đề) ---------- */
// Một nửa trang AI chép -> bỏ dòng "[Trống]", lấy số trang in ("[Trang in: 12]").
export function cleanHalf(text) {
  let printed = "";
  const lines = [];
  for (const raw of String(text || "").split(/\r?\n/)) {
    const line = raw.replace(/\s+$/, "");
    const m = /^\s*\[Trang in:\s*([^\]]{1,12})\]\s*$/i.exec(line);
    if (m) { printed = m[1].trim(); continue; }
    if (/^\s*\[Trống\]\s*$/i.test(line)) continue;
    lines.push(line);
  }
  return { printed, text: lines.join("\n").replace(/\n{3,}/g, "\n\n").trim() };
}
// Các nửa trang -> danh sách trang { n (trang PDF), printed (số in), text }.
export function assemblePages(halves, pages) {
  const out = [];
  for (let n = 1; n <= pages; n++) {
    const a = cleanHalf(halves["p" + n + "h1"]), b = cleanHalf(halves["p" + n + "h2"]);
    const text = [a.text, b.text].filter(Boolean).join("\n");
    if (text) out.push({ n, printed: b.printed || a.printed || "", text });
  }
  return out;
}

const CHUNK_MAX = 1400;
// Chia sách thành đoạn: mỗi tiêu đề ("# ...") mở đoạn mới; đoạn dài thì cắt theo đoạn văn, mang theo tiêu đề gần nhất.
export function chunkBook(book) {
  const chunks = [];
  let head = "", buf = [], len = 0, p0 = null, p1 = null;
  const flush = () => {
    const body = buf.join("\n").trim();
    if (body.length > 40) chunks.push({ head, text: body, p0, p1 });
    buf = []; len = 0; p0 = null; p1 = null;
  };
  for (const pg of book.pages || []) {
    const label = pg.printed || String(pg.n);
    for (const line of String(pg.text || "").split("\n")) {
      const h = /^#{1,4}\s+(.+)$/.exec(line.trim());
      if (h) { flush(); head = h[1].trim().slice(0, 160); }
      if (len + line.length > CHUNK_MAX && len > 300) flush();
      if (p0 == null) p0 = label;
      p1 = label;
      buf.push(line); len += line.length + 1;
    }
  }
  flush();
  return chunks;
}

/* ---------- Chấm điểm khớp chữ ---------- */
const STOP = new Set(("va cua la cac nhung mot co trong cho voi de duoc khong nay do thi ma nhu khi ve tu ra o bai hoc on tap "
  + "em con ban hay cau sau tren duoi theo cung da se dang rat nhieu it hon nua lai vao len xuong gi nao ai dau sao the "
  + "phan chu de luyen kien thuc tieng viet ngu van lop sach").split(" "));
const words = (s) => fold(s).replace(/[^a-z0-9]+/g, " ").trim().split(" ").filter(Boolean);
// Từ khoá của lần soạn: chủ đề, tên khái niệm, ý nhỏ. Trả { uni: Map(từ -> trọng số), bi: Map(cặp từ -> trọng số) }.
export function queryTerms({ topic = "", concepts = [] } = {}) {
  const uni = new Map(), bi = new Map();
  const add = (text, w) => {
    const ws = words(text);
    for (const x of ws) if (x.length >= 2 && !STOP.has(x) && !/^\d+$/.test(x)) uni.set(x, Math.max(uni.get(x) || 0, w));
    for (let i = 0; i + 1 < ws.length; i++) {
      const k = ws[i] + " " + ws[i + 1];
      if (STOP.has(ws[i]) && STOP.has(ws[i + 1])) continue;
      bi.set(k, Math.max(bi.get(k) || 0, w * 2));
    }
  };
  add(topic, 1);
  for (const c of concepts || []) {
    if (typeof c === "string") { add(c, 1.5); continue; }
    if (!c || typeof c !== "object") continue;
    add(c.name, 1.5);
    for (const d of Array.isArray(c.details) ? c.details.slice(0, 20) : []) add(String(d || "").slice(0, 90), 1);
  }
  return { uni, bi };
}
export function scoreChunk(chunk, q) {
  if (!chunk._w) {
    const ws = words(chunk.text), hw = words(chunk.head);
    chunk._w = new Set(ws); chunk._h = new Set(hw);
    const b = new Set();
    for (let i = 0; i + 1 < ws.length; i++) b.add(ws[i] + " " + ws[i + 1]);
    for (let i = 0; i + 1 < hw.length; i++) b.add(hw[i] + " " + hw[i + 1]);
    chunk._b = b;
    const hb = new Set();
    for (let i = 0; i + 1 < hw.length; i++) hb.add(hw[i] + " " + hw[i + 1]);
    chunk._hb = hb;
  }
  let s = 0, hits = 0, bhits = 0;
  for (const [w, wt] of q.uni) if (chunk._w.has(w) || chunk._h.has(w)) { s += wt * (chunk._h.has(w) ? 2 : 1); hits++; }
  for (const [b, wt] of q.bi) if (chunk._b.has(b)) { s += wt * (chunk._hb.has(b) ? 2 : 1); bhits++; }
  return { s, hits, bhits };
}

// Nguồn ngắn: "SGK Ngữ văn 7 tập 1, tr. 12–13"
export function sourceLabel(book, chunk) {
  const tr = chunk.p0 && chunk.p1 && chunk.p0 !== chunk.p1 ? chunk.p0 + "–" + chunk.p1 : chunk.p0 || "";
  return (KINDS[book.kind] || "Sách") + " " + book.title + (tr ? ", tr. " + tr : "");
}

// Chọn đoạn sách cho một lần soạn câu hỏi. books: [{ meta, chunks }]. Trả chuỗi (rỗng nếu không có đoạn nào đủ khớp).
// Ưu tiên SGK, rồi SBT (bài tập + gợi ý làm bài), rồi SGV (gợi ý trả lời). Tối đa `max` ký tự.
export function pickExcerpt(books, query, max = 3500) {
  const q = queryTerms(query);
  if (!q.uni.size && !q.bi.size) return "";
  const cands = [];
  for (const b of books) {
    for (const c of b.chunks) {
      const r = scoreChunk(c, q);
      // đủ khớp: ít nhất một cặp từ (vd "tu lay", "trang ngu") hoặc 3 từ khác nhau
      if (!(r.bhits >= 1 || r.hits >= 3)) continue;
      cands.push({ b, c, s: r.s * (1 - 0.12 * (KIND_ORDER[b.meta.kind] || 0)) });
    }
  }
  if (!cands.length) return "";
  cands.sort((x, y) => y.s - x.s);
  const best = cands[0].s;
  const chosen = [];
  let used = 0;
  for (const x of cands) {
    if (x.s < best * 0.35) break;
    const label = sourceLabel(x.b.meta, x.c);
    const room = max - used - label.length - 8;
    if (room < 200) break;
    const body = (x.c.head && !x.c.text.includes(x.c.head) ? "# " + x.c.head + "\n" : "") + x.c.text;
    const t = body.length > room ? body.slice(0, room).replace(/\s+\S*$/, "") + " …" : body;
    chosen.push({ kind: KIND_ORDER[x.b.meta.kind] || 0, order: chosen.length, s: "[" + label + "]\n" + t });
    used += label.length + 4 + t.length;
    if (chosen.length >= 6) break;
  }
  chosen.sort((a, b) => a.kind - b.kind || a.order - b.order);
  return chosen.map((x) => x.s).join("\n\n");
}

/* ---------- Nạp sách đúng lớp + môn khi soạn câu hỏi (nhớ đệm trong hàm máy chủ) ---------- */
const IDX_TTL = Number(process.env.BOOK_IDX_TTL_MS) || 120000;   // danh sách sách nhớ 2 phút
const CACHE_MAX = 40000000;       // chữ sách nhớ tối đa ~40 MB mỗi lần chạy hàm
let idxCache = null;              // { at, list }
const textCache = new Map();      // id -> { upd, size, chunks, meta }
let cacheSize = 0;
export function resetBookCache() { idxCache = null; textCache.clear(); cacheSize = 0; }

export async function readIndex() {
  const [raw] = await redis([["HGETALL", BK.idx]]);
  const list = [];
  if (Array.isArray(raw)) for (let i = 0; i + 1 < raw.length; i += 2) { try { list.push(JSON.parse(raw[i + 1])); } catch { /* bỏ qua */ } }
  else if (raw && typeof raw === "object") for (const v of Object.values(raw)) { try { list.push(JSON.parse(v)); } catch { /* bỏ qua */ } }
  return list;
}

async function loadBooksFor(grade, group) {
  if (!idxCache || Date.now() - idxCache.at > IDX_TTL) idxCache = { at: Date.now(), list: await readIndex() };
  const metas = idxCache.list.filter((m) => m && m.status === "ready" && m.approved !== false && m.grade === grade && subjGroup(m.subject) === group);   // chỉ sách đã duyệt (18/11/2026)
  const out = [];
  for (const m of metas) {
    let c = textCache.get(m.id);
    if (!c || c.upd !== m.updated) {
      const [raw] = await redis([["GET", BK.text(m.id)]]);
      const book = unpack(raw);
      if (!book) continue;
      const chunks = chunkBook(book);
      if (c) cacheSize -= c.size;
      c = { upd: m.updated, size: String(raw).length, chunks };
      textCache.set(m.id, c); cacheSize += c.size;
      while (cacheSize > CACHE_MAX && textCache.size > 1) {
        const [k, v] = textCache.entries().next().value;
        if (k === m.id) break;
        textCache.delete(k); cacheSize -= v.size;
      }
    }
    out.push({ meta: m, chunks: c.chunks });
  }
  return out;
}

// Đoạn sách tham khảo cho một lần soạn câu hỏi. Lỗi kho / chưa gắn kho / không có sách -> "" (soạn như cũ).
export async function bookContext({ subject = "", grade = "", topic = "", concepts = [] } = {}) {
  const g = gradeNum(grade), group = subjGroup(subject);
  if (!g || !group || !redisEnv()) return "";
  try {
    const books = await loadBooksFor(g, group);
    if (!books.length) return "";
    return pickExcerpt(books, { topic, concepts });
  } catch (e) {
    console.error("book context", e && e.message);
    return "";
  }
}
