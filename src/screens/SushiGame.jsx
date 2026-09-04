import { useState, useRef } from 'react'
import { BackHeader } from '../components.jsx'
import { nextMastery } from '../lib/memory.js'
import { fmt } from '../lib/num.js'
import { createActiveTimer } from '../lib/stats.js'
import { CONCEPT_NAME } from '../data/content.js'
import { audioCtx, playDing, playWobble } from '../lib/sound.js'

// Xếp sushi 🍣 — mỗi câu trả lời ĐÚNG sẽ đặt thêm một miếng sushi lên tháp.
// Trả lời đúng liên tiếp → tháp cao dần (combo). Trả lời sai → tháp lung lay, không thêm miếng.
const PIECES = ['🍣', '🍙', '🍤', '🍥', '🍱', '🥟', '🍘', '🍡']

export default function SushiGame({ questions, mem, title = 'Xếp sushi', onFinish, onExit }) {
  const [index, setIndex] = useState(0)
  const [picked, setPicked] = useState(null)
  const [resolved, setResolved] = useState(false)
  const [score, setScore] = useState(0)
  const [combo, setCombo] = useState(0)
  const [stack, setStack] = useState([]) // các miếng sushi đã xếp
  const [wobble, setWobble] = useState(false)
  const [gain, setGain] = useState(null)
  const scoreRef = useRef(0)
  const resultsRef = useRef({})
  const doneRef = useRef(false)
  const gainId = useRef(0)
  const activeTimer = useRef(createActiveTimer())

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
  const isCorrect = picked === q.answer

  const finish = () => {
    if (doneRef.current) return
    doneRef.current = true
    const rs = resultsRef.current
    const corr = Object.values(rs).reduce((s, r) => s + r.correct, 0)
    const ans = Object.values(rs).reduce((s, r) => s + r.correct + r.wrong, 0)
    onFinish({ total: Math.max(ans, 1), correct: corr, score: scoreRef.current, activeSeconds: activeTimer.current.get() }, rs)
  }

  function choose(i) {
    if (resolved || doneRef.current) return
    activeTimer.current.step()
    setPicked(i); setResolved(true)
    audioCtx()
    const ok = i === q.answer
    if (ok) {
      playDing()
      const newCombo = combo + 1
      const gained = 100 + (newCombo - 1) * 20
      setCombo(newCombo)
      const ns = scoreRef.current + gained; scoreRef.current = ns; setScore(ns)
      gainId.current += 1; setGain({ amt: gained, id: gainId.current })
      setStack((s) => [...s, PIECES[s.length % PIECES.length]])
    } else {
      playWobble(); setCombo(0); setWobble(true)
      setTimeout(() => setWobble(false), 500)
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
  }

  function next() {
    if (index + 1 >= questions.length) { finish(); return }
    activeTimer.current.reset()
    setIndex(index + 1); setPicked(null); setResolved(false); setGain(null)
  }

  const optClass = (i) => {
    let c = 'opt sushi-opt'
    if (resolved) { if (i === q.answer) c += ' correct'; else if (i === picked) c += ' wrong' }
    return c
  }

  // Hiện tối đa 10 miếng trên cùng (10 miếng là đầy tháp); số còn lại đếm bằng số.
  const shown = stack.slice(-10)
  const hidden = stack.length - shown.length

  return (
    <div className={'screen' + (wobble ? ' shake' : '')}>
      <BackHeader title={title} onBack={() => { doneRef.current = true; onExit() }} />
      <div className="qf-hud">
        <div className="qf-timer">🍣 {stack.length}</div>
        <div className="qf-scorebox">
          <div className="qf-score">{fmt(score)}</div>
          {combo >= 2 && <div className="qf-combo">🔥 x{combo}</div>}
        </div>
      </div>

      <div className="sushi-arena">
        {gain && <div className="gain-pop" key={gain.id}>+{gain.amt}</div>}
        <div className={'sushi-stack' + (wobble ? ' wobble' : '')}>
          {/* Miếng MỚI NHẤT ở TRÊN CÙNG (rơi chồng lên tháp); miếng cũ ở dưới, gần đĩa. */}
          {shown.slice().reverse().map((p, i) => (
            <span className="sushi-piece" key={stack.length - 1 - i}>{p}</span>
          ))}
          {hidden > 0 && <span className="sushi-more">+{hidden} miếng</span>}
          <span className="sushi-plate">🍽️</span>
        </div>
      </div>

      <div className="qtag">{label}</div>
      <h2 className="question sushi-q">{q.q}</h2>
      <div className="opts">
        {q.options.map((o, i) => (
          <button key={i} className={optClass(i)} onClick={() => choose(i)} disabled={resolved}>{o}</button>
        ))}
      </div>

      {resolved && (
        <div className={'fb ' + (isCorrect ? 'fb-ok' : 'fb-no')}>
          <b>{isCorrect ? 'Ngon! Thêm 1 miếng sushi 🍣' : 'Hụt rồi — tháp lung lay 😅'}</b>
          {!isCorrect && q.explain && <p>{q.explain}</p>}
          <button className="cta" onClick={next}>{index + 1 >= questions.length ? 'Xem kết quả' : 'Miếng tiếp theo'}</button>
        </div>
      )}
    </div>
  )
}
