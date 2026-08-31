import { Brand } from '../components.jsx'
import { streakDays, nextReward, prevReward } from '../lib/stats.js'

export default function ChildHome({ stats, onReview, onCapture }) {
  const streak = stats ? streakDays(stats) : 0
  const next = nextReward(streak)
  const prev = prevReward(streak)
  const remaining = Math.max(0, next - streak)
  const pct = Math.max(4, Math.min(100, ((streak - prev) / (next - prev)) * 100))

  return (
    <div className="screen">
      <header className="topbar">
        <Brand />
        <div className="streak" title="Chuỗi ngày đạt mục tiêu">
          <span className="flame">🔥</span> {streak} ngày
        </div>
      </header>

      <section className="hello">
        <h1>Chào Minh!</h1>
      </section>

      {/* Đường đến phần thưởng — mốc 7, 15, 30 ngày, rồi cứ 30 ngày một lần */}
      <section className="reward" aria-label="Đường đến phần thưởng">
        <div className="reward-head">
          <span className="reward-streak">🔥 Chuỗi {streak} ngày đạt mục tiêu</span>
          <span className="reward-goal">🎁 mốc {next} ngày</span>
        </div>
        <div className="reward-track">
          <div className="reward-fill" style={{ width: pct + '%' }} />
          <span className="reward-flag" style={{ left: pct + '%' }}>🔥</span>
          <span className="reward-gift">🎁</span>
        </div>
        <p className="reward-note">
          {remaining > 0
            ? <>Cố thêm <b>{remaining}</b> ngày đạt mục tiêu nữa là con nhận phần thưởng! 🎁</>
            : <>Tuyệt vời! Con vừa chạm mốc phần thưởng 🎁</>}
        </p>
      </section>

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

      <footer className="foot">
        Bản demo · Nội dung minh hoạ. Bản thật được tạo từ chính bài con học ở trường.
      </footer>
    </div>
  )
}
