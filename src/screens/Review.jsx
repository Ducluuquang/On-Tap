import { useState, useRef } from 'react'
import { BackHeader } from '../components.jsx'
import { nextMastery } from '../lib/memory.js'
import { createActiveTimer } from '../lib/stats.js'
import { CONCEPT_NAME } from '../data/content.js'

// Trắc nghiệm để HỌC: có giải thích. Sai là sai — không cho thử lại.
export default function Review({ questions, mem, title = 'Ôn tập hôm nay', onFinish, onExit }) {
  const [index, setIndex] = useState(0)
  const [picked, setPicked] = useState(null)
  const [resolved, setResolved] = useState(false)
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
  const isCorrect = picked === q.answer

  function choose(i) {
    if (resolved) return
    timer.current.step()
    setPicked(i)
    setResolved(true)
  }

  function next() {
    const key = q.concept
    const cur = results[key] || {
      correct: 0, wrong: 0, label,
      mastery: results[key]?.mastery ?? (mem.find((c) => c.id === key || c.name === key)?.mastery ?? 55),
    }
    const updated = {
      correct: cur.correct + (isCorrect ? 1 : 0),
      wrong: cur.wrong + (isCorrect ? 0 : 1),
      mastery: nextMastery(cur.mastery, { correct: isCorrect, usedHint: false }),
      label,
    }
    const newResults = { ...results, [key]: updated }
    const newSolved = solved + (isCorrect ? 1 : 0)
    setResults(newResults); setSolved(newSolved)
    if (index + 1 >= questions.length) {
      onFinish({ total: questions.length, correct: newSolved, activeSeconds: timer.current.get() }, newResults); return
    }
    timer.current.reset()
    setIndex(index + 1); setPicked(null); setResolved(false)
  }

  const optClass = (i) => {
    let c = 'opt'
    if (resolved) {
      if (i === q.answer) c += ' correct'
      else if (i === picked) c += ' wrong'
    }
    return c
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

      <div className="opts">
        {q.options.map((o, i) => (
          <button key={i} className={optClass(i)} onClick={() => choose(i)} disabled={resolved}>{o}</button>
        ))}
      </div>

      {resolved && (
        <div className={'fb ' + (isCorrect ? 'fb-ok' : 'fb-no')}>
          <b>{isCorrect ? 'Chính xác! 🎉' : 'Sai rồi — đáp án đúng đã hiện ở trên.'}</b>
          {q.explain && <p>{q.explain}</p>}
          <button className="cta" onClick={next}>
            {index + 1 >= questions.length ? 'Xem kết quả' : 'Câu tiếp theo'}
          </button>
        </div>
      )}
    </div>
  )
}
