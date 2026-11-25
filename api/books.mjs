// Ôn Tập: NẠP SÁCH VÀO THƯ VIỆN CHUNG — chỉ QUẢN TRỊ (anh duyệt 08–09/11/2026).
// Quản trị = tài khoản có số điện thoại trong biến Vercel ADMIN_PHONES (api/_admin.mjs). Chưa có biến -> không ai nạp được.
// Từ 17/11/2026 màn nạp sách nằm ở trang quản trị riêng /quan-tri (không còn trong Cài đặt của phụ huynh).
// Sách PDF là ẢNH chụp trang: trình duyệt (pdf.js) vẽ từng trang, cắt đôi tại hàng ít mực nhất, gửi JPEG lên theo nhóm nhỏ
// (< 4 MB mỗi yêu cầu vì Vercel giới hạn 4,5 MB). Máy chủ gửi mỗi nhóm thành MỘT Message Batch (nửa giá) cho AI chép chữ
// (sonnet mới nhất, tắt thinking như api/aiCore.mjs). Ảnh KHÔNG lưu ở kho. Đóng app được: mở lại Cài đặt thì "list" hỏi
// tiến độ, batch xong thì tải kết quả, lưu chữ từng nửa trang; nửa trang lỗi / bị cắt (hết max_tokens) thì app gửi lại ảnh
// để đọc lại (tối đa 3 lần). Đủ trang -> gộp chữ cả cuốn, nén, lưu book:t:<id> (xem api/_books/core.mjs).
// Lệnh kho: "list" khi không có gì mới chỉ tốn 1 lệnh + 1 lệnh mỗi cuốn đang đọc; mỗi nhóm ảnh gửi lên ~6 lệnh.
import crypto from "node:crypto";
import { redis, redisEnv, send, readBody, clean, parse } from "./_store.mjs";
import { adminPhones, userOf, roleOf } from "./_admin.mjs";
import { newChange, putChange, pendingOf } from "./_changes.mjs";
export { adminPhones };
import { BK, KINDS, KIND_ORDER, pack, unpack, assemblePages, readIndex, gradeNum } from "./_books/core.mjs";
import { pickModel, thinkingFor } from "./aiCore.mjs";
import { newCtx, recordCost } from "./_aicost.mjs";

const API = "https://api.anthropic.com/v1/messages/batches";
const H = (key) => ({ "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" });
const BODY_MAX = 4400000;          // Vercel nhận tối đa 4,5 MB mỗi yêu cầu
const ITEMS_MAX = 24;              // tối đa 24 nửa trang mỗi lần gửi
const IMG_MAX = 1500000;           // mỗi ảnh tối đa 1,5 MB
const PIX_MAX = 1200000;           // mỗi ảnh tối đa ~1,2 MP (trình duyệt cắt ≤ 1,15 MP)
const PAGES_MAX = 1200;            // mỗi cuốn tối đa 1.200 trang
const BOOKS_MAX = 3000;
const TRIES_MAX = 3;               // mỗi nửa trang đọc tối đa 3 lần
const TOK = [4096, 8192, 12000];   // max_tokens theo lần đọc (bị cắt thì lần sau cho dài hơn)
const POLL_MAX = 12;               // mỗi lần hỏi tiến độ xem tối đa 12 batch mỗi cuốn
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const UNLOCK = "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end";


// Lời nhắc chép chữ (anh duyệt).
export function ocrPrompt(title, page, half) {
  return `Đây là ${half === 1 ? "nửa trên" : "nửa dưới"} của trang ${page} trong sách ${title}. Chép lại CHÍNH XÁC toàn bộ chữ: đúng từng chữ, đúng dấu tiếng Việt, giữ xuống dòng của thơ; không sửa, không tóm tắt; bỏ chữ in chìm mờ 'KẾT NỐI TRI THỨC VỚI CUỘC SỐNG'; tiêu đề viết '# '; ô bên lề mở đầu '[Lề] '; chú thích '[Chú thích] '; tranh '[Hình: …]'; bảng dạng Markdown; số trang in ở dòng cuối '[Trang in: số]'; ảnh không chữ trả '[Trống]'.`;
}

// Kích thước ảnh JPEG (đọc đầu khung SOF). Không phải JPEG -> null.
export function jpegSize(buf) {
  if (!buf || buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8) return null;
  let i = 2;
  while (i + 9 < buf.length) {
    if (buf[i] !== 0xff) { i++; continue; }
    const m = buf[i + 1];
    if (m === 0xd8 || m === 0x01 || (m >= 0xd0 && m <= 0xd7)) { i += 2; continue; }
    const len = buf.readUInt16BE(i + 2);
    if ((m >= 0xc0 && m <= 0xc3) || (m >= 0xc5 && m <= 0xc7) || (m >= 0xc9 && m <= 0xcb) || (m >= 0xcd && m <= 0xcf)) {
      return { h: buf.readUInt16BE(i + 5), w: buf.readUInt16BE(i + 7) };
    }
    i += 2 + len;
  }
  return null;
}

