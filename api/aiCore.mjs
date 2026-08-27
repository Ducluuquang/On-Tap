// Lõi AI dùng chung cho backend (serverless) và script kiểm thử.
// Giữ khóa API ở phía máy chủ — KHÔNG bao giờ để lộ ra trình duyệt.

const API = 'https://api.anthropic.com/v1/messages'
const MODELS = 'https://api.anthropic.com/v1/models'
const H = (key) => ({ 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' })

let cachedModel = null
export async function pickModel(key) {
  if (cachedModel) return cachedModel
  try {
    const r = await fetch(MODELS, { headers: H(key) })
    const d = await r.json()
    const ids = (d.data || []).map((m) => m.id)
    cachedModel = ids.find((i) => /sonnet/i.test(i)) || ids.find((i) => /haiku/i.test(i)) || ids[0]
  } catch { cachedModel = 'claude-sonnet-4-5' }
  return cachedModel
}

async function ask(key, content, max = 2500) {
  const model = await pickModel(key)
  const r = await fetch(API, {
    method: 'POST', headers: H(key),
    body: JSON.stringify({ model, max_tokens: max, messages: [{ role: 'user', content }] }),
  })
  const d = await r.json()
  if (d.error) throw new Error(d.error.message || JSON.stringify(d.error))
  return d.content.map((b) => b.text || '').join('')
}

const parseJSON = (s) => JSON.parse((s.match(/\{[\s\S]*\}/) || [s])[0])

// Đọc MỘT hoặc NHIỀU ảnh/file (PDF) bài học → tách khái niệm.
// items: [{ type:'image'|'document', b64, media }]. Cũng nhận cách gọi cũ (imageB64, media).
export async function extractConcepts(key, items, mediaLegacy = 'image/jpeg') {
  const list = Array.isArray(items)
    ? items
    : [{ type: 'image', b64: items, media: mediaLegacy }]
  const blocks = list
    .filter((it) => it && it.b64)
    .map((it) => (it.type === 'document'
      ? { type: 'document', source: { type: 'base64', media_type: it.media || 'application/pdf', data: it.b64 } }
      : { type: 'image', source: { type: 'base64', media_type: it.media || 'image/jpeg', data: it.b64 } }))
  const many = blocks.length > 1
  const prompt =
`Đây là ${many ? `${blocks.length} ảnh/trang` : 'ảnh một trang'} bài/phiếu bài tập của học sinh tiểu học Việt Nam (có thể bị xoay).${many ? ' Các trang có thể cùng một bài hoặc nhiều bài khác nhau — tổng hợp lại.' : ''}
Đọc và trả về DUY NHẤT JSON:
{"subject":"","grade":"","topic":"","concepts":[{"name":"","difficulty":"Cơ bản|Nâng cao","importance":"Rất quan trọng|Quan trọng|Bình thường"}]}
Tối đa ${many ? 10 : 6} khái niệm, gộp trùng lặp. Tiếng Việt. Chỉ JSON.`
  const out = await ask(key, [...blocks, { type: 'text', text: prompt }], many ? 2000 : 1200)
  return parseJSON(out)
}

// Đọc nội dung con GÕ vào (mô tả bài học) → tách khái niệm.
export async function extractFromText(key, text) {
  const prompt =
`Một học sinh tiểu học Việt Nam mô tả nội dung vừa học ở trường: "${text}".
Suy ra và trả về DUY NHẤT JSON:
{"subject":"","grade":"","topic":"","concepts":[{"name":"","difficulty":"Cơ bản|Nâng cao","importance":"Rất quan trọng|Quan trọng|Bình thường"}]}
Tối đa 6 khái niệm, đúng với mô tả. Tiếng Việt. Chỉ JSON.`
  const out = await ask(key, [{ type: 'text', text: prompt }], 1200)
  return parseJSON(out)
}

// Chấm câu trả lời TỰ ĐIỀN: hiểu các cách diễn đạt/đọc khác nhau nhưng cùng nghĩa.
export async function judgeAnswer(key, { question = '', correct = '', answer = '' }) {
  const prompt =
`Học sinh tiểu học Việt Nam làm bài (tự gõ đáp án, không có sẵn lựa chọn).
Câu hỏi: "${question}"
Đáp án đúng (mẫu): "${correct}"
Học sinh trả lời: "${answer}"

Câu trả lời của học sinh có ĐÚNG về GIÁ TRỊ / NỘI DUNG không?
- CHẤP NHẬN mọi cách diễn đạt/đọc khác nhau nhưng cùng nghĩa. Ví dụ: số 4 đọc "bốn" hay "tư" đều đúng; "nghìn"="ngàn"; "linh"="lẻ" (VD "năm trăm linh bảy"="năm trăm lẻ bảy"); "1/2"="một phần hai"="một nửa"; thiếu/thừa dấu cách, viết hoa/thường, thứ tự trình bày khác nhau; số viết bằng chữ hay bằng chữ số.
- KHÔNG chấp nhận nếu SAI giá trị/nội dung (đọc/tính sai con số, sai ý).
Trả về DUY NHẤT JSON: {"correct": true, "note": "giải thích RẤT ngắn bằng tiếng Việt (≤14 từ)"}
Chỉ JSON.`
  const out = await ask(key, [{ type: 'text', text: prompt }], 300)
  return parseJSON(out)
}

// Sinh câu hỏi ôn tập cho các khái niệm (tự kiểm tra đáp án).
export async function generateQuestions(key, { subject = 'Toán', grade = '', topic = '', concepts = [], count = 6 }) {
  const names = concepts.map((c) => (typeof c === 'string' ? c : c.name)).join(', ')
  const prompt =
`Môn ${subject}, lớp ${grade}, chủ đề "${topic}". Các khái niệm: ${names}.
Tạo ${count} câu hỏi trắc nghiệm cho học sinh ôn tập, mỗi câu 4 lựa chọn.
Với mỗi câu, tự kiểm tra kỹ để đáp án chắc chắn đúng.
Trả DUY NHẤT JSON:
{"questions":[{"concept":"","q":"","options":["","","",""],"answer":0,"explain":"","hint":""}]}
"answer" là chỉ số 0-3 của đáp án đúng. Tiếng Việt, nội dung chính xác. Chỉ JSON.`
  const max = Math.min(8000, 1600 + count * 320)
  const out = await ask(key, [{ type: 'text', text: prompt }], max)
  return parseJSON(out).questions
}

// Chấm một trang bài con ĐÃ LÀM (đọc chữ viết tay, kết luận đúng/sai, gán khái niệm).
export async function gradeHomework(key, imageB64, media = 'image/jpeg') {
  const prompt =
`Đây là ảnh một trang bài tập của học sinh tiểu học Việt Nam ĐÃ LÀM (có chữ viết tay), có thể bị xoay.
Đọc các câu học sinh đã làm; tự tính đáp án đúng; kết luận đúng/sai. Nếu chữ không rõ ghi "không đọc rõ".
Gán cho mỗi câu một "concept" (khái niệm) ngắn gọn để hệ thống biết con yếu phần nào.
Trả về DUY NHẤT JSON:
{"subject":"","topic":"","baiLam":[{"cau":"","concept":"","traLoiHocSinh":"","dapAnDung":"","ketQua":"đúng|sai|không đọc rõ","nhanXet":""}]}
Tối đa 6 mục, chọn câu con có viết. nhanXet ngắn (≤ 12 từ). Tiếng Việt. Chỉ JSON.`
  const out = await ask(key, [
    { type: 'image', source: { type: 'base64', media_type: media, data: imageB64 } },
    { type: 'text', text: prompt },
  ], 5000)
  return parseJSON(out)
}
