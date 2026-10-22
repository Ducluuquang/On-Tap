// TRÒ CHƠI TỪ VỰNG = app "Vở Spelling" chạy bên trong Ôn Tập (chốt 22/10/2026, thay 6 trò cũ).
// Trang của app nằm ở public/spelling/index.html; Ôn Tập mở trang đó trong khung (iframe), kèm id con đang học.
// Mỗi con có kho từ + lịch ôn riêng trên máy, khoá gắn id con giống các dữ liệu học tập khác.
import { scopedKey } from './active.js'

export const SPELLING_PAGE = '/spelling/index.html'
const DATA_KEY = 'ontap.spelling.v1' // bộ từ + lịch ôn + điểm cao nhất (riêng từng con)

export function spellingUrl(childId) {
  return SPELLING_PAGE + '?child=' + encodeURIComponent(childId || '')
}

// "Xoá hết dữ liệu & làm lại từ đầu" (Cài đặt phụ huynh): xoá cả bộ từ và lịch ôn từ vựng của con đang học.
// Giữ cài đặt giọng đọc/âm thanh (không phải dữ liệu học tập).
export function resetSpelling() {
  try { localStorage.removeItem(scopedKey(DATA_KEY)) } catch { /* noop */ }
}

// Dọn dữ liệu của 6 trò chơi từ vựng CŨ (đã bỏ 22/10/2026): sổ từ tra sẵn + đúng/sai từng từ của mỗi con.
export function cleanupOldVocabGames() {
  try {
    const old = []
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k && (k === 'ontap.vocabdict.v1' || k === 'ontap.vocabstats.v1' || k.startsWith('ontap.vocabstats.v1::'))) old.push(k)
    }
    old.forEach((k) => localStorage.removeItem(k))
  } catch { /* noop */ }
}
