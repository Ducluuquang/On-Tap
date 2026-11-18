// DUYỆT THAY ĐỔI + NHẬT KÝ THAY ĐỔI (anh duyệt 18/11/2026).
// Thay đổi áp dụng cho MỌI người dùng do ADMIN làm phải chờ SUPER ADMIN duyệt: bảng giá, đưa sách mới vào dùng, xoá sách.
// Super admin tự làm thì áp dụng ngay. Mọi thay đổi (ai làm, ai duyệt, cũ -> mới, lúc nào) đều ghi lại để xem về sau.
// Kho: chg:<id> (JSON) · chg:all ZSET (điểm = lúc tạo) · chg:pending SET các thay đổi đang chờ duyệt.
import crypto from "node:crypto";
import { redis, parse } from "./_store.mjs";

export const CHG_TYPES = { prices: "Đổi bảng giá", book_publish: "Đưa sách mới vào dùng", book_delete: "Xoá sách", staff_add: "Thêm admin", staff_remove: "Bỏ admin", settings: "Đổi cài đặt" };
export const okChgId = (id) => /^c[0-9a-f]{12}$/.test(String(id || ""));
export async function getChange(id) { return okChgId(id) ? parse((await redis([["GET", "chg:" + id]]))[0]) : null; }
export async function putChange(c) {
  await redis([["SET", "chg:" + c.id, JSON.stringify(c)], ["ZADD", "chg:all", String(c.at), c.id],
    c.status === "pending" ? ["SADD", "chg:pending", c.id] : ["SREM", "chg:pending", c.id]]);
  return c;
}
// status: "pending" (chờ duyệt) | "applied" (super admin làm, áp dụng ngay) | "approved" | "rejected"
export function newChange({ type, by, byName = "", title = "", before = null, after = null, ref = "", status = "pending" }) {
  const now = Date.now();
  return { id: "c" + crypto.randomBytes(6).toString("hex"), type, by, byName, title, before, after, ref, status, at: now,
    reviewedBy: status === "applied" ? by : "", reviewedAt: status === "applied" ? now : 0, note: "" };
}
export async function listChanges(limit = 200) {
  const [ids, pend] = await redis([["ZREVRANGE", "chg:all", "0", String(limit - 1)], ["SMEMBERS", "chg:pending"]]);
  const vals = (ids || []).length ? (await redis([["MGET", ...ids.map((i) => "chg:" + i)]]))[0] : [];
  return { list: (vals || []).map(parse).filter(Boolean), pending: (pend || []).length };
}
// Thay đổi đang chờ cùng loại + cùng đối tượng (vd 2 lần đề xuất giá) -> lần mới thay lần cũ.
export async function pendingOf(type, ref = "") {
  const [ids] = await redis([["SMEMBERS", "chg:pending"]]);
  if (!(ids || []).length) return null;
  const [vals] = await redis([["MGET", ...ids.map((i) => "chg:" + i)]]);
  return (vals || []).map(parse).find((c) => c && c.type === type && (c.ref || "") === ref) || null;
}

// Cài đặt chăm sóc khách hàng (chỉ super admin sửa): email nhận báo gấp, bật / tắt ONTAP tự trả lời góp ý.
export async function getSupportCfg() {
  const c = parse((await redis([["GET", "cfg:support"]]))[0]) || {};
  const env = String(process.env.ALERT_EMAIL || "");
  return {
    aiOn: c.aiOn !== false,
    alertEmails: Array.isArray(c.alertEmails) && c.alertEmails.length ? c.alertEmails : env.split(/[,;\s]+/).filter(Boolean),
    updated: c.updated || 0,
  };
}
export const okEmail = (e) => e.length <= 120 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
