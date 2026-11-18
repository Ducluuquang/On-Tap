// Quản trị hệ thống (anh duyệt 17/11/2026): số điện thoại trong biến Vercel ADMIN_PHONES (cách nhau dấu phẩy).
// Chưa có biến -> không ai là quản trị. KHÔNG ghi số thật vào mã. Dùng chung cho api/admin.mjs, api/books.mjs, api/feedback.mjs.
import { redis, parse } from "./_store.mjs";
import { readToken } from "./_acctkey.mjs";

// Số Việt Nam viết "+84 912…" / "84912…" -> "0912…" (giống cách tài khoản lưu số).
export const vnPhone = (v) => { const d = String(v == null ? "" : v).replace(/\D+/g, ""); return /^84\d{9}$/.test(d) ? "0" + d.slice(2) : d; };
export const adminPhones = () => String(process.env.ADMIN_PHONES || "").split(/[,;\n]+/).map(vnPhone).filter((p) => /^\d{8,12}$/.test(p));
// HAI CẤP QUẢN TRỊ (anh duyệt 18/11/2026):
//  - SUPER ADMIN = số trong ADMIN_PHONES (Vercel): làm được mọi việc, duyệt thay đổi của admin, thêm / bỏ admin, cài đặt.
//  - ADMIN (người làm) = do super admin thêm trong /quan-tri (kho: SET adm:staff, HASH adm:staffinfo): làm việc hằng ngày;
//    đổi bảng giá, đưa sách mới vào dùng, xoá sách phải CHỜ super admin duyệt (api/_changes.mjs).
export const isSuper = (phone) => !!phone && adminPhones().includes(phone);
export const isAdmin = isSuper;   // giữ tên cũ: "là super admin" (lần đầu tạo tài khoản bằng mã cài đặt chỉ dành cho super admin)
export async function roleOf(phone) {
  if (!phone) return "";
  if (isSuper(phone)) return "super";
  const [m] = await redis([["SISMEMBER", "adm:staff", phone]]);
  return Number(m) === 1 ? "admin" : "";
}

// Máy đã đăng nhập: chìa khoá hợp lệ + tài khoản còn trên máy chủ + chưa đổi mật khẩu. Trả { phone, acc } hoặc null.
export async function userOf(req) {
  const t = readToken(req);
  if (!t) return null;
  const [raw] = await redis([["GET", "acct:u:" + t.phone]]);
  const acc = parse(raw);
  if (!acc || acc.pwv !== t.pwv) return null;
  return { phone: t.phone, acc };
}
