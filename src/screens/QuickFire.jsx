import { useState, useEffect, useRef } from 'react'
import { BackHeader } from '../components.jsx'
import { nextMastery } from '../lib/memory.js'
import { fmt } from '../lib/num.js'
import { createActiveTimer } from '../lib/stats.js'
import { CONCEPT_NAME } from '../data/content.js'

const DURATION = 60

export default function QuickFire({ questions, mem, title = 'Quick Fire', onFinish, onExit }) {
  const [index, setIndex] = useState(0)
  const [timeLeft, setTimeLeft] = useState(DURATION)
  const [score, setScore] = useState(0)
  const [combo, setCombo] = useState(0)
  const [flash, setFlash] = useState(null)
  const [pulse, setPulse] = useState(null)
  const [gain, setGain] = useState(null)
  const [locked, setLocked] = useState(false)
  const resultsRef = useRef({})
  const scoreRef = useRef(0)
  const doneRef = useRef(false)
  const gainId = useRef(0)
  const activeTimer = useRef(createActiveTimer())

  const finish = () => {
    if (doneRef.current) return
    doneRef.current = true
    const rs = resultsRef.current
    const corr = Object.values(rs).reduce((s, r) => s + r.correct, 0)
    const ans = Object.values(rs).reduce((s, r) => s + r.correct + r.wrong, 0)
    onFinish({ total: Math.max(ans, 1), correct: corr, score: scoreRef.current, activeSeconds: activeTimer.current.get() }, rs)
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
    activeTimer.current.step()
    const ok = i === q.answer
    setFlash({ i, ok })
    setPulse(ok ? 'ok' : 'no')
    if (ok) {
      const newCombo = combo + 1
      const gained = 100 + (newCombo - 1) * 20
      setCombo(newCombo)
      const ns = scoreRef.current + gained
      scoreRef.current = ns
      setScore(ns)
      gainId.current += 1
      setGain({ amt: gained, id: gainId.current })
    } else {
      setCombo(0)
    }
    const key = q.concept
    const prev = resultsRef.current[key] ||
      { correct: 0, wrong: 0, mastery: (mem.find((c) => c.id === key || c.name === key)?.mastery ?? 55), label }
    resultsRef.current = {
      ...resultsRef.current,
      [key]: {
        correct: prev.correct + (ok ? 1 : 0), wrong: prev.wrong + (ok ? 0 : 1),
        mastery: nextMastery(prev.mastery, { correct: ok, usedHint: false }), label,
      },
    }
    setTimeout(() => {
      setPulse(null)
      if (doneRef.current) return
      if (index + 1 >= questions.length) { finish(); return }
      activeTimer.current.reset()
      setIndex(index + 1); setFlash(null); setLocked(false)
    }, 480)
  }

  const optClass = (i) => {
    let c = 'opt'
    if (flash) { if (i === q.answer) c += ' correct'; else if (i === flash.i) c += ' wrong' }
    return c
  }

  return (
    <div className={'screen qf' + (pulse ? ' pulse-' + pulse : '')}>
      <BackHeader title={title} onBack={onExit} />
      <div className="qf-hud">
        <div className={'qf-timer' + (timeLeft <= 10 ? ' low' : '')}>⏱ {timeLeft}</div>
        <div className="qf-scorebox">
          <div className="qf-score">{fmt(score)}</div>
          {combo >= 2 && <div className="qf-combo">🔥 x{combo}</div>}
        </div>
      </div>
      <div className="qf-bar"><span style={{ width: (timeLeft / DURATION) * 100 + '%' }} /></div>
      <div className="qf-qwrap">
        {gain && <div className="gain-pop" key={gain.id}>+{gain.amt}</div>}
        <div className="qtag">{label}</div>
        <h2 className="question">{q.q}</h2>
      </div>
      <div className="opts">
        {q.options.map((o, i) => (
          <button key={i} className={optClass(i)} onClick={() => answer(i)} disabled={locked}>{o}</button>
        ))}
      </div>
      <p className="qf-note">Đúng liên tiếp để nhân combo 🔥</p>
    </div>
  )
}
