// BÁO CÁO NGÀY cho anh (anh yêu cầu 27/11/2026): hôm nay các con học bao nhiêu, ONTAP tốn bao nhiêu.
// Chỉ ĐỌC kho, không sửa dữ liệu học. Ngày theo giờ Việt Nam (vnDay).
//  - Học: nhật ký từng con stats.log[ngày][môn] = { reviewed, correct, wrong, sec } trong acct:d:<số>:<id con>, gộp các máy như
//    api/_sync/merge.mjs (totalsOf). Tài khoản cần đọc = các số trong rp:a:<ngày> của ngày xem + 7 ngày trước (để so sánh)
//    + ngày hôm sau (máy gửi dữ liệu muộn). Nhật ký học của app ghi theo ngày của máy (giờ UTC) nên lượt học 0–7 giờ sáng
//    giờ VN có thể nằm ở ngày hôm trước.
//  - Câu hỏi + AI: ai:d:<ngày> (tổng, loại việc, token theo model, sessions / asked / bank_used / fresh_used / new_q) và
//    rp:u:<ngày>:<số> (theo tài khoản) — ghi ở api/_aicost.mjs → recordCost.
//  - Email mỗi tối (Vercel cron, GET /api/admin?job=report): tới alertEmails (cfg:support, ≤ 5), mỗi ngày tối đa một lần
//    (rp:sent:<ngày> SET NX, 3 ngày); kết quả lần gửi gần nhất: rp:last. "Gửi thử" của super admin không tính.
import { redis, parse } from "./_store.mjs";
import { totalsOf } from "./_sync/merge.mjs";
import { unpack } from "./account.mjs";
import { vnDay, getAiCfg } from "./_aicost.mjs";
import { getSupportCfg } from "./_changes.mjs";
import { mailReady, sendMail } from "./_mail.mjs";
import { bankList } from "./_qbank.mjs";

const DAYMS = 86400000;
const n = (v) => Number(v) || 0;
const hashObj = (r) => { const o = {}; for (let i = 0; i + 1 < (r || []).length; i += 2) o[r[i]] = r[i + 1]; return o; };
export const okDay = (d) => /^\d{4}-\d{2}-\d{2}$/.test(String(d || "")) && !Number.isNaN(Date.parse(d + "T00:00:00Z"));
// ngày trước / sau d (chuỗi YYYY-MM-DD) k ngày
export const shiftDay = (d, k) => new Date(Date.parse(d + "T12:00:00Z") + k * DAYMS).toISOString().slice(0, 10);
// số điện thoại che: 0912345123 -> 09xx…123
export const maskPhone = (p) => { const s = String(p || ""); return s.length > 5 ? s.slice(0, 2) + "xx…" + s.slice(-3) : "…"; };
export const dmy = (d) => `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`;

// Số liệu AI / câu hỏi của một ngày từ ai:d
function aiOf(h) {
  const kinds = {}, models = {};
  let tin = 0, tout = 0;
  for (const [f, v] of Object.entries(h)) {
    const i = f.indexOf(":");
    if (i < 0) continue;
    const a = f.slice(0, i), b = f.slice(i + 1), x = n(v);
    if (a === "usd") (kinds[b] = kinds[b] || { usd: 0, n: 0 }).usd = x;
    else if (a === "n") (kinds[b] = kinds[b] || { usd: 0, n: 0 }).n = x;
    else if (a === "in") { (models[b] = models[b] || { in: 0, out: 0 }).in = x; tin += x; }
    else if (a === "out") { (models[b] = models[b] || { in: 0, out: 0 }).out = x; tout += x; }
  }
  return {
    usd: n(h.usd), calls: n(h.calls), in: tin, out: tout, kinds, models,
    sessions: n(h.sessions), asked: n(h.asked), bank_used: n(h.bank_used), fresh_used: n(h.fresh_used),
    new_q: n(h.new_q), bank_q: n(h.bank_q), gen_runs: n(h.gen_runs),
  };
}

