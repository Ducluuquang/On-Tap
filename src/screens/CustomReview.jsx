import { useState } from 'react'
import { BackHeader, SubjectTile } from '../components.jsx'
import { selectConcepts, describeSelection, needReviewCount } from '../lib/review.js'
import { subjectsWithTone, subjectDisplayName, subjectModes, subjectKey } from '../lib/subjects.js'

// MÀN "BẮT ĐẦU ÔN" — giao diện mới (anh duyệt hình mẫu 28/10/2026, file "sua 26 Oct 2026" mục 4):
//  CÁCH 1 · Nhanh nhất: ôn theo gợi ý (khối xanh ngọc, nút vàng "Ôn ngay")
//  — hoặc —
//  CÁCH 2 · Tự chọn bài ôn, 3 bước đánh số: 1 Chọn môn (ô màu, ô đang chọn có ✓; riêng Tiếng Anh có thêm
//  Trò chơi từ vựng + "Đề bài viết bằng") · 2 Con muốn ôn gì? · 3 Ôn bao nhiêu câu? · ⚙ Tuỳ chỉnh thêm (thu gọn)
//  Thanh dính đáy tóm tắt đúng lựa chọn + nút "Bắt đầu →". Logic chọn bài giữ nguyên như trước.

// MỨC ĐỘ — 5 mức, mỗi mức 1 icon + một dòng giải thích ngắn cho học sinh.
const LEVELS = [
  { k: 'weak', l: 'Cần ôn nhất', icon: '🎯', d: 'Phần con chưa vững' },
  { k: 'wrong', l: 'Câu từng sai', icon: '🔁', d: 'Làm lại câu đã sai' },
  { k: 'new', l: 'Chưa học', icon: '🆕', d: 'Bài mới thêm, chưa ôn' },
  { k: 'all', l: 'Ôn tổng hợp', icon: '🎲', d: 'Trộn tất cả các bài' },
  { k: 'master', l: 'Thử thách Master', icon: '🏆', d: 'Bài nâng cao, kết hợp nhiều chủ đề để con thật sự thành thạo' },
]
// Số câu — kèm ước lượng thời gian (~0.8 phút/câu) để trẻ biết "học bao lâu".
const COUNTS = [10, 15, 20, 25]
// Phạm vi bài học (đưa vào phần TUỲ CHỈNH THÊM — bình thường không cần chọn).
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

