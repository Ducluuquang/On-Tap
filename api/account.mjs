// Ôn Tập: TÀI KHOẢN PHỤ HUYNH Ở MÁY CHỦ — ĐĂNG NHẬP ĐƯỢC TRÊN MỌI MÁY (anh yêu cầu 01/11/2026).
// Trước đây tài khoản chỉ lưu trên máy đã đăng ký (localStorage), nên máy khác không đăng nhập được.
// Bây giờ: đăng ký xong thì tài khoản (số điện thoại, email, thông tin phụ huynh, gói, PIN phụ huynh, danh sách con)
// được lưu ở kho Upstash (chung kho với phần Thi đấu). Máy nào cũng đăng nhập được bằng SỐ ĐIỆN THOẠI hoặc EMAIL + mật khẩu.
//  - Mật khẩu KHÔNG lưu dạng chữ: chỉ lưu mã băm scrypt + muối ngẫu nhiên.
//  - Đăng nhập xong máy nhận "chìa khoá" (chữ ký HMAC của số điện thoại + số lần đổi mật khẩu) để đồng bộ về sau
//    (thêm con, đổi email, đổi PIN, đổi mật khẩu). Đổi mật khẩu thì chìa khoá cũ ở các máy khác hết hiệu lực.
//  - Chống dò mật khẩu: sai 10 lần trong 15 phút thì tạm khoá đăng nhập tài khoản đó 15 phút; mỗi địa chỉ mạng
//    tối đa 60 lần đăng nhập / 10 phút, 20 lần đăng ký / giờ.
//  - DỮ LIỆU HỌC của từng con (05/11/2026, hành động "data"): bản đồ kiến thức, thời gian học, nhật ký, câu đã gặp,
//    bộ từ + lịch ôn Vở Spelling. Máy gửi bản của mình, máy chủ GỘP với bản đang lưu (api/_sync/merge.mjs: không mất bài,
//    không cộng trùng giờ học) rồi trả bản gộp. Cài đặt phụ huynh (trắc nghiệm, khẩu hiệu) đi chung, tên tài liệu "_settings".
//  - QUÊN MẬT KHẨU Ở MỌI MÁY (10/11/2026, "forgot_send" + "forgot_reset", không cần chìa khoá): gửi MÃ 6 SỐ tới email
//    đã đăng ký (api/_mail.mjs). Kho chỉ giữ HMAC của mã (hết hạn 15 phút, dùng 1 lần, sai 5 lần huỷ mã); mỗi tài khoản
//    3 lần gửi / giờ, mỗi địa chỉ mạng 10 lần gửi / giờ. Đúng mã -> mật khẩu mới, các máy khác tự đăng xuất.
//    Cách cũ ("reset", cần chìa khoá của máy đã đăng nhập) vẫn giữ làm dự phòng.
// Khoá trong kho: acct:u:<số điện thoại> (tài khoản), acct:e:<email> (-> số điện thoại), acct:rl:* (đếm chống dò / chống spam),
// acct:fc:<số điện thoại> (HMAC mã quên mật khẩu), acct:ft:<số điện thoại> (số lần nhập sai mã),
// acct:idx (danh mục tài khoản cho trang quản trị), acct:seen:<số> (lần dùng gần nhất),
// acct:d:<số điện thoại>:<id con> (dữ liệu học, nén gzip), acct:dr:… (số phiên bản), acct:dl:… (khoá ngắn khi đang gộp).
// Mọi kết quả nghiệp vụ (sai mật khẩu, số đã đăng ký…) trả HTTP 200 + { ok:false, error } để trình duyệt không báo lỗi đỏ.
import crypto from "node:crypto";
import zlib from "node:zlib";
import { redis, redisEnv, send, readBody, clean, parse, clientIp } from "./_store.mjs";
import { cleanDoc, mergeDocs, stable, okId } from "./_sync/merge.mjs";
import { mailReady, sendMail } from "./_mail.mjs";
import { okPhone, signKey, tokenFor, readToken } from "./_acctkey.mjs";

