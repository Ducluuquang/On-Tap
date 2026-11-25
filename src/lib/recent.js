// Ghi nhớ các câu hỏi ĐÃ RA gần đây (theo "canon" — dạng chuẩn hoá của câu),
// để những lần ôn sau ưu tiên câu MỚI, tránh lặp lại y hệt các lần trước.
// Chỉ lưu chuỗi rút gọn của câu hỏi, không lưu đáp án — rất nhẹ.

import { scopedKey } from './active.js'

const KEY = 'ontap.recentq.v2'
const CAP = 400 // nhớ tối đa 400 câu gần nhất (25/11/2026: gồm cả id câu ngân hàng "<8 ký tự>.<số>" để máy chủ lấy câu con CHƯA gặp)
// id câu của ngân hàng câu hỏi (api/_qbank.mjs)
export const isBankId = (s) => /^[0-9a-f]{8}\.[0-9a-z]{1,8}$/.test(String(s || ''))
export const recentBankIds = () => loadRecent().filter(isBankId)

export function resetRecent() {
  try { localStorage.removeItem(scopedKey(KEY)) } catch { /* noop */ }
}

export function loadRecent() {
  try {
    const r = JSON.parse(localStorage.getItem(scopedKey(KEY)) || '[]')
    return Array.isArray(r) ? r : []
  } catch { return [] }
}

// Đưa các câu vừa dùng lên đầu danh sách "đã gặp", cắt bớt còn CAP câu.
export function pushRecent(keys) {
  try {
    const add = (keys || []).filter(Boolean)
    if (!add.length) return
    const cur = loadRecent().filter((k) => !add.includes(k))
    const merged = [...add, ...cur].slice(0, CAP)
    localStorage.setItem(scopedKey(KEY), JSON.stringify(merged))
  } catch { /* noop */ }
}
