import { useState, useRef } from 'react'
import { BackHeader } from '../components.jsx'
import { nextMastery } from '../lib/memory.js'
import { createActiveTimer } from '../lib/stats.js'
import { localMatch } from '../lib/answerMatch.js'
import { judgeAnswer } from '../lib/aiClient.js'
import { CONCEPT_NAME } from '../data/content.js'

// Tự ĐIỀN đáp án — con phải tự nghĩ ra kết quả rồi gõ vào.
// Chấm 2 lớp: (1) so khớp thông minh trên máy (nhanh, hiểu bốn/tư, linh/lẻ, nghìn/ngàn…);
// (2) nếu chưa khớp thì để AI chấm xem có cùng nghĩa không rồi mới kết luận.
export default function TypedReview({ questions, mem, title = 'Điền đáp án', onFinish, onExit }) {
  const [index, setIndex] = useState(0)
  const [val, setVal] = useState('')
  const [resolved, setResolved] = useState(false)
  const [checking, setChecking] = useState(false)
  const [ok, setOk] = useState(false)
  const [note, setNote] = useState('')
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

  async function check() {
    if (resolved || checking || !val.trim()) return
    timer.current.step()
    // Lớp 1: so khớp trên máy (tức thì)
    if (localMatch(val, correctText)) { setOk(true); setNote(''); setResolved(true); return }
    // Lớp 2: nhờ AI chấm cùng nghĩa
    setChecking(true)
    try {
      const r = await judgeAnswer({ question: q.q, correct: correctText, answer: val.trim() })
      setOk(!!r.correct); setNote(r.note || '')
    } catch {
      setOk(false); setNote('') // AI chưa sẵn sàng — coi như chưa đúng, vẫn hiện đáp án mẫu
    }
    setChecking(false); setResolved(true)
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
    setIndex(index + 1); setVal(''); setResolved(false); setOk(false); setNote('')
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
        disabled={resolved || checking}
        autoFocus
        onChange={(e) => setVal(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') (resolved ? next() : check()) }}
      />

      {!resolved ? (
        checking ? (
          <button className="cta" disabled>🤔 AI đang kiểm tra đáp án…</button>
        ) : (
          <button className="cta" disabled={!val.trim()} onClick={check}>Kiểm tra</button>
        )
      ) : (
        <div className={'fb ' + (ok ? 'fb-ok' : 'fb-no')}>
          <b>{ok ? 'Chính xác! 🎉' : 'Chưa đúng.'}</b>
          {ok && note && <p>{note}</p>}
          {!ok && <p>Đáp án đúng: <b>{correctText}</b></p>}
          {q.explain && <p>{q.explain}</p>}
          <button className="cta" onClick={next}>
            {index + 1 >= questions.length ? 'Xem kết quả' : 'Câu tiếp theo'}
          </button>
        </div>
      )}

      <p className="qf-note">Con tự nghĩ ra kết quả rồi gõ vào — cách đọc/viết khác nhau nhưng đúng vẫn được tính ✍️</p>
    </div>
  )
}
