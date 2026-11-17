// Chìa khoá của máy đã đăng nhập (dùng chung cho api/account.mjs và api/books.mjs).
// Chìa khoá = số điện thoại (base64url) + số lần đổi mật khẩu + chữ ký HMAC. Đổi mật khẩu thì chìa khoá cũ hết hiệu lực.
import crypto from "node:crypto";
import { redisEnv } from "./_store.mjs";

export const okPhone = (p) => /^\d{8,12}$/.test(p);
export const signKey = () => { const c = redisEnv(); return crypto.createHash("sha256").update("ontap-acct|" + (process.env.ACCOUNT_SECRET || (c ? c.token || c.url : ""))).digest(); };
const sig = (phone, pwv) => crypto.createHmac("sha256", signKey()).update("acct|" + phone + "|" + pwv).digest("base64url");
export const tokenFor = (acc) => Buffer.from(acc.phone).toString("base64url") + "." + acc.pwv + "." + sig(acc.phone, acc.pwv);
export function readToken(req) {
  const m = /^Bearer ([A-Za-z0-9_-]{8,24})\.(\d{1,6})\.([A-Za-z0-9_-]{30,60})$/.exec(String((req.headers && req.headers.authorization) || ""));
  if (!m) return null;
  const phone = Buffer.from(m[1], "base64url").toString("utf8"), pwv = Number(m[2]);
  if (!okPhone(phone)) return null;
  const a = Buffer.from(m[3]), b = Buffer.from(sig(phone, pwv));
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  return { phone, pwv };
}