const K = {
  user: (phone) => "acct:u:" + phone,
  email: (em) => "acct:e:" + em,
  rl: (k) => "acct:rl:" + k,
  data: (phone, child) => "acct:d:" + phone + ":" + child,
  drev: (phone, child) => "acct:dr:" + phone + ":" + child,
  dlock: (phone, child) => "acct:dl:" + phone + ":" + child,
  fcode: (phone) => "acct:fc:" + phone,
  ftries: (phone) => "acct:ft:" + phone,
  idx: "acct:idx",                       // danh mục tài khoản (ZSET: điểm = ngày tạo) cho trang quản trị
  seen: (phone) => "acct:seen:" + phone,   // lần dùng app gần nhất (trang quản trị)
};
const MAX_KIDS = 12;
const FAIL_MAX = 10, FAIL_TTL = 900;          // sai mật khẩu 10 lần / 15 phút -> tạm khoá 15 phút
const LOGIN_IP_MAX = 60, LOGIN_IP_TTL = 600;  // mỗi địa chỉ mạng: 60 lần đăng nhập / 10 phút
const REG_IP_MAX = 20, REG_IP_TTL = 3600;     // mỗi địa chỉ mạng: 20 lần đăng ký (hoặc chuyển tài khoản cũ lên máy chủ) / giờ
const CHECK_IP_MAX = 60;                      // kiểm tra số điện thoại / email đã đăng ký chưa: 60 lần / giờ
const UPD_MAX = 300;                          // mỗi tài khoản: 300 lần cập nhật / giờ
const CODE_TTL = 900;                         // mã quên mật khẩu dùng được 15 phút
const CODE_TRIES = 5;                         // nhập sai mã 5 lần -> huỷ mã
const SEND_ACC_MAX = 3, SEND_IP_MAX = 10;     // gửi mã: mỗi tài khoản 3 lần / giờ, mỗi địa chỉ mạng 10 lần / giờ
const DATA_MAX = 1500;                        // mỗi tài khoản: 1.500 lần gửi dữ liệu học / giờ (mọi con, mọi máy)
const DOC_MAX = 6000000;                      // dữ liệu học một con tối đa ~6 MB (chữ JSON trước khi nén)
const BODY_MAX = 8000000;                     // yêu cầu gửi dữ liệu học tối đa 8 MB
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// Mở khoá gộp: chỉ xoá khoá nếu vẫn là khoá của chính lần này (khoá đã hết hạn và máy khác đang giữ thì để nguyên).
export const UNLOCK = "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end";
// Dữ liệu học lưu nén gzip (đỡ tốn chỗ + băng thông kho); "gz:" ở đầu để sau này đổi cách lưu vẫn đọc được bản cũ.
const pack = (doc) => "gz:" + zlib.gzipSync(Buffer.from(JSON.stringify(doc), "utf8")).toString("base64");
function unpack(raw) {
  if (!raw) return null;
  try { return String(raw).startsWith("gz:") ? JSON.parse(zlib.gunzipSync(Buffer.from(String(raw).slice(3), "base64")).toString("utf8")) : JSON.parse(raw); }
  catch { return null; }
}

const normPhone = (v) => String(v == null ? "" : v).replace(/\D+/g, "");
const normEmail = (v) => String(v == null ? "" : v).trim().toLowerCase();
const okEmail = (e) => e.length <= 120 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
const okPass = (p) => typeof p === "string" && p.length >= 4 && p.length <= 64;
const int = (v, lo, hi) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : lo; };

