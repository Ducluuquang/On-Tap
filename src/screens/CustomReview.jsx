import { useState } from 'react'
import { BackHeader } from '../components.jsx'
import { selectConcepts, describeSelection } from '../lib/review.js'
import { subjectsFromMem, subjectDisplayName, subjectModes } from '../lib/subjects.js'

const TIMES = [
  { k: 'week', l: 'Tuần này' }, { k: 'month', l: 'Tháng này' },
  { k: 'two', l: '2 tháng' }, { k: 'three', l: '3 tháng' }, { k: 'all', l: 'Tất cả' },
]
const LEVELS = [
  { k: 'weak', l: 'Yếu nhất' }, { k: 'wrong', l: 'Hay sai' }, { k: 'new', l: 'Chưa ôn' },
  { k: 'notmastered', l: 'Chưa thành thạo' }, { k: 'all', l: 'Tổng hợp' }, { k: 'master', l: 'Master 🏆' },
]
const COUNTS = [10, 15, 20, 25]
// Phong cách học tập: cách con TRẢ LỜI.
const STYLES = [
  { k: 'quiz', l: 'Trắc nghiệm', choice: true },
  { k: 'typed', l: 'Điền đáp án ✍️', choice: false },
  { k: 'finderror', l: 'Tìm lỗi sai 🔎', choice: true },
]
// 6 game vui (đều dạng trắc nghiệm) — xếp 2 hàng.
const GAMES = [
  { k: 'falling', l: 'Thả rơi ⏱' }, { k: 'balloon', l: 'Bắn bóng 🎯' }, { k: 'sushi', l: 'Xếp sushi 🍣' },
  { k: 'boss', l: 'Boss Battle 👾' }, { k: 'quickfire', l: 'Quick Fire ⏱' }, { k: 'mario', l: 'Mario nhảy 🍄' },
]

export default function CustomReview({ mem, onStart, onBack, allowChoice = true }) {
  const subjectList = subjectsFromMem(mem)
  const [subject, setSubject] = useState(subjectList[0]?.name || 'Toán')
  const [time, setTime] = useState('all')
  const [level, setLevel] = useState('weak')
  const [text, setText] = useState('')
  const [count, setCount] = useState(10)
  const [mode, setMode] = useState(allowChoice ? 'quiz' : 'typed')

  // Chỉ ôn trong MÔN đang chọn (không trộn môn khác).
  const memSub = (mem || []).filter((c) => subjectDisplayName(c.subject) === subject)
  // Chế độ chơi phù hợp với môn (vd "Tìm lỗi sai" chỉ cho môn ngôn ngữ).
  const allowed = subjectModes(subject)
  const styles = STYLES.filter((m) => (allowChoice || !m.choice) && allowed.includes(m.k))
  const games = GAMES.filter((g) => allowed.includes(g.k))

  const isMaster = level === 'master'
  const names = selectConcepts(memSub, { time, level, text })

  // Đổi môn: nếu chế độ đang chọn không hợp môn mới thì đưa về mặc định an toàn.
  function pickSubject(s) {
    setSubject(s)
    if (!subjectModes(s).includes(mode)) setMode(allowChoice ? 'quiz' : 'typed')
  }

  function start() {
    onStart({
      title: `${subject} · ${describeSelection({ time, level, text })}`,
      conceptNames: names, count, mode, subject,
      master: isMaster,
      masterText: isMaster ? text.trim() : '',
    })
  }

  return (
    <div className="screen">
      <BackHeader title="Bắt đầu ôn" onBack={onBack} />

      <div className="cr-sec">
        <h3>Chọn môn</h3>
        <div className="chips">
          {subjectList.map((s) => (
            <button key={s.name} className={'chip' + (subject === s.name ? ' on' : '')} onClick={() => pickSubject(s.name)}>
              {s.icon} {s.name}{s.count > 0 ? <em> · {s.count}</em> : ''}
            </button>
          ))}
        </div>
      </div>

      {memSub.length === 0 && (
        <div className="find-hint">📚 Chưa có bài học môn {subject}. Gõ chủ đề muốn ôn ở ô “Yêu cầu cụ thể” bên dưới, hoặc quay lại “Thêm bài học hôm nay”.</div>
      )}

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
          <p className="cr-master-note">🏆 <b>Master</b>: gõ <b>một hoặc nhiều chủ đề</b> (cách nhau bằng dấu phẩy). App ra bài <b>nâng cao &amp; KẾT HỢP</b> bài khó của các chủ đề đó với nhau để con thật sự thành thạo. Có thể chọn thêm từ danh sách bên dưới.</p>
        )}
      </div>

      <div className="cr-sec">
        <h3>Yêu cầu cụ thể</h3>
        <input
          className="cr-input"
          placeholder={isMaster ? 'Nhiều chủ đề, cách nhau bằng dấu phẩy. Vd: nhân số hai chữ số, tìm x, diện tích hình chữ nhật' : 'vd: ôn phần con hay sai, ôn topic yếu nhất…'}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        {memSub.length > 0 && (
          <select
            className="cr-select"
            value=""
            onChange={(e) => {
              const v = e.target.value
              if (!v) return
              // Master: THÊM chủ đề vào danh sách (nối bằng dấu phẩy). Khác: thay thế như cũ.
              if (isMaster) setText((t) => (t.trim() ? t.trim().replace(/[,\s]*$/, '') + ', ' + v : v))
              else setText(v)
            }}
          >
            <option value="">{isMaster ? '— Thêm chủ đề từ bản đồ kiến thức —' : '— Hoặc chọn chủ đề từ bản đồ kiến thức —'}</option>
            {memSub.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
          </select>
        )}
        <p className="cr-hint">
          {isMaster
            ? 'Gõ 1 hoặc nhiều chủ đề (cách nhau bằng dấu phẩy) — App sẽ kết hợp bài khó của các chủ đề. Bỏ trống thì master phần con đang yếu nhất.'
            : 'Gõ yêu cầu sẽ ưu tiên hơn lựa chọn mức độ ở trên.'}
        </p>
      </div>

      <div className="cr-sec">
        <h3>Chọn số câu hỏi</h3>
        <div className="chips">
          {COUNTS.map((n) => (
            <button key={n} className={'chip' + (count === n ? ' on' : '')} onClick={() => setCount(n)}>{n} câu</button>
          ))}
        </div>

        <p className="cr-sub">Phong cách học tập</p>
        <div className={'chips' + (styles.length === 3 ? ' chips-3' : '')}>
          {styles.map((o) => (
            <button key={o.k} className={'chip' + (mode === o.k ? ' on' : '')} onClick={() => setMode(o.k)}>{o.l}</button>
          ))}
        </div>

        {allowChoice && games.length > 0 && (
          <>
            <p className="cr-sub">Games</p>
            <div className="chips chips-2row">
              {games.map((o) => (
                <button key={o.k} className={'chip' + (mode === o.k ? ' on' : '')} onClick={() => setMode(o.k)}>{o.l}</button>
              ))}
            </div>
          </>
        )}
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
