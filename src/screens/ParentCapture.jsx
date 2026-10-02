import { useState } from 'react'
import { BackHeader } from '../components.jsx'
import { extractFromFiles, extractFromText } from '../lib/aiClient.js'
import { detectSubject, canonicalSubject } from '../lib/subjects.js'
import { isVagueConcept, groupConcepts } from '../lib/topics.js'

// Chuẩn hoá kết quả AI đọc được + GẮN MÔN TỪ CHÍNH NỘI DUNG NHẬP VÀO.
// - Nội dung có NHÃN MÔN (vd "Tiếng Anh 7: Thì quá khứ đơn") -> lấy ĐÚNG môn đó (không thể nhầm).
// - Không có nhãn -> dùng môn AI nhận ra (chuẩn hoá tên). AI không chắc -> để TRỐNG, phụ huynh chọn ở bước sau.
// - TUYỆT ĐỐI không tự gán "Toán" khi không biết (trước đây là nguồn gây lẫn môn).
function withIds(result, inputText = '') {
  const all = (result.concepts || []).filter((c) => c && String(c.name || '').trim())
  const fromInput = detectSubject(inputText)   // nhãn môn trong chữ phụ huynh/con gõ
  const fromTopic = detectSubject(result.topic) // nhãn môn AI đọc được trên trang (tiêu đề)
  const label = fromInput || fromTopic
  const subject = label ? label.subject : canonicalSubject(result.subject)
  const grade = (label && label.grade) || result.grade || ''
  let topic = String(result.topic || '').trim()
  if (fromTopic && fromTopic.rest) topic = fromTopic.rest.split('\n')[0].trim() // bỏ tiền tố "Tiếng Anh 7:"
  else if (!topic && fromInput && fromInput.rest) topic = fromInput.rest.split('\n')[0].trim().slice(0, 80)
  // BỎ tên CHUNG CHUNG ("Từ vựng cơ bản", "Ngữ pháp cơ bản", "Ôn tập"…): không phải kiến thức cụ thể.
  // CHỈ GHI MỤC LỚN: câu mẫu / từ lẻ gộp về chủ đề lớn (vd 8 câu đảo ngữ -> "Câu đảo ngữ (Inversion)").
  const grouped = groupConcepts(all.filter((c) => !isVagueConcept(c.name)), { subject, topic })
  const concepts = grouped.filter((c) => !isVagueConcept(c.name)).map((c, i) => ({
    id: 'ai-' + i,
    name: c.name,
    details: c.details || [],
    difficulty: c.difficulty || 'Cơ bản',
    importance: c.importance || 'Quan trọng',
  }))
  return { subject, grade, topic, concepts, onlyVague: !concepts.length && all.length > 0, subjectFrom: label ? 'label' : (subject ? 'ai' : '') }
}

// Nhận diện khi người dùng DÁN ĐƯỜNG LINK — app chưa mở được nội dung bên trong link,
// nên tuyệt đối KHÔNG để AI đoán bừa ra chủ đề (trước đây dán link lại ra chủ đề Toán random).
function looksLikeLink(t) {
  const s = String(t || '')
  return /(https?:\/\/|www\.)\S+/i.test(s) || /\b[a-z0-9-]+\.[a-z]{2,}\/\S+/i.test(s)
}
const LINK_MSG = 'App chưa mở được nội dung bên trong đường link (nhất là trang game như Wordwall). Anh/chị hãy CHỤP MÀN HÌNH trang đó rồi tải ảnh lên (nút 📷 ở bước trước), hoặc gõ/dán trực tiếp các từ vựng / nội dung vào ô này.'
const EMPTY_MSG = 'Chưa đọc được nội dung bài học từ phần này. Anh/chị chụp màn hình rồi tải ảnh lên, hoặc gõ/dán trực tiếp các từ vựng / nội dung cần học (đừng chỉ dán đường link).'
const VAGUE_MSG = 'Chưa thấy kiến thức CỤ THỂ trong phần này (vd danh sách từ vựng, tên điểm ngữ pháp, dạng toán) — app không lưu mục chung chung như “Từ vựng cơ bản”. Anh/chị gõ rõ nội dung, vd “Tiếng Anh 7: doctor, nurse, teacher” hoặc “Tiếng Anh 7: Thì quá khứ đơn”, hoặc chụp trang bài học.'

