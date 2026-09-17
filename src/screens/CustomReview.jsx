import { useState } from 'react'
import { BackHeader } from '../components.jsx'
import { selectConcepts, describeSelection } from '../lib/review.js'
import { subjectsFromMem, subjectDisplayName, subjectModes, subjectKey } from '../lib/subjects.js'

// MỨC ĐỘ — gọn còn 5, mỗi mức 1 icon dễ hiểu cho học sinh.
// (Bỏ "Chưa thành thạo" -> gộp vào "Cần ôn nhất". "Master" giữ lại: tạo động lực chinh phục.)
const LEVELS = [
  { k: 'weak', l: 'Cần ôn nhất', icon: '🎯' },
  { k: 'wrong', l: 'Câu từng sai', icon: '🔁' },
  { k: 'new', l: 'Chưa học', icon: '🆕' },
  { k: 'all', l: 'Ôn tổng hợp', icon: '🎲' },
  { k: 'master', l: 'Thử thách Master', icon: '🏆' },
]
// Số câu — kèm ước lượng thời gian (~0.8 phút/câu) để trẻ biết "học bao lâu".
const COUNTS = [10, 15, 20, 25]
// Phạm vi bài học (đưa vào phần NÂNG CAO — bình thường không cần chọn).
const TIMES = [
  { k: 'week', l: '7 ngày' }, { k: 'month', l: '30 ngày' },
  { k: 'three', l: '3 tháng' }, { k: 'all', l: 'Tất cả' },
]
// Phong cách học tập: cách con TRẢ LỜI.
const STYLES = [
  { k: 'quiz', l: 'Trắc nghiệm', choice: true },
  { k: 'typed', l: 'Điền đáp án ✍️', choice: false },
  { k: 'finderror', l: 'Tìm lỗi sai 🔎', choice: true },
]
// 6 game vui (đều dạng trắc nghiệm).
const GAMES = [
  { k: 'falling', l: 'Thả rơi ⏱' }, { k: 'balloon', l: 'Bắn bóng 🎯' }, { k: 'sushi', l: 'Xếp sushi 🍣' },
  { k: 'boss', l: 'Boss Battle 👾' }, { k: 'quickfire', l: 'Quick Fire ⏱' }, { k: 'mario', l: 'Mario nhảy 🍄' },
]

// Ước lượng thời gian theo số câu (~0.8 phút/câu, tối thiểu 1 phút).
function estMinutes(n) { return Math.max(1, Math.round((n || 0) * 0.8)) }

// "Cần ôn" = chưa thành thạo (mastery < 80) HOẶC chưa ôn lần nào.
// Đây là con số HIỂN THỊ trên thẻ gợi ý và trên từng chip môn (rõ nghĩa, tạo động lực "clear").
function needReviewCount(list) {
  return (list || []).filter((c) => (c.reviews || 0) === 0 || (c.mastery || 0) < 80).length
}

