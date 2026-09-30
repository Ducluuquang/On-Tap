// Learning Memory — trái tim của sản phẩm.
// Lưu theo TỪNG concept: độ thành thạo (mastery), số lần ôn, đúng/sai, lần ôn gần nhất,
// và ngày nên ôn lại (spaced review).

import { CONCEPTS } from '../data/content.js'
import { subjectKey } from './subjects.js'
import { scopedKey } from './active.js'
import { isVagueConcept } from './topics.js'

// v2: bỏ dữ liệu DEMO cũ — bắt đầu THẬT từ số 0 (bản đồ kiến thức trống, tự tích luỹ theo bài con học).
// Mỗi CON có bản đồ riêng -> khoá lưu gắn theo con (scopedKey).
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
  if (m >= 90) return 'mastered' // Thành thạo: ≥90% (vd 7 câu trắc nghiệm / 5 câu tự gõ ĐÚNG liên tiếp)
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
// Số thứ tự tiếng Anh hay dùng trong tên chủ điểm ngữ pháp -> chữ số, để
// "Zero conditional" = "Conditional 0", "First conditional" = "Conditional 1"… (cùng một chủ đề).
const ORDINALS = { zero: '0', first: '1', second: '2', third: '3', '1st': '1', '2nd': '2', '3rd': '3' }
// "Khoá khái niệm" = tập hợp từ có nghĩa (bỏ dấu, KHÔNG phân biệt hoa/thường, bỏ từ nối), sắp xếp
// -> 2 tên cùng nghĩa (vd "conditional 0" và "Conditional 0") cho ra CÙNG một khoá.
export function conceptKey(name) {
  const noMarks = String(name || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd')
  const words = noMarks.replace(/[^a-z0-9\s]/g, ' ').split(/\s+/)
    .filter((w) => w && !STOP_WORDS.has(w))
    .map((w) => ORDINALS[w] || w)
  return [...new Set(words)].sort().join(' ')
}

// Tên hiển thị thống nhất: gọn khoảng trắng + VIẾT HOA chữ cái đầu ("conditional 0" -> "Conditional 0").
export function prettyName(name) {
  const s = String(name || '').replace(/\s+/g, ' ').trim()
  if (!s) return s
  return s.charAt(0).toLocaleUpperCase('vi') + s.slice(1)
}

// ===================== ĐỘ THÀNH THẠO (chốt 29/9/2026) =====================
// Trước đây: đúng +14%, SAI giữ nguyên -> đúng 4 / sai 21 câu vẫn báo 56% (vô lý).
// Nay % thành thạo = MIN( điểm tích luỹ , tỉ lệ ĐÚNG trong 30 câu gần nhất ):
//  - Điểm tích luỹ (pts): mỗi câu đúng +14 (trắc nghiệm/game) hoặc +20 (tự gõ), tối đa 100
//    -> vẫn cần đủ số câu đúng mới lên Thành thạo (7 câu trắc nghiệm / 5 câu tự gõ đúng liên tiếp).
//  - Tỉ lệ đúng gần đây (hist): câu SAI kéo tỉ lệ xuống -> đúng 4/25 câu = 16%, KHỚP báo cáo theo ngày.
// 30 câu = đủ chứa trọn một buổi ôn dài nhất (25 câu).
export const RECENT_WINDOW = 30

// Rải đều `ones` câu đúng trong `len` câu (khi chỉ biết SỐ câu đúng/sai, không biết thứ tự).
export function spreadSeq(ones, len) {
  let s = ''
  for (let i = 0; i < len; i++) s += Math.floor(((i + 1) * ones) / len) > Math.floor((i * ones) / len) ? '1' : '0'
  return s
}

// % thành thạo từ điểm tích luỹ + chuỗi đúng/sai gần đây ('1' = đúng, '0' = sai).
export function masteryFrom(pts, hist) {
  const p = Math.max(0, Math.min(100, Number(pts) || 0))
  const h = String(hist || '')
  if (!h) return Math.round(p) // chưa làm câu nào
  let ones = 0
  for (const ch of h) if (ch === '1') ones++
  return Math.round(Math.min(p, (ones / h.length) * 100))
}

// NÂNG CẤP dữ liệu CŨ (chỉ có "mastery" = điểm cộng dồn): điểm cũ -> pts, số câu đúng/sai -> hist.
// Vd dữ liệu cũ 56% với 4 đúng / 21 sai -> nay 16%.
export function upgradeConcept(c) {
  if (!c || typeof c.hist === 'string') return c
  const cor = Math.max(0, Number(c.correct) || 0)
  const wr = Math.max(0, Number(c.wrong) || 0)
  const total = cor + wr
  const len = Math.min(total, RECENT_WINDOW)
  const hist = total ? spreadSeq(Math.round((cor * len) / total), len) : ''
  const pts = Math.max(0, Math.min(100, Number(c.mastery) || 0))
  return { ...c, pts, hist, mastery: masteryFrom(pts, hist) }
}

// GỘP các khái niệm TRÙNG (cùng nghĩa theo conceptKey) thành MỘT -> bản đồ kiến thức không bị lặp.
// Giữ tên đầy đủ hơn (viết hoa chữ đầu), điểm cao nhất, nối lịch sử đúng/sai, cộng dồn số lần ôn, giữ ngày gần nhất.
export function dedupeMem(mem) {
  const byKey = new Map()
  const out = []
  for (const raw of mem || []) {
    const c = upgradeConcept(raw)
    const k = conceptKey(c && c.name)
    if (!k) { out.push(c); continue } // tên rỗng -> giữ nguyên, không gộp
    const prev = byKey.get(k)
    if (!prev) { const nc = { ...c, name: prettyName(c.name) }; byKey.set(k, nc); out.push(nc); continue }
    // Đã có khái niệm CÙNG NGHĨA -> gộp vào (không thêm dòng mới).
    if ((c.name || '').trim().length > (prev.name || '').length) prev.name = prettyName(c.name) // tên đầy đủ hơn thì giữ
    const newer = (c.updatedAt || 0) > (prev.updatedAt || 0)
    prev.pts = Math.max(prev.pts || 0, c.pts || 0)
    prev.hist = (newer ? (prev.hist || '') + (c.hist || '') : (c.hist || '') + (prev.hist || '')).slice(-RECENT_WINDOW)
    prev.mastery = masteryFrom(prev.pts, prev.hist)
    prev.reviews = (prev.reviews || 0) + (c.reviews || 0)
    prev.correct = (prev.correct || 0) + (c.correct || 0)
    prev.wrong = (prev.wrong || 0) + (c.wrong || 0)
    prev.learnedOn = [prev.learnedOn, c.learnedOn].filter(Boolean).sort().pop() || prev.learnedOn
    prev.lastReviewed = [prev.lastReviewed, c.lastReviewed].filter(Boolean).sort().pop() || prev.lastReviewed
    prev.updatedAt = Math.max(prev.updatedAt || 0, c.updatedAt || 0) || prev.updatedAt
  }
  return out
}

// Mỗi khái niệm một id RIÊNG (dữ liệu cũ có thể trùng id "ai-0", "ai-1"… giữa các lần thêm bài).
function uniqueIds(mem) {
  const seen = new Set()
  return (mem || []).map((c, i) => {
    let id = (c && c.id) || 'c-' + i
    if (seen.has(id)) { let n = 2; while (seen.has(id + '-' + n)) n++; id = id + '-' + n }
    seen.add(id)
    return id === (c && c.id) ? c : { ...c, id }
  })
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
    const raw = localStorage.getItem(scopedKey(KEY))
    // Mỗi lần mở app: nâng cấp cách tính % (dữ liệu cũ) + bỏ mục CHUNG CHUNG không phải kiến thức
    // ("Ôn từ vựng", "Từ vựng cơ bản"…) + bỏ kiến thức QUÁ HẠN + GỘP khái niệm TRÙNG + id không trùng.
    if (raw) {
      const list = (JSON.parse(raw) || []).filter((c) => c && !isVagueConcept(c.name)).map(upgradeConcept)
      return uniqueIds(dedupeMem(pruneExpired(list)))
    }
  } catch (e) { /* bỏ qua */ }
  return [] // BẢN THẬT: bắt đầu trống, không còn khái niệm demo
}

