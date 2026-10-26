// Ôn Tập: THI ĐẤU TỪ VỰNG qua mạng (chốt 22/10/2026 — file "sua 22 Oct 2026").
// Các bạn thi với nhau bằng các trò của Vở Spelling (trò chơi từ vựng trong Ôn Tập):
//  1) PHÒNG THI VỚI BẠN: ai tạo phòng thì nhận MÃ 6 SỐ (giữ nguyên tới khi người tạo rời phòng) và được chọn:
//     trò chơi, trình độ, PHẠM VI TỪ (gõ yêu cầu — "10 từ mới nhất", "100 từ dài nhất", "từ học 6 tháng trước"…
//     thì MỖI BẠN lấy từ trong kho của mình; gõ chủ đề / sách lớp mấy… thì AI tạo CHUNG một bộ từ), số phút mỗi ván.
//     Chơi nhiều ván, mỗi ván đổi cách chơi được; cuối buổi tổng hợp điểm và trao VƯƠNG MIỆN cho người thắng.
//  2) THÁCH ĐẤU NGẪU NHIÊN theo trình độ: chờ 1 phút chưa có bạn thật thì BẠN AI vào thi cùng. Bạn AI luôn được
//     ghi rõ là AI (không giả làm người thật) và luôn chơi kém con một chút để con được khích lệ.
//     (26/10/2026: trên màn hình người chơi máy hiện là "Bạn ONTAP <tên>" + 🤖 + nhãn "máy"; mọi chữ AI hiện cho người dùng đổi thành ONTAP.)
// Dữ liệu chung nằm ở Upstash Redis (mọi khoá bắt đầu bằng "arena:"). Chưa gắn kho cho dự án thì phần Thi đấu tự ẩn.
// Upstash tính theo LỆNH (gói miễn phí: 500.000 lệnh/tháng): mỗi lần máy hỏi máy chủ (2,5 giây/lần) chỉ tốn 5 lệnh
// lúc chờ, 6 lệnh lúc đang chơi. Hết hạn mức thì máy báo "Thi đấu tạm nghỉ" (lỗi store_limit), không treo.
// Không có ô chat; người chơi chỉ thấy tên + biểu tượng của nhau.
//  3) SCRABBLE (24/10/2026 — "như ngoài đời"): chơi THEO LƯỢT trên MỘT bàn chung 15×15 (2–4 người, có thể có Bạn AI),
//     bộ 100 quân (98 chữ + 2 quân trắng), mỗi người 7 chữ, đặt từ xong bốc thêm cho đủ 7; bỏ lượt = đổi cả 7 chữ.
//     Luật nhà (26/10/2026): một lượt ghép được nhiều từ nối liền nhau (hình chữ L, chữ T…), không chỉ một hàng.
//     Máy chủ giữ bàn, túi chữ, giá chữ của từng người, kiểm tra từ bằng từ điển và tính điểm (api/_scrabble/engine.mjs).
//     Ván kết thúc khi hết giờ, chủ phòng bấm kết thúc, hết chữ, hoặc ai cũng bỏ lượt 2 lần liền; máy trao vương miện.
//  4) NHIỀU TỪ, KHÔNG LẶP LẠI (24/10/2026): bạn nào sắp chơi hết bộ từ thì máy xin thêm ("more") — AI tạo thêm từ MỚI
//     cho cả phòng (lưu ở ô "w:<số ván>" của bảng điểm, nên mỗi lần hỏi phòng KHÔNG tốn thêm lệnh nào).
//
// GET  /api/arena            -> { ok, arena }  (arena = đã gắn kho dữ liệu chưa)
// POST /api/arena {action…}  -> hello | create | solo | join | config | start | sync | more | finish | again | leave | random | ai
//                               | ai_add | ai_remove | sb_move | sb_pass | sb_end

import crypto from "node:crypto";
import net from "node:net";
import tls from "node:tls";
import { LEVELS, promptTopic, API_URL, DEFAULT_MODEL } from "./spelling.mjs";
import { BANK } from "./_arena/words.mjs";   // bộ từ dự phòng (khi AI chưa trả lời được)

const GAME_IDS = ["bee", "missing", "scramble", "look", "register", "search", "memory", "rain", "wordle", "context", "sentence", "scrabble"];
const ROOM_TTL = 12 * 3600;            // phòng bỏ không 12 giờ thì tự xoá
const MAX_PLAYERS = 8;
const SB_MAX = 4;                      // Scrabble: 2–4 người (tính cả Bạn AI), như bộ cờ thật
// (ARENA_SB_* chỉ dùng khi chạy thử trên máy thử để rút ngắn thời gian; trên Vercel không đặt nên giữ số mặc định)
const SB_TURN_MS = Number(process.env.ARENA_SB_TURN_MS) || 120000;   // Scrabble: mỗi lượt tối đa 2 phút, quá giờ thì tự bỏ lượt
const SB_AWAY_MS = Number(process.env.ARENA_SB_AWAY_MS) || 30000;    // Scrabble: tới lượt mà máy của bạn đó im 30 giây (thoát ra, mất mạng) thì bỏ qua lượt
const SB_AI_THINK = Number(process.env.ARENA_SB_AI_THINK) || 2500;   // Scrabble: Bạn AI "nghĩ" 2,5 giây rồi mới đặt từ
const engine = () => import("./_scrabble/engine.mjs");   // chỉ nạp (kèm từ điển) khi có ván Scrabble
const WAIT_AI_MS = 60000;              // thách đấu ngẫu nhiên: chờ 1 phút rồi Bạn AI vào
const COUNTDOWN_MS = 4000;             // đếm ngược trước mỗi ván
const GRACE_MS = 6000;                 // hết giờ + 6 giây thì chốt ván
const ONLINE_MS = 20000;               // 20 giây không thấy máy gửi tin = mất kết nối
const PTS = 10;                        // đúng ngay lần đầu 10 điểm, lần sau 5 điểm
const AI_DAILY_CAP = 400;              // tối đa 400 lần nhờ AI tạo bộ từ mỗi ngày (bảo vệ khoá AI); quá thì dùng bộ từ dự phòng
const AI_NAMES = ["Mây", "Gió", "Sao", "Bin", "Na", "Tí", "Bơ", "Kem", "Mít", "Su"];
// Người chơi máy hiện là "Bạn ONTAP <tên>" + biểu tượng 🤖 + nhãn "máy" (anh chốt 26/10/2026: chữ hiện cho người dùng ghi ONTAP, không ghi AI)
const AI_PREFIX = "Bạn ONTAP ";
const TOPICS = ["Animals", "Food and drinks", "School", "Family", "Weather", "Sports", "Jobs", "Clothes", "Home", "Nature", "Travel", "Colors and shapes", "Health", "Hobbies"];

// Mỗi ván: AI tạo trước 25 từ; bạn nào sắp hết từ thì máy xin thêm ("more"): AI tạo thêm 25 từ MỚI cho cả phòng
// (tối đa 150 từ thêm mỗi ván). Không lặp lại từ trong ván, và tránh cả các từ đã chơi ở những ván trước trong phòng.
const ROUND_WORDS = 25;                // số từ AI tạo lúc bắt đầu ván
const MORE_STEP = 25;                  // mỗi lần xin thêm
const MORE_MAX = 150;                  // tối đa từ thêm mỗi ván
const HIST_MAX = 300;                  // nhớ tối đa 300 từ đã chơi ở các ván trước trong phòng (để không lặp lại)

