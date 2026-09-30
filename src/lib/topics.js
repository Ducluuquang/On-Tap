// HIỂU "YÊU CẦU ÔN" GÕ TAY + NHẬN RA TÊN KHÁI NIỆM CHUNG CHUNG (chốt 29/9/2026).
// Vd con gõ "ôn từ vựng" = muốn ôn NHÓM "từ vựng" — KHÔNG phải một kiến thức tên là "Ôn từ vựng".
// "Từ vựng cơ bản", "Ngữ pháp cơ bản", "Ôn tập", "Bài tập"… cũng KHÔNG phải kiến thức cụ thể
// -> không bao giờ được thành một mục trong bản đồ kiến thức.

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
