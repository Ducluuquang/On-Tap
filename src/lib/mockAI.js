// AI GIẢ LẬP (mock) — chỉ dùng cho bản demo.
// Trong bản thật, các hàm này sẽ gọi Claude API: đọc ảnh bài học, bóc tách concept,
// chọn câu hỏi theo điểm yếu, và viết nhận xét cho phụ huynh.

import { CONCEPTS, CONCEPT_NAME, questionsFor, QUESTIONS } from '../data/content.js'
import { statusOf } from './memory.js'

// Vài "bài chụp" mẫu để bấm thử (thay cho chụp ảnh thật).
export const SAMPLE_CAPTURES = [
  {
    id: 'vo-quy-dong',
    label: 'Vở Toán — trang Quy đồng mẫu số',
    subject: 'Toán',
    topic: 'Phân số',
    concepts: ['quy-dong', 'so-sanh'],
  },
  {
    id: 'worksheet-rut-gon',
    label: 'Phiếu bài tập — Rút gọn & phân số bằng nhau',
    subject: 'Toán',
    topic: 'Phân số',
    concepts: ['rut-gon', 'ps-bang-nhau'],
  },
]

// Giả lập AI "đọc" bài chụp và trả về những gì hiểu được.
export function extractFromCapture(sampleId) {
  const s = SAMPLE_CAPTURES.find((x) => x.id === sampleId) || SAMPLE_CAPTURES[0]
  return {
    subject: s.subject,
    topic: s.topic,
    concepts: s.concepts.map((id) => ({
      id,
      name: CONCEPT_NAME[id],
      importance: 'Quan trọng',
      difficulty: (CONCEPTS.find((c) => c.id === id) || {}).difficulty || 'Cơ bản',
    })),
  }
}

// Chọn câu hỏi cho buổi ôn: ưu tiên concept yếu (mastery thấp) nhiều câu hơn.
// openOnly = true: chỉ lấy câu TỰ CHỨA (bỏ câu kiểu "trong các... sau") cho chế độ tự điền.
export function buildReview(mem, count = 6, { openOnly = false } = {}) {
  const ranked = [...mem].sort((a, b) => a.mastery - b.mastery)
  const picks = []
  // 2 câu từ concept yếu nhất, rồi rải đều các concept còn lại.
  const order = [ranked[0], ranked[0], ...ranked.slice(1), ...ranked]
  const used = new Set()
  for (const c of order) {
    if (picks.length >= count) break
    if (!c) continue
    const pool = questionsFor(c.id).filter((q) => !used.has(q.id) && (!openOnly || !q.mcOnly))
    if (pool.length === 0) continue
    const q = pool[0]
    used.add(q.id)
    picks.push(q)
  }
  return picks.slice(0, count)
}

// Câu nhận xét kiểu "AI tóm tắt" cho phụ huynh.
export function parentSummary(mem, lastSession) {
  const weakest = [...mem].sort((a, b) => a.mastery - b.mastery)[0]
  const strongest = [...mem].sort((a, b) => b.mastery - a.mastery)[0]
  if (lastSession) {
    return `Hôm nay con ôn ${lastSession.total} câu Phân số, đúng ${lastSession.correct}/${lastSession.total}. ` +
      `Con đang vững phần "${strongest.name}", nhưng "${weakest.name}" còn yếu (${weakest.mastery}%) — mai nên ôn thêm phần này.`
  }
  return `Con đang vững phần "${strongest.name}". Cần chú ý "${weakest.name}" (${weakest.mastery}%) — nên ưu tiên ôn lại.`
}

export function conceptStatusList(mem) {
  return [...mem]
    .sort((a, b) => b.mastery - a.mastery)
    .map((c) => ({ ...c, status: statusOf(c.mastery) }))
}

export const TOTAL_QUESTIONS = QUESTIONS.length
