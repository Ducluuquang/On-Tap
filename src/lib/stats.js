// Thời gian học THẬT + mục tiêu mỗi ngày.
// "Thời gian học" = thời gian con CHỜ app soạn/nạp bài (lúc màn hình "Đang chuẩn bị…")
//   + thời gian con thực sự trả lời bài (mỗi câu tính tối đa 60s).
// KHÔNG tính thời gian mở app đứng yên giữa các câu. Lưu theo từng ngày (YYYY-MM-DD).

const KEY = 'ontap.stats.v1'
const DAY_LABELS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7']

function isoDay(d) { return d.toISOString().slice(0, 10) }
function today() { return isoDay(new Date()) }

// Vài ngày mẫu để phụ huynh thấy ngay biểu đồ (bản demo). Bản thật sẽ tự tích luỹ.
function seedDays() {
  const mins = { 6: 18, 5: 12, 4: 22, 3: 0, 2: 16, 1: 25 } // n ngày trước : số phút
  const out = {}
  for (const n of Object.keys(mins)) {
    const d = new Date(); d.setDate(d.getDate() - Number(n))
    out[isoDay(d)] = mins[n] * 60
  }
  return out
}

export function loadStats() {
  try {
    const r = localStorage.getItem(KEY)
    if (r) { const s = JSON.parse(r); return { goalMin: 15, days: {}, ...s } }
  } catch { /* noop */ }
  return { goalMin: 15, days: seedDays() }
}
export function saveStats(s) {
  try { localStorage.setItem(KEY, JSON.stringify(s)) } catch { /* noop */ }
}

// Cộng thêm số giây học vào HÔM NAY (trả về bản mới, không sửa tại chỗ).
export function addSeconds(stats, sec) {
  if (!sec || sec < 1) return stats
  const t = today()
  const days = { ...stats.days, [t]: (stats.days[t] || 0) + Math.round(sec) }
  return { ...stats, days }
}
export function setGoalMin(stats, min) {
  return { ...stats, goalMin: Math.max(1, Math.round(min)) }
}

// 7 ngày gần nhất (kể cả hôm nay), cũ -> mới.
export function last7(stats) {
  const out = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i)
    const sec = stats.days[isoDay(d)] || 0
    out.push({ date: isoDay(d), label: DAY_LABELS[d.getDay()], sec, min: Math.round(sec / 60), isToday: i === 0 })
  }
  return out
}
export function totalMinutes(stats) {
  return Math.round(Object.values(stats.days || {}).reduce((s, v) => s + v, 0) / 60)
}
export function todayMinutes(stats) {
  return Math.round((stats.days[today()] || 0) / 60)
}
// Số ngày đạt mục tiêu trong 7 ngày gần nhất.
export function goalMetCount(stats) {
  return last7(stats).filter((d) => d.min >= stats.goalMin).length
}

// ---- Chuỗi ngày ĐẠT MỤC TIÊU (streak) + phần thưởng ----
function metOn(stats, d) { return (stats.days[isoDay(d)] || 0) / 60 >= stats.goalMin }

// Số ngày LIÊN TIẾP gần nhất con đạt mục tiêu (hôm nay chưa đạt thì đếm từ hôm qua).
export function streakDays(stats) {
  let n = 0
  const d = new Date()
  if (!metOn(stats, d)) d.setDate(d.getDate() - 1)
  while (metOn(stats, d)) { n++; d.setDate(d.getDate() - 1) }
  return n
}
// Mốc thưởng kế tiếp: 7 → 15 → 30, sau đó cứ +30 ngày.
export function nextReward(streak) {
  for (const m of [7, 15, 30]) if (streak < m) return m
  return Math.ceil((streak + 1) / 30) * 30
}
// Mốc thưởng ĐÃ đạt gần nhất (điểm bắt đầu của chặng hiện tại).
export function prevReward(streak) {
  if (streak < 7) return 0
  if (streak < 15) return 7
  if (streak < 30) return 15
  return Math.floor(streak / 30) * 30
}

// Bộ đếm thời gian có tương tác: reset() khi hiện câu mới, step() khi con trả lời.
// Mỗi câu cộng tối đa capPerStep giây (tránh tính giờ khi con bỏ đi mất).
export function createActiveTimer(capPerStep = 60) {
  let last = (typeof performance !== 'undefined' ? performance.now() : Date.now())
  let total = 0
  const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now())
  return {
    reset() { last = now() },
    step() { total += Math.min(capPerStep, (now() - last) / 1000); last = now() },
    get() { return Math.round(total) },
  }
}