// Đọc kho cho ngày `day` và 7 ngày trước: tài khoản, nhật ký học của các con, ai:d, rp:u.
async function load(day) {
  const days = Array.from({ length: 8 }, (_, i) => shiftDay(day, -i));   // [day, hôm qua, …, 7 ngày trước]
  // tài khoản cần đọc: có học trong 8 ngày đó HOẶC ngày hôm sau (học tối khuya, máy gửi dữ liệu sáng hôm sau)
  const next = shiftDay(day, 1), src = next <= vnDay() ? [...days, next] : days;
  const r1 = await redis([...days.map((d) => ["HGETALL", "ai:d:" + d]), ...src.map((d) => ["SMEMBERS", "rp:a:" + d])]);
  const phones = [...new Set(src.flatMap((_, i) => (r1[days.length + i] || []).filter((p) => /^\d{8,12}$/.test(p))))].sort();
  const aid = days.map((_, i) => aiOf(hashObj(r1[i])));
  const accs = {}, docs = {}, rpu = {};
  for (let i = 0; i < phones.length; i += 200) {
    const chunk = phones.slice(i, i + 200);
    const r2 = await redis([["MGET", ...chunk.map((p) => "acct:u:" + p)], ...chunk.flatMap((p) => days.map((d) => ["HGETALL", `rp:u:${d}:${p}`]))]);
    chunk.forEach((p, j) => {
      accs[p] = parse(r2[0][j]);
      rpu[p] = days.map((_, k) => hashObj(r2[1 + j * days.length + k]));
    });
    const kids = chunk.flatMap((p) => ((accs[p] && accs[p].children) || []).filter((c) => c && c.id).map((c) => [p, c]));
    for (let k = 0; k < kids.length; k += 200) {
      const part = kids.slice(k, k + 200);
      const [vals] = await redis([["MGET", ...part.map(([p, c]) => `acct:d:${p}:${c.id}`)]]);
      part.forEach(([p, c], j) => { (docs[p] = docs[p] || {})[c.id] = totalsOf(unpack(vals[j]) || {}).log; });
    }
  }
  return { days, phones, aid, accs, docs, rpu };
}

