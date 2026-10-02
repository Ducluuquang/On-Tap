// HIỂU "YÊU CẦU ÔN" GÕ TAY + NHẬN RA TÊN KHÁI NIỆM CHUNG CHUNG (chốt 29/9/2026).
// Vd con gõ "ôn từ vựng" = muốn ôn NHÓM "từ vựng" — KHÔNG phải một kiến thức tên là "Ôn từ vựng".
// "Từ vựng cơ bản", "Ngữ pháp cơ bản", "Ôn tập", "Bài tập"… cũng KHÔNG phải kiến thức cụ thể
// -> không bao giờ được thành một mục trong bản đồ kiến thức.

import { subjectKey } from './subjects.js'

// Bỏ dấu, thường hoá, chỉ giữ chữ/số (GIỮ thứ tự từ).
export function plainText(s) {
  return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd')
    .replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim()
}

// `needle` xuất hiện NGUYÊN CỤM TỪ trong `hay` (không khớp nửa chữ).
export function hasPhrase(hay, needle) {
  return !!needle && !!hay && (' ' + hay + ' ').includes(' ' + needle + ' ')
}

// Lời mở đầu ("con muốn…"), động từ yêu cầu ("ôn", "ôn tập", "luyện…"), trợ từ cuối câu ("nhé", "ạ"…).
const LEAD = ['con muon', 'em muon', 'minh muon', 'toi muon', 'muon', 'giup con', 'giup em', 'cho con', 'cho em', 'cho minh']
const VERBS = ['on tap lai', 'on luyen', 'on tap', 'on lai', 'luyen tap lai', 'luyen tap', 'luyen lai', 'luyen',
  'hoc lai', 'review', 'revise', 'practice', 'practise']
// Trợ từ cuối câu — so theo chữ CÓ DẤU (tránh cắt nhầm "Vitamin A", "go"…).
const TAIL = ['ạ', 'nhé', 'nhe', 'nha', 'nhá', 'nhen', 'đi', 'nào', 'với', 'thôi']
// "ôn" đứng trước các chữ này là TỪ GHÉP có nghĩa (ôn đới, ôn hoà) -> không phải lời yêu cầu "ôn".
const KEEP_AFTER_ON = new Set(['doi', 'hoa'])

// NHÓM CHUNG (không phải kiến thức cụ thể).
const VOCAB = new Set(['tu vung', 'tu moi', 'vocabulary', 'vocab', 'new words', 'words'])
const GRAMMAR = new Set(['ngu phap', 'grammar', 'mau cau', 'cau truc', 'cau truc cau', 'structure', 'structures'])
const GENERIC = new Set(['kien thuc', 'on tap', 'luyen tap', 'bai tap', 'bai hoc', 'bai', 'tong hop', 'noi dung',
  'chu de', 'topic', 'phan', 'unit', 'lesson', 'chuong', 'tuan', 'tiet', 'hoc ki', 'hoc ky', 'kien thuc chung'])
// Chữ "bổ nghĩa chung chung" đứng CUỐI (bỏ đi mới thấy lõi): "Từ vựng CƠ BẢN", "Luyện tập CHUNG"…
const QUAL = ['co ban', 'nang cao', 'chung', 'tong hop', 'moi', 'da hoc', 'hom nay', 'cua con', 'cua em',
  'tieng anh', 'tieng viet', 'can on', 'trong bai', 'cua bai', 'sach giao khoa', 'sgk']
// Chữ chỉ số nhiều đứng ĐẦU: "các từ vựng", "những từ mới".
const PLURAL = ['mot so', 'cac', 'nhung']

const startLen = (words, phrase) => {
  const w = phrase.split(' ')
  return w.length <= words.length && w.every((x, i) => words[i] === x) ? w.length : 0
}
const endLen = (words, phrase) => {
  const w = phrase.split(' ')
  const n = words.length
  return w.length <= n && w.every((x, i) => words[n - w.length + i] === x) ? w.length : 0
}

