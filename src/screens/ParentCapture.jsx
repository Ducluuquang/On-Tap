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

export default function ParentCapture({ onExtracted, onBack }) {
  const [mode, setMode] = useState('choose') // choose | text
  const [text, setText] = useState('')
  const [reading, setReading] = useState(false)
  const [error, setError] = useState('')

  async function run(fn) {
    setError(''); setReading(true)
    try { onExtracted(withIds(await fn())) }
    catch (err) { setError(err.message || 'Có lỗi xảy ra.'); setReading(false) }
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
          <h2>AI đang đọc bài…</h2>
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
            placeholder={'Gõ tiêu đề / nội dung con vừa học, ví dụ:\n• Toán lớp 4: cộng trừ 2 chữ số\n• Lịch sử lớp 5: cuộc chiến chống Nguyên Mông xâm lược'}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          {error && <div className="err">{error}</div>}
          <button className="cta" disabled={!text.trim()} onClick={() => run(() => extractFromText(text.trim()))}>
            Cho AI đọc và ghi nhớ
          </button>
          <button className="ghost small" onClick={() => { setMode('choose'); setError('') }}>← Chọn cách khác</button>
        </>
      )}
    </div>
  )
}
