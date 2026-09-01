import { useState, useEffect, useRef } from 'react'
import { BackHeader } from '../components.jsx'
import { nextMastery } from '../lib/memory.js'
import { fmt } from '../lib/num.js'
import { createActiveTimer } from '../lib/stats.js'
import { CONCEPT_NAME } from '../data/content.js'
import { audioCtx, playPop, playMiss } from '../lib/sound.js'

// Bắn bóng 🎯 — 4 đáp án là 4 quả bóng bay THÀNH HÀNG NGANG ở trên.
// Dưới màn hình có KHẨU SÚNG/CUNG: kéo để ngắm, thả ra thì mũi tên bay về quả bóng đang ngắm.
// Ngắm trúng bóng có đáp án đúng để ghi điểm. Mỗi câu 15 giây.
const PER_SEC = 15
const COLORS = ['#e0703a', '#17a08f', '#5b7cf0', '#e0a32f']
const XS = [15, 38, 62, 85] // vị trí ngang (%) của 4 quả bóng
const BY = 20               // vị trí dọc (%) của hàng bóng
const CX = 50, CY = 88      // gốc khẩu súng (%)

export default function BalloonGame({ questions, mem, title = 'Bắn bóng', onFinish, onExit }) {
  const [index, setIndex] = useState(0)
  const [score, setScore] = useState(0)
  const [combo, setCombo] = useState(0)
  const [timeLeft, setTimeLeft] = useState(PER_SEC)
  const [shot, setShot] = useState(null)     // { i, ok } sau khi bắn
  const [gain, setGain] = useState(null)
  const [fb, setFb] = useState(false)        // giải thích khi SAI, chờ "Tiếp tục"
  const [aimDeg, setAimDeg] = useState(0)    // góc nghiêng khẩu súng (0 = thẳng đứng)
  const [aiming, setAiming] = useState(false)
  const [arrow, setArrow] = useState(null)   // { dx, dy, deg } khi mũi tên đang bay
  const lockedRef = useRef(false)
  const resultsRef = useRef({})
  const scoreRef = useRef(0)
  const doneRef = useRef(false)
  const tickRef = useRef(null)
  const gainId = useRef(0)
  const arenaRef = useRef(null)
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
    clearInterval(tickRef.current)
    const rs = resultsRef.current
    const corr = Object.values(rs).reduce((s, r) => s + r.correct, 0)
    const ans = Object.values(rs).reduce((s, r) => s + r.correct + r.wrong, 0)
    onFinish({ total: Math.max(ans, 1), correct: corr, score: scoreRef.current, activeSeconds: activeTimer.current.get() }, rs)
  }

  // Bắn vào quả bóng thứ `picked` (null = hết giờ).
  function shoot(picked) {
    if (lockedRef.current || doneRef.current) return
    lockedRef.current = true
    activeTimer.current.step()
    clearInterval(tickRef.current)
    setAiming(false)
    // Cho mũi tên bay tới quả bóng đã ngắm (nếu có), rồi mới chấm.
    if (picked != null) {
      const arena = arenaRef.current
      const w = arena ? arena.clientWidth : 320
      const h = arena ? arena.clientHeight : 340
      const dx = (XS[picked] - CX) / 100 * w
      const dy = (BY - CY) / 100 * h
      setArrow({ dx, dy, deg: Math.atan2(dy, dx) * 180 / Math.PI })
    }
    const resolve = () => {
      const ok = picked != null && picked === q.answer
      setShot({ i: picked, ok })
      if (ok) {
        playPop()
        const newCombo = combo + 1
        const gained = 100 + (newCombo - 1) * 20
        setCombo(newCombo)
        const ns = scoreRef.current + gained; scoreRef.current = ns; setScore(ns)
        gainId.current += 1; setGain({ amt: gained, id: gainId.current })
      } else { playMiss(); setCombo(0) }
      record(ok)
      // Đúng: bay tiếp. SAI: DỪNG lại giải thích cho con hiểu, chờ bấm "Tiếp tục".
      if (ok) setTimeout(advance, 850)
      else setFb(true)
    }
    if (picked != null) setTimeout(resolve, 360) // đợi mũi tên bay tới
    else resolve()
  }

  function advance() {
    if (doneRef.current) return
    if (index + 1 >= questions.length) { finish(); return }
    setIndex(index + 1)
  }

  // ---- Ngắm bằng cách kéo ----
  function aimFromEvent(e) {
    const arena = arenaRef.current
    if (!arena) return 0
    const r = arena.getBoundingClientRect()
    const src = (e.touches && e.touches[0]) || (e.changedTouches && e.changedTouches[0]) || e
    const px = (src.clientX - r.left) / r.width
    const py = (src.clientY - r.top) / r.height
    const ang = Math.atan2(py - CY / 100, px - CX / 100) // rad
    setAimDeg(ang * 180 / Math.PI + 90)
    return ang
  }
  function nearestBalloon(angRad) {
    let best = 0, bestD = Infinity
    XS.forEach((x, i) => {
      let d = Math.abs(Math.atan2(BY / 100 - CY / 100, x / 100 - CX / 100) - angRad)
      if (d > Math.PI) d = 2 * Math.PI - d
      if (d < bestD) { bestD = d; best = i }
    })
    return best
  }
  function onDown(e) { if (lockedRef.current) return; setAiming(true); audioCtx(); aimFromEvent(e) }
  function onMove(e) { if (!aiming || lockedRef.current) return; aimFromEvent(e) }
  function onUp(e) {
    if (!aiming || lockedRef.current) return
    const ang = aimFromEvent(e)
    shoot(nearestBalloon(ang))
  }

  useEffect(() => {
    if (!questions || !questions.length || doneRef.current) return undefined
    lockedRef.current = false
    setShot(null); setGain(null); setArrow(null); setAiming(false); setAimDeg(0); setFb(false); setTimeLeft(PER_SEC)
    activeTimer.current.reset()
    audioCtx()
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

      <div
        className="bl-arena"
        ref={arenaRef}
        onMouseDown={onDown} onMouseMove={onMove} onMouseUp={onUp} onMouseLeave={(e) => aiming && onUp(e)}
        onTouchStart={onDown} onTouchMove={onMove} onTouchEnd={onUp}
      >
        {q.options.map((o, i) => {
          let cls = 'balloon2'
          if (shot) {
            if (i === q.answer) cls += (shot.ok && shot.i === i) ? ' hit' : ' reveal'
            else if (i === shot.i) cls += ' miss'
            else cls += ' fade'
          }
          return (
            <button
              key={index + '-' + i}
              className={cls}
              style={{ '--bl': COLORS[i], left: XS[i] + '%', top: BY + '%', animationDelay: (i * 0.3) + 's' }}
              onClick={(e) => { e.stopPropagation(); if (!lockedRef.current) shoot(i) }}
            >
              <span className="balloon-txt">{o}</span>
              <span className="balloon-knot" />
              <span className="balloon-string" />
            </button>
          )
        })}

        {/* Đường ngắm — cùng hướng với mũi tên sẽ bắn */}
        {aiming && !shot && <div className="bl-aimline" style={{ left: CX + '%', top: CY + '%', transform: `translate(-50%, -100%) rotate(${aimDeg}deg)` }} />}

        {/* Mũi tên đang bay */}
        {arrow && <div className="bl-arrow flying" style={{ left: CX + '%', top: CY + '%', '--dx': arrow.dx + 'px', '--dy': arrow.dy + 'px', '--adeg': arrow.deg + 'deg' }}>➤</div>}

        {/* Mũi tên NGẮM — LUÔN chỉ đúng hướng sẽ bắn (đẩy ra khỏi cung, nằm trên đường ngắm) */}
        {!shot && !arrow && <div className="bl-aimarrow" style={{ left: CX + '%', top: CY + '%', transform: `translate(-50%,-50%) rotate(${aimDeg - 90}deg) translateX(${aiming ? 34 : 24}px) scale(${aiming ? 1.3 : 1.05})` }}>➤</div>}

        {/* Cây cung (KHÔNG có mũi tên) — to & xoay theo đúng hướng ngắm cho đỡ gượng */}
        <div className="bl-bow" style={{ left: CX + '%', top: CY + '%', transform: `translate(-50%,-50%) rotate(${aimDeg - 90}deg) scale(${aiming ? 1.12 : 1})` }} aria-hidden="true">
          <svg viewBox="0 0 44 66" width="52" height="74">
            <path d="M13 6 Q39 33 13 60" fill="none" stroke="#7a4a22" strokeWidth="6.4" strokeLinecap="round" />
            <path d="M13 6 Q39 33 13 60" fill="none" stroke="#b6823f" strokeWidth="2.6" strokeLinecap="round" />
            <line x1="13" y1="7" x2="13" y2="59" stroke="#efe4c8" strokeWidth="2.2" />
            <circle cx="26" cy="33" r="3.4" fill="#5e3c1a" />
          </svg>
        </div>
      </div>

      {fb ? (
        <div className="fb fb-no">
          <b>Chưa đúng.</b>
          <p>Đáp án đúng: <b>{q.options[q.answer]}</b></p>
          {q.explain && <p>{q.explain}</p>}
          <button className="cta" onClick={advance}>{index + 1 >= questions.length ? 'Xem kết quả' : 'Tiếp tục'}</button>
        </div>
      ) : (
        <p className="qf-note">Kéo cung để ngắm, thả tay là bắn mũi tên vào quả bóng đúng! 🏹 (hoặc chạm thẳng vào bóng)</p>
      )}
    </div>
  )
}
