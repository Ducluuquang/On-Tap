import { useEffect, useRef, useState } from 'react'
import { BackHeader, WrongWhy } from '../components.jsx'
import { nowTs, isStaleEnter } from '../lib/keys.js'
import { createActiveTimer } from '../lib/stats.js'
import { makeTFPair } from '../lib/vocab.js'
import { speak, stopSpeech } from '../lib/speech.js'
import { fmt } from '../lib/num.js'
import { audioCtx, playTick, playHit, playMiss } from '../lib/sound.js'

// ĐÚNG HAY SAI SIÊU TỐC (chốt 6/10/2026): 60 giây, mỗi lượt một cặp "từ = nghĩa?".
// Cặp SAI lấy nghĩa của từ KHÁC và KHÔNG trùng nghĩa (makeTFPair) -> không bao giờ chấm nhầm.
// Trò KHỞI ĐỘNG: không tính vào % thành thạo; từ nào con chọn sai được ghi lại để các trò khác đưa lại.
const DURATION = 60
const LOW_AT = 10

export default function TrueFalseGame({ pool, onFinish, onExit }) {
  const [pair, setPair] = useState(() => makeTFPair(pool))
  const [timeLeft, setTimeLeft] = useState(DURATION)
  const [score, setScore] = useState(0)
  const [combo, setCombo] = useState(0)
  const [flash, setFlash] = useState(null) // 'ok' | 'no'
  const [fb, setFb] = useState(null)       // sai -> { said } (tạm dừng giờ, giải thích)
  const [n, setN] = useState(0)            // số cặp đã trả lời
  const scoreRef = useRef(0)
  const comboRef = useRef(0)
  const correct = useRef(0)
  const answered = useRef(0)
  const wordRes = useRef([])
  const lock = useRef(false)
  const done = useRef(false)
  const remain = useRef(DURATION)
  const timerRef = useRef(null)
  const active = useRef(createActiveTimer())
  const doneAt = useRef(0) // lúc hiện giải thích (sai) -> bỏ qua chính cú bấm vừa trả lời

  function finish() {
    if (done.current) return
    done.current = true
    clearInterval(timerRef.current)
    onFinish({ total: answered.current, correct: correct.current, score: scoreRef.current, activeSeconds: active.current.get() }, {}, wordRes.current)
  }
  function stopTimer() { clearInterval(timerRef.current) }
  function startTimer() {
    clearInterval(timerRef.current)
    timerRef.current = setInterval(() => {
      remain.current -= 1
      const t = remain.current
      setTimeLeft(Math.max(0, t))
      if (t <= 0) { finish(); return }
      playTick(t <= LOW_AT)
    }, 1000)
  }

  useEffect(() => {
    audioCtx()
    startTimer()
    return () => { clearInterval(timerRef.current); stopSpeech() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function nextPair() {
    setPair((p) => makeTFPair(pool, { avoidKey: p ? p.key : '' }))
  }

  function answer(said) {
    if (lock.current || done.current || !pair || fb) return
    lock.current = true
    active.current.step()
    const ok = said === pair.truth
    answered.current += 1
    setN(answered.current)
    if (ok) {
      correct.current += 1
      comboRef.current += 1
      const gained = 10 + (comboRef.current - 1) * 2
      scoreRef.current += gained
      setScore(scoreRef.current); setCombo(comboRef.current)
      playHit(); setFlash('ok')
      setTimeout(() => {
        setFlash(null)
        if (done.current) return
        active.current.reset()
        nextPair()
        lock.current = false
      }, 380)
    } else {
      comboRef.current = 0
      setCombo(0)
      playMiss(); setFlash('no')
      wordRes.current.push({ key: pair.key, ok: false, game: 'truefalse' })
      stopTimer()          // SAI: dừng giờ để con đọc giải thích
      doneAt.current = nowTs()
      setFb({ said })
      setTimeout(() => setFlash(null), 420)
    }
  }

  function cont() {
    setFb(null)
    if (done.current) return
    if (remain.current <= 0) { finish(); return }
    active.current.reset()
    nextPair()
    lock.current = false
    startTimer()
  }

  // Phím: ← Sai · → Đúng · Enter = tiếp tục sau khi sai.
  useEffect(() => {
    function onKey(e) {
      if (fb) { if (e.key === 'Enter' && !isStaleEnter(e, doneAt.current)) { e.preventDefault(); cont() } return }
      if (e.key === 'ArrowLeft') { e.preventDefault(); answer(false) }
      if (e.key === 'ArrowRight') { e.preventDefault(); answer(true) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  if (!pair) {
    return (
      <div className="screen center">
        <p className="para">Chưa đủ từ để chơi.</p>
        <button className="cta small" onClick={onExit}>Quay lại</button>
      </div>
    )
  }

  const low = timeLeft <= LOW_AT
  let why = ''
  if (fb) {
    why = pair.truth
      ? `“${pair.w}” nghĩa là “${pair.real}” — cặp này ĐÚNG đấy.`
      : `“${pair.w}” nghĩa là “${pair.real}”, không phải “${pair.shown}”${pair.otherW ? ` (“${pair.shown}” là “${pair.otherW}”)` : ''}.`
  }

  return (
    <div className={'screen qf tf' + (flash ? ' pulse-' + flash : '') + (low ? ' qf-low' : '')}>
      <BackHeader title="Đúng hay sai" onBack={onExit} />
      <div className="qf-hud">
        <div className={'qf-timer' + (low ? ' low' : '')}>{low ? '⏰' : '⏱'} {timeLeft}{low ? 's' : ''}</div>
        <div className="qf-scorebox">
          <div className="qf-score">{fmt(score)}</div>
          {combo >= 2 && <div className="qf-combo">🔥 x{combo}</div>}
        </div>
      </div>
      <div className={'qf-bar' + (low ? ' urgent' : '')}><span style={{ width: (timeLeft / DURATION) * 100 + '%' }} /></div>

      <div className="tf-card" key={n}>
        <div className="tf-word">
          {pair.w}
          <button type="button" className="vg-speak mini" onClick={() => speak(pair.w)} aria-label="Nghe từ">🔊</button>
        </div>
        <div className="tf-eq">nghĩa là</div>
        <div className="tf-mean">{pair.shown}</div>
        <div className="tf-q">Đúng hay sai?</div>
      </div>

      {fb ? (
        <div className="fb fb-no">
          <b>Chưa đúng.</b>
          <WrongWhy picked={fb.said ? 'Đúng' : 'Sai'} correct={pair.truth ? 'Đúng' : 'Sai'} why={why} />
          <button className="cta" onClick={cont}>{remain.current <= 0 ? 'Xem kết quả' : 'Tiếp tục'}</button>
        </div>
      ) : (
        <>
          <div className="tf-btns">
            <button className="tf-btn tf-no" onClick={() => answer(false)}>✗ Sai</button>
            <button className="tf-btn tf-yes" onClick={() => answer(true)}>✓ Đúng</button>
          </div>
          <p className="qf-note">Đúng liên tiếp để nhân combo 🔥 · Máy tính: phím ← Sai, → Đúng</p>
        </>
      )}
    </div>
  )
}
