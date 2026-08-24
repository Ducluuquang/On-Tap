import { useState, useEffect } from 'react'
import { loadMemory, saveMemory, applySession, addConcepts, recordErrors } from './lib/memory.js'
import { buildReview } from './lib/mockAI.js'
import { generateQuestions } from './lib/aiClient.js'

import ChildHome from './screens/ChildHome.jsx'
import Review from './screens/Review.jsx'
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
        <h2>AI đang soạn câu hỏi cho con…</h2>
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

export default function App() {
  const [mem, setMem] = useState(loadMemory)
  const [role, setRole] = useState('child')
  const [view, setView] = useState('home')
  const [session, setSession] = useState(null)
  const [pending, setPending] = useState(null)
  const [streak, setStreak] = useState(5)
  const [toast, setToast] = useState('')
  const [reviewTitle, setReviewTitle] = useState('Ôn tập hôm nay')
  const [reviewQuestions, setReviewQuestions] = useState(null)
  const [generating, setGenerating] = useState(false)

  useEffect(() => { saveMemory(mem) }, [mem])
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(''), 2600)
    return () => clearTimeout(t)
  }, [toast])

  function switchRole(r) {
    setRole(r)
    setView(r === 'child' ? 'home' : 'dashboard')
  }

  async function startReview(title) {
    setReviewTitle(title)
    setReviewQuestions(null)
    setGenerating(true)
    setView('review')
    const targets = [...mem].sort((a, b) => a.mastery - b.mastery)
    const names = targets.slice(0, 4).map((c) => c.name)
    const topic = targets[0]?.topic || 'Phân số'
    let qs = []
    try {
      qs = normalizeQs(await generateQuestions({ subject: 'Toán', grade: '4-5', topic, concepts: names, count: 6 }))
    } catch { qs = [] }
    if (!qs.length) qs = buildReview(mem, 6) // dự phòng: ngân hàng câu mẫu
    setReviewQuestions(qs)
    setGenerating(false)
  }

  function handleFinish(summary, perConcept) {
    const deltas = Object.entries(perConcept).map(([key, r]) => {
      const old = mem.find((c) => c.id === key || c.name === key)
      return { id: key, name: r.label || (old ? old.name : key), before: old ? old.mastery : 55, after: r.mastery }
    })
    setMem(applySession(mem, perConcept))
    setSession({ ...summary, deltas })
    setStreak((s) => s + 1)
    setView('result')
  }

  function onExtracted(result) {
    setPending(result)
    setView('approve')
  }
  function onSaveApprove(checked) {
    const chosen = (pending?.concepts || [])
      .filter((c) => checked[c.id])
      .map((c) => ({ ...c, subject: pending.subject, topic: pending.topic }))
    setMem((m) => addConcepts(m, chosen))
    setToast(`Đã lưu ${chosen.length} khái niệm vào bộ nhớ của con ✓`)
    setPending(null)
    setView('dashboard')
  }
  function onSaveErrors(concepts) {
    setMem((m) => recordErrors(m, concepts))
    setToast(`Đã thêm ${concepts.length} chỗ con sai vào danh sách ôn lại ✓`)
    setView('dashboard')
  }

  let screen = null
  if (role === 'child') {
    if (view === 'review') {
      screen = (generating || !reviewQuestions)
        ? <GeneratingScreen />
        : <Review questions={reviewQuestions} mem={mem} title={reviewTitle} onFinish={handleFinish} onExit={() => setView('home')} />
    } else if (view === 'result') {
      screen = <Result session={session} onHome={() => setView('home')} onReport={() => switchRole('parent')} />
    } else {
      screen = <ChildHome mem={mem} streak={streak} onStart={() => startReview('Ôn tập hôm nay')} onPractice={() => startReview('Luyện thêm')} />
    }
  } else {
    if (view === 'capture') screen = <ParentCapture onExtracted={onExtracted} onBack={() => setView('dashboard')} />
    else if (view === 'approve' && pending) screen = <ParentApprove pending={pending} onSave={onSaveApprove} onBack={() => setView('capture')} />
    else if (view === 'grade') screen = <ParentGrade onSaveErrors={onSaveErrors} onBack={() => setView('dashboard')} />
    else screen = <ParentDashboard mem={mem} session={session} onCapture={() => setView('capture')} onGrade={() => setView('grade')} toast={toast} />
  }

  return (
    <div className="stage">
      <div className="demoswitch">
        <span className="ds-label">Bản demo · xem với vai:</span>
        <div className="ds-seg">
          <button className={role === 'child' ? 'on' : ''} onClick={() => switchRole('child')}>Con</button>
          <button className={role === 'parent' ? 'on' : ''} onClick={() => switchRole('parent')}>Phụ huynh</button>
        </div>
      </div>
      <div className="phone">{screen}</div>
    </div>
  )
}
