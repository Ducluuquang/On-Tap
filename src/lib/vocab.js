// SỔ TỪ VỰNG (chốt 6/10/2026) — nền cho các trò chơi từ vựng tiếng Anh.
// - Mỗi từ trong bài được AI tra MỘT lần: nghĩa tiếng Việt, loại từ, phiên âm, câu ví dụ, câu điền từ,
//   dạng biến đổi từ (họ từ), cách tách từ dễ nhớ. Kết quả lưu trên máy (dùng chung cho các con trên máy),
//   các lần sau chơi ngay — không gọi AI nữa.
// - App nhớ ĐÚNG/SAI TỪNG TỪ của từng con -> trò chơi ưu tiên đưa lại từ con hay sai,
//   báo cáo có mục "Từ con hay sai".
// - Mọi chấm điểm chính tả/nghĩa ở đây đều chạy trên máy (tức thì, không tốn token);
//   chỉ trường hợp "chưa chắc" (con gõ nghĩa khác chữ trong sổ) mới nhờ AI chấm.

import { scopedKey } from './active.js'
import { isVocabGroup } from './topics.js'
import { subjectKey } from './subjects.js'

const DICT_KEY = 'ontap.vocabdict.v1'   // sổ từ (tra 1 lần) — dùng chung cho các con trên máy
const STAT_KEY = 'ontap.vocabstats.v1'  // đúng/sai TỪNG TỪ — riêng từng con
const HIST = 12                         // nhớ 12 lần làm gần nhất của mỗi từ

