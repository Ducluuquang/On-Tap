import { Brand } from '../components.jsx'

export default function ChildHome({ streak, onReview, onCapture }) {
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
        <p>Hôm nay muốn làm gì nào?</p>
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
            <em>Chụp ảnh hoặc gõ bài con vừa học để AI ghi nhớ</em>
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
        Bản demo · Nội dung do AI giả lập. Bản thật: AI tạo từ chính bài con học ở trường.
      </footer>
    </div>
  )
}
