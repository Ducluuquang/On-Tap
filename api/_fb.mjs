// GÓP Ý / BÁO LỖI (anh duyệt 17/11/2026): phụ huynh và học sinh gửi góp ý trong app; quản trị trả lời ở trang /quan-tri;
// người gửi thấy câu trả lời trong app (chấm đỏ báo mới). NHẬT KÝ TRÒ CHUYỆN LƯU VĨNH VIỄN (không hết hạn) để sau này
// AI chăm sóc khách hàng đọc và học: mỗi phiếu giữ nguyên các tin nhắn, loại (lỗi / kiến nghị / khác), bối cảnh (ai gửi,
// lớp của con, màn hình, máy), trạng thái và "Bài học / cách xử lý" quản trị ghi khi đóng phiếu. Tải toàn bộ: api/admin.mjs "fb_export".
// Khoá trong kho:
//   fb:t:<id>        phiếu (JSON) · fb:img:<id>:<n> ảnh chụp màn hình kèm tin nhắn thứ n (JPEG base64, ≤ 400 KB)
//   fb:all           ZSET mọi phiếu (điểm = lần cập nhật) · fb:u:<số điện thoại> ZSET phiếu của một tài khoản
//   fb:new           SET phiếu đang chờ quản trị (mới / người dùng vừa nhắn thêm)
//   fb:unr:<số>      SET phiếu có câu trả lời mới người dùng chưa xem · fb:rl:<số> đếm số lần gửi trong ngày
import crypto from "node:crypto";
import { redis, parse, clean } from "./_store.mjs";

export const FK = {
  t: (id) => "fb:t:" + id,
  img: (id, n) => "fb:img:" + id + ":" + n,
  all: "fb:all",
  user: (phone) => "fb:u:" + phone,
  pending: "fb:new",
  unread: (phone) => "fb:unr:" + phone,
  rl: (phone) => "fb:rl:" + phone,
};
export const KINDS = { bug: "Báo lỗi", idea: "Kiến nghị", other: "Khác" };
export const STATUS = { new: "Mới", answered: "Đã trả lời", done: "Đã xong" };
export const TEXT_MAX = 2000;
export const IMG_MAX = 400000;          // ảnh chụp màn hình (base64) tối đa ~400 KB
export const SEND_DAY_MAX = 20;         // mỗi tài khoản gửi tối đa 20 tin nhắn / ngày

export const okId = (id) => /^f[0-9a-f]{12}$/.test(String(id || ""));
export const newId = () => "f" + crypto.randomBytes(6).toString("hex");
// Văn bản nhiều dòng: giữ xuống dòng, bỏ ký tự điều khiển, cắt độ dài.
export const cleanText = (v, n = TEXT_MAX) => String(v == null ? "" : v).replace(/\r\n?/g, "\n").replace(/[\u0000-\u0008\u000b-\u001f\u007f]+/g, " ").replace(/\n{4,}/g, "\n\n\n").trim().slice(0, n);
export function cleanImg(b64) {
  const s = String(b64 || "").replace(/^data:image\/\w+;base64,/, "");
  if (!s) return "";
  if (s.length > IMG_MAX || !/^[A-Za-z0-9+/=]+$/.test(s)) return null;
  const head = Buffer.from(s.slice(0, 16), "base64");
  if (!(head[0] === 0xff && head[1] === 0xd8) && !(head[0] === 0x89 && head[1] === 0x50)) return null;   // JPEG / PNG
  return s;
}
export const getThread = async (id) => parse((await redis([["GET", FK.t(id)]]))[0]);
export const putThread = (t) => redis([["SET", FK.t(t.id), JSON.stringify(t)], ["ZADD", FK.all, String(t.updated), t.id], ["ZADD", FK.user(t.phone), String(t.updated), t.id]]);
// Bản gửi về trình duyệt (không kèm ảnh, chỉ đánh dấu có ảnh).
export const pubThread = (t) => ({ id: t.id, kind: t.kind, status: t.status, created: t.created, updated: t.updated, who: t.who, child: t.child || null,
  escalated: !!t.escalated,
  msgs: (t.msgs || []).map((m, i) => ({ n: i, by: m.by, who: m.who || "", text: m.text, at: m.at, img: !!m.img })) });
export const meta = (b) => ({
  screen: clean(b && b.screen, 60), ua: clean(b && b.ua, 160), ver: clean(b && b.ver, 40),
});
