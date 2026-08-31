import { Brand, StatusPill, MasteryBar } from '../components.jsx'
import { conceptStatusList, parentSummary } from '../lib/mockAI.js'
import { last7, totalMinutes, todayMinutes, goalMetCount } from '../lib/stats.js'

function hm(min) {
  const h = Math.floor(min / 60), m = min % 60
  return h ? `${h} giờ ${m} phút` : `${m} phút`
}

function StudyChart({ stats }) {
  const days = last7(stats)
  const goal = stats.goalMin
  const maxV = Math.max(goal, ...days.map((d) => d.min), 1) * 1.2 // chừa chỗ cho số trên cột
  return (
    <div className="chart">
      <div className="chart-plot">
        <div className="chart-goal" style={{ bottom: (goal / maxV) * 100 + '%' }}><i>Mục tiêu {goal}′</i></div>
        {days.map((d) => (
          <div className="cbar" key={d.date} title={d.min + ' phút'}>
            {d.min > 0 && <span className="cbar-num">{d.min}</span>}
            <div className={'cbar-fill' + (d.min >= goal ? ' met' : '') + (d.isToday ? ' today' : '')}
              style={{ height: Math.max(d.min > 0 ? 4 : 0, (d.min / maxV) * 100) + '%' }} />
          </div>
        ))}
      </div>
      <div className="chart-x">
        {days.map((d) => <span key={d.date} className={d.isToday ? 'on' : ''}>{d.label}</span>)}
      </div>
    </div>
  )
}

export default function ParentDashboard({ mem, session, stats, onSettings, toast }) {
  const concepts = conceptStatusList(mem)
  const pct = session ? Math.round((session.correct / session.total) * 100) : null
  const summary = parentSummary(mem, session)
  const total = totalMinutes(stats)
  const todayM = todayMinutes(stats)
  const met = goalMetCount(stats)
  const goalToday = todayM >= stats.goalMin

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
        <div className="stat"><div className="stat-v">{todayM}′</div><div className="stat-k">Học hôm nay</div></div>
      </div>

      <section className="study">
        <div className="study-head">
          <h3>Thời gian học (7 ngày)</h3>
          <span className={'goal-pill' + (goalToday ? ' met' : '')}>{goalToday ? '✓ Đạt mục tiêu hôm nay' : `Mục tiêu ${stats.goalMin}′/ngày`}</span>
        </div>
        <StudyChart stats={stats} />
        <div className="study-foot">
          <div><b>{hm(total)}</b><span>Tổng thời gian học</span></div>
          <div><b>{met}/7</b><span>Ngày đạt mục tiêu</span></div>
        </div>
      </section>

      <div className="ai-summary">
        <div className="ai-ic">✨</div>
        <div>
          <div className="ai-label">Nhận xét cho con</div>
          <p>{summary}</p>
        </div>
      </div>

      <section className="kmap">
        <h3>Bản đồ kiến thức</h3>
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

      <button className="cta" onClick={onSettings}>⚙️ Mục tiêu &amp; bật/tắt trắc nghiệm</button>

      <footer className="foot">
        Bản demo · Số liệu minh hoạ. Bản thật cập nhật theo kết quả ôn thực tế của con.
      </footer>
    </div>
  )
}
