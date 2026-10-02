// Chọn khái niệm để ôn theo nhu cầu: thời gian, mức độ, hoặc yêu cầu gõ bằng lời.
import { plainText, hasPhrase, parseRequest, isVocabItem, isGrammarItem, isVocabGroup } from './topics.js'

function daysSince(dateStr) {
  if (!dateStr) return 99999
  return (Date.now() - new Date(dateStr).getTime()) / 86400000
}

const TIME_WINDOW = { week: 7, month: 30, two: 60, three: 90, all: Infinity }

// Các từ khoá chỉ MỨC ĐỘ (không phải tên chủ đề). Nếu ô text chỉ chứa những từ này
// thì mới coi text là "bộ lọc mức độ"; ngược lại text là TÊN CHỦ ĐỀ cụ thể.
const LEVEL_KW = /hay sai|sai nhiều|sai đi sai|chưa ôn|chưa học|mới học|chưa làm|chưa thành thạo|chưa đạt|chưa vững|phần yếu|yếu nhất|\byếu\b/

export function selectConcepts(mem, { time = 'all', level = 'all', text = '' } = {}) {
  let list = [...mem]

  // Master: chọn theo yếu-nhất, và KHÔNG coi ô text là bộ lọc (text = chủ đề muốn master).
  const effLevel = level === 'master' ? 'weak' : level
  const rawText = level === 'master' ? '' : (text || '').trim()
  const t = rawText.toLowerCase()

  // 0) Nếu ô text là một CHỦ ĐỀ (không phải từ khoá mức độ) -> ƯU TIÊN đúng chủ đề đó,
  //    KHÔNG rơi về "phần yếu nhất". Đây là chỗ trước đây bị bỏ sót khiến câu hỏi lạc đề.
  //    Hiểu đúng LỜI YÊU CẦU: "ôn từ vựng" = ôn các TỪ VỰNG trong bản đồ (không phải chủ đề "Ôn từ vựng").
  if (rawText && !LEVEL_KW.test(t)) {
    const picked = resolveTopic(rawText, mem)
    if (picked.length) return picked
    // Chỉ là lời yêu cầu chung ("ôn bài", "ôn tập") -> dùng bộ lọc mức độ bên dưới.
  }

  // 1) Lọc theo thời gian đã học
  const win = TIME_WINDOW[time] ?? Infinity
  if (win !== Infinity) list = list.filter((c) => daysSince(c.learnedOn) <= win)

  // 2) Lọc theo mức độ / theo câu gõ tay
  const wantWrong = effLevel === 'wrong' || /hay sai|sai đi sai|sai nhiều|\bsai\b/.test(t)
  const wantNew = effLevel === 'new' || /chưa ôn|chưa học|mới học|chưa làm/.test(t)
  const wantNotMastered = effLevel === 'notmastered' || /chưa thành thạo|chưa đạt|chưa vững|100/.test(t)
  const wantWeak = effLevel === 'weak' || /yếu/.test(t)

  if (wantWrong) list = list.filter((c) => (c.wrong || 0) > 0).sort((a, b) => (b.wrong || 0) - (a.wrong || 0))
  else if (wantNew) list = list.filter((c) => (c.reviews || 0) === 0 || c.newToday)
  else if (wantNotMastered) list = list.filter((c) => c.mastery < 90).sort((a, b) => a.mastery - b.mastery)
  else if (wantWeak) list = [...list].sort((a, b) => a.mastery - b.mastery)
  else list = [...list].sort((a, b) => a.mastery - b.mastery) // mặc định: yếu trước

  // 3) Dự phòng: nếu rỗng thì lấy toàn bộ, yếu trước
  if (list.length === 0) list = [...mem].sort((a, b) => a.mastery - b.mastery)

  return list.slice(0, 5).map((c) => c.name)
}

