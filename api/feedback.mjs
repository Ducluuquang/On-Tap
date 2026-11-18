// GÓP Ý / BÁO LỖI — phía người dùng (phụ huynh + học sinh, cần đăng nhập). Xem api/_fb.mjs.
//  send  {kind, text, who:'parent'|'child', child:{id,name,grade}, img?, screen, ua}  -> tạo phiếu mới
//  mine  {who, child} -> các phiếu (kèm trả lời) + số phiếu có trả lời chưa xem. Học sinh (who:'child') chỉ thấy phiếu của mình;
//        phụ huynh thấy mọi phiếu của tài khoản.
//  reply {id, text, img?}  -> nhắn thêm vào phiếu của mình
//  seen  {id} -> đã xem câu trả lời · unread -> số phiếu có trả lời chưa xem (chấm đỏ)
//  img   {id, n} -> ảnh chụp màn hình của tin nhắn n
import { redis, redisEnv, send, readBody } from "./_store.mjs";
import { userOf } from "./_admin.mjs";
import { aiAnswer, alertAdmins } from "./_cskh.mjs";
import { getSupportCfg } from "./_changes.mjs";
import { FK, KINDS, okId, newId, cleanText, cleanImg, getThread, putThread, pubThread, meta, SEND_DAY_MAX } from "./_fb.mjs";

const BODY_MAX = 700000;
// Học sinh chỉ thấy phiếu của chính mình; phụ huynh thấy mọi phiếu của tài khoản (cả phiếu các con gửi).
const viewer = (b) => (b && b.who === "child" ? String((b.child && b.child.id) || "") || "-" : "");
const visible = (t, kid) => !kid || (t.who === "child" && t.child && t.child.id === kid);
async function unreadFor(phone, kid) {
  const [ids] = await redis([["SMEMBERS", FK.unread(phone)]]);
  if (!kid || !(ids || []).length) return (ids || []).length;
  const [vals] = await redis([["MGET", ...ids.map(FK.t)]]);
  return (vals || []).map((x) => { try { return JSON.parse(x); } catch { return null; } }).filter((t) => t && visible(t, kid)).length;
}

// ONTAP tự trả lời (18/11/2026). Trả lời được -> phiếu "Đã trả lời" (không cần người); cần người -> phiếu chờ ở /quan-tri
// + thư báo quản trị (chỉ khi phiếu mới chuyển, hoặc mới thành gấp). AI lỗi -> phiếu chờ người như trước.
async function autoReply(t, req) {
  const key = process.env.ANTHROPIC_API_KEY || "";
  const cfg = await getSupportCfg();
  if (!key || !cfg.aiOn) return t;
  let a;
  try { a = await aiAnswer(key, t); } catch (e) { console.error("cskh ai", e && e.message); return t; }
  const now = Date.now(), was = !!t.escalated, wasUrgent = !!t.urgent;
  t.msgs.push({ by: "ai", who: "ONTAP", text: a.reply, at: now });
  t.updated = now;
  if (a.escalate) {
    t.escalated = true; t.urgent = wasUrgent || a.urgent; t.aiSummary = a.summary || t.aiSummary || ""; t.status = "new";
    await redis([["SADD", FK.pending, t.id]]);
    await putThread(t);
    if (!was || (t.urgent && !wasUrgent)) {
      const host = String((req.headers && (req.headers["x-forwarded-host"] || req.headers.host)) || "on-tap-three.vercel.app");
      const proto = String((req.headers && req.headers["x-forwarded-proto"]) || (/^localhost|^127\./.test(host) ? "http" : "https")).split(",")[0];
      await alertAdmins(t, cfg.alertEmails, proto + "://" + host);
    }
  } else {
    t.status = "answered";
    await redis([["SREM", FK.pending, t.id]]);
    await putThread(t);
  }
  return t;
}

