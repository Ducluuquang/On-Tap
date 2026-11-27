// CHI PHÍ AI (anh duyệt 25/11/2026, Việc 1): đếm token THẬT của mọi lời gọi Anthropic (trường "usage" của phản hồi),
// quy ra tiền theo bảng giá dưới đây, cộng vào kho theo tài khoản / ngày / loại việc / model; cài đặt "cfg:ai" (model theo môn,
// giới hạn lượt soạn mới, trần tiền mỗi ngày, tỷ giá) — chỉ super admin sửa ở /quan-tri → 💸 Chi phí AI.
//
// Bảng giá (USD cho 1 triệu token) lấy từ https://platform.claude.com/docs/en/about-claude/pricing ngày 21/11/2026.
// Model khác / tên lạ: tính theo giá Sonnet 5.5 (thà tính cao). Message Batches: nhân 0,5. Tiền lưu dạng số nguyên micro-USD.
//
// Kho ("ngày" theo giờ Việt Nam, UTC+7; mỗi lời gọi AI gom các lệnh ghi vào MỘT lần gửi):
//   ai:c:<số điện thoại>  HASH  <YYYY-MM-DD> -> micro-USD của tài khoản trong ngày (EXPIRE 40 ngày)
//   ai:d:<YYYY-MM-DD>     HASH  usd, calls · usd:<loại việc>, n:<loại việc> · in:<model>, out:<model> · bank_q, new_q, gen_runs (EXPIRE 120 ngày)
//   ai:m:<YYYY-MM>        ZSET  số điện thoại -> micro-USD trong tháng (EXPIRE 70 ngày)
//   ai:g:<YYYY-MM-DD>:<số điện thoại>:<id con>  số lượt PHẢI SOẠN MỚI của con trong ngày (Việc 3; EXPIRE 2 ngày)
// BÁO CÁO NGÀY (anh yêu cầu 27/11/2026, api/_report.mjs) — ghi trong CÙNG lần gửi kho của recordCost:
//   ai:d:<ngày> thêm sessions (lượt ôn = lượt generate), asked (câu app xin), bank_used / fresh_used (câu đưa cho con lấy từ
//              ngân hàng / mới soạn); new_q vẫn là số câu ONTAP soạn mới (gồm cả câu để dành cho lần sau).
//   rp:u:<ngày>:<số điện thoại>  HASH  sessions, asked, bank_used, fresh_used, new_q, usd (micro-USD), in, out (token) (EXPIRE 40 ngày)
//   rp:a:<ngày>  SET  số điện thoại có học trong ngày (generate ở đây + hành động "data" của /api/account) (EXPIRE 40 ngày)
import { redis, parse } from "./_store.mjs";

const SONNET55 = { in: 2, out: 10, cw: 2.5, cr: 0.10 };
export const PRICES = {
  "claude-sonnet-5-5": SONNET55,
  "claude-sonnet-5": { in: 2, out: 10, cw: 2.5, cr: 0.20 },
  // Haiku 5.5: lời nhắc ≤ 100.000 token / > 100.000 token
  "claude-haiku-5-5": { in: 0.10, out: 0.50, cw: 0.125, cr: 0.01, big: { in: 0.50, out: 2.50, cw: 0.625, cr: 0.05 } },
};
export const KINDS = ["gen", "extract", "grade", "judge", "spelling", "arena", "cskh", "books", "try"];

// Giá của một model (tên có thể kèm ngày phát hành, vd "claude-haiku-5-5-20261001"): khớp tên dài nhất; lạ -> Sonnet 5.5.
export function priceOf(model) {
  const m = String(model || "").toLowerCase();
  let best = null;
  for (const k of Object.keys(PRICES)) if ((m === k || m.startsWith(k + "-")) && (!best || k.length > best.length)) best = k;
  return best ? PRICES[best] : SONNET55;
}
const num = (v) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : 0);
// usage -> micro-USD (số nguyên). batch=true: Message Batches nửa giá.
export function costMicro(model, usage, { batch = false } = {}) {
  const u = usage || {};
  const tin = num(u.input_tokens), tout = num(u.output_tokens), tcw = num(u.cache_creation_input_tokens), tcr = num(u.cache_read_input_tokens);
  let p = priceOf(model);
  if (p.big && tin + tcw + tcr > 100000) p = p.big;
  const usd = tin * p.in + tout * p.out + tcw * p.cw + tcr * p.cr;   // (token × USD/1 triệu token) = micro-USD
  return Math.round(usd * (batch ? 0.5 : 1));
}

