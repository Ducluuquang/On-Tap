import { useEffect, useRef, useState } from 'react'
import { STATUS_LABEL } from './lib/memory.js'
import { streakDays, nextReward, prevReward } from './lib/stats.js'
import logoRow from './assets/logo-row.png'

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

// Logo ngang (biểu tượng + chữ "Ôn Tập") — thanh trên cùng màn Con / màn chọn người học.
export function Brand({ sub }) {
  return (
    <div className="brand">
      <img className="brand-logo" src={logoRow} alt="Ôn Tập" />
      {sub && <span className="brand-name"><em>{sub}</em></span>}
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

// Ô MÔN HỌC (giao diện mới 28/10/2026) — dùng ở trang chủ của con và màn Bắt đầu ôn.
// Mỗi môn một màu (tone); dòng nhỏ: "N cần ôn" / "đã vững" / "chưa có bài".
export function SubjectTile({ s, need = 0, selected = false, chevron = false, onClick }) {
  const has = (s.count || 0) > 0
  const state = !has ? 'chưa có bài' : need > 0 ? `${need} cần ôn` : 'đã vững'
  return (
    <button type="button" className={'sj-tile tone-' + s.tone + (selected ? ' on' : '') + (has ? '' : ' empty')} onClick={onClick}
      aria-pressed={chevron ? undefined : selected}>
      <span className="sj-ic" aria-hidden="true">{s.icon}</span>
      <span className="sj-body"><b>{s.name}</b><small>{state}</small></span>
      {chevron && <span className="sj-go" aria-hidden="true">›</span>}
      {selected && <span className="sj-ck" aria-hidden="true">✓</span>}
    </button>
  )
}

// Đường đến phần thưởng — DÙNG CHUNG cho cả trang Con và trang Phụ huynh,
// nên "số ngày đạt mục tiêu" luôn KHỚP nhau ở hai nơi.
// Vạch LIỀN: ô XANH = ngày đã đạt, ô ĐỎ = ngày còn thiếu. Đứt mạch thì quay lại đầu chặng.
// variant="kid" (trang chủ của con, giao diện mới 28/10/2026): ô đánh số từng ngày, ô đã đạt tô cam, cuối là 🎁.
export function RewardTrack({ stats, variant }) {
  const streak = stats ? streakDays(stats) : 0
  const next = nextReward(streak)
  const prev = prevReward(streak)
  const span = Math.max(1, next - prev)      // độ dài chặng hiện tại (số ngày)
  const into = Math.max(0, Math.min(span, streak - prev)) // số ngày đã đạt trong chặng
  const remaining = Math.max(0, next - streak)
  const pct = Math.max(0, Math.min(100, (into / span) * 100))
  const seg = span <= 12 // chặng ngắn: vẽ từng ô ngày; chặng dài: vẽ thanh liền

  if (variant === 'kid') {
    const goal = (stats && stats.goalMin) || 15
    return (
      <section className="kh-reward" aria-label="Chuỗi ngày học và phần thưởng">
        <div className="kh-rw-row">
          <b>🔥 Chuỗi {streak} ngày</b>
          <span>Ngày thứ {next}: nhận quà 🎁</span>
        </div>
        {seg ? (
          <div className="kh-dots">
            {Array.from({ length: span }).map((_, i) => (
              <i key={i} className={i < into ? 'on' : ''} title={`Ngày ${prev + i + 1}`}>{prev + i + 1}</i>
            ))}
            <span className="kh-gift" aria-hidden="true">🎁</span>
          </div>
        ) : (
          <div className="kh-dots">
            <span className="kh-rw-bar"><i style={{ width: pct + '%' }} /><em>{into}/{span} ngày</em></span>
            <span className="kh-gift" aria-hidden="true">🎁</span>
          </div>
        )}
        <p>{seg ? `Mỗi ngày học đủ ${goal} phút là tô thêm 1 ô.` : `Mỗi ngày học đủ ${goal} phút là thanh dài thêm 1 ngày.`}</p>
      </section>
    )
  }

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

// Ô CHỌN TỰ VẼ thay <select> (04/11/2026). Danh sách xổ xuống của trình duyệt do trình duyệt tự vẽ, không theo cỡ chữ
// của trang (nhất là máy tính, khi app phóng to) nên chữ rất nhỏ — anh báo ở "Bắt đầu ôn" (02/11) và Thi đấu (04/11).
// Danh sách vẽ ngay dưới ô, chữ to; chạm/bấm, phím mũi tên, Enter, Esc đều dùng được.
//   options: [{ value, label }] · value '' = chưa chọn (ô hiện placeholder) · btnClass: kiểu của ô (vd 'auth-in')
//   overlay: danh sách nổi đè lên nội dung bên dưới (ô nhỏ nằm trong một hàng), mặc định đẩy nội dung xuống.
export function SelectPicker({ value, options, onChange, placeholder = '— Chọn —', btnClass = '', className = '', overlay = false, ariaLabel }) {
  const [open, setOpen] = useState(false)
  const box = useRef(null)
  const btn = useRef(null)
  const list = useRef(null)
  useEffect(() => {
    if (!open) return
    const close = (e) => { if (box.current && !box.current.contains(e.target)) setOpen(false) }
    document.addEventListener('pointerdown', close, true)
    // mở ra: ô đang chọn nằm giữa danh sách, cả danh sách hiện trong màn hình
    const l = list.current
    const cur = l && (l.querySelector('[aria-selected="true"]') || l.querySelector('.sel-opt'))
    if (l && cur) l.scrollTop = Math.max(0, cur.offsetTop - (l.clientHeight - cur.offsetHeight) / 2)
    try { l && l.scrollIntoView({ block: 'nearest' }) } catch { /* noop */ }
    return () => document.removeEventListener('pointerdown', close, true)
  }, [open])
  const cur = options.find((o) => o.value === value && value !== '')
  function choose(v) {
    setOpen(false)
    try { btn.current && btn.current.focus({ preventScroll: true }) } catch { /* noop */ }
    if (v !== value) onChange(v)
  }
  function onKey(e) {
    if (e.key === 'Escape' && open) { e.preventDefault(); e.stopPropagation(); setOpen(false); try { btn.current.focus() } catch { /* noop */ } return }
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) return
    e.preventDefault()
    if (!open) { setOpen(true); return }
    const opts = [...(list.current ? list.current.querySelectorAll('.sel-opt') : [])]
    if (!opts.length) return
    let i = opts.indexOf(document.activeElement)
    if (e.key === 'Home') i = 0
    else if (e.key === 'End') i = opts.length - 1
    else if (i < 0) i = Math.max(0, opts.findIndex((o) => o.getAttribute('aria-selected') === 'true'))
    else i = Math.min(opts.length - 1, Math.max(0, i + (e.key === 'ArrowDown' ? 1 : -1)))
    opts[i].focus()
  }
  function onBlur(e) { if (open && e.relatedTarget && box.current && !box.current.contains(e.relatedTarget)) setOpen(false) } // Tab sang chỗ khác
  return (
    <div className={'sel-pick' + (overlay ? ' overlay' : '') + (open ? ' open' : '') + (className ? ' ' + className : '')} ref={box} onKeyDown={onKey} onBlur={onBlur}>
      <button type="button" ref={btn} className={'sel-btn' + (btnClass ? ' ' + btnClass : '')} aria-haspopup="listbox" aria-expanded={open} aria-label={ariaLabel} onClick={() => setOpen((o) => !o)}>
        <span className={'sel-v' + (cur ? '' : ' ph')}>{cur ? cur.label : placeholder}</span>
        <span className="sel-ar" aria-hidden="true" />
      </button>
      {open && (
        <div className="sel-list" role="listbox" ref={list}>
          {options.filter((o) => o.value !== '').map((o) => (
            <button type="button" role="option" key={o.value} aria-selected={o.value === value} className="sel-opt" onClick={() => choose(o.value)}>{o.label}</button>
          ))}
        </div>
      )}
    </div>
  )
}