export default function CustomReview({ mem, onStart, onBack, allowChoice = true, onVocab, initialSubject = null }) {
  const subjectList = subjectsWithTone(mem)
  const ofSubject = (name) => (mem || []).filter((c) => subjectDisplayName(c.subject) === name)
  // Môn mặc định: môn được chọn sẵn (vd chạm vào môn ở trang chủ); không có thì GỢI Ý môn đang cần ôn nhiều nhất.
  const [subject, setSubject] = useState(() => {
    if (initialSubject && subjectList.some((s) => s.name === initialSubject)) return initialSubject
    let best = null, bestNeed = 0
    for (const s of subjectList) { const n = needReviewCount(ofSubject(s.name)); if (n > bestNeed) { best = s.name; bestNeed = n } }
    return best || subjectList.find((s) => s.count > 0)?.name || subjectList[0]?.name || 'Toán'
  })
  const [time, setTime] = useState('all')
  const [level, setLevel] = useState('weak')
  const [text, setText] = useState('')
  const [count, setCount] = useState(10)
  const [mode, setMode] = useState(allowChoice ? 'quiz' : 'typed')
  const [enLang, setEnLang] = useState('vi') // ngôn ngữ YÊU CẦU của đề Tiếng Anh: 'vi' | 'en'
  const [advOpen, setAdvOpen] = useState(false) // Tuỳ chỉnh thêm — đóng sẵn (giảm lựa chọn ban đầu)

  const isEnglish = subjectKey(subject) === 'tieng-anh'
  const cur = subjectList.find((s) => s.name === subject) || { name: subject, icon: '📚' }
  // Chỉ ôn trong MÔN đang chọn (không trộn môn khác).
  const memSub = ofSubject(subject)
  // Chế độ chơi phù hợp với môn (vd "Tìm lỗi sai" chỉ cho môn ngôn ngữ).
  const allowed = subjectModes(subject)
  const styles = STYLES.filter((m) => (allowChoice || !m.choice) && allowed.includes(m.k))
  const games = GAMES.filter((g) => allowed.includes(g.k))

  const isMaster = level === 'master'
  const names = selectConcepts(memSub, { time, level, text })
  const canStart = names.length > 0 // có ít nhất 1 khái niệm/chủ đề để ra đề

  // ===== CÁCH 1 — thẻ gợi ý: hệ thống tự quyết định bài đáng ôn nhất của môn đang chọn =====
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
    else setAdvOpen(true) // Master cần gõ chủ đề -> mở luôn phần tuỳ chỉnh thêm
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

  // BẮT ĐẦU ÔN theo lựa chọn của con (thanh dính đáy).
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

  // Tóm tắt trên thanh dính đáy: "Tiếng Anh · Cần ôn nhất" / "10 câu · khoảng 8 phút".
  const lvLabel = (LEVELS.find((o) => o.k === level) || LEVELS[0]).l
  const timeLabel = time !== 'all' ? ` · ${(TIMES.find((o) => o.k === time) || {}).l} gần đây` : ''
  const choiceLabel = isMaster
    ? `Thử thách Master${text.trim() ? `: ${text.trim()}` : ''}`
    : text.trim() ? describeSelection({ time, level, text }) : lvLabel + timeLabel

  return (
    <div className="screen cr">
      <BackHeader title="Bắt đầu ôn" onBack={onBack} />

      {/* ===== CÁCH 1 — nhanh nhất: ôn theo gợi ý ===== */}
      <div className="cr-way"><b>Cách 1</b><span>Nhanh nhất: ôn theo gợi ý</span></div>
      <div className="cr-hero">
        <span className="cr-hero-subj">{cur.icon} {subject}</span>
        {memSub.length === 0 ? (
          <>
            <div className="cr-hero-big">Chưa có bài học môn {subject}</div>
            <p className="cr-hero-sub">Về trang chính bấm “Thêm bài học”, hoặc chọn môn khác ở Cách 2 bên dưới.</p>
          </>
        ) : (
          <>
            <div className="cr-hero-big">
              {needCount > 0 ? `${needCount} chủ đề cần ôn` : 'Ôn tổng hợp giữ phong độ'}
            </div>
            {heroTopics && <p className="cr-hero-sub">{heroTopics}</p>}
            <div className="cr-hero-meta"><span>10 câu</span><span>~{estMinutes(10)} phút</span></div>
            <button className="cr-hero-cta" onClick={startHero}><span className="cr-play" aria-hidden="true">▶</span>Ôn ngay</button>
          </>
        )}
      </div>

      <div className="cr-or">hoặc</div>

      {/* ===== CÁCH 2 — tự chọn bài ôn: 3 bước ===== */}
      <div className="cr-way alt"><b>Cách 2</b><span>Tự chọn bài ôn</span></div>
      <section className="cr-self">
        <div className="cr-step">
          <h3><span className="cr-n">1</span>Chọn môn</h3>
          <div className="sj-grid">
            {subjectList.map((s) => (
              <SubjectTile key={s.name} s={s} need={needReviewCount(ofSubject(s.name))}
                selected={subject === s.name} onClick={() => pickSubject(s.name)} />
            ))}
          </div>

          {isEnglish && (
            <div className="cr-en">
              <div className="cr-en-h">Riêng môn Tiếng Anh</div>
              {onVocab && (
                <button className="cr-vocab" onClick={onVocab}>
                  <span className="cr-vocab-ic" aria-hidden="true">🔤</span>
                  <span className="cr-vocab-body">
                    <b>Trò chơi từ vựng</b>
                    <em>Vở Spelling · 11 trò + Scrabble</em>
                  </span>
                  <span className="cr-vocab-go" aria-hidden="true">›</span>
                </button>
              )}
              <div className="cr-lang">
                <span>Đề bài viết bằng:</span>
                <span className="cr-segb" role="group" aria-label="Đề bài viết bằng">
                  <button className={enLang === 'vi' ? 'on' : ''} aria-pressed={enLang === 'vi'} onClick={() => setEnLang('vi')}>Tiếng Việt</button>
                  <button className={enLang === 'en' ? 'on' : ''} aria-pressed={enLang === 'en'} onClick={() => setEnLang('en')}>Tiếng Anh</button>
                </span>
              </div>
              <p className="cr-en-note">Từ vựng và đáp án vẫn là tiếng Anh. Chọn “Tiếng Việt” nếu con chưa đọc hiểu được yêu cầu bằng tiếng Anh.</p>
            </div>
          )}
        </div>

        <div className="cr-step">
          <h3><span className="cr-n">2</span>Con muốn ôn gì?</h3>
          <div className="cr-lv">
            {LEVELS.map((o) => (
              <button key={o.k} className={'cr-lvc' + (level === o.k ? ' on' : '') + (o.k === 'master' ? ' master' : '')}
                aria-pressed={level === o.k} onClick={() => pickLevel(o.k)}>
                <span className="cr-li" aria-hidden="true">{o.icon}</span>
                <span className="cr-lvb"><b>{o.l}</b><em>{o.d}</em></span>
              </button>
            ))}
          </div>
          {isMaster && (
            <p className="cr-master-note">🏆 <b>Master</b>: gõ <b>một hoặc nhiều chủ đề</b> (cách nhau bằng dấu phẩy) ở ô “Yêu cầu cụ thể” bên dưới. App ra bài <b>nâng cao &amp; KẾT HỢP</b> bài khó của các chủ đề đó để con thật sự thành thạo.</p>
          )}
        </div>

        <div className="cr-step">
          <h3><span className="cr-n">3</span>Ôn bao nhiêu câu?</h3>
          <div className="chips chips-count">
            {COUNTS.map((n) => (
              <button key={n} className={'chip chip-count' + (count === n ? ' on' : '')} aria-pressed={count === n} onClick={() => setCount(n)}>
                <span className="cc-n">{n} câu</span>
                <span className="cc-t">~{estMinutes(n)} phút</span>
              </button>
            ))}
          </div>
        </div>

        {/* ⚙ Tuỳ chỉnh thêm (thu gọn) */}
        <div className={'cr-adv' + (advOpen ? ' open' : '')}>
          <button className="cr-adv-toggle" aria-expanded={advOpen} onClick={() => setAdvOpen((v) => !v)}>
            <span>⚙ Tuỳ chỉnh thêm</span>
            <span className="cr-adv-caret">{advOpen ? '▲' : '▼'}</span>
          </button>
          {!advOpen && <p className="cr-adv-cap">Chủ đề cụ thể · thời gian · kiểu chơi, games</p>}

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
                    : 'Gõ yêu cầu sẽ ưu tiên hơn lựa chọn ở bước 2.'}
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
                <h3>Kiểu chơi</h3>
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
      </section>

      {/* Chừa chỗ để nội dung không bị thanh dính đáy che mất */}
      <div className="cr-stickyspace" />

      {/* ===== Thanh "BẮT ĐẦU" luôn hiển thị (dính đáy), tóm tắt đúng lựa chọn ===== */}
      <div className="cr-sticky">
        <div className="cr-sticky-info">
          {canStart
            ? <><span className="cr-sticky-top">{subject} · {choiceLabel}</span><span className="cr-sticky-sub">{count} câu · khoảng {estMinutes(count)} phút</span></>
            : <span className="cr-sticky-sub cr-sticky-warn">{memSub.length === 0 ? `Môn ${subject} chưa có bài học. Chọn môn khác, hoặc gõ chủ đề ở “Tuỳ chỉnh thêm”.` : 'Chưa có bài hợp lựa chọn này. Thử chọn khác ở bước 2.'}</span>}
        </div>
        <button className="cr-sticky-cta" onClick={start} disabled={!canStart}>Bắt đầu →</button>
      </div>
    </div>
  )
}