const cid = (p, h) => "p" + p + "h" + h;
const parseCid = (c) => { const m = /^p(\d{1,4})h([12])$/.exec(String(c || "")); return m ? { page: Number(m[1]), half: Number(m[2]) } : null; };
const newJob = () => ({ v: 1, sent: {}, done: {}, tries: {}, cut: {}, failed: {}, batches: {} });
function progress(meta, job) {
  const total = meta.pages * 2;
  if (meta.status === "ready" || !job) return { total, done: total - (meta.failed || 0), failed: meta.failed || 0, inflight: 0, missing: [] };
  const missing = [];
  for (let p = 1; p <= meta.pages; p++) for (let h = 1; h <= 2; h++) {
    const c = cid(p, h);
    if (!job.done[c] && !job.failed[c] && !job.sent[c]) missing.push(c);
  }
  return { total, done: Object.keys(job.done).length, failed: Object.keys(job.failed).length, inflight: Object.keys(job.sent).length, missing };
}
const pubMeta = (m, job) => ({ id: m.id, title: m.title, grade: m.grade, subject: m.subject, kind: m.kind, pages: m.pages, file: m.file || "",
  status: m.status, created: m.created, updated: m.updated, chars: m.chars || 0, progress: progress(m, job),
  approved: m.approved !== false, rejected: !!m.rejected, delReq: !!m.delReq });

// Xoá hẳn một cuốn (huỷ batch đang chạy). Dùng khi super admin xoá hoặc duyệt yêu cầu xoá của admin (api/admin.mjs).
export async function deleteBook(id) {
  const key = process.env.ANTHROPIC_API_KEY || "";
  const job = await getJob(id);
  if (job && key) for (const bid of Object.keys(job.batches || {})) await fetch(API + "/" + bid + "/cancel", { method: "POST", headers: H(key) }).catch(() => {});
  await redis([["HDEL", BK.idx, id], ["DEL", BK.job(id)], ["DEL", BK.half(id)], ["DEL", BK.text(id)]]);
}
// Đánh dấu duyệt / từ chối đưa sách vào dùng (ONTAP chỉ dùng sách đã duyệt), bỏ cờ "đang xin xoá".
export async function markBook(id, patch) {
  const m = await getMeta(id);
  if (!m) return null;
  const next = { ...m, ...patch, updated: Date.now() };
  await redis([["HSET", BK.idx, id, JSON.stringify(next)]]);
  return next;
}
// Xem thử chữ AI đã đọc (super admin xem trước khi duyệt). Trả tối đa `n` trang có chữ, bắt đầu từ trang `from`.
export async function previewBook(id, from = 1, n = 4) {
  const [raw] = await redis([["GET", BK.text(id)]]);
  const book = unpack(raw);
  if (!book) return [];
  return (book.pages || []).filter((p) => p.n >= from).slice(0, n).map((p) => ({ n: p.n, printed: p.printed, text: String(p.text).slice(0, 4000) }));
}

async function withLock(id, fn) {
  const lk = BK.lock(id), nonce = crypto.randomBytes(8).toString("hex");
  let got = false;
  for (let i = 0; i < 80 && !got; i++) {
    const [r] = await redis([["SET", lk, nonce, "NX", "PX", "90000"]]);
    got = r === "OK";
    if (!got) await sleep(250);
  }
  if (!got) { const e = new Error("busy"); e.code = "busy"; throw e; }
  try { return await fn(); } finally { await redis([["EVAL", UNLOCK, "1", lk, nonce]]).catch(() => {}); }
}
async function getMeta(id) { const [raw] = await redis([["HGET", BK.idx, id]]); return parse(raw); }
async function getJob(id) { const [raw] = await redis([["GET", BK.job(id)]]); return parse(raw); }

