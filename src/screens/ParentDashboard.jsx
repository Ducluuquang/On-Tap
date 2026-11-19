import { useEffect, useState } from 'react'
import { BackHeader, StatusPill, MasteryBar, RewardTrack } from '../components.jsx'
import { conceptStatusList } from '../lib/mockAI.js'
import { last7, totalMinutes, todayMinutes, streakDays, dayReport, nextReward, prevReward } from '../lib/stats.js'
import { subjectDisplayName, subjectIcon, subjectKey, subjectTone } from '../lib/subjects.js'
import { needsReview } from '../lib/review.js'
import { iconFor } from '../lib/icons.js'
import { isVocabGroup } from '../lib/topics.js'
import { fetchUnread, viewerOf } from '../lib/feedback.js'
import logoMark from '../assets/logo-mark.png'

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

// SỐ LIỆU CỦA TRANG BÁO CÁO — dùng CHUNG cho bản điện thoại và bản máy tính (không chép đôi cách tính):
// bản đồ kiến thức nhóm theo môn, thời gian học, chuỗi ngày, ngày đang xem ở phần "Nhận xét", môn đang lọc.
function useReport(mem, stats) {
  const allConcepts = conceptStatusList(mem)
  // Các môn con đã có bài (theo tên hiển thị) — để phụ huynh CHỌN môn xem báo cáo.
  const subjectNames = [...new Set((mem || []).map((c) => subjectDisplayName(c.subject)).filter(Boolean))]
  const [subjView, setSubjView] = useState('all')
  const activeSubj = subjView !== 'all' && subjectNames.includes(subjView) ? subjView : 'all'

  // Lọc bản đồ kiến thức theo môn đang xem.
  const concepts = activeSubj === 'all' ? allConcepts : allConcepts.filter((c) => subjectDisplayName(c.subject) === activeSubj)
  // NHÓM THEO MÔN (TIẾNG ANH / TOÁN / LỊCH SỬ…). Danh sách đã xếp "mới nhất lên trên" nên môn nào
  // con học/thêm gần nhất sẽ đứng đầu; trong mỗi môn, chủ đề mới nhất cũng đứng đầu.
  const groups = []
  const byName = new Map()
  for (const c of concepts) {
    const s = subjectDisplayName(c.subject)
    if (!byName.has(s)) { const g = { subject: s, items: [] }; byName.set(s, g); groups.push(g) }
    byName.get(s).items.push(c)
  }
  // Màu riêng của từng môn (cùng quy tắc với trang của con): môn khác lần lượt vàng, tím, xanh ngọc, cam.
  let other = 0
  const toneOf = new Map(subjectNames.map((n) => [n, subjectKey(n) === 'default' ? subjectTone(n, other++) : subjectTone(n)]))
  const total = totalMinutes(stats)
  const todayM = todayMinutes(stats)
  const streak = streakDays(stats) // DÙNG CHUNG với thẻ phần thưởng -> luôn khớp nhau
  const goalToday = todayM >= stats.goalMin

  // Ngày đang xem trong phần "Nhận xét": mặc định là ngày GẦN NHẤT có ôn bài.
  const days7 = last7(stats)
  const defaultDay = ([...days7].reverse().find((d) => dayReport(stats, d.date).length) || days7[days7.length - 1]).date
  const [selDay, setSelDay] = useState(defaultDay)
  // Nhật ký theo ngày, lọc theo môn đang xem.
  const reportAll = dayReport(stats, selDay)
  const report = activeSubj === 'all' ? reportAll : reportAll.filter((r) => subjectDisplayName(r.subject) === activeSubj)
  return { subjectNames, activeSubj, setSubjView, groups, toneOf, total, todayM, streak, goalToday, days7, selDay, setSelDay, report }
}

// Biểu đồ 7 ngày của bản máy tính: cột rộng tối đa 58 px, nhãn "thứ + dd/mm" (hôm nay: "Hôm nay"), đường mục tiêu.
function DeskChart({ stats, days, sel, onSel }) {
  const goal = stats.goalMin
  const maxV = Math.max(goal, ...days.map((d) => d.min), 1) * 1.2
  return (
    <div className="dk-chart">
      <div className="dk-plot">
        <div className="dk-goal" style={{ bottom: (goal / maxV) * 100 + '%' }}><i>Mục tiêu {goal}′</i></div>
        {days.map((d) => (
          <button type="button" key={d.date} data-date={d.date} className={'dk-bar' + (d.date === sel ? ' sel' : '')} onClick={() => onSel(d.date)}
            title="Bấm để xem nhận xét ngày này" aria-pressed={d.date === sel}>
            <span>{d.min > 0 ? d.min : ''}</span>
            <div className={(d.min >= goal ? 'met' : '') + (d.isToday ? ' today' : '')} style={{ height: Math.max(d.min > 0 ? 2 : 0, (d.min / maxV) * 100) + '%' }} />
          </button>
        ))}
      </div>
      <div className="dk-xl">
        {days.map((d) => {
          const dt = new Date(d.date + 'T00:00:00')
          return <span key={d.date} className={d.date === sel ? 'on' : ''}>{d.label}<small>{d.isToday ? 'Hôm nay' : `${String(dt.getDate()).padStart(2, '0')}/${String(dt.getMonth() + 1).padStart(2, '0')}`}</small></span>
        })}
      </div>
    </div>
  )
}

