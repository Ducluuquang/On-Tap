import { statusOf } from '../lib/memory.js'
import { fmt } from '../lib/num.js'
import { StatusPill } from '../components.jsx'

export default function Result({ session, onHome, onReport, onRetryWrong, onMoreGames }) {
  const { total, correct, deltas } = session
  const vocab = session.vocab || null // lượt TRÒ CHƠI TỪ VỰNG (có danh sách từ con làm sai)
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
        {typeof session.score === 'number' && <div className="score-badge">⭐ {fmt(session.score)} điểm</div>}
        {(() => {
          // Ưu tiên tổng thời gian học (đã gồm thời gian chờ nạp bài); dự phòng activeSeconds.
          const secs = typeof session.studySeconds === 'number' ? session.studySeconds : session.activeSeconds
          return typeof secs === 'number' && secs >= 20
            ? <div className="score-badge">⏱ Học {Math.max(1, Math.round(secs / 60))} phút</div>
            : null
        })()}
        <div className="streak-up">🔥 Chuỗi ngày +1</div>
      </div>

      {vocab && vocab.wrong && vocab.wrong.length > 0 && (
        <section className="vr-wrong">
          <h3>Từ cần ôn lại</h3>
          <div className="vr-words">
            {vocab.wrong.map((x) => (
              <span key={x.key} className="vr-word"><b>{x.w}</b> {x.mean}</span>
            ))}
          </div>
          {onRetryWrong && (
            <button className="cta" onClick={onRetryWrong}>
              {vocab.game === 'truefalse' ? `✍️ Gõ nghĩa ${vocab.wrong.length} từ vừa chọn sai` : `🔁 Làm lại ${vocab.wrong.length} từ sai`}
            </button>
          )}
        </section>
      )}

      <section className="deltas">
        <h3>Thay đổi hôm nay</h3>
        {(!deltas || deltas.length === 0) && (
          <p className="deltas-empty">{vocab && vocab.warmup
            ? 'Đây là trò khởi động — không tính vào % thuộc bài. Từ nào con chọn sai sẽ được đưa lại trong các trò từ vựng khác.'
            : 'Buổi này là ôn chung, chưa gắn với chủ đề cụ thể trong bản đồ kiến thức. Số câu đúng/sai vẫn được ghi vào báo cáo theo ngày.'}</p>
        )}
        {(deltas || []).map((d) => {
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

      {vocab && onMoreGames && <button className="ghost" onClick={onMoreGames}>🎮 Chơi trò từ vựng khác</button>}
      <button className="cta" onClick={onHome}>Về trang chủ</button>
      <button className="ghost" onClick={onReport}>📊 Xem báo cáo học tập</button>
    </div>
  )
}