export default function ParentCapture({ onExtracted, onBack }) {
  const [mode, setMode] = useState('choose') // choose | text
  const [text, setText] = useState('')
  const [reading, setReading] = useState(false)
  const [error, setError] = useState('')

  async function run(fn, inputText = '') {
    setError(''); setReading(true)
    try {
      const res = withIds(await fn(), inputText)
      // KHÔNG bịa: nếu không tách được khái niệm nào -> báo để chụp ảnh/gõ trực tiếp, không lưu bừa.
      if (!res.concepts.length) { setReading(false); setError(res.onlyVague ? VAGUE_MSG : EMPTY_MSG); return }
      onExtracted(res)
    } catch (err) { setError(err.message || 'Có lỗi xảy ra.'); setReading(false) }
  }
  // Gửi nội dung GÕ TAY: chặn nếu là đường link (app chưa đọc được link).
  function submitText() {
    const t = text.trim()
    if (!t) return
    if (looksLikeLink(t)) { setError(LINK_MSG); return }
    run(() => extractFromText(t), t)
  }
  const onFiles = (e) => {
    const fs = Array.from(e.target.files || [])
    e.target.value = '' // cho phép chọn lại cùng file lần sau
    if (fs.length) run(() => extractFromFiles(fs))
  }

  if (reading) {
    return (
      <div className="screen center">
        <div className="reading">
          <div className="spinner" />
          <h2>Đang đọc bài của con…</h2>
          <p>Hiểu nội dung và tách thành các khái niệm.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="screen">
      <BackHeader title="Thêm bài học hôm nay" onBack={() => (mode === 'text' ? setMode('choose') : onBack())} />
      <p className="para">
        Cung cấp nội dung bài học bằng cách tải ảnh, hoặc file vở ghi, worksheet, sách giáo khoa,
        bài tập về nhà, tài liệu học tập, ghi chú… hoặc gõ tay những gì đã học vào khung bên dưới.
      </p>

      {mode === 'choose' ? (
        <div className="cap-cards">
          <label className="cap-card">
            <span className="cap-ic">📷</span>
            <span className="cap-body">
              <b>Tải ảnh hoặc file bài học lên</b>
              <em>Chọn nhiều ảnh hoặc PDF cùng lúc · vở ghi · worksheet · sách · bài tập</em>
            </span>
            <span className="cap-go">→</span>
            <input type="file" accept="image/*,application/pdf" multiple onChange={onFiles} hidden />
          </label>

          <button className="cap-card" onClick={() => setMode('text')}>
            <span className="cap-ic">⌨️</span>
            <span className="cap-body">
              <b>Gõ tay tiêu đề nội dung đã học</b>
              <em>VD: "Toán lớp 4: cộng trừ 2 chữ số" · "Lịch sử lớp 5: chống Nguyên Mông xâm lược"</em>
            </span>
            <span className="cap-go">→</span>
          </button>

          {error && <div className="err">{error}</div>}
        </div>
      ) : (
        <>
          <textarea
            className="ta"
            rows={5}
            autoFocus
            placeholder={'Gõ / dán nội dung con vừa học (KHÔNG dán đường link), ví dụ:\n• Toán lớp 4: cộng trừ 2 chữ số\n• Tiếng Anh: apple, banana, cat, dog, elephant\n• Lịch sử lớp 5: chống Nguyên Mông xâm lược'}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <p className="cr-hint">🔗 Nếu là đường link (Wordwall, Quizlet…): app chưa đọc được nội dung bên trong link — anh/chị chụp màn hình trang đó rồi <b>tải ảnh lên</b>, app sẽ đọc được.</p>
          {error && <div className="err">{error}</div>}
          <button className="cta" disabled={!text.trim()} onClick={submitText}>
            Đọc và ghi nhớ bài học
          </button>
          <button className="ghost small" onClick={() => { setMode('choose'); setError('') }}>← Chọn cách khác</button>
        </>
      )}
    </div>
  )
}
