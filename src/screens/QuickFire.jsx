import { useState, useEffect, useRef } from 'react'
import { BackHeader } from '../components.jsx'
import { nextMastery } from '../lib/memory.js'
import { CONCEPT_NAME } from '../data/content.js'

const DURATION = 90

export default function QuickFire({ questions, mem, title = 'Quick Fire', onFinish, onExit }) {
  const [index, setIndex] = useState(0)
  const [timeLeft, setTimeLeft] = useState(DURATION)
  const [flash, setFlash] = useState(null)
  const [locked, setLocked] = useState(false)
  const [correct, setCorrect] = useState(0)
  const resultsRef = useRef({})
  const doneRef = useRef(false)

  const finish = () => {
    if (doneRef.current) return
    doneRef.current = true
    const rs = resultsRef.current
    const corr = Object.values(rs).reduce((s, r) => s + r.correct, 0)
    const ans = Object.values(rs).reduce((s, r) => s + r.correct + r.wrong, 0)
    onFinish({ total: Math.max(ans, 1), correct: corr }, rs)
  }

  useEffect(() => {
    if (!questions || !questions.length) return undefined
    const id = setInterval(() => {
      setTimeLeft((t) => { if (t <= 1) { clearInterval(id); finish(); return 0 } return t - 1 })
    }, 1000)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!questions || !questions.length) {
    return (
      <div className="screen center">
        <p className="para">Chưa soạn được câu hỏi.</p>
        <button className="cta small" onClick={onExit}>Về trang chủ</button>
      </div>
    )
  }

  const q = questions[index]
  const label = CONCEPT_NAME[q.concept] || q.concept

  function answer(i) {
    if (locked || doneRef.current) return
    setLocked(true)
    const ok = i === q.answer
    setFlash({ i, ok })
    const key = q.concept
    const prev = resultsRef.current[key] ||
      { correct: 0, wrong: 0, mastery: (mem.find((c) => c.id === key || c.name === key)?.mastery ?? 55), label }
    resultsRef.current = {
      ...resultsRef.current,
      [key]: {
        correct: prev.correct + (ok ? 1 : 0),
        wrong: prev.wrong + (ok ? 0 : 1),
        mastery: nextMastery(prev.mastery, { correct: ok, usedHint: false }),
        label,
      },
    }
    if (ok) setCorrect((c) => c + 1)
    setTimeout(() => {
      if (doneRef.current) return
      if (index + 1 >= questions.length) { finish(); return }
      setIndex(index + 1); setFlash(null); setLocked(false)
    }, 560)
  }

  const optClass = (i) => {
    let c = 'opt'
    if (flash) { if (i === q.answer) c += ' correct'; else if (i === flash.i) c += ' wrong' }
    return c
  }

  return (
    <div className="screen">
      <BackHeader title={title} onBack={onExit} />
      <div className="qf-top">
        <div className={'qf-timer' + (timeLeft <= 10 ? ' low' : '')}>⏱ {timeLeft}s</div>
        <div className="qf-score">✅ {correct} đúng</div>
      </div>
      <div className="qf-bar"><span style={{ width: (timeLeft / DURATION) * 100 + '%' }} /></div>
      <div className="qtag">{label}</div>
      <h2 className="question">{q.q}</h2>
      <div className="opts">
        {q.options.map((o, i) => (
          <button key={i} className={optClass(i)} onClick={() => answer(i)} disabled={locked}>{o}</button>
        ))}
      </div>
      <p className="qf-note">Trả lời càng nhiều càng tốt trước khi hết giờ!</p>
    </div>
  )
}