// Lõi của cụm từ (bỏ "các/những", bỏ chữ bổ nghĩa chung + số lớp ở cuối) -> xếp vào nhóm nào.
function bucketOfWords(words) {
  let w = words.filter(Boolean)
  for (const p of PLURAL) { const n = startLen(w, p); if (n) { w = w.slice(n); break } }
  const kind = (core) => (VOCAB.has(core) ? 'vocab' : GRAMMAR.has(core) ? 'grammar' : GENERIC.has(core) ? 'generic' : null)
  // Bỏ DẦN từng chữ bổ nghĩa/số ở cuối; ở mỗi bước kiểm tra lõi (để "Từ mới" vẫn là nhóm từ vựng).
  for (let guard = 0; guard < 12; guard++) {
    const core = w.join(' ')
    if (!core) return 'generic'
    const k = kind(core)
    if (k) return k
    const last = w[w.length - 1]
    if (/^\d+$/.test(last)) {
      w = w.slice(0, -1)
      if (['lop', 'grade', 'class'].includes(w[w.length - 1])) w = w.slice(0, -1)
      continue
    }
    const n = QUAL.map((q) => endLen(w, q)).find((x) => x)
    if (!n) return null
    w = w.slice(0, w.length - n)
  }
  return null
}

// Tách YÊU CẦU gõ tay -> { topic: phần chủ đề (giữ nguyên chữ gốc), bucket: 'vocab'|'grammar'|'generic'|null }.
// Vd "con muốn ôn từ vựng nhé" -> { topic: "từ vựng", bucket: "vocab" };
//     "ôn phân số" -> { topic: "phân số", bucket: null };  "ôn tập" -> { topic: "", bucket: "generic" }.
export function parseRequest(text) {
  const src = String(text || '')
  const toks = []
  const re = /\S+/g
  let m
  while ((m = re.exec(src))) toks.push({ raw: m[0], lo: m[0].toLowerCase().replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, ''), start: m.index, end: m.index + m[0].length })
  const words = toks.map((t) => plainText(t.raw))
  let a = 0, b = toks.length
  const trimEmpty = () => { while (a < b && !words[a]) a++; while (b > a && !words[b - 1]) b-- }
  trimEmpty()
  // 1) Lời mở đầu: "hãy", "con muốn", "giúp con"…
  for (let guard = 0; guard < 4 && a < b; guard++) {
    if (toks[a].lo === 'hãy') { a++; continue }
    const cur = words.slice(a, b)
    const hit = LEAD.map((p) => startLen(cur, p)).find((n) => n && n < cur.length)
    if (!hit) break
    a += hit
  }
  // 2) Động từ yêu cầu: "ôn tập", "luyện", "review"… (và "ôn" đơn lẻ nếu chắc chắn là lời yêu cầu)
  if (a < b) {
    const cur = words.slice(a, b)
    const hit = VERBS.map((p) => startLen(cur, p)).find((n) => n)
    if (hit) a += hit
    else if (cur[0] === 'on') {
      const next = cur[1]
      const rest = cur.slice(1)
      const written = toks[a].lo === 'ôn' // có dấu -> chắc chắn là "ôn"
      if (!KEEP_AFTER_ON.has(next) && (written || !rest.length || bucketOfWords(rest.join(' ').split(' ')))) a += 1
    }
  }
  // 3) Trợ từ cuối câu: "nhé", "ạ", "đi"…
  while (b > a + 1 && TAIL.includes(toks[b - 1].lo)) b--
  trimEmpty()
  const topic = a < b ? src.slice(toks[a].start, toks[b - 1].end).replace(/^[\s,.:;!?–—-]+|[\s,.:;!?–—-]+$/g, '').trim() : ''
  const bucket = bucketOfWords(words.slice(a, b).join(' ').split(' '))
  return { topic, bucket }
}

// Tên khái niệm CHUNG CHUNG (không phải kiến thức cụ thể) -> KHÔNG được thành mục trong bản đồ kiến thức.
// Vd: "Ôn từ vựng", "Từ vựng cơ bản", "Ngữ pháp cơ bản", "Ôn tập", "Luyện tập chung", "Bài 5".
// KHÔNG chung chung: "Thì hiện tại đơn", "Mẫu số chung", "Ôn đới", "on foot", "Từ vựng về gia đình".
export function isVagueConcept(name) {
  if (!plainText(name)) return true
  return parseRequest(name).bucket !== null
}

// ---- Phân loại khái niệm trong bản đồ (để hiểu "ôn từ vựng" / "ôn ngữ pháp") ----
const GRAMMAR_EN = /\b(tenses?|simple|continuous|progressive|perfect|conditionals?|passive|voice|articles?|pronouns?|prepositions?|comparatives?|superlatives?|modals?|verbs?|nouns?|adjectives?|adverbs?|clauses?|reported|question tags?|plurals?|singular|gerunds?|infinitives?|possessives?|imperatives?|countable|uncountable|quantifiers?|conjunctions?|determiners?|grammar|structures?|wh|there is|there are|going to|used to)\b/
const GRAMMAR_VI = /\b(thi|cau|mao tu|gioi tu|dai tu|dong tu|danh tu|tinh tu|trang tu|so sanh|cau truc|mau cau|ngu phap|so nhieu|so it|so huu|menh de|chu ngu|vi ngu|trang ngu|dau cau|lien tu|quan he tu|bi dong|gian tiep|truc tiep)\b/

