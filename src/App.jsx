import { useState, useEffect, useRef } from 'react'
import { loadMemory, saveMemory, applySession, addConcepts } from './lib/memory.js'
import { buildReview } from './lib/mockAI.js'
import { generateQuestions } from './lib/aiClient.js'
import { loadAccount, saveAccount, loadSession, setSession as persistSession } from './lib/auth.js'
import { loadStats, saveStats, addSeconds, addSession, setGoalMin } from './lib/stats.js'
import { loadSettings, saveSettings } from './lib/settings.js'
import { canon, localMatch } from './lib/answerMatch.js'
import { dotNumbers } from './lib/num.js'
import { loadRecent, pushRecent } from './lib/recent.js'

import Auth from './screens/Auth.jsx'
import Settings from './screens/Settings.jsx'
import ChildHome from './screens/ChildHome.jsx'
import CustomReview from './screens/CustomReview.jsx'
import Review from './screens/Review.jsx'
import TypedReview from './screens/TypedReview.jsx'
import QuickFire from './screens/QuickFire.jsx'
import BossBattle from './screens/BossBattle.jsx'
import FallingGame from './screens/FallingGame.jsx'
import BalloonGame from './screens/BalloonGame.jsx'
import SushiGame from './screens/SushiGame.jsx'
import MarioGame from './screens/MarioGame.jsx'
import Result from './screens/Result.jsx'
import ParentCapture from './screens/ParentCapture.jsx'
import ParentApprove from './screens/ParentApprove.jsx'
import ParentDashboard from './screens/ParentDashboard.jsx'

function GeneratingScreen() {
  return (
    <div className="screen center">
      <div className="reading">
        <div className="spinner" />
        <h2>Đang chuẩn bị đồng hành cùng con…</h2>
        <p>Chọn câu theo đúng khái niệm con cần ôn.</p>
      </div>
    </div>
  )
}

// Soạn bài thất bại (mạng chậm/bận) — cho con bấm "Thử lại" thay vì đứng hình.
function GenErrorScreen({ onRetry, onHome }) {
  return (
    <div className="screen center">
      <div className="reading">
        <div className="gen-fail-ic">😅</div>
        <h2>Chưa soạn được câu hỏi</h2>
        <p>Mạng hơi chậm hoặc đang bận. Con bấm “Thử lại” nhé — thường lần sau là được.</p>
        <button className="cta" onClick={onRetry}>🔄 Thử lại</button>
        <button className="cta small ghost" onClick={onHome}>Về trang chủ</button>
      </div>
    </div>
  )
}

// Kiểu bài không áp dụng cho môn học hiện tại (VD "Tìm lỗi sai" chưa dùng cho Toán).
function NotApplicScreen({ onBack }) {
  return (
    <div className="screen center">
      <div className="reading">
        <div className="gen-fail-ic">🚧</div>
        <h2>Trò chơi này không áp dụng cho môn học hiện tại</h2>
        <p>“Tìm lỗi sai” sẽ dùng cho các môn như Tiếng Anh, Lịch sử… Môn Toán chưa có nhé.</p>
        <button className="cta" onClick={onBack}>Chọn kiểu khác</button>
      </div>
    </div>
  )
}

// Xáo trộn mảng (Fisher–Yates) — để vị trí đáp án đúng không cố định.
function shuffled(arr) {
  const a = arr.slice()
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1));[a[i], a[j]] = [a[j], a[i]] }
  return a
}

// "Tìm lỗi sai" — dựng từ câu trắc nghiệm CHUẨN: đáp án đúng GIỮ NGUYÊN (do model chính xác chọn),
// cho "một bạn trả lời" bằng MỘT lựa chọn SAI có sẵn (chắc chắn sai vì khác đáp án đúng).
// Nhờ vậy KHÔNG BAO GIỜ chấm nhầm hay bịa lỗi không có thật.
function toFindError(qs) {
  return qs.map((q) => {
    if (!Array.isArray(q.options) || q.options.length !== 4 || typeof q.answer !== 'number') return q
    const wrongs = [0, 1, 2, 3].filter((i) => i !== q.answer)
    const student = q.options[wrongs[Math.floor(Math.random() * wrongs.length)]]
    return { ...q, q: `${q.q}\nMột bạn trả lời: “${student}”. Bạn ấy SAI rồi — đáp án ĐÚNG là gì?` }
  })
}

// Ưu tiên câu CHƯA gặp ở các lần ôn gần đây (đưa câu đã gặp xuống cuối),
// nhờ đó các lần ôn khác nhau ra câu khác nhau dù cùng nội dung.
function orderByFresh(out, recent) {
  if (!recent || !recent.size) return out
  const fresh = out.filter((o) => !recent.has(o._k))
  const seen = out.filter((o) => recent.has(o._k))
  return [...fresh, ...seen]
}

