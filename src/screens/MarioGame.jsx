import { useState, useEffect, useRef } from 'react'
import { BackHeader } from '../components.jsx'
import { nextMastery } from '../lib/memory.js'
import { fmt } from '../lib/num.js'
import { createActiveTimer } from '../lib/stats.js'
import { CONCEPT_NAME } from '../data/content.js'
import { audioCtx, playPop, playMiss } from '../lib/sound.js'

// Mario nhảy 🍄 — nhân vật CHẠY qua lại ở dưới; chạm màn hình (hoặc Enter) là NHẢY lên
// đụng đầu vào ô đáp án đang ở phía trên. Đụng trúng ô đáp án đúng thì ghi điểm.
const XS = [12, 37, 62, 87] // vị trí ngang của 4 ô đáp án (%)
const PER_SEC = 15
const SPEED = 32 // tốc độ chạy (% mỗi giây)

function nearestTo(x) {
  let best = 0, bd = Infinity
  XS.forEach((bx, i) => { const d = Math.abs(bx - x); if (d < bd) { bd = d; best = i } })
  return best
}

export default function MarioGame({ questions, mem, title = 'Mario nhảy', onFinish, onExit }) {
  const [index, setIndex] = useState(0)
  const [score, setScore] = useState(0)
  const [combo, setCombo] = useState(0)
  const [timeLeft, setTimeLeft] = useState(PER_SEC)
  const [runX, setRunX] = useState(6)
  const [jumping, setJumping] = useState(false)
  const [hit, setHit] = useState(null)   // { i, ok } sau khi đụng ô
  const [gain, setGain] = useState(null)
  const [fb, setFb] = useState(false)    // SAI -> dừng, giải thích, chờ "Tiếp tục"

  const lockedRef = useRef(false)
  const runXRef = useRef(6)
  const dirRef = useRef(1)
  const rafRef = useRef(null)
  const lastRef = useRef(0)
  const pausedRef = useRef(false)
  const tickRef = useRef(null)
  const resultsRef = useRef({})
  const scoreRef = useRef(0)
  const doneRef = useRef(false)
  const gainId = useRef(0)
  const activeTimer = useRef(createActiveTimer())

  const q = questions && questions[index]

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
    cancelAnimationFrame(rafRef.current); clearInterval(tickRef.current)
    const rs = resultsRef.current
    const corr = Object.values(rs).reduce((s, r) => s + r.correct, 0)
    const ans = Object.values(rs).reduce((s, r) => s + r.correct + r.wrong, 0)
    onFinish({ total: Math.max(ans, 1), correct: corr, score: scoreRef.current, activeSeconds: activeTimer.current.get() }, rs)
  }

  function advance() {
    if (doneRef.current) return
    if (index + 1 >= questions.length) { finish(); return }
    setIndex(index + 1)
  }

  // Chấm ô đáp án `picked` (null = hết giờ).
  function resolve(picked) {
    if (lockedRef.current || doneRef.current) return
    lockedRef.current = true
    pausedRef.current = true
    activeTimer.current.step()
    clearInterval(tickRef.current)
    const ok = picked != null && picked === q.answer
    setHit({ i: picked, ok })
    if (ok) {
      playPop()
      const newCombo = combo + 1
      const gained = 100 + (newCombo - 1) * 20
      setCombo(newCombo)
      const ns = scoreRef.current + gained; scoreRef.current = ns; setScore(ns)
      gainId.current += 1; setGain({ amt: gained, id: gainId.current })
    } else { playMiss(); setCombo(0) }
    record(ok)
    if (ok) setTimeout(advance, 850)
    else setFb(true)
  }

  // Nhảy lên đụng ô đang ở TRÊN ĐẦU (ô gần vị trí đang đứng nhất).
  function jump() {
    if (lockedRef.current || doneRef.current || jumping) return
    audioCtx()
    setJumping(true)
    pausedRef.current = true
    const target = nearestTo(runXRef.current)
    setTimeout(() => resolve(target), 300)   // đợi nhảy tới đỉnh rồi mới chấm
    setTimeout(() => setJumping(false), 520)
  }

  // Vòng lặp CHẠY qua lại + đồng hồ.
  useEffect(() => {
    if (!questions || !questions.length || doneRef.current) return undefined
    lockedRef.current = false; pausedRef.current = false
    setHit(null); setGain(null); setFb(false); setJumping(false); setTimeLeft(PER_SEC)
    runXRef.current = 6; dirRef.current = 1; setRunX(6)
    activeTimer.current.reset(); audioCtx()
    let t = PER_SEC
    tickRef.current = setInterval(() => { t -= 1; setTimeLeft(Math.max(0, t)); if (t <= 0) { clearInterval(tickRef.current); resolve(null) } }, 1000)
    lastRef.current = (typeof performance !== 'undefined' ? performance.now() : Date.now())
    const loop = (ts) => {
      const now = ts || (typeof performance !== 'undefined' ? performance.now() : Date.now())
      const dt = Math.min(0.05, (now - lastRef.current) / 1000); lastRef.current = now
      if (!pausedRef.current && !lockedRef.current) {
        let x = runXRef.current + dirRef.current * SPEED * dt
        if (x >= 94) { x = 94; dirRef.current = -1 }
        else if (x <= 6) { x = 6; dirRef.current = 1 }
        runXRef.current = x; setRunX(x)
      }
      rafRef.current = requestAnimationFrame(loop)
    }
    rafRef.current = requestAnimationFrame(loop)
    return () => { cancelAnimationFrame(rafRef.current); clearInterval(tickRef.current) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index])

  // Bàn phím: Enter/Space = nhảy (hoặc "Tiếp tục" khi đang giải thích).
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return
      e.preventDefault()
      if (fb) advance(); else jump()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fb, index, jumping])

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
  const near = nearestTo(runX)

  return (
    <div className={'screen' + (hit && !hit.ok ? ' shake' : '')}>
      <BackHeader title={title} onBack={() => { doneRef.current = true; cancelAnimationFrame(rafRef.current); clearInterval(tickRef.current); onExit() }} />
      <div className="qf-hud">
        <div className={'qf-timer' + (low ? ' low' : '')}>⏱ {timeLeft}s</div>
        <div className="qf-scorebox">
          <div className="qf-score">{fmt(score)}</div>
          {combo >= 2 && <div className="qf-combo">🍄 x{combo}</div>}
        </div>
      </div>

      <div className="qf-qwrap">
        {gain && <div className="gain-pop" key={gain.id}>+{gain.amt}</div>}
        <div className="qtag">{label}</div>
        <h2 className="question mario-q">{q.q}</h2>
      </div>

      <div className="mario-arena" onClick={() => { if (!lockedRef.current) jump() }}>
        {q.options.map((o, i) => {
          let cls = 'mario-block'
          if (hit) {
            if (i === q.answer) cls += (hit.ok && hit.i === i) ? ' hit' : ' reveal'
            else if (i === hit.i) cls += ' miss'
            else cls += ' fade'
          } else if (i === near) cls += ' aim'
          return (
            <button
              key={index + '-' + i}
              className={cls}
              style={{ left: XS[i] + '%' }}
              onClick={(e) => { e.stopPropagation(); if (!lockedRef.current) resolve(i) }}
            >
              <span className="mario-block-txt">{o}</span>
            </button>
          )
        })}

        <div className="mario-ground" />
        <div className={'mario-hero' + (jumping ? ' jump' : '')} style={{ left: runX + '%' }}>🍄</div>
      </div>

      {fb ? (
        <div className="fb fb-no">
          <b>Chưa đúng.</b>
          <p>Đáp án đúng: <b>{q.options[q.answer]}</b></p>
          {q.explain && <p>{q.explain}</p>}
          <button className="cta" onClick={advance}>{index + 1 >= questions.length ? 'Xem kết quả' : 'Tiếp tục'}</button>
        </div>
      ) : (
        <p className="qf-note">🍄 chạm màn hình (hoặc Enter) để nhảy lên đụng ô đáp án ĐÚNG! (hoặc chạm thẳng vào ô)</p>
      )}
    </div>
  )
}
