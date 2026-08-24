import { Brand, StatusPill, MasteryBar } from '../components.jsx'
import { conceptStatusList, parentSummary } from '../lib/mockAI.js'

export default function ParentDashboard({ mem, session, onCapture, onGrade, toast }) {
  const concepts = conceptStatusList(mem)
  const needAttention = concepts.filter((c) => c.mastery < 60)
  const pct = session ? Math.round((session.correct / session.total) * 100) : null
  const minutes = session ? Math.round(session.total * 1.5) : null
  const summary = parentSummary(mem, session)

  return (
    <div className="screen">
      {toast && <div className="toast">{toast}</div>}
      <header className="topbar">
        <Brand sub="· Phụ huynh" />
        <span className="who-pill">Bố/Mẹ của Minh</span>
      </header>

      <section className="hello">
        <h1>Hôm nay của Minh</h1>
        <p>Mở 10 giây là biết con học thế nào.</p>
      </section>

      <div className="stat4">
        <div className="stat"><div className="stat-v">{session ? 'Rồi' : 'Chưa'}</div><div className="stat-k">Đã ôn</div></div>
        <div className="stat"><div className="stat-v">{session ? session.total : '—'}</div><div className="stat-k">Số câu</div></div>
        <div className="stat"><div className="stat-v">{pct !== null ? pct + '%' : '—'}</div><div className="stat-k">Đúng</div></div>
        <div className="stat"><div className="stat-v">{minutes !== null ? minutes + '′' : '—'}</div><div className="stat-k">Thời gian học</div></div>
      </div>

      <div className="ai-summary">
        <div className="ai-ic">✨</div>
        <div>
          <div className="ai-label">AI tóm tắt</div>
          <p>{summary}</p>
        </div>
      </div>

      {needAttention.length > 0 && (
        <div className="attention">
          <b>Cần chú ý</b>
          <span>{needAttention.map((c) => c.name).join(', ')} — nên ưu tiên ôn lại.</span>
        </div>
      )}

      <section className="kmap">
        <h3>Bản đồ kiến thức · Phân số</h3>
        {concepts.map((c) => (
          <div className="krow" key={c.id}>
            <div className="krow-top">
              <span className="kname">{c.name}</span>
              <StatusPill status={c.status} />
            </div>
            <div className="krow-bar">
              <MasteryBar value={c.mastery} status={c.status} />
              <span className="kpct">{c.mastery}%</span>
            </div>
          </div>
        ))}
      </section>

      <button className="cta" onClick={onCapture}>Chụp bài con học hôm nay</button>
      <button className="ghost" onClick={onGrade}>Chấm bài con đã làm</button>

      <footer className="foot">
        Bản demo · Số liệu minh hoạ. Bản thật cập nhật theo kết quả ôn thực tế của con.
      </footer>
    </div>
  )
}
