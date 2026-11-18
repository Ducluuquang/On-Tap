// TRANG QUẢN TRỊ HỆ THỐNG /quan-tri (anh duyệt 17/11/2026) — chỉ tài khoản có số trong ADMIN_PHONES (api/_admin.mjs).
// Không có lối vào trong app của phụ huynh / học sinh; quản trị mở địa chỉ riêng và đăng nhập bằng tài khoản của mình.
//  GET  /api/admin            -> bảng giá gói (công khai, trang đăng ký dùng)
//  POST setup {phone, pass, code} (KHÔNG cần đăng nhập) -> LẦN ĐẦU tạo tài khoản quản trị (18/11/2026): số phải nằm trong
//       ADMIN_PHONES + đúng MÃ CÀI ĐẶT anh tự đặt ở biến Vercel ADMIN_SETUP_CODE (≥ 8 ký tự; chưa có biến -> tắt).
//       Số đã có tài khoản -> đặt lại mật khẩu (cũng cần mã này). Tài khoản chỉ để quản trị: không có con, không vào danh sách
//       người dùng. Sai mã: mỗi địa chỉ mạng tối đa 10 lần / giờ.
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
import crypto from "node:crypto";
import { userOf, isAdmin, isSuper, roleOf, adminPhones, vnPhone } from "./_admin.mjs";
import { CHG_TYPES, newChange, putChange, getChange, listChanges, pendingOf, getSupportCfg, okEmail } from "./_changes.mjs";
import { deleteBook, markBook, previewBook } from "./books.mjs";
import { hashPass } from "./account.mjs";
import { tokenFor } from "./_acctkey.mjs";
import { FK, KINDS, STATUS, okId, cleanText, getThread, putThread, pubThread } from "./_fb.mjs";

const PLAN_IDS = ["1", "2", "3", "4", "5"];
const PRICE_MAX = 100000000;
const PAGE = 30;
const DAY = 86400000;

const SUPER_ONLY = new Set(["chg_approve", "chg_reject", "staff_list", "staff_add", "staff_remove", "settings_set"]);
async function setPrices(plans, by) {
  await redis([["SET", "cfg:prices", JSON.stringify({ currency: "VND", plans, updated: Date.now(), by })]]);
}
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
      keys.forEach((k, j) => { const a = parse(vals[j]); if (a && a.sys !== "admin") add.push(String(a.created || a.updated || Date.now()), k.slice(7)); });
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
  first: (t.msgs[0] && t.msgs[0].text || "").slice(0, 160), n: t.msgs.length, last: (t.msgs[t.msgs.length - 1] || {}).by || "user",
  escalated: !!t.escalated, urgent: !!t.urgent, aiSummary: t.aiSummary || "" });

const sameStr = (a, b) => { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && crypto.timingSafeEqual(x, y); };
async function setup(req, res, b) {
  const want = String(process.env.ADMIN_SETUP_CODE || "");
  if (want.length < 8) return send(res, 200, { ok: false, error: "setup_off" });
  const ip = String((req.headers && req.headers["x-forwarded-for"]) || "").split(",")[0].trim() || "local";
  const rk = "acct:rl:asetup:" + ip;
  const [n] = await redis([["GET", rk]]);
  if (Number(n) >= 10) return send(res, 200, { ok: false, error: "slow_down" });
  const fail = async (error) => { await redis([["INCR", rk], ["EXPIRE", rk, "3600"]]); return send(res, 200, { ok: false, error }); };
  if (!sameStr(String(b.code || ""), want)) return fail("bad_code");
  const phone = vnPhone(b.phone), pass = typeof b.pass === "string" ? b.pass : "";
  if (!isAdmin(phone)) return fail("not_admin_phone");
  if (pass.length < 8 || pass.length > 64) return send(res, 200, { ok: false, error: "bad_pass" });
  const [raw] = await redis([["GET", "acct:u:" + phone]]);
  const cur = parse(raw);
  const now = Date.now();
  const acc = cur
    ? { ...cur, ...(await hashPass(pass)), pwv: (cur.pwv || 1) + 1, rev: (cur.rev || 1) + 1, updated: now }
    : { v: 1, phone, email: "", parentName: "Quản trị", province: "", plan: 1, pin: "", children: [], sys: "admin", ...(await hashPass(pass)), pwv: 1, rev: 1, created: now, updated: now };
  await redis([["SET", "acct:u:" + phone, JSON.stringify(acc)], ["DEL", "acct:rl:fail:" + phone]]);
  return send(res, 200, { ok: true, created: !cur, token: tokenFor(acc), name: acc.parentName || "", phone });
}

