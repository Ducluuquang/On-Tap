import { useState } from 'react'
import { BackHeader } from '../components.jsx'
import { SAMPLE_CAPTURES } from '../lib/mockAI.js'
import { extractFromImage, extractFromSample, extractFromText } from '../lib/aiClient.js'

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
  const [tab, setTab] = useState('photo')
  const [text, setText] = useState('')
  const [reading, setReading] = useState(false)
  const [error, setError] = useState('')

  async function run(fn) {
    setError(''); setReading(true)
    try { onExtracted(withIds(await fn())) }
    catch (err) { setError(err.message || 'Có lỗi xảy ra.'); setReading(false) }
  }
  const onFile = (e) => { const f = e.target.files && e.target.files[0]; if (f) run(() => extractFromImage(f)) }

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
      <BackHeader title="Thêm bài học hôm nay" onBack={onBack} />
      <p className="para">Cho AI biết hôm nay con học gì — chụp ảnh bài, hoặc gõ nội dung.</p>

      <div className="tabs">
        <button className={'tab' + (tab === 'photo' ? ' on' : '')} onClick={() => setTab('photo')}>📷 Chụp / tải ảnh</button>
        <button className={'tab' + (tab === 'text' ? ' on' : '')} onClick={() => setTab('text')}>⌨️ Gõ nội dung</button>
      </div>

      {tab === 'photo' ? (
        <>
          <label className="dropzone">
            <div className="drop-ic">📷</div>
            <b>Chụp ảnh hoặc tải bài lên</b>
            <span>Vở ghi · worksheet · sách · bài tập (mỗi lần 1 ảnh)</span>
            <input type="file" accept="image/*" capture="environment" onChange={onFile} hidden />
          </label>
          {error && <div className="err">{error}</div>}
          <div className="or">— hoặc thử nhanh với bài mẫu —</div>
          <div className="samples">
            {SAMPLE_CAPTURES.map((s) => (
              <button key={s.id} className="sample" onClick={() => run(() => extractFromSample(s.id))}>
                <span className="sample-ic">🖼️</span>
                <span className="sample-txt"><b>{s.label}</b><em>{s.subject} · {s.topic} · bản mẫu</em></span>
                <span className="sample-go">→</span>
              </button>
            ))}
          </div>
        </>
      ) : (
        <>
          <textarea
            className="ta"
            rows={4}
            placeholder={'Gõ những gì con vừa học, ví dụ:\n• Toán: quy đồng mẫu số và so sánh phân số\n• Tiếng Anh: thì quá khứ đơn, động từ bất quy tắc\n• Toán trang 45–52, chủ đề phân số'}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          {error && <div className="err">{error}</div>}
          <button className="cta" disabled={!text.trim()} onClick={() => run(() => extractFromText(text.trim()))}>
            Cho AI đọc và ghi nhớ
          </button>
        </>
      )}
    </div>
  )
}
