// Learning Memory — trái tim của sản phẩm.
// Lưu theo TỪNG concept: độ thành thạo (mastery), số lần ôn, đúng/sai, lần ôn gần nhất,
// và ngày nên ôn lại (spaced review).

import { CONCEPTS } from '../data/content.js'
import { subjectKey } from './subjects.js'

// v2: bỏ dữ liệu DEMO cũ — bắt đầu THẬT từ số 0 (bản đồ kiến thức trống, tự tích luỹ theo bài con học).
const KEY = 'ontap.memory.v2'

// HẾT HẠN theo thời gian (chốt Sep 2026): bản đồ kiến thức không phình to mãi — khi con lên lớp,
// kiến thức cũ tự rời khỏi bản đồ. Tiếng Anh (từ vựng + ngữ pháp) giữ 24 tháng; các môn khác 12 tháng.
export function retentionMonths(subject) {
  return subjectKey(subject) === 'tieng-anh' ? 24 : 12
}

// Ngày "gần nhất còn dùng" của một khái niệm = ngày học hoặc ngày ôn gần nhất (cái nào mới hơn).
// Dùng để: (1) tính hết hạn, (2) sắp xếp bản đồ kiến thức MỚI HỌC lên trên.
export function recencyDate(c) {
  return [c && c.learnedOn, c && c.lastReviewed].filter(Boolean).sort().pop() || ''
}

// Bỏ các khái niệm ĐÃ QUÁ HẠN khỏi bản đồ kiến thức (dựa trên ngày gần nhất + số tháng giữ theo môn).
// Khái niệm không rõ ngày -> giữ lại (an toàn, không xoá nhầm).
export function pruneExpired(mem, todayDate = new Date()) {
  return (mem || []).filter((c) => {
    const recency = recencyDate(c)
    if (!recency) return true
    const cutoff = new Date(todayDate)
    cutoff.setMonth(cutoff.getMonth() - retentionMonths(c.subject))
    const cutoffStr = cutoff.toISOString().slice(0, 10)
    return recency >= cutoffStr // còn trong hạn -> giữ; quá hạn -> rời bản đồ
  })
}

// 3 mức (chốt Sep 2026): Thành thạo (~100%) → Vững (80%) → Cần ôn (dưới 80%).
export function statusOf(m) {
  if (m >= 90) return 'mastered' // Thành thạo: đạt ~100% (7 câu trắc nghiệm hoặc 5 câu tự gõ đúng)
  if (m >= 80) return 'strong'   // Vững: từ 80%
  return 'weak'                  // Cần ôn: dưới 80%
}

export const STATUS_LABEL = {
  mastered: 'Thành thạo',
  strong: 'Vững',
  developing: 'Đang lên',
  weak: 'Cần ôn',
  new: 'Mới', // vừa thêm, chưa ôn lần nào -> chưa có dữ liệu thành thạo
}