export default async function handler(req, res) {
  if (!redisEnv()) return send(res, 200, { ok: false, error: "no_store" });
  try {
    if (req.method === "GET") return send(res, 200, { ok: true, prices: await getPrices() });
    if (req.method !== "POST") return send(res, 405, { ok: false, error: "method" });
    let b;
    try { b = await readBody(req, 200000); } catch { return send(res, 400, { ok: false, error: "bad_json" }); }
    b = b && typeof b === "object" ? b : {};
    if (String(b.action || "") === "setup") return setup(req, res, b);
    const u = await userOf(req);
    if (!u) return send(res, 200, { ok: false, error: "bad_token" });
    const role = await roleOf(u.phone);   // "super" | "admin" | ""
    if (!role) return send(res, 200, { ok: false, error: "not_admin" });
    const action = String(b.action || "");
    // việc chỉ SUPER ADMIN làm được
    if (SUPER_ONLY.has(action) && role !== "super") return send(res, 200, { ok: false, error: "not_super" });
    const who = { by: u.phone, byName: u.acc.parentName || "" };
    switch (action) {
      case "whoami":
        return send(res, 200, { ok: true, admin: true, role, name: u.acc.parentName || "", phone: u.phone });
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
            if (!a || a.sys === "admin") return;
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
        const users = page.map((p, j) => { const a = parse(accs[j]); return a && a.sys !== "admin" ? pubUser(a, seens[j]) : null; }).filter(Boolean);
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
        const old = await pendingOf("prices");
        if (role !== "super") {
          // admin: đề xuất giá mới, CHỜ super admin duyệt (trang đăng ký vẫn hiện giá cũ); đề xuất mới thay đề xuất cũ đang chờ
          const c = newChange({ type: "prices", ...who, title: "Bảng giá gói", before: cur.plans, after: plans });
          if (old) await putChange({ ...old, status: "rejected", reviewedBy: u.phone, reviewedAt: Date.now(), note: "Thay bằng đề xuất mới" });
          await putChange(c);
          return send(res, 200, { ok: true, pending: true, change: c, prices: cur });
        }
        await setPrices(plans, u.phone);
        await putChange(newChange({ type: "prices", ...who, title: "Bảng giá gói", before: cur.plans, after: plans, status: "applied" }));
        if (old) await putChange({ ...old, status: "rejected", reviewedBy: u.phone, reviewedAt: Date.now(), note: "Super admin đã đặt giá khác" });
        return send(res, 200, { ok: true, prices: await getPrices() });
      }
      case "prices_pending":
        return send(res, 200, { ok: true, change: await pendingOf("prices") });
      // ---- Duyệt thay đổi + nhật ký ----
      case "chg_list": {
        const r = await listChanges(200);
        return send(res, 200, { ok: true, pending: r.pending, changes: r.list, types: CHG_TYPES });
      }
      case "chg_approve": case "chg_reject": {
        const c = await getChange(b.id);
        if (!c) return send(res, 200, { ok: false, error: "not_found" });
        if (c.status !== "pending") return send(res, 200, { ok: false, error: "not_pending" });
        const note = cleanText(b.note, 500);
        if (action === "chg_approve") {
          if (c.type === "prices") await setPrices(c.after, u.phone);
          else if (c.type === "book_publish") {
            const [raw] = await redis([["HGET", "book:idx", c.ref]]);
            const m = parse(raw);
            if (!m) return send(res, 200, { ok: false, error: "no_book" });
            if (m.status !== "ready") return send(res, 200, { ok: false, error: "not_ready" });
            await markBook(c.ref, { approved: true, rejected: false });
          } else if (c.type === "book_delete") await deleteBook(c.ref);
        } else if (c.type === "book_publish") await markBook(c.ref, { approved: false, rejected: true });
        else if (c.type === "book_delete") await markBook(c.ref, { delReq: false });
        const done = await putChange({ ...c, status: action === "chg_approve" ? "approved" : "rejected", reviewedBy: u.phone, reviewedAt: Date.now(), note });
        return send(res, 200, { ok: true, change: done });
      }
      case "book_preview": {
        const id = String(b.id || "");
        if (!/^b[0-9a-f]{12}$/.test(id)) return send(res, 200, { ok: false, error: "no_book" });
        return send(res, 200, { ok: true, pages: await previewBook(id, Math.max(1, Math.round(Number(b.from) || 1)), 4) });
      }
      // ---- Quản trị viên (super admin thêm / bỏ admin) ----
      case "staff_list": {
        const [ids, info] = await redis([["SMEMBERS", "adm:staff"], ["HGETALL", "adm:staffinfo"]]);
        const inf = {};
        for (let i = 0; i + 1 < (info || []).length; i += 2) inf[info[i]] = parse(info[i + 1]) || {};
        const phones = [...adminPhones(), ...(ids || [])];
        const [accs, seens] = phones.length ? await redis([["MGET", ...phones.map((p) => "acct:u:" + p)], ["MGET", ...phones.map((p) => "acct:seen:" + p)]]) : [[], []];
        const list = phones.map((p, i) => { const a = parse(accs[i]) || {}; return { phone: p, role: isSuper(p) ? "super" : "admin", name: (inf[p] && inf[p].name) || a.parentName || "", hasAccount: !!accs[i], seen: Number(seens[i]) || 0, addedAt: (inf[p] && inf[p].at) || 0 } });
        return send(res, 200, { ok: true, staff: list });
      }
      case "staff_add": {
        const phone = vnPhone(b.phone), name = String(b.name || "").replace(/\s+/g, " ").trim().slice(0, 60), pass = typeof b.pass === "string" ? b.pass : "";
        if (!/^\d{8,12}$/.test(phone)) return send(res, 200, { ok: false, error: "bad_phone" });
        if (isSuper(phone)) return send(res, 200, { ok: false, error: "is_super" });
        const [raw] = await redis([["GET", "acct:u:" + phone]]);
        let created = false;
        if (!raw) {
          // chưa có tài khoản: tạo tài khoản chỉ để quản trị (không con) với mật khẩu ban đầu super admin đặt
          if (pass.length < 8 || pass.length > 64) return send(res, 200, { ok: false, error: "bad_pass" });
          const now = Date.now();
          const acc = { v: 1, phone, email: "", parentName: name || "Admin", province: "", plan: 1, pin: "", children: [], sys: "admin", ...(await hashPass(pass)), pwv: 1, rev: 1, created: now, updated: now };
          const [ok] = await redis([["SET", "acct:u:" + phone, JSON.stringify(acc), "NX"]]);
          created = ok === "OK";
        }
        await redis([["SADD", "adm:staff", phone], ["HSET", "adm:staffinfo", phone, JSON.stringify({ name, by: u.phone, at: Date.now() })]]);
        await putChange(newChange({ type: "staff_add", ...who, title: `Thêm admin ${name || ""} ${phone}`.replace(/\s+/g, " "), after: { phone, name }, status: "applied" }));
        return send(res, 200, { ok: true, created });
      }
      case "staff_remove": {
        const phone = vnPhone(b.phone);
        const [m] = await redis([["SISMEMBER", "adm:staff", phone]]);
        if (Number(m) !== 1) return send(res, 200, { ok: false, error: "not_found" });
        await redis([["SREM", "adm:staff", phone], ["HDEL", "adm:staffinfo", phone]]);
        await putChange(newChange({ type: "staff_remove", ...who, title: `Bỏ quyền admin ${phone}`, before: { phone }, status: "applied" }));
        return send(res, 200, { ok: true });
      }
      // ---- Cài đặt chăm sóc khách hàng ----
      case "settings_get":
        return send(res, 200, { ok: true, settings: await getSupportCfg() });
      case "settings_set": {
        const cur = await getSupportCfg();
        const next = { aiOn: b.aiOn == null ? cur.aiOn : !!b.aiOn, alertEmails: cur.alertEmails, updated: Date.now(), by: u.phone };
        if (b.alertEmails != null) {
          const list = String(Array.isArray(b.alertEmails) ? b.alertEmails.join(",") : b.alertEmails).split(/[,;\s]+/).map((e) => e.trim().toLowerCase()).filter(Boolean);
          if (list.length > 5 || list.some((e) => !okEmail(e))) return send(res, 200, { ok: false, error: "bad_email" });
          next.alertEmails = list;
        }
        await redis([["SET", "cfg:support", JSON.stringify(next)]]);
        await putChange(newChange({ type: "settings", ...who, title: "Chăm sóc khách hàng (ONTAP, email báo)", before: { aiOn: cur.aiOn, emails: cur.alertEmails.length }, after: { aiOn: next.aiOn, emails: next.alertEmails.length }, status: "applied" }));
        return send(res, 200, { ok: true, settings: await getSupportCfg() });
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
        if (b.lesson != null) {
          t.lesson = cleanText(b.lesson, 3000);
          // bài học -> kho bài học cho ONTAP chăm sóc khách hàng (api/_cskh.mjs đọc khi trả lời)
          if (t.lesson) await redis([["HSET", "fb:lessons", t.id, JSON.stringify({ kind: t.kind, q: (t.msgs[0] && t.msgs[0].text || "").slice(0, 200), lesson: t.lesson, at: Date.now() })]]);
          else await redis([["HDEL", "fb:lessons", t.id]]);
        }
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
              escalated: !!t.escalated, urgent: !!t.urgent,
              conversation: t.msgs.map((m) => ({ from: m.by === "admin" ? "Ôn Tập (người)" : m.by === "ai" ? "ONTAP (AI)" : (t.who === "child" ? "học sinh" : "phụ huynh"), text: m.text, at: new Date(m.at).toISOString(), screenshot: !!m.img })),
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
