import { useState, useEffect, useRef } from 'react'
import { BackHeader } from '../components.jsx'
import { nextMastery } from '../lib/memory.js'
import { fmt } from '../lib/num.js'
import { createActiveTimer } from '../lib/stats.js'
import { CONCEPT_NAME } from '../data/content.js'
import { audioCtx, playTick, playHit, playMiss } from '../lib/sound.js'

const DURATION = 60
const LOW_AT = 10 // dưới mốc này bắt đầu "gấp gáp" (đổi màu, rung, tích tắc nhanh)

export default function QuickFire({ questions, mem, title = 'Quick Fire', onFinish, onExit }) {
  const [index, setIndex] = useState(0)
  const [timeLeft, setTimeLeft] = useState(DURATION)
  const [score, setScore] = useState(0)
  const [combo, setCombo] = useState(0)
  const [flash, setFlash] = useState(null)
  const [pulse, setPulse] = useState(null)
  const [gain, setGain] = useState(null)
  const [locked, setLocked] = useState(false)
  const [tickN, setTickN] = useState(0) // tăng mỗi giây để "nảy" số đồng hồ khi gấp gáp
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
    audioCtx() // "đánh thức" âm thanh nếu đã có tương tác
    let t = DURATION
    const id = setInterval(() => {
      t -= 1
      setTimeLeft(Math.max(0, t))
      setTickN((n) => n + 1)
      if (t <= 0) { clearInterval(id); finish(); return }
      playTick(t <= LOW_AT) // tích tắc — nhanh & gấp hơn khi sắp hết giờ
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
    if (ok) playHit(); else playMiss()
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

  const low = timeLeft <= LOW_AT
  const danger = timeLeft <= 5

  return (
    <div className={'screen qf' + (pulse ? ' pulse-' + pulse : '') + (low ? ' qf-low' : '') + (danger ? ' qf-danger' : '')}>
      <BackHeader title={title} onBack={onExit} />
      <div className="qf-hud">
        <div className={'qf-timer' + (low ? ' low pulse-tick' : '')} key={low ? 'lt' + tickN : 'norm'}>
          {low ? '⏰' : '⏱'} {timeLeft}{low ? 's' : ''}
        </div>
        <div className="qf-scorebox">
          <div className="qf-score">{fmt(score)}</div>
          {combo >= 2 && <div className="qf-combo">🔥 x{combo}</div>}
        </div>
      </div>
      <div className={'qf-bar' + (low ? ' urgent' : '')}><span style={{ width: (timeLeft / DURATION) * 100 + '%' }} /></div>
      {low && <div className="qf-hurry">⚡ Nhanh lên nào!</div>}
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