export function saveMemory(mem) {
  try { localStorage.setItem(scopedKey(KEY), JSON.stringify(mem)) } catch (e) { /* bỏ qua */ }
}

export function resetMemory() {
  try { localStorage.removeItem(scopedKey(KEY)) } catch (e) { /* bỏ qua */ }
  return []
}

// ĐIỂM TÍCH LUỸ sau MỘT câu trả lời (chốt Sep 2026):
// - ĐÚNG trắc nghiệm/game (có sẵn lựa chọn): +14  -> 7 câu đúng = 98% ≈ Thành thạo.
// - ĐÚNG tự gõ đáp án (khó hơn, không gợi ý):  +20  -> 5 câu đúng = 100% Thành thạo.
// - SAI: không trừ điểm tích luỹ, NHƯNG làm giảm tỉ lệ đúng gần đây -> % thành thạo giảm (xem masteryFrom).
export function nextMastery(m, { correct, choice = false } = {}) {
  const v = m || 0
  if (!correct) return v
  return Math.min(100, Math.round(v + (choice ? 14 : 20)))
}

// Ghi MỘT câu trả lời vào kết quả buổi ôn — DÙNG CHUNG cho mọi kiểu ôn & game.
// Lưu cả THỨ TỰ đúng/sai (seq) để tính "tỉ lệ đúng gần đây" cho chính xác.
export function recordAnswer(results, key, ok, label) {
  const prev = (results && results[key]) || { correct: 0, wrong: 0, seq: '', label }
  return {
    ...(results || {}),
    [key]: {
      correct: (prev.correct || 0) + (ok ? 1 : 0),
      wrong: (prev.wrong || 0) + (ok ? 0 : 1),
      seq: (prev.seq || '') + (ok ? '1' : '0'),
      label: prev.label || label,
    },
  }
}