/* ---------- Tiện ích ---------- */
const MAX_BODY = 200000;
function send(res, status, obj) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(obj));
}
async function readBody(req) {
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
const clean = (v, n) => String(v == null ? "" : v).replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim().slice(0, n);
const fold = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[đĐ]/g, "d").toLowerCase();
const int = (v, lo, hi) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : lo; };
const sha = (s) => crypto.createHash("sha256").update(String(s)).digest("base64url");
const rid = (n) => crypto.randomBytes(n).toString("base64url");
const pairs = (arr) => { const o = {}; if (Array.isArray(arr)) for (let i = 0; i + 1 < arr.length; i += 2) o[arr[i]] = arr[i + 1]; else if (arr && typeof arr === "object") Object.assign(o, arr); return o; };
const parse = (s) => { try { return JSON.parse(s); } catch { return null; } };
const levelOf = (id) => LEVELS.find((l) => l.id === id) || null;

/* ---------- Kho dữ liệu: Upstash Redis (REST) hoặc Redis thường (redis://) — chép từ app Vở Spelling ---------- */
function redisEnv() {
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
async function redis(cmds) {
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

/* ---------- Khoá trong kho ---------- */
// Mỗi phòng: room (thông tin phòng + tổng điểm cả buổi), pl (người chơi), seen (lúc có mặt), sc (điểm từng ván).
const K = {
  room: (c) => "arena:room:" + c,
  rpl: (c) => "arena:room:" + c + ":pl",
  seen: (c) => "arena:room:" + c + ":seen",
  sc: (c) => "arena:room:" + c + ":sc",
  closed: (c, n) => "arena:room:" + c + ":closed:" + n,
  lock: (c) => "arena:room:" + c + ":lock",
  claim: (c) => "arena:room:" + c + ":claim",
  more: (c, n, k) => "arena:room:" + c + ":more:" + n + ":" + k,   // chỉ một máy nhờ AI tạo thêm từ cho mỗi lần thêm
  q: (lv) => "arena:q:" + lv,
  rl: (k) => "arena:rl:" + k,
};
const roomKeys = (c) => [K.room(c), K.rpl(c), K.seen(c), K.sc(c)];

async function limited(key, max, ttl) {
  const [n] = await redis([["INCR", K.rl(key)]]);
  if (Number(n) === 1) await redis([["EXPIRE", K.rl(key), ttl]]);
  return Number(n) > max;
}

/* ---------- Người chơi: mỗi con một mã người chơi + chìa khoá riêng (lưu trên máy của con) ----------
   Chìa khoá = chữ ký HMAC của mã người chơi (khoá ký lấy từ thông tin bí mật của kho, chỉ máy chủ biết), nên kiểm tra
   chìa khoá không cần hỏi kho — mỗi lần máy hỏi máy chủ bớt được 1 lệnh (Upstash tính tiền theo lệnh).
   Tên, biểu tượng, lớp của con: máy gửi kèm mỗi lần (chỉ để hiện cho các bạn trong phòng thấy). */
const signKey = () => { const c = redisEnv(); return sha("arena-sign|" + (c ? c.token || c.url : "")); };
const tokenFor = (pid) => crypto.createHmac("sha256", signKey()).update("arena-player|" + pid).digest("base64url");
function auth(req, body) {
  const m = /^Bearer ([A-Za-z0-9_-]{20,80})$/.exec(String(req.headers.authorization || ""));
  const pid = String((body && body.pid) || "");
  if (!m || !/^p[A-Za-z0-9_-]{8,24}$/.test(pid)) return null;
  const a = Buffer.from(m[1]), b = Buffer.from(tokenFor(pid));
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  return { pid, ...profileOf(body) };
}
function profileOf(body) {
  return { n: clean(body.name, 20) || "Bạn nhỏ", i: Array.from(clean(body.icon, 16)).slice(0, 4).join("") || "🙂", g: clean(body.grade, 16) };
}

/* ---------- Phạm vi từ: hiểu yêu cầu của chủ phòng ---------- */
// scope "own": mỗi bạn lấy từ trong kho từ của CHÍNH MÌNH theo cách chọn (mới nhất, dài nhất, học N tháng trước…)
// scope "common": cả phòng chung một bộ từ do AI tạo theo chủ đề/yêu cầu (hoặc chủ đề ngẫu nhiên khi để trống).
export function parseRule(reqRaw) {
  const req = clean(reqRaw, 120), t = fold(req);
  const cntM = t.match(/(\d{1,3})\s*(tu|word|cau)\b/);
  const ago = t.match(/(\d{1,2})\s*(ngay|tuan|thang|nam)\s*(truoc|qua)\b/);
  const anyNum = t.match(/\b(\d{1,3})\b/);
  const count = (d) => Math.max(4, Math.min(100, Number(cntM ? cntM[1] : (!ago && anyNum ? anyNum[1] : d))));
  const own = (order, d, extra) => ({ scope: "own", order, count: count(d), ...(extra || {}) });
  const common = /\bsach\b|\blop\s*\d|\bunit\b|chu de|\bgrade\b|\bielts\b|\btoeic\b|\bsat\b/.test(t);
  let rule;
  if (!req) rule = { scope: "common", topic: "" };
  else if (common) rule = { scope: "common", topic: req };
  else if (ago) rule = own("ago", 20, { days: Number(ago[1]) * { ngay: 1, tuan: 7, thang: 30, nam: 365 }[ago[2]] });
  else if (/moi nhat|moi hoc|vua hoc|gan day|gan nhat|moi them/.test(t)) rule = own("newest", 10);
  else if (/cu nhat|lau nhat|dau tien|tu lau/.test(t)) rule = own("oldest", 10);
  else if (/dai nhat/.test(t)) rule = own("longest", 20);
  else if (/ngan nhat/.test(t)) rule = own("shortest", 20);
  else if (/hay sai|sai nhieu|kho nhat|chua thuoc|hay quen/.test(t)) rule = own("weak", 15);
  else if (/cua (minh|em|con|toi|ban)|kho tu|bo tu cua|tu da hoc|ngau nhien|bat ky/.test(t)) rule = own("random", 20);
  else rule = { scope: "common", topic: req };
  return { req, rule, text: ruleText(rule) };
}
function ruleText(r) {
  if (r.scope === "common") return (r.topic ? `Cả phòng chung bộ từ ONTAP tạo: “${r.topic}”` : "Cả phòng chung bộ từ ONTAP tạo theo trình độ (chủ đề ngẫu nhiên)") + " · hết từ thì ONTAP tạo thêm, không lặp lại";
  const n = r.count;
  const what = {
    newest: `${n} từ mới học gần nhất`, oldest: `${n} từ học lâu nhất`, longest: `${n} từ dài nhất`, shortest: `${n} từ ngắn nhất`,
    weak: `${n} từ hay sai nhất`, random: `${n} từ ngẫu nhiên`,
    ago: `${n} từ học khoảng ${r.days >= 365 ? Math.round(r.days / 365) + " năm" : r.days >= 30 ? Math.round(r.days / 30) + " tháng" : r.days >= 7 ? Math.round(r.days / 7) + " tuần" : r.days + " ngày"} trước`,
  }[r.order];
  return `Mỗi bạn: ${what} trong kho từ của mình trước, rồi sang các từ khác · không lặp lại`;
}

/* ---------- AI tạo bộ từ chung cho ván (dùng đúng lời dặn AI của Vở Spelling) ---------- */
function cleanWord(v) {
  let w = String(v || "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[’‘`´]/g, "'").replace(/["“”!?.,;:()]/g, " ").replace(/\s+/g, " ").trim();
  if (!w || /[^A-Za-z' -]/.test(w) || !/[A-Za-z]/.test(w)) return "";
  w = w.replace(/^[-' ]+|[-' ]+$/g, "");
  return w && w.length <= 40 ? w : "";
}
function parseWords(text) {
  const out = [], seen = new Set();
  let name = "";
  for (let line of String(text || "").split("\n")) {
    line = line.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim().replace(/,\s*$/, "");
    if (!line.startsWith("{")) continue;
    const o = parse(line);
    if (!o || typeof o !== "object") continue;
    if (!o.w) { if (o.name) name = clean(o.name, 60); continue; }
    const w = cleanWord(o.w);
    if (!w || seen.has(w.toLowerCase())) continue;
    seen.add(w.toLowerCase());
    const e = Array.from(String(o.e || "").trim()).slice(0, 8).join("");
    out.push({ w, vi: clean(o.vi, 80), ex: clean(o.ex, 160), e: /[A-Za-z0-9]/.test(e) ? "" : e });
  }
  return { name, words: out };
}
// avoid: các từ đã có trong ván / đã chơi ở ván trước — AI được dặn không lặp lại (máy chủ vẫn lọc lại lần nữa).
async function aiWords(topic, levelId, count, avoid) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;
  try { if (await limited("ai:" + new Date().toISOString().slice(0, 10), AI_DAILY_CAP, 90000)) return null; } catch { return null; }
  const level = levelOf(levelId) || LEVELS[1];
  const content = promptTopic(topic, level, count || ROUND_WORDS, "common", (avoid || []).slice(-HIST_MAX));
  const models = [...new Set([process.env.ANTHROPIC_MODEL, DEFAULT_MODEL].map((x) => String(x || "").trim()).filter(Boolean))];
  for (const model of models) {
    const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), 40000);
    let r;
    try {
      r = await fetch(API_URL, {
        method: "POST", signal: ctl.signal,
        headers: { "x-api-key": String(key).trim(), "anthropic-version": "2023-06-01", "content-type": "application/json" },
        body: JSON.stringify({ model, max_tokens: 5000, messages: [{ role: "user", content }] }),
      });
    } catch (e) { clearTimeout(timer); console.error("arena ai:", e && e.message); return null; }
    clearTimeout(timer);
    const j = await r.json().catch(() => null);
    if (r.ok) {
      const text = ((j && j.content) || []).filter((b) => b && b.type === "text").map((b) => b.text || "").join("");
      const res = parseWords(text);
      return res.words.length >= 6 ? res : null;
    }
    const msg = (j && j.error && j.error.message) || "";
    console.error("arena ai error:", r.status, msg.slice(0, 120));
    if (!(r.status === 404 || (r.status === 400 && /model/i.test(msg)))) return null;
  }
  return null;
}

const lc = (w) => String((w && w.w) || "").toLowerCase();
function shuffled(a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = crypto.randomInt(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; }
// Bộ từ dự phòng: lấy ngẫu nhiên tối đa n từ CHƯA có trong "avoid".
function bankWords(avoid, n) {
  const out = [];
  for (const w of shuffled(BANK)) { if (out.length >= n) break; if (!avoid.has(lc(w))) out.push({ ...w }); }
  return out;
}
// Chủ đề ngẫu nhiên khác chủ đề vừa dùng (khi chủ phòng để trống phạm vi từ, mỗi lần thêm từ đổi chủ đề cho phong phú)
function pickTopic(prev) { const pool = TOPICS.filter((t) => t !== prev); return pool[crypto.randomInt(pool.length)]; }
// Từ đã có trong ván này (bộ đầu + các lần thêm) và từ của các ván trước trong phòng: không lặp lại
function usedWords(st) {
  const r = st.meta.round;
  return new Set([...(st.meta.hist || []), ...((r && r.words) || []).map(lc), ...(st.extra || []).map(lc)]);
}

/* ---------- Đọc phòng (một lần gọi kho) ---------- */
async function readRoom(code, pre) {
  const out = await redis((pre || []).concat([["GET", K.room(code)], ["HGETALL", K.rpl(code)], ["HGETALL", K.seen(code)], ["HGETALL", K.sc(code)]]));
  const [metaRaw, plRaw, seenRaw, scRaw] = out.slice((pre || []).length);
  const meta = metaRaw && parse(metaRaw);
  if (!meta) return null;
  const seen = pairs(seenRaw), sc = pairs(scRaw), plm = pairs(plRaw);
  const players = Object.entries(plm).map(([pid, v]) => ({ pid, ...(parse(v) || {}) })).sort((a, b) => (a.j || 0) - (b.j || 0));
  const n = meta.n || 0, scores = {};
  for (const [f, v] of Object.entries(sc)) { const i = f.indexOf(":"); if (i > 0 && Number(f.slice(0, i)) === n) scores[f.slice(i + 1)] = parse(v) || {}; }
  const totals = {};
  for (const [pid, v] of Object.entries(meta.tot || {})) totals[pid] = Number(v) || 0;
  // từ thêm của ván đang chơi (ô "w:<số ván>" trong bảng điểm — đọc cùng lúc với điểm, không tốn thêm lệnh)
  const ex = parse(sc["w:" + n] || "null"), extra = Array.isArray(ex) ? ex : [];
  return { meta, players, seen, scores, totals, extra };
}

/* ---------- Bạn AI: luôn ghi rõ là AI; bám sát con (khoảng 75–92% điểm của con) và luôn kém con ít nhất 1–2 từ,
   để cuộc đua hồi hộp mà con luôn thắng (đúng ý "luôn để người chơi thật thắng để khích lệ"). ---------- */
const aiMargin = (pid) => PTS * (1 + (sha(pid).charCodeAt(0) % 2));
const aiRatio = (pid) => 0.75 + (sha(pid).charCodeAt(1) % 18) / 100;
function aiScore(st, ai, now) {
  const r = st.meta.round;
  if (!r) return { p: 0, d: 0, c: 0, f: 0 };
  const best = Math.max(0, ...st.players.filter((p) => !p.ai).map((p) => Number((st.scores[p.pid] || {}).p) || 0));
  const p = Math.max(0, Math.min(best - aiMargin(ai.pid), Math.floor((best * aiRatio(ai.pid)) / PTS) * PTS));
  return { p, d: p / PTS, c: p / PTS, f: now >= r.end ? 1 : 0 };
}
function ranking(st, now) {
  const rows = st.players.map((pl) => {
    const s = pl.ai ? aiScore(st, pl, now) : (st.scores[pl.pid] || {});
    return { pid: pl.pid, n: pl.n, i: pl.i, ai: !!pl.ai, p: Number(s.p) || 0, d: Number(s.d) || 0, c: Number(s.c) || 0 };
  });
  rows.sort((a, b) => b.p - a.p || (a.ai - b.ai) || b.c - a.c);
  let place = 0, prev = null;
  rows.forEach((r, i) => { if (prev === null || r.p !== prev) place = i + 1; prev = r.p; r.place = place; });
  return rows;
}

/* ---------- Chốt ván: hết giờ, hoặc mọi bạn (đang kết nối) đã xong ---------- */
function shouldClose(st, now) {
  const r = st.meta.round;
  if (st.meta.status !== "playing" || !r || r.game === "scrabble") return false;   // Scrabble chốt ván riêng (sbAuto)
  if (now >= r.end + GRACE_MS) return true;
  const humans = st.players.filter((p) => !p.ai && now - Number(st.seen[p.pid] || 0) < ONLINE_MS);
  return now >= r.start && humans.length > 0 && humans.every((p) => (st.scores[p.pid] || {}).f);
}
async function closeRound(code, st, now) {
  const r = st.meta.round;
  const [ok] = await redis([["SET", K.closed(code, r.n), "1", "NX", "EX", ROOM_TTL]]);
  if (ok !== "OK") return false;
  const rank = ranking(st, now);
  // Tổng điểm cả buổi nằm ngay trong thông tin phòng (chỉ một máy chốt được mỗi ván nhờ cờ NX ở trên).
  const tot = { ...(st.meta.tot || {}) };
  for (const x of rank) if (x.p > 0) tot[x.pid] = (Number(tot[x.pid]) || 0) + x.p;
  // nhớ các từ của ván này để ván sau AI tạo từ khác (không lặp lại)
  const hist = [...usedWords(st)].slice(-HIST_MAX);
  const meta = { ...st.meta, status: "results", tot, hist, last: { n: r.n, game: r.game, minutes: r.minutes, ruleText: r.ruleText, rank }, round: { ...r, words: null } };
  await redis([["SET", K.room(code), JSON.stringify(meta), "EX", ROOM_TTL], ["HDEL", K.sc(code), "w:" + r.n], ["EXPIRE", K.sc(code), ROOM_TTL]]);
  st.extra = [];
  st.meta = meta;
  st.totals = { ...tot };
  return true;
}

/* ---------- Bắt đầu một ván (AI tạo bộ từ chung khi cần) ---------- */
async function startRound(code, st) {
  const cfg = st.meta.cfg, n = (st.meta.n || 0) + 1;
  let words = null, src = "own", setName = "", sb = null, topic = "";
  if (cfg.game === "scrabble") {
    // Scrabble: bàn chung, đi theo lượt. Thứ tự: các bạn thật (bốc thăm ngẫu nhiên) rồi mới tới Bạn AI.
    if (st.players.length < 2 || st.players.length > SB_MAX) { const e = new Error("sb_players"); e.code = "sb_players"; throw e; }
    const humans = st.players.filter((p) => !p.ai).map((p) => p.pid);
    for (let i = humans.length - 1; i > 0; i--) { const j = crypto.randomInt(i + 1); [humans[i], humans[j]] = [humans[j], humans[i]]; }
    const E = await engine();
    sb = E.newGame(humans.concat(st.players.filter((p) => p.ai).map((p) => p.pid)), Date.now() + COUNTDOWN_MS);
    src = "scrabble"; setName = "Scrabble";
  } else if (cfg.rule.scope === "common") {
    // bộ từ chung: tránh các từ đã chơi ở những ván trước trong phòng
    topic = cfg.rule.topic || TOPICS[crypto.randomInt(TOPICS.length)];
    const hist = st.meta.hist || [], avoid = new Set(hist);
    const res = await aiWords(topic, st.meta.level, ROUND_WORDS, hist);
    if (res) {
      words = res.words.filter((w) => !avoid.has(lc(w)));
      if (words.length < 10) words = words.concat(bankWords(new Set([...avoid, ...words.map(lc)]), ROUND_WORDS - words.length));
      src = "ai"; setName = res.name || topic;
    } else {
      words = bankWords(avoid, ROUND_WORDS);
      if (words.length < 10) words = bankWords(new Set(), ROUND_WORDS);   // đã chơi gần hết bộ dự phòng: dùng lại từ đầu
      src = "fallback"; setName = "Từ thông dụng";
    }
  }
  const start = Date.now() + COUNTDOWN_MS;
  const round = { n, game: cfg.game, minutes: cfg.minutes, rule: cfg.rule, ruleText: cfg.ruleText, level: st.meta.level, start, end: start + cfg.minutes * 60000, words, src, setName, topic };
  if (sb) { sb.turnStart = start; round.sb = sb; round.turnMs = SB_TURN_MS; round.ruleText = "Scrabble: mỗi bạn 7 chữ, đặt từ lên bàn chung"; }
  const meta = { ...st.meta, status: "playing", n, round, prep: 0 };
  // Ô "-" giữ cho bảng điểm luôn có sẵn (để đặt hạn tự xoá ngay từ đầu ván), nên mỗi lần máy gửi điểm không cần đặt lại hạn.
  // Xoá ô từ thêm của ván trước (nếu còn sót).
  await redis([["SET", K.room(code), JSON.stringify(meta), "EX", ROOM_TTL], ["HSET", K.sc(code), "-", "1"], ["HDEL", K.sc(code), "w:" + (n - 1), "w:" + n], ...roomKeys(code).slice(1).map((k) => ["EXPIRE", k, ROOM_TTL])]);
  st.meta = meta; st.scores = {}; st.extra = [];
  return meta;
}

/* ---------- Gửi trạng thái phòng về máy ---------- */
// wn: ván mà máy đã có bộ từ; wx: số từ thêm máy đã có (chỉ "sync" gửi) -> chỉ gửi phần từ thêm máy chưa có.
function view(st, pid, now, wn, wx) {
  const m = st.meta, r = m.round;
  const ex = r && m.status === "playing" && r.game !== "scrabble" ? st.extra || [] : [];
  let more;
  if (wx != null && ex.length) { const from = wn === r.n && wx <= ex.length ? wx : 0; if (from < ex.length) more = { from, list: ex.slice(from) }; }
  const players = st.players.map((p) => ({ pid: p.pid, name: p.n, icon: p.i, grade: p.g || "", ai: !!p.ai, owner: p.pid === m.owner, online: !!p.ai || now - Number(st.seen[p.pid] || 0) < ONLINE_MS }));
  const scores = {};
  const sb = r && r.game === "scrabble" ? r.sb : null;
  for (const p of st.players) {
    if (sb) { if (sb.order.includes(p.pid)) scores[p.pid] = { p: Number(sb.scores[p.pid]) || 0, d: (sb.words[p.pid] || []).length, c: (sb.words[p.pid] || []).length, f: 0 }; continue; }
    const s = p.ai ? aiScore(st, p, now) : st.scores[p.pid];
    if (s) scores[p.pid] = { p: Number(s.p) || 0, d: Number(s.d) || 0, c: Number(s.c) || 0, f: s.f ? 1 : 0 };
  }
  return {
    ok: true, now, me: pid, code: m.code, owner: m.owner, mode: m.mode, status: m.status, level: m.level, cfg: m.cfg, n: m.n || 0,
    prep: !!m.prep, waitStart: m.waitStart || 0, closedBy: m.closedBy || "",
    round: r ? { n: r.n, game: r.game, minutes: r.minutes, ruleText: r.ruleText, rule: r.rule, level: r.level, start: r.start, end: r.end, src: r.src, setName: r.setName, words: wn === r.n ? undefined : r.words, ...(more ? { more } : {}), ...(sb ? { sb: sbView(sb, pid), turnMs: r.turnMs || SB_TURN_MS } : {}) } : null,
    players, scores, totals: st.totals, last: m.last || null,
  };
}

/* ---------- Scrabble: trạng thái gửi về máy (giá chữ của bạn khác và túi chữ được giấu) ---------- */
function sbView(sb, pid) {
  const counts = {};
  for (const p of sb.order) counts[p] = String(sb.racks[p] || "").length;
  return { v: sb.v, board: sb.board, order: sb.order, turn: sb.turn, turnStart: sb.turnStart, scores: sb.scores, bag: String(sb.bag || "").length, counts,
    rack: sb.order.includes(pid) ? String(sb.racks[pid] || "") : null, moves: sb.moves.slice(-12), last: sb.last || [], over: sb.over || 0, reason: sb.reason || "", words: sb.words || {} };
}
// Khoá phòng trong lúc đổi bàn cờ (đặt từ, bỏ lượt, Bạn AI đi, chốt ván) để hai máy không ghi đè nhau.
const UNLOCK = "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end";
async function lockRoom(code, ms) {
  const tok = rid(8);
  const [ok] = await redis([["SET", K.lock(code), tok, "NX", "PX", ms || 9000]]);
  return ok === "OK" ? tok : null;
}
async function unlockRoom(code, tok) { try { await redis([["EVAL", UNLOCK, "1", K.lock(code), tok]]); } catch { /* khoá tự hết hạn */ } }
// Có việc máy chủ phải tự làm không: hết giờ / hết ván, tới lượt Bạn AI, quá giờ lượt, hoặc bạn tới lượt đã rời phòng / vắng mặt.
function sbDue(st, now) {
  const r = st.meta.round, sb = r && r.sb;
  if (st.meta.status !== "playing" || !sb) return false;
  if (now >= r.end || sb.over) return true;
  if (now < r.start) return false;
  const pid = sb.order[sb.turn], pl = st.players.find((p) => p.pid === pid), since = now - Math.max(r.start, sb.turnStart);
  if (!pl) return true;
  if (pl.ai) return since >= SB_AI_THINK;
  if (since >= SB_TURN_MS) return true;
  return since >= SB_AWAY_MS && now - Number(st.seen[pid] || 0) >= SB_AWAY_MS;
}
async function sbAuto(code, st, now) {
  if (!sbDue(st, now)) return;
  const tok = await lockRoom(code);
  if (!tok) return;   // máy khác đang làm
  try {
    const fresh = await readRoom(code);
    if (!fresh) return;
    await sbAdvance(code, fresh, Date.now());
    Object.assign(st, fresh);
  } finally { await unlockRoom(code, tok); }
}
async function sbAdvance(code, st, now) {
  const E = await engine();
  let changed = false;
  for (let step = 0; step < 8; step++) {
    const r = st.meta.round, sb = r && r.sb;
    if (st.meta.status !== "playing" || !sb) return;
    if (now >= r.end || sb.over) { await sbClose(code, st, now, sb.over ? sb.reason : "time", E); return; }
    if (!sbDue(st, now)) break;
    const pid = sb.order[sb.turn], pl = st.players.find((p) => p.pid === pid);
    if (pl && pl.ai) await sbAiTurn(st, pl, E, now);
    else E.applyPass(sb, pid, now, pl && now - Math.max(r.start, sb.turnStart) >= SB_TURN_MS ? "time" : "away");
    changed = true;
    if (sb.over) { await sbClose(code, st, now, sb.reason, E); return; }
  }
  if (changed) await redis([["SET", K.room(code), JSON.stringify(st.meta), "EX", ROOM_TTL]]);
}
// Bạn AI: đặt từ thông dụng thật (theo luật), nhưng luôn giữ điểm thấp hơn bạn thật đang dẫn đầu một chút
// (đúng ý "luôn để người chơi thật thắng để khích lệ"); không có nước nào như vậy thì bỏ lượt (đổi chữ).
async function sbAiTurn(st, ai, E, now) {
  const sb = st.meta.round.sb, dict = await E.getDict();
  const humans = st.players.filter((p) => !p.ai && sb.order.includes(p.pid));
  let bound = null;
  if (humans.length) {
    const best = humans.reduce((a, p) => ((sb.scores[p.pid] || 0) > (sb.scores[a.pid] || 0) ? p : a));
    const margin = sb.bag.length <= 7 ? 5 + E.rackValue(sb.racks[best.pid]) : 3;
    bound = (sb.scores[best.pid] || 0) - margin - (sb.scores[ai.pid] || 0);
  }
  const { moves } = E.findMoves(sb, sb.racks[ai.pid], dict, 1500);
  let pick = null;
  for (const mv of moves) {
    const res = E.checkMove(sb, ai.pid, mv, dict);
    if (!res.ok) continue;
    if (!sb.bag.length && !res.rackLeft.length && humans.length) continue;   // không đặt hết chữ trước bạn thật
    if (bound != null && res.score > bound) continue;
    if (!pick || res.score > pick.score) pick = res;
  }
  if (pick) E.applyPlay(sb, ai.pid, pick, now); else E.applyPass(sb, ai.pid, now, "pass");
}
// Chốt ván Scrabble: tính điểm cuối, xếp hạng, cộng vào tổng điểm cả buổi; xoá túi chữ và giá chữ (không cần nữa).
async function sbClose(code, st, now, reason, E) {
  const r = st.meta.round, sb = r.sb;
  sb.over = 1; sb.reason = reason;
  const fin = E.finalScores(sb, reason);
  const rows = st.players.filter((p) => sb.order.includes(p.pid)).map((p) => ({ pid: p.pid, n: p.n, i: p.i, ai: !!p.ai, p: fin[p.pid].total, base: fin[p.pid].base, adj: fin[p.pid].adj, w: (sb.words[p.pid] || []).length }));
  rows.sort((a, b) => b.p - a.p || (a.ai - b.ai));
  let place = 0, prev = null;
  rows.forEach((x, i) => { if (prev === null || x.p !== prev) place = i + 1; prev = x.p; x.place = place; });
  const tot = { ...(st.meta.tot || {}) };
  for (const x of rows) if (x.p > 0) tot[x.pid] = (Number(tot[x.pid]) || 0) + x.p;
  const last = { n: r.n, game: "scrabble", minutes: r.minutes, ruleText: "Scrabble", rank: rows, sb: { reason, board: sb.board, words: sb.words } };
  const meta = { ...st.meta, status: "results", tot, last, round: { ...r, sb: { ...sb, bag: "", racks: {} } } };
  await redis([["SET", K.room(code), JSON.stringify(meta), "EX", ROOM_TTL], ["SET", K.closed(code, r.n), "1", "EX", ROOM_TTL]]);
  st.meta = meta;
  st.totals = { ...tot };
}

function defaultLevel(grade) {
  const g = Number((String(grade || "").match(/\d+/) || [])[0]);
  return !g ? "k35" : g <= 2 ? "k12" : g <= 5 ? "k35" : g <= 9 ? "k69" : "k1012";
}
async function newCode(meta) {
  for (let i = 0; i < 12; i++) {
    const code = String(crypto.randomInt(100000, 1000000));
    const [ok] = await redis([["SET", K.room(code), JSON.stringify({ ...meta, code }), "NX", "EX", ROOM_TTL]]);
    if (ok === "OK") return code;
  }
  throw storeErr("no_code");
}
const playerRec = (me, extra) => JSON.stringify({ n: me.n, i: me.i, g: me.g, j: Date.now(), ...(extra || {}) });
// Bạn AI: tên không trùng với Bạn AI khác trong phòng, biểu tượng 🤖, luôn có cờ ai (máy hiện nhãn "AI").
function aiRec(j, usedNames) {
  const free = AI_NAMES.filter((n) => !(usedNames || []).includes(AI_PREFIX + n));
  const pool = free.length ? free : AI_NAMES;
  return { n: AI_PREFIX + pool[crypto.randomInt(pool.length)], i: "🤖", g: "", ai: 1, j };
}
// Số phút mỗi ván: Scrabble 5–90 phút, các trò khác 1–10 phút.
const minutesFor = (game, m) => (game === "scrabble" ? int(m, 5, 90) : int(m, 1, 10));

/* ---------- Máy chủ ---------- */
export default async function handler(req, res) {
  if (req.method === "GET") return send(res, 200, { ok: true, arena: !!redisEnv() });
  if (req.method !== "POST") { res.setHeader("Allow", "GET, POST"); return send(res, 405, { error: "method" }); }
  if (!redisEnv()) return send(res, 503, { error: "no_store" });
  let body;
  try { body = await readBody(req); } catch { return send(res, 400, { error: "bad_request" }); }
  const action = String((body && body.action) || "");
  try {
    if (action === "hello") return await hello(req, res, body);
    const me = auth(req, body);
    if (!me) return send(res, 401, { error: "auth" });
    const now = Date.now();
    if (action === "create") {
      if (await limited("create:" + me.pid, 20, 3600)) return send(res, 429, { error: "slow_down" });
      const level = levelOf(body.level) ? body.level : defaultLevel(me.g);
      const pr = parseRule("");
      const meta = { v: 1, owner: me.pid, mode: "friends", status: "lobby", created: now, level, n: 0, cfg: { game: "bee", minutes: 3, req: pr.req, rule: pr.rule, ruleText: pr.text } };
      const code = await newCode(meta);
      await redis([["HSET", K.rpl(code), me.pid, playerRec(me)], ["HSET", K.seen(code), me.pid, now], ...roomKeys(code).slice(1, 3).map((k) => ["EXPIRE", k, ROOM_TTL])]);
      const st = await readRoom(code);
      return send(res, 200, view(st, me.pid, now));
    }
    if (action === "solo") {
      // Scrabble với Bạn AI: tạo phòng (vẫn gửi mã cho bạn vào chơi các ván sau được), thêm Bạn AI rồi bắt đầu luôn.
      if (await limited("create:" + me.pid, 20, 3600)) return send(res, 429, { error: "slow_down" });
      const level = levelOf(body.level) ? body.level : defaultLevel(me.g);
      const pr = parseRule("");
      const meta = { v: 1, owner: me.pid, mode: "friends", status: "lobby", created: now, level, n: 0, cfg: { game: "scrabble", minutes: int(body.minutes || 20, 5, 90), req: "", rule: pr.rule, ruleText: pr.text } };
      const code = await newCode(meta);
      await redis([["HSET", K.rpl(code), me.pid, playerRec(me, { j: now }), "ai" + rid(6), JSON.stringify(aiRec(now + 1, []))], ["HSET", K.seen(code), me.pid, now], ...roomKeys(code).slice(1, 3).map((k) => ["EXPIRE", k, ROOM_TTL])]);
      const st = await readRoom(code);
      await startRound(code, st);
      return send(res, 200, view(st, me.pid, Date.now()));
    }
    const code = String(body.code || "");
    if (!/^\d{6}$/.test(code) && action !== "random") return send(res, 400, { error: "bad_code" });

    if (action === "random") return await random(res, me, body, now);

    if (action === "join") {
      const st = await readRoom(code);
      if (!st || st.meta.status === "closed") return send(res, 404, { error: "no_room" });
      if (st.meta.mode !== "friends") return send(res, 403, { error: "random_room" });
      if (!st.players.some((p) => p.pid === me.pid)) {
        if (st.players.length >= MAX_PLAYERS) return send(res, 409, { error: "full" });
        await redis([["HSET", K.rpl(code), me.pid, playerRec(me)], ["HSET", K.seen(code), me.pid, now], ["EXPIRE", K.rpl(code), ROOM_TTL], ["EXPIRE", K.seen(code), ROOM_TTL]]);
        st.players.push({ pid: me.pid, n: me.n, i: me.i, g: me.g, j: now }); st.seen[me.pid] = now;
      }
      return send(res, 200, view(st, me.pid, now));
    }

    // Các việc còn lại: phải là thành viên phòng. "sync" ghi lúc có mặt + điểm của mình trong CÙNG một lần gọi kho.
    const pre = [["HSET", K.seen(code), me.pid, now]];
    if (action === "sync" && body.n) {
      const s = { p: int(body.p, 0, 100000), d: int(body.d, 0, 10000), c: int(body.c, 0, 10000), f: body.f ? 1 : 0, t: now };
      pre.push(["HSET", K.sc(code), int(body.n, 1, 100000) + ":" + me.pid, JSON.stringify(s)]);
    }
    const st = await readRoom(code, pre);
    if (!st) return send(res, 404, { error: "no_room" });
    const member = st.players.some((p) => p.pid === me.pid);
    if (!member && st.meta.status !== "closed") return send(res, 403, { error: "not_member" });
    const isOwner = st.meta.owner === me.pid;

    if (action === "sync") {
      const r = st.meta.round;
      if (st.meta.status === "playing" && r && r.game === "scrabble") await sbAuto(code, st, now);   // Bạn AI đi, quá giờ lượt, hết ván…
      else if (shouldClose(st, now)) await closeRound(code, st, now);
      return send(res, 200, view(st, me.pid, Date.now(), int(body.wn, 0, 100000), body.wx == null ? null : int(body.wx, 0, 100000)));
    }
    if (action === "more") {
      // Bạn nào sắp chơi hết bộ từ: AI tạo thêm 25 từ MỚI (không trùng từ đã có trong ván và các ván trước) cho cả phòng.
      // Nhiều máy cùng xin một lúc thì chỉ một máy nhờ AI (cờ NX), các máy khác nhận từ mới ở lần hỏi phòng sau.
      const r = st.meta.round, n = int(body.n, 0, 100000), wx = int(body.wx, 0, 100000);
      if (!member) return send(res, 403, { error: "not_member" });
      if (st.meta.status !== "playing" || !r || r.n !== n || r.game === "scrabble") return send(res, 200, { ok: true, n, done: true });
      const ex = st.extra || [];
      if (ex.length > wx) return send(res, 200, { ok: true, n, more: { from: wx, list: ex.slice(wx) } });
      if (ex.length >= MORE_MAX || now > r.end - 15000) return send(res, 200, { ok: true, n, done: true });
      const [lk] = await redis([["SET", K.more(code, n, ex.length), me.pid, "NX", "EX", 60]]);
      if (lk !== "OK") return send(res, 200, { ok: true, n, pending: true });
      const avoid = usedWords(st), want = Math.min(MORE_STEP, MORE_MAX - ex.length);
      const topic = r.rule && r.rule.scope === "common" && r.rule.topic ? r.rule.topic : pickTopic(r.topic);
      const gen = await aiWords(topic, r.level, want, [...avoid]);
      let add = gen ? gen.words.filter((w) => !avoid.has(lc(w))) : [];
      if (add.length < Math.min(10, want)) add = add.concat(bankWords(new Set([...avoid, ...add.map(lc)]), want - add.length));
      add = add.slice(0, want);
      if (!add.length) return send(res, 200, { ok: true, n, done: true });
      await redis([["HSET", K.sc(code), "w:" + n, JSON.stringify(ex.concat(add))]]);
      return send(res, 200, { ok: true, n, more: { from: ex.length, list: add } });
    }
    if (action === "sb_move" || action === "sb_pass" || action === "sb_end") {
      // Scrabble: đặt từ / bỏ lượt (đổi cả giá chữ) / chủ phòng kết thúc ván. Làm trong lúc khoá phòng.
      if (action === "sb_end" && !isOwner) return send(res, 403, { error: "owner_only" });
      const tok = await lockRoom(code);
      if (!tok) return send(res, 409, { error: "busy" });
      try {
        const s2 = await readRoom(code);
        const r = s2 && s2.meta.round, sb = r && r.sb, t = Date.now();
        if (!s2 || s2.meta.status !== "playing" || !sb || r.n !== int(body.n, 0, 100000)) return send(res, 409, { error: "not_playing", ...(s2 ? view(s2, me.pid, t) : {}) });
        const E = await engine();
        if (t >= r.end || sb.over) { await sbClose(code, s2, t, sb.over ? sb.reason : "time", E); return send(res, 200, view(s2, me.pid, t)); }
        if (action === "sb_end") { await sbClose(code, s2, t, "owner", E); return send(res, 200, view(s2, me.pid, t)); }
        if (t < r.start) return send(res, 409, { error: "not_started", ...view(s2, me.pid, t) });
        if (sb.order[sb.turn] !== me.pid) return send(res, 409, { error: "not_turn", msg: "Chưa tới lượt của con.", ...view(s2, me.pid, t) });
        if (action === "sb_pass") E.applyPass(sb, me.pid, t, "pass");
        else {
          const chk = E.checkMove(sb, me.pid, body.tiles, await E.getDict());
          if (!chk.ok) return send(res, 422, { error: "sb_bad", ...view(s2, me.pid, t), bad: chk.error, msg: chk.msg });
          E.applyPlay(sb, me.pid, chk, t);
        }
        if (sb.over) await sbClose(code, s2, t, sb.reason, E);
        else await redis([["SET", K.room(code), JSON.stringify(s2.meta), "EX", ROOM_TTL]]);
        return send(res, 200, view(s2, me.pid, Date.now()));
      } finally { await unlockRoom(code, tok); }
    }
    if (action === "leave") {
      if (isOwner) {
        const meta = { ...st.meta, status: "closed", closedBy: me.n, round: st.meta.round ? { ...st.meta.round, words: null } : null };
        await redis([["SET", K.room(code), JSON.stringify(meta), "EX", 900], ["LREM", K.q(st.meta.level), 0, code], ...roomKeys(code).slice(1).map((k) => ["EXPIRE", k, 900])]);
      } else {
        await redis([["HDEL", K.rpl(code), me.pid], ["HDEL", K.seen(code), me.pid]]);
      }
      return send(res, 200, { ok: true, left: true });
    }
    if (!isOwner) return send(res, 403, { error: "owner_only" });
    if (st.meta.status === "closed") return send(res, 404, { error: "no_room" });

    if (action === "config") {
      if (!["lobby", "results"].includes(st.meta.status)) return send(res, 409, { error: "busy" });
      const cfg = { ...st.meta.cfg };
      if (GAME_IDS.includes(body.game)) {
        // Scrabble chơi lâu hơn: đổi sang Scrabble thì mặc định 20 phút, đổi sang trò khác thì về 3 phút
        if (body.game === "scrabble" && cfg.game !== "scrabble") cfg.minutes = 20;
        else if (body.game !== "scrabble" && cfg.game === "scrabble") cfg.minutes = 3;
        cfg.game = body.game;
      }
      if (body.minutes != null) cfg.minutes = minutesFor(cfg.game, body.minutes);
      if (body.req != null) { const pr = parseRule(body.req); Object.assign(cfg, { req: pr.req, rule: pr.rule, ruleText: pr.text }); }
      const level = levelOf(body.level) ? body.level : st.meta.level;
      st.meta = { ...st.meta, cfg, level };
      await redis([["SET", K.room(code), JSON.stringify(st.meta), "EX", ROOM_TTL]]);
      return send(res, 200, view(st, me.pid, now));
    }
    if (action === "start") {
      if (!["lobby", "results"].includes(st.meta.status)) return send(res, 409, { error: "busy" });
      if (st.players.length < 2) return send(res, 409, { error: "need_two" });
      if (st.meta.cfg.game === "scrabble" && st.players.length > SB_MAX) return send(res, 409, { error: "sb_players" });
      if (await limited("start:" + code, 60, 3600)) return send(res, 429, { error: "slow_down" });
      const [lk] = await redis([["SET", K.lock(code), me.pid, "NX", "EX", 45]]);
      if (lk !== "OK") return send(res, 200, view(st, me.pid, now));
      try {
        if (st.meta.cfg.rule.scope === "common") {   // cho các bạn thấy "đang chuẩn bị bộ từ…"
          st.meta = { ...st.meta, prep: now };
          await redis([["SET", K.room(code), JSON.stringify(st.meta), "EX", ROOM_TTL]]);
        }
        await startRound(code, st);
      } finally { await redis([["DEL", K.lock(code)]]); }
      return send(res, 200, view(st, me.pid, Date.now()));
    }
    if (action === "finish") {
      if (st.meta.status !== "results") return send(res, 409, { error: "busy" });
      st.meta = { ...st.meta, status: "final" };
      await redis([["SET", K.room(code), JSON.stringify(st.meta), "EX", ROOM_TTL]]);
      return send(res, 200, view(st, me.pid, now));
    }
    if (action === "again") {
      if (st.meta.status !== "final") return send(res, 409, { error: "busy" });
      st.meta = { ...st.meta, status: "lobby", last: null, tot: {} };
      await redis([["SET", K.room(code), JSON.stringify(st.meta), "EX", ROOM_TTL]]);
      st.totals = {};
      return send(res, 200, view(st, me.pid, now));
    }
    if (action === "ai") {
      // Thách đấu ngẫu nhiên: chờ đủ 1 phút chưa có bạn thật -> Bạn AI (ghi rõ là AI) vào thi.
      if (st.meta.mode !== "random" || st.meta.status !== "waiting") return send(res, 200, view(st, me.pid, now));
      if (now - Number(st.meta.waitStart || 0) < WAIT_AI_MS - 3000) return send(res, 409, { error: "too_early" });
      const [ok] = await redis([["SET", K.claim(code), "ai", "NX", "EX", ROOM_TTL]]);
      if (ok !== "OK") return send(res, 200, view(st, me.pid, now));
      const aiPid = "ai" + rid(6);
      const ai = { ...aiRec(now, []), g: me.g };
      await redis([["LREM", K.q(st.meta.level), 0, code], ["HSET", K.rpl(code), aiPid, JSON.stringify(ai)]]);
      st.players.push({ pid: aiPid, ...ai });
      await startRound(code, st);
      return send(res, 200, view(st, me.pid, Date.now()));
    }
    if (action === "ai_add" || action === "ai_remove") {
      // Chủ phòng thêm / bớt Bạn AI (luôn ghi rõ là AI) — ví dụ để chơi Scrabble khi chưa có bạn.
      if (!["lobby", "results"].includes(st.meta.status)) return send(res, 409, { error: "busy" });
      if (action === "ai_add") {
        if (st.meta.mode !== "friends") return send(res, 403, { error: "random_room" });
        if (st.players.length >= MAX_PLAYERS) return send(res, 409, { error: "full" });
        const aiPid = "ai" + rid(6), rec = aiRec(now, st.players.filter((p) => p.ai).map((p) => p.n));
        await redis([["HSET", K.rpl(code), aiPid, JSON.stringify(rec)]]);
        st.players.push({ pid: aiPid, ...rec });
      } else {
        const pl = st.players.find((p) => p.pid === String(body.ai || "") && p.ai);   // body.ai = mã Bạn AI cần bớt
        if (!pl) return send(res, 404, { error: "no_ai" });
        await redis([["HDEL", K.rpl(code), pl.pid]]);
        st.players = st.players.filter((p) => p !== pl);
      }
      return send(res, 200, view(st, me.pid, now));
    }
    return send(res, 400, { error: "bad_request" });
  } catch (e) {
    console.error("arena:", action, e && e.message);
    if (e && e.code === "store_limit") return send(res, 503, { error: "store_limit" });
    if (e && e.code === "sb_players") return send(res, 409, { error: "sb_players" });
    return send(res, 502, { error: "store_error" });
  }
}

async function hello(req, res, body) {
  const me = auth(req, body);
  if (me) return send(res, 200, { ok: true, pid: me.pid });          // chìa khoá cũ còn đúng: dùng tiếp, không cần hỏi kho
  const ip = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim() || "local";
  if (await limited("hello:" + ip, 60, 3600)) return send(res, 429, { error: "slow_down" });
  const pid = "p" + rid(9);
  return send(res, 200, { ok: true, pid, token: tokenFor(pid) });
}

// Thách đấu ngẫu nhiên: vào phòng đang chờ cùng trình độ; không có thì tạo phòng chờ (1 phút sau Bạn AI vào).
// Đang chờ mà máy hỏi lại (prev = phòng chờ của mình): khoá phòng mình lại rồi tìm phòng chờ của bạn khác —
// nhờ vậy hai bạn cùng bấm tìm một lúc vẫn gặp được nhau, không ai bị vào hai phòng.
async function joinWaiting(me, level, now, exclude) {
  const codes = ((await redis([["LRANGE", K.q(level), 0, 30]]))[0] || []).filter((c) => /^\d{6}$/.test(c) && c !== exclude);
  if (!codes.length) return null;
  const info = await redis(codes.map((c) => ["GET", K.room(c)]));
  const metas = info.map((x) => x && parse(x));
  const seenOwner = await redis(codes.map((c, i) => ["HGET", K.seen(c), (metas[i] && metas[i].owner) || "-"]));
  for (let i = 0; i < codes.length; i++) {
    const code = codes[i], m = metas[i];
    const stale = !m || m.status !== "waiting" || now - Number(m.waitStart || 0) > 10 * 60000 || now - Number(seenOwner[i] || 0) > ONLINE_MS;
    if (stale) { await redis([["LREM", K.q(level), 0, code]]); continue; }
    if (m.owner === me.pid) continue;
    const [ok] = await redis([["SET", K.claim(code), me.pid, "NX", "EX", ROOM_TTL]]);
    if (ok !== "OK") continue;
    await redis([["LREM", K.q(level), 0, code], ["HSET", K.rpl(code), me.pid, playerRec(me)], ["HSET", K.seen(code), me.pid, now]]);
    const st = await readRoom(code);
    if (!st) continue;
    await startRound(code, st);
    return st;
  }
  return null;
}
async function closeQuiet(code, level, me) {
  const [raw] = await redis([["GET", K.room(code)]]);
  const m = raw && parse(raw);
  if (!m) return;
  await redis([["SET", K.room(code), JSON.stringify({ ...m, status: "closed", closedBy: me.n }), "EX", 900], ["LREM", K.q(level), 0, code]]);
}
async function random(res, me, body, now) {
  const level = levelOf(body.level) ? body.level : defaultLevel(me.g);
  const prev = /^\d{6}$/.test(String(body.prev || "")) ? String(body.prev) : "";
  if (prev) {
    const st0 = await readRoom(prev, [["HSET", K.seen(prev), me.pid, now]]);
    if (st0 && st0.meta.owner === me.pid && st0.meta.mode === "random") {
      if (st0.meta.status !== "waiting") return send(res, 200, view(st0, me.pid, now));
      const [mine] = await redis([["SET", K.claim(prev), "self:" + me.pid, "NX", "EX", 30]]);
      if (mine !== "OK") { const st1 = await readRoom(prev); return send(res, 200, view(st1 || st0, me.pid, Date.now())); }
      const found = await joinWaiting(me, st0.meta.level, now, prev);
      if (found) { await closeQuiet(prev, st0.meta.level, me); return send(res, 200, view(found, me.pid, Date.now())); }
      await redis([["DEL", K.claim(prev)]]);
      return send(res, 200, view(st0, me.pid, now));
    }
  }
  if (await limited("random:" + me.pid, 40, 3600)) return send(res, 429, { error: "slow_down" });
  const found = await joinWaiting(me, level, now, "");
  if (found) return send(res, 200, view(found, me.pid, Date.now()));
  const game = GAME_IDS.includes(body.game) ? body.game : "bee";
  const pr = parseRule("");
  const meta = { v: 1, owner: me.pid, mode: "random", status: "waiting", created: now, waitStart: now, level, n: 0, cfg: { game, minutes: minutesFor(game, body.minutes || (game === "scrabble" ? 20 : 2)), req: "", rule: pr.rule, ruleText: pr.text } };
  const code = await newCode(meta);
  await redis([["HSET", K.rpl(code), me.pid, playerRec(me)], ["HSET", K.seen(code), me.pid, now], ["EXPIRE", K.rpl(code), ROOM_TTL], ["EXPIRE", K.seen(code), ROOM_TTL], ["RPUSH", K.q(level), code], ["EXPIRE", K.q(level), 3600]]);
  const st = await readRoom(code);
  return send(res, 200, view(st, me.pid, now));
}
