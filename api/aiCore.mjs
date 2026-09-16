// Lõi AI dùng chung cho backend (serverless) và script kiểm thử.
// Giữ khóa API ở phía máy chủ — KHÔNG bao giờ để lộ ra trình duyệt.

const API = 'https://api.anthropic.com/v1/messages'
const MODELS = 'https://api.anthropic.com/v1/models'
const H = (key) => ({ 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' })

let cachedIds = null
async function modelIds(key) {
  if (cachedIds && cachedIds.length) return cachedIds // CHỈ cache khi lấy được -> tránh kẹt danh sách rỗng vĩnh viễn
  try {
    const r = await fetch(MODELS, { headers: H(key) })
    const d = await r.json()
    const ids = (d.data || []).map((m) => m.id)
    if (ids.length) cachedIds = ids
    return ids
  } catch { return [] }
}
// Chọn model theo tên CÓ SẴN trong tài khoản (tự thích ứng khi Anthropic đổi đời model).
// fast=true: ưu tiên model nhanh cho việc ĐỌC bài. Mặc định: model chính xác để soạn/chấm câu hỏi.
// Fallback dùng model ĐANG CÓ (sonnet-5), KHÔNG hardcode model đã ngừng (sonnet-4-5/haiku-4-5).
export async function pickModel(key, { fast = false } = {}) {
  const ids = await modelIds(key)
  const find = (re) => ids.find((i) => re.test(i))
  if (fast) return find(/haiku/i) || find(/sonnet/i) || find(/fable/i) || ids[0] || 'claude-sonnet-5'
  return find(/sonnet/i) || find(/opus/i) || find(/haiku/i) || ids[0] || 'claude-sonnet-5'
}

async function ask(key, content, max = 2500, { fast = false } = {}) {
  const model = await pickModel(key, { fast })
  // TẮT "thinking": model đời mới (sonnet-5…) mặc định suy nghĩ trước khi trả lời -> CHẬM và
  // ăn hết token nên câu hỏi bị CỤT/thiếu, dẫn tới "Chưa soạn được câu hỏi" (timeout 60s).
  // Tắt đi thì trả JSON thẳng: nhanh hơn nhiều và đủ câu. Vẫn giữ chính xác nhờ quy tắc tự kiểm trong prompt.
  const r = await fetch(API, {
    method: 'POST', headers: H(key),
    body: JSON.stringify({ model, max_tokens: max, thinking: { type: 'disabled' }, messages: [{ role: 'user', content }] }),
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
"subject" phải là ĐÚNG môn của bài (Toán, Tiếng Việt, Tiếng Anh, Khoa học, Lịch sử, Địa lý…). Suy từ NỘI DUNG: bài có số/phép tính/hình = Toán; từ vựng/ngữ pháp tiếng Anh = Tiếng Anh; chính tả/từ loại tiếng Việt = Tiếng Việt. Nếu nhiều môn, chọn môn CHÍNH. Tất cả khái niệm trong 1 lần đọc thuộc CÙNG "subject" này.
Nếu môn TIẾNG ANH: "concepts" gồm các TỪ VỰNG (mỗi từ/cụm là 1 concept, "name" = chính từ tiếng Anh đó, KHÔNG cần ghi nghĩa) và các ĐIỂM NGỮ PHÁP LỚN (vd "Thì hiện tại đơn", "Thì quá khứ đơn"). Môn khác: tách khái niệm như thường.
Tối đa ${many ? 12 : 8} khái niệm (riêng từ vựng tiếng Anh tối đa 15 từ), gộp trùng lặp. "name" bằng tiếng Việt (trừ từ vựng tiếng Anh giữ nguyên tiếng Anh). Chỉ JSON.`
  const out = await ask(key, [...blocks, { type: 'text', text: prompt }], many ? 1500 : 900, { fast: true })
  return parseJSON(out)
}

// Đọc nội dung con GÕ vào (mô tả bài học) → tách khái niệm.
export async function extractFromText(key, text) {
  const prompt =
`Một học sinh tiểu học Việt Nam mô tả nội dung vừa học ở trường: "${text}".
Suy ra và trả về DUY NHẤT JSON:
{"subject":"","grade":"","topic":"","concepts":[{"name":"","difficulty":"Cơ bản|Nâng cao","importance":"Rất quan trọng|Quan trọng|Bình thường"}]}
QUAN TRỌNG: nếu nội dung trên chỉ là một ĐƯỜNG LINK/URL, một chuỗi vô nghĩa, hoặc KHÔNG đủ thông tin để biết bài học gì, hãy trả về đúng {"subject":"","grade":"","topic":"","concepts":[]} — TUYỆT ĐỐI KHÔNG tự bịa chủ đề, đặc biệt KHÔNG tự ý ra chủ đề Toán.
Nếu môn TIẾNG ANH: "concepts" gồm các TỪ VỰNG (mỗi từ/cụm là 1 concept, "name" = chính từ tiếng Anh đó, KHÔNG cần nghĩa) và các ĐIỂM NGỮ PHÁP LỚN (vd "Thì hiện tại đơn"). Môn khác: tách khái niệm như thường.
Tối đa 8 khái niệm (riêng từ vựng tiếng Anh tối đa 12 từ), đúng với mô tả. "name" bằng tiếng Việt (trừ từ vựng tiếng Anh giữ nguyên). Chỉ JSON.`
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

// Chuẩn hoá tên môn về khoá (bản gọn phía máy chủ, KHỚP với src/lib/subjects.js).
export function subjKey(subject) {
  const n = String(subject || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').trim()
  if (n === 'toan' || /(^|\s)(toan|math|mathematics|so hoc)(\s|$)/.test(n)) return 'toan'
  if (/tieng anh|english|anh van|anh ngu/.test(n)) return 'tieng-anh'
  if (/tieng viet|vietnamese|ngu van|chinh ta|tap doc|luyen tu va cau|tap lam van/.test(n)) return 'tieng-viet'
  return 'default'
}

// Quy tắc RA ĐỀ RIÊNG theo môn (giữ độ chính xác đặc thù từng môn).
// Toán, Tiếng Việt, Tiếng Anh có quy tắc kỹ; mọi môn khác dùng khung CHUNG.
export function subjectRules(subject, grade, enLang = 'vi') {
  const k = subjKey(subject)
  if (k === 'toan') {
    return NUM_RULE + `
- Toán: tự giải lại TỪNG BƯỚC để đáp án CHẮC CHẮN đúng; chỉ 1 đáp án đúng; số liệu hợp lớp ${grade}.`
  }
  if (k === 'tieng-viet') {
    return `- Tiếng Việt: hỏi về chính tả, nghĩa của từ, từ loại (danh/động/tính từ), dấu câu, hoặc đọc-hiểu ngắn.
- Chính tả và ngữ pháp phải CHUẨN tiếng Việt; mỗi câu chỉ 1 đáp án đúng rõ ràng, tránh nhiều đáp án cùng đúng.
- Ngữ liệu trong sáng, phù hợp học sinh tiểu học lớp ${grade}.`
  }
  if (k === 'tieng-anh') {
    const askLine = enLang === 'en'
      ? 'Phần YÊU CẦU/câu hỏi VÀ các đáp án đều viết bằng TIẾNG ANH.'
      : 'Phần YÊU CẦU/câu hỏi viết bằng TIẾNG VIỆT cho con dễ hiểu; NHƯNG từ vựng/cụm cần học và 4 ĐÁP ÁN giữ nguyên TIẾNG ANH (vd: «Chọn dạng quá khứ đúng của "go":» rồi 4 đáp án tiếng Anh). Con chỉ cần chọn đáp án đúng.'
    return `- Tiếng Anh (học sinh tiểu học Việt Nam): từ vựng, ngữ pháp cơ bản, mẫu câu, chính tả.
- ${askLine} Phần "explain" giải thích ngắn bằng tiếng Việt.
- Từ vựng/ngữ pháp đúng CHUẨN; chỉ 1 đáp án đúng; độ khó hợp lớp ${grade}.`
  }
  // Khung CHUNG cho mọi môn khác (Khoa học, Lịch sử, Địa lý…).
  return `- Bám SÁT nội dung/khái niệm đang ôn; mỗi câu chỉ có 1 đáp án đúng, rõ ràng, không mơ hồ.
- Nếu là kiến thức dữ kiện/sự kiện, chỉ hỏi điều CHẮC CHẮN đúng và phổ biến trong chương trình tiểu học lớp ${grade}; tránh chi tiết dễ nhầm.`
}

// Quy tắc ĐỘ KHÓ cho chế độ MASTER: bài nâng cao + kết hợp nhiều khái niệm/nhiều bước.
const masterRule = (grade) =>
`YÊU CẦU ĐỘ KHÓ (MASTER — luyện cho THÀNH THẠO):
- Ra bài KHÓ HƠN mức cơ bản: mỗi câu cần NHIỀU BƯỚC tính hoặc KẾT HỢP từ 2 khái niệm/kỹ năng trở lên.
- Đa dạng dạng bài: tính nhiều bước, so sánh, tìm thành phần chưa biết (tìm x, tìm số bị che), toán có lời văn/tình huống thực tế, suy luận. Tránh lặp lại một dạng.
- VẪN nằm trong chương trình tiểu học lớp ${grade} — KHÔNG dùng kiến thức vượt cấp (đại số, lũy thừa/căn nâng cao…). Câu chữ dễ hiểu với học sinh tiểu học.
- Tự giải lại TỪNG BƯỚC để đáp án CHẮC CHẮN đúng trước khi ghi ra.`

// Soạn MỘT đợt câu hỏi (dùng cho chạy song song).
async function genChunk(key, { subject, grade, topic, concepts, format, fast = false, master = false, enLang = 'vi' }, n, salt = '') {
  const names = concepts.map((c) => (typeof c === 'string' ? c : c.name)).join(', ')
  const open = format === 'open'
  const mrule = master ? '\n' + masterRule(grade) : ''
  const subjRule = subjectRules(subject, grade, enLang) // quy tắc ra đề riêng theo môn (kèm ngôn ngữ đề Tiếng Anh)
  // Master + NHIỀU chủ đề: yêu cầu KẾT HỢP các chủ đề trong danh sách vào cùng một bài toán.
  const multi = master && concepts.length > 1
  const combineRule = multi
    ? `\n- KẾT HỢP NHIỀU CHỦ ĐỀ: ưu tiên mỗi bài lồng ghép TỪ 2 CHỦ ĐỀ TRỞ LÊN trong danh sách (${names}) vào cùng một bài toán nhiều bước, để con luyện phối hợp các kỹ năng. Vẫn đúng chương trình lớp ${grade}, câu chữ dễ hiểu.`
    : ''
  // Chống LẶP: mỗi câu một nội dung khác nhau. Với môn ngôn ngữ, cấm hỏi lại cùng một từ.
  const isLang = subjKey(subject) === 'tieng-anh' || subjKey(subject) === 'tieng-viet'
  const distinctRule = isLang
    ? `\n- ĐA DẠNG BẮT BUỘC: mỗi câu về một TỪ VỰNG / ĐIỂM NGỮ PHÁP KHÁC nhau; TUYỆT ĐỐI KHÔNG hỏi lại cùng một từ (vd cùng chữ "trim") ở hai câu trong ${n} câu này.`
    : `\n- ĐA DẠNG: mỗi câu một nội dung/đối tượng/số liệu KHÁC nhau; không hỏi lại cùng một thứ.`
  // BẮT BUỘC đúng chủ đề: tránh lạc đề (đang ôn phép chia lại ra phép nhân, ôn số tự nhiên lại ra phân số…).
  const topicRule =
`QUAN TRỌNG — ĐÚNG CHỦ ĐỀ: CHỈ ra câu luyện đúng các khái niệm đang ôn: ${names} (thuộc chủ đề "${topic}"). TUYỆT ĐỐI KHÔNG ra câu thuộc khái niệm/dạng KHÁC. Ví dụ: đang ôn "ước lượng thương / phép chia" thì KHÔNG hỏi phép nhân hay cách đọc số; đang ôn "số tự nhiên" thì KHÔNG hỏi phân số. Mỗi câu phải trực tiếp luyện đúng các khái niệm trên.`
  const kindOpen = master ? 'câu hỏi NÂNG CAO để học sinh TỰ ĐIỀN đáp án (KHÔNG có lựa chọn sẵn)' : 'câu hỏi để học sinh TỰ ĐIỀN đáp án (KHÔNG có lựa chọn sẵn)'
  const kindChoice = master ? 'câu hỏi trắc nghiệm NÂNG CAO, KẾT HỢP nhiều khái niệm, mỗi câu 4 lựa chọn' : 'câu hỏi trắc nghiệm KHÁC NHAU cho học sinh ôn tập, mỗi câu 4 lựa chọn'
  const prompt = salt + (open
    ? `Môn ${subject}, lớp ${grade}, chủ đề "${topic}". Các khái niệm: ${names}.
Tạo ${n} ${kindOpen}.${mrule}${combineRule}
${topicRule}${distinctRule}
QUY TẮC BẮT BUỘC:
- Mỗi câu phải TỰ CHỨA đầy đủ dữ kiện và chỉ có MỘT đáp án đúng để con tự tính/viết ra.
- TUYỆT ĐỐI KHÔNG dùng dạng "trong các ... sau", "phân số nào", "đáp án nào", "số nào", không liệt kê lựa chọn, không hỏi kiểu chọn 1 trong nhiều. Vì không hiển thị lựa chọn nên câu đó sẽ không trả lời được.
- Câu TỐT: "Rút gọn phân số 6/8 về tối giản.", "Tính 1/5 + 2/5.", "Số 305 040 đọc là gì?", "So sánh 1/2 và 2/3 (điền dấu >, < hoặc =)."
- Câu XẤU (cấm): "Phân số nào tối giản?", "Trong các phân số sau...".
${subjRule}
Với mỗi câu, tự kiểm tra kỹ để đáp án chắc chắn đúng.
Trả DUY NHẤT JSON:
{"questions":[{"concept":"","q":"","answer":"","explain":""}]}
"answer" là đáp án đúng viết ngắn gọn (số, phân số, hoặc cụm từ). "explain" giải thích ngắn gọn ≤20 từ. Tiếng Việt, chính xác. Chỉ JSON.`
    : `Môn ${subject}, lớp ${grade}, chủ đề "${topic}". Các khái niệm: ${names}.
Tạo ${n} ${kindChoice}.${mrule}${combineRule}
${topicRule}${distinctRule}
Trả DUY NHẤT JSON:
{"questions":[{"concept":"","q":"","options":["","","",""],"answer":"","explain":""}]}
QUY TẮC BẮT BUỘC:
- "answer": GHI NGUYÊN VĂN giá trị đáp án đúng, phải TRÙNG KHÍT một trong 4 "options" (KHÔNG ghi số thứ tự 0-3).
- 4 "options" phải KHÁC NHAU rõ ràng và CHỈ có ĐÚNG 1 đáp án đúng. Ba lựa chọn sai phải SAI GIÁ TRỊ thật sự.
- (Toán) Bài ĐỌC SỐ: các lựa chọn sai phải đọc SAI (sai chữ số/giá trị). TUYỆT ĐỐI không tạo lựa chọn chỉ khác CÁCH ĐỌC của đáp án đúng (thêm/bớt "không trăm", "tư"="bốn", "linh"="lẻ", "nghìn"="ngàn") — vì sẽ thành 2 đáp án cùng đúng.
${subjRule}
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
  // fast=false (mặc định): dùng model CHÍNH XÁC để soạn bài (độ tin cậy là ưu tiên số 1).
  // Tăng tốc bằng cách chia NHỎ và chạy SONG SONG nhiều đợt — nhanh mà KHÔNG giảm chính xác.
  const { subject = 'Toán', grade = '', topic = '', concepts = [], count = 6, format = 'choice', fast = false, master = false, enLang = 'vi' } = opts
  const base = { subject, grade, topic, concepts, format, fast, master, enLang }
  // Mã đề NGẪU NHIÊN mỗi lần gọi -> mỗi buổi ôn ra bộ câu KHÁC nhau dù cùng nội dung.
  const vary = Math.random().toString(36).slice(2, 7)
  const freshRule = `(Mã đề ${vary}: hãy ra bộ câu hỏi MỚI và KHÁC các lần ôn trước — đổi số liệu, đổi ngữ cảnh, đổi cách hỏi; tránh trùng lặp) `
  // Đợt nhỏ (3-4 câu) chạy song song -> mỗi đợt xong nhanh, tổng thời gian ngắn hơn nhiều so với 1 đợt lớn.
  // Môn NGÔN NGỮ (Anh/Việt) hay bị LẶP TỪ giữa các đợt song song (vd "trim" lặp 4/10 câu) vì mỗi đợt
  // không "thấy" đợt kia. -> gom thành ĐỢT LỚN để quy tắc "không lặp từ" áp cho cả loạt câu.
  const isLangGen = subjKey(subject) === 'tieng-anh' || subjKey(subject) === 'tieng-viet'
  const CHUNK = isLangGen ? Math.min(Math.max(count, 1), 12) : (count <= 12 ? 3 : 4)
  // Mỗi đợt TỰ THỬ LẠI 1 lần nếu lỗi/rỗng — mạng mobile chập chờn hay làm HỤT câu (1,2,5,7 câu).
  const genOne = async (n, salt) => {
    let r = await genChunk(key, base, n, salt).catch(() => [])
    if (!r || !r.length) r = await genChunk(key, base, n, salt).catch(() => [])
    return r || []
  }
  let all
  if (count <= CHUNK) {
    all = await genOne(count, freshRule)
  } else {
    const sizes = []
    for (let r = count; r > 0; r -= CHUNK) sizes.push(Math.min(CHUNK, r))
    const parts = await Promise.all(
      sizes.map((n, i) => genOne(n, `${freshRule}(Đợt ${i + 1}: ra dạng bài đa dạng) `)),
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