// Trắc nghiệm: ô đúng dò theo GIÁ TRỊ đáp án (không tin số thứ tự máy ghi — tránh đánh dấu nhầm ô).
// Bỏ câu có 2 lựa chọn trùng nghĩa (2 đáp án cùng đúng) và bỏ câu lặp trong buổi ôn.
// XÁO vị trí 4 lựa chọn để đáp án đúng không luôn nằm 1 chỗ (bóng cam/ô số 1).
// Chèn dấu chấm hàng ngàn cho số dài (1000000 -> 1.000.000) trong câu, lựa chọn, lời giải.
function normalizeQs(qs, recent = null) {
  if (!Array.isArray(qs)) return []
  const out = []
  const seenQ = new Set()
  for (const q of qs) {
    if (!q || !q.q || !Array.isArray(q.options) || q.options.length !== 4) continue
    const rawOpts = q.options.map((o) => String(o).trim())
    const canons = rawOpts.map(canon)
    if (new Set(canons).size !== 4) continue // có lựa chọn trùng nghĩa -> bỏ câu
    let idx = -1
    if (typeof q.answer === 'number' && Number.isInteger(q.answer) && q.answer >= 0 && q.answer <= 3) {
      idx = q.answer
    } else {
      // Dò ô đúng theo GIÁ TRỊ (khớp cả khi khác cách ghi: "7800" ~ "7 800", "1/2" ~ "1/2").
      idx = rawOpts.findIndex((o) => localMatch(String(q.answer), o))
    }
    if (idx < 0 || idx > 3) continue // đáp án không nằm trong 4 lựa chọn -> bỏ câu
    const key = canon(q.q)
    if (!key || seenQ.has(key)) continue // câu lặp -> bỏ
    seenQ.add(key)
    const order = shuffled([0, 1, 2, 3])
    const options = order.map((j) => dotNumbers(rawOpts[j]))
    const answer = order.indexOf(idx)
    out.push({ concept: q.concept || 'Ôn tập', q: dotNumbers(q.q), options, answer, explain: dotNumbers(q.explain || ''), hint: '', _k: key })
  }
  return orderByFresh(out, recent)
}

// Câu TỰ ĐIỀN (mở): đáp án là chuỗi. Loại câu "trong các... sau" (cần danh sách) và câu lặp.
function normalizeOpen(qs, recent = null) {
  if (!Array.isArray(qs)) return []
  const out = []
  const seenQ = new Set()
  for (const q of qs) {
    if (!q || !q.q || q.answer === undefined || String(q.answer).trim() === '') continue
    if (/trong (các|những)[^.?!]{0,40}(sau|dưới đây)/i.test(q.q)) continue
    const key = canon(q.q)
    if (!key || seenQ.has(key)) continue
    seenQ.add(key)
    out.push({ concept: q.concept || 'Ôn tập', q: dotNumbers(q.q), answer: dotNumbers(String(q.answer).trim()), explain: dotNumbers(q.explain || ''), hint: '', _k: key })
  }
  return orderByFresh(out, recent)
}