// id chưa có trong danh sách (tránh trùng id -> hiển thị lẫn dòng).
function freeId(list, base) {
  const used = new Set((list || []).map((c) => c && c.id))
  if (!used.has(base)) return base
  let n = 2
  while (used.has(base + '-' + n)) n++
  return base + '-' + n
}

// ÔN XONG — GHI KẾT QUẢ (một phép tính DUY NHẤT cho cả màn "Thay đổi hôm nay" lẫn bản đồ kiến thức,
// nên báo cáo của con và của phụ huynh LUÔN KHỚP nhau).
// - Gộp kết quả theo KHÁI NIỆM (không phân biệt hoa/thường): "conditional 0" + "Conditional 0" = 1 dòng.
// - % mới = MIN(điểm tích luỹ, tỉ lệ đúng 30 câu gần nhất) -> câu SAI được tính (4 đúng/25 câu = 16%).
// - Chủ đề CỤ THỂ con vừa ôn mà chưa có trong bản đồ (vd gõ "Conditional 0") -> thêm mới.
//   Tên CHUNG CHUNG ("Ôn từ vựng", "Từ vựng", "Ôn tập"…) thì KHÔNG thêm — đó không phải kiến thức;
//   kết quả vẫn được tính trong báo cáo theo ngày.
// choice = true (trắc nghiệm/game: +14/câu đúng) | false (tự gõ đáp án: +20/câu đúng).
// Trả về { mem: bản đồ mới, deltas: [{ id, name, before, after, correct, wrong }] }.
export function applyReviewResults(mem, perConcept, { choice = true, subject = '' } = {}) {
  const today = new Date().toISOString().slice(0, 10)
  const now = Date.now()
  const step = choice ? 14 : 20
  const out = (mem || []).map((c) => upgradeConcept({ ...c }))
  const idx = new Map(out.map((c, i) => [conceptKey(c.name), i]))

  // 1) Gộp các nhóm kết quả CÙNG khái niệm (khoá do màn ôn đặt có thể là id hoặc tên, hoa hay thường).
  const groups = new Map() // khoá khái niệm -> { name, correct, wrong, seq }
  for (const [rawKey, r] of Object.entries(perConcept || {})) {
    if (!r) continue
    const byId = out.find((c) => c.id === rawKey)
    const name = byId ? byId.name : (r.label || rawKey)
    const k = conceptKey(name)
    if (!k) continue
    const cor = Math.max(0, r.correct || 0)
    const wr = Math.max(0, r.wrong || 0)
    const seq = typeof r.seq === 'string' && r.seq.length === cor + wr ? r.seq : spreadSeq(cor, cor + wr)
    const g = groups.get(k) || { name, correct: 0, wrong: 0, seq: '' }
    g.correct += cor
    g.wrong += wr
    g.seq += seq
    groups.set(k, g)
  }

  // 2) Ghi vào ĐÚNG khái niệm trong bản đồ.
  const deltas = []
  for (const [k, g] of groups) {
    if (!g.correct && !g.wrong) continue
    let i = idx.get(k)
    if (i == null) {
      const name = prettyName(g.name)
      if (isVagueConcept(name)) continue // "Ôn từ vựng", "Ôn tập"… -> không phải một kiến thức
      out.push({
        id: freeId(out, slug(name) + '-' + now.toString(36)), name, difficulty: 'Cơ bản',
        subject: subject || 'Môn khác', topic: '',
        mastery: 0, pts: 0, hist: '', reviews: 0, correct: 0, wrong: 0,
        learnedOn: today, updatedAt: now, learnedInApp: true,
      })
      i = out.length - 1
      idx.set(k, i)
    }
    const c = out[i]
    const before = c.mastery || 0
    const pts = Math.min(100, (c.pts || 0) + g.correct * step)
    const hist = ((c.hist || '') + g.seq).slice(-RECENT_WINDOW)
    const after = masteryFrom(pts, hist)
    out[i] = {
      ...c,
      pts, hist, mastery: after,
      reviews: (c.reviews || 0) + 1,
      correct: (c.correct || 0) + g.correct,
      wrong: (c.wrong || 0) + g.wrong,
      lastReviewed: today,
      updatedAt: now,
      newToday: false,
    }
    deltas.push({ id: out[i].id, name: out[i].name, before, after, correct: g.correct, wrong: g.wrong })
  }
  return { mem: out, deltas }
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
// Bỏ qua tên CHUNG CHUNG ("Từ vựng cơ bản", "Ngữ pháp cơ bản"…) — không phải kiến thức cụ thể.
export function addConcepts(mem, concepts) {
  const today = new Date().toISOString().slice(0, 10)
  const now = Date.now()
  const out = mem.map((c) => ({ ...c }))
  const idx = new Map(out.map((c, i) => [conceptKey(c.name), i]))
  for (const c of concepts) {
    const name = prettyName(c.name) // viết hoa chữ đầu, thống nhất một kiểu
    if (!name || isVagueConcept(name)) continue
    const key = conceptKey(name)
    if (idx.has(key)) {
      // Đã có khái niệm CÙNG NGHĨA (dù viết khác) -> chỉ cập nhật, KHÔNG thêm trùng vào bản đồ.
      const i = idx.get(key)
      out[i] = { ...out[i], learnedOn: today, updatedAt: now, newToday: true }
    } else {
      // id RIÊNG cho mỗi khái niệm (id tạm "ai-0", "ai-1"… của từng lần đọc bài sẽ trùng giữa các lần).
      const base = c.id && !/^ai-\d+$/.test(c.id) ? c.id : slug(name) + '-' + now.toString(36)
      const nc = {
        id: freeId(out, base), name, difficulty: c.difficulty || 'Cơ bản',
        // KHÔNG mặc định 'Toán' -> tránh khái niệm môn khác bị gán nhầm vào Toán (lẫn môn trong báo cáo).
        subject: c.subject || 'Môn khác', topic: c.topic || '',
        mastery: 0, pts: 0, hist: '', reviews: 0, correct: 0, wrong: 0, // MỚI: chưa ôn -> 0%
        learnedOn: today, updatedAt: now, newToday: true, learnedInApp: true,
      }
      out.push(nc)
      idx.set(key, out.length - 1)
    }
  }
  return out
}

// Ghi nhận chỗ con làm sai (Error Memory): thêm một câu SAI vào lịch sử -> % giảm + cần ôn lại.
export function recordErrors(mem, conceptNames) {
  const today = new Date().toISOString().slice(0, 10)
  const now = Date.now()
  const out = mem.map((c) => upgradeConcept({ ...c }))
  const idx = new Map(out.map((c, i) => [conceptKey(c.name), i]))
  for (const raw of conceptNames) {
    const name = prettyName(raw)
    if (!name || isVagueConcept(name)) continue
    const key = conceptKey(name)
    if (idx.has(key)) {
      const i = idx.get(key)
      const hist = ((out[i].hist || '') + '0').slice(-RECENT_WINDOW)
      out[i] = { ...out[i], hist, mastery: masteryFrom(out[i].pts, hist), wrong: (out[i].wrong || 0) + 1, reviews: (out[i].reviews || 0) + 1, newToday: true, lastReviewed: today, updatedAt: now }
    } else {
      out.push({
        id: freeId(out, slug(name) + '-' + now.toString(36)), name, difficulty: 'Cơ bản', subject: 'Môn khác', topic: '',
        mastery: 0, pts: 0, hist: '0', reviews: 1, correct: 0, wrong: 1, newToday: true, learnedInApp: true, updatedAt: now,
      })
      idx.set(key, out.length - 1)
    }
  }
  return out
}
