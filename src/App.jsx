import { useState, useEffect } from 'react'
import { loadMemory, saveMemory, applySession, addConcepts } from './lib/memory.js'

import ChildHome from './screens/ChildHome.jsx'
import Review from './screens/Review.jsx'
import Result from './screens/Result.jsx'
import ParentCapture from './screens/ParentCapture.jsx'
import ParentApprove from './screens/ParentApprove.jsx'
import ParentDashboard from './screens/ParentDashboard.jsx'

export default function App() {
  const [mem, setMem] = useState(loadMemory)
  const [role, setRole] = useState('child')
  const [view, setView] = useState('home')
  const [session, setSession] = useState(null)
  const [pending, setPending] = useState(null)
  const [streak, setStreak] = useState(5)
  const [toast, setToast] = useState('')
  const [reviewTitle, setReviewTitle] = useState('Ôn tập hôm nay')

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

  function startReview(title) {
    setReviewTitle(title)
    setView('review')
  }

  function handleFinish(summary, perConcept) {
    const deltas = Object.entries(perConcept).map(([cid, r]) => {
      const old = mem.find((c) => c.id === cid)
      return { id: cid, name: old ? old.name : cid, before: old ? old.mastery : r.mastery, after: r.mastery }
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

  let screen = null
  if (role === 'child') {
    if (view === 'review') screen = <Review mem={mem} title={reviewTitle} onFinish={handleFinish} onExit={() => setView('home')} />
    else if (view === 'result') screen = <Result session={session} onHome={() => setView('home')} onReport={() => switchRole('parent')} />
    else screen = <ChildHome mem={mem} streak={streak} onStart={() => startReview('Ôn tập hôm nay')} onPractice={() => startReview('Luyện thêm')} />
  } else {
    if (view === 'capture') screen = <ParentCapture onExtracted={onExtracted} onBack={() => setView('dashboard')} />
    else if (view === 'approve' && pending) screen = <ParentApprove pending={pending} onSave={onSaveApprove} onBack={() => setView('capture')} />
    else screen = <ParentDashboard mem={mem} session={session} onCapture={() => setView('capture')} toast={toast} />
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