async function bumpDay(phone) {
  const [n] = await redis([["INCR", FK.rl(phone)]]);
  if (Number(n) === 1) await redis([["EXPIRE", FK.rl(phone), "86400"]]);
  return Number(n) > SEND_DAY_MAX;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return send(res, 405, { ok: false, error: "method" });
  if (!redisEnv()) return send(res, 200, { ok: false, error: "no_store" });
  if (Number((req.headers && req.headers["content-length"]) || 0) > BODY_MAX) return send(res, 413, { ok: false, error: "too_large" });
  let b;
  try { b = await readBody(req, BODY_MAX); } catch { return send(res, 400, { ok: false, error: "bad_json" }); }
  b = b && typeof b === "object" ? b : {};
  try {
    const u = await userOf(req);
    if (!u) return send(res, 200, { ok: false, error: "bad_token" });
    const phone = u.phone;
    switch (String(b.action || "")) {
      case "send": {
        const text = cleanText(b.text), kind = KINDS[b.kind] ? b.kind : "other";
        if (text.length < 3) return send(res, 200, { ok: false, error: "empty" });
        const img = cleanImg(b.img);
        if (img === null) return send(res, 200, { ok: false, error: "bad_img" });
        if (await bumpDay(phone)) return send(res, 200, { ok: false, error: "slow_down" });
        const who = b.who === "child" ? "child" : "parent";
        const kid = b.child && typeof b.child === "object" ? (u.acc.children || []).find((c) => c.id === String(b.child.id || "")) : null;
        const now = Date.now();
        const t = {
          v: 1, id: newId(), phone, kind, status: "new", created: now, updated: now, who,
          child: kid ? { id: kid.id, name: kid.name, grade: kid.grade || "" } : null,
          ctx: { ...meta(b), plan: u.acc.plan || 1, kids: (u.acc.children || []).length },
          msgs: [{ by: "user", who: who === "child" ? (kid ? kid.name : "Học sinh") : (u.acc.parentName || "Phụ huynh"), text, at: now, img: !!img }],
          lesson: "",
        };
        const cmds = [["SADD", FK.pending, t.id]];
        if (img) cmds.push(["SET", FK.img(t.id, 0), img]);
        await redis(cmds);
        await putThread(t);
        await autoReply(t, req);
        return send(res, 200, { ok: true, thread: pubThread(t) });
      }
      case "reply": {
        const id = String(b.id || ""), text = cleanText(b.text);
        const t = okId(id) ? await getThread(id) : null;
        if (!t || t.phone !== phone || !visible(t, viewer(b))) return send(res, 200, { ok: false, error: "not_found" });
        if (text.length < 1) return send(res, 200, { ok: false, error: "empty" });
        const img = cleanImg(b.img);
        if (img === null) return send(res, 200, { ok: false, error: "bad_img" });
        if (await bumpDay(phone)) return send(res, 200, { ok: false, error: "slow_down" });
        const now = Date.now(), n = t.msgs.length;
        const who = b.who === "child" ? "child" : "parent";
        const kid = b.child && typeof b.child === "object" ? (u.acc.children || []).find((c) => c.id === String(b.child.id || "")) : null;
        t.msgs.push({ by: "user", who: who === "child" ? (kid ? kid.name : "Học sinh") : (u.acc.parentName || "Phụ huynh"), text, at: now, img: !!img });
        t.status = "new"; t.updated = now;
        const cmds = [["SADD", FK.pending, t.id], ["SREM", FK.unread(phone), t.id]];
        if (img) cmds.push(["SET", FK.img(t.id, n), img]);
        await redis(cmds);
        await putThread(t);
        await autoReply(t, req);
        return send(res, 200, { ok: true, thread: pubThread(t) });
      }
      case "mine": {
        const [ids, unr] = await redis([["ZREVRANGE", FK.user(phone), "0", "49"], ["SMEMBERS", FK.unread(phone)]]);
        const list = (ids || []).length ? (await redis([["MGET", ...ids.map(FK.t)]]))[0] : [];
        const kid = viewer(b);
        const threads = (list || []).map((x) => { try { return JSON.parse(x); } catch { return null; } }).filter((t) => t && visible(t, kid)).map(pubThread);
        const un = new Set(unr || []);
        return send(res, 200, { ok: true, threads: threads.map((t) => ({ ...t, unread: un.has(t.id) })), unread: threads.filter((t) => un.has(t.id)).length });
      }
      case "seen": {
        const id = String(b.id || "");
        if (okId(id)) await redis([["SREM", FK.unread(phone), id]]);
        return send(res, 200, { ok: true, unread: await unreadFor(phone, viewer(b)) });
      }
      case "unread":
        return send(res, 200, { ok: true, unread: await unreadFor(phone, viewer(b)) });
      case "img": {
        const id = String(b.id || ""), n = Math.max(0, Math.min(200, Math.round(Number(b.n) || 0)));
        const t = okId(id) ? await getThread(id) : null;
        if (!t || t.phone !== phone) return send(res, 200, { ok: false, error: "not_found" });
        const [img] = await redis([["GET", FK.img(id, n)]]);
        return send(res, 200, { ok: !!img, img: img || "" });
      }
      default:
        return send(res, 400, { ok: false, error: "bad_action" });
    }
  } catch (e) {
    if (e && ["store_limit", "store_error", "no_store"].includes(e.code)) return send(res, 200, { ok: false, error: e.code });
    console.error("feedback error", e && e.message);
    return send(res, 500, { ok: false, error: "server" });
  }
}
