// DEMO: AI đọc + chấm một trang bài làm thật (có chữ viết tay).
// Chạy: ANTHROPIC_API_KEY=sk-ant-... node scripts/ai-read-homework.mjs <ảnh>

import fs from 'node:fs'
const KEY = process.env.ANTHROPIC_API_KEY
if (!KEY) { console.error('Thiếu ANTHROPIC_API_KEY'); process.exit(1) }
const imgPath = process.argv[2]
const b64 = fs.readFileSync(imgPath).toString('base64')
const ext = imgPath.toLowerCase().split('.').pop()
const MEDIA = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg'
const HEADERS = { 'x-api-key': KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' }

async function pickModel() {
  try {
    const r = await fetch('https://api.anthropic.com/v1/models', { headers: HEADERS })
    const d = await r.json()
    const ids = (d.data || []).map((m) => m.id)
    return ids.find((id) => /sonnet/i.test(id)) || ids[0]
  } catch { return 'claude-sonnet-4-5' }
}
async function ask(model, content, max = 5000) {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST', headers: HEADERS,
    body: JSON.stringify({ model, max_tokens: max, messages: [{ role: 'user', content }] }),
  })
  const d = await r.json()
  if (d.error) throw new Error(JSON.stringify(d.error))
  return { text: d.content.map((b) => b.text || '').join(''), stop: d.stop_reason }
}
const parse = (s) => JSON.parse((s.match(/\{[\s\S]*\}/) || [s])[0])

const model = await pickModel()
const prompt =
`Đây là ảnh chụp một trang bài tập Toán tiểu học Việt Nam, gồm phần IN SẴN và phần HỌC SINH VIẾT TAY. Ảnh có thể bị xoay nghiêng.
Hãy:
1) Xác định subject, grade, topic và danh sách concepts (khái niệm) xuất hiện trên trang.
2) Đọc các câu HỌC SINH ĐÃ LÀM (chữ viết tay): ghi lại câu trả lời của học sinh đúng như đọc được, tự tính đáp án đúng, rồi kết luận đúng/sai. Nếu chữ không đọc rõ, ghi "không đọc rõ".
Trả về DUY NHẤT JSON:
{"subject":"","grade":"","topic":"","concepts":[""],"baiLam":[{"cau":"","traLoiHocSinh":"","dapAnDung":"","ketQua":"đúng|sai|không đọc rõ","nhanXet":""}]}
Tối đa 6 mục baiLam, chọn câu học sinh có viết. nhanXet ngắn (≤ 15 từ). Tiếng Việt. Chỉ JSON.`

const out = await ask(model, [
  { type: 'image', source: { type: 'base64', media_type: MEDIA, data: b64 } },
  { type: 'text', text: prompt },
])
console.log('MODEL:', model, '| stop:', out.stop)
try { console.log(JSON.stringify(parse(out.text), null, 2)) }
catch (e) { console.log('--- RAW (parse failed) ---\n' + out.text) }
