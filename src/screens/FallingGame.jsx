import { useState, useEffect, useRef, useMemo } from 'react'
import { BackHeader } from '../components.jsx'
import { nextMastery } from '../lib/memory.js'
import { fmt } from '../lib/num.js'
import { createActiveTimer } from '../lib/stats.js'
import { CONCEPT_NAME } from '../data/content.js'

const PER_Q = 10000 // 10 giây rơi
const START_SEC = 10

export default function FallingGame({ questions, mem, title = 'Thả rơi', onFinish, onExit }) {
  const [index, setIndex] = useState(0)
  const [score, setScore] = useState(0)
  const [tick, setTick] = useState(START_SEC)
  const [flash, setFlash] = useState(null)
  const [locked, setLocked] = useState(false)
  const [fb, setFb] = useState(false) // hiện giải thích khi SAI, chờ bấm "Tiếp tục"
  const lockedRef = useRef(false) // đọc tại thời điểm hết giờ (tránh lỗi "đóng băng" giá trị cũ)
  const resultsRef = useRef({})
  const scoreRef = useRef(0)
  const doneRef = useRef(false)
  const timerRef = useRef(null)
  const tickRef = useRef(null)
  const audioRef = useRef(null)
  const tocRef = useRef(true)
  const activeTimer = useRef(createActiveTimer())

  const q = questions && questions[index]
  // Xáo vị trí các đáp án theo từng câu để đáp án đúng không cố định 1 chỗ
  const lanes = useMemo(() => [0, 1, 2, 3].sort(() => Math.random() - 0.5), [index])

  function playTick() {
    try {
      const ctx = audioRef.current
      if (!ctx) return
      const o = ctx.createOscillator()
      const g = ctx.createGain()
      o.frequency.value = tocRef.current ? 880 : 560
      tocRef.current = !tocRef.current
      o.connect(g); g.connect(ctx.destination)
      const t = ctx.currentTime
      g.gain.setValueAtTime(0.0001, t)
      g.gain.exponentialRampToValueAtTime(0.18, t + 0.005)
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.09)
      o.start(t); o.stop(t + 0.1)
    } catch { /* noop */ }
  }

  const finish = () => {
    if (doneRef.current) return
    doneRef.current = true
    clearInterval(tickRef.current); clearTimeout(timerRef.current)
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

  function resolve(picked) {
    if (lockedRef.current || doneRef.current) return
    lockedRef.current = true
    setLocked(true)
    activeTimer.current.step()
    clearInterval(tickRef.current); clearTimeout(timerRef.current)
    const ok = picked != null && picked === q.answer
    setFlash({ ok, i: picked })
    if (ok) { const ns = scoreRef.current + 100; scoreRef.current = ns; setScore(ns) }
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
    // Đúng: tự chạy tiếp. SAI: DỪNG LẠI giải thích cho con hiểu, chờ bấm "Tiếp tục".
    if (ok) setTimeout(advance, 750)
    else setFb(true)
  }

  useEffect(() => {
    if (!questions || !questions.length || doneRef.current) return undefined
    lockedRef.current = false
    setLocked(false); setFlash(null); setFb(false); setTick(START_SEC)
    activeTimer.current.reset()
    if (!audioRef.current) {
      try { audioRef.current = new (window.AudioContext || window.webkitAudioContext)() } catch { /* noop */ }
    }
    if (audioRef.current && audioRef.current.state === 'suspended') audioRef.current.resume().catch(() => {})
    playTick()
    let t = START_SEC
    tickRef.current = setInterval(() => { t -= 1; setTick(Math.max(0, t)); playTick() }, 1000)
    timerRef.current = setTimeout(() => resolve(null), PER_Q)
    return () => { clearInterval(tickRef.current); clearTimeout(timerRef.current) }
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

  return (
    <div className={'screen' + (flash && !flash.ok ? ' shake' : '')}>
      <BackHeader title={title} onBack={() => { doneRef.current = true; clearInterval(tickRef.current); clearTimeout(timerRef.current); onExit() }} />
      <div className="qf-hud">
        <div className={'qf-timer' + (tick <= 3 ? ' low' : '')}>⏱ {tick}s</div>
        <div className="qf-score">⭐ {fmt(score)} · câu {index + 1}/{questions.length}</div>
      </div>
      <div className="qtag">{label}</div>
      <h2 className="question fall-q">{q.q}</h2>

      <div className={'fall-area' + (flash ? ' frozen' : '')}>
        {q.options.map((o, i) => {
          const lane = lanes.indexOf(i)
          let cls = 'fall-chip'
          if (flash) { if (i === q.answer) cls += ' correct'; else if (i === flash.i) cls += ' wrong' }
          return (
            <button key={index + '-' + i} className={cls}
              style={{ left: (6 + lane * 23) + '%', animationDelay: (lane * 0.18) + 's' }}
              onClick={() => resolve(i)} disabled={locked}>{o}</button>
          )
        })}
        <div className="fall-floor" />
      </div>
      {fb ? (
        <div className="fb fb-no">
          <b>Chưa đúng.</b>
          <p>Đáp án đúng: <b>{q.options[q.answer]}</b></p>
          {q.explain && <p>{q.explain}</p>}
          <button className="cta" onClick={advance}>{index + 1 >= questions.length ? 'Xem kết quả' : 'Tiếp tục'}</button>
        </div>
      ) : (
        <p className="qf-note">Chạm trúng đáp án đúng trước khi nó chạm đáy! ⏱</p>
      )}
    </div>
  )
}