/* ---------- Ngày theo giờ Việt Nam ---------- */
// Phép thử (MOCK=1) đặt "hôm nay" giả qua biến AI_FAKE_DAY (tests/server.mjs → /__mock/day/<YYYY-MM-DD>); máy thật không có biến này.
export function vnDay(t = Date.now()) {
  const fake = process.env.AI_FAKE_DAY;
  if (fake && /^\d{4}-\d{2}-\d{2}$/.test(fake)) {
    const shift = Math.round((t - Date.now()) / 86400000) * 86400000;
    return new Date(Date.parse(fake + "T12:00:00Z") + shift).toISOString().slice(0, 10);
  }
  return new Date(t + 7 * 3600000).toISOString().slice(0, 10);
}
// Giờ trong ngày theo giờ Việt Nam (0–23). Phép thử đặt giờ giả qua AI_FAKE_HOUR (/__mock/hour/<giờ>).
export function vnHour(t = Date.now()) {
  const fake = process.env.AI_FAKE_HOUR;
  if (fake != null && /^\d{1,2}$/.test(fake)) return Number(fake);
  return new Date(t + 7 * 3600000).getUTCHours();
}
export const vnMonth = (t = Date.now()) => vnDay(t).slice(0, 7);
// n ngày gần nhất (hôm nay đầu tiên)
export const lastDays = (n) => Array.from({ length: n }, (_, i) => vnDay(Date.now() - i * 86400000));

/* ---------- Đếm token của một yêu cầu ---------- */
// Mỗi yêu cầu có MỘT ctx riêng (không dùng biến toàn cục: Vercel chạy nhiều yêu cầu cùng lúc trong một máy).
export function newCtx(kind, phone = "") {
  return {
    kind, phone, uses: [],
    add(model, usage, o = {}) { if (usage) this.uses.push({ model: String(model || ""), usage, kind: o.kind || this.kind, batch: !!o.batch }); },
  };
}
const fieldSafe = (s) => String(s || "unknown").replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 60);

// Ghi chi phí của một yêu cầu vào kho: MỘT lần gửi. extra: { bank_q, new_q, gen_runs, sessions, asked, bank_used, fresh_used }.
// noPhone: không cộng vào tài khoản. Lỗi kho -> chỉ ghi console (không làm hỏng việc chính).
const DAY_EXTRA = ["bank_q", "new_q", "gen_runs", "sessions", "asked", "bank_used", "fresh_used"];
const USER_EXTRA = ["sessions", "asked", "bank_used", "fresh_used", "new_q"];
export async function recordCost(ctx, extra = {}, { noPhone = false } = {}) {
  const uses = (ctx && ctx.uses) || [];
  const hasExtra = Object.values(extra).some((v) => num(v));
  if (!uses.length && !hasExtra) return 0;
  const day = vnDay(), month = vnMonth(), dk = "ai:d:" + day;
  const cmds = [];
  let total = 0, tin = 0, tout = 0;
  for (const x of uses) {
    const c = costMicro(x.model, x.usage, { batch: x.batch });
    total += c;
    const m = fieldSafe(x.model);
    const i = num(x.usage.input_tokens) + num(x.usage.cache_creation_input_tokens) + num(x.usage.cache_read_input_tokens), o = num(x.usage.output_tokens);
    tin += i; tout += o;
    cmds.push(["HINCRBY", dk, "usd", c], ["HINCRBY", dk, "calls", 1], ["HINCRBY", dk, "usd:" + x.kind, c], ["HINCRBY", dk, "n:" + x.kind, 1],
      ["HINCRBY", dk, "in:" + m, i], ["HINCRBY", dk, "out:" + m, o]);
  }
  for (const k of DAY_EXTRA) if (num(extra[k])) cmds.push(["HINCRBY", dk, k, Math.round(num(extra[k]))]);
  cmds.push(["EXPIRE", dk, String(120 * 86400)]);
  const phone = !noPhone && ctx && ctx.phone;
  if (phone && total > 0) {
    cmds.push(["HINCRBY", "ai:c:" + phone, day, total], ["EXPIRE", "ai:c:" + phone, String(40 * 86400)],
      ["ZINCRBY", "ai:m:" + month, total, phone], ["EXPIRE", "ai:m:" + month, String(70 * 86400)]);
  }
  // báo cáo ngày: số liệu theo tài khoản + tài khoản có học hôm nay (lượt ôn)
  if (phone) {
    const uk = `rp:u:${day}:${phone}`, uc = [];
    for (const k of USER_EXTRA) if (num(extra[k])) uc.push(["HINCRBY", uk, k, Math.round(num(extra[k]))]);
    if (total > 0) uc.push(["HINCRBY", uk, "usd", total]);
    if (tin) uc.push(["HINCRBY", uk, "in", tin]);
    if (tout) uc.push(["HINCRBY", uk, "out", tout]);
    if (uc.length) cmds.push(...uc, ["EXPIRE", uk, String(40 * 86400)]);
    if (num(extra.sessions)) cmds.push(["SADD", "rp:a:" + day, phone], ["EXPIRE", "rp:a:" + day, String(40 * 86400)]);
  }
  try { await redis(cmds); } catch (e) { console.error("ai cost store", e && (e.code || e.message)); }
  return total;
}

