// DEMO: AI thật đọc ảnh bài học → tách khái niệm → tự sinh câu hỏi (có tự kiểm tra).
// Cách chạy:  ANTHROPIC_API_KEY=sk-ant-... node scripts/ai-extract.mjs [đường-dẫn-ảnh]
// Trong bản thật, logic này sẽ nằm trong một hàm backend (giấu khóa API), không gọi từ trình duyệt.

import fs from 'node:fs'

const KEY = process.env.ANTHROPIC_API_KEY
if (!KEY) { console.error('❌ Thiếu ANTHROPIC_API_KEY'); process.exit(1) }

const imgPath = process.argv[2] || 'scripts/sample-worksheet.png'
const b64 = fs.readFileSync(imgPath).toString('base64')
const ext = imgPath.toLowerCase().split('.').pop()
const MEDIA = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : ext === 'gif' ? 'image/gif' : 'image/jpeg'

const API = 'https://api.anthropic.com/v1/messages'
const HEADERS = { 'x-api-key': KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' }

async function pickModel() {
  try {
    const r = await fetch('https://api.anthropic.com/v1/models', { headers: HEADERS })
    const d = await r.json()
    const ids = (d.data || []).map((m) => m.id)
    return ids.find((id) => /sonnet/i.test(id)) || ids.find((id) => /haiku/i.test(id)) || ids[0]
  } catch { return 'claude-sonnet-4-5' }
}

async function ask(model, content, max = 1800) {
  const r = await fetch(API, {
    method: 'POST', headers: HEADERS,
    body: JSON.stringify({ model, max_tokens: max, messages: [{ role: 'user', content }] }),
  })
  const d = await r.json()
  if (d.error) throw new Error(JSON.stringify(d.error))
  return d.content.map((b) => b.text || '').join('')
}

function parseJSON(s) {
  const m = s.match(/\{[\s\S]*\}/)
  return JSON.parse(m ? m[0] : s)
}

const model = await pickModel()
console.log('🧠 Model:', model, '\n')

// BƯỚC 1 — AI đọc ảnh và hiểu nội dung
const extractPrompt =
`Đây là ảnh một phiếu/bài tập của học sinh tiểu học Việt Nam.
Đọc kỹ và trả về DUY NHẤT một JSON:
{"subject":"...","grade":"...","topic":"...","concepts":[{"name":"...","difficulty":"Cơ bản|Nâng cao","importance":"Rất quan trọng|Quan trọng|Bình thường"}]}
Tiếng Việt. Không viết gì ngoài JSON.`

const ex = await ask(model, [
  { type: 'image', source: { type: 'base64', media_type: MEDIA, data: b64 } },
  { type: 'text', text: extractPrompt },
])
const extracted = parseJSON(ex)
console.log('===== AI ĐỌC ĐƯỢC GÌ TỪ ẢNH =====')
console.log(JSON.stringify(extracted, null, 2), '\n')

// BƯỚC 2 — AI tự sinh câu hỏi mới + tự kiểm tra đáp án
const names = extracted.concepts.map((c) => c.name).join(', ')
const genPrompt =
`Môn ${extracted.subject}, lớp ${extracted.grade || ''}, chủ đề "${extracted.topic}". Các khái niệm: ${names}.
Tạo 4 câu hỏi trắc nghiệm MỚI (khác bài trong ảnh), mỗi câu 4 lựa chọn.
QUAN TRỌNG: với mỗi câu, tự kiểm tra kỹ để chắc chắn đáp án đúng.
Trả DUY NHẤT một JSON:
{"questions":[{"concept":"...","q":"...","options":["..","..","..",".."],"answer":<chỉ số 0-3>,"explain":"...","daKiemTra":true}]}
Tiếng Việt, nội dung và đáp án phải chính xác. Không viết gì ngoài JSON.`

const gen = await ask(model, [{ type: 'text', text: genPrompt }], 2200)
const questions = parseJSON(gen)
console.log('===== AI TỰ TẠO CÂU HỎI MỚI =====')
console.log(JSON.stringify(questions, null, 2))
