// Tra SỔ TỪ VỰNG qua máy chủ AI — mỗi từ chỉ tra MỘT lần (lưu trên máy, dùng chung cho các con).
// Chia đợt nhỏ (6 từ ~ 6–8 giây/đợt, an toàn với giới hạn 60 giây của máy chủ), chạy song song tối đa 3 đợt.
// Nhớ các từ ĐANG tra -> vừa chuẩn bị nền vừa bấm chơi cũng KHÔNG tra trùng (không tốn token 2 lần).
import { lookupVocab } from './aiClient.js'
import { loadDict, saveDict, mergeLookup, markUnusable, needsLookup, groupLabel } from './vocab.js'

const BATCH = 6
const PARALLEL = 3
const inflight = new Map() // khoá từ -> Promise của đợt đang tra từ đó

async function runLimited(tasks, n) {
  let i = 0
  async function worker() {
    while (i < tasks.length) {
      const t = tasks[i++]
      try { await t() } catch { /* đợt lỗi (mạng/AI bận): bỏ qua, lần sau tra lại */ }
    }
  }
  await Promise.all(Array.from({ length: Math.min(n, tasks.length) }, worker))
}

// Số từ CHƯA có trong sổ.
export function missingWords(words) {
  const d = loadDict()
  return (words || []).filter((x) => x && x.key && needsLookup(d, x.key))
}

// words: [{ key, w, group }] -> tra các từ chưa có trong sổ (tối đa `max` từ, theo thứ tự đưa vào).
// Trả về sổ MỚI NHẤT (kể cả khi vài đợt bị lỗi — từ nào tra được thì dùng được ngay).
export async function ensureEntries(words, { max = 40 } = {}) {
  const dict = loadDict()
  const waits = []
  const need = []
  const seen = new Set()
  for (const x of words || []) {
    if (!x || !x.key || !x.w || seen.has(x.key)) continue
    seen.add(x.key)
    if (inflight.has(x.key)) { waits.push(inflight.get(x.key)); continue }
    if (need.length < max && needsLookup(dict, x.key)) need.push(x)
  }
  // Gom theo CHỦ ĐỀ để AI hiểu đúng nghĩa theo bài (vd "bank" trong bài Nơi chốn = ngân hàng).
  const byGroup = new Map()
  for (const x of need) {
    const g = x.group || ''
    if (!byGroup.has(g)) byGroup.set(g, [])
    byGroup.get(g).push(x)
  }
  const batches = []
  for (const [g, list] of byGroup) {
    for (let i = 0; i < list.length; i += BATCH) {
      let done
      const p = new Promise((r) => { done = r })
      const b = { topic: groupLabel(g), list: list.slice(i, i + BATCH), p, done }
      for (const x of b.list) inflight.set(x.key, p) // đánh dấu NGAY (trước khi chạy) -> lần gọi khác chờ, không tra trùng
      batches.push(b)
    }
  }
  const tasks = batches.map((b) => async () => {
    try {
      const asked = b.list.map((x) => x.w)
      const res = await lookupVocab({ words: asked, topic: b.topic })
      const items = (res && res.words) || []
      // Đọc lại sổ NGAY lúc ghi (các đợt song song cùng ghi) rồi gộp.
      saveDict(markUnusable(mergeLookup(loadDict(), asked, items), asked, items))
    } finally {
      for (const x of b.list) if (inflight.get(x.key) === b.p) inflight.delete(x.key)
      b.done()
    }
  })
  await Promise.all([runLimited(tasks, PARALLEL), Promise.allSettled(waits)])
  return loadDict()
}
