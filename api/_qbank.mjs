// NGÂN HÀNG CÂU HỎI (anh duyệt 25/11/2026, Việc 2) + GIỚI HẠN LƯỢT SOẠN MỚI (Việc 3).
// Câu ONTAP soạn được lưu theo TỪNG KHÁI NIỆM; lần ôn sau (của con này hoặc con khác cùng lớp + môn + dạng + ý nhỏ) lấy câu
// CON CHƯA GẶP trong ngân hàng, thiếu mới gọi AI MỘT lần (phần thiếu + 10 câu dự phòng cho lượt sau).
//
// Khoá ngân hàng = sha256 (16 ký tự đầu) của: lớp (gradeNo, không rõ = 0), môn (subjKey; "default" thì tên môn chuẩn hoá),
// dạng (choice | open), enLang, tên khái niệm chuẩn hoá (NFC, chữ thường, gộp khoảng trắng), các ý nhỏ chuẩn hoá đã sắp xếp.
// Chế độ nâng cao (master): một ngân hàng cho CẢ BỘ khái niệm + cờ master.
// Kho: qb:<khoá> = JSON nén gzip { v, n (số thứ tự kế tiếp), items:[{ id, q, options?, answer, explain, concept, model, at }] }
//      (tối đa 40 câu, EXPIRE 180 ngày, gia hạn mỗi lần dùng) · qb:idx HASH khoá -> tóm tắt cho trang quản trị · qb:lk:<khoá> khoá ngắn khi ghi.
import crypto from "node:crypto";
import { redis, parse } from "./_store.mjs";
import { pack, unpack } from "./_books/core.mjs";
import { subjKey, gradeNo } from "./aiCore.mjs";
import { vnDay } from "./_aicost.mjs";

export const BANK_MAX = 40;          // câu tối đa mỗi khái niệm
export const SPARE = 10;             // soạn dư cho lượt sau
const TTL = String(180 * 86400);
const UNLOCK = "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end";
export const QK = { bank: (k) => "qb:" + k, idx: "qb:idx", lock: (k) => "qb:lk:" + k, gen: (day, phone, kid) => `ai:g:${day}:${phone}:${kid}` };
export const okBankKey = (k) => /^[0-9a-f]{16}$/.test(String(k || ""));
export const okQid = (s) => /^[0-9a-f]{8}\.[0-9a-z]{1,8}$/.test(String(s || ""));

const norm = (s) => String(s == null ? "" : s).normalize("NFC").toLowerCase().replace(/\s+/g, " ").trim();
const qCanon = (s) => norm(s).replace(/[.?!:;,"'“”‘’()\-–—…]+/g, " ").replace(/\s+/g, " ").trim();
const sha16 = (o) => crypto.createHash("sha256").update(JSON.stringify(o)).digest("hex").slice(0, 16);
export const cName = (c) => String(typeof c === "string" ? c : (c && c.name) || "");
export const cDetails = (c) => (c && typeof c === "object" && Array.isArray(c.details) ? c.details : []);

function subjPart(subject) { const k = subjKey(subject); return k === "default" ? "default:" + norm(subject) : k; }
// Khoá ngân hàng của một khái niệm (thường) hoặc của cả bộ (master).
export function bankKey({ subject, grade, format, enLang, concepts, master }) {
  const base = [gradeNo(grade), subjPart(subject), format === "open" ? "open" : "choice", enLang === "en" ? "en" : "vi"];
  const one = (c) => [norm(cName(c)), cDetails(c).map(norm).filter(Boolean).sort()];
  if (master) return sha16([...base, concepts.map(one).sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0)), "master"]);
  return sha16([...base, ...one(concepts[0])]);
}