// Số liệu học + câu hỏi + tiền của MỘT ngày (chỉ số `idx` trong days)
function dayStats(L, idx) {
  const d = L.days[idx];
  const subj = {}, fams = [];
  let reviewed = 0, correct = 0, wrong = 0, sec = 0, kidsN = 0;
  for (const p of L.phones) {
    const acc = L.accs[p];
    if (!acc || acc.sys === "admin") continue;
    const u = L.rpu[p][idx] || {};
    const fam = { phone: maskPhone(p), name: acc.parentName || "", kids: [], reviewed: 0, correct: 0, sec: 0,
      sessions: n(u.sessions), asked: n(u.asked), bank_used: n(u.bank_used), fresh_used: n(u.fresh_used), new_q: n(u.new_q), usd: n(u.usd), in: n(u.in), out: n(u.out) };
    for (const c of acc.children || []) {
      const log = ((L.docs[p] || {})[c.id] || {})[d];
      if (!log) continue;
      const k = { name: c.name || "", grade: c.grade || "", reviewed: 0, correct: 0, sec: 0 };
      for (const [s, v] of Object.entries(log)) {
        const t = subj[s] || (subj[s] = { subject: s, reviewed: 0, correct: 0, wrong: 0, sec: 0, kids: 0 });
        t.reviewed += n(v.reviewed); t.correct += n(v.correct); t.wrong += n(v.wrong); t.sec += n(v.sec);
        if (n(v.reviewed) || n(v.sec)) t.kids++;
        k.reviewed += n(v.reviewed); k.correct += n(v.correct); k.sec += n(v.sec);
        wrong += n(v.wrong);
      }
      if (!k.reviewed && !k.sec) continue;
      fam.kids.push(k);
      fam.reviewed += k.reviewed; fam.correct += k.correct; fam.sec += k.sec;
    }
    if (!fam.kids.length && !fam.sessions && !fam.usd) continue;
    kidsN += fam.kids.length;
    reviewed += fam.reviewed; correct += fam.correct; sec += fam.sec;
    fams.push(fam);
  }
  fams.sort((a, b) => b.reviewed - a.reviewed || b.sec - a.sec || b.usd - a.usd || (a.phone < b.phone ? -1 : 1));
  const ai = L.aid[idx];
  return {
    day: d,
    study: { families: fams.filter((f) => f.kids.length).length, kids: kidsN, sessions: ai.sessions, reviewed, correct, wrong, sec,
      min: Math.round(sec / 60), pct: reviewed ? Math.round((100 * correct) / reviewed) : 0,
      bySubject: Object.values(subj).filter((t) => t.reviewed || t.sec).sort((a, b) => b.reviewed - a.reviewed).map((t) => ({ ...t, min: Math.round(t.sec / 60), pct: t.reviewed ? Math.round((100 * t.correct) / t.reviewed) : 0 })) },
    q: { asked: ai.asked, bank_used: ai.bank_used, fresh_used: ai.fresh_used, new_q: ai.new_q, spare: Math.max(0, ai.new_q - ai.fresh_used), bank_q: ai.bank_q, gen_runs: ai.gen_runs },
    ai,
    families: fams,
  };
}
// Bộ số dùng để so sánh hôm qua / trung bình 7 ngày
const keyNums = (s) => ({ kids: s.study.kids, families: s.study.families, sessions: s.study.sessions, reviewed: s.study.reviewed, min: s.study.min, pct: s.study.pct, asked: s.q.asked, usd: s.ai.usd });
function avgOf(list) {
  const o = {};
  for (const k of Object.keys(list[0])) o[k] = Math.round((10 * list.reduce((s, x) => s + x[k], 0)) / list.length) / 10;
  // đúng %: trung bình theo số câu (ngày không học không kéo xuống)
  const rev = list.reduce((s, x) => s + x.reviewed, 0);
  o.pct = rev ? Math.round(list.reduce((s, x) => s + (x.pct * x.reviewed), 0) / rev) : 0;
  o.usd = Math.round(list.reduce((s, x) => s + x.usd, 0) / list.length);
  return o;
}

// Báo cáo đầy đủ của một ngày (cho tab "📅 Báo cáo ngày" và email)
export async function buildReport(day) {
  const cfg = await getAiCfg({ fresh: true });
  const L = await load(day);
  const cur = dayStats(L, 0);
  const prev = L.days.slice(1).map((_, i) => keyNums(dayStats(L, i + 1)));
  let bank = { concepts: 0, questions: 0 };
  try { const b = await bankList(); bank = { concepts: b.total.concepts, questions: b.total.questions }; } catch { /* kho lỗi: bỏ qua */ }
  const sup = await getSupportCfg();
  const [lastRaw, sentRaw] = await redis([["GET", "rp:last"], ["GET", "rp:sent:" + day]]);
  const s = cur.study, ai = cur.ai;
  return {
    day, today: vnDay(), rate: cfg.rate,
    study: s, q: { ...cur.q, bankNow: bank },
    ai: { usd: ai.usd, calls: ai.calls, in: ai.in, out: ai.out, models: ai.models,
      kinds: Object.entries(ai.kinds).map(([k, v]) => ({ kind: k, ...v })).sort((a, b) => b.usd - a.usd),
      perSession: s.sessions ? Math.round(ai.usd / s.sessions) : 0, perKid: s.kids ? Math.round(ai.usd / s.kids) : 0 },
    cmp: { cur: keyNums(cur), yday: prev[0], avg7: avgOf(prev) },
    families: cur.families,
    mail: { on: cfg.reportOn, ready: mailReady(), emails: sup.alertEmails.length, reason: mailReason(cfg, sup), last: parse(lastRaw), sentToday: !!sentRaw },
  };
}
function mailReason(cfg, sup) {
  if (!sup.alertEmails.length) return "no_email";
  if (!mailReady()) return "mail_off";
  if (!cfg.reportOn) return "off";
  return "";
}

