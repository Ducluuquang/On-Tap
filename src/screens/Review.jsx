import { useState } from 'react'
import { BackHeader } from '../components.jsx'
import { nextMastery } from '../lib/memory.js'
import { CONCEPT_NAME } from '../data/content.js'

export default function Review({ questions, mem, title = 'Ôn tập hôm nay', onFinish, onExit }) {
  const [index, setIndex] = useState(0)
  const [picked, setPicked] = useState(null)
  const [status, setStatus] = useState('ask') // ask | wrong1 | resolved
  const [triedWrong, setTriedWrong] = useState(false)
  const [usedHint, setUsedHint] = useState(false)
  const [outcome, setOutcome] = useState(null)
  const [results, setResults] = useState({})
  const [solved, setSolved] = useState(0)

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
  const startMastery = () =>
    results[q.concept]?.mastery ?? (mem.find((c) => c.id === q.concept || c.name === q.concept)?.mastery ?? 55)

  function choose(i) {
    if (status !== 'ask') return
    setPicked(i)
    if (i === q.answer) { setOutcome('correct'); setStatus('resolved') }
    else if (!triedWrong) { setTriedWrong(true); setStatus('wrong1') }
    else { setOutcome('wrong'); setStatus('resolved') }
  }
  function retry() { setUsedHint(true); setPicked(null); setStatus('ask') }
  function reveal() { setOutcome('wrong'); setStatus('resolved') }

  function next() {
    const key = q.concept
    const cur = results[key] || { correct: 0, wrong: 0, mastery: startMastery(), label }
    const isCorrect = outcome === 'correct'
    const updated = {
      correct: cur.correct + (isCorrect ? 1 : 0),
      wrong: cur.wrong + (isCorrect ? 0 : 1),
      mastery: nextMastery(cur.mastery, { correct: isCorrect, usedHint }),
      label,
    }
    const newResults = { ...results, [key]: updated }
    const newSolved = solved + (isCorrect ? 1 : 0)
    setResults(newResults)
    setSolved(newSolved)

    if (index + 1 >= questions.length) {
      onFinish({ total: questions.length, correct: newSolved }, newResults)
      return
    }
    setIndex(index + 1); setPicked(null); setStatus('ask')
    setTriedWrong(false); setUsedHint(false); setOutcome(null)
  }

  const optClass = (i) => {
    let c = 'opt'
    if (status === 'resolved') {
      if (i === q.answer) c += ' correct'
      else if (i === picked) c += ' wrong'
    } else if (picked === i) c += ' picked'
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
          <button key={i} className={optClass(i)} onClick={() => choose(i)} disabled={status === 'resolved'}>{o}</button>
        ))}
      </div>

      {status === 'wrong1' && (
        <div className="fb fb-hint">
          <b>Chưa đúng — thử lại nhé.</b>
          {q.hint && <p>Gợi ý: {q.hint}</p>}
          <div className="fb-actions">
            <button className="cta small" onClick={retry}>Thử lại</button>
            <button className="ghost small" onClick={reveal}>Xem đáp án</button>
          </div>
        </div>
      )}

      {status === 'resolved' && (
        <div className={'fb ' + (outcome === 'correct' ? 'fb-ok' : 'fb-no')}>
          <b>{outcome === 'correct' ? (usedHint ? 'Đúng rồi! 👏' : 'Chính xác! 🎉') : 'Đáp án đúng đã hiện ở trên.'}</b>
          {q.explain && <p>{q.explain}</p>}
          <button className="cta" onClick={next}>
            {index + 1 >= questions.length ? 'Xem kết quả' : 'Câu tiếp theo'}
          </button>
        </div>
      )}
    </div>
  )
}