// Khái niệm là TỪ VỰNG: một từ/cụm tiếng Anh (vd "doctor", "go shopping") hoặc nhóm từ ("Từ vựng về gia đình").
export function isVocabItem(c) {
  const name = String((c && c.name) || '').trim()
  const p = plainText(name)
  if (!p) return false
  if (/^(tu vung|tu moi|tu chi|von tu|mo rong von tu)\b/.test(p)) return true
  if (/[^\x00-\x7F]/.test(name)) return false // có dấu tiếng Việt -> không phải từ tiếng Anh
  if (!/[a-z]/i.test(name)) return false
  return !GRAMMAR_EN.test(p)
}

// Khái niệm là NGỮ PHÁP: "Thì quá khứ đơn", "Câu bị động", "Present simple", "Conditional 0"…
export function isGrammarItem(c) {
  const name = String((c && c.name) || '').trim()
  const p = plainText(name)
  if (!p) return false
  if (!/[^\x00-\x7F]/.test(name)) return GRAMMAR_EN.test(p)
  return GRAMMAR_VI.test(p)
}

// ===================== CHỦ ĐỀ LỚN (chốt 2/10/2026) =====================
// Bản đồ kiến thức chỉ ghi MỤC LỚN. Ý nhỏ (câu mẫu, từ lẻ, loại nhỏ) gộp vào chủ đề lớn, lưu ở "details".
// VD 8 câu "Never have I seen…", "Hardly had I…" = MỘT mục "Câu đảo ngữ (Inversion)".
// (AI đã được dặn gộp sẵn; đây là lớp an toàn trên máy + dọn dữ liệu cũ. Chỉ áp dụng cho môn Tiếng Anh,
//  vì cùng chữ "đảo ngữ"/"điều kiện" ở môn khác có nghĩa khác.)

const AUX_RE = /\b(am|is|are|was|were|have|has|had|do|does|did|will|would|shall|should|can|could|may|might|must)\b/
const INVERSION_START = /^(never|hardly|rarely|seldom|scarcely|barely|little|no sooner|not until|not only|not once|only (after|when|if|by|then|once|in|with|later|because)|under no circumstances|on no account|in no way|at no time|in no case|nowhere|neither|nor)\b/
const FAMILIES = [
  {
    name: 'Câu đảo ngữ (Inversion)',
    label: /\b(cau dao ngu|dao ngu|inversions?)\b/,
    instance: (p) => INVERSION_START.test(p) && AUX_RE.test(p.replace(INVERSION_START, '')),
  },
  {
    name: 'Câu điều kiện (Conditional)',
    label: /\b(cau dieu kien|conditionals?|if clauses?|menh de if)\b/,
    instance: (p) => /^(if|unless)\b/.test(p) && /\b(will|would|can|could|might|may|should|must|shall)\b/.test(p),
  },
]
// Chữ "chỉ là tên nhóm" (bỏ đi mà không còn gì -> tên đó chính là chủ đề lớn, không phải ý nhỏ).
const FAMILY_FILLER = new Set(['cau', 'cac', 'sentence', 'sentences', 'clause', 'clauses', 'type', 'types', 'structure', 'structures', 'grammar', 'ngu', 'phap'])

// Ý nhỏ này thuộc CHỦ ĐỀ LỚN nào (chỉ môn Tiếng Anh). Trả { name, isLabel } hoặc null.
// isLabel = true: chính là tên chủ đề lớn (vd "Đảo ngữ", "Inversion") -> không cần lưu thành ý nhỏ.
export function topicFamilyOf(name, subject) {
  if (subjectKey(subject) !== 'tieng-anh') return null
  const p = plainText(name)
  if (!p) return null
  for (const f of FAMILIES) {
    if (f.label.test(p)) {
      const rest = p.replace(new RegExp(f.label.source, 'g'), ' ').split(' ').filter((w) => w && !FAMILY_FILLER.has(w))
      return { name: f.name, isLabel: rest.length === 0 }
    }
    if (f.instance(p)) return { name: f.name, isLabel: false }
  }
  return null
}

