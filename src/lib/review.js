// Chọn khái niệm để ôn theo nhu cầu: thời gian, mức độ, hoặc yêu cầu gõ bằng lời.

function daysSince(dateStr) {
  if (!dateStr) return 99999
  return (Date.now() - new Date(dateStr).getTime()) / 86400000
}

const TIME_WINDOW = { week: 7, month: 30, two: 60, three: 90, all: Infinity }

export function selectConcepts(mem, { time = 'all', level = 'all', text = '' } = {}) {
  let list = [...mem]

  // Master: chọn theo yếu-nhất, và KHÔNG coi ô text là bộ lọc (text = chủ đề muốn master).
  const effLevel = level === 'master' ? 'weak' : level
  const effText = level === 'master' ? '' : text

  // 1) Lọc theo thời gian đã học
  const win = TIME_WINDOW[time] ?? Infinity
  if (win !== Infinity) list = list.filter((c) => daysSince(c.learnedOn) <= win)

  // 2) Lọc theo mức độ / theo câu gõ tay
  const t = (effText || '').toLowerCase()
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
