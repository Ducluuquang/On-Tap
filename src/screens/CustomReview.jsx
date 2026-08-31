import { useState } from 'react'
import { BackHeader } from '../components.jsx'
import { selectConcepts, describeSelection } from '../lib/review.js'

const TIMES = [
  { k: 'week', l: 'Tuần này' }, { k: 'month', l: 'Tháng này' },
  { k: 'two', l: '2 tháng' }, { k: 'three', l: '3 tháng' }, { k: 'all', l: 'Tất cả' },
]
const LEVELS = [
  { k: 'weak', l: 'Yếu nhất' }, { k: 'wrong', l: 'Hay sai' }, { k: 'new', l: 'Chưa ôn' },
  { k: 'notmastered', l: 'Chưa thành thạo' }, { k: 'all', l: 'Tổng hợp' }, { k: 'master', l: 'Master 🏆' },
]
const COUNTS = [10, 15, 20]
const ALL_MODES = [
  { k: 'falling', l: 'Thả rơi ⏱', choice: true }, { k: 'quiz', l: 'Trắc nghiệm', choice: true },
  { k: 'quickfire', l: 'Quick Fire ⏱', choice: true }, { k: 'boss', l: 'Boss Battle 👾', choice: true },
  { k: 'balloon', l: 'Bắn bóng 🎯', choice: true }, { k: 'sushi', l: 'Xếp sushi 🍣', choice: true },
  { k: 'typed', l: 'Điền đáp án ✍️', choice: false },
]

export default function CustomReview({ mem, onStart, onBack, allowChoice = true }) {
  const modes = allowChoice ? ALL_MODES : ALL_MODES.filter((m) => !m.choice)
  const [time, setTime] = useState('all')
  const [level, setLevel] = useState('weak')
  const [text, setText] = useState('')
  const [count, setCount] = useState(10)
  const [mode, setMode] = useState(allowChoice ? 'quiz' : 'typed')

  const isMaster = level === 'master'
  const names = selectConcepts(mem, { time, level, text })

  function start() {
    onStart({
      title: describeSelection({ time, level, text }),
      conceptNames: names, count, mode,
      master: isMaster,
      masterText: isMaster ? text.trim() : '',
    })
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
            <button
              key={o.k}
              className={'chip' + (level === o.k ? ' on' : '') + (o.k === 'master' ? ' chip-master' : '')}
              onClick={() => { setLevel(o.k); if (o.k !== 'master') setText('') }}
            >{o.l}</button>
          ))}
        </div>
        {isMaster && (
          <p className="cr-master-note">🏆 <b>Master</b>: App ra bài <b>nâng cao &amp; kết hợp nhiều bước</b> để con thật sự thành thạo chủ đề. Gõ chủ đề, hoặc chọn từ danh sách bên dưới.</p>
        )}
      </div>

      <div className="cr-sec">
        <h3>Yêu cầu cụ thể</h3>
        <input
          className="cr-input"
          placeholder={isMaster ? 'Chủ đề muốn master, vd: nhân số có hai chữ số, bài toán tìm x…' : 'vd: ôn phần con hay sai, ôn topic yếu nhất…'}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        {mem && mem.length > 0 && (
          <select
            className="cr-select"
            value=""
            onChange={(e) => { if (e.target.value) setText(e.target.value) }}
          >
            <option value="">— Hoặc chọn chủ đề từ bản đồ kiến thức —</option>
            {mem.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
          </select>
        )}
        <p className="cr-hint">
          {isMaster
            ? 'Gõ đúng chủ đề con muốn luyện thành thạo. Bỏ trống thì sẽ master phần con đang yếu nhất.'
            : 'Gõ yêu cầu sẽ ưu tiên hơn lựa chọn mức độ ở trên.'}
        </p>
      </div>

      <div className="cr-sec">
        <h3>Số câu &amp; kiểu chơi</h3>
        <div className="chips">
          {COUNTS.map((n) => (
            <button key={n} className={'chip' + (count === n ? ' on' : '')} onClick={() => setCount(n)}>{n} câu</button>
          ))}
        </div>
        <div className="chips" style={{ marginTop: '10px' }}>
          {modes.map((o) => (
            <button key={o.k} className={'chip' + (mode === o.k ? ' on' : '')} onClick={() => setMode(o.k)}>{o.l}</button>
          ))}
        </div>
        {!allowChoice && <p className="cr-hint">Phụ huynh đã tắt trắc nghiệm — con tự nghĩ và điền đáp án ✍️</p>}
      </div>

      <div className="cr-preview">
        <b>{describeSelection({ time, level, text })}</b>
        {isMaster ? (
          <span>{count} câu <b>nâng cao</b> · {text.trim() || (names.length ? names.slice(0, 3).join(', ') : 'phần yếu nhất')}</span>
        ) : (
          <span>{count} câu · {names.length ? names.join(', ') : 'tất cả khái niệm'}</span>
        )}
      </div>

      <button className="cta" onClick={start}>Bắt đầu ôn</button>
    </div>
  )
}
