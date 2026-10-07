// PHÍM ENTER = "Câu tiếp theo" — phải BỎ QUA chính cú Enter vừa dùng để NỘP bài (6/10/2026).
// React 18 gắn trình nghe phím mới NGAY trong cùng sự kiện -> trước đây gõ đáp án rồi Enter là nhảy luôn
// sang câu sau, con KHÔNG kịp thấy "Chính xác/Chưa đúng" và lời giải thích (cả máy tính lẫn nút "Đi/Enter" trên điện thoại).
export const nowTs = () => (typeof performance !== 'undefined' ? performance.now() : Date.now())
export function isStaleEnter(e, since) {
  if (!e) return true
  if (e.target && e.target.tagName === 'INPUT') return true // cú Enter trong ô gõ đáp án = nộp bài, không phải "tiếp"
  return typeof e.timeStamp === 'number' && e.timeStamp > 0 && e.timeStamp <= since
}
