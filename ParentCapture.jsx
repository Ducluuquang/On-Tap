import { useState } from 'react'
import { BackHeader } from '../components.jsx'
import { SAMPLE_CAPTURES } from '../lib/mockAI.js'
import { extractFromImage, extractFromSample } from '../lib/aiClient.js'

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
  const [reading, setReading] = useState(false)
  const [error, setError] = useState('')

  async function handleFile(e) {
    const file = e.target.files && e.target.files[0]
    if (!file) return
    setError(''); setReading(true)
    try {
      const res = await extractFromImage(file)
      onExtracted(withIds(res))
    } catch (err) {
      setError(err.message || 'Có lỗi khi đọc ảnh.')
      setReading(false)
    }
  }

  async function handleSample(id) {
    setError(''); setReading(true)
    try {
      const res = await extractFromSample(id)
      onExtracted(withIds(res))
    } catch {
      setReading(false)
    }
  }

  if (reading) {
    return (
      <div className="screen center">
        <div className="reading">
          <div className="spinner" />
          <h2>AI đang đọc bài…</h2>
          <p>Nhận diện chữ, hiểu nội dung và tách thành các khái niệm.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="screen">
      <BackHeader title="Bài con học hôm nay" onBack={onBack} />
      <p className="para">Chụp trang vở hoặc phiếu bài tập con vừa học. AI sẽ đọc và ghi nhớ giúp con.</p>

      <label className="dropzone">
        <div className="drop-ic">📷</div>
        <b>Chụp ảnh hoặc tải bài lên</b>
        <span>AI thật sẽ đọc ảnh (cần bản đã đưa lên mạng)</span>
        <input type="file" accept="image/*" capture="environment" onChange={handleFile} hidden />
      </label>

      {error && <div className="err">{error}</div>}

      <div className="or">— hoặc thử nhanh với bài mẫu —</div>
      <div className="samples">
        {SAMPLE_CAPTURES.map((s) => (
          <button key={s.id} className="sample" onClick={() => handleSample(s.id)}>
            <span className="sample-ic">🖼️</span>
            <span className="sample-txt">
              <b>{s.label}</b>
              <em>{s.subject} · {s.topic} · bản mẫu</em>
            </span>
            <span className="sample-go">→</span>
          </button>
        ))}
      </div>
    </div>
  )
}