// Danh sách "từ nối" bỏ qua khi so hai tên khái niệm (để nhận ra 2 tên CÙNG NGHĨA khác cách viết).
const STOP_WORDS = new Set(['cua', 'mot', 'voi', 'va', 'cac', 'nhung', 'cho', 'la', 'trong', 'de', 'khi', 'theo', 've', 'nhu', 'den'])
// "Khoá khái niệm" = tập hợp từ có nghĩa (bỏ dấu, bỏ từ nối), sắp xếp -> 2 tên cùng nghĩa cho ra cùng khoá.
export function conceptKey(name) {
  const noMarks = String(name || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd')
  const words = noMarks.replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter((w) => w && !STOP_WORDS.has(w))
  return [...new Set(words)].sort().join(' ')
}

// GỘP các khái niệm TRÙNG (cùng nghĩa theo conceptKey) thành MỘT -> bản đồ kiến thức không bị lặp.
// Giữ tên đầy đủ hơn, mastery cao nhất, cộng dồn số lần ôn/đúng/sai, giữ ngày gần nhất.
export function dedupeMem(mem) {
  const byKey = new Map()
  const out = []
  for (const c of mem || []) {
    const k = conceptKey(c && c.name)
    if (!k) { out.push(c); continue } // tên rỗng -> giữ nguyên, không gộp
    const prev = byKey.get(k)
    if (!prev) { const nc = { ...c }; byKey.set(k, nc); out.push(nc); continue }
    // Đã có khái niệm CÙNG NGHĨA -> gộp vào (không thêm dòng mới).
    if ((c.name || '').length > (prev.name || '').length) prev.name = c.name // tên nào đầy đủ hơn thì giữ
    prev.mastery = Math.max(prev.mastery || 0, c.mastery || 0)
    prev.reviews = (prev.reviews || 0) + (c.reviews || 0)
    prev.correct = (prev.correct || 0) + (c.correct || 0)
    prev.wrong = (prev.wrong || 0) + (c.wrong || 0)
    prev.learnedOn = [prev.learnedOn, c.learnedOn].filter(Boolean).sort().pop() || prev.learnedOn
    prev.lastReviewed = [prev.lastReviewed, c.lastReviewed].filter(Boolean).sort().pop() || prev.lastReviewed
  }
  return out
}

// Trạng thái khởi tạo: giả lập con đã học mấy khái niệm này rồi, mức độ khác nhau.
function daysAgo(n) {
  const t = new Date()
  t.setDate(t.getDate() - n)
  return t.toISOString().slice(0, 10)
}

function seed() {
  const base = {
    'ps-bang-nhau': { mastery: 88, reviews: 6, correct: 16, wrong: 3, days: 80 },
    'rut-gon': { mastery: 72, reviews: 4, correct: 9, wrong: 4, days: 25 },
    'quy-dong': { mastery: 54, reviews: 3, correct: 5, wrong: 6, days: 3 },
    'so-sanh': { mastery: 91, reviews: 7, correct: 20, wrong: 2, days: 50 },
    'cong-cung-mau': { mastery: 66, reviews: 3, correct: 7, wrong: 3, days: 10 },
  }
  return CONCEPTS.map((c) => {
    const b = base[c.id]
    return {
      id: c.id, name: c.name, difficulty: c.difficulty, subject: 'Toán', topic: 'Phân số',
      learnedInApp: true, mastery: b.mastery, reviews: b.reviews, correct: b.correct, wrong: b.wrong,
      learnedOn: daysAgo(b.days),
    }
  })
}

export function loadMemory() {
  try {
    const raw = localStorage.getItem(KEY)
    // Mỗi lần mở app: bỏ kiến thức QUÁ HẠN + GỘP các khái niệm TRÙNG (không để lặp trong bản đồ).
    if (raw) return dedupeMem(pruneExpired(JSON.parse(raw)))
  } catch (e) { /* bỏ qua */ }
  return [] // BẢN THẬT: bắt đầu trống, không còn khái niệm demo
}

export function saveMemory(mem) {
  try { localStorage.setItem(KEY, JSON.stringify(mem)) } catch (e) { /* bỏ qua */ }
}

export function resetMemory() {
  try { localStorage.removeItem(KEY) } catch (e) { /* bỏ qua */ }
  return []
}

// Cập nhật độ thành thạo sau MỘT câu trả lời (chốt Sep 2026).
// - ĐÚNG trắc nghiệm/game (có sẵn lựa chọn): +14  -> 7 câu đúng = 98% ≈ Thành thạo.
// - ĐÚNG tự gõ đáp án (khó hơn, không gợi ý):  +20  -> 5 câu đúng = 100% Thành thạo.
// - SAI: GIỮ NGUYÊN điểm (không trừ) — theo yêu cầu của phụ huynh.
// Cộng dồn qua NHIỀU lần ôn, tối đa 100. Vững = 80%, Cần ôn = dưới 80%.
export function nextMastery(m, { correct, choice = false } = {}) {
  const v = m || 0
  if (!correct) return v // SAI -> giữ nguyên (không trừ điểm)
  return Math.min(100, Math.round(v + (choice ? 14 : 20)))
}

// Ôn xong: cập nhật một concept trong bộ nhớ với kết quả buổi ôn.
export function applySession(mem, perConcept) {
  const today = new Date().toISOString().slice(0, 10)
  return mem.map((c) => {
    const r = perConcept[c.id] || perConcept[c.name]
    if (!r) return c
    return {
      ...c,
      mastery: r.mastery,
      reviews: (c.reviews || 0) + 1,
      correct: (c.correct || 0) + r.correct,
      wrong: (c.wrong || 0) + r.wrong,
      lastReviewed: today,
      newToday: false,
    }
  })
}

// Mastery càng cao thì giãn lịch ôn càng lâu (nhớ tốt thì để lâu, quên thì ôn sớm).
export function daysUntilNext(m) {
  if (m >= 90) return 30
  if (m >= 80) return 14
  if (m >= 60) return 7
  if (m >= 40) return 3
  return 1
}

function slug(s) {
  const noMarks = s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  return 'c-' + noMarks.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40)
}

// Thêm/cập nhật khái niệm (từ ảnh AI đọc được) vào bộ nhớ của con.
export function addConcepts(mem, concepts) {
  const today = new Date().toISOString().slice(0, 10)
  const out = mem.map((c) => ({ ...c }))
  const idx = new Map(out.map((c, i) => [conceptKey(c.name), i]))
  for (const c of concepts) {
    const name = (c.name || '').trim()
    if (!name) continue
    const key = conceptKey(name)
    if (idx.has(key)) {
      // Đã có khái niệm CÙNG NGHĨA (dù viết khác) -> chỉ cập nhật, KHÔNG thêm trùng vào bản đồ.
      const i = idx.get(key)
      out[i] = { ...out[i], learnedOn: today, newToday: true }
    } else {
      const nc = {
        id: c.id || slug(name), name, difficulty: c.difficulty || 'Cơ bản',
        subject: c.subject || 'Toán', topic: c.topic || '',
        mastery: 0, reviews: 0, correct: 0, wrong: 0, // MỚI: chưa ôn -> 0% (không "cho" 50% ảo)
        learnedOn: today, newToday: true, learnedInApp: true,
      }
      out.push(nc)
      idx.set(key, out.length - 1)
    }
  }
  return out
}

// Ghi nhận chỗ con làm sai (Error Memory): hạ mastery + đánh dấu cần ôn lại.
export function recordErrors(mem, conceptNames) {
  const today = new Date().toISOString().slice(0, 10)
  const out = mem.map((c) => ({ ...c }))
  const idx = new Map(out.map((c, i) => [conceptKey(c.name), i]))
  for (const raw of conceptNames) {
    const name = (raw || '').trim()
    if (!name) continue
    const key = conceptKey(name)
    if (idx.has(key)) {
      const i = idx.get(key)
      out[i] = { ...out[i], mastery: Math.max(0, out[i].mastery - 8), wrong: (out[i].wrong || 0) + 1, reviews: (out[i].reviews || 0) + 1, newToday: true, lastReviewed: today }
    } else {
      out.push({
        id: slug(name), name, difficulty: 'Cơ bản', subject: 'Toán', topic: '',
        mastery: 30, reviews: 1, correct: 0, wrong: 1, newToday: true, learnedInApp: true,
      })
      idx.set(key, out.length - 1)
    }
  }
  return out
}