/* ---------- Mật khẩu: scrypt + muối ---------- */
const scrypt = (pass, salt) => new Promise((ok, no) => crypto.scrypt(String(pass), salt, 32, { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }, (e, k) => (e ? no(e) : ok(k))));
async function hashPass(pass) {
  const salt = crypto.randomBytes(16);
  return { salt: salt.toString("base64"), hash: (await scrypt(pass, salt)).toString("base64") };
}
async function checkPass(acc, pass) {
  if (!acc || !acc.salt || !acc.hash || typeof pass !== "string" || !pass) return false;
  const a = await scrypt(pass, Buffer.from(acc.salt, "base64")), b = Buffer.from(acc.hash, "base64");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/* ---------- Chìa khoá của máy đã đăng nhập: api/_acctkey.mjs ---------- */

/* ---------- Mã quên mật khẩu (chỉ lưu HMAC của mã) ---------- */
const codeMac = (phone, code) => crypto.createHmac("sha256", signKey()).update("forgot|" + phone + "|" + code).digest("base64url");
function sameMac(a, b) {
  const x = Buffer.from(String(a || "")), y = Buffer.from(String(b || ""));
  return x.length === y.length && x.length > 0 && crypto.timingSafeEqual(x, y);
}
// Che email: "ongtap@gmail.com" -> "o***@gmail.com"
const maskEmail = (em) => { const i = em.indexOf("@"); return i <= 0 ? "***" : em[0] + "***" + em.slice(i); };
// "Số điện thoại hoặc email" -> số điện thoại của tài khoản ("" nếu không tìm được)
async function phoneFromId(id) {
  const s = String(id == null ? "" : id).trim();
  if (s.includes("@")) {
    const em = normEmail(s);
    return okEmail(em) ? (await redis([["GET", K.email(em)]]))[0] || "" : "";
  }
  const p = normPhone(s);
  return okPhone(p) ? p : "";
}

/* ---------- Dữ liệu tài khoản ---------- */
function cleanChild(c) {
  const id = String((c && c.id) || "");
  if (!/^[A-Za-z0-9_-]{2,40}$/.test(id)) return null;
  return {
    id,
    name: clean(c.name, 40) || "Bé",
    pin: String(c.pin == null ? "" : c.pin).replace(/\D+/g, "").slice(0, 2),
    icon: Array.from(clean(c.icon, 16)).slice(0, 4).join(""),
    grade: clean(c.grade, 20),
    school: clean(c.school, 80),
    schoolType: clean(c.schoolType, 40),
  };
}
function profileFrom(b) {
  const seen = new Set(), children = [];
  for (const c of Array.isArray(b && b.children) ? b.children : []) {
    const x = cleanChild(c);
    if (x && !seen.has(x.id) && children.length < MAX_KIDS) { seen.add(x.id); children.push(x); }
  }
  return {
    parentName: clean(b && b.parentName, 60),
    province: clean(b && b.province, 60),
    plan: int(b && b.plan, 1, 20),
    pin: String((b && b.pin) == null ? "" : b.pin).replace(/\D+/g, "").slice(0, 2),
    children,
  };
}
const pub = (a) => ({ phone: a.phone, email: a.email || "", parentName: a.parentName || "", province: a.province || "", plan: a.plan || 1, pin: a.pin || "", children: a.children || [], rev: a.rev || 1, updated: a.updated || 0 });
const getAcc = async (phone) => parse((await redis([["GET", K.user(phone)]]))[0]);
const putAcc = (acc) => redis([["SET", K.user(acc.phone), JSON.stringify(acc)]]);

/* ---------- Đếm chống dò / chống spam ---------- */
async function bump(key, max, ttl) {   // tăng 1; true nếu đã vượt hạn mức
  const [n] = await redis([["INCR", K.rl(key)]]);
  if (Number(n) === 1) await redis([["EXPIRE", K.rl(key), ttl]]);
  return Number(n) > max;
}
const failsOf = async (who) => Number((await redis([["GET", K.rl("fail:" + who)]]))[0]) || 0;
const addFail = (who) => bump("fail:" + who, FAIL_MAX, FAIL_TTL);
const clearFails = (who) => redis([["DEL", K.rl("fail:" + who)]]);

// Tạo tài khoản mới (đăng ký, hoặc chuyển tài khoản cũ trên máy lên máy chủ). Email đã thuộc tài khoản khác:
// strictEmail -> báo lỗi; không thì vẫn tạo tài khoản nhưng bỏ email (emailOk:false).
async function create(phone, email, pass, b, strictEmail) {
  if (email) {
    const [owner] = await redis([["GET", K.email(email)]]);
    if (owner && owner !== phone) { if (strictEmail) return { error: "email_taken" }; email = ""; }
  }
  const now = Date.now();
  const acc = { v: 1, phone, email, ...profileFrom(b), ...(await hashPass(pass)), pwv: 1, rev: 1, created: now, updated: now };
  const [ok] = await redis([["SET", K.user(phone), JSON.stringify(acc), "NX"]]);
  if (ok !== "OK") return { error: "phone_taken" };
  await redis([["ZADD", K.idx, String(now), phone], ["SET", K.seen(phone), String(now)]]);
  let emailOk = true;
  if (email) {
    const [r] = await redis([["SET", K.email(email), phone, "NX"]]);
    if (r !== "OK") {
      const [owner] = await redis([["GET", K.email(email)]]);
      if (owner !== phone) { emailOk = false; acc.email = ""; await putAcc(acc); }
    }
  } else if (normEmail(b && b.email)) emailOk = false;
  return { acc, emailOk };
}

export default async function handler(req, res) {
  if (req.method === "GET") return send(res, 200, { ok: true, accounts: !!redisEnv() });
  if (req.method !== "POST") return send(res, 405, { ok: false, error: "method" });
  if (!redisEnv()) return send(res, 200, { ok: false, error: "no_store", accounts: false });
  let b;
  try { b = await readBody(req, BODY_MAX); } catch { return send(res, 400, { ok: false, error: "bad_json" }); }
  b = b && typeof b === "object" ? b : {};
  const ip = clientIp(req);
  try {
    switch (String(b.action || "")) {
      // ---- Số điện thoại / email đã có tài khoản chưa (màn đăng ký, trước khi sang trang thanh toán) ----
      case "check": {
        const phone = normPhone(b.phone), email = normEmail(b.email);
        if (await bump("check:" + ip, CHECK_IP_MAX, 3600)) return send(res, 200, { ok: false, error: "slow_down" });
        const [u, e] = await redis([["EXISTS", K.user(okPhone(phone) ? phone : "-")], ["GET", K.email(okEmail(email) ? email : "-")]]);
        return send(res, 200, { ok: true, phoneTaken: okPhone(phone) && Number(u) === 1, emailTaken: !!e });
      }
      // ---- Đăng ký mới ----
      case "register": {
        const phone = normPhone(b.phone), email = normEmail(b.email), pass = typeof b.pass === "string" ? b.pass : "";
        if (!okPhone(phone)) return send(res, 400, { ok: false, error: "bad_phone" });
        if (!okPass(pass)) return send(res, 400, { ok: false, error: "bad_pass" });
        if (email && !okEmail(email)) return send(res, 400, { ok: false, error: "bad_email" });
        if (await bump("reg:" + ip, REG_IP_MAX, REG_IP_TTL)) return send(res, 200, { ok: false, error: "slow_down" });
        const r = await create(phone, email, pass, b, true);
        if (r.error) return send(res, 200, { ok: false, error: r.error });
        return send(res, 200, { ok: true, token: tokenFor(r.acc), account: pub(r.acc), emailOk: r.emailOk });
      }
      // ---- Tài khoản cũ (chỉ có trên một máy) tự chuyển lên máy chủ khi mở app ----
      // Chưa có trên máy chủ -> tạo. Đã có (đăng ký ở máy khác) + đúng mật khẩu -> trả tài khoản để máy gộp danh sách con.
      case "claim": {
        const phone = normPhone(b.phone), email = normEmail(b.email), pass = typeof b.pass === "string" ? b.pass : "";
        if (!okPhone(phone) || !okPass(pass)) return send(res, 400, { ok: false, error: "bad_request" });
        const cur = await getAcc(phone);
        if (cur) {
          if ((await failsOf(phone)) >= FAIL_MAX) return send(res, 200, { ok: false, error: "slow_down" });
          if (!(await checkPass(cur, pass))) { await addFail(phone); return send(res, 200, { ok: false, error: "phone_taken" }); }
          await clearFails(phone);
          return send(res, 200, { ok: true, created: false, token: tokenFor(cur), account: pub(cur) });
        }
        if (await bump("reg:" + ip, REG_IP_MAX, REG_IP_TTL)) return send(res, 200, { ok: false, error: "slow_down" });
        const r = await create(phone, okEmail(email) ? email : "", pass, b, false);
        if (r.error) return send(res, 200, { ok: false, error: r.error });
        return send(res, 200, { ok: true, created: true, token: tokenFor(r.acc), account: pub(r.acc), emailOk: r.emailOk });
      }
      // ---- Đăng nhập bằng số điện thoại hoặc email ----
      case "login": {
        const id = String(b.id == null ? "" : b.id).trim(), pass = typeof b.pass === "string" ? b.pass : "";
        if (await bump("login:" + ip, LOGIN_IP_MAX, LOGIN_IP_TTL)) return send(res, 200, { ok: false, error: "slow_down" });
        let phone = "", who = "";
        if (id.includes("@")) {
          const em = normEmail(id);
          who = "e:" + em;
          if (okEmail(em)) phone = (await redis([["GET", K.email(em)]]))[0] || "";
        } else { phone = normPhone(id); who = phone; }
        if (phone) who = phone;
        if (!who || who === "e:") return send(res, 200, { ok: false, error: "bad_login" });
        if ((await failsOf(who)) >= FAIL_MAX) return send(res, 200, { ok: false, error: "slow_down" });
        const acc = okPhone(phone) ? await getAcc(phone) : null;
        if (!acc || !(await checkPass(acc, pass))) { await addFail(who); return send(res, 200, { ok: false, error: "bad_login" }); }
        await clearFails(who);
        await redis([["SET", K.seen(acc.phone), String(Date.now())]]);
        return send(res, 200, { ok: true, token: tokenFor(acc), account: pub(acc) });
      }
      // ---- Quên mật khẩu, bước 1: gửi mã 6 số tới email đã đăng ký (máy nào cũng làm được) ----
      case "forgot_send": {
        const id = String(b.id == null ? "" : b.id).trim();
        if (!id) return send(res, 200, { ok: false, error: "bad_id" });
        if (await bump("fsip:" + ip, SEND_IP_MAX, 3600)) return send(res, 200, { ok: false, error: "send_limit" });
        const phone = await phoneFromId(id);
        const acc = phone ? await getAcc(phone) : null;
        if (!acc) return send(res, 200, { ok: false, error: "not_found" });
        const email = normEmail(acc.email);
        if (!email || !okEmail(email)) return send(res, 200, { ok: false, error: "no_email" });
        if (!mailReady()) return send(res, 200, { ok: false, error: "mail_off" });
        if (await bump("fs:" + phone, SEND_ACC_MAX, 3600)) return send(res, 200, { ok: false, error: "send_limit" });
        const code = String(crypto.randomInt(0, 1000000)).padStart(6, "0");
        const mac = codeMac(phone, code);
        await redis([["SET", K.fcode(phone), mac, "EX", String(CODE_TTL)], ["DEL", K.ftries(phone)]]);
        try {
          await sendMail({
            to: email,
            subject: "Mã đặt lại mật khẩu Ôn Tập: " + code,
            text: "Mã đặt lại mật khẩu Ôn Tập của anh/chị là: " + code + "\n\n"
              + "Mã hết hạn sau 15 phút và chỉ dùng được một lần.\n\n"
              + "Nếu không phải anh/chị yêu cầu, hãy bỏ qua thư này.\n\nÔn Tập",
          });
        } catch (e) {
          // gửi lỗi -> xoá mã vừa tạo (chỉ xoá nếu vẫn là mã của lần này)
          await redis([["EVAL", UNLOCK, "1", K.fcode(phone), mac]]).catch(() => {});
          console.error("forgot mail error", (e && e.reason) || (e && e.code) || "send");
          return send(res, 200, { ok: false, error: e && e.code === "mail_off" ? "mail_off" : "mail_error" });
        }
        return send(res, 200, { ok: true, to: maskEmail(email), ttl: CODE_TTL, wait: 60 });
      }
      // ---- Quên mật khẩu, bước 2: kiểm mã -> đặt mật khẩu mới, trả chìa khoá (máy này vào app luôn) ----
      case "forgot_reset": {
        const id = String(b.id == null ? "" : b.id).trim(), next = typeof b.next === "string" ? b.next : "";
        const code = String(b.code == null ? "" : b.code).replace(/\s+/g, "");
        if (await bump("login:" + ip, LOGIN_IP_MAX, LOGIN_IP_TTL)) return send(res, 200, { ok: false, error: "slow_down" });
        if (!/^\d{8}$/.test(next)) return send(res, 200, { ok: false, error: "bad_pass" });   // sai dạng: không đụng tới mã
        if (!/^\d{6}$/.test(code)) return send(res, 200, { ok: false, error: "bad_code" });
        const phone = await phoneFromId(id);
        const acc0 = phone ? await getAcc(phone) : null;
        if (!acc0) return send(res, 200, { ok: false, error: "not_found" });
        const [stored] = await redis([["GET", K.fcode(phone)]]);
        if (!stored) return send(res, 200, { ok: false, error: "code_expired" });
        if (!sameMac(stored, codeMac(phone, code))) {
          const [n] = await redis([["INCR", K.ftries(phone)], ["EXPIRE", K.ftries(phone), String(CODE_TTL)]]);
          if (Number(n) >= CODE_TRIES) {
            await redis([["EVAL", UNLOCK, "1", K.fcode(phone), stored], ["DEL", K.ftries(phone)]]);
            return send(res, 200, { ok: false, error: "code_locked" });
          }
          return send(res, 200, { ok: false, error: "code_wrong", left: CODE_TRIES - Number(n) });
        }
        // dùng 1 lần: chỉ lần xoá được mã (đúng mã này) mới được đặt mật khẩu
        const [del] = await redis([["EVAL", UNLOCK, "1", K.fcode(phone), stored]]);
        if (Number(del) !== 1) return send(res, 200, { ok: false, error: "code_expired" });
        const acc = (await getAcc(phone)) || acc0;
        const nx = { ...acc, ...(await hashPass(next)), pwv: (acc.pwv || 1) + 1, rev: (acc.rev || 1) + 1, updated: Date.now() };
        await putAcc(nx);
        await redis([["DEL", K.ftries(phone)], ["DEL", K.rl("fail:" + phone)], ...(acc.email ? [["DEL", K.rl("fail:e:" + normEmail(acc.email))]] : [])]);
        return send(res, 200, { ok: true, token: tokenFor(nx), account: pub(nx) });
      }
    }

    // ---- Các việc dưới đây cần chìa khoá của máy đã đăng nhập ----
    const t = readToken(req);
    const acc = t ? await getAcc(t.phone) : null;
    if (!acc || acc.pwv !== t.pwv) return send(res, 200, { ok: false, error: "bad_token" });
    switch (String(b.action || "")) {
      case "get":
        await redis([["SET", K.seen(acc.phone), String(Date.now())]]);   // mở app: ghi lần dùng gần nhất (trang quản trị)
        return send(res, 200, { ok: true, account: pub(acc) });
      // Thêm con, đổi email, đổi PIN phụ huynh… (máy gửi cả tài khoản; máy chủ chỉ nhận các mục được phép)
      case "update": {
        if (await bump("upd:" + acc.phone, UPD_MAX, 3600)) return send(res, 200, { ok: false, error: "slow_down" });
        const a = b.account && typeof b.account === "object" ? b.account : {};
        const p = profileFrom(a);
        let email = acc.email || "";
        if (Object.prototype.hasOwnProperty.call(a, "email")) {
          const em = normEmail(a.email);
          if (em && !okEmail(em)) return send(res, 400, { ok: false, error: "bad_email" });
          if (em !== email) {
            if (em) {
              const [r] = await redis([["SET", K.email(em), acc.phone, "NX"]]);
              if (r !== "OK") { const [owner] = await redis([["GET", K.email(em)]]); if (owner !== acc.phone) return send(res, 200, { ok: false, error: "email_taken" }); }
            }
            if (email) { const [owner] = await redis([["GET", K.email(email)]]); if (owner === acc.phone) await redis([["DEL", K.email(email)]]); }
            email = em;
          }
        }
        const has = (k) => Object.prototype.hasOwnProperty.call(a, k);
        const next = { ...acc, email, rev: (acc.rev || 1) + 1, updated: Date.now() };
        for (const k of ["parentName", "province", "plan", "pin"]) if (has(k)) next[k] = p[k];   // chỉ đổi mục máy gửi lên
        if (p.children.length) next.children = p.children;      // không bao giờ để tài khoản mất hết danh sách con
        await putAcc(next);
        return send(res, 200, { ok: true, account: pub(next) });
      }
      // Đổi mật khẩu (Cài đặt): cần mật khẩu hiện tại. Xong thì chìa khoá cũ ở các máy khác hết hiệu lực.
      case "password": {
        if ((await failsOf(acc.phone)) >= FAIL_MAX) return send(res, 200, { ok: false, error: "slow_down" });
        if (!(await checkPass(acc, typeof b.cur === "string" ? b.cur : ""))) { await addFail(acc.phone); return send(res, 200, { ok: false, error: "bad_password" }); }
        if (!okPass(b.next)) return send(res, 400, { ok: false, error: "bad_pass" });
        const next = { ...acc, ...(await hashPass(b.next)), pwv: (acc.pwv || 1) + 1, rev: (acc.rev || 1) + 1, updated: Date.now() };
        await putAcc(next); await clearFails(acc.phone);
        return send(res, 200, { ok: true, token: tokenFor(next), account: pub(next) });
      }
      // Quên mật khẩu, làm trên máy ĐÃ đăng nhập tài khoản này (máy còn chìa khoá hợp lệ) — giống "Quên mật khẩu" trước đây.
      case "reset": {
        if (!okPass(b.next)) return send(res, 400, { ok: false, error: "bad_pass" });
        const next = { ...acc, ...(await hashPass(b.next)), pwv: (acc.pwv || 1) + 1, rev: (acc.rev || 1) + 1, updated: Date.now() };
        await putAcc(next); await clearFails(acc.phone);
        return send(res, 200, { ok: true, token: tokenFor(next), account: pub(next) });
      }
      // DỮ LIỆU HỌC của một con (05/11/2026). Không kèm doc: hỏi bản mới nhất (gửi rev đang có, giống thì trả same).
      // Kèm doc: gộp với bản đang lưu, lưu lại, trả bản gộp (giống hệt bản máy gửi thì chỉ trả same + rev).
      case "data": {
        const child = String(b.child == null ? "" : b.child);
        if (!(child === "_settings" || (okId(child) && (acc.children || []).some((c) => c.id === child)))) return send(res, 200, { ok: false, error: "no_child" });
        const dk = K.data(acc.phone, child), rk = K.drev(acc.phone, child);
        if (b.doc == null) {
          const [rv] = await redis([["GET", rk]]);
          const rev = Number(rv) || 0;
          if (rev && rev === Number(b.rev)) return send(res, 200, { ok: true, rev, same: true });
          if (!rev) return send(res, 200, { ok: true, rev: 0, doc: null });
          const [raw] = await redis([["GET", dk]]);
          return send(res, 200, { ok: true, rev, doc: unpack(raw) });
        }
        if (await bump("data:" + acc.phone, DATA_MAX, 3600)) return send(res, 200, { ok: false, error: "slow_down" });
        const incoming = mergeDocs(b.doc, b.doc);   // làm sạch + áp luật (dấu xoá, xoá hết dữ liệu)
        const inStr = stable(incoming);
        if (inStr.length > DOC_MAX) return send(res, 200, { ok: false, error: "too_big" });
        // khoá ngắn: hai máy gửi cùng lúc thì lần lượt gộp, không máy nào ghi đè mất phần của máy kia
        const lk = K.dlock(acc.phone, child), nonce = crypto.randomBytes(8).toString("hex");
        let got = false;
        for (let i = 0; i < 30 && !got; i++) {
          const [r] = await redis([["SET", lk, nonce, "NX", "PX", "8000"]]);
          got = r === "OK";
          if (!got) await sleep(150);
        }
        if (!got) return send(res, 200, { ok: false, error: "busy" });
        try {
          const [raw, rv] = await redis([["GET", dk], ["GET", rk]]);
          const cur = unpack(raw);
          const merged = cur ? mergeDocs(cur, incoming) : incoming;
          const mStr = stable(merged);
          if (mStr.length > DOC_MAX) return send(res, 200, { ok: false, error: "too_big" });
          let rev = Number(rv) || 0;
          if (!cur || !rev || mStr !== stable(cleanDoc(cur))) {
            rev += 1;
            await redis([["SET", dk, pack(merged)], ["SET", rk, String(rev)]]);
          }
          return send(res, 200, mStr === inStr ? { ok: true, rev, same: true } : { ok: true, rev, doc: merged });
        } finally {
          await redis([["EVAL", UNLOCK, "1", lk, nonce]]).catch(() => {});
        }
      }
      default:
        return send(res, 400, { ok: false, error: "bad_action" });
    }
  } catch (e) {
    if (e && (e.code === "store_limit" || e.code === "store_error" || e.code === "no_store")) return send(res, 200, { ok: false, error: e.code });
    console.error("account error", e && e.message);
    return send(res, 500, { ok: false, error: "server" });
  }
}
