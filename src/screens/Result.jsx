import { statusOf } from '../lib/memory.js'
import { StatusPill } from '../components.jsx'

export default function Result({ session, onHome, onReport }) {
  const { total, correct, deltas } = session
  const pct = Math.round((correct / total) * 100)
  const msg =
    pct >= 80 ? 'Tuyệt vời! Con nhớ bài rất tốt.' :
    pct >= 50 ? 'Làm tốt lắm! Vài chỗ ôn thêm là chắc.' :
    'Không sao — ôn lại vài lần là nhớ ngay.'

  return (
    <div className="screen result">
      <div className="result-top">
        <div className="scorering" style={{ '--p': pct }}>
          <div className="scorering-in">
            <div className="score-num">{correct}/{total}</div>
            <div className="score-lbl">câu đúng</div>
          </div>
        </div>
        <h1>Xong buổi ôn!</h1>
        <p className="result-msg">{msg}</p>
        {typeof session.score === 'number' && <div className="score-badge">⭐ {session.score} điểm</div>}
        <div className="streak-up">🔥 Chuỗi ngày +1</div>
      </div>

      <section className="deltas">
        <h3>Thay đổi hôm nay</h3>
        {deltas.map((d) => {
          const diff = d.after - d.before
          return (
            <div className="delta" key={d.id}>
              <div className="delta-name">
                {d.name}
                <StatusPill status={statusOf(d.after)} />
              </div>
              <div className={'delta-num ' + (diff >= 0 ? 'up' : 'down')}>
                {diff >= 0 ? '▲' : '▼'} {Math.abs(diff)}%
                <span className="delta-to">{d.before}% → {d.after}%</span>
              </div>
            </div>
          )
        })}
      </section>

      <button className="cta" onClick={onHome}>Về trang chủ</button>
      <button className="ghost" onClick={onReport}>Xem báo cáo cho phụ huynh</button>
    </div>
  )
}
