import { useState } from 'react'
import { Brand, RewardTrack } from '../components.jsx'
import { streakDays } from '../lib/stats.js'

const SLOGAN_HINT = 'Mục tiêu hay khẩu hiệu học tập của con'

export default function ChildHome({ stats, slogan = '', onSetSlogan, onReview, onCapture }) {
  const streak = stats ? streakDays(stats) : 0
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(slogan)

  function saveSlogan() {
    setEditing(false)
    const v = draft.trim()
    if (v !== (slogan || '') && onSetSlogan) onSetSlogan(v)
  }

  return (
    <div className="screen">
      <header className="topbar">
        <Brand />
        <div className="streak" title="Chuỗi ngày đạt mục tiêu">
          <span className="flame">🔥</span> {streak} ngày
        </div>
      </header>

      {/* Khẩu hiệu/mục tiêu học tập — con tự ghi (bấm để sửa) */}
      <section className="hello">
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
          <h1
            className={'slogan' + (slogan ? '' : ' slogan-empty')}
            onClick={() => { setDraft(slogan || ''); setEditing(true) }}
            title="Bấm để sửa khẩu hiệu học tập"
          >
            {slogan || SLOGAN_HINT}
            <span className="slogan-edit" aria-hidden="true"> ✏️</span>
          </h1>
        )}
      </section>

      {/* Đường đến phần thưởng — mốc 7, 15, 30 ngày, rồi cứ 30 ngày một lần */}
      <RewardTrack stats={stats} />

      <section className="home-cards" aria-label="Chọn việc muốn làm">
        <button className="home-card primary" onClick={onReview}>
          <span className="hc-ic">🎯</span>
          <span className="hc-body">
            <b>Bắt đầu ôn</b>
            <em>Chọn môn, chọn phần con muốn ôn rồi chơi</em>
          </span>
          <span className="hc-go">→</span>
        </button>

        <button className="home-card" onClick={onCapture}>
          <span className="hc-ic">📸</span>
          <span className="hc-body">
            <b>Thêm bài học hôm nay</b>
            <em>Chụp ảnh hoặc gõ bài con vừa học để ghi nhớ</em>
          </span>
          <span className="hc-go">→</span>
        </button>
      </section>

      <section className="subjects" aria-label="Môn học">
        <h3>Môn học</h3>
        <div className="chips">
          <span className="chip on">Toán</span>
          <span className="chip">Tiếng Việt<em> · sắp có</em></span>
          <span className="chip">Tiếng Anh<em> · sắp có</em></span>
        </div>
      </section>
    </div>
  )
}