export default function App() {
  const [account, setAccount] = useState(loadAccount)
  const [authed, setAuthed] = useState(() => loadSession() && !!loadAccount())
  const [stats, setStats] = useState(loadStats)
  const [settings, setSettings] = useState(loadSettings)

  const [mem, setMem] = useState(loadMemory)
  const [role, setRole] = useState('child')
  const [view, setView] = useState('home')
  const [session, setSession] = useState(null)
  const [pending, setPending] = useState(null)
  const [streak, setStreak] = useState(5)
  const [toast, setToast] = useState('')
  const [reviewTitle, setReviewTitle] = useState('Ôn tập hôm nay')
  const [reviewMode, setReviewMode] = useState('quiz')
  const [reviewQuestions, setReviewQuestions] = useState(null)
  const [generating, setGenerating] = useState(false)
  const [genError, setGenError] = useState(false) // soạn bài thất bại -> hiện nút "Thử lại"
  const [notApplic, setNotApplic] = useState(false) // kiểu bài không áp dụng cho môn hiện tại
  // Thời gian con CHỜ app soạn/nạp bài (giây) — sẽ được cộng vào thời gian học của buổi ôn.
  const loadSecondsRef = useRef(0)
  // Môn của buổi ôn hiện tại — để ghi nhật ký theo môn cho phụ huynh xem.
  const reviewSubjectRef = useRef('Toán')
  const lastReviewRef = useRef(null) // yêu cầu ôn gần nhất — để bấm "Thử lại"

  useEffect(() => { saveMemory(mem) }, [mem])
  useEffect(() => { saveStats(stats) }, [stats])
  useEffect(() => { saveSettings(settings) }, [settings])
  useEffect(() => {
    if (!toast) return undefined
    const t = setTimeout(() => setToast(''), 2600)
    return () => clearTimeout(t)
  }, [toast])

  // ---- Đăng nhập / tài khoản ----
  function handleRegister(phone, email) {
    const acc = { username: phone, password: phone, email: email || '' }
    saveAccount(acc); setAccount(acc)
    persistSession(true); setAuthed(true)
  }
  function handleLogin(u, p) {
    const acc = loadAccount()
    if (acc && u === acc.username && p === acc.password) { persistSession(true); setAuthed(true); return true }
    return false
  }
  function handleReset(phone, newPass) {
    const acc = loadAccount()
    if (acc && phone === acc.username) {
      const next = { ...acc, password: newPass }
      saveAccount(next); setAccount(next); persistSession(true); setAuthed(true); return true
    }
    return false
  }
  function changePassword(cur, next) {
    if (!account || cur !== account.password) return false
    const acc = { ...account, password: next }
    saveAccount(acc); setAccount(acc); return true
  }
  function saveEmail(email) {
    const acc = { ...account, email }
    saveAccount(acc); setAccount(acc)
  }
  function setParentPin(pin) {
    const acc = { ...account, pin: String(pin) }
    saveAccount(acc); setAccount(acc)
  }
  function logout() {
    persistSession(false); setAuthed(false)
    setRole('child'); setView('home')
  }

  function switchRole(r) {
    setRole(r)
    setView(r === 'child' ? 'home' : 'dashboard')
  }

  async function startReview(opts = {}) {
    const { title = 'Ôn tập', conceptNames, count = 10, mode = 'quiz', master = false, masterText = '' } = opts
    lastReviewRef.current = opts // để nút "Thử lại" soạn lại đúng yêu cầu này
    // An toàn: nếu phụ huynh đã tắt trắc nghiệm thì mọi buổi ôn đều là tự điền.
    const m = settings.allowChoice ? mode : 'typed'
    const viewFor = { typed: 'typed', falling: 'falling', quickfire: 'quickfire', boss: 'boss', balloon: 'balloon', sushi: 'sushi', finderror: 'finderror', mario: 'mario' }
    setReviewTitle(title)
    setReviewMode(m)
    setReviewQuestions(null)
    setGenError(false)
    setNotApplic(false)
    setGenerating(true)
    setView(viewFor[m] || 'review')
    // Bắt đầu bấm giờ CHỜ nạp bài (con vẫn đang "học" trong lúc đợi app soạn câu hỏi).
    const loadT0 = (typeof performance !== 'undefined' ? performance.now() : Date.now())
    let names = conceptNames
    if (!names || !names.length) {
      names = [...mem].sort((a, b) => a.mastery - b.mastery).slice(0, 4).map((c) => c.name)
    }
    // Master + chủ đề gõ tay: luyện đúng chủ đề con muốn "master" (không giới hạn trong bộ nhớ).
    const mt = (masterText || '').trim()
    let subject, topic, concepts
    if (master && mt) {
      subject = (mem.find((c) => c.name === names[0])?.subject) || 'Toán'
      topic = mt
      concepts = [mt]
    } else {
      // Lấy đúng MÔN + CHỦ ĐỀ của khái niệm đang ôn (không mặc định "Phân số" nữa),
      // để câu hỏi ra đúng nội dung con đang học (số tự nhiên, hình học…).
      const first = mem.find((c) => c.name === names[0])
      subject = first?.subject || 'Toán'
      topic = first?.topic || names[0] || 'Ôn tập'
      concepts = names
    }
    reviewSubjectRef.current = subject
    // "Tìm lỗi sai" chưa hợp với Toán -> báo không áp dụng (để dành cho Tiếng Anh, Lịch sử… sau này).
    if (m === 'finderror' && subject === 'Toán') {
      setGenerating(false)
      setNotApplic(true)
      return
    }
    const isTyped = m === 'typed'
    // "Tìm lỗi sai" dùng CHÍNH câu trắc nghiệm chuẩn (đáp án do model chính xác chọn),
    // rồi dựng phần "một bạn trả lời sai" ở client -> không bao giờ chấm nhầm.
    const fmt = isTyped ? 'open' : 'choice'
    const recent = new Set(loadRecent()) // câu đã gặp gần đây -> ưu tiên câu mới
    const norm = (arr) => (isTyped ? normalizeOpen(arr, recent) : normalizeQs(arr, recent))
    let qs = []
    try {
      let raw = []
      let list = []
      // Soạn bài bằng model CHÍNH XÁC (không dùng fast) — độ tin cậy là ưu tiên số 1.
      // Nhanh nhờ generateQuestions chạy nhiều đợt nhỏ SONG SONG; ở đây tối đa 2 lượt (1 chính + 1 bù).
      for (let round = 0; round < 2 && list.length < count; round++) {
        const ask = round === 0 ? count + 3 : (count - list.length) + 3
        // generateQuestions đã tự bắt lỗi nên không ném ra ngoài.
        const batch = await generateQuestions({ subject, grade: '4-5', topic, concepts, count: ask, format: fmt, master })
        if (!batch || !batch.length) break
        raw = raw.concat(batch)
        list = norm(raw) // chuẩn hoá + khử trùng trên TOÀN BỘ các lượt đã gộp
      }
      qs = list.slice(0, count)
    } catch { qs = [] }
    if (!qs.length) qs = buildReview(mem, count, { openOnly: isTyped, conceptNames: concepts })
    // Không soạn được câu nào -> hiện màn hình "Thử lại" thân thiện (không đứng hình, không báo lỗi cụt).
    if (!qs.length) {
      loadSecondsRef.current = 0
      setGenError(true)
      setGenerating(false)
      return
    }
    // Ghi nhớ các câu (bản gốc, chưa vá) để lần sau không lặp lại y hệt.
    pushRecent(qs.map((q) => q._k).filter(Boolean))
    // BẢO ĐẢM ĐỦ SỐ CÂU: chọn 10 luôn có 10 câu. Nếu vì mạng/đề hẹp mà vẫn thiếu,
    // vá thêm bằng câu đã có (rất hiếm khi xảy ra khi mạng ổn định).
    if (qs.length && qs.length < count) {
      const base = qs.slice()
      for (let i = 0; qs.length < count; i++) qs = qs.concat([{ ...base[i % base.length] }])
    }
    // "Tìm lỗi sai": dựng phần "một bạn trả lời sai" (giữ nguyên đáp án đúng đã có).
    if (m === 'finderror') qs = toFindError(qs)
    // Chốt thời gian chờ nạp bài (giới hạn 180s để tránh trường hợp mạng treo cộng dồn bất thường).
    loadSecondsRef.current = Math.min(180, ((typeof performance !== 'undefined' ? performance.now() : Date.now()) - loadT0) / 1000)
    setReviewQuestions(qs)
    setGenerating(false)
  }

  function handleFinish(summary, perConcept) {
    // Thời gian học = thời gian CHỜ app nạp bài + thời gian con thực sự làm bài.
    const loadSec = loadSecondsRef.current || 0
    const studySeconds = Math.round((summary.activeSeconds || 0) + loadSec)
    // Cộng thời gian học + ghi NHẬT KÝ theo ngày/môn (số câu, đúng, sai, thời gian) cho phụ huynh.
    setStats((s) => addSession(addSeconds(s, studySeconds), {
      subject: reviewSubjectRef.current || 'Toán',
      total: summary.total || 0,
      correct: summary.correct || 0,
      sec: studySeconds,
    }))
    loadSecondsRef.current = 0 // đã cộng xong, tránh cộng trùng
    const deltas = Object.entries(perConcept).map(([key, r]) => {
      const old = mem.find((c) => c.id === key || c.name === key)
      return { id: key, name: r.label || (old ? old.name : key), before: old ? old.mastery : 55, after: r.mastery }
    })
    setMem(applySession(mem, perConcept))
    setSession({ ...summary, deltas, studySeconds })
    setStreak((s) => s + 1)
    setView('result')
  }

  function onExtracted(result) { setPending(result); setView('approve') }
  function onSaveApprove(checked) {
    const chosen = (pending?.concepts || [])
      .filter((c) => checked[c.id])
      .map((c) => ({ ...c, subject: pending.subject, topic: pending.topic }))
    setMem((m) => addConcepts(m, chosen))
    setToast(`Đã lưu ${chosen.length} khái niệm vào bộ nhớ của con ✓`)
    setPending(null)
    setView(role === 'child' ? 'home' : 'dashboard')
  }
  const retryReview = () => { if (lastReviewRef.current) startReview(lastReviewRef.current) }
  const goHomeFromError = () => { setGenError(false); setView('home') }
  const genOrScreen = (node) => {
    if (notApplic) return <NotApplicScreen onBack={() => { setNotApplic(false); setView('custom') }} />
    if (genError) return <GenErrorScreen onRetry={retryReview} onHome={goHomeFromError} />
    return (generating || !reviewQuestions) ? <GeneratingScreen /> : node
  }
  const homeView = role === 'child' ? 'home' : 'dashboard'

  if (!authed) {
    return (
      <div className="stage">
        <div className="phone">
          <Auth account={account} onRegister={handleRegister} onLogin={handleLogin} onReset={handleReset} />
        </div>
      </div>
    )
  }

  let screen = null
  if (view === 'settings') {
    screen = <Settings account={account} settings={settings} stats={stats}
      onChangePassword={changePassword} onSaveEmail={saveEmail} onSetPin={setParentPin}
      onSetGoal={(min) => setStats((s) => setGoalMin(s, min))}
      onToggleChoice={(v) => setSettings((s) => ({ ...s, allowChoice: v }))}
      onBack={() => setView(homeView)} />
  } else if (role === 'child') {
    if (view === 'custom') {
      screen = <CustomReview mem={mem} allowChoice={settings.allowChoice} onStart={startReview} onBack={() => setView('home')} />
    } else if (view === 'review') {
      screen = genOrScreen(<Review questions={reviewQuestions} mem={mem} title={reviewTitle} onFinish={handleFinish} onExit={() => setView('home')} />)
    } else if (view === 'typed') {
      screen = genOrScreen(<TypedReview questions={reviewQuestions} mem={mem} title={reviewTitle} onFinish={handleFinish} onExit={() => setView('home')} />)
    } else if (view === 'falling') {
      screen = genOrScreen(<FallingGame questions={reviewQuestions} mem={mem} title={reviewTitle} onFinish={handleFinish} onExit={() => setView('home')} />)
    } else if (view === 'quickfire') {
      screen = genOrScreen(<QuickFire questions={reviewQuestions} mem={mem} title={reviewTitle} onFinish={handleFinish} onExit={() => setView('home')} />)
    } else if (view === 'boss') {
      screen = genOrScreen(<BossBattle questions={reviewQuestions} mem={mem} title={reviewTitle} onFinish={handleFinish} onExit={() => setView('home')} />)
    } else if (view === 'balloon') {
      screen = genOrScreen(<BalloonGame questions={reviewQuestions} mem={mem} title={reviewTitle} onFinish={handleFinish} onExit={() => setView('home')} />)
    } else if (view === 'sushi') {
      screen = genOrScreen(<SushiGame questions={reviewQuestions} mem={mem} title={reviewTitle} onFinish={handleFinish} onExit={() => setView('home')} />)
    } else if (view === 'mario') {
      screen = genOrScreen(<MarioGame questions={reviewQuestions} mem={mem} title={reviewTitle} onFinish={handleFinish} onExit={() => setView('home')} />)
    } else if (view === 'finderror') {
      screen = genOrScreen(<Review questions={reviewQuestions} mem={mem} title={reviewTitle} hint="🔎 Tìm lỗi sai — một bạn trả lời SAI, con chọn đáp án ĐÚNG nhé!" onFinish={handleFinish} onExit={() => setView('home')} />)
    } else if (view === 'capture') {
      screen = <ParentCapture onExtracted={onExtracted} onBack={() => setView('home')} />
    } else if (view === 'approve' && pending) {
      screen = <ParentApprove pending={pending} onSave={onSaveApprove} onBack={() => setView('capture')} />
    } else if (view === 'result') {
      screen = <Result session={session} onHome={() => setView('home')} onReport={() => switchRole('parent')} />
    } else {
      screen = <ChildHome mem={mem} stats={stats}
        onReview={() => setView('custom')} onCapture={() => setView('capture')} />
    }
  } else {
    // Phụ huynh chỉ xem báo cáo + vào Cài đặt (mục tiêu, bật/tắt trắc nghiệm).
    screen = <ParentDashboard mem={mem} session={session} stats={stats} onSettings={() => setView('settings')} toast={toast} />
  }

  return (
    <div className="stage">
      <div className="demoswitch">
        <span className="ds-label">Bản demo · xem với vai:</span>
        <div className="ds-seg">
          <button className={role === 'child' ? 'on' : ''} onClick={() => switchRole('child')}>Con</button>
          <button className={role === 'parent' ? 'on' : ''} onClick={() => switchRole('parent')}>Phụ huynh</button>
        </div>
        <button className="ds-logout" onClick={() => setView('settings')} title="Cài đặt">⚙️</button>
        <button className="ds-logout" onClick={logout} title="Đăng xuất">Đăng xuất</button>
      </div>
      <div className="phone">{screen}</div>
    </div>
  )
}