// Hỏi Anthropic tình trạng các batch của một cuốn; batch xong -> lưu chữ; đủ trang -> gộp cả cuốn.
async function pollBook(key, meta) {
  let job = await getJob(meta.id);
  if (!job) return { meta, job: null };
  const ids = Object.keys(job.batches).slice(0, POLL_MAX);
  if (!ids.length) return { meta, job };
  const st = await Promise.all(ids.map(async (b) => {
    try { const r = await fetch(API + "/" + b, { headers: H(key) }); const d = await r.json(); return d && d.processing_status === "ended" ? d : null; }
    catch { return null; }
  }));
  const ended = st.filter(Boolean);
  if (!ended.length) return { meta, job };
  // tải kết quả ngoài khoá (có thể mất vài giây)
  const results = {};
  for (const b of ended) {
    try {
      const r = await fetch(b.results_url || API + "/" + b.id + "/results", { headers: H(key) });
      if (!r.ok) continue;
      const lines = (await r.text()).split("\n").filter((l) => l.trim());
      results[b.id] = lines.map((l) => parse(l)).filter(Boolean);
    } catch { /* lần sau thử lại */ }
  }
  if (!Object.keys(results).length) return { meta, job };
  // Chi phí AI (25/11/2026): token của các nửa trang vừa đọc xong (Message Batches = nửa giá), loại "books".
  // Chỉ tính batch còn trong job (máy khác chưa xử lý) để không cộng trùng khi hai máy cùng hỏi tiến độ.
  const ctx = newCtx("books");
  const out = await withLock(meta.id, async () => {
    let m = await getMeta(meta.id);
    if (!m) return { meta: { ...meta, status: "deleted" }, job: null };   // vừa bị xoá: không tạo lại
    job = (await getJob(meta.id)) || job;
    const texts = [];
    for (const [bid, rows] of Object.entries(results)) {
      if (!job.batches[bid]) continue;   // máy khác đã xử lý
      const seen = new Set();
      for (const row of rows) {
        const c = row.custom_id, pc = parseCid(c);
        if (!pc || job.sent[c] !== bid) continue;
        seen.add(c);
        delete job.sent[c];
        const res = row.result || {};
        if (res.type === "succeeded" && res.message && res.message.usage) ctx.add(res.message.model || "", res.message.usage, { batch: true });
        if (res.type === "succeeded" && res.message) {
          const text = (res.message.content || []).filter((x) => x && x.type === "text").map((x) => x.text || "").join("").trim().slice(0, 40000);
          const cut = res.message.stop_reason === "max_tokens";
          if (cut && (job.tries[c] || 0) < TRIES_MAX) { job.cut[c] = 1; continue; }   // bị cắt -> đọc lại, dài hơn
          texts.push(c, text || "[Trống]");
          job.done[c] = 1; delete job.cut[c];
        } else if ((job.tries[c] || 0) >= TRIES_MAX) {
          job.failed[c] = 1;
        }
      }
      // nửa trang không có trong kết quả -> coi như lỗi, gửi lại
      for (const [c, b] of Object.entries(job.sent)) if (b === bid && !seen.has(c)) { delete job.sent[c]; if ((job.tries[c] || 0) >= TRIES_MAX) job.failed[c] = 1; }
      delete job.batches[bid];
    }
    const cmds = [];
    if (texts.length) cmds.push(["HSET", BK.half(m.id), ...texts]);
    const p = progress({ ...m, status: "reading" }, job);
    if (p.done + p.failed >= p.total) {
      // đủ trang: gộp chữ cả cuốn, nén, xoá phần tạm
      if (cmds.length) { await redis(cmds); cmds.length = 0; }
      const [raw] = await redis([["HGETALL", BK.half(m.id)]]);
      const halves = {};
      if (Array.isArray(raw)) for (let i = 0; i + 1 < raw.length; i += 2) halves[raw[i]] = raw[i + 1];
      const pages = assemblePages(halves, m.pages);
      const chars = pages.reduce((s, x) => s + x.text.length, 0);
      m = { ...m, status: "ready", failed: p.failed, chars, updated: Date.now() };
      await redis([["SET", BK.text(m.id), pack({ v: 1, id: m.id, title: m.title, pages })], ["HSET", BK.idx, m.id, JSON.stringify(m)], ["DEL", BK.half(m.id)], ["DEL", BK.job(m.id)]]);
      return { meta: m, job: null };
    }
    m = { ...m, updated: Date.now() };
    cmds.push(["SET", BK.job(m.id), JSON.stringify(job)], ["HSET", BK.idx, m.id, JSON.stringify(m)]);
    await redis(cmds);
    return { meta: m, job };
  });
  await recordCost(ctx, {}, { noPhone: true });
  return out;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return send(res, 405, { ok: false, error: "method" });
  if (!redisEnv()) return send(res, 200, { ok: false, error: "no_store" });
  if (Number((req.headers && req.headers["content-length"]) || 0) > BODY_MAX) return send(res, 413, { ok: false, error: "too_large" });
  let b;
  try { b = await readBody(req, BODY_MAX); } catch (e) { return send(res, e && e.code === "too_large" ? 413 : 400, { ok: false, error: e && e.code === "too_large" ? "too_large" : "bad_json" }); }
  b = b && typeof b === "object" ? b : {};
  try {
    // chỉ máy đã đăng nhập; chỉ số điện thoại trong ADMIN_PHONES
    const u = await userOf(req);
    if (!u) return send(res, 200, { ok: false, error: "bad_token" });
    const role = await roleOf(u.phone);   // "super" | "admin" | ""
    const admin = !!role;
    const action = String(b.action || "");
    if (action === "list" && !admin) return send(res, 200, { ok: true, admin: false });
    if (!admin) return send(res, 200, { ok: false, error: "not_admin" });
    const key = process.env.ANTHROPIC_API_KEY || "";

    switch (action) {
      // Danh sách sách + hỏi tiến độ các cuốn đang đọc
      case "list": {
        const list = await readIndex();
        const out = [];
        for (const m of list) {
          if (m.status === "reading" && key) {
            try { const r = await pollBook(key, m); if (r.meta.status !== "deleted") out.push(pubMeta(r.meta, r.job)); continue; }
            catch (e) { if (e && e.code !== "busy") console.error("book poll", e && e.message); }
          }
          out.push(pubMeta(m, m.status === "reading" ? await getJob(m.id) : null));
        }
        out.sort((x, y) => x.grade - y.grade || String(x.subject).localeCompare(String(y.subject)) || String(x.title).localeCompare(String(y.title)) || (KIND_ORDER[x.kind] || 0) - (KIND_ORDER[y.kind] || 0));
        return send(res, 200, { ok: true, admin: true, role, ai: !!key, books: out });
      }
      // Tạo sách mới (chưa có chữ)
      case "create": {
        const title = clean(b.title, 120), grade = gradeNum(b.grade), subject = clean(b.subject, 60);
        const kind = String(b.kind || ""), pages = Math.round(Number(b.pages));
        if (!title || !grade || !subject || !KINDS[kind]) return send(res, 200, { ok: false, error: "bad_info" });
        if (!(pages >= 1 && pages <= PAGES_MAX)) return send(res, 200, { ok: false, error: "bad_pages" });
        const [n] = await redis([["HLEN", BK.idx]]);
        if (Number(n) >= BOOKS_MAX) return send(res, 200, { ok: false, error: "too_many" });
        const now = Date.now();
        // admin nạp: sách chờ super admin duyệt mới được ONTAP dùng; super admin nạp: dùng ngay khi đọc xong
        const m = { id: "b" + crypto.randomBytes(6).toString("hex"), title, grade, subject, kind, pages, file: clean(b.file, 160), status: "reading", failed: 0, created: now, updated: now,
          by: u.phone, approved: role === "super" };
        await redis([["HSET", BK.idx, m.id, JSON.stringify(m)], ["SET", BK.job(m.id), JSON.stringify(newJob())]]);
        await putChange(newChange({ type: "book_publish", by: u.phone, byName: u.acc.parentName || "", title: `${KINDS[kind]} ${title} (lớp ${grade}, ${subject}, ${pages} trang)`,
          after: { id: m.id, title, grade, subject, kind, pages }, ref: m.id, status: role === "super" ? "applied" : "pending" }));
        return send(res, 200, { ok: true, book: pubMeta(m, newJob()) });
      }
      // Gửi một nhóm nửa trang -> một Message Batch
      case "upload": {
        if (!key) return send(res, 200, { ok: false, error: "no_ai" });
        const id = String(b.id || "");
        const items = Array.isArray(b.items) ? b.items : [];
        if (!items.length || items.length > ITEMS_MAX) return send(res, 200, { ok: false, error: "bad_items" });
        const m0 = /^b[0-9a-f]{12}$/.test(id) ? await getMeta(id) : null;
        if (!m0) return send(res, 200, { ok: false, error: "no_book" });
        const imgs = [];
        for (const it of items) {
          const page = Math.round(Number(it && it.page)), half = Math.round(Number(it && it.half));
          if (!(page >= 1 && page <= m0.pages) || !(half === 1 || half === 2)) return send(res, 200, { ok: false, error: "bad_items" });
          const buf = Buffer.from(String((it && it.b64) || ""), "base64");
          if (buf.length > IMG_MAX) return send(res, 200, { ok: false, error: "img_too_big" });
          const sz = jpegSize(buf);
          if (!sz) return send(res, 200, { ok: false, error: "not_jpeg" });
          if (sz.w * sz.h > PIX_MAX || sz.w > 2000 || sz.h > 2000) return send(res, 200, { ok: false, error: "img_too_big" });
          imgs.push({ c: cid(page, half), page, half, b64: buf.toString("base64") });
        }
        if (m0.status !== "reading") return send(res, 200, { ok: true, book: pubMeta(m0, null), sent: 0 });
        const model = await pickModel(key);
        const thinking = await thinkingFor(key, model);
        const r = await withLock(id, async () => {
          const job = (await getJob(id)) || newJob();
          const todo = imgs.filter((x, i) => imgs.findIndex((y) => y.c === x.c) === i && !job.done[x.c] && !job.failed[x.c] && !job.sent[x.c]);
          if (!todo.length) return { m: m0, job, sent: 0 };
          const requests = todo.map((x) => {
            const n = job.tries[x.c] || 0;
            const params = { model, max_tokens: TOK[Math.min(n, TOK.length - 1)], messages: [{ role: "user", content: [
              { type: "image", source: { type: "base64", media_type: "image/jpeg", data: x.b64 } },
              { type: "text", text: ocrPrompt(m0.title, x.page, x.half) },
            ] }] };
            if (thinking) params.thinking = thinking;
            return { custom_id: x.c, params };
          });
          const resp = await fetch(API, { method: "POST", headers: H(key), body: JSON.stringify({ requests }) });
          const d = await resp.json().catch(() => ({}));
          if (!resp.ok || !d || !d.id) { const e = new Error("batch: " + String((d && d.error && d.error.message) || resp.status)); e.code = "ai_error"; throw e; }
          for (const x of todo) { job.sent[x.c] = d.id; job.tries[x.c] = (job.tries[x.c] || 0) + 1; delete job.cut[x.c]; }
          job.batches[d.id] = { at: Date.now(), n: todo.length };
          const m = { ...((await getMeta(id)) || m0), updated: Date.now() };
          await redis([["SET", BK.job(id), JSON.stringify(job)], ["HSET", BK.idx, id, JSON.stringify(m)]]);
          return { m, job, sent: todo.length };
        });
        return send(res, 200, { ok: true, book: pubMeta(r.m, r.job), sent: r.sent });
      }
      // Hỏi tiến độ một cuốn
      case "poll": {
        const id = String(b.id || "");
        const m = /^b[0-9a-f]{12}$/.test(id) ? await getMeta(id) : null;
        if (!m) return send(res, 200, { ok: false, error: "no_book" });
        if (m.status !== "reading" || !key) return send(res, 200, { ok: true, book: pubMeta(m, m.status === "reading" ? await getJob(id) : null) });
        const r = await pollBook(key, m);
        return send(res, 200, { ok: true, book: pubMeta(r.meta, r.job) });
      }
      // Xoá sách (huỷ các batch đang chạy, xoá chữ)
      case "delete": {
        const id = String(b.id || "");
        const m = /^b[0-9a-f]{12}$/.test(id) ? await getMeta(id) : null;
        if (!m) return send(res, 200, { ok: true, gone: true });
        const title = `${KINDS[m.kind]} ${m.title} (lớp ${m.grade}, ${m.subject})`;
        if (role !== "super") {
          // admin: chỉ GỬI YÊU CẦU xoá, chờ super admin duyệt
          if (!(await pendingOf("book_delete", id))) await putChange(newChange({ type: "book_delete", by: u.phone, byName: u.acc.parentName || "", title, before: { id, title: m.title }, ref: id }));
          const mm = await markBook(id, { delReq: true });
          return send(res, 200, { ok: true, gone: false, pending: true, book: pubMeta(mm, mm.status === "reading" ? await getJob(id) : null) });
        }
        await deleteBook(id);
        await putChange(newChange({ type: "book_delete", by: u.phone, byName: u.acc.parentName || "", title, before: { id, title: m.title }, ref: id, status: "applied" }));
        const pend = await pendingOf("book_delete", id);
        if (pend) await putChange({ ...pend, status: "approved", reviewedBy: u.phone, reviewedAt: Date.now() });
        return send(res, 200, { ok: true, gone: true });
      }
      default:
        return send(res, 400, { ok: false, error: "bad_action" });
    }
  } catch (e) {
    if (e && ["store_limit", "store_error", "no_store", "busy", "ai_error"].includes(e.code)) {
      if (e.code === "ai_error") console.error("books ai", e.message);
      return send(res, 200, { ok: false, error: e.code });
    }
    console.error("books error", e && e.message);
    return send(res, 500, { ok: false, error: "server" });
  }
}
