// TRANG QUẢN TRỊ HỆ THỐNG /quan-tri (anh duyệt 17/11/2026) — chỉ tài khoản có số trong ADMIN_PHONES (api/_admin.mjs).
// Không có lối vào trong app của phụ huynh / học sinh; quản trị mở địa chỉ riêng và đăng nhập bằng tài khoản của mình.
//  GET  /api/admin            -> bảng giá gói (công khai, trang đăng ký dùng)
//  POST whoami                -> có phải quản trị không
//       overview              -> tổng quan: số tài khoản, mới 7 / 30 ngày, dùng app 7 ngày, số con, theo gói, góp ý chờ xử lý, sách
//       users {q, offset}     -> danh sách tài khoản (tìm theo số điện thoại hoặc email), 30 tài khoản mỗi trang
//       prices_set {plans}    -> đặt giá gói (VND; 0 = chưa đặt)
//       fb_list {status}      -> hộp thư góp ý · fb_get {id} · fb_img {id, n}
//       fb_reply {id, text}   -> trả lời (người gửi thấy trong app, chấm đỏ báo mới)
//       fb_status {id, status, lesson} -> đổi trạng thái + ghi "Bài học / cách xử lý" (để AI chăm sóc khách hàng học sau này)
//       fb_export             -> TOÀN BỘ nhật ký góp ý (JSON) để AI đọc và học
//       kb                    -> "Hiểu biết hệ thống" cho chăm sóc khách hàng (api/_support/he-thong.md)
// Doanh thu: chưa có cổng thanh toán thật nên chưa có số liệu (trang quản trị ghi rõ).
import fs from "node:fs";
import { redis, redisEnv, send, readBody, parse } from "./_store.mjs";
import { userOf, isAdmin } from "./_admin.mjs";
import { FK, KINDS, STATUS, okId, cleanText, getThread, putThread, pubThread } from "./_fb.mjs";

const PLAN_IDS = ["1", "2", "3", "4", "5"];
const PRICE_MAX = 100000000;
const PAGE = 30;
const DAY = 86400000;

export async function getPrices() {
  const [raw] = await redis([["GET", "cfg:prices"]]);
  const p = parse(raw) || {};
  const plans = {};
  for (const id of PLAN_IDS) {
    const x = (p.plans && p.plans[id]) || {};
    plans[id] = { month: Math.max(0, Math.round(Number(x.month) || 0)), year: Math.max(0, Math.round(Number(x.year) || 0)) };
  }
  return { currency: "VND", plans, updated: p.updated || 0 };
}

// Danh mục tài khoản (acct:idx). Tài khoản tạo trước 17/11/2026 chưa có trong danh mục -> lần đầu quét kho một lượt.
async function ensureIndex() {
  const [ok] = await redis([["GET", "acct:idx:ok"]]);
  if (ok) return;
  let cursor = "0";
  for (let i = 0; i < 200; i++) {
    const [r] = await redis([["SCAN", cursor, "MATCH", "acct:u:*", "COUNT", "500"]]);
    cursor = String(r[0]);
    const keys = (r[1] || []).filter((k) => /^acct:u:\d{8,12}$/.test(k));
    if (keys.length) {
      const [vals] = await redis([["MGET", ...keys]]);
      const add = [];
      keys.forEach((k, j) => { const a = parse(vals[j]); if (a) add.push(String(a.created || a.updated || Date.now()), k.slice(7)); });
      if (add.length) await redis([["ZADD", "acct:idx", ...add]]);
    }
    if (cursor === "0") break;
  }
  await redis([["SET", "acct:idx:ok", "1"]]);
}
const pubUser = (a, seen) => ({
  phone: a.phone, email: a.email || "", parentName: a.parentName || "", province: a.province || "", plan: a.plan || 1,
  children: (a.children || []).map((c) => ({ name: c.name, grade: c.grade || "", school: c.school || "" })),
  created: a.created || 0, updated: a.updated || 0, seen: Number(seen) || 0,
});
const summary = (t) => ({ id: t.id, kind: t.kind, status: t.status, created: t.created, updated: t.updated, who: t.who, child: t.child || null, phone: t.phone,
  first: (t.msgs[0] && t.msgs[0].text || "").slice(0, 160), n: t.msgs.length, last: (t.msgs[t.msgs.length - 1] || {}).by || "user" });