// Câu đúng quy cách: trắc nghiệm có 4 lựa chọn khác nhau và đáp án trùng một lựa chọn; tự điền có đáp án; luôn có đề + lời giải thích.
export function validQ(q, format) {
  if (!q || typeof q !== "object") return null;
  const text = String(q.q || "").trim(), explain = String(q.explain || "").trim();
  if (!text || !explain || text.length > 2000) return null;
  const concept = String(q.concept || "").trim().slice(0, 200);
  if (format === "open") {
    const answer = String(q.answer == null ? "" : q.answer).trim();
    return answer ? { q: text, answer, explain, concept } : null;
  }
  if (!Array.isArray(q.options) || q.options.length !== 4) return null;
  const options = q.options.map((o) => String(o == null ? "" : o).trim());
  if (options.some((o) => !o) || new Set(options.map(norm)).size !== 4) return null;
  let answer = typeof q.answer === "number" && Number.isInteger(q.answer) && q.answer >= 0 && q.answer <= 3 ? options[q.answer] : String(q.answer == null ? "" : q.answer).trim();
  const hit = options.find((o) => o === answer) || options.find((o) => norm(o) === norm(answer));
  if (!hit) return null;
  return { q: text, options, answer: hit, explain, concept };
}

function shuffle(a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = crypto.randomInt(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; }
const outQ = (it, concept, reshuffle = false) => ({
  id: it.id, concept: concept || it.concept || "", q: it.q, ...(it.options ? { options: reshuffle ? shuffle(it.options) : it.options.slice() } : {}),
  answer: it.answer, explain: it.explain,
});

async function loadBanks(keys) {
  if (!keys.length) return [];
  const [vals] = await redis([["MGET", ...keys.map(QK.bank)]]);
  return keys.map((k, i) => { const d = unpack(vals && vals[i]); return d && Array.isArray(d.items) ? d : { v: 1, n: 0, items: [] }; });
}

// Ghi câu mới vào ngân hàng: khoá ngắn + đọc lại bản mới nhất rồi gộp (hai máy cùng soạn cho một khái niệm không làm hỏng ngân hàng).
// Trả các câu đã có id (câu không vừa ngân hàng 40 câu vẫn được dùng lượt này, id riêng không lưu).
async function saveToBank(key, fresh, meta) {
  if (!fresh.length) return [];
  const tok = crypto.randomBytes(6).toString("hex");
  let locked = false;
  for (let i = 0; i < 25 && !locked; i++) {
    const [ok] = await redis([["SET", QK.lock(key), tok, "NX", "PX", "8000"]]);
    locked = ok === "OK";
    if (!locked) await new Promise((r) => setTimeout(r, 120));
  }
  try {
    const [raw] = await redis([["GET", QK.bank(key)]]);
    const bank = unpack(raw) || { v: 1, n: 0, items: [] };
    if (!Array.isArray(bank.items)) bank.items = [];
    const have = new Set(bank.items.map((x) => qCanon(x.q)));
    const out = [];
    const now = Date.now();
    for (const f of fresh) {
      const c = qCanon(f.q);
      if (!c || have.has(c)) continue;
      have.add(c);
      bank.n = (Number(bank.n) || 0) + 1;
      const it = { id: key.slice(0, 8) + "." + bank.n.toString(36), q: f.q, ...(f.options ? { options: f.options } : {}), answer: f.answer, explain: f.explain, concept: f.concept || meta.concept, model: f.model || "", at: now };
      if (bank.items.length < BANK_MAX) bank.items.push(it);
      out.push(it);
    }
    if (locked) {
      const [ix] = await redis([["HGET", QK.idx, key]]);
      const prev = parse(ix) || {};
      await redis([["SET", QK.bank(key), pack(bank), "EX", TTL],
        ["HSET", QK.idx, key, JSON.stringify({ ...meta, n: bank.items.length, uses: Number(prev.uses) || 0, last: Number(prev.last) || now, made: Number(prev.made) || now })]]);
    }
    return out;
  } finally {
    if (locked) await redis([["EVAL", UNLOCK, "1", QK.lock(key), tok]]).catch(() => {});
  }
}

// Một lượt "generate" có ngân hàng. Trả { questions, source:{bank, fresh}, limited, genRun, newQ }.
//  p: payload đã làm sạch { subject, grade, topic, concepts:[{name, details}], count, format, master, enLang }
//  recent: id câu con đã gặp gần đây (mới nhất trước). gate(): kiểm giới hạn lượt soạn mới -> true nếu ĐƯỢC soạn.
//  gen(concepts, n): gọi AI soạn n câu cho các khái niệm (đã gồm đoạn sách, model theo môn, đếm token).
export async function bankGenerate(p, { recent = [], gate, gen }) {
  const want = p.count + 3;
  const format = p.format === "open" ? "open" : "choice";
  // ngăn chứa: master = một ngăn cho cả bộ; thường = mỗi khái niệm một ngăn (thứ tự app gửi = khái niệm cần ôn trước)
  const buckets = (p.master ? [{ concepts: p.concepts, name: "" }] : p.concepts.map((c) => ({ concepts: [c], name: cName(c) })))
    .map((b) => ({ ...b, key: bankKey({ ...p, format, concepts: b.concepts }) }));
  // khái niệm trùng khoá (cùng tên + ý nhỏ) -> gộp
  const uniq = buckets.filter((b, i) => buckets.findIndex((x) => x.key === b.key) === i);
  const banks = await loadBanks(uniq.map((b) => b.key));
  uniq.forEach((b, i) => { b.bank = banks[i]; b.got = []; });
  const rank = new Map(recent.map((id, i) => [id, i]));   // vị trí trong "đã gặp" (0 = vừa gặp)
  const used = new Set();
  const take = (b, it, from) => { if (used.has(it.id)) return false; used.add(it.id); b.got.push({ it, from }); return true; };
  // chia số câu cho các khái niệm
  const k = uniq.length;
  uniq.forEach((b, i) => { b.alloc = Math.floor(want / k) + (i < want % k ? 1 : 0); });
  // 1) câu CHƯA GẶP trong ngân hàng
  for (const b of uniq) for (const it of shuffle(b.bank.items)) { if (b.got.length >= b.alloc) break; if (!rank.has(it.id)) take(b, it, "bank"); }
  const short = (b) => Math.max(0, b.alloc - b.got.length);
  const need = uniq.filter((b) => short(b) > 0 && b.bank.items.length < BANK_MAX);
  let limited = false, genRun = false, newQ = 0, freshUsed = 0;
  // 2) còn thiếu -> soạn mới MỘT lần (nếu chưa quá giới hạn lượt soạn mới)
  if (need.length) {
    if (!(await gate())) limited = true;
    else {
      const missing = need.reduce((s, b) => s + short(b), 0);
      const raw = await gen(need.flatMap((b) => b.concepts), missing + SPARE);
      const valid = (raw || []).map((q) => { const v = validQ(q, format); return v ? { ...v, model: q.model || "" } : null; }).filter(Boolean);
      if (valid.length) {
        genRun = true; newQ = valid.length;
        // xếp câu mới vào ngăn theo trường "concept" (khớp tên đã chuẩn hoá; không khớp -> ngăn đầu tiên đang thiếu)
        const per = new Map(need.map((b) => [b.key, []]));
        for (const v of valid) {
          const hit = p.master ? need[0] : need.find((b) => norm(b.name) === norm(v.concept)) || need[0];
          per.get(hit.key).push(v);
        }
        const meta = (b) => ({ subject: String(p.subject || "").slice(0, 60), grade: String(p.grade || "").slice(0, 20), format, enLang: p.enLang === "en" ? "en" : "vi",
          concept: p.master ? p.concepts.map(cName).join(" + ").slice(0, 300) : b.name.slice(0, 200), master: !!p.master });
        const saved = await Promise.all(need.map((b) => saveToBank(b.key, per.get(b.key), meta(b)).catch((e) => { console.error("qbank save", e && e.message); return []; })));
        need.forEach((b, i) => { b.fresh = saved[i]; });
        for (const b of need) for (const it of b.fresh) { if (short(b) <= 0) break; if (take(b, it, "fresh")) freshUsed++; }
        // câu mới bị xếp lệch ngăn -> bù cho ngăn khác còn thiếu
        for (const b of need) for (const o of need) for (const it of o.fresh) { if (short(b) <= 0) break; if (take(b, it, "fresh")) freshUsed++; }
      }
    }
  }
  // 3) vẫn thiếu: câu chưa gặp ở ngăn khác, rồi câu ĐÃ GẶP LÂU NHẤT (đảo thứ tự 4 lựa chọn; đáp án lưu bằng chữ nên vẫn đúng)
  const total = () => uniq.reduce((s, b) => s + b.got.length, 0);
  for (const b of uniq) for (const o of uniq) for (const it of o.bank.items) { if (short(b) <= 0) break; if (!rank.has(it.id)) take(b, it, "bank"); }
  const oldest = (items) => items.filter((it) => rank.has(it.id)).sort((x, y) => rank.get(y.id) - rank.get(x.id));
  for (const b of uniq) for (const it of oldest(b.bank.items)) { if (short(b) <= 0) break; take(b, it, "seen"); }
  if (total() < want) {
    const all = oldest(uniq.flatMap((b) => b.bank.items));
    for (const b of uniq) for (const it of all) { if (total() >= want) break; take(b, it, "seen"); }
  }
  // xen kẽ các khái niệm để câu đầu danh sách đủ chủ đề
  const out = [];
  for (let i = 0; out.length < total(); i++) for (const b of uniq) if (b.got[i]) out.push(outQ(b.got[i].it, p.master ? "" : b.name, b.got[i].from === "seen"));
  // dùng ngân hàng -> gia hạn + ghi lượt dùng (một lần gửi kho)
  const usedB = uniq.filter((b) => b.got.length || b.bank.items.length);
  if (usedB.length) {
    const [ix] = await redis([["HMGET", QK.idx, ...usedB.map((b) => b.key)]]).catch(() => [[]]);
    const cmds = [];
    usedB.forEach((b, i) => {
      const m = parse(ix && ix[i]);
      cmds.push(["EXPIRE", QK.bank(b.key), TTL]);
      if (m) cmds.push(["HSET", QK.idx, b.key, JSON.stringify({ ...m, uses: (Number(m.uses) || 0) + 1, last: Date.now() })]);
    });
    await redis(cmds).catch(() => {});
  }
  const fromBank = out.length - freshUsed;
  return { questions: out, source: { bank: fromBank, fresh: freshUsed }, limited, genRun, newQ };
}

// Giới hạn lượt PHẢI SOẠN MỚI của một con trong ngày (giờ Việt Nam). limit 0 = không giới hạn.
export async function genAllowed(phone, kid, limit) {
  if (!limit) return true;
  const [n] = await redis([["GET", QK.gen(vnDay(), phone, kid)]]);
  return Number(n || 0) < limit;
}
export async function countGenRun(phone, kid) {
  const k = QK.gen(vnDay(), phone, kid);
  await redis([["INCR", k], ["EXPIRE", k, String(2 * 86400)]]);
}

// Trang quản trị: danh sách / một ngân hàng / xoá
export async function bankList({ q = "", subject = "", grade = "" } = {}) {
  const [raw] = await redis([["HGETALL", QK.idx]]);
  const rows = [];
  for (let i = 0; i + 1 < (raw || []).length; i += 2) { const m = parse(raw[i + 1]); if (m) rows.push({ key: raw[i], ...m }); }
  const f = (s) => norm(s).normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d");
  const qq = f(q), ss = f(subject), gg = gradeNo(grade);
  const list = rows.filter((r) => (!qq || f(r.concept).includes(qq)) && (!ss || f(r.subject).includes(ss)) && (!gg || gradeNo(r.grade) === gg))
    .sort((a, b) => (b.last || 0) - (a.last || 0));
  const sum = (l, k) => l.reduce((s, r) => s + (Number(r[k]) || 0), 0);
  return { total: { concepts: rows.length, questions: sum(rows, "n"), uses: sum(rows, "uses") }, shown: { concepts: list.length, questions: sum(list, "n"), uses: sum(list, "uses") }, list: list.slice(0, 300) };
}
export async function bankGet(key) {
  if (!okBankKey(key)) return null;
  const [raw, ix] = await redis([["GET", QK.bank(key)], ["HGET", QK.idx, key]]);
  const d = unpack(raw);
  if (!d && !ix) return null;
  return { key, meta: parse(ix) || {}, items: (d && d.items) || [] };
}
export async function bankDel(key) {
  if (!okBankKey(key)) return false;
  const [a, b] = await redis([["DEL", QK.bank(key)], ["HDEL", QK.idx, key]]);
  return Number(a) + Number(b) > 0;
}
