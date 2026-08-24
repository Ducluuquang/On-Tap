import { useState } from 'react'
import { BackHeader } from '../components.jsx'
import { buildReview } from '../lib/mockAI.js'
import { nextMastery } from '../lib/memory.js'
import { CONCEPT_NAME } from '../data/content.js'

export default function Review({ mem, title = 'Ôn tập hôm nay', onFinish, onExit }) {
  const [questions] = useState(() => buildReview(mem, 6))
  const [index, setIndex] = useState(0)
  const [picked, setPicked] = useState(null)
  const [status, setStatus] = useState('ask') // ask | wrong1 | resolved
  const [triedWrong, setTriedWrong] = useState(false)
  const [usedHint, setUsedHint] = useState(false)
  const [outcome, setOutcome] = useState(null) // correct | wrong
  const [results, setResults] = useState({}) // conceptId -> {correct,wrong,mastery}
  const [solved, setSolved] = useState(0)

  const q = questions[index]
  const startMastery = (cid) =>
    results[cid]?.mastery ?? (mem.find((c) => c.id === cid)?.mastery ?? 60)

  function choose(i) {
    if (status !== 'ask') return
    setPicked(i)
    if (i === q.answer) {
      setOutcome('correct')
      setStatus('resolved')
    } else if (!triedWrong) {
      setTriedWrong(true)
      setStatus('wrong1')
    } else {
      setOutcome('wrong')
      setStatus('resolved')
    }
  }

  function retry() {
    setUsedHint(true)
    setPicked(null)
    setStatus('ask')
  }
  function reveal() {
    setOutcome('wrong')
    setStatus('resolved')
  }

  function next() {
    const cid = q.concept
    const cur = results[cid] || { correct: 0, wrong: 0, mastery: startMastery(cid) }
    const isCorrect = outcome === 'correct'
    const updated = {
      correct: cur.correct + (isCorrect ? 1 : 0),
      wrong: cur.wrong + (isCorrect ? 0 : 1),
      mastery: nextMastery(cur.mastery, { correct: isCorrect, usedHint }),
    }
    const newResults = { ...results, [cid]: updated }
    const newSolved = solved + (isCorrect ? 1 : 0)
    setResults(newResults)
    setSolved(newSolved)

    if (index + 1 >= questions.length) {
      onFinish(
        { total: questions.length, correct: newSolved },
        newResults
      )
      return
    }
    setIndex(index + 1)
    setPicked(null)
    setStatus('ask')
    setTriedWrong(false)
    setUsedHint(false)
    setOutcome(null)
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

      <div className="qtag">{CONCEPT_NAME[q.concept]}</div>
      <h2 className="question">{q.q}</h2>

      <div className="opts">
        {q.options.map((o, i) => (
          <button key={i} className={optClass(i)} onClick={() => choose(i)} disabled={status === 'resolved'}>
            {o}
          </button>
        ))}
      </div>

      {status === 'wrong1' && (
        <div className="fb fb-hint">
          <b>Chưa đúng — thử lại nhé.</b>
          <p>Gợi ý: {q.hint}</p>
          <div className="fb-actions">
            <button className="cta small" onClick={retry}>Thử lại</button>
            <button className="ghost small" onClick={reveal}>Xem đáp án</button>
          </div>
        </div>
      )}

      {status === 'resolved' && (
        <div className={'fb ' + (outcome === 'correct' ? 'fb-ok' : 'fb-no')}>
          <b>{outcome === 'correct' ? (usedHint ? 'Đúng rồi! 👏' : 'Chính xác! 🎉') : 'Đáp án đúng đã hiện ở trên.'}</b>
          <p>{q.explain}</p>
          <button className="cta" onClick={next}>
            {index + 1 >= questions.length ? 'Xem kết quả' : 'Câu tiếp theo'}
          </button>
        </div>
      )}
    </div>
  )
}