/* ---------- Thư báo cáo (chữ thường) ---------- */
export const vnd = (micro, rate) => Math.round((n(micro) / 1e6) * (n(rate) || 26000));
export const dong = (x) => String(Math.round(n(x))).replace(/\B(?=(\d{3})+(?!\d))/g, ".") + "đ";
export const usdTxt = (micro) => { const u = n(micro) / 1e6; return u > 0 && u < 0.005 ? "<0,01 USD" : u.toFixed(2).replace(".", ",") + " USD"; };
const num = (x) => String(Math.round(n(x))).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
const pctOf = (a, b) => (b ? Math.round((100 * a) / b) : 0);
const KIND_L = { gen: "Soạn câu ôn", extract: "Đọc bài (ảnh / chữ)", grade: "Chấm bài", judge: "Chấm câu tự gõ", spelling: "Vở Spelling", arena: "Thi đấu", cskh: "ONTAP trả lời góp ý", books: "Đọc sách (thư viện)", try: "Thử model" };
// thay đổi so với mốc: "tăng 12 (25%)" / "giảm 3 (10%)" / "tăng 1.300đ (gấp 11 lần)" / "bằng"
const dec = (x) => { const r = Math.round(Math.abs(x) * 10) / 10; return Number.isInteger(r) ? num(r) : String(r).replace(".", ","); };
export function delta(cur, base, unit = "") {
  const d = Math.round((cur - base) * 10) / 10;
  if (!d) return "bằng";
  const p = base ? Math.round((100 * Math.abs(d)) / base) : null;
  const tail = p == null ? "" : d > 0 && p >= 1000 ? ` (gấp ${dec(cur / base)} lần)` : ` (${p}%)`;
  return (d > 0 ? "tăng " : "giảm ") + dec(d) + unit + tail;
}
// Câu tóm tắt: "Hôm nay 3 con học 42 phút, làm 120 câu (đúng 85%). ONTAP tốn 2.300đ (0,09 USD)."
export function summaryLine(r) {
  const when = r.day === r.today ? "Hôm nay" : "Ngày " + dmy(r.day);
  return `${when} ${r.study.kids} con học ${r.study.min} phút, làm ${num(r.study.reviewed)} câu (đúng ${r.study.pct}%). ONTAP tốn ${dong(vnd(r.ai.usd, r.rate))} (${usdTxt(r.ai.usd)}).`;
}
export function reportMail(r, base) {
  const rate = r.rate, s = r.study, q = r.q, a = r.ai, c = r.cmp;
  const subject = `[Ôn Tập] Báo cáo ${dmy(r.day)}: ${s.kids} con · ${num(s.reviewed)} câu · ${s.min} phút · AI ${dong(vnd(a.usd, rate))}`;
  const L = [summaryLine(r), ""];
  L.push("HỌC", `- ${s.families} gia đình, ${s.kids} con, ${s.sessions} lượt ôn`, `- ${num(s.reviewed)} câu đã làm, đúng ${s.pct}% (${num(s.correct)} đúng, ${num(s.wrong)} sai), ${s.min} phút`);
  for (const t of s.bySubject) L.push(`  · ${t.subject}: ${num(t.reviewed)} câu, đúng ${t.pct}%, ${t.min} phút`);
  L.push("", "CÂU HỎI",
    `- Câu đưa cho con: ${num(q.asked)} = từ ngân hàng ${num(q.bank_used)} (${pctOf(q.bank_used, q.asked)}%) + mới soạn ${num(q.fresh_used)} (${pctOf(q.fresh_used, q.asked)}%)`,
    `- ONTAP soạn mới ${num(q.new_q)} câu (${num(q.spare)} câu để dành cho lần sau)`,
    `- Ngân hàng hiện có ${num(q.bankNow.questions)} câu, ${num(q.bankNow.concepts)} khái niệm`);
  L.push("", "AI (ONTAP)",
    `- Tiền: ${dong(vnd(a.usd, rate))} (${usdTxt(a.usd)}), ${num(a.calls)} lời gọi`,
    `- Token: vào ${num(a.in)}, ra ${num(a.out)}`,
    `- Trung bình: ${dong(vnd(a.perSession, rate))} / lượt ôn, ${dong(vnd(a.perKid, rate))} / con`);
  for (const k of a.kinds) L.push(`  · ${KIND_L[k.kind] || k.kind}: ${dong(vnd(k.usd, rate))} (${k.n} lời gọi)`);
  L.push("", "SO VỚI",
    `- Hôm qua: con ${delta(c.cur.kids, c.yday.kids)}, câu ${delta(c.cur.reviewed, c.yday.reviewed)}, phút ${delta(c.cur.min, c.yday.min)}, tiền AI ${delta(vnd(c.cur.usd, rate), vnd(c.yday.usd, rate), "đ")}`,
    `- Trung bình 7 ngày trước: con ${delta(c.cur.kids, c.avg7.kids)}, câu ${delta(c.cur.reviewed, c.avg7.reviewed)}, phút ${delta(c.cur.min, c.avg7.min)}, tiền AI ${delta(vnd(c.cur.usd, rate), vnd(c.avg7.usd, rate), "đ")}`);
  L.push("", `TỪNG GIA ĐÌNH${r.families.length > 10 ? " (10 gia đình học nhiều nhất / " + r.families.length + ")" : ""}`);
  if (!r.families.length) L.push("- Chưa có gia đình nào học.");
  for (const f of r.families.slice(0, 10)) {
    L.push(`- ${f.name || "(chưa ghi tên)"} ${f.phone}: ${f.kids.map((k) => k.name).join(", ") || "—"} · ${num(f.reviewed)} câu · ${Math.round(f.sec / 60)} phút · ${f.sessions} lượt · ngân hàng ${f.bank_used} / mới ${f.fresh_used} · ${dong(vnd(f.usd, rate))}`);
  }
  L.push("", `Xem chi tiết: ${base}/quan-tri (💸 Chi phí AI → 📅 Báo cáo ngày)`, "", "Ôn Tập");
  return { subject, text: L.join("\n") };
}

