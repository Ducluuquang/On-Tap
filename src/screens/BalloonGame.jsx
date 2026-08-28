import { useState, useEffect, useRef, useMemo } from 'react'
import { BackHeader } from '../components.jsx'
import { nextMastery } from '../lib/memory.js'
import { fmt } from '../lib/num.js'
import { createActiveTimer } from '../lib/stats.js'
import { CONCEPT_NAME } from '../data/content.js'
import { audioCtx, playPop, playMiss } from '../lib/sound.js'

// Bắn bóng 🎯 — 4 đáp án là 4 quả bóng đang bay lơ lửng. Chạm ("bắn") trúng bóng
// mang đáp án ĐÚNG để ghi điểm. Đúng liên tiếp được cộng combo. Mỗi câu có 15 giây.
const PER_SEC = 15
const COLORS = ['#e0703a', '#17a08f', '#5b7cf0', '#e0a32f'] // màu bóng theo vị trí

export default function BalloonGame({ questions, mem, title = 'Bắn bóng', onFinish, onExit }) {
  const [index, setIndex] = useState(0)
  const [score, setScore] = useState(0)
  const [combo, setCombo] = useState(0)
  const [timeLeft, setTimeLeft] = useState(PER_SEC)
  const [shot, setShot] = useState(null) // { i, ok } khi đã bắn
  const [gain, setGain] = useState(null)
  const [locked, setLocked] = useState(false)
  const lockedRef = useRef(false)
  const resultsRef = useRef({})
  const scoreRef = useRef(0)
  const doneRef = useRef(false)
  const tickRef = useRef(null)
  const gainId = useRef(0)
  const activeTimer = useRef(createActiveTimer())

  const q = questions && questions[index]
  // Xáo màu/độ trễ bay theo từng câu cho sinh động (đáp án đúng không cố định 1 chỗ).
  const layout = useMemo(
    () => [0, 1, 2, 3].map((i) => ({ color: COLORS[i % COLORS.length], delay: (i * 0.4).toFixed(2), dur: (3.4 + (i % 3) * 0.5).toFixed(2) })),
    [index],
  )

  function record(ok) {
    const key = q.concept
    const prev = resultsRef.current[key] ||
      { correct: 0, wrong: 0, mastery: (mem.find((c) => c.id === key || c.name === key)?.mastery ?? 55), label: CONCEPT_NAME[key] || key }
    resultsRef.current = {
      ...resultsRef.current,
      [key]: {
        correct: prev.correct + (ok ? 1 : 0), wrong: prev.wrong + (ok ? 0 : 1),
        mastery: nextMastery(prev.mastery, { correct: ok, usedHint: false }), label: prev.label,
      },
    }
  }

  const finish = () => {
    if (doneRef.current) return
    doneRef.current = true
    clearInterval(tickRef.current)
    const rs = resultsRef.current
    const corr = Object.values(rs).reduce((s, r) => s + r.correct, 0)
    const ans = Object.values(rs).reduce((s, r) => s + r.correct + r.wrong, 0)
    onFinish({ total: Math.max(ans, 1), correct: corr, score: scoreRef.current, activeSeconds: activeTimer.current.get() }, rs)
  }

  function shoot(picked) {
    if (lockedRef.current || doneRef.current) return
    lockedRef.current = true; setLocked(true)
    activeTimer.current.step()
    clearInterval(tickRef.current)
    const ok = picked != null && picked === q.answer
    setShot({ i: picked, ok })
    if (ok) {
      playPop()
      const newCombo = combo + 1
      const gained = 100 + (newCombo - 1) * 20
      setCombo(newCombo)
      const ns = scoreRef.current + gained; scoreRef.current = ns; setScore(ns)
      gainId.current += 1; setGain({ amt: gained, id: gainId.current })
    } else {
      playMiss(); setCombo(0)
    }
    record(ok)
    setTimeout(() => {
      if (doneRef.current) return
      if (index + 1 >= questions.length) { finish(); return }
      setIndex(index + 1)
    }, 850)
  }

  useEffect(() => {
    if (!questions || !questions.length || doneRef.current) return undefined
    lockedRef.current = false
    setLocked(false); setShot(null); setGain(null); setTimeLeft(PER_SEC)
    activeTimer.current.reset()
    audioCtx() // "đánh thức" âm thanh nếu đã có tương tác
    let t = PER_SEC
    tickRef.current = setInterval(() => {
      t -= 1; setTimeLeft(Math.max(0, t))
      if (t <= 0) { clearInterval(tickRef.current); shoot(null) }
    }, 1000)
    return () => clearInterval(tickRef.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index])

  if (!questions || !questions.length) {
    return (
      <div className="screen center">
        <p className="para">Chưa soạn được câu hỏi.</p>
        <button className="cta small" onClick={onExit}>Về trang chủ</button>
      </div>
    )
  }

  const label = CONCEPT_NAME[q.concept] || q.concept
  const low = timeLeft <= 5

  return (
    <div className={'screen' + (shot && !shot.ok ? ' shake' : '')}>
      <BackHeader title={title} onBack={() => { doneRef.current = true; clearInterval(tickRef.current); onExit() }} />
      <div className="qf-hud">
        <div className={'qf-timer' + (low ? ' low' : '')}>⏱ {timeLeft}s</div>
        <div className="qf-scorebox">
          <div className="qf-score">{fmt(score)}</div>
          {combo >= 2 && <div className="qf-combo">🎯 x{combo}</div>}
        </div>
      </div>

      <div className="qf-qwrap">
        {gain && <div className="gain-pop" key={gain.id}>+{gain.amt}</div>}
        <div className="qtag">{label}</div>
        <h2 className="question bl-q">{q.q}</h2>
      </div>

      <div className="bl-arena">
        <div className="bl-reticle">🎯</div>
        {q.options.map((o, i) => {
          const st = layout[i]
          let cls = 'balloon'
          if (shot) {
            if (i === q.answer) cls += shot.ok && shot.i === i ? ' hit' : ' reveal'
            else if (i === shot.i) cls += ' miss'
            else cls += ' fade'
          }
          return (
            <button
              key={index + '-' + i}
              className={cls}
              style={{ '--bl': st.color, animationDelay: st.delay + 's', animationDuration: st.dur + 's' }}
              onClick={() => shoot(i)}
              disabled={locked}
            >
              <span className="balloon-txt">{o}</span>
              <span className="balloon-knot" />
              <span className="balloon-string" />
            </button>
          )
        })}
      </div>

      <p className="qf-note">Chạm trúng quả bóng có đáp án đúng để bắn nổ! 🎯</p>
    </div>
  )
}