export default function CustomReview({ mem, onStart, onBack, allowChoice = true }) {
  const subjectList = subjectsFromMem(mem)
  const [subject, setSubject] = useState(subjectList[0]?.name || 'Toán')
  const [time, setTime] = useState('all')
  const [level, setLevel] = useState('weak')
  const [text, setText] = useState('')
  const [count, setCount] = useState(10)
  const [mode, setMode] = useState(allowChoice ? 'quiz' : 'typed')
  const [enLang, setEnLang] = useState('vi') // ngôn ngữ YÊU CẦU của đề Tiếng Anh: 'vi' | 'en'
  const [advOpen, setAdvOpen] = useState(false) // Tuỳ chỉnh nâng cao — đóng sẵn (giảm lựa chọn ban đầu)

  const isEnglish = subjectKey(subject) === 'tieng-anh'
  // Chỉ ôn trong MÔN đang chọn (không trộn môn khác).
  const memSub = (mem || []).filter((c) => subjectDisplayName(c.subject) === subject)
  // Chế độ chơi phù hợp với môn (vd "Tìm lỗi sai" chỉ cho môn ngôn ngữ).
  const allowed = subjectModes(subject)
  const styles = STYLES.filter((m) => (allowChoice || !m.choice) && allowed.includes(m.k))
  const games = GAMES.filter((g) => allowed.includes(g.k))

  const isMaster = level === 'master'
  const names = selectConcepts(memSub, { time, level, text })
  const canStart = names.length > 0 // có ít nhất 1 khái niệm/chủ đề để ra đề

  // ===== THẺ GỢI Ý (hero) — hệ thống tự quyết định bài đáng ôn nhất =====
  const needCount = needReviewCount(memSub)
  const heroLevel = needCount > 0 ? 'weak' : 'all' // đã vững hết -> ôn tổng hợp giữ phong độ
  const heroNames = selectConcepts(memSub, { time: 'all', level: heroLevel, text: '' })
  const heroTopics = heroNames.slice(0, 2).join(' • ')

  // Đổi môn: nếu chế độ đang chọn không hợp môn mới thì đưa về mặc định an toàn.
  function pickSubject(s) {
    setSubject(s)
    if (!subjectModes(s).includes(mode)) setMode(allowChoice ? 'quiz' : 'typed')
  }

  function pickLevel(k) {
    setLevel(k)
    if (k !== 'master') setText('')
    else setAdvOpen(true) // Master cần gõ chủ đề -> mở luôn phần nâng cao
  }

  // ÔN NGAY theo gợi ý: 10 câu, phần cần ôn nhất (hoặc tổng hợp nếu đã vững hết), chế độ mặc định của môn.
  function startHero() {
    const defMode = allowChoice ? 'quiz' : 'typed'
    const useMode = subjectModes(subject).includes(defMode) ? defMode : 'typed'
    onStart({
      title: `${subject} · ${describeSelection({ time: 'all', level: heroLevel, text: '' })}`,
      conceptNames: heroNames, count: 10, mode: useMode, subject,
      enLang: isEnglish ? enLang : undefined,
      master: false, masterText: '',
    })
  }

  // BẮT ĐẦU ÔN theo lựa chọn của người dùng (thanh dính đáy).
  function start() {
    if (!canStart) return
    onStart({
      title: `${subject} · ${describeSelection({ time, level, text })}`,
      conceptNames: names, count, mode, subject,
      enLang: isEnglish ? enLang : undefined,
      master: isMaster,
      masterText: isMaster ? text.trim() : '',
    })
  }

  const stickySub = isMaster
    ? `Master 🏆 · ${text.trim() || 'phần yếu nhất'}`
    : describeSelection({ time, level, text })

  return (
    <div className="screen cr">
      <BackHeader title="Bắt đầu ôn" onBack={onBack} />

      {/* ===== TẦNG 1 — Thẻ gợi ý "ÔN NGAY" (điểm nhấn lớn nhất) ===== */}
      <div className="cr-hero">
        <div className="cr-hero-tag">🎯 Ôn tập đề xuất</div>
        {memSub.length === 0 ? (
          <>
            <div className="cr-hero-big">Chưa có bài học môn {subject}</div>
            <p className="cr-hero-sub">Bấm “Thêm bài học hôm nay”, hoặc gõ chủ đề muốn ôn ở phần “Tuỳ chỉnh nâng cao” bên dưới.</p>
          </>
        ) : (
          <>
            <div className="cr-hero-big">
              {needCount > 0 ? `${needCount} chủ đề cần ôn` : 'Ôn tổng hợp giữ phong độ'}
            </div>
            <p className="cr-hero-sub">
              {heroTopics ? `${heroTopics} · ` : ''}10 câu · ~{estMinutes(10)} phút
            </p>
            <button className="cr-hero-cta" onClick={startHero}>▶ ÔN NGAY</button>
          </>
        )}
      </div>

      {/* ===== TẦNG 2 — Tự chọn bài ôn (thẻ trắng, phân cấp dưới hero) ===== */}
      <div className="cr-tier">
        <div className="cr-tier-h">Tự chọn bài ôn</div>

        <div className="cr-sec">
          <h3>Môn</h3>
          <div className="chips">
            {subjectList.map((s) => {
              const sub = (mem || []).filter((c) => subjectDisplayName(c.subject) === s.name)
              const need = needReviewCount(sub)
              return (
                <button key={s.name} className={'chip chip-subj' + (subject === s.name ? ' on' : '')} onClick={() => pickSubject(s.name)}>
                  <span className="cs-name">{s.icon} {s.name}</span>
                  <span className={'cs-need' + (need > 0 ? '' : ' cs-ok')}>{need > 0 ? `${need} cần ôn` : 'đã vững'}</span>
                </button>
              )
            })}
          </div>
        </div>

        {isEnglish && (
          <div className="cr-sec">
            <h3>Ngôn ngữ đề Tiếng Anh</h3>
            <div className="chips">
              <button className={'chip' + (enLang === 'vi' ? ' on' : '')} onClick={() => setEnLang('vi')}>Yêu cầu tiếng Việt</button>
              <button className={'chip' + (enLang === 'en' ? ' on' : '')} onClick={() => setEnLang('en')}>Yêu cầu tiếng Anh</button>
            </div>
            <p className="cr-hint">Từ vựng và đáp án vẫn bằng tiếng Anh. Chọn “tiếng Việt” nếu con chưa đọc hiểu được yêu cầu bằng tiếng Anh — con chỉ cần chọn đáp án đúng.</p>
          </div>
        )}

        <div className="cr-sec">
          <h3>Muốn ôn gì?</h3>
          <div className="chips chips-lv">
            {LEVELS.map((o) => (
              <button
                key={o.k}
                className={'chip chip-lv' + (level === o.k ? ' on' : '') + (o.k === 'master' ? ' chip-master' : '')}
                onClick={() => pickLevel(o.k)}
              ><span className="lv-ic">{o.icon}</span> {o.l}</button>
            ))}
          </div>
          {isMaster && (
            <p className="cr-master-note">🏆 <b>Master</b>: gõ <b>một hoặc nhiều chủ đề</b> (cách nhau bằng dấu phẩy) ở ô “Yêu cầu cụ thể” bên dưới. App ra bài <b>nâng cao &amp; KẾT HỢP</b> bài khó của các chủ đề đó để con thật sự thành thạo.</p>
          )}
        </div>

        <div className="cr-sec">
          <h3>Thời lượng</h3>
          <div className="chips chips-count">
            {COUNTS.map((n) => (
              <button key={n} className={'chip chip-count' + (count === n ? ' on' : '')} onClick={() => setCount(n)}>
                <span className="cc-n">{n} câu</span>
                <span className="cc-t">~{estMinutes(n)} phút</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ===== TẦNG 3 — Tuỳ chỉnh nâng cao (thu gọn) ===== */}
      <div className={'cr-adv' + (advOpen ? ' open' : '')}>
        <button className="cr-adv-toggle" onClick={() => setAdvOpen((v) => !v)}>
          <span>⚙ Tuỳ chỉnh nâng cao</span>
          <span className="cr-adv-caret">{advOpen ? '▲' : '▼'}</span>
        </button>
        {!advOpen && <p className="cr-adv-cap">Chủ đề cụ thể · phạm vi thời gian · phong cách học · games</p>}

        {advOpen && (
          <div className="cr-adv-body">
            <div className="cr-sec">
              <h3>Yêu cầu cụ thể</h3>
              <input
                className="cr-input"
                placeholder={isMaster ? 'Nhiều chủ đề, cách nhau bằng dấu phẩy. Vd: nhân số hai chữ số, tìm x, diện tích hình chữ nhật' : 'vd: ôn phần con hay sai, ôn topic yếu nhất…'}
                value={text}
                onChange={(e) => setText(e.target.value)}
              />
              {memSub.length > 0 && (
                <select
                  className="cr-select"
                  value=""
                  onChange={(e) => {
                    const v = e.target.value
                    if (!v) return
                    if (isMaster) setText((t) => (t.trim() ? t.trim().replace(/[,\s]*$/, '') + ', ' + v : v))
                    else setText(v)
                  }}
                >
                  <option value="">{isMaster ? '— Thêm chủ đề từ bản đồ kiến thức —' : '— Hoặc chọn chủ đề từ bản đồ kiến thức —'}</option>
                  {memSub.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
                </select>
              )}
              <p className="cr-hint">
                {isMaster
                  ? 'Gõ 1 hoặc nhiều chủ đề (cách nhau bằng dấu phẩy) — App sẽ kết hợp bài khó của các chủ đề. Bỏ trống thì master phần con đang yếu nhất.'
                  : 'Gõ yêu cầu sẽ ưu tiên hơn lựa chọn mức độ ở trên.'}
              </p>
            </div>

            <div className="cr-sec">
              <h3>Phạm vi bài học</h3>
              <div className="chips">
                {TIMES.map((o) => (
                  <button key={o.k} className={'chip' + (time === o.k ? ' on' : '')} onClick={() => setTime(o.k)}>{o.l}</button>
                ))}
              </div>
            </div>

            <div className="cr-sec">
              <h3>Phong cách học</h3>
              <div className={'chips' + (styles.length === 3 ? ' chips-3' : '')}>
                {styles.map((o) => (
                  <button key={o.k} className={'chip' + (mode === o.k ? ' on' : '')} onClick={() => setMode(o.k)}>{o.l}</button>
                ))}
              </div>

              {allowChoice && games.length > 0 && (
                <>
                  <p className="cr-sub">Games</p>
                  <div className="chips chips-2row">
                    {games.map((o) => (
                      <button key={o.k} className={'chip' + (mode === o.k ? ' on' : '')} onClick={() => setMode(o.k)}>{o.l}</button>
                    ))}
                  </div>
                </>
              )}
              {!allowChoice && <p className="cr-hint">Phụ huynh đã tắt trắc nghiệm — con tự nghĩ và điền đáp án ✍️</p>}
            </div>
          </div>
        )}
      </div>

      {/* Chừa chỗ để nội dung không bị thanh CTA dính đáy che mất */}
      <div className="cr-stickyspace" />

      {/* ===== Thanh "BẮT ĐẦU ÔN" LUÔN HIỂN THỊ (dính đáy) ===== */}
      <div className="cr-sticky">
        <div className="cr-sticky-info">
          {canStart
            ? <><span className="cr-sticky-top"><b>{count} câu</b> • ~{estMinutes(count)} phút</span><span className="cr-sticky-sub">{stickySub}</span></>
            : <span className="cr-sticky-sub cr-sticky-warn">Hãy chọn môn có bài học, hoặc gõ chủ đề ở phần nâng cao.</span>}
        </div>
        <button className="cr-sticky-cta" onClick={start} disabled={!canStart}>Bắt đầu ôn →</button>
      </div>
    </div>
  )
}