// viewer = 'parent' (đầy đủ: sửa môn, vào cài đặt) | 'child' (học sinh CHỈ XEM báo cáo của mình).
// kids + onViewChild: hàng icon các con ở tab Phụ huynh — bấm icon để xem báo cáo của con đó.
// desk: bản máy tính (≥ 1024 px, mẫu d 19/11/2026) — chỉ cho phụ huynh; học sinh tự xem vẫn là cột điện thoại.
export default function ParentDashboard({ mem, stats, child, kids = [], onViewChild, viewer = 'parent', desk = false, onBack, onSettings, onFeedback, toast }) {
  const [fbUnread, setFbUnread] = useState(0)   // góp ý có câu trả lời mới (chấm đỏ)
  useEffect(() => { if (onFeedback) fetchUnread(viewerOf('parent')).then(setFbUnread).catch(() => {}) }, [!!onFeedback]) // eslint-disable-line react-hooks/exhaustive-deps
  const isKid = viewer === 'child'
  const childName = (child && child.name) || 'con'
  const R = useReport(mem, stats)
  const { subjectNames, activeSubj, setSubjView, groups, total, todayM, streak, goalToday, selDay, setSelDay, report } = R

  if (desk && !isKid) return deskView()

  return (
    <div className="screen">
      {toast && <div className="toast">{toast}</div>}
      {isKid ? (
        <BackHeader title="Báo cáo học tập" onBack={onBack} />
      ) : (
        // Tab Phụ huynh: BIỂU TƯỢNG logo bên trái (không kèm chữ) + ICON + TÊN các con.
        // Bấm icon con nào -> xem báo cáo con đó (dòng "Hôm nay của …" đổi theo).
        <div className="parenthead">
          <img className="logo-mark" src={logoMark} alt="Ôn Tập" />
          <nav className="kidswitch" aria-label="Chọn con để xem báo cáo">
            {kids.map((k) => (
              <button key={k.id} type="button" className={'kid' + (child && k.id === child.id ? ' on' : '')}
                aria-pressed={!!(child && k.id === child.id)} onClick={() => onViewChild && onViewChild(k)}>
                <span className="kid-ava">{iconFor(k)}</span>
                <span className="kid-name">{k.name}</span>
              </button>
            ))}
          </nav>
        </div>
      )}

      <section className="hello">
        <h1>{isKid ? `Kết quả học của ${childName}` : `Hôm nay của ${childName}`}</h1>
        <p>{isKid ? 'Xem lại mình đã học thế nào nhé! 💪' : 'Mở 10 giây là biết con học thế nào.'}</p>
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

      {/* Chọn môn để xem báo cáo (không dồn mọi môn thành 1 dọc dài) */}
      {subjectNames.length > 1 && (
        <div className="subjfilter">
          <span className="subjfilter-lbl">Xem báo cáo môn:</span>
          <div className="chips">
            <button className={'chip' + (activeSubj === 'all' ? ' on' : '')} onClick={() => setSubjView('all')}>Tất cả</button>
            {subjectNames.map((s) => (
              <button key={s} className={'chip' + (activeSubj === s ? ' on' : '')} onClick={() => setSubjView(s)}>{subjectIcon(s)} {s}</button>
            ))}
          </div>
        </div>
      )}

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
        {groups.length === 0 && <p className="cr-hint">Chưa có dữ liệu. Con chụp/thêm bài học để bắt đầu ghi bản đồ kiến thức.</p>}
        {groups.map((g) => (
          <div className="kgroup" key={g.subject}>
            <div className="kgroup-h">
              <span className="kgroup-ic">{subjectIcon(g.subject)}</span>
              <span className="kgroup-name">{g.subject}</span>
              <span className="kgroup-count">{g.items.length} chủ đề</span>
            </div>
            {g.items.map((c) => (
              <div className="krow" key={c.id}>
                <div className="krow-top">
                  <span className="kname">{c.name}</span>
                  <StatusPill status={c.status} />
                </div>
                {c.details && c.details.length > 0 && (
                  <div className="kdet" title={c.details.join(' · ')}>{c.details.length} {isVocabGroup(c.name) ? 'từ' : 'ý'}: {c.details.join(' · ')}</div>
                )}
                <div className="krow-bar">
                  <MasteryBar value={c.mastery} status={c.status} />
                  <span className="kpct">{c.mastery}%</span>
                </div>
              </div>
            ))}
          </div>
        ))}
      </section>

      {/* Cài đặt (mục tiêu, bật/tắt trắc nghiệm) chỉ dành cho PHỤ HUYNH — học sinh chỉ xem báo cáo. */}
      {!isKid && onSettings && (
        <button className="cta" onClick={onSettings}>⚙️ Mục tiêu &amp; bật/tắt trắc nghiệm</button>
      )}
      {!isKid && onFeedback && (
        <button className="cta ghost pd-fb" onClick={onFeedback}>💬 Góp ý / báo lỗi cho Ôn Tập{fbUnread ? <i className="dot" aria-label="có trả lời mới" /> : null}</button>
      )}

      <footer className="foot">
        Số liệu cập nhật theo kết quả ôn thực tế của con.
      </footer>
    </div>
  )
  // ================= BẢN MÁY TÍNH =================
  function deskView() {
    const goal = stats.goalMin
    const leftMin = Math.max(0, goal - todayM)
    const week = R.days7.reduce((a, d) => a + d.min, 0)
    // chuỗi ngày + quà: cùng cách tính với RewardTrack (trang của con)
    const next = nextReward(streak), prev = prevReward(streak)
    const span = Math.max(1, next - prev), into = Math.max(0, Math.min(span, streak - prev))
    // chủ đề cần ôn: cùng cách đếm với "Có N chủ đề đang chờ con ôn" ở trang con
    const need = (mem || []).filter(needsReview)
    const needBy = new Map()
    for (const c of need) { const n = subjectDisplayName(c.subject); needBy.set(n, (needBy.get(n) || 0) + 1) }
    const needLine = need.length ? [...needBy.entries()].sort((a, b) => b[1] - a[1]).map(([n, k]) => `${n} ${k}`).join(' · ') : 'Không có chủ đề nào cần ôn 👏'
    const tone = (n) => R.toneOf.get(subjectDisplayName(n)) || subjectTone(n, 0)
    return (
      <div className="dk-dash">
        {toast && <div className="toast">{toast}</div>}
        <div className="dk-toprow">
          <nav className="dk-kidnav" aria-label="Chọn con để xem báo cáo">
            {kids.map((k) => (
              <button key={k.id} type="button" className={'dk-kid' + (child && k.id === child.id ? ' on' : '')}
                aria-pressed={!!(child && k.id === child.id)} onClick={() => onViewChild && onViewChild(k)}>
                <span className="dk-kid-ava">{iconFor(k)}</span>
                <span className="dk-kid-t"><b>{k.name}</b><em>{k.grade || 'Chưa đặt lớp'}</em></span>
              </button>
            ))}
          </nav>
          <div className="dk-acts">
            {onSettings && <button className="cta ghost dk-sm" onClick={onSettings}>⚙️ Mục tiêu &amp; bật/tắt trắc nghiệm</button>}
            {onFeedback && <button className="cta ghost dk-sm pd-fb" onClick={onFeedback}>💬 Góp ý / báo lỗi cho Ôn Tập{fbUnread ? <i className="dot" aria-label="có trả lời mới" /> : null}</button>}
          </div>
        </div>

        <section className="dk-hello">
          <h1>Hôm nay của {childName}</h1>
          <p>Mở 10 giây là biết con học thế nào.</p>
        </section>

        <section className="dk-kpis" data-testid="pd-kpis">
          <div className="dk-card dk-kpi" data-k="today">
            <span className="k">Hôm nay</span>
            <span className="v">{todayM} <small>/ {goal} phút</small></span>
            <div className={'dk-prog' + (goalToday ? ' met' : '')}><i style={{ width: Math.min(100, (todayM / Math.max(1, goal)) * 100) + '%' }} /></div>
            <span className="s">{goalToday ? '✓ Đạt mục tiêu hôm nay' : `Còn ${leftMin} phút nữa là đạt mục tiêu`}</span>
          </div>
          <div className="dk-card dk-kpi" data-k="total">
            <span className="k">Tổng thời gian học</span>
            <span className="v">{hm(total)}</span>
            <span className="s">7 ngày qua: {hm(week)}</span>
          </div>
          <div className="dk-card dk-kpi" data-k="streak">
            <span className="k">Đạt mục tiêu liên tiếp</span>
            <span className="v">🔥 {streak} ngày</span>
            {span <= 12 ? (
              <div className="dk-segs" aria-label={`${into}/${span} ngày`}>{Array.from({ length: span }).map((_, i) => <i key={i} className={i < into ? 'on' : ''} title={`Ngày ${prev + i + 1}`} />)}</div>
            ) : (
              <div className="dk-prog met"><i style={{ width: (into / span) * 100 + '%' }} /></div>
            )}
            <span className="s">Còn {Math.max(0, next - streak)} ngày nữa tới quà 🎁</span>
          </div>
          <div className={'dk-card dk-kpi' + (need.length ? ' warn' : '')} data-k="need">
            <span className="k">Chủ đề cần ôn</span>
            <span className="v">{need.length} <small>/ {(mem || []).length} chủ đề</small></span>
            <span className="s">{needLine}</span>
          </div>
        </section>

        <div className="dk-row75">
          <section className="dk-card dk-box">
            <div className="dk-box-h">
              <h3>Thời gian học (7 ngày)</h3>
              <span className={'goal-pill' + (goalToday ? ' met' : '')}>{goalToday ? '✓ Đạt mục tiêu hôm nay' : `Mục tiêu ${goal}′/ngày`}</span>
            </div>
            <DeskChart stats={stats} days={R.days7} sel={selDay} onSel={setSelDay} />
            <div className="dk-chart-foot">
              <span className="dk-lg"><i className="met" />Đạt mục tiêu</span>
              <span className="dk-lg"><i />Chưa đạt</span>
              <span className="dk-lg"><i className="goal" />Mục tiêu mỗi ngày</span>
              <span className="dk-chart-hint">Bấm một cột để xem ngày đó →</span>
            </div>
          </section>
          <section className="dk-card dk-box dk-note">
            <div className="dk-note-h"><span aria-hidden="true">📌</span><h3>Nhận xét cho con · {dayLabel(selDay)}</h3></div>
            {report.length === 0 ? (
              <p className="daynote-empty">Ngày này con chưa ôn bài. Bấm một cột khác ở biểu đồ để xem ngày có học.</p>
            ) : report.map((r) => (
              <div className="dk-subj" key={r.subject}>
                <span className={'dk-sname tone-' + tone(r.subject)}>{subjectIcon(r.subject)} {subjectDisplayName(r.subject)}</span>
                <p>{dayComment(r)}</p>
                <div className="dk-mini">
                  <div><b>{r.reviewed}</b><span>câu ôn</span></div>
                  <div><b className="ok">{r.correct}</b><span>đúng</span></div>
                  <div><b className="no">{r.wrong}</b><span>sai</span></div>
                  <div><b>{Math.max(1, Math.round(r.sec / 60))}′</b><span>thời gian</span></div>
                </div>
              </div>
            ))}
          </section>
        </div>

        <section className="dk-card dk-kmap">
          <div className="dk-kmap-h">
            <h3>Bản đồ kiến thức</h3>
            <div className="dk-legend">
              <span className="dk-lg"><i className="fill-weak" />Cần ôn</span>
              <span className="dk-lg"><i className="fill-strong" />Vững</span>
              <span className="dk-lg"><i className="fill-mastered" />Thành thạo</span>
              <span className="dk-lg"><i className="fill-new" />Mới</span>
            </div>
            {subjectNames.length > 1 && (
              <div className="chips subjfilter">
                <button className={'chip' + (activeSubj === 'all' ? ' on' : '')} onClick={() => setSubjView('all')}>Tất cả</button>
                {subjectNames.map((s) => (
                  <button key={s} className={'chip' + (activeSubj === s ? ' on' : '')} onClick={() => setSubjView(s)}>{subjectIcon(s)} {s}</button>
                ))}
              </div>
            )}
          </div>
          {groups.length === 0 && <p className="cr-hint">Chưa có dữ liệu. Con chụp/thêm bài học để bắt đầu ghi bản đồ kiến thức.</p>}
          <div className="dk-cols">
            {groups.map((g) => (
              <div className={'dk-grp tone-' + tone(g.subject)} key={g.subject} data-subject={g.subject}>
                <div className="dk-grp-h"><span className="ic">{subjectIcon(g.subject)}</span>{g.subject}<small>{g.items.length} chủ đề</small></div>
                {g.items.map((c) => (
                  <div className="dk-kr" key={c.id}>
                    <div className="dk-kr-top"><b>{c.name}</b><StatusPill status={c.status} /></div>
                    {c.details && c.details.length > 0 && (
                      <div className="kdet" title={c.details.join(' · ')}>{c.details.length} {isVocabGroup(c.name) ? 'từ' : 'ý'}: {c.details.join(' · ')}</div>
                    )}
                    <div className="dk-kbar"><MasteryBar value={c.mastery} status={c.status} /><span>{c.mastery}%</span></div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </section>
        <p className="dk-foot-note">Số liệu cập nhật theo kết quả ôn thực tế của con.</p>
      </div>
    )
  }
}
