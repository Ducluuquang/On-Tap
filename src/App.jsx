import { useState, useEffect } from 'react'
import { loadMemory, saveMemory, applySession, addConcepts, recordErrors } from './lib/memory.js'
import { buildReview } from './lib/mockAI.js'
import { generateQuestions } from './lib/aiClient.js'
import { loadAccount, saveAccount, loadSession, setSession as persistSession } from './lib/auth.js'
import { loadStats, saveStats, addSeconds, setGoalMin } from './lib/stats.js'
import { loadSettings, saveSettings } from './lib/settings.js'

import Auth from './screens/Auth.jsx'
import Settings from './screens/Settings.jsx'
import ChildHome from './screens/ChildHome.jsx'
import CustomReview from './screens/CustomReview.jsx'
import Review from './screens/Review.jsx'
import TypedReview from './screens/TypedReview.jsx'
import QuickFire from './screens/QuickFire.jsx'
import BossBattle from './screens/BossBattle.jsx'
import FallingGame from './screens/FallingGame.jsx'
import Result from './screens/Result.jsx'
import ParentCapture from './screens/ParentCapture.jsx'
import ParentApprove from './screens/ParentApprove.jsx'
import ParentGrade from './screens/ParentGrade.jsx'
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

function normalizeQs(qs) {
  if (!Array.isArray(qs)) return []
  return qs
    .filter((q) => q && q.q && Array.isArray(q.options) && q.options.length === 4 &&
      Number.isInteger(q.answer) && q.answer >= 0 && q.answer <= 3)
    .map((q) => ({
      concept: q.concept || 'Ôn tập',
      q: q.q, options: q.options.map(String), answer: q.answer,
      explain: q.explain || '', hint: q.hint || '',
    }))
}

// Câu TỰ ĐIỀN (mở): đáp án là chuỗi. Loại bỏ câu kiểu "trong các... sau" (cần danh sách lựa chọn).
function normalizeOpen(qs) {
  if (!Array.isArray(qs)) return []
  return qs
    .filter((q) => q && q.q && q.answer !== undefined && String(q.answer).trim() !== '')
    .filter((q) => !/trong (các|những)[^.?!]{0,40}(sau|dưới đây)/i.test(q.q))
    .map((q) => ({
      concept: q.concept || 'Ôn tập',
      q: q.q, answer: String(q.answer).trim(),
      explain: q.explain || '', hint: q.hint || '',
    }))
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
  function logout() {
    persistSession(false); setAuthed(false)
    setRole('child'); setView('home')
  }

  function switchRole(r) {
    setRole(r)
    setView(r === 'child' ? 'home' : 'dashboard')
  }

  async function startReview({ title = 'Ôn tập', conceptNames, count = 10, mode = 'quiz' } = {}) {
    // An toàn: nếu phụ huynh đã tắt trắc nghiệm thì mọi buổi ôn đều là tự điền.
    const m = settings.allowChoice ? mode : 'typed'
    setReviewTitle(title)
    setReviewMode(m)
    setReviewQuestions(null)
    setGenerating(true)
    setView(m === 'typed' ? 'typed' : m === 'falling' ? 'falling' : m === 'quickfire' ? 'quickfire' : m === 'boss' ? 'boss' : 'review')
    let names = conceptNames
    if (!names || !names.length) {
      names = [...mem].sort((a, b) => a.mastery - b.mastery).slice(0, 4).map((c) => c.name)
    }
    const topic = mem.find((c) => c.name === names[0])?.topic || 'Phân số'
    const isTyped = m === 'typed'
    let qs = []
    try {
      const raw = await generateQuestions({ subject: 'Toán', grade: '4-5', topic, concepts: names, count, format: isTyped ? 'open' : 'choice' })
      qs = isTyped ? normalizeOpen(raw) : normalizeQs(raw)
    } catch { qs = [] }
    if (!qs.length) qs = buildReview(mem, count, isTyped ? { openOnly: true } : {})
    setReviewQuestions(qs)
    setGenerating(false)
  }

  function handleFinish(summary, perConcept) {
    if (summary.activeSeconds) setStats((s) => addSeconds(s, summary.activeSeconds))
    const deltas = Object.entries(perConcept).map(([key, r]) => {
      const old = mem.find((c) => c.id === key || c.name === key)
      return { id: key, name: r.label || (old ? old.name : key), before: old ? old.mastery : 55, after: r.mastery }
    })
    setMem(applySession(mem, perConcept))
    setSession({ ...summary, deltas })
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
  function onSaveErrors(concepts) {
    setMem((m) => recordErrors(m, concepts))
    setToast(`Đã thêm ${concepts.length} chỗ con sai vào danh sách ôn lại ✓`)
    setView('dashboard')
  }

  const genOrScreen = (node) => (generating || !reviewQuestions) ? <GeneratingScreen /> : node
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
      onChangePassword={changePassword} onSaveEmail={saveEmail}
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
    } else if (view === 'capture') {
      screen = <ParentCapture onExtracted={onExtracted} onBack={() => setView('home')} />
    } else if (view === 'approve' && pending) {
      screen = <ParentApprove pending={pending} onSave={onSaveApprove} onBack={() => setView('capture')} />
    } else if (view === 'result') {
      screen = <Result session={session} onHome={() => setView('home')} onReport={() => switchRole('parent')} />
    } else {
      screen = <ChildHome mem={mem} streak={streak}
        onReview={() => setView('custom')} onCapture={() => setView('capture')} />
    }
  } else {
    if (view === 'capture') screen = <ParentCapture onExtracted={onExtracted} onBack={() => setView('dashboard')} />
    else if (view === 'approve' && pending) screen = <ParentApprove pending={pending} onSave={onSaveApprove} onBack={() => setView('capture')} />
    else if (view === 'grade') screen = <ParentGrade onSaveErrors={onSaveErrors} onBack={() => setView('dashboard')} />
    else screen = <ParentDashboard mem={mem} session={session} stats={stats} onCapture={() => setView('capture')} onGrade={() => setView('grade')} onSettings={() => setView('settings')} toast={toast} />
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
