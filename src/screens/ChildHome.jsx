import { useState } from 'react'
import { Brand, RewardTrack, SubjectTile } from '../components.jsx'
import { todayMinutes } from '../lib/stats.js'
import { subjectsWithTone, subjectDisplayName } from '../lib/subjects.js'
import { needReviewCount } from '../lib/review.js'
import { iconFor } from '../lib/icons.js'

const SLOGAN_HINT = 'Mục tiêu hay khẩu hiệu học tập của con'

// TRANG CHỦ CỦA CON — giao diện mới (anh duyệt hình mẫu 28/10/2026, file "sua 26 Oct 2026" mục 4):
// mỗi vùng một màu, mỗi màn chỉ MỘT việc nổi bật nhất (nút vàng "Bắt đầu ôn"), chữ ngắn, nút to.
//  ⭐ Việc chính hôm nay (xanh ngọc): mục tiêu số phút + thanh tiến độ + nút "Bắt đầu ôn" + số chủ đề đang chờ ôn
//  🔥 Chuỗi ngày + phần thưởng (cam nhạt) · 🧩 Việc khác: Thêm bài học (xanh dương), Xem báo cáo (tím)
//  📚 Môn học của con: mỗi môn một màu kèm "N cần ôn"; chạm vào môn là vào màn Bắt đầu ôn của môn đó.
// Trò chơi từ vựng: KHÔNG đặt thẻ riêng ở trang chủ (chốt 12/10/2026) — vào qua "Bắt đầu ôn" → Tiếng Anh.
// Nút "Đổi người học" chỉ còn ở thanh trên cùng (không lặp lại trong khung).
export default function ChildHome({ mem = [], stats, child, slogan = '', onSetSlogan, onReview, onReviewSubject, onCapture, onReport }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(slogan)

  const goal = (stats && stats.goalMin) || 15
  const done = stats ? todayMinutes(stats) : 0
  const met = done >= goal
  const pct = Math.max(0, Math.min(100, (done / goal) * 100))
  const waiting = needReviewCount(mem)
  const subjects = subjectsWithTone(mem)

  function saveSlogan() {
    setEditing(false)
    const v = draft.trim()
    if (v !== (slogan || '') && onSetSlogan) onSetSlogan(v)
  }

  return (
    <div className="screen kh">
      <header className="kh-top">
        <Brand />
        {child && (
          <span className="kh-kid">
            <span className="kh-av" aria-hidden="true">{iconFor(child)}</span>
            <b>{child.name}</b>{child.grade ? <small>· {child.grade}</small> : null}
          </span>
        )}
      </header>

      {/* Lời chào + khẩu hiệu học tập (con tự ghi, bấm để sửa) */}
      <section className="hello kh-greet">
        <h1>Chào {child?.name || 'con'}! 👋</h1>
        {editing ? (
          <input
            className="slogan-input"
            autoFocus
            maxLength={120}
            value={draft}
            placeholder={SLOGAN_HINT}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={saveSlogan}
            onKeyDown={(e) => { if (e.key === 'Enter') saveSlogan() }}
          />
        ) : (
          <p
            className={'slogan' + (slogan ? '' : ' slogan-empty')}
            onClick={() => { setDraft(slogan || ''); setEditing(true) }}
            title="Bấm để sửa khẩu hiệu học tập"
          >
            {slogan ? `“${slogan}”` : SLOGAN_HINT}
            <span className="slogan-edit" aria-hidden="true"> ✏️</span>
          </p>
        )}
      </section>

      {/* ⭐ VÙNG 1 — việc chính hôm nay */}
      <div className="kh-zone">⭐ Việc chính hôm nay</div>
      <section className="kh-today">
        <div className="kh-goal">
          <span>⏱ Mục tiêu: học đủ {goal} phút</span>
          <em>{met ? `Đạt rồi ✓ (${done} phút)` : `${done} / ${goal} phút`}</em>
        </div>
        <div className="kh-bar" role="progressbar" aria-label="Thời gian học hôm nay" aria-valuemin={0} aria-valuemax={goal} aria-valuenow={Math.min(done, goal)}>
          <i style={{ width: pct + '%' }} />
        </div>
        <button className="kh-cta" onClick={onReview}>
          <span className="kh-play" aria-hidden="true">▶</span>Bắt đầu ôn
        </button>
        <div className="kh-sub">
          {waiting > 0
            ? `Có ${waiting} chủ đề đang chờ con ôn`
            : mem.length > 0
              ? 'Con đã vững hết các bài rồi, ôn lại để giữ phong độ nhé!'
              : 'Thêm bài học đầu tiên để bắt đầu ôn nhé!'}
        </div>
      </section>

      {/* 🔥 VÙNG 2 — chuỗi ngày + phần thưởng (mốc 7, 15, 30 ngày, rồi cứ 30 ngày một lần) */}
      <RewardTrack stats={stats} variant="kid" />

      {/* 🧩 VÙNG 3 — việc khác */}
      <div className="kh-zone">🧩 Việc khác</div>
      <div className="kh-two">
        <button className="kh-tile tone-blue" onClick={onCapture}>
          <span className="kh-ti" aria-hidden="true">📸</span>
          <b>Thêm bài học</b>
          <em>Chụp hoặc gõ bài con vừa học trên lớp</em>
        </button>
        {onReport && (
          <button className="kh-tile tone-purple" onClick={onReport}>
            <span className="kh-ti" aria-hidden="true">📊</span>
            <b>Xem báo cáo</b>
            <em>Thời gian học, phần đã vững, phần cần ôn</em>
          </button>
        )}
      </div>

      {/* 📚 VÙNG 4 — môn học của con */}
      <div className="kh-zone">📚 Môn học của con</div>
      <div className="sj-grid">
        {subjects.map((s) => (
          <SubjectTile key={s.name} s={s} chevron
            need={needReviewCount(mem.filter((c) => subjectDisplayName(c.subject) === s.name))}
            onClick={() => (onReviewSubject ? onReviewSubject(s.name) : onReview && onReview())} />
        ))}
      </div>
      <p className="kh-note">Chạm vào một môn để vào ôn môn đó. Môn nào chưa có bài thì bấm “Thêm bài học”.</p>
    </div>
  )
}
