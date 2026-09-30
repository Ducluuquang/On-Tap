import { useState, useRef, useEffect } from 'react'
import { BackHeader, WrongWhy } from '../components.jsx'
import { recordAnswer } from '../lib/memory.js'
import { createActiveTimer } from '../lib/stats.js'
import { CONCEPT_NAME } from '../data/content.js'

// Trắc nghiệm để HỌC: có giải thích. Sai là sai — không cho thử lại.
export default function Review({ questions, mem, title = 'Ôn tập hôm nay', hint = '', onFinish, onExit }) {
  const [index, setIndex] = useState(0)
  const [picked, setPicked] = useState(null)
  const [resolved, setResolved] = useState(false)
  const [results, setResults] = useState({})
  const [solved, setSolved] = useState(0)
  const timer = useRef(createActiveTimer())

  // Nhấn Enter = "Câu tiếp theo" khi đã trả lời xong.
  useEffect(() => {
    if (!resolved) return undefined
    const onKey = (e) => { if (e.key === 'Enter') { e.preventDefault(); next() } }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolved, picked, index])

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
    const newResults = recordAnswer(results, q.concept, isCorrect, label)
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

      {hint && <div className="find-hint">{hint}</div>}
      <div className="qtag">{label}</div>
      <h2 className={'question' + (hint ? ' q-multiline' : '')}>{q.q}</h2>

      <div className="opts">
        {q.options.map((o, i) => (
          <button key={i} className={optClass(i)} onClick={() => choose(i)} disabled={resolved}>{o}</button>
        ))}
      </div>

      {resolved && (
        <div className={'fb ' + (isCorrect ? 'fb-ok' : 'fb-no')}>
          <b>{isCorrect ? 'Chính xác! 🎉' : 'Sai rồi!'}</b>
          {isCorrect
            ? (q.explain && <p>{q.explain}</p>)
            : <WrongWhy picked={q.options[picked]} correct={q.options[q.answer]} explain={q.explain} />}
          <button className="cta" onClick={next}>
            {index + 1 >= questions.length ? 'Xem kết quả' : 'Câu tiếp theo'}
          </button>
        </div>
      )}
    </div>
  )
}