export default async function handler(req, res) {
  if (!redisEnv()) return send(res, 200, { ok: false, error: "no_store" });
  try {
    if (req.method === "GET") return send(res, 200, { ok: true, prices: await getPrices() });
    if (req.method !== "POST") return send(res, 405, { ok: false, error: "method" });
    let b;
    try { b = await readBody(req, 200000); } catch { return send(res, 400, { ok: false, error: "bad_json" }); }
    b = b && typeof b === "object" ? b : {};
    const u = await userOf(req);
    if (!u) return send(res, 200, { ok: false, error: "bad_token" });
    if (!isAdmin(u.phone)) return send(res, 200, { ok: false, error: "not_admin" });
    switch (String(b.action || "")) {
      case "whoami":
        return send(res, 200, { ok: true, admin: true, name: u.acc.parentName || "", phone: u.phone });
      case "overview": {
        await ensureIndex();
        const now = Date.now();
        const [total, n7, n30, phones, pending, books] = await redis([["ZCARD", "acct:idx"], ["ZCOUNT", "acct:idx", String(now - 7 * DAY), "+inf"],
          ["ZCOUNT", "acct:idx", String(now - 30 * DAY), "+inf"], ["ZRANGE", "acct:idx", "0", "-1"], ["SCARD", FK.pending], ["HLEN", "book:idx"]]);
        let kids = 0, active7 = 0;
        const byPlan = {};
        for (let i = 0; i < (phones || []).length; i += 400) {
          const chunk = phones.slice(i, i + 400);
          const [accs, seens] = await redis([["MGET", ...chunk.map((p) => "acct:u:" + p)], ["MGET", ...chunk.map((p) => "acct:seen:" + p)]]);
          chunk.forEach((_, j) => {
            const a = parse(accs[j]);
            if (!a) return;
            kids += (a.children || []).length;
            byPlan[a.plan || 1] = (byPlan[a.plan || 1] || 0) + 1;
            if (Number(seens[j]) >= now - 7 * DAY) active7++;
          });
        }
        return send(res, 200, { ok: true, users: Number(total) || 0, new7: Number(n7) || 0, new30: Number(n30) || 0, active7, kids, byPlan,
          fbPending: Number(pending) || 0, books: Number(books) || 0, revenue: null, prices: await getPrices() });
      }
      case "users": {
        await ensureIndex();
        const q = String(b.q || "").trim().toLowerCase(), offset = Math.max(0, Math.round(Number(b.offset) || 0));
        let phones;
        if (q.includes("@")) {
          const [p] = await redis([["GET", "acct:e:" + q]]);
          phones = p ? [p] : [];
        } else {
          const [all] = await redis([["ZREVRANGE", "acct:idx", "0", "-1"]]);
          const d = q.replace(/\D+/g, "");
          phones = d ? (all || []).filter((p) => p.includes(d)) : (all || []);
        }
        const page = phones.slice(offset, offset + PAGE);
        if (!page.length) return send(res, 200, { ok: true, total: phones.length, offset, users: [] });
        const [accs, seens] = await redis([["MGET", ...page.map((p) => "acct:u:" + p)], ["MGET", ...page.map((p) => "acct:seen:" + p)]]);
        const users = page.map((p, j) => { const a = parse(accs[j]); return a ? pubUser(a, seens[j]) : null; }).filter(Boolean);
        // tài khoản đã bị xoá khỏi kho nhưng còn trong danh mục -> bỏ khỏi danh mục
        const gone = page.filter((p, j) => !accs[j]);
        if (gone.length) await redis([["ZREM", "acct:idx", ...gone]]);
        return send(res, 200, { ok: true, total: phones.length - gone.length, offset, users });
      }
      case "prices_set": {
        const cur = await getPrices();
        const plans = {};
        for (const id of PLAN_IDS) {
          const x = (b.plans && b.plans[id]) || cur.plans[id];
          const m = Math.round(Number(x.month)), y = Math.round(Number(x.year));
          if (!(m >= 0 && m <= PRICE_MAX && y >= 0 && y <= PRICE_MAX)) return send(res, 200, { ok: false, error: "bad_price" });
          plans[id] = { month: m, year: y };
        }
        const next = { currency: "VND", plans, updated: Date.now(), by: u.phone };
        await redis([["SET", "cfg:prices", JSON.stringify(next)]]);
        return send(res, 200, { ok: true, prices: await getPrices() });
      }
      case "fb_list": {
        const st = String(b.status || "open");
        const [ids, pend] = await redis([["ZREVRANGE", FK.all, "0", "299"], ["SMEMBERS", FK.pending]]);
        const list = (ids || []).length ? (await redis([["MGET", ...ids.map(FK.t)]]))[0] : [];
        const p = new Set(pend || []);
        let threads = (list || []).map((x) => parse(x)).filter(Boolean);
        if (st === "open") threads = threads.filter((t) => t.status !== "done");
        else if (STATUS[st]) threads = threads.filter((t) => t.status === st);
        return send(res, 200, { ok: true, pending: p.size, threads: threads.map((t) => ({ ...summary(t), pending: p.has(t.id) })) });
      }
      case "fb_get": {
        const t = okId(b.id) ? await getThread(String(b.id)) : null;
        if (!t) return send(res, 200, { ok: false, error: "not_found" });
        const [a] = await redis([["GET", "acct:u:" + t.phone]]);
        const acc = parse(a);
        return send(res, 200, { ok: true, thread: { ...pubThread(t), phone: t.phone, ctx: t.ctx || {}, lesson: t.lesson || "",
          user: acc ? { parentName: acc.parentName || "", email: acc.email || "", plan: acc.plan || 1 } : null } });
      }
      case "fb_img": {
        const n = Math.max(0, Math.min(200, Math.round(Number(b.n) || 0)));
        const [img] = okId(b.id) ? await redis([["GET", FK.img(String(b.id), n)]]) : [null];
        return send(res, 200, { ok: !!img, img: img || "" });
      }
      case "fb_reply": {
        const t = okId(b.id) ? await getThread(String(b.id)) : null;
        const text = cleanText(b.text);
        if (!t) return send(res, 200, { ok: false, error: "not_found" });
        if (!text) return send(res, 200, { ok: false, error: "empty" });
        const now = Date.now();
        t.msgs.push({ by: "admin", who: "Ôn Tập", text, at: now, admin: u.phone });
        t.status = "answered"; t.updated = now;
        await redis([["SREM", FK.pending, t.id], ["SADD", FK.unread(t.phone), t.id]]);
        await putThread(t);
        return send(res, 200, { ok: true, thread: pubThread(t) });
      }
      case "fb_status": {
        const t = okId(b.id) ? await getThread(String(b.id)) : null;
        if (!t) return send(res, 200, { ok: false, error: "not_found" });
        if (b.status != null) {
          if (!STATUS[b.status]) return send(res, 200, { ok: false, error: "bad_status" });
          t.status = b.status;
        }
        if (b.lesson != null) t.lesson = cleanText(b.lesson, 3000);
        if (b.kind != null && KINDS[b.kind]) t.kind = b.kind;
        t.updated = Date.now();
        await redis([t.status === "new" ? ["SADD", FK.pending, t.id] : ["SREM", FK.pending, t.id]]);
        await putThread(t);
        return send(res, 200, { ok: true, thread: { ...pubThread(t), lesson: t.lesson } });
      }
      case "fb_export": {
        const [ids] = await redis([["ZRANGE", FK.all, "0", "-1"]]);
        const out = [];
        for (let i = 0; i < (ids || []).length; i += 300) {
          const [vals] = await redis([["MGET", ...ids.slice(i, i + 300).map(FK.t)]]);
          for (const v of vals || []) {
            const t = parse(v);
            if (t) out.push({ id: t.id, kind: KINDS[t.kind] || t.kind, status: STATUS[t.status] || t.status, created: new Date(t.created).toISOString(),
              who: t.who === "child" ? "học sinh" : "phụ huynh", grade: (t.child && t.child.grade) || "", ctx: t.ctx || {},
              conversation: t.msgs.map((m) => ({ from: m.by === "admin" ? "Ôn Tập" : (t.who === "child" ? "học sinh" : "phụ huynh"), text: m.text, at: new Date(m.at).toISOString(), screenshot: !!m.img })),
              lesson: t.lesson || "" });
          }
        }
        return send(res, 200, { ok: true, exported: new Date().toISOString(), count: out.length, threads: out });
      }
      case "kb": {
        let text = "";
        try { text = fs.readFileSync(new URL("./_support/he-thong.md", import.meta.url), "utf8"); } catch { text = ""; }
        return send(res, 200, { ok: !!text, text });
      }
      default:
        return send(res, 400, { ok: false, error: "bad_action" });
    }
  } catch (e) {
    if (e && ["store_limit", "store_error", "no_store"].includes(e.code)) return send(res, 200, { ok: false, error: e.code });
    console.error("admin error", e && e.message);
    return send(res, 500, { ok: false, error: "server" });
  }
}
