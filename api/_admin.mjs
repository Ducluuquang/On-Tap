// Quản trị hệ thống (anh duyệt 17/11/2026): số điện thoại trong biến Vercel ADMIN_PHONES (cách nhau dấu phẩy).
// Chưa có biến -> không ai là quản trị. KHÔNG ghi số thật vào mã. Dùng chung cho api/admin.mjs, api/books.mjs, api/feedback.mjs.
import { redis, parse } from "./_store.mjs";
import { readToken } from "./_acctkey.mjs";

export const adminPhones = () => String(process.env.ADMIN_PHONES || "").split(/[,;\n]+/).map((p) => p.replace(/\D+/g, "")).filter((p) => /^\d{8,12}$/.test(p));
export const isAdmin = (phone) => !!phone && adminPhones().includes(phone);

// Máy đã đăng nhập: chìa khoá hợp lệ + tài khoản còn trên máy chủ + chưa đổi mật khẩu. Trả { phone, acc } hoặc null.
export async function userOf(req) {
  const t = readToken(req);
  if (!t) return null;
  const [raw] = await redis([["GET", "acct:u:" + t.phone]]);
  const acc = parse(raw);
  if (!acc || acc.pwv !== t.pwv) return null;
  return { phone: t.phone, acc };
}