// Gửi thư báo cáo của `day`. test=true: "Gửi thử" của super admin (không tính lần gửi trong ngày, gửi cả khi đang tắt).
// Trả { ok, sent, skipped?, error? } — không ném lỗi.
export async function sendReport({ day, base, test = false }) {
  const cfg = await getAiCfg({ fresh: true });
  const sup = await getSupportCfg();
  const emails = sup.alertEmails.slice(0, 5);
  if (!emails.length) return { ok: true, sent: 0, skipped: "no_email" };
  if (!mailReady()) return { ok: true, sent: 0, skipped: "mail_off" };
  if (!test && !cfg.reportOn) return { ok: true, sent: 0, skipped: "off" };
  const sk = "rp:sent:" + day;
  if (!test) {
    const [ok] = await redis([["SET", sk, String(Date.now()), "NX", "EX", String(3 * 86400)]]);
    if (ok !== "OK") return { ok: true, sent: 0, skipped: "already" };
  }
  const r = await buildReport(day);
  const m = reportMail(r, base);
  let sent = 0, error = "";
  for (const to of emails) {
    try { await sendMail({ to, subject: m.subject, text: m.text }); sent++; } catch (e) { error = (e && e.code) || "mail_error"; console.error("report mail", error); }
  }
  // không gửi được thư nào -> bỏ dấu "đã gửi" để lần gọi sau thử lại
  if (!sent && !test) await redis([["DEL", sk]]).catch(() => {});
  await redis([["SET", "rp:last", JSON.stringify({ day, at: Date.now(), test, sent, of: emails.length, error })]]).catch(() => {});
  return sent ? { ok: true, sent, of: emails.length, subject: m.subject, ...(error ? { error } : {}) } : { ok: false, sent: 0, error: error || "mail_error" };
}
