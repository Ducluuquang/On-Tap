import { useState, useRef } from 'react'
import { BackHeader } from '../components.jsx'
import { nextMastery } from '../lib/memory.js'
import { createActiveTimer } from '../lib/stats.js'
import { CONCEPT_NAME } from '../data/content.js'

// Tự ĐIỀN đáp án (không có sẵn lựa chọn) — con phải tự nghĩ ra kết quả rồi gõ vào.
const norm = (s) => String(s).trim().toLowerCase().replace(/\s+/g, ' ').replace(/[.．。,;:!?]+$/, '')
const stripD = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd')
function isMatch(typed, correct) {
  const a = norm(typed), b = norm(correct)
  if (!a) return false
  if (a === b || stripD(a) === stripD(b)) return true
  const na = a.replace(/\s/g, '').replace(',', '.'), nb = b.replace(/\s/g, '').replace(',', '.')
  if (na === nb) return true
  const fa = parseFloat(na), fb = parseFloat(nb)
  return !Number.isNaN(fa) && !Number.isNaN(fb) && fa === fb
}

export default function TypedReview({ questions, mem, title = 'Điền đáp án', onFinish, onExit }) {
  const [index, setIndex] = useState(0)
  const [val, setVal] = useState('')
  const [resolved, setResolved] = useState(false)
  const [ok, setOk] = useState(false)
  const [results, setResults] = useState({})
  const [solved, setSolved] = useState(0)
  const timer = useRef(createActiveTimer())

  if (!questions || questions.length === 0) {
    return (
      <div className="screen center">
        <p className="para">Chưa soạn được câu hỏi. Thử lại nhé.</p>
        <button className="cta small" onClick={onExit}>Về trang chủ</button>
      </div>
    )
  }

  const q = questions[index]
  const label = CONCEPT_NAME[q.concept] || q.concept
  const correctText = q.options[q.answer]

  function check() {
    if (resolved || !val.trim()) return
    timer.current.step()
    setOk(isMatch(val, correctText))
    setResolved(true)
  }

  function next() {
    const key = q.concept
    const cur = results[key] || {
      correct: 0, wrong: 0, label,
      mastery: mem.find((c) => c.id === key || c.name === key)?.mastery ?? 55,
    }
    const updated = {
      correct: cur.correct + (ok ? 1 : 0),
      wrong: cur.wrong + (ok ? 0 : 1),
      mastery: nextMastery(cur.mastery, { correct: ok, usedHint: false }),
      label,
    }
    const newResults = { ...results, [key]: updated }
    const newSolved = solved + (ok ? 1 : 0)
    setResults(newResults); setSolved(newSolved)
    if (index + 1 >= questions.length) {
      onFinish({ total: questions.length, correct: newSolved, activeSeconds: timer.current.get() }, newResults); return
    }
    timer.current.reset()
    setIndex(index + 1); setVal(''); setResolved(false); setOk(false)
  }

  return (
    <div className="screen">
      <BackHeader title={title} onBack={onExit} />
      <div className="qprogress">
        <div className="qbar"><span style={{ width: (index / questions.length) * 100 + '%' }} /></div>
        <span className="qcount">{index + 1}/{questions.length}</span>
      </div>

      <div className="qtag">{label}</div>
      <h2 className="question">{q.q}</h2>

      <input
        className={'typed-in' + (resolved ? (ok ? ' ok' : ' no') : '')}
        placeholder="Gõ đáp án của con…"
        value={val}
        disabled={resolved}
        autoFocus
        onChange={(e) => setVal(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') (resolved ? next() : check()) }}
      />

      {!resolved ? (
        <button className="cta" disabled={!val.trim()} onClick={check}>Kiểm tra</button>
      ) : (
        <div className={'fb ' + (ok ? 'fb-ok' : 'fb-no')}>
          <b>{ok ? 'Chính xác! 🎉' : 'Chưa đúng.'}</b>
          {!ok && <p>Đáp án đúng: <b>{correctText}</b></p>}
          {q.explain && <p>{q.explain}</p>}
          <button className="cta" onClick={next}>
            {index + 1 >= questions.length ? 'Xem kết quả' : 'Câu tiếp theo'}
          </button>
        </div>
      )}

      <p className="qf-note">Con tự nghĩ ra kết quả rồi gõ vào — không có sẵn đáp án để chọn ✍️</p>
    </div>
  )
}