export function describeSelection({ time = 'all', level = 'all', text = '' } = {}) {
  if (level === 'master') {
    const mt = (text || '').trim()
    return mt ? `Master 🏆: ${mt}` : 'Master 🏆: phần yếu nhất'
  }
  if (text && text.trim()) {
    const { topic, bucket } = parseRequest(text)
    if (topic && bucket !== 'generic') return `Ôn: ${topic}` // "ôn từ vựng" -> "Ôn: từ vựng" (không lặp chữ "ôn")
    if (!topic && bucket !== 'generic') return `Ôn: ${text.trim()}`
  }
  const lv = {
    weak: 'phần yếu nhất', wrong: 'phần hay sai', new: 'phần chưa ôn',
    notmastered: 'phần chưa thành thạo', all: 'tổng hợp',
  }[level] || 'tổng hợp'
  const tm = {
    week: ' · tuần này', month: ' · tháng này', two: ' · 2 tháng', three: ' · 3 tháng', all: '',
  }[time] || ''
  return `Ôn ${lv}${tm}`
}

// Khái niệm trong bản đồ KHỚP với chủ đề gõ tay (so không dấu, theo NGUYÊN CỤM TỪ).
// Tên quá ngắn (vd từ "on", "in") chỉ khớp khi gõ ĐÚNG y tên đó — tránh "ôn …" khớp nhầm từ "on".
function matchConcepts(list, p) {
  if (!p) return []
  const exact = []
  const near = []
  for (const c of list || []) {
    const n = plainText(c && c.name)
    if (!n) continue
    if (n === p) { exact.push(c); continue }
    const shortName = !n.includes(' ') && n.length < 4
    if ((!shortName && hasPhrase(p, n)) || (p.length >= 3 && hasPhrase(n, p))) near.push(c)
  }
  return [...exact, ...near]
}

const weakFirst = (a, b) => (a.mastery || 0) - (b.mastery || 0)

// HIỂU MỘT YÊU CẦU/CHỦ ĐỀ gõ tay -> danh sách tên khái niệm để ra đề.
// - Gõ đúng tên khái niệm có trong bản đồ -> khái niệm đó.
// - "ôn từ vựng" / "ôn ngữ pháp" -> các khái niệm TỪ VỰNG / NGỮ PHÁP của môn trong bản đồ (yếu trước).
//   Bản đồ chưa có -> "Từ vựng"/"Ngữ pháp" (ôn chung; KHÔNG thành mục trong bản đồ kiến thức).
// - "ôn phân số" -> các khái niệm có "phân số"; chưa có -> chủ đề mới "Phân số" (đã bỏ chữ "ôn").
// - Lời chung chung ("ôn tập", "ôn bài") -> [] (để dùng bộ lọc mức độ).
export function resolveTopic(text, mem, { limit = 5, vocabLimit = 15 } = {}) {
  const raw = String(text || '').trim()
  if (!raw) return []
  const list = mem || []
  const exact = list.filter((c) => plainText(c.name) === plainText(raw))
  if (exact.length) return [exact[0].name]
  const { topic, bucket } = parseRequest(raw)
  if (bucket === 'vocab') {
    const words = list.filter(isVocabItem).sort(weakFirst)
    return words.length ? words.slice(0, vocabLimit).map((c) => c.name) : ['Từ vựng']
  }
  if (bucket === 'grammar') {
    const gr = list.filter(isGrammarItem).sort(weakFirst)
    return gr.length ? gr.slice(0, limit).map((c) => c.name) : ['Ngữ pháp']
  }
  if (bucket === 'generic') return []
  const tp = plainText(topic || raw)
  const matched = matchConcepts(list, tp)
  if (matched.length) return matched.slice(0, limit).map((c) => c.name)
  // Gõ MỘT từ đã nằm trong nhóm từ vựng (vd "doctor" thuộc "Từ vựng: Nghề nghiệp") -> ôn cả nhóm đó
  // (10 câu chỉ về một từ thì vô nghĩa; kết quả vẫn ghi vào đúng mục lớn).
  const inGroup = list.filter((c) => isVocabGroup(c.name) && (c.details || []).some((d) => plainText(d) === tp))
  if (inGroup.length) return inGroup.slice(0, limit).map((c) => c.name)
  // Không khớp khái niệm nào trong bản đồ -> chủ đề mới (viết hoa chữ đầu), luyện đúng chủ đề đó.
  const name = (topic || raw).trim()
  return name ? [name.charAt(0).toLocaleUpperCase('vi') + name.slice(1)] : []
}
