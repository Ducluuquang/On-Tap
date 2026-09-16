import { useState } from 'react'
import { BackHeader } from '../components.jsx'
import { gradeImage } from '../lib/aiClient.js'

export default function ParentGrade({ onSaveErrors, onBack }) {
  const [phase, setPhase] = useState('upload') // upload | reading | result
  const [data, setData] = useState(null)
  const [error, setError] = useState('')

  async function handleFile(e) {
    const file = e.target.files && e.target.files[0]
    if (!file) return
    setError(''); setPhase('reading')
    try {
      const res = await gradeImage(file)
      setData(res)
      setPhase('result')
    } catch (err) {
      setError(err.message || 'Có lỗi khi chấm bài.')
      setPhase('upload')
    }
  }

  if (phase === 'reading') {
    return (
      <div className="screen center">
        <div className="reading">
          <div className="spinner" />
          <h2>AI đang chấm bài…</h2>
          <p>Đọc chữ viết tay của con, tính lại và đối chiếu đáp án.</p>
        </div>
      </div>
    )
  }

  if (phase === 'result' && data) {
    const items = data.baiLam || []
    const right = items.filter((x) => x.ketQua === 'đúng').length
    const wrong = items.filter((x) => x.ketQua === 'sai')
    const wrongConcepts = [...new Set(wrong.map((x) => x.concept).filter(Boolean))]
    return (
      <div className="screen">
        <BackHeader title="Kết quả chấm bài" onBack={onBack} />
        <div className="gsum">
          <div><b>{right}/{items.length}</b><span>câu đúng</span></div>
          <div><b>{wrong.length}</b><span>câu sai</span></div>
          <div className="gsum-topic">{data.subject} · {data.topic}</div>
        </div>

        <div className="glist">
          {items.map((x, i) => (
            <div className="gitem" key={i}>
              <div className="gitem-main">
                <b>{x.cau}</b>
                <em>{x.nhanXet}</em>
              </div>
              <span className={'gchip ' + (x.ketQua === 'đúng' ? 'g-ok' : x.ketQua === 'sai' ? 'g-no' : 'g-un')}>
                {x.ketQua}
              </span>
            </div>
          ))}
        </div>

        <button className="cta" disabled={wrongConcepts.length === 0} onClick={() => onSaveErrors(wrongConcepts)}>
          {wrongConcepts.length > 0
            ? `Lưu ${wrongConcepts.length} chỗ sai vào danh sách ôn lại`
            : 'Con làm đúng hết — không có gì cần ôn thêm'}
        </button>
        <button className="ghost" onClick={onBack}>Xong</button>
      </div>
    )
  }

  return (
    <div className="screen">
      <BackHeader title="Chấm bài con đã làm" onBack={onBack} />
      <p className="para">Chụp trang bài con vừa làm xong. AI sẽ đọc, chấm đúng/sai và tự đưa chỗ sai vào danh sách ôn lại.</p>
      <label className="dropzone">
        <div className="drop-ic">✅</div>
        <b>Chụp bài đã làm để chấm</b>
        <span>AI thật sẽ đọc chữ viết tay (cần bản đã đưa lên mạng)</span>
        <input type="file" accept="image/*" capture="environment" onChange={handleFile} hidden />
      </label>
      {error && <div className="err">{error}</div>}
    </div>
  )
}
