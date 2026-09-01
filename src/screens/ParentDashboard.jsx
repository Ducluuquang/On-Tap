import { useState } from 'react'
import { Brand, StatusPill, MasteryBar, RewardTrack } from '../components.jsx'
import { conceptStatusList } from '../lib/mockAI.js'
import { last7, totalMinutes, todayMinutes, streakDays, dayReport } from '../lib/stats.js'

const WD = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7']

function hm(min) {
  const h = Math.floor(min / 60), m = min % 60
  return h ? `${h} giờ ${m} phút` : `${m} phút`
}

function isoToday() { return new Date().toISOString().slice(0, 10) }
function dayLabel(iso) {
  const d = new Date(iso + 'T00:00:00')
  const base = `${WD[d.getDay()]} ${d.getDate()}/${d.getMonth() + 1}`
  return iso === isoToday() ? `${base} (hôm nay)` : base
}
function pctOf(r) { return r.reviewed ? Math.round((r.correct / r.reviewed) * 100) : 0 }
function dayComment(r) {
  if (!r.reviewed) return 'Chưa có dữ liệu.'
  const p = pctOf(r)
  if (p >= 85) return `Con làm rất tốt (${p}% đúng) — nắm chắc bài. 👏`
  if (p >= 65) return `Con làm khá ổn (${p}% đúng), nên xem lại vài câu còn sai.`
  if (p >= 40) return `Con đúng ${p}% — cần luyện thêm phần này.`
  return `Con mới đúng ${p}% — nên ôn kỹ lại phần này cùng con.`
}

function StudyChart({ stats, sel, onSel }) {
  const days = last7(stats)
  const goal = stats.goalMin
  const maxV = Math.max(goal, ...days.map((d) => d.min), 1) * 1.2 // chừa chỗ cho số trên cột
  return (
    <div className="chart">
      <div className="chart-plot">
        <div className="chart-goal" style={{ bottom: (goal / maxV) * 100 + '%' }}><i>Mục tiêu {goal}′</i></div>
        {days.map((d) => (
          <button type="button" className={'cbar' + (d.date === sel ? ' sel' : '')} key={d.date}
            onClick={() => onSel(d.date)} title="Bấm để xem nhận xét ngày này">
            {d.min > 0 && <span className="cbar-num">{d.min}</span>}
            <div className={'cbar-fill' + (d.min >= goal ? ' met' : '') + (d.isToday ? ' today' : '')}
              style={{ height: Math.max(d.min > 0 ? 4 : 0, (d.min / maxV) * 100) + '%' }} />
          </button>
        ))}
      </div>
      <div className="chart-x">
        {days.map((d) => (
          <span key={d.date} className={(d.isToday ? 'on' : '') + (d.date === sel ? ' sel' : '')}>{d.label}</span>
        ))}
      </div>
    </div>
  )
}

export default function ParentDashboard({ mem, stats, onSettings, toast }) {
  const concepts = conceptStatusList(mem)
  const total = totalMinutes(stats)
  const todayM = todayMinutes(stats)
  const streak = streakDays(stats) // DÙNG CHUNG với thẻ phần thưởng -> luôn khớp nhau
  const goalToday = todayM >= stats.goalMin

  // Ngày đang xem trong phần "Nhận xét": mặc định là ngày GẦN NHẤT có ôn bài.
  const days7 = last7(stats)
  const defaultDay = ([...days7].reverse().find((d) => dayReport(stats, d.date).length) || days7[days7.length - 1]).date
  const [selDay, setSelDay] = useState(defaultDay)
  const report = dayReport(stats, selDay)

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

      <section className="study">
        <div className="study-head">
          <h3>Thời gian học (7 ngày)</h3>
          <span className={'goal-pill' + (goalToday ? ' met' : '')}>{goalToday ? '✓ Đạt mục tiêu hôm nay' : `Mục tiêu ${stats.goalMin}′/ngày`}</span>
        </div>
        <StudyChart stats={stats} sel={selDay} onSel={setSelDay} />
        <div className="study-foot">
          <div><b>{hm(total)}</b><span>Tổng thời gian học</span></div>
          <div><b>{streak} ngày</b><span>Đạt mục tiêu liên tiếp</span></div>
        </div>
      </section>

      {/* Đường đến phần thưởng — DÙNG CHUNG với trang Con nên số ngày luôn khớp nhau */}
      <RewardTrack stats={stats} />

      {/* Nhận xét theo NGÀY: bấm cột ngày ở biểu đồ trên để xem chi tiết từng ngày */}
      <div className="daynote">
        <div className="daynote-head">
          <span className="daynote-ic">📌</span>
          <div className="ai-label">Nhận xét cho con · {dayLabel(selDay)}</div>
        </div>
        {report.length === 0 ? (
          <p className="daynote-empty">Ngày này con chưa ôn bài. Bấm một cột khác ở biểu đồ để xem ngày có học.</p>
        ) : (
          report.map((r) => (
            <div className="subj-block" key={r.subject}>
              <div className="subj-name">{r.subject}</div>
              <p className="subj-comment">{dayComment(r)}</p>
              <ul className="subj-bullets">
                <li>Số câu ôn tập: <b>{r.reviewed}</b> câu</li>
                <li>Làm đúng: <b>{r.correct}</b> câu</li>
                <li>Làm sai: <b>{r.wrong}</b> câu</li>
                <li>Thời gian ôn môn {r.subject}: <b>{Math.max(1, Math.round(r.sec / 60))}</b> phút</li>
              </ul>
            </div>
          ))
        )}
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
