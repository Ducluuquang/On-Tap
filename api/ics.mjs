// Ôn Tập: lời nhắc ôn từ vựng hằng ngày cho lịch điện thoại (.ics) — dùng ở trang "Lịch ôn" của Vở Spelling
// (trò chơi từ vựng trong Ôn Tập, chốt 22/10/2026). Chép NGUYÊN từ api/ics.js của app Vở Spelling (thư mục On tap\Vocab),
// chỉ đổi sang kiểu ES module như các file khác của Ôn Tập.
/* Vở Spelling — daily review reminder as a calendar file (.ics).
   GET /api/ics?t=HHMM&d=YYYYMMDD → one event repeating every day at that local time, with an alarm. */

function fold(line) {
  const out = [];
  let cur = "", bytes = 0;
  for (const ch of line) {
    const b = Buffer.byteLength(ch);
    if (bytes + b > 74) { out.push(cur); cur = " " + ch; bytes = 1 + b; }
    else { cur += ch; bytes += b; }
  }
  out.push(cur);
  return out.join("\r\n");
}

export default function handler(req, res) {
  const u = new URL(req.url, "http://localhost");
  const t = /^\d{4}$/.test(u.searchParams.get("t") || "") ? u.searchParams.get("t") : "1930";
  const h = Math.min(23, Number(t.slice(0, 2))), m = Math.min(59, Number(t.slice(2)));
  const d = /^\d{8}$/.test(u.searchParams.get("d") || "") ? u.searchParams.get("d") : new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const pad = n => String(n).padStart(2, "0");
  const endMin = Math.min(h * 60 + m + 15, 23 * 60 + 59);
  const host = String(req.headers["x-forwarded-host"] || req.headers.host || "").replace(/[^A-Za-z0-9.:-]/g, "");
  const app = host ? "https://" + host + "/" : "";
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Vo Spelling//Nhac on tu vung//VI",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    "UID:vo-spelling-daily-" + d + "-" + pad(h) + pad(m) + "@" + (host || "vo-spelling"),
    "DTSTAMP:" + stamp,
    "DTSTART:" + d + "T" + pad(h) + pad(m) + "00",
    "DTEND:" + d + "T" + pad(Math.floor(endMin / 60)) + pad(endMin % 60) + "00",
    "RRULE:FREQ=DAILY",
    "SUMMARY:Ôn từ vựng – Vở Spelling",
    "DESCRIPTION:Mở app để ôn các từ đến hạn hôm nay." + (app ? "\\n" + app : ""),
  ];
  if (app) lines.push("URL:" + app);
  lines.push("BEGIN:VALARM", "ACTION:DISPLAY", "DESCRIPTION:Ôn từ vựng", "TRIGGER:PT0M", "END:VALARM", "END:VEVENT", "END:VCALENDAR");
  res.statusCode = 200;
  res.setHeader("Content-Type", "text/calendar; charset=utf-8");
  res.setHeader("Content-Disposition", 'inline; filename="nhac-on-tu-vung.ics"');
  res.setHeader("Cache-Control", "no-store");
  res.end(lines.map(fold).join("\r\n") + "\r\n");
}
