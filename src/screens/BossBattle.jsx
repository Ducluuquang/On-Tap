import { useState, useRef, useEffect } from 'react'
import { BackHeader } from '../components.jsx'
import { nextMastery } from '../lib/memory.js'
import { createActiveTimer } from '../lib/stats.js'
import { CONCEPT_NAME } from '../data/content.js'
import { audioCtx, playSmash, playHurt } from '../lib/sound.js'

export default function BossBattle({ questions, mem, title = 'Boss Battle', onFinish, onExit }) {
  const total = questions ? questions.length : 0
  const maxHP = Math.max(4, Math.ceil(total * 0.6))
  const [index, setIndex] = useState(0)
  const [picked, setPicked] = useState(null)
  const [resolved, setResolved] = useState(false)
  const [hp, setHp] = useState(maxHP)
  const [hearts, setHearts] = useState(3)
  const [shake, setShake] = useState(null)     // 'boss' (đánh trúng Boss) | 'screen' (bị Boss đánh)
  const [smashId, setSmashId] = useState(0)     // để phát lại hiệu ứng "SMASH!"
  const [hurtNote, setHurtNote] = useState(false) // thông báo nhỏ "bị Boss đánh trúng"
  const [over, setOver] = useState(null)
  const [correct, setCorrect] = useState(0)
  const resultsRef = useRef({})
  const activeTimer = useRef(createActiveTimer())

  // Dọn hiệu ứng rung sau mỗi câu.
  useEffect(() => {
    if (!shake) return undefined
    const t = setTimeout(() => setShake(null), 520)
    return () => clearTimeout(t)
  }, [shake, smashId])

  if (!total) {
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

  // Mặt Boss đổi biểu cảm theo tình huống: bị đánh → choáng; đánh trúng con → đắc ý.
  const bossFace = shake === 'boss' ? '😵' : shake === 'screen' ? '😈' : '👹'

  function choose(i) {
    if (resolved || over) return
    activeTimer.current.step()
    audioCtx()
    setPicked(i); setResolved(true)
    const ok = i === q.answer
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
    if (ok) {
      // ĐÚNG: nghe tiếng smash, mặt Boss rung mạnh, hiện "SMASH!".
      playSmash()
      setHp((h) => Math.max(0, h - 1)); setCorrect((c) => c + 1)
      setShake('boss'); setSmashId((n) => n + 1); setHurtNote(false)
    } else {
      // SAI: màn hình rung + thông báo nhỏ "bị Boss đánh trúng".
      playHurt()
      setHearts((h) => Math.max(0, h - 1))
      setShake('screen'); setHurtNote(true)
    }
  }

  function endGame(outcome) { setOver(outcome) }

  function next() {
    setHurtNote(false)
    if (hearts <= 0) { endGame('lose'); return }
    if (hp <= 0) { endGame('win'); return }
    if (index + 1 >= total) { endGame(hp <= 0 ? 'win' : 'survive'); return }
    activeTimer.current.reset()
    setIndex(index + 1); setPicked(null); setResolved(false)
  }

  const optClass = (i) => {
    let c = 'opt'
    if (resolved) { if (i === q.answer) c += ' correct'; else if (i === picked) c += ' wrong' }
    return c
  }

  if (over) {
    const win = over === 'win'
    return (
      <div className="screen center">
        <div className="boss-over">
          <div className="boss-over-emo">{win ? '🏆' : '👹'}</div>
          <h1>{win ? 'Hạ gục Boss!' : over === 'survive' ? 'Boss còn chút máu!' : 'Boss thắng ván này'}</h1>
          <p>{win ? 'Quá đỉnh! Con đánh bại Boss rồi.' : 'Gần rồi — ôn thêm chút là hạ được Boss thôi.'}</p>
          <div className="boss-over-stat">Đúng {correct}/{total} câu · còn {hearts} ❤️</div>
          <button className="cta" onClick={() => onFinish({ total, correct, boss: over, activeSeconds: activeTimer.current.get() }, resultsRef.current)}>Xong</button>
        </div>
      </div>
    )
  }

  return (
    <div className={'screen boss-screen' + (shake === 'screen' ? ' shake' : '')}>
      <BackHeader title={title} onBack={onExit} />

      <div className="boss-stage">
        {hurtNote && <div className="boss-damage" key={'d' + index}>💥 Bạn bị Boss đánh trúng! −1 ❤️</div>}
        <div className={'boss-bigface' + (shake === 'boss' ? ' hit' : '') + (shake === 'screen' ? ' attack' : '')}>
          {bossFace}
          {shake === 'boss' && <span className="boss-smash" key={'s' + smashId}>SMASH!</span>}
        </div>
        <div className="boss-hpwrap">
          <div className="boss-hp"><span style={{ width: (hp / maxHP) * 100 + '%' }} /></div>
          <span className="boss-lbl">Boss còn {hp}/{maxHP} máu</span>
        </div>
        <div className="boss-hearts">Máu của con: {'❤️'.repeat(hearts)}{'🤍'.repeat(3 - hearts)}</div>
      </div>

      <div className="qtag">{label}</div>
      <h2 className="question">{q.q}</h2>
      <div className="opts">
        {q.options.map((o, i) => (
          <button key={i} className={optClass(i)} onClick={() => choose(i)} disabled={resolved}>{o}</button>
        ))}
      </div>

      {resolved && (
        <div className={'fb ' + (isCorrect ? 'fb-ok' : 'fb-no')}>
          <b>{isCorrect ? 'Trúng Boss! 💥 −1 máu' : 'Trượt! Boss phản đòn 😤 −1 ❤️'}</b>
          <button className="cta" onClick={next}>{index + 1 >= total || hearts <= 0 || hp <= 0 ? 'Kết thúc' : 'Đánh tiếp'}</button>
        </div>
      )}
    </div>
  )
}
