import { useState } from 'react'
import { BackHeader } from '../components.jsx'
import { selectConcepts, describeSelection } from '../lib/review.js'

const TIMES = [
  { k: 'week', l: 'Tuần này' }, { k: 'month', l: 'Tháng này' },
  { k: 'two', l: '2 tháng' }, { k: 'three', l: '3 tháng' }, { k: 'all', l: 'Tất cả' },
]
const LEVELS = [
  { k: 'weak', l: 'Yếu nhất' }, { k: 'wrong', l: 'Hay sai' }, { k: 'new', l: 'Chưa ôn' },
  { k: 'notmastered', l: 'Chưa thành thạo' }, { k: 'all', l: 'Tổng hợp' },
]
const COUNTS = [10, 15, 20]
const MODES = [
  { k: 'falling', l: 'Thả rơi ⏱' }, { k: 'quiz', l: 'Trắc nghiệm' },
  { k: 'quickfire', l: 'Quick Fire ⏱' }, { k: 'boss', l: 'Boss Battle 👾' },
]

export default function CustomReview({ mem, onStart, onBack }) {
  const [time, setTime] = useState('all')
  const [level, setLevel] = useState('weak')
  const [text, setText] = useState('')
  const [count, setCount] = useState(10)
  const [mode, setMode] = useState('falling')

  const names = selectConcepts(mem, { time, level, text })

  function start() {
    onStart({ title: describeSelection({ time, level, text }), conceptNames: names, count, mode })
  }

  return (
    <div className="screen">
      <BackHeader title="Bắt đầu ôn" onBack={onBack} />

      <div className="cr-sec">
        <h3>Theo thời gian đã học</h3>
        <div className="chips">
          {TIMES.map((o) => (
            <button key={o.k} className={'chip' + (time === o.k ? ' on' : '')} onClick={() => setTime(o.k)}>{o.l}</button>
          ))}
        </div>
      </div>

      <div className="cr-sec">
        <h3>Theo mức độ</h3>
        <div className="chips">
          {LEVELS.map((o) => (
            <button key={o.k} className={'chip' + (level === o.k ? ' on' : '')} onClick={() => { setLevel(o.k); setText('') }}>{o.l}</button>
          ))}
        </div>
      </div>

      <div className="cr-sec">
        <h3>Hoặc gõ yêu cầu</h3>
        <input
          className="cr-input"
          placeholder="vd: ôn phần con hay sai, ôn topic yếu nhất…"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <p className="cr-hint">Gõ yêu cầu sẽ ưu tiên hơn lựa chọn mức độ ở trên.</p>
      </div>

      <div className="cr-sec">
        <h3>Số câu &amp; kiểu chơi</h3>
        <div className="chips">
          {COUNTS.map((n) => (
            <button key={n} className={'chip' + (count === n ? ' on' : '')} onClick={() => setCount(n)}>{n} câu</button>
          ))}
        </div>
        <div className="chips" style={{ marginTop: '10px' }}>
          {MODES.map((o) => (
            <button key={o.k} className={'chip' + (mode === o.k ? ' on' : '')} onClick={() => setMode(o.k)}>{o.l}</button>
          ))}
        </div>
      </div>

      <div className="cr-preview">
        <b>{describeSelection({ time, level, text })}</b>
        <span>{count} câu · {names.length ? names.join(', ') : 'tất cả khái niệm'}</span>
      </div>

      <button className="cta" onClick={start}>Bắt đầu ôn</button>
    </div>
  )
}
