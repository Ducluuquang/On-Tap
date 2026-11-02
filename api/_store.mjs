// Kho dữ liệu dùng chung cho các hàm máy chủ mới (01/11/2026: tài khoản đăng nhập nhiều máy — api/account.mjs).
// Upstash Redis (REST) hoặc Redis thường (redis://). Chép đúng lớp kho đang chạy ổn của api/arena.mjs
// (arena.mjs giữ nguyên bản riêng của nó để không đụng tới phần Thi đấu).
import net from "node:net";
import tls from "node:tls";

/* ---------- Tiện ích trả lời / đọc yêu cầu ---------- */
const MAX_BODY = 100000;
export function send(res, status, obj) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(obj));
}
export async function readBody(req) {
  let b = req.body;
  if (Buffer.isBuffer(b)) b = b.toString("utf8");
  if (typeof b === "string") return JSON.parse(b || "{}");
  if (b && typeof b === "object") return b;
  const chunks = [];
  let size = 0;
  for await (const ch of req) {
    size += ch.length;
    if (size > MAX_BODY) { const e = new Error("too_large"); e.code = "too_large"; throw e; }
    chunks.push(ch);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
}
export const clean = (v, n) => String(v == null ? "" : v).replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim().slice(0, n);
export const parse = (s) => { try { return JSON.parse(s); } catch { return null; } };
export const clientIp = (req) => String((req.headers && req.headers["x-forwarded-for"]) || "").split(",")[0].trim() || "local";

/* ---------- Kho ---------- */
export function redisEnv() {
  const env = process.env, keys = Object.keys(env).sort();
  let url = env.UPSTASH_REDIS_REST_URL || env.KV_REST_API_URL || "";
  let token = env.UPSTASH_REDIS_REST_TOKEN || env.KV_REST_API_TOKEN || "";
  if (!url || !token) {
    for (const k of keys) {
      if (!url && /_REST_API_URL$|_REDIS_REST_URL$/.test(k) && /^https:\/\//.test(env[k] || "")) url = env[k];
      if (!token && /_REST_API_TOKEN$|_REDIS_REST_TOKEN$/.test(k) && !/READ_ONLY/.test(k)) token = env[k];
    }
  }
  if (url && token) return { kind: "rest", url: String(url).replace(/\/+$/, ""), token: String(token) };
  const isRedis = (v) => /^rediss?:\/\//.test(v || "");
  let tcp = isRedis(env.REDIS_URL) ? env.REDIS_URL : isRedis(env.KV_URL) ? env.KV_URL : "";
  if (!tcp) for (const k of keys) if (/REDIS_URL$|_KV_URL$/.test(k) && isRedis(env[k])) { tcp = env[k]; break; }
  return tcp ? { kind: "tcp", url: tcp } : null;
}
// Kho Upstash gói miễn phí có hạn mức lệnh mỗi tháng; hết hạn mức thì kho trả lỗi "max requests limit exceeded".
const LIMIT_RE = /requests? limit exceeded/i;
const storeErr = (msg) => { const e = new Error(msg); e.code = LIMIT_RE.test(String(msg)) ? "store_limit" : "store_error"; return e; };
function respEncode(cmds) {
  const parts = [];
  for (const c of cmds) {
    parts.push(Buffer.from("*" + c.length + "\r\n"));
    for (const a of c) { const b = Buffer.from(String(a), "utf8"); parts.push(Buffer.from("$" + b.length + "\r\n"), b, Buffer.from("\r\n")); }
  }
  return Buffer.concat(parts);
}
function respParse(buf, i) {
  if (i >= buf.length) return null;
  const end = buf.indexOf("\r\n", i);
  if (end < 0) return null;
  const t = String.fromCharCode(buf[i]), line = buf.toString("utf8", i + 1, end);
  if (t === "+") return { v: line, n: end + 2 };
  if (t === "-") return { v: { __err: line }, n: end + 2 };
  if (t === ":") return { v: Number(line), n: end + 2 };
  if (t === "$") {
    const len = Number(line);
    if (len < 0) return { v: null, n: end + 2 };
    const s = end + 2, e = s + len;
    if (buf.length < e + 2) return null;
    return { v: buf.toString("utf8", s, e), n: e + 2 };
  }
  if (t === "*") {
    const len = Number(line);
    if (len < 0) return { v: null, n: end + 2 };
    const arr = [];
    let p = end + 2;
    for (let k = 0; k < len; k++) { const r = respParse(buf, p); if (!r) return null; arr.push(r.v); p = r.n; }
    return { v: arr, n: p };
  }
  throw storeErr("unexpected reply type " + t);
}
function redisTcp(cfg, cmds) {
  return new Promise((resolve, reject) => {
    let u;
    try { u = new URL(cfg.url); } catch { return reject(storeErr("bad REDIS_URL")); }
    const host = u.hostname, port = Number(u.port) || 6379, secure = u.protocol === "rediss:";
    const user = decodeURIComponent(u.username || ""), pass = decodeURIComponent(u.password || "");
    const pre = [];
    if (pass) pre.push(user && user !== "default" ? ["AUTH", user, pass] : ["AUTH", pass]);
    const dbn = Number((u.pathname || "").slice(1)) || 0;
    if (dbn) pre.push(["SELECT", String(dbn)]);
    const all = pre.concat(cmds), out = [];
    let buf = Buffer.alloc(0), done = false;
    const sock = secure ? tls.connect({ host, port, servername: host }) : net.connect({ host, port });
    const finish = (err, val) => {
      if (done) return;
      done = true; clearTimeout(timer);
      try { sock.destroy(); } catch {}
      if (err) reject(err); else resolve(val);
    };
    const timer = setTimeout(() => finish(storeErr("timeout")), 9000);
    sock.setNoDelay(true);
    sock.once(secure ? "secureConnect" : "connect", () => sock.write(respEncode(all)));
    sock.on("data", (chunk) => {
      buf = Buffer.concat([buf, chunk]);
      try {
        while (out.length < all.length) { const r = respParse(buf, 0); if (!r) break; out.push(r.v); buf = buf.subarray(r.n); }
      } catch (e) { return finish(e); }
      if (out.length < all.length) return;
      const authErr = out.slice(0, pre.length).find((v) => v && v.__err);
      if (authErr) return finish(storeErr("auth: " + authErr.__err));
      const res = out.slice(pre.length), bad = res.find((v) => v && v.__err);
      if (bad) return finish(storeErr(bad.__err));
      finish(null, res);
    });
    sock.on("error", (e) => finish(storeErr(e.message)));
    sock.on("close", () => finish(storeErr("connection closed")));
  });
}
export async function redis(cmds) {
  const cfg = redisEnv();
  if (!cfg) { const e = new Error("no_store"); e.code = "no_store"; throw e; }
  if (cfg.kind === "tcp") return redisTcp(cfg, cmds.map((c) => c.map(String)));
  const r = await fetch(cfg.url + "/pipeline", {
    method: "POST",
    headers: { Authorization: "Bearer " + cfg.token, "Content-Type": "application/json" },
    body: JSON.stringify(cmds.map((c) => c.map(String))),
  });
  if (!r.ok) { const t = await r.text().catch(() => ""); throw storeErr("store " + r.status + " " + t.slice(0, 300)); }
  const out = await r.json();
  return out.map((x) => {
    if (x && x.error) throw storeErr(x.error);
    return x ? x.result : null;
  });
}