/* ---------- Cài đặt cfg:ai (super admin) ---------- */
// Nhóm môn soạn câu (theo subjKey) + Vở Spelling + chấm câu tự gõ: "sonnet" (Chính xác) | "haiku" (Tiết kiệm). Mặc định TẤT CẢ Sonnet.
export const MODEL_GROUPS = ["toan", "tieng-viet", "tieng-anh", "ngu-van", "default", "spelling", "judge"];
export const AI_DEFAULTS = { models: Object.fromEntries(MODEL_GROUPS.map((g) => [g, "sonnet"])), genLimit: 5, capVnd: 10000, rate: 26000, reportOn: true };
export function cleanAiCfg(c) {
  const x = c && typeof c === "object" ? c : {};
  const models = {};
  for (const g of MODEL_GROUPS) models[g] = x.models && x.models[g] === "haiku" ? "haiku" : "sonnet";
  const int = (v, d, lo, hi) => { const n = Math.round(Number(v)); return Number.isFinite(n) && n >= lo && n <= hi ? n : d; };
  return {
    models,
    genLimit: int(x.genLimit, AI_DEFAULTS.genLimit, 0, 1000),        // lượt soạn mới mỗi con mỗi ngày; 0 = không giới hạn
    capVnd: int(x.capVnd, AI_DEFAULTS.capVnd, 0, 10000000),          // trần tiền mỗi con mỗi ngày (đồng); 0 = không có trần
    rate: int(x.rate, AI_DEFAULTS.rate, 1000, 100000),               // tỷ giá đồng / USD
    reportOn: x.reportOn !== false,                                  // email báo cáo ngày mỗi tối (27/11/2026; mặc định BẬT)
    updated: Number(x.updated) || 0, by: String(x.by || ""),
  };
}
let cfgCache = null; // { at, cfg } — nhớ trong máy 60 giây
export async function getAiCfg({ fresh = false } = {}) {
  if (!fresh && cfgCache && Date.now() - cfgCache.at < 60000) return cfgCache.cfg;
  let raw = null;
  try { [raw] = await redis([["GET", "cfg:ai"]]); } catch { if (cfgCache) return cfgCache.cfg; }
  const cfg = cleanAiCfg(parse(raw));
  cfgCache = { at: Date.now(), cfg };
  return cfg;
}
export async function setAiCfg(next) {
  const cfg = cleanAiCfg(next);
  await redis([["SET", "cfg:ai", JSON.stringify(cfg)]]);
  cfgCache = { at: Date.now(), cfg };
  return cfg;
}
// Trần tiền của một tài khoản trong ngày (micro-USD): capVnd × số con (ít nhất 1) ÷ tỷ giá. 0 = không trần.
export function capMicro(cfg, acc) {
  if (!cfg.capVnd) return 0;
  const kids = Math.max(1, ((acc && acc.children) || []).length);
  return Math.round((cfg.capVnd * kids / cfg.rate) * 1e6);
}
export async function overCap(phone, acc) {
  const cfg = await getAiCfg();
  const cap = capMicro(cfg, acc);
  if (!cap || !phone) return false;
  const [v] = await redis([["HGET", "ai:c:" + phone, vnDay()]]);
  return Number(v || 0) >= cap;
}
// Tiền AI của nhiều tài khoản trong n ngày gần nhất (micro-USD) — cột "Tiền AI 30 ngày" ở mục Người dùng.
export async function spendOf(phones, n = 30) {
  if (!phones.length) return {};
  const days = new Set(lastDays(n));
  const rows = await redis(phones.map((p) => ["HGETALL", "ai:c:" + p]));
  const out = {};
  phones.forEach((p, i) => {
    const r = rows[i] || [];
    let s = 0;
    for (let j = 0; j + 1 < r.length; j += 2) if (days.has(r[j])) s += Number(r[j + 1]) || 0;
    out[p] = s;
  });
  return out;
}
