// Lõi AI dùng chung cho backend (serverless) và script kiểm thử.
// Giữ khóa API ở phía máy chủ — KHÔNG bao giờ để lộ ra trình duyệt.

const API = 'https://api.anthropic.com/v1/messages'
const MODELS = 'https://api.anthropic.com/v1/models'
const H = (key) => ({ 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' })

let cachedIds = null
async function modelIds(key) {
  if (cachedIds) return cachedIds
  try {
    const r = await fetch(MODELS, { headers: H(key) })
    const d = await r.json()
    cachedIds = (d.data || []).map((m) => m.id)
  } catch { cachedIds = [] }
  return cachedIds
}
// fast=true: ưu tiên model nhanh (haiku) cho việc ĐỌC bài — nhanh hơn nhiều mà vẫn đủ chính xác.
// Mặc định: sonnet (soạn/chấm câu hỏi — cần chính xác cao).
export async function pickModel(key, { fast = false } = {}) {
  const ids = await modelIds(key)
  if (fast) return ids.find((i) => /haiku/i.test(i)) || ids.find((i) => /sonnet/i.test(i)) || ids[0] || 'claude-haiku-4-5'
  return ids.find((i) => /sonnet/i.test(i)) || ids.find((i) => /haiku/i.test(i)) || ids[0] || 'claude-sonnet-4-5'
}

async function ask(key, content, max = 2500, { fast = false } = {}) {
  const model = await pickModel(key, { fast })
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
  const out = await ask(key, [...blocks, { type: 'text', text: prompt }], many ? 1500 : 900, { fast: true })
  return parseJSON(out)
}

// Đọc nội dung con GÕ vào (mô tả bài học) → tách khái niệm.
export async function extractFromText(key, text) {
  const prompt =
`Một học sinh tiểu học Việt Nam mô tả nội dung vừa học ở trường: "${text}".
Suy ra và trả về DUY NHẤT JSON:
{"subject":"","grade":"","topic":"","concepts":[{"name":"","difficulty":"Cơ bản|Nâng cao","importance":"Rất quan trọng|Quan trọng|Bình thường"}]}
Tối đa 6 khái niệm, đúng với mô tả. Tiếng Việt. Chỉ JSON.`
  const out = await ask(key, [{ type: 'text', text: prompt }], 900, { fast: true })
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

// Quy tắc đọc/viết số bằng lời cho ĐÚNG CHUẨN (tránh đề mơ hồ như "năm trăm sáu" = 506 hay 560?).
const NUM_RULE =
`- Khi ĐỌC/VIẾT số bằng lời: đọc ĐẦY ĐỦ, đúng chuẩn tiếng Việt. Chữ số 0 ở hàng chục phải đọc "linh"/"lẻ" (VD 506 = "năm trăm linh sáu", TUYỆT ĐỐI KHÔNG viết "năm trăm sáu"). Hàng chục khác 0 phải có "mươi" (VD 560 = "năm trăm sáu mươi"). Không đọc tắt gây hiểu nhầm giữa hai số khác nhau.`

// Quy tắc ĐỘ KHÓ cho chế độ MASTER: bài nâng cao + kết hợp nhiều khái niệm/nhiều bước.
const masterRule = (grade) =>
`YÊU CẦU ĐỘ KHÓ (MASTER — luyện cho THÀNH THẠO):
- Ra bài KHÓ HƠN mức cơ bản: mỗi câu cần NHIỀU BƯỚC tính hoặc KẾT HỢP từ 2 khái niệm/kỹ năng trở lên.
- Đa dạng dạng bài: tính nhiều bước, so sánh, tìm thành phần chưa biết (tìm x, tìm số bị che), toán có lời văn/tình huống thực tế, suy luận. Tránh lặp lại một dạng.
- VẪN nằm trong chương trình tiểu học lớp ${grade} — KHÔNG dùng kiến thức vượt cấp (đại số, lũy thừa/căn nâng cao…). Câu chữ dễ hiểu với học sinh tiểu học.
- Tự giải lại TỪNG BƯỚC để đáp án CHẮC CHẮN đúng trước khi ghi ra.`

// Soạn MỘT đợt câu hỏi (dùng cho chạy song song).
async function genChunk(key, { subject, grade, topic, concepts, format, fast = false, master = false }, n, salt = '') {
  const names = concepts.map((c) => (typeof c === 'string' ? c : c.name)).join(', ')
  const open = format === 'open'
  const mrule = master ? '\n' + masterRule(grade) : ''
  // BẮT BUỘC đúng chủ đề: tránh lạc đề (đang ôn phép chia lại ra phép nhân, ôn số tự nhiên lại ra phân số…).
  const topicRule =
`QUAN TRỌNG — ĐÚNG CHỦ ĐỀ: CHỈ ra câu luyện đúng các khái niệm đang ôn: ${names} (thuộc chủ đề "${topic}"). TUYỆT ĐỐI KHÔNG ra câu thuộc khái niệm/dạng KHÁC. Ví dụ: đang ôn "ước lượng thương / phép chia" thì KHÔNG hỏi phép nhân hay cách đọc số; đang ôn "số tự nhiên" thì KHÔNG hỏi phân số. Mỗi câu phải trực tiếp luyện đúng các khái niệm trên.`
  const kindOpen = master ? 'câu hỏi NÂNG CAO để học sinh TỰ ĐIỀN đáp án (KHÔNG có lựa chọn sẵn)' : 'câu hỏi để học sinh TỰ ĐIỀN đáp án (KHÔNG có lựa chọn sẵn)'
  const kindChoice = master ? 'câu hỏi trắc nghiệm NÂNG CAO, KẾT HỢP nhiều khái niệm, mỗi câu 4 lựa chọn' : 'câu hỏi trắc nghiệm KHÁC NHAU cho học sinh ôn tập, mỗi câu 4 lựa chọn'
  const prompt = salt + (open
    ? `Môn ${subject}, lớp ${grade}, chủ đề "${topic}". Các khái niệm: ${names}.
Tạo ${n} ${kindOpen}.${mrule}
${topicRule}
QUY TẮC BẮT BUỘC:
- Mỗi câu phải TỰ CHỨA đầy đủ dữ kiện và chỉ có MỘT đáp án đúng để con tự tính/viết ra.
- TUYỆT ĐỐI KHÔNG dùng dạng "trong các ... sau", "phân số nào", "đáp án nào", "số nào", không liệt kê lựa chọn, không hỏi kiểu chọn 1 trong nhiều. Vì không hiển thị lựa chọn nên câu đó sẽ không trả lời được.
- Câu TỐT: "Rút gọn phân số 6/8 về tối giản.", "Tính 1/5 + 2/5.", "Số 305 040 đọc là gì?", "So sánh 1/2 và 2/3 (điền dấu >, < hoặc =)."
- Câu XẤU (cấm): "Phân số nào tối giản?", "Trong các phân số sau...".
${NUM_RULE}
Với mỗi câu, tự kiểm tra kỹ để đáp án chắc chắn đúng.
Trả DUY NHẤT JSON:
{"questions":[{"concept":"","q":"","answer":"","explain":""}]}
"answer" là đáp án đúng viết ngắn gọn (số, phân số, hoặc cụm từ). "explain" giải thích ngắn gọn ≤20 từ. Tiếng Việt, chính xác. Chỉ JSON.`
    : `Môn ${subject}, lớp ${grade}, chủ đề "${topic}". Các khái niệm: ${names}.
Tạo ${n} ${kindChoice}.${mrule}
${topicRule}
Trả DUY NHẤT JSON:
{"questions":[{"concept":"","q":"","options":["","","",""],"answer":"","explain":""}]}
QUY TẮC BẮT BUỘC:
- "answer": GHI NGUYÊN VĂN giá trị đáp án đúng, phải TRÙNG KHÍT một trong 4 "options" (KHÔNG ghi số thứ tự 0-3).
- 4 "options" phải KHÁC NHAU rõ ràng và CHỈ có ĐÚNG 1 đáp án đúng. Ba lựa chọn sai phải SAI GIÁ TRỊ thật sự.
- Bài ĐỌC SỐ: các lựa chọn sai phải đọc SAI (sai chữ số/giá trị). TUYỆT ĐỐI không tạo lựa chọn chỉ khác CÁCH ĐỌC của đáp án đúng (thêm/bớt "không trăm", "tư"="bốn", "linh"="lẻ", "nghìn"="ngàn") — vì sẽ thành 2 đáp án cùng đúng.
${NUM_RULE}
- "explain" ≤20 từ, phải khớp với "answer". Tự tính lại để chắc chắn "answer" đúng.
Tiếng Việt, chính xác. Chỉ JSON.`)
  const max = Math.min(4000, (master ? 900 : 700) + n * (master ? 330 : 260))
  const out = await ask(key, [{ type: 'text', text: prompt }], max, { fast })
  return parseJSON(out).questions || []
}

// Bỏ câu trùng nhau (các đợt song song có thể ra câu giống nhau).
function dedupeByQ(list) {
  const seen = new Set(); const out = []
  for (const q of list || []) {
    const k = String((q && q.q) || '').toLowerCase().replace(/\s+/g, ' ').trim()
    if (!k || seen.has(k)) continue
    seen.add(k); out.push(q)
  }
  return out
}

// Sinh câu hỏi ôn tập — chia thành nhiều đợt CHẠY SONG SONG cho nhanh.
// format='open': câu TỰ ĐIỀN (mở, tự chứa) cho chế độ không trắc nghiệm.
export async function generateQuestions(key, opts) {
  // fast=true (mặc định): dùng model NHANH (haiku) để soạn bài — nhanh hơn nhiều, đỡ lỗi quá giờ.
  const { subject = 'Toán', grade = '', topic = '', concepts = [], count = 6, format = 'choice', fast = true, master = false } = opts
  const base = { subject, grade, topic, concepts, format, fast, master }
  // Mã đề NGẪU NHIÊN mỗi lần gọi -> mỗi buổi ôn ra bộ câu KHÁC nhau dù cùng nội dung.
  const vary = Math.random().toString(36).slice(2, 7)
  const freshRule = `(Mã đề ${vary}: hãy ra bộ câu hỏi MỚI và KHÁC các lần ôn trước — đổi số liệu, đổi ngữ cảnh, đổi cách hỏi; tránh trùng lặp) `
  const CHUNK = 5
  let all
  if (count <= CHUNK) {
    // Có bắt lỗi để KHÔNG bao giờ ném ra ngoài (tránh cả buổi ôn bị "Chưa soạn được câu hỏi").
    all = await genChunk(key, base, count, freshRule).catch(() => [])
  } else {
    const sizes = []
    for (let r = count; r > 0; r -= CHUNK) sizes.push(Math.min(CHUNK, r))
    const parts = await Promise.all(
      sizes.map((n, i) => genChunk(key, base, n, `${freshRule}(Đợt ${i + 1}: ra dạng bài đa dạng) `).catch(() => [])),
    )
    all = parts.flat()
  }
  return dedupeByQ(all).slice(0, count)
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