// ===================== CHUẨN HOÁ =====================
export function normApos(s) {
  return String(s ?? '').normalize('NFC').replace(/[’‘`´ʼ]/g, "'")
}
// Khoá của một từ: thường hoá, gọn khoảng trắng ("Ice  Cream" -> "ice cream").
export function wordKey(s) {
  return normApos(s).toLowerCase().replace(/\s+/g, ' ').trim()
}
export function stripVi(s) {
  return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D')
}
const EN_RE = /^[A-Za-z](?:[A-Za-z' .-]*[A-Za-z.])?$/
const clip = (v, n) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, n)
const arr = (v) => (Array.isArray(v) ? v : [])

// Lấy TỪ tiếng Anh từ một ý nhỏ trong bài: "doctor (bác sĩ)" -> "doctor", "an apple - quả táo" -> "apple".
// Không phải từ/cụm tiếng Anh ngắn (câu dài, chữ tiếng Việt, mẫu ngữ pháp…) -> ''.
export function headword(detail) {
  let s = normApos(detail).replace(/\s+/g, ' ').trim()
  s = s.replace(/\s*[([{].*$/, '')                       // bỏ phần trong ngoặc trở đi
  s = s.split(/\s+[-–—=:]\s+|\s*[:=]\s*/)[0]             // "doctor - bác sĩ", "doctor: bác sĩ", "doctor = bác sĩ"
  s = s.replace(/^["'“”]+|["'“”,;!?]+$/g, '').trim()
  if (/\.$/.test(s) && !/^([a-z]\.)+$/i.test(s) && !/^(mr|mrs|ms|dr|st)\.$/i.test(s)) s = s.slice(0, -1).trim() // dấu chấm cuối câu
  const m = s.match(/^(a|an)\s+(\S+)$/i)                 // "an apple" -> "apple"
  if (m) s = m[2]
  if (!s || !EN_RE.test(s)) return ''
  if (s.length > 30 || s.split(' ').length > 3) return '' // câu/cụm dài: không phải "một từ vựng"
  if (s.replace(/[^A-Za-z]/g, '').length >= 4 && s === s.toUpperCase()) s = s.toLowerCase() // "APPLE" -> "apple" (giữ "UK", "TV")
  return s
}

// Các nhóm "Từ vựng: …" môn Tiếng Anh trong bản đồ kiến thức — bài MỚI NHẤT trước
// (để tra trước / hiện trước từ của bài vừa học).
export function vocabGroupsOf(mem) {
  const t = (c) => (typeof c.updatedAt === 'number' ? c.updatedAt : Date.parse(c.learnedOn || '') || 0)
  return (mem || []).filter((c) => c && isVocabGroup(c.name) && subjectKey(c.subject) === 'tieng-anh')
    .map((c, i) => ({ c, i }))
    .sort((a, b) => t(b.c) - t(a.c) || a.i - b.i)
    .map((x) => x.c)
}

// Các TỪ của những nhóm đã chọn -> [{ key, w, group }] (không trùng; giữ nhóm đầu tiên chứa từ).
export function collectWords(groups) {
  const out = []
  const seen = new Set()
  for (const g of groups || []) {
    for (const d of arr(g && g.details)) {
      const w = headword(d)
      const key = wordKey(w)
      if (!w || seen.has(key)) continue
      seen.add(key)
      out.push({ key, w, group: g.name })
    }
  }
  return out
}

// ===================== LƯU TRỮ =====================
function readJSON(k) { try { const v = JSON.parse(localStorage.getItem(k)); return v && typeof v === 'object' ? v : {} } catch { return {} } }
function writeJSON(k, v) { try { localStorage.setItem(k, JSON.stringify(v)) } catch { /* đầy bộ nhớ -> bỏ qua */ } }
export function loadDict() { return readJSON(DICT_KEY) }
export function saveDict(d) { writeJSON(DICT_KEY, d || {}) }
export function loadVStats() { return readJSON(scopedKey(STAT_KEY)) }
export function saveVStats(s) { writeJSON(scopedKey(STAT_KEY), s || {}) }
export function resetVStats() { try { localStorage.removeItem(scopedKey(STAT_KEY)) } catch { /* noop */ } }

// ===================== KIỂM TRA KẾT QUẢ AI TRA TỪ =====================
// Khoảng cách chính tả (Optimal String Alignment: thay/thêm/bớt/đảo 2 chữ cạnh nhau = 1 lỗi).
export function osa(a, b) {
  const s = String(a), t = String(b)
  const d = Array.from({ length: s.length + 1 }, (_, i) => [i, ...Array(t.length).fill(0)])
  for (let j = 1; j <= t.length; j++) d[0][j] = j
  for (let i = 1; i <= s.length; i++) {
    for (let j = 1; j <= t.length; j++) {
      const c = s[i - 1] === t[j - 1] ? 0 : 1
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + c)
      if (i > 1 && j > 1 && s[i - 1] === t[j - 2] && s[i - 2] === t[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1)
    }
  }
  return d[s.length][t.length]
}

// `word` đứng nguyên chữ trong câu `s` (không khớp nửa chữ).
export function hasWord(s, word) {
  const w = wordKey(word).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return !!w && new RegExp(`(^|[^a-z'])${w}([^a-z']|$)`, 'i').test(normApos(s))
}

// Hai từ cùng gốc (dạng chia/số nhiều của nhau): chung ≥3 chữ đầu, hoặc giống hệt.
function sameStem(a, b) {
  const x = wordKey(a), y = wordKey(b)
  if (x === y) return true
  const n = Math.min(3, x.length, y.length)
  return n >= 2 && x.slice(0, n) === y.slice(0, n)
}

const oneBlank = (s) => (String(s).match(/_{3}/g) || []).length === 1

// Chỗ trống dính chữ ("Eat more ___s") -> gộp phần dính vào đáp án ("vegetable" -> "vegetables") để câu đọc tự nhiên.
export function absorbBlank(s, a) {
  const m = String(s).match(/([A-Za-z']*)_{3}([A-Za-z']*)/)
  if (!m || (!m[1] && !m[2])) return { s, a }
  return { s: String(s).replace(m[0], '___'), a: m[1] + a + m[2] }
}

// Cách TÁCH TỪ cho dễ nhớ ("beau-ti-ful"). CHỈ nhận khi ghép lại ra ĐÚNG y hệt từ -> không bao giờ dạy sai chính tả.
// (Không dùng "mẹo" tự do của AI: từng gặp mẹo sai kiểu "sandwich: không có 'd' trước 'w'".)
export function cleanSplit(split, w) {
  const s = clip(split, 40)
  if (!s || !s.includes('-') || /\s/.test(w)) return ''
  const parts = s.split('-').map((p) => p.trim())
  if (parts.length < 2 || parts.some((p) => !/^[A-Za-z']+$/.test(p))) return ''
  return parts.join('').toLowerCase() === String(w).toLowerCase() ? parts.join('-') : ''
}

// Làm sạch MỘT mục AI trả về cho từ `src`. Sai/thiếu phần nào thì BỎ phần đó (không đoán bừa).
// Trả null nếu không dùng được (không phải từ tiếng Anh, đổi sang từ khác, thiếu nghĩa).
export function cleanEntry(raw, src) {
  if (!raw || typeof raw !== 'object') return null
  const w = normApos(raw.w).replace(/\s+/g, ' ').trim()
  if (!w || !EN_RE.test(w) || w.length > 30) return null
  const sk = wordKey(src), wk = wordKey(w)
  // AI được SỬA LỖI GÕ ("beautyful" -> "beautiful") nhưng KHÔNG được đổi sang từ khác hẳn.
  const near = osa(sk, wk) <= Math.max(2, Math.floor(sk.length / 4))
  if (!near && !sk.includes(wk) && !wk.includes(sk)) return null
  // Nghĩa tiếng Việt: ngắn, không chứa chỗ trống, không chép lại chính từ tiếng Anh ("pizza" = "pizza").
  const mean = arr(raw.mean).map((m) => clip(m, 40))
    .filter((m) => m && !/_{2,}/.test(m) && wordKey(m) !== wk)
    .filter((m, i, all) => all.findIndex((x) => wordKey(x) === wordKey(m)) === i)
    .slice(0, 4)
  if (!mean.length) return null
  const ipaRaw = clip(raw.ipa, 48)
  const ipa = /^[/[].{1,44}[/\]]$/.test(ipaRaw) ? ipaRaw : ''
  // Câu điền từ: đúng 1 chỗ trống, đáp án là CHÍNH từ đó (hoặc dạng chia cùng gốc), câu không lộ đáp án.
  let cloze = null
  if (raw.cloze && typeof raw.cloze === 'object') {
    const fixed = absorbBlank(clip(raw.cloze.s, 180).replace(/_{2,}/g, '___'), normApos(raw.cloze.a).replace(/\s+/g, ' ').trim())
    const s = fixed.s, a = fixed.a
    if (oneBlank(s) && a && EN_RE.test(a) && a.split(' ').length <= 3 && sameStem(a, w) && !hasWord(s.replace('___', ' '), a)) cloze = { s, a }
  }
  // Biến đổi từ: câu 1 chỗ trống + TỪ GỐC viết hoa + đáp án là dạng KHÁC từ gốc + lời giải thích.
  const forms = arr(raw.forms).map((f) => {
    if (!f || typeof f !== 'object') return null
    const s = clip(f.s, 180).replace(/_{2,}/g, '___')
    const a = normApos(f.a).replace(/\s+/g, ' ').trim()
    // Chỗ trống dính chữ ("___ly") -> BỎ câu (lời giải thích của AI viết cho đáp án khác, gộp vào dễ lệch).
    if (/[A-Za-z']_{3}|_{3}[A-Za-z']/.test(s)) return null
    const root = clip(f.root, 30).toUpperCase()
    const why = clip(f.why, 160)
    if (!oneBlank(s) || !root || !EN_RE.test(root) || !a || !EN_RE.test(a) || a.split(' ').length > 2 || !why) return null
    if (wordKey(a) === wordKey(root) || hasWord(s.replace('___', ' '), a)) return null
    return { s, root, a, why }
  }).filter(Boolean).slice(0, 2)
  const entry = {
    w, mean,
    pos: clip(raw.pos, 20),
    ipa,
    ex: clip(raw.ex, 160),
    exVi: clip(raw.exVi, 200),
    cloze,
    forms,
    split: cleanSplit(raw.split, w),
    at: Date.now(),
  }
  if (wk !== sk) entry.src = clip(src, 40) // AI đã sửa lỗi gõ trong bài
  return entry
}

// Ghép kết quả AI vào sổ: khớp từng mục với từ đã hỏi (theo "src", theo từ, hoặc theo thứ tự).
export function mergeLookup(dict, asked, items) {
  const out = { ...(dict || {}) }
  const list = arr(items)
  const used = new Set()
  asked.forEach((src, i) => {
    const k = wordKey(src)
    let j = list.findIndex((it, idx) => !used.has(idx) && it && (wordKey(it.src) === k || wordKey(it.w) === k))
    if (j < 0 && list.length === asked.length && !used.has(i)) j = i
    if (j < 0) return
    const e = cleanEntry(list[j], src)
    if (!e) return
    used.add(j)
    out[k] = e
    // Bài gõ sai chính tả ("beautyful") -> lưu thêm dưới chữ ĐÚNG để bài khác có "beautiful" khỏi tra lại.
    const wk = wordKey(e.w)
    if (wk !== k && (!out[wk] || out[wk].bad)) { const { src: _s, ...rest } = e; out[wk] = rest }
  })
  return out
}

// AI trả "w" rỗng cho một từ đã hỏi = KHÔNG phải từ/cụm tiếng Anh có nghĩa -> đánh dấu để không hỏi lại mãi
// (sau 30 ngày mới thử lại). Mục bị lỗi vì lý do khác (thiếu nghĩa…) thì KHÔNG đánh dấu -> lần sau tra lại.
const BAD_DAYS = 30
export function markUnusable(dict, asked, items) {
  const out = { ...(dict || {}) }
  const list = arr(items)
  asked.forEach((src, i) => {
    const k = wordKey(src)
    if (out[k] && !out[k].bad) return
    const it = list.find((x) => x && wordKey(x.src) === k) || (list.length === asked.length ? list[i] : null)
    if (it && typeof it === 'object' && !String(it.w || '').trim()) out[k] = { bad: true, at: Date.now() }
  })
  return out
}
// Từ CẦN tra: chưa có trong sổ, hoặc bị đánh dấu "không dùng được" đã quá 30 ngày.
export function needsLookup(dict, key, now = Date.now()) {
  const e = dict && dict[key]
  if (!e) return true
  if (e.bad) return now - (e.at || 0) > BAD_DAYS * 86400000
  return false
}
// Mục dùng được cho trò chơi (đã tra, có từ + nghĩa, không bị đánh dấu hỏng).
export function entryOf(dict, key) {
  const e = dict && dict[key]
  return e && !e.bad && e.w && Array.isArray(e.mean) && e.mean.length ? e : null
}

// ===================== NGHĨA TIẾNG VIỆT =====================
// Chữ chỉ loại đứng đầu DANH TỪ CỤ THỂ ("quả táo" = "táo", "con mèo" = "mèo") — so cả 2 dạng.
// CHỈ những chữ chỉ loại an toàn: bỏ "sự/việc/cuộc/người/bộ/đôi/anh/chị/bà…" vì bỏ đi sẽ ra chữ KHÁC NGHĨA
// ("sự kiện" -> "kiện", "việc làm" -> "làm", "bộ đội" -> "đội", "đôi khi" -> "khi", "ông bà" -> "bà").
// Con gõ khác chữ trong sổ mà vẫn đúng nghĩa (vd "người nông dân" / "nông dân") -> AI chấm, không đoán bừa.
const CLASSIFIER = /^(cái|con|quả|trái|chiếc|cây|tờ|quyển|cuốn|bức|tấm|lá|ngôi|viên|hòn|bông|tòa|toà)\s+/
function viBase(s) {
  return String(s || '').normalize('NFC').toLowerCase().replace(/\([^)]*\)/g, ' ')
    .replace(/[^\p{L}\p{N}\s,;/]/gu, ' ').replace(/\s+/g, ' ').trim()
}
// Các cách viết chấp nhận được của một nghĩa: cả cụm, từng phần (tách bởi , ; /), bỏ chữ chỉ loại.
export function viVariants(s) {
  const out = new Set()
  const base = viBase(s)
  for (const p of [base.replace(/[,;/]/g, ' ').replace(/\s+/g, ' ').trim(), ...base.split(/[,;/]/)]) {
    const v = p.trim()
    if (!v) continue
    out.add(v)
    const nc = v.replace(CLASSIFIER, '').trim()
    if (nc && nc !== v) out.add(nc)
  }
  return out
}
const hasMarks = (s) => stripVi(s) !== String(s)

// Con gõ NGHĨA tiếng Việt -> { ok: true, note? } | { ok: false, sure } (sure=false: chưa chắc -> nhờ AI chấm).
export function matchMeaning(typed, meanings) {
  const t = viVariants(typed)
  if (!t.size) return { ok: false, sure: true }
  for (const m of meanings || []) for (const v of viVariants(m)) if (t.has(v)) return { ok: true }
  // Con KHÔNG gõ dấu (bàn phím chưa bật tiếng Việt) -> so không dấu, nhắc cách viết đủ dấu.
  if (!hasMarks(viBase(typed))) {
    const tp = new Set([...t].map(stripVi))
    for (const m of meanings || []) {
      for (const v of viVariants(m)) if (tp.has(stripVi(v))) return { ok: true, note: `Đúng rồi! Viết đủ dấu là “${m}”.` }
    }
  }
  return { ok: false, sure: false }
}

// Hai bộ nghĩa có TRÙNG nhau không (so cả không dấu cho chắc) — để trò "Đúng hay sai"
// KHÔNG BAO GIỜ ghép một cặp "sai" mà thật ra lại đúng (vd big = "to, lớn", large = "lớn").
export function meaningsOverlap(a, b) {
  const va = new Set(); for (const m of a || []) for (const v of viVariants(m)) va.add(stripVi(v))
  for (const m of b || []) for (const v of viVariants(m)) if (va.has(stripVi(v))) return true
  return false
}

// ===================== CHÍNH TẢ =====================
const normSpell = (s) => normApos(s).replace(/\s+/g, ' ').trim().replace(/[.!?,;:]+$/, '')

// So chính tả: { ok, note } — không phân biệt hoa/thường.
// Chỉ "gạch nối thay dấu cách" (đúng chỗ tách chữ: "ice-cream" ~ "ice cream", "well known" ~ "well-known")
// mới tính đúng (kèm nhắc). Viết DÍNH liền ("icecream", "lookafter") hay tách SAI chỗ ("ic ecream") là SAI.
export function compareSpelling(typed, target) {
  const a = normSpell(typed), b = normSpell(target)
  if (!a) return { ok: false }
  if (a.toLowerCase() === b.toLowerCase()) {
    // Danh từ riêng (Monday, English…): đúng chữ nhưng chưa viết hoa -> vẫn tính đúng, nhắc viết hoa.
    if (a !== b && /[A-Z]/.test(b)) return { ok: true, note: `Nhớ viết hoa: “${b}”.` }
    return { ok: true }
  }
  const tok = (s) => s.toLowerCase().split(/[-\s]+/).filter(Boolean)
  const ta = tok(a), tb = tok(b)
  if (tb.length > 1 && ta.length === tb.length && ta.join(' ') === tb.join(' ')) return { ok: true, note: `Đúng chính tả rồi! Cách viết chuẩn là “${b}”.` }
  return { ok: false }
}

// Các bước sửa từ chữ con viết -> chữ đúng: eq | sub | ins (con viết THIẾU) | del (con viết THỪA) | swap (đảo 2 chữ).
export function spellOps(typed, target) {
  const s = normSpell(typed).toLowerCase(), t = normSpell(target).toLowerCase()
  const n = s.length, m = t.length
  const d = Array.from({ length: n + 1 }, (_, i) => [i, ...Array(m).fill(0)])
  for (let j = 1; j <= m; j++) d[0][j] = j
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const c = s[i - 1] === t[j - 1] ? 0 : 1
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + c)
      if (i > 1 && j > 1 && s[i - 1] === t[j - 2] && s[i - 2] === t[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1)
    }
  }
  const ops = []
  let i = n, j = m
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && s[i - 1] === t[j - 1] && d[i][j] === d[i - 1][j - 1]) { ops.push({ op: 'eq', t: s[i - 1], c: t[j - 1], ti: i - 1, ci: j - 1 }); i--; j--; continue }
    if (i > 1 && j > 1 && s[i - 1] === t[j - 2] && s[i - 2] === t[j - 1] && d[i][j] === d[i - 2][j - 2] + 1) { ops.push({ op: 'swap', t: s.slice(i - 2, i), c: t.slice(j - 2, j), ti: i - 2, ci: j - 2 }); i -= 2; j -= 2; continue }
    if (i > 0 && j > 0 && d[i][j] === d[i - 1][j - 1] + 1) { ops.push({ op: 'sub', t: s[i - 1], c: t[j - 1], ti: i - 1, ci: j - 1 }); i--; j--; continue }
    if (j > 0 && d[i][j] === d[i][j - 1] + 1) { ops.push({ op: 'ins', c: t[j - 1], ci: j - 1, ti: i }); j--; continue }
    ops.push({ op: 'del', t: s[i - 1], ti: i - 1, ci: j }); i--
  }
  return ops.reverse()
}

// Đánh vần: "apple" -> "a-p-p-l-e"; cụm từ: "get up" -> "g-e-t / u-p".
export function spellOut(w) {
  return normSpell(w).split(' ').map((p) => p.split('').join('-')).join(' / ')
}

const q = (s) => `“${s}”`
// GIẢI THÍCH VÌ SAO SAI CHÍNH TẢ (tiếng Việt, dễ hiểu cho học sinh): chỉ ra ĐÚNG chỗ sai.
export function spellWhy(typed, target) {
  const a = normSpell(typed), b = normSpell(target)
  if (!a) return [`Con chưa viết gì. Từ đúng là ${q(b)}.`, `Đánh vần: ${spellOut(b)}.`]
  const ops = spellOps(a, b)
  const bad = ops.filter((o) => o.op !== 'eq')
  const tl = b.toLowerCase()
  const lines = []
  if (bad.length > Math.max(2, Math.floor(b.length / 2))) {
    lines.push(`Con viết ${q(a)} — khác khá nhiều so với từ đúng ${q(b)}.`)
  } else {
    // Gộp các lỗi NẰM SÁT NHAU thành một chỗ (vd "elefant": "f" phải viết là "ph").
    const chunks = []
    let cur = null
    for (const o of ops) {
      if (o.op === 'eq') { cur = null; continue }
      if (!cur) { cur = []; chunks.push(cur) }
      cur.push(o)
    }
    const before = (ci) => (ci <= 0 ? ' ở đầu từ' : ci >= b.length - 1 ? ' ở cuối từ' : ` (sau ${q(b.slice(Math.max(0, ci - 3), ci).trim() || b.slice(0, ci))})`)
    for (const ch of chunks.slice(0, 3)) {
      if (ch.length > 1) {
        const tp = ch.map((o) => (o.op === 'ins' ? '' : o.t)).join('')
        const cp = ch.map((o) => (o.op === 'del' ? '' : o.c)).join('')
        if (!tp) lines.push(`Con viết thiếu ${q(cp)}${before(ch[0].ci)}.`)
        else if (!cp) lines.push(`Con viết thừa ${q(tp)}.`)
        else lines.push(`Chỗ ${q(tp)} phải viết là ${q(cp)}.`)
        continue
      }
      const o = ch[0]
      if (o.op === 'swap') lines.push(`Con viết ngược thứ tự hai chữ: ${q(o.t)} — đúng phải là ${q(o.c)}.`)
      else if (o.op === 'ins') {
        if (o.c === ' ') { lines.push(`Thiếu dấu cách sau ${q(b.slice(0, o.ci))} — đây là cụm gồm nhiều chữ.`); continue }
        const dbl = tl[o.ci - 1] === o.c || tl[o.ci + 1] === o.c
        lines.push(dbl
          ? `Từ này có hai chữ ${q(o.c)} liền nhau (${q(o.c + o.c)}) — con viết thiếu một chữ.`
          : `Con viết thiếu chữ ${q(o.c)}${before(o.ci)}.`)
      } else if (o.op === 'del') {
        if (o.t === ' ') { lines.push('Con viết thừa dấu cách.'); continue }
        const al = a.toLowerCase()
        const dbl = al[o.ti - 1] === o.t || al[o.ti + 1] === o.t
        lines.push(dbl ? `Từ này chỉ có MỘT chữ ${q(o.t)} — con viết thừa một chữ.` : `Con viết thừa chữ ${q(o.t)}.`)
      } else if (o.op === 'sub') {
        lines.push(o.c === ' ' ? 'Chỗ này phải có dấu cách (cụm gồm nhiều chữ).'
          : o.t === ' ' ? 'Chỗ này không có dấu cách.'
            : `Chữ thứ ${o.ci + 1} phải là ${q(o.c)}, con viết ${q(o.t)}.`)
      }
    }
  }
  lines.push(`Đánh vần đúng: ${spellOut(b)}.`)
  return lines
}

// ===================== CHỌN TỪ CHO MỖI LƯỢT CHƠI =====================
const accOf = (st) => {
  const h = String((st && st.h) || '').slice(-6)
  if (!h) return null
  let ones = 0; for (const c of h) if (c === '1') ones++
  return ones / h.length
}
// Ưu tiên từ con HAY SAI, rồi từ CHƯA LÀM, rồi từ đã vững (có chút ngẫu nhiên để mỗi lượt khác nhau).
// level: 'weak' (mặc định) | 'wrong' (chỉ từ từng sai) | 'new' (từ chưa làm) | 'all' (trộn đều) | 'master'.
export function pickWords(words, vstats, { level = 'weak', count = 10, rnd = Math.random } = {}) {
  const st = vstats || {}
  const score = (w) => {
    const s = st[w.key]
    const acc = accOf(s)
    if (acc == null) return 0.45 + rnd() * 0.2 // chưa làm lần nào
    const recentWrong = String(s.h || '').slice(-2).includes('0') ? 0.3 : 0
    return (1 - acc) + recentWrong + rnd() * 0.2
  }
  let list = [...(words || [])]
  if (level === 'wrong') {
    const wr = list.filter((w) => st[w.key] && String(st[w.key].h || '').slice(-6).includes('0'))
    if (wr.length) list = wr
  } else if (level === 'new') {
    const nw = list.filter((w) => !st[w.key] || !st[w.key].h)
    if (nw.length) list = [...nw, ...list.filter((w) => !nw.includes(w))]
    return list.slice(0, count)
  }
  if (level === 'all') {
    for (let i = list.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1));[list[i], list[j]] = [list[j], list[i]] }
    return list.slice(0, count)
  }
  return list.map((w) => ({ w, s: score(w) })).sort((x, y) => y.s - x.s).map((x) => x.w).slice(0, count)
}

// ===================== XẾP CHỮ CÁI =====================
const isLetter = (ch) => /[a-z]/i.test(ch)
function shuffle(a, rnd = Math.random) {
  const x = a.slice()
  for (let i = x.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1));[x[i], x[j]] = [x[j], x[i]] }
  return x
}
// Bộ ô chữ cho trò Xếp chữ:
//  lv1: TẤT CẢ chữ cái bị xáo -> con ghép lại;  lv2: ẨN khoảng 40% chữ cái -> con điền chỗ thiếu
//  (thêm 2 chữ "nhiễu"); lv3: gõ cả từ (không dùng ô chữ).
// Dấu cách / gạch nối / nháy là ô cố định (hiện sẵn).
export function tileSet(word, lv = 1, rnd = Math.random) {
  const chars = [...normSpell(word)]
  const letterIdx = chars.map((c, i) => (isLetter(c) ? i : -1)).filter((i) => i >= 0)
  let hidden
  if (lv <= 1) hidden = letterIdx
  else {
    const pool = letterIdx.length >= 3 ? letterIdx.slice(1) : letterIdx // giữ chữ đầu làm mốc
    const k = Math.max(1, Math.min(pool.length, Math.round(letterIdx.length * 0.4)))
    hidden = shuffle(pool, rnd).slice(0, k).sort((x, y) => x - y)
  }
  const hiddenSet = new Set(hidden)
  const slots = chars.map((c, i) => ({ i, ch: c, open: hiddenSet.has(i) }))
  let letters = hidden.map((i) => chars[i])
  if (lv >= 2) {
    const abc = 'abcdefghijklmnopqrstuvwxyz'
    for (let n = 0; n < 2; n++) letters.push(abc[Math.floor(rnd() * 26)])
  }
  let tiles = shuffle(letters, rnd)
  // Tránh trường hợp xáo xong lại y nguyên thứ tự đúng (từ có ≥2 chữ khác nhau).
  if (lv <= 1 && new Set(letters.map((c) => c.toLowerCase())).size > 1) {
    for (let g = 0; g < 8 && tiles.join('') === letters.join(''); g++) tiles = shuffle(letters, rnd)
  }
  return { slots, tiles: tiles.map((ch, id) => ({ id, ch })) }
}

// ===================== CẬP NHẬT ĐÚNG/SAI TỪNG TỪ =====================
// results: [{ key, ok, typed?, game, lv? }] -> sổ đúng/sai mới (không sửa bản cũ).
export function applyWordResults(vstats, results, dict = {}) {
  const out = { ...(vstats || {}) }
  const today = new Date().toISOString().slice(0, 10)
  for (const r of results || []) {
    if (!r || !r.key) continue
    const prev = out[r.key] || { r: 0, x: 0, h: '' }
    const e = dict[r.key] || {}
    const next = {
      ...prev,
      w: e.w || prev.w || r.w || r.key,
      mean: (e.mean && e.mean[0]) || prev.mean || '',
      r: (prev.r || 0) + (r.ok ? 1 : 0),
      x: (prev.x || 0) + (r.ok ? 0 : 1),
      h: (String(prev.h || '') + (r.ok ? '1' : '0')).slice(-HIST),
      last: today,
    }
    if (!r.ok && r.typed) { next.miss = clip(r.typed, 40); next.missGame = r.game || ''; next.missOn = today }
    if (typeof r.lv === 'number') next.lv = Math.max(1, Math.min(3, r.lv))
    out[r.key] = next
  }
  return out
}

// "Từ con hay sai": từ có câu SAI trong 6 lần gần nhất — sai nhiều/gần đây đứng trước.
export function troubleWords(vstats, max = 8) {
  return Object.entries(vstats || {})
    .map(([key, s]) => {
      const h = String((s && s.h) || '').slice(-6)
      const wrong = [...h].filter((c) => c === '0').length
      return { key, ...s, wrong6: wrong, tries6: h.length }
    })
    .filter((s) => s.wrong6 > 0)
    .sort((a, b) => b.wrong6 - a.wrong6 || (b.x || 0) - (a.x || 0) || String(b.last || '').localeCompare(String(a.last || '')))
    .slice(0, max)
}

// Lớp của con ("Lớp 7" -> 7); không rõ -> 0.
export function gradeNum(grade) {
  const m = String(grade || '').match(/\d+/)
  const n = m ? Number(m[0]) : 0
  return n >= 1 && n <= 12 ? n : 0
}

// ===================== CÁC TRÒ CHƠI TỪ VỰNG =====================
// typed: con TỰ GÕ (khó hơn) -> câu đúng +20 điểm thành thạo; tiles: +14 (có sẵn chữ cái);
// truefalse: trò KHỞI ĐỘNG — KHÔNG tính vào % thành thạo (đoán 50/50 thì % sẽ ảo), chỉ ghi từ con chọn sai.
export const VOCAB_GAMES = [
  { k: 'spell', icon: '🎧', name: 'Nghe – viết', desc: 'Nghe đọc từ, viết lại đúng chính tả', mastery: 'typed' },
  { k: 'tiles', icon: '🔤', name: 'Xếp chữ cái', desc: 'Ghép chữ thành từ — thuộc dần thì khó lên', mastery: 'choice' },
  { k: 'meaning', icon: '✍️', name: 'Gõ nghĩa', desc: 'Anh → Việt và Việt → Anh', mastery: 'typed' },
  { k: 'truefalse', icon: '⚡', name: 'Đúng hay sai', desc: '60 giây đoán nhanh từ – nghĩa', mastery: 'none', choice: true },
  { k: 'cloze', icon: '🧩', name: 'Điền từ vào câu', desc: 'Điền từ còn thiếu trong câu', mastery: 'typed' },
  { k: 'wordform', icon: '🔀', name: 'Biến đổi từ', desc: 'Đổi từ gốc thành dạng đúng', mastery: 'typed', minGrade: 6 },
]
export const vocabGame = (k) => VOCAB_GAMES.find((g) => g.k === k) || null

// Trò "Biến đổi từ" dành cho THCS/THPT (lớp 6+); chưa rõ lớp thì vẫn cho chơi.
export function gameAllowed(g, { grade = 0, allowChoice = true } = {}) {
  if (!g) return false
  if (g.minGrade && grade && grade < g.minGrade) return false
  if (g.choice && !allowChoice) return false // phụ huynh tắt trắc nghiệm -> ẩn trò đoán Đúng/Sai
  return true
}

// Gợi ý chữ cái đầu: "big" -> "b _ _"; cụm "look after" -> "l _ _ _   a _ _ _ _" (chữ đầu MỖI từ).
export function hintPattern(word) {
  return normSpell(word).split(' ').map((p) => [...p].map((c, i) => (i === 0 || !isLetter(c) ? c : '_')).join(' ')).join('   ')
}

// Mức Xếp chữ của một từ (1: xếp cả từ, 2: điền chữ thiếu, 3: gõ cả từ). Lớp 6+ bắt đầu từ mức 2.
export function tileLevel(st, grade = 0) {
  const lv = st && Number(st.lv)
  if (lv >= 1 && lv <= 3) return lv
  return grade >= 6 ? 2 : 1
}
// Đúng (không sai chữ nào) -> lên 1 mức; sai -> xuống 1 mức.
export function nextTileLevel(lv, ok) {
  return ok ? Math.min(3, (lv || 1) + 1) : Math.max(1, (lv || 1) - 1)
}

// Dựng các câu cho MỘT lượt chơi từ danh sách từ ĐÃ XẾP ƯU TIÊN. Chỉ dùng từ đã có trong sổ.
// Trả [] nếu không đủ dữ liệu (vd chưa có câu ví dụ cho trò Điền từ).
export function buildItems(game, words, dict, vstats = {}, { count = 10, grade = 0, rnd = Math.random } = {}) {
  const items = []
  const ok = (words || []).map((x) => ({ ...x, e: entryOf(dict, x.key) })).filter((x) => x.e)
  if (game === 'wordform') {
    // Mỗi từ 1 câu trước; thiếu thì mới lấy câu thứ 2 của cùng từ.
    for (const round of [0, 1]) {
      for (const x of ok) {
        if (items.length >= count) break
        const f = (x.e.forms || [])[round]
        if (f) items.push({ key: x.key, group: x.group, e: x.e, s: f.s, root: f.root, a: f.a, why: f.why })
      }
    }
    return shuffle(items, rnd)
  }
  const dirStart = rnd() < 0.5 ? 0 : 1 // Gõ nghĩa: xen kẽ Anh→Việt / Việt→Anh, bắt đầu ngẫu nhiên
  for (const x of ok) {
    if (items.length >= count) break
    const base = { key: x.key, group: x.group, e: x.e, w: x.e.w }
    if (game === 'cloze') {
      if (x.e.cloze) items.push({ ...base, s: x.e.cloze.s, a: x.e.cloze.a })
    } else if (game === 'tiles') {
      const lv = tileLevel(vstats[x.key], grade)
      items.push({ ...base, lv, board: lv < 3 ? tileSet(x.e.w, lv, rnd) : null })
    } else if (game === 'meaning') {
      items.push({ ...base, dir: (items.length + dirStart) % 2 === 0 ? 'en-vi' : 'vi-en' })
    } else {
      items.push(base) // spell, truefalse
    }
  }
  return items
}

// ĐÚNG HAY SAI: một cặp "từ = nghĩa?". Cặp SAI lấy nghĩa của từ KHÁC mà KHÔNG trùng nghĩa
// (meaningsOverlap) -> không bao giờ có cặp "sai" mà thật ra lại đúng. Không tìm được thì ra cặp đúng.
export function makeTFPair(pool, { avoidKey = '', rnd = Math.random } = {}) {
  const list = (pool || []).filter((x) => x && x.e)
  if (!list.length) return null
  const cand = list.length > 1 ? list.filter((x) => x.key !== avoidKey) : list
  const x = cand[Math.floor(rnd() * cand.length)]
  const real = x.e.mean[0]
  if (rnd() < 0.5) return { key: x.key, group: x.group, w: x.e.w, e: x.e, shown: real, truth: true, real }
  const others = list.filter((o) => wordKey(o.e.w) !== wordKey(x.e.w) && !meaningsOverlap(x.e.mean, o.e.mean))
  if (!others.length) return { key: x.key, group: x.group, w: x.e.w, e: x.e, shown: real, truth: true, real }
  const o = others[Math.floor(rnd() * others.length)]
  return { key: x.key, group: x.group, w: x.e.w, e: x.e, shown: o.e.mean[0], truth: false, real, otherW: o.e.w }
}

// Nhãn chủ đề gọn cho chip: "Từ vựng: Nghề nghiệp" -> "Nghề nghiệp".
export function groupLabel(name) {
  return String(name || '').replace(/^\s*từ vựng\s*[:：-]\s*/i, '').trim() || String(name || '')
}
