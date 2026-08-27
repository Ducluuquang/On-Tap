// Cài đặt do phụ huynh kiểm soát (lưu trên máy).
const KEY = 'ontap.settings.v1'
const DEFAULT = { allowChoice: true } // cho phép chơi kiểu trắc nghiệm hay không

export function loadSettings() {
  try { const r = localStorage.getItem(KEY); if (r) return { ...DEFAULT, ...JSON.parse(r) } } catch { /* noop */ }
  return { ...DEFAULT }
}
export function saveSettings(s) {
  try { localStorage.setItem(KEY, JSON.stringify(s)) } catch { /* noop */ }
}
