import { useEffect, useRef } from 'react'
import { STATUS_LABEL } from './lib/memory.js'
import { streakDays, nextReward, prevReward } from './lib/stats.js'

// GIẢI THÍCH KHI LÀM SAI — dùng CHUNG cho MỌI kiểu ôn & game (chốt 29/9/2026):
// làm sai lúc nào cũng hiện: con chọn gì · đáp án đúng · VÌ SAO sai.
// picked: đáp án con chọn/gõ (null = hết giờ chưa chọn) · correct: đáp án đúng
// why: lý do riêng cho câu con trả lời (AI chấm bài tự gõ) · explain: lời giải của câu hỏi.
export function WrongWhy({ picked, correct, explain = '', why = '', pickedLabel = 'Con chọn' }) {
  const ref = useRef(null)
  // Tự cuộn cho con THẤY phần giải thích + nút đi tiếp (không bị khuất dưới màn hình).
  useEffect(() => {
    const box = ref.current && (ref.current.closest('.fb') || ref.current)
    if (box && box.scrollIntoView) { try { box.scrollIntoView({ block: 'nearest', behavior: 'smooth' }) } catch { /* noop */ } }
  }, [])
  const p = picked == null ? '' : String(picked).trim()
  const c = String(correct == null ? '' : correct).trim()
  const w = String(why || '').trim()
  const ex = String(explain || '').trim()
  const lines = []
  if (w) lines.push(w)
  if (ex && ex !== w) lines.push(ex)
  // Dự phòng (hiếm): câu hỏi không kèm lời giải -> vẫn nói rõ đúng/sai ở đâu.
  if (!lines.length) lines.push(p ? `Đáp án đúng là “${c}”, không phải “${p}”. Con đọc kỹ lại câu hỏi và so sánh hai đáp án nhé.` : `Đáp án đúng là “${c}”.`)
  return (
    <div className="why" ref={ref}>
      <div className="why-row">
        <span className="why-k">{pickedLabel}</span>
        <span className={'why-v' + (p ? ' bad' : ' none')}>{p || 'Hết giờ — con chưa chọn'}</span>
      </div>
      <div className="why-row">
        <span className="why-k">Đáp án đúng</span>
        <span className="why-v good">{c}</span>
      </div>
      <div className="why-ex">
        <span className="why-h">💡 Vì sao sai?</span>
        {lines.map((t, i) => <p key={i}>{t}</p>)}
      </div>
    </div>
  )
}

export function Brand({ sub }) {
  return (
    <div className="brand">
      <span className="brand-mark">OT</span>
      <span className="brand-name">ON&nbsp;TAP{sub && <em> {sub}</em>}</span>
    </div>
  )
}

export function StatusPill({ status }) {
  return <span className={'pill pill-' + status}>{STATUS_LABEL[status]}</span>
}

export function MasteryBar({ value, status }) {
  return (
    <div className="mbar" aria-label={value + '%'}>
      <span className={'mbar-fill fill-' + status} style={{ width: value + '%' }} />
    </div>
  )
}

export function BackHeader({ title, onBack }) {
  return (
    <div className="backhead">
      <button className="back" onClick={onBack} aria-label="Quay lại">←</button>
      <h2>{title}</h2>
    </div>
  )
}

// Đường đến phần thưởng — DÙNG CHUNG cho cả trang Con và trang Phụ huynh,
// nên "số ngày đạt mục tiêu" luôn KHỚP nhau ở hai nơi.
// Vạch LIỀN: ô XANH = ngày đã đạt, ô ĐỎ = ngày còn thiếu. Đứt mạch thì quay lại đầu chặng.
export function RewardTrack({ stats }) {
  const streak = stats ? streakDays(stats) : 0
  const next = nextReward(streak)
  const prev = prevReward(streak)
  const span = Math.max(1, next - prev)      // độ dài chặng hiện tại (số ngày)
  const into = Math.max(0, Math.min(span, streak - prev)) // số ngày đã đạt trong chặng
  const remaining = Math.max(0, next - streak)
  const pct = Math.max(0, Math.min(100, (into / span) * 100))
  const seg = span <= 12 // chặng ngắn: vẽ từng ô ngày; chặng dài: vẽ thanh liền

  return (
    <section className="reward" aria-label="Đường đến phần thưởng">
      <div className="reward-head">
        <span className="reward-streak">🔥 Chuỗi {streak} ngày đạt mục tiêu</span>
        <span className="reward-goal">🎁 mốc {next} ngày</span>
      </div>
      {seg ? (
        <div className="reward-track">
          {Array.from({ length: span }).map((_, i) => (
            <span key={i} className={'reward-seg' + (i < into ? ' done' : '')} title={`Ngày ${prev + i + 1}`} />
          ))}
          <span className="reward-gift">🎁</span>
        </div>
      ) : (
        <div className="reward-track bar">
          <div className="reward-fill" style={{ width: pct + '%' }} />
          <span className="reward-gift">🎁</span>
        </div>
      )}
      <p className="reward-note">
        Đã đạt <b>{into}/{span}</b> ngày trong chặng này
        {remaining > 0
          ? <> · cố thêm <b>{remaining}</b> ngày nữa là con nhận phần thưởng! 🎁</>
          : <> · con vừa chạm mốc phần thưởng 🎁</>}
      </p>
    </section>
  )
}
