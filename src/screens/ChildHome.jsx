import { Brand } from '../components.jsx'
import { CONCEPTS } from '../data/content.js'

export default function ChildHome({ mem, streak, onStart, onPractice }) {
  const focus = [...mem].sort((a, b) => a.mastery - b.mastery)[0]

  return (
    <div className="screen">
      <header className="topbar">
        <Brand />
        <div className="streak" title="Chuỗi ngày ôn liên tục">
          <span className="flame">🔥</span> {streak} ngày
        </div>
      </header>

      <section className="hello">
        <h1>Chào Minh!</h1>
        <p>Hôm nay ôn một chút cho nhớ lâu nhé.</p>
      </section>

      <section className="mission" aria-label="Nhiệm vụ hôm nay">
        <div className="mission-top">
          <span className="tag">TOÁN · PHÂN SỐ</span>
          <span className="mission-time">≈ 10 phút · 6 câu</span>
        </div>
        <h2>Ôn lại: {focus.name}</h2>
        <p className="mission-sub">Tập trung phần con còn hay nhầm + vài câu ôn lại cái đã vững.</p>
        <button className="cta" onClick={onStart}>Bắt đầu ôn</button>
      </section>

      <button className="ghost" onClick={onPractice}>Luyện thêm điều khác</button>

      <section className="subjects" aria-label="Môn học">
        <h3>Môn học</h3>
        <div className="chips">
          <span className="chip on">Toán</span>
          <span className="chip">Tiếng Việt<em> · sắp có</em></span>
          <span className="chip">Tiếng Anh<em> · sắp có</em></span>
        </div>
      </section>

      <footer className="foot">
        Bản demo · Nội dung do AI giả lập. Bản thật: AI tạo từ chính bài con học ở trường.
      </footer>
    </div>
  )
}
