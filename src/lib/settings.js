// Cài đặt do phụ huynh kiểm soát (lưu trên máy).
const KEY = 'ontap.settings.v1'
// slogan: khẩu hiệu/mục tiêu học tập con tự ghi (hiện ở trang chủ). Mặc định là 1 câu tạo động lực;
// con có thể sửa lại. Để trống -> hiện chữ mờ gợi ý "Mục tiêu hay khẩu hiệu học tập của con".
const DEFAULT = {
  allowChoice: true, // cho phép chơi kiểu trắc nghiệm hay không
  slogan: 'Tương lai khóc hay cười phụ thuộc vào độ lười của hiện tại.',
}

export function loadSettings() {
  try { const r = localStorage.getItem(KEY); if (r) return { ...DEFAULT, ...JSON.parse(r) } } catch { /* noop */ }
  return { ...DEFAULT }
}
export function saveSettings(s) {
  try { localStorage.setItem(KEY, JSON.stringify(s)) } catch { /* noop */ }
}