// Nhóm từ vựng ("Từ vựng: Nghề nghiệp")?
export function isVocabGroup(name) {
  return /^(tu vung|tu moi|vocabulary)\b/.test(plainText(name))
}

// Một TỪ/CỤM TỪ tiếng Anh lẻ (không phải điểm ngữ pháp, không phải câu mẫu của nhóm ngữ pháp) — chỉ môn Tiếng Anh.
export function isLooseEnglishWord(name, subject) {
  if (subjectKey(subject) !== 'tieng-anh') return false
  const s = String(name || '').trim()
  if (!s || /[^\x00-\x7F]/.test(s) || !/[a-z]/i.test(s)) return false
  if (topicFamilyOf(s, subject)) return false
  const p = plainText(s)
  if (GRAMMAR_EN.test(p)) return false
  return p.split(' ').length <= 4 // từ / cụm ngắn; câu dài không coi là "một từ vựng"
}

// Tên nhóm từ vựng theo CHỦ ĐỀ bài; không rõ chủ đề thì nêu vài từ đầu.
export function vocabGroupName(topic, words = []) {
  const t = String(topic || '').replace(/^\s*(từ vựng|tu vung|vocabulary)\s*[:\-–]?\s*/i, '').trim()
  if (t) return 'Từ vựng: ' + t
  const w = words.map((x) => String(x || '').trim()).filter(Boolean)
  return 'Từ vựng: ' + w.slice(0, 3).join(', ') + (w.length > 3 ? '…' : '')
}

// Làm sạch danh sách ý nhỏ: chuỗi ngắn, không trùng (không phân biệt hoa/thường, dấu), tối đa `max`.
export function cleanDetails(list, max = 30) {
  const out = []
  const seen = new Set()
  for (const d of Array.isArray(list) ? list : []) {
    const s = String(d == null ? '' : d).replace(/\s+/g, ' ').trim().slice(0, 90)
    const k = plainText(s)
    if (!s || !k || seen.has(k)) continue
    seen.add(k)
    out.push(s)
    if (out.length >= max) break
  }
  return out
}

const RANK_DIFF = { 'Nâng cao': 2, 'Cơ bản': 1 }
const RANK_IMP = { 'Rất quan trọng': 3, 'Quan trọng': 2, 'Bình thường': 1 }

// GỘP danh sách khái niệm (vừa đọc từ bài học) về CHỦ ĐỀ LỚN:
//  - câu mẫu / tên loại thuộc nhóm ngữ pháp lớn (đảo ngữ, câu điều kiện) -> một mục của nhóm đó;
//  - từ tiếng Anh lẻ -> một mục "Từ vựng: <chủ đề bài>" (hoặc thành ý nhỏ của chủ đề trùng tên bài);
//  - các mục còn lại giữ nguyên (AI đã gộp sẵn), ý nhỏ của mục trùng tên được nối lại.
export function groupConcepts(list, { subject = '', topic = '' } = {}) {
  const out = []
  const byKey = new Map()
  const put = (name, details, base) => {
    const k = plainText(name)
    let it = byKey.get(k)
    if (!it) {
      it = { ...base, name, details: [] }
      byKey.set(k, it)
      out.push(it)
    } else if (base) {
      if ((RANK_DIFF[base.difficulty] || 0) > (RANK_DIFF[it.difficulty] || 0)) it.difficulty = base.difficulty
      if ((RANK_IMP[base.importance] || 0) > (RANK_IMP[it.importance] || 0)) it.importance = base.importance
    }
    it.details = cleanDetails([...(it.details || []), ...details])
    return it
  }
  const loose = []
  for (const c of list || []) {
    const name = String((c && c.name) || '').replace(/\s+/g, ' ').trim()
    if (!name) continue
    const details = cleanDetails(c.details)
    const fam = topicFamilyOf(name, subject)
    if (fam) { put(fam.name, fam.isLabel ? details : [name, ...details], c); continue }
    if (isLooseEnglishWord(name, subject)) { loose.push({ ...c, name }); continue }
    put(name, details, c)
  }
  if (loose.length) {
    const words = loose.map((c) => c.name)
    // Tên bài trùng một chủ đề trong danh sách (vd bài "Thì quá khứ đơn" có từ "went") -> từ lẻ là ví dụ của chủ đề đó.
    const sameAsTopic = topic && out.find((x) => plainText(x.name) === plainText(topic))
    const vocab = sameAsTopic || out.find((x) => isVocabGroup(x.name))
    if (vocab) put(vocab.name, words, null)
    else put(vocabGroupName(topic, words), words, loose[0])
  }
  return out
}
