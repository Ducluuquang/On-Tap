// Ôn Tập: GỬI EMAIL (10/11/2026 — mã "Quên mật khẩu" gửi tới email đã đăng ký).
// Gửi bằng Gmail riêng của app qua SMTP (smtp.gmail.com, cổng 465, mã hoá). Biến chỉ nằm trong cài đặt Vercel:
//   MAIL_USER          địa chỉ Gmail của app (người gửi "Ôn Tập" <MAIL_USER>)
//   MAIL_APP_PASSWORD  "mật khẩu ứng dụng" 16 chữ của Gmail (Google hiện có dấu cách — bỏ dấu cách trước khi dùng)
// Thiếu biến -> mailReady() = false (máy chủ báo "mail_off": chưa cài gửi email).
// Phép thử: MAIL_MOCK_FILE=<tệp> -> KHÔNG gửi thật, ghi mỗi thư thành một dòng JSON vào tệp
//   (địa chỉ nhận đuôi "@fail.test" giả lập gửi lỗi). Không bao giờ ghi mật khẩu ứng dụng ra nhật ký / phản hồi.
import fs from "node:fs";
import nodemailer from "nodemailer";

const user = () => String(process.env.MAIL_USER || "").trim();
const appPass = () => String(process.env.MAIL_APP_PASSWORD || "").replace(/\s+/g, "");
const mockFile = () => String(process.env.MAIL_MOCK_FILE || "").trim();

export const mailReady = () => !!(mockFile() || (user() && appPass()));

let transport = null, transportKey = "";
function getTransport() {
  const key = user() + "|" + appPass().length;
  if (transport && transportKey === key) return transport;
  transport = nodemailer.createTransport({
    host: "smtp.gmail.com", port: 465, secure: true,
    auth: { user: user(), pass: appPass() },
    connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 15000,
  });
  transportKey = key;
  return transport;
}

// Gửi một thư chữ thường. Lỗi -> ném Error có code "mail_error" (không kèm nội dung thư).
export async function sendMail({ to, subject, text }) {
  const from = { name: "Ôn Tập", address: user() || "ontap@example.com" };
  const mock = mockFile();
  if (mock) {
    if (/@fail\.test$/i.test(String(to))) { const e = new Error("mock send failure"); e.code = "mail_error"; throw e; }
    fs.appendFileSync(mock, JSON.stringify({ at: Date.now(), from: `"${from.name}" <${from.address}>`, to, subject, text }) + "\n");
    return;
  }
  if (!user() || !appPass()) { const e = new Error("mail_off"); e.code = "mail_off"; throw e; }
  try {
    const t = getTransport();
    await t.sendMail({ from, to, subject, text });
  } catch (err) {
    const e = new Error("mail_error"); e.code = "mail_error"; e.reason = String((err && (err.code || err.responseCode)) || "send");
    throw e;
  }
}
