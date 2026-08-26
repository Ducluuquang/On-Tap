// Learning Memory — trái tim của sản phẩm.
// Lưu theo TỪNG concept: độ thành thạo (mastery), số lần ôn, đúng/sai, lần ôn gần nhất,
// và ngày nên ôn lại (spaced review).

import { CONCEPTS } from '../data/content.js'

const KEY = 'ontap.memory.v1'

export function statusOf(m) {
  if (m >= 90) return 'mastered'
  if (m >= 80) return 'strong'
  if (m >= 60) return 'developing'
  return 'weak'
}

export const STATUS_LABEL = {
  mastered: 'Thành thạo',
  strong: 'Vững',
  developing: 'Đang lên',
  weak: 'Cần ôn',
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
    if (raw) return JSON.parse(raw)
  } catch (e) { /* bỏ qua */ }
  return seed()
}

export function saveMemory(mem) {
  try { localStorage.setItem(KEY, JSON.stringify(mem)) } catch (e) { /* bỏ qua */ }
}

export function resetMemory() {
  try { localStorage.removeItem(KEY) } catch (e) { /* bỏ qua */ }
  return seed()
}

// Cập nhật mastery sau một câu trả lời.
export function nextMastery(m, { correct, usedHint }) {
  let v = m
  if (correct) v += usedHint ? 4 : 9
  else v -= 6
  return Math.max(0, Math.min(100, Math.round(v)))
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
  const idx = new Map(out.map((c, i) => [c.name.toLowerCase(), i]))
  for (const c of concepts) {
    const name = (c.name || '').trim()
    if (!name) continue
    const key = name.toLowerCase()
    if (idx.has(key)) {
      const i = idx.get(key)
      out[i] = { ...out[i], learnedOn: today, newToday: true }
    } else {
      const nc = {
        id: c.id || slug(name), name, difficulty: c.difficulty || 'Cơ bản',
        subject: c.subject || 'Toán', topic: c.topic || '',
        mastery: 50, reviews: 0, correct: 0, wrong: 0,
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
  const idx = new Map(out.map((c, i) => [c.name.toLowerCase(), i]))
  for (const raw of conceptNames) {
    const name = (raw || '').trim()
    if (!name) continue
    const key = name.toLowerCase()
    if (idx.has(key)) {
      const i = idx.get(key)
      out[i] = { ...out[i], mastery: Math.max(0, out[i].mastery - 8), wrong: (out[i].wrong || 0) + 1, newToday: true, lastReviewed: today }
    } else {
      out.push({
        id: slug(name), name, difficulty: 'Cơ bản', subject: 'Toán', topic: '',
        mastery: 40, reviews: 0, correct: 0, wrong: 1, newToday: true, learnedInApp: true,
      })
      idx.set(key, out.length - 1)
    }
  }
  return out
}
