// Chọn khái niệm để ôn theo nhu cầu: thời gian, mức độ, hoặc yêu cầu gõ bằng lời.

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

  // 0) Nếu ô text là một CHỦ ĐỀ cụ thể (không phải từ khoá mức độ) -> ƯU TIÊN đúng chủ đề đó,
  //    KHÔNG rơi về "phần yếu nhất". Đây là chỗ trước đây bị bỏ sót khiến câu hỏi lạc đề.
  if (rawText && !LEVEL_KW.test(t)) {
    const matched = mem.filter((c) => {
      const n = (c.name || '').toLowerCase()
      return n === t || n.includes(t) || t.includes(n)
    })
    if (matched.length) return matched.slice(0, 5).map((c) => c.name)
    // Không khớp khái niệm nào trong bản đồ -> coi text là chủ đề mới, luyện đúng chủ đề đó.
    return [rawText]
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
  if (text && text.trim()) return `Ôn: ${text.trim()}`
  const lv = {
    weak: 'phần yếu nhất', wrong: 'phần hay sai', new: 'phần chưa ôn',
    notmastered: 'phần chưa thành thạo', all: 'ôn tổng hợp',
  }[level] || 'ôn tổng hợp'
  const tm = {
    week: ' · tuần này', month: ' · tháng này', two: ' · 2 tháng', three: ' · 3 tháng', all: '',
  }[time] || ''
  return `Ôn ${lv}${tm}`
}
