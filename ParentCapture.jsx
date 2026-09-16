import { useState } from 'react'
import { BackHeader } from '../components.jsx'
import { extractFromFiles, extractFromText } from '../lib/aiClient.js'

function withIds(result) {
  const concepts = (result.concepts || []).map((c, i) => ({
    id: c.id || 'ai-' + i,
    name: c.name,
    difficulty: c.difficulty || 'Cơ bản',
    importance: c.importance || 'Quan trọng',
  }))
  return { subject: result.subject || 'Toán', grade: result.grade || '', topic: result.topic || '', concepts }
}

// Nhận diện khi người dùng DÁN ĐƯỜNG LINK — app chưa mở được nội dung bên trong link,
// nên tuyệt đối KHÔNG để AI đoán bừa ra chủ đề (trước đây dán link lại ra chủ đề Toán random).
function looksLikeLink(t) {
  const s = String(t || '')
  return /(https?:\/\/|www\.)\S+/i.test(s) || /\b[a-z0-9-]+\.[a-z]{2,}\/\S+/i.test(s)
}
const LINK_MSG = 'App chưa mở được nội dung bên trong đường link (nhất là trang game như Wordwall). Anh/chị hãy CHỤP MÀN HÌNH trang đó rồi tải ảnh lên (nút 📷 ở bước trước), hoặc gõ/dán trực tiếp các từ vựng / nội dung vào ô này.'
const EMPTY_MSG = 'Chưa đọc được nội dung bài học từ phần này. Anh/chị chụp màn hình rồi tải ảnh lên, hoặc gõ/dán trực tiếp các từ vựng / nội dung cần học (đừng chỉ dán đường link).'

export default function ParentCapture({ onExtracted, onBack }) {
  const [mode, setMode] = useState('choose') // choose | text
  const [text, setText] = useState('')
  const [reading, setReading] = useState(false)
  const [error, setError] = useState('')

  async function run(fn) {
    setError(''); setReading(true)
    try {
      const res = withIds(await fn())
      // KHÔNG bịa: nếu không tách được khái niệm nào -> báo để chụp ảnh/gõ trực tiếp, không lưu bừa.
      if (!res.concepts.length) { setReading(false); setError(EMPTY_MSG); return }
      onExtracted(res)
    } catch (err) { setError(err.message || 'Có lỗi xảy ra.'); setReading(false) }
  }
  // Gửi nội dung GÕ TAY: chặn nếu là đường link (app chưa đọc được link).
  function submitText() {
    const t = text.trim()
    if (!t) return
    if (looksLikeLink(t)) { setError(LINK_MSG); return }
    run(() => extractFromText(t))
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
