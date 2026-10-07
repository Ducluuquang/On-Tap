import { useState, useEffect, useRef } from 'react'
import { loadMemory, saveMemory, applyReviewResults, addConcepts, resetMemory, conceptKey, prettyName } from './lib/memory.js'
import { subjectModes, subjectDisplayName, subjectKey } from './lib/subjects.js'
import { resolveTopic } from './lib/review.js'
import { plainText, hasPhrase, isVocabItem, topicFamilyOf } from './lib/topics.js'
import { buildReview } from './lib/mockAI.js'
import { generateQuestions } from './lib/aiClient.js'
import { loadAccount, saveAccount, loadSession, setSession as persistSession, normalizeAccount, newChildId } from './lib/auth.js'
import { setActiveChild, getActiveChild, migrateGlobalToChild } from './lib/active.js'
import { loadStats, saveStats, addSeconds, addSession, setGoalMin, resetStats } from './lib/stats.js'
import { loadSettings, saveSettings } from './lib/settings.js'
import { canon, localMatch } from './lib/answerMatch.js'
import { dotNumbers } from './lib/num.js'
import { loadRecent, pushRecent, resetRecent } from './lib/recent.js'
import { vocabGroupsOf, collectWords, pickWords, buildItems, loadVStats, saveVStats, resetVStats, applyWordResults, loadDict, needsLookup, entryOf, gradeNum, vocabGame } from './lib/vocab.js'
import { ensureEntries } from './lib/vocabFetch.js'
import { unlockSpeech } from './lib/speech.js'

import Auth from './screens/Auth.jsx'
import ChildPicker from './screens/ChildPicker.jsx'
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
import VocabHub from './screens/VocabHub.jsx'
import VocabGame from './screens/VocabGame.jsx'
import TrueFalseGame from './screens/TrueFalseGame.jsx'

const nowMs = () => (typeof performance !== 'undefined' ? performance.now() : Date.now())

// Trò chơi từ vựng: đang tra sổ từ (lần đầu với các từ mới) — chỉ tra MỘT lần cho mỗi từ.
function VocabLoading({ msg }) {
  return (
    <div className="screen center">
      <div className="reading">
        <div className="spinner" />
        <h2>Đang chuẩn bị trò chơi…</h2>
        <p>{msg || 'Chọn từ con cần ôn nhất.'}</p>
      </div>
    </div>
  )
}

// Trò chơi từ vựng chưa chơi được: mạng lỗi khi tra từ, hoặc chưa đủ từ phù hợp với trò này.
function VocabProblem({ kind, gameName, onRetry, onBack }) {
  const text = kind === 'fetch'
    ? { ic: '😅', h: 'Chưa tra được từ điển', p: 'Mạng hơi chậm hoặc đang bận. Con bấm “Thử lại” nhé — từ nào tra xong sẽ được lưu, lần sau chơi ngay.' }
    : kind === 'empty'
      ? { ic: '🔤', h: 'Chưa có từ vựng để chơi', p: 'Con thêm bài tiếng Anh có từ vựng trước nhé.' }
      : { ic: '🧩', h: `Chưa đủ từ cho trò “${gameName}”`, p: gameName === 'Biến đổi từ'
        ? 'Các từ con đã học chưa có dạng biến đổi (vd success → successful, care → careful). Con thử trò khác nhé!'
        : gameName === 'Đúng hay sai' ? 'Trò này cần ít nhất 4 từ đã có nghĩa. Con thêm bài từ vựng hoặc thử trò khác nhé!'
          : 'Các từ con chọn chưa có câu phù hợp cho trò này. Con thử trò khác nhé!' }
  return (
    <div className="screen center">
      <div className="reading">
        <div className="gen-fail-ic">{text.ic}</div>
        <h2>{text.h}</h2>
        <p>{text.p}</p>
        {kind === 'fetch' && <button className="cta" onClick={onRetry}>🔄 Thử lại</button>}
        <button className="cta small ghost" onClick={onBack}>Chọn trò khác</button>
      </div>
    </div>
  )
}

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

// Chưa có cơ sở để ra đề: chưa có bài học nào và cũng chưa gõ chủ đề muốn ôn.
function NoBasisScreen({ onCapture, onBack }) {
  return (
    <div className="screen center">
      <div className="reading">
        <div className="gen-fail-ic">📚</div>
        <h2>Chưa có bài học để ôn</h2>
        <p>Đề ôn tập dựa trên bài con ĐÃ HỌC. Con hãy chụp/thêm bài học trước, hoặc gõ chủ đề muốn ôn ở ô “Yêu cầu cụ thể”.</p>
        <button className="cta" onClick={onCapture}>📸 Thêm bài học</button>
        <button className="cta small ghost" onClick={onBack}>Quay lại chọn</button>
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
    // Câu có 2+ chỗ trống "___" mà mỗi lựa chọn chỉ là MỘT cụm (không có " / ") -> ghép vào không thành câu -> bỏ.
    if ((String(q.q).match(/_{2,}/g) || []).length >= 2 && !rawOpts.some((o) => /\/|–|—|…|\.\.\./.test(o))) continue
    // BẮT BUỘC có lời giải thích: con làm SAI câu nào cũng phải được giải thích VÌ SAO sai.
    if (!String(q.explain || '').trim()) continue
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
    if (!String(q.explain || '').trim()) continue // BẮT BUỘC có lời giải thích (sai là phải biết vì sao)
    const key = canon(q.q)
    if (!key || seenQ.has(key)) continue
    seenQ.add(key)
    out.push({ concept: q.concept || 'Ôn tập', q: dotNumbers(q.q), answer: dotNumbers(String(q.answer).trim()), explain: dotNumbers(q.explain || ''), hint: '', _k: key })
  }
  return orderByFresh(out, recent)
}

// CỘNG DỒN QUA NHIỀU LẦN ÔN: gán nhãn "concept" của mỗi câu về ĐÚNG tên khái niệm trong bộ nhớ
// (khớp theo nghĩa bằng conceptKey), để điểm thành thạo cộng dồn vào đúng khái niệm ở mọi lần học —
// không bị lệch nhãn (AI ghi tên hơi khác) rồi tính lại từ đầu mỗi lần.
// Nhãn lạ -> tìm khái niệm đang ôn có tên nằm TRONG nhãn / câu hỏi / đáp án (vd câu hỏi về "doctor");
// vẫn không rõ thì KHÔNG đoán bừa vào khái niệm khác (trước đây dồn hết vào khái niệm đầu tiên
// -> sai số liệu): gán nhãn chung (vd "Ôn tập") — nhãn chung không ghi vào bản đồ kiến thức.
function remapConcept(qs, memList, askedConcepts, generic = 'Ôn tập', subject = '') {
  const byKey = new Map()
  // Ưu tiên khớp về khái niệm ĐÃ CÓ trong bộ nhớ (để cộng dồn vào lịch sử cũ).
  for (const c of memList || []) {
    const k = conceptKey(c.name)
    if (k && !byKey.has(k)) byKey.set(k, c.name)
  }
  // Thêm các khái niệm đang ôn (VD chủ đề gõ tay "master") nếu chưa có trong bộ nhớ — viết hoa chữ đầu.
  for (const name of askedConcepts || []) {
    const k = conceptKey(name)
    if (k && !byKey.has(k)) byKey.set(k, prettyName(name))
  }
  // Ý NHỎ (details) -> MỤC LỚN chứa nó (vd nhãn "Never have I seen" -> "Câu đảo ngữ (Inversion)").
  const byDetail = new Map()
  for (const c of memList || []) for (const d of c.details || []) {
    const p = plainText(d)
    if (p && !byDetail.has(p)) byDetail.set(p, c.name)
  }
  // Các khái niệm ĐANG ÔN (tên chuẩn theo bản đồ) + dạng không dấu của tên và các ý nhỏ, để dò trong nhãn/câu hỏi.
  const asked = []
  for (const n of askedConcepts || []) {
    const name = byKey.get(conceptKey(n)) || prettyName(n)
    const item = (memList || []).find((c) => conceptKey(c.name) === conceptKey(name))
    const ps = [plainText(name), ...((item && item.details) || []).map(plainText)].filter(Boolean)
    if (ps.length && !asked.some((a) => a.ps[0] === ps[0])) asked.push({ name, ps })
  }
  // Khái niệm đang ôn có tên/ý nhỏ nằm trong đoạn chữ (ưu tiên cụm DÀI nhất, vd "rút gọn phân số" hơn "phân số").
  const findIn = (text) => {
    const t = plainText(text)
    if (!t) return null
    let best = null
    let bestLen = 0
    for (const a of asked) for (const p of a.ps) {
      if ((p.includes(' ') || p.length >= 3) && p.length > bestLen && hasPhrase(t, p)) { best = a.name; bestLen = p.length }
    }
    return best
  }
  // Nhãn là một ý nhỏ của nhóm ngữ pháp lớn ĐÃ có trong bản đồ (vd "Conditional 2" -> "Câu điều kiện (Conditional)").
  const familyOf = (label) => {
    const f = topicFamilyOf(label, subject)
    return f ? byKey.get(conceptKey(f.name)) || null : null
  }
  const answerText = (q) => (typeof q.answer === 'number' && Array.isArray(q.options) ? q.options[q.answer] : q.answer)
  return qs.map((q) => {
    const k = conceptKey(q.concept || '')
    const mapped = (k && byKey.get(k))
      || byDetail.get(plainText(q.concept))                 // nhãn là một ý nhỏ đã lưu
      || familyOf(q.concept)                                // nhãn thuộc nhóm ngữ pháp lớn
      || findIn(q.concept)                                  // nhãn chứa tên/ý nhỏ của khái niệm đang ôn
      || findIn(`${q.q || ''} ${answerText(q) || ''}`)      // câu hỏi/đáp án nhắc tới khái niệm đang ôn
      || (asked.length === 1 ? asked[0].name : generic)     // chỉ ôn 1 chủ đề -> chắc chắn thuộc chủ đề đó
    return { ...q, concept: mapped }
  })
}

// NÂNG CẤP tài khoản CŨ -> cấu trúc nhiều con, LÀM MỘT LẦN lúc nạp module để id con ỔN ĐỊNH
// (không sinh id mới mỗi lần render -> không mất dữ liệu theo con).
const RAW_ACCOUNT = loadAccount()
const INIT_ACCOUNT = normalizeAccount(RAW_ACCOUNT)
if (INIT_ACCOUNT && RAW_ACCOUNT && !(Array.isArray(RAW_ACCOUNT.children) && RAW_ACCOUNT.children.length)) {
  saveAccount(INIT_ACCOUNT) // lần đầu nâng cấp: lưu lại ngay để id con cố định
  const fid = INIT_ACCOUNT.children[0] && INIT_ACCOUNT.children[0].id
  if (fid) migrateGlobalToChild(fid) // GIỮ dữ liệu tài khoản cũ -> chuyển sang con đầu tiên (chỉ khi nâng cấp)
}

export default function App() {
  const [account, setAccount] = useState(INIT_ACCOUNT)
  const [authed, setAuthed] = useState(() => loadSession() && !!INIT_ACCOUNT)
  // Con đang học (null = chưa chọn -> hiện màn chọn con). Khôi phục nếu đã chọn từ trước.
  const [activeChild, setActiveChildState] = useState(() => {
    const aid = getActiveChild()
    return (INIT_ACCOUNT?.children || []).find((c) => c.id === aid) || null
  })
  // CỔNG PHỤ HUYNH bằng MÃ PIN phụ huynh (cùng PIN với bật/tắt trắc nghiệm & xoá dữ liệu).
  // Mật khẩu tài khoản CHỈ dùng lúc đăng nhập (và khi quên PIN).
  const [parentGate, setParentGate] = useState(null) // { onOk } khi đang mở cổng
  const [gateStep, setGateStep] = useState('enter')   // 'enter' | 'set' (chưa có PIN) | 'forgot'
  const [gatePass, setGatePass] = useState('')        // ô nhập PIN
  const [gatePwd, setGatePwd] = useState('')          // mật khẩu tài khoản (chỉ khi quên PIN)
  const [gateErr, setGateErr] = useState('')
  // Đã mở khoá khu vực phụ huynh trong lần này -> bên trong (cài đặt) không hỏi PIN lại.
  // Tự khoá lại khi quay về vai Con / đổi người học / đăng xuất.
  const [parentUnlocked, setParentUnlocked] = useState(false)
  // Bạn ĐANG HỌC lúc phụ huynh mở tab Phụ huynh — để khi bấm "Con" thì trả máy về đúng bạn đó
  // (phụ huynh xem báo cáo con khác không làm đổi người học). null = vào từ màn chọn người học.
  const [homeLearnerId, setHomeLearnerId] = useState(null)
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
  const [noBasis, setNoBasis] = useState(false) // chưa có bài học/chủ đề -> không ra đề
  // Thời gian con CHỜ app soạn/nạp bài (giây) — sẽ được cộng vào thời gian học của buổi ôn.
  const loadSecondsRef = useRef(0)
  // Môn của buổi ôn hiện tại — để ghi nhật ký theo môn cho phụ huynh xem.
  const reviewSubjectRef = useRef('Toán')
  const lastReviewRef = useRef(null) // yêu cầu ôn gần nhất — để bấm "Thử lại"
  // TRÒ CHƠI TỪ VỰNG: { id, game, loading, msg, error, items }; vocabFrom = màn mở trò (để nút ← quay về đúng chỗ).
  const [vocab, setVocab] = useState(null)
  const [vocabFrom, setVocabFrom] = useState('home')
  // Từ trò chơi từ vựng quay về "Bắt đầu ôn" -> giữ môn Tiếng Anh đang chọn (không nhảy về môn đầu danh sách).
  const [crSubject, setCrSubject] = useState(null)
  const lastVocabRef = useRef(null)
  const vocabSeq = useRef(0)

  useEffect(() => { saveMemory(mem) }, [mem])
  useEffect(() => { saveStats(stats) }, [stats])
  useEffect(() => { saveSettings(settings) }, [settings])
  useEffect(() => {
    if (!toast) return undefined
    const t = setTimeout(() => setToast(''), 2600)
    return () => clearTimeout(t)
  }, [toast])

  // ---- Con đang học: vào / đổi / thêm ----
  // Nạp lại dữ liệu ĐÚNG con hiện tại (mỗi con có bản đồ kiến thức + báo cáo riêng).
  function reloadChildData() {
    setMem(loadMemory()); setStats(loadStats()); setSession(null)
  }
  function enterChild(child) {
    if (!child) return
    setActiveChild(child.id)          // đặt con hiện tại (khoá lưu gắn theo id này)
    reloadChildData()
    setActiveChildState(child)
    setParentUnlocked(false)          // máy giao cho con -> khoá khu vực phụ huynh
    setRole('child'); setView('home')
  }
  function switchChild() {
    setActiveChild(null)              // -> quay lại màn chọn con
    setActiveChildState(null)
    setParentUnlocked(false); setHomeLearnerId(null)
    setRole('child'); setView('home')
  }
  function addChild(child) {
    const acc = { ...account, children: [...(account.children || []), child] }
    saveAccount(acc); setAccount(acc)
    setToast(`Đã thêm tài khoản con: ${child.name} ✓`)
  }

  // ---- Đăng ký / đăng nhập / tài khoản ----
  function handleRegister(profile) {
    const pr = profile || {}
    // Gói N học sinh -> tạo N tài khoản con (mỗi con id riêng, có icon + PIN 1-2 số).
    const children = (pr.children || []).map((c) => ({
      id: newChildId(), name: (c.name || '').trim() || 'Bé', pin: c.pin || '', icon: c.icon || '',
      grade: c.grade || '', school: c.school || '', schoolType: c.schoolType || '',
    }))
    if (!children.length) children.push({ id: newChildId(), name: 'Bé', pin: '', icon: '', grade: '', school: '', schoolType: '' })
    const acc = {
      username: pr.phone, password: pr.parentPass || pr.phone, // giữ tương thích cũ
      phone: pr.phone, email: pr.email || '', province: pr.province || '',
      parentName: pr.parentName || '', parentPass: pr.parentPass || '',
      plan: pr.plan || children.length, children,
    }
    saveAccount(acc); setAccount(acc)
    persistSession(true); setAuthed(true); setParentUnlocked(false)
    setActiveChild(null); setActiveChildState(null) // đăng ký xong -> màn chọn con (các con hiện ra)
  }
  function handleLogin(u, p) {
    const acc = account || normalizeAccount(loadAccount())
    const okUser = acc && (u === acc.phone || u === acc.username)
    const okPass = acc && (p === acc.parentPass || p === acc.password)
    if (okUser && okPass) {
      persistSession(true); setAuthed(true); setParentUnlocked(false)
      setActiveChild(null); setActiveChildState(null) // -> hiện màn chọn con
      return true
    }
    return false
  }
  function handleReset(phone, newPass) {
    const acc = account || normalizeAccount(loadAccount())
    if (acc && (phone === acc.phone || phone === acc.username)) {
      const next = { ...acc, parentPass: newPass, password: newPass }
      saveAccount(next); setAccount(next); persistSession(true); setAuthed(true); setParentUnlocked(false)
      setActiveChild(null); setActiveChildState(null)
      return true
    }
    return false
  }
  function changePassword(cur, next) {
    if (!account || (cur !== account.parentPass && cur !== account.password)) return false
    const acc = { ...account, parentPass: next, password: next }
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
  // Xoá dữ liệu học tập CỦA CON ĐANG HỌC (bản đồ kiến thức, báo cáo, thời gian, lịch sử câu) — làm lại từ đầu.
  function resetLearningData() {
    resetMemory(); resetStats(); resetRecent(); resetVStats()
    setMem([]); setStats(loadStats()); setSession(null)
    setToast(`Đã xoá dữ liệu học tập của ${activeChild?.name || 'con'} — bắt đầu lại từ đầu ✓`)
    setView(role === 'child' ? 'home' : 'dashboard')
  }
  function logout() {
    persistSession(false); setAuthed(false); setParentUnlocked(false); setHomeLearnerId(null)
    setActiveChild(null); setActiveChildState(null)
    setRole('child'); setView('home')
  }

  // CỔNG PHỤ HUYNH: nhập MÃ PIN phụ huynh (1 chữ số — cùng PIN bật/tắt trắc nghiệm & xoá dữ liệu).
  // Chưa có PIN -> đặt PIN ngay tại đây. Đã mở khoá trong lần này -> vào thẳng, không hỏi lại.
  function askParent(onOk) {
    if (parentUnlocked) { onOk && onOk(); return }
    setGatePass(''); setGatePwd(''); setGateErr('')
    setGateStep(account?.pin ? 'enter' : 'set')
    setParentGate({ onOk })
  }
  function passGate() {
    const cb = parentGate?.onOk
    setParentGate(null); setGatePass(''); setGatePwd(''); setGateErr('')
    setParentUnlocked(true)
    if (cb) cb()
  }
  function submitParentGate() {
    if (gateStep === 'enter') {
      if (gatePass === String(account?.pin ?? '')) passGate()
      else setGateErr('Mã PIN chưa đúng.')
    } else if (gateStep === 'set') {
      if (!/^\d$/.test(gatePass)) { setGateErr('Mã PIN là 1 chữ số (0–9).'); return }
      setParentPin(gatePass); passGate()
    } else if (gateStep === 'forgot') {
      // Quên PIN: xác minh bằng MẬT KHẨU tài khoản (chỉ phụ huynh biết), rồi đặt PIN mới.
      if (gatePwd !== (account?.parentPass || account?.password)) { setGateErr('Mật khẩu tài khoản chưa đúng.'); return }
      if (!/^\d$/.test(gatePass)) { setGateErr('Mã PIN mới là 1 chữ số (0–9).'); return }
      setParentPin(gatePass); passGate()
    }
  }
  // Từ màn chọn con -> khu vực phụ huynh: nhập PIN rồi mở báo cáo con đầu tiên.
  function enterParentArea() {
    askParent(() => {
      const first = (account?.children || [])[0]
      if (first) { setActiveChild(first.id); reloadChildData(); setActiveChildState(first) }
      setHomeLearnerId(null) // vào từ màn chọn -> chưa có ai đang học
      setRole('parent'); setView('dashboard')
    })
  }

  // Tab Phụ huynh: bấm icon một con -> xem báo cáo của con đó ngay (không cần qua màn chọn người học).
  // Cả khu phụ huynh (báo cáo, mục tiêu, xoá dữ liệu) đều theo ĐÚNG con đang xem.
  function viewChildInParent(child) {
    if (!child || (activeChild && child.id === activeChild.id)) return
    setActiveChild(child.id)
    reloadChildData()
    setActiveChildState(child)
  }

  function switchRole(r) {
    if (r === 'parent') {
      if (role === 'parent') { setView('dashboard'); return } // đang ở tab Phụ huynh -> giữ nguyên người học cũ
      const learner = activeChild ? activeChild.id : null
      askParent(() => { setHomeLearnerId(learner); setRole('parent'); setView('dashboard') })
      return
    }
    if (role === 'parent') {
      // Rời tab Phụ huynh -> trả máy về ĐÚNG bạn đang học trước đó (dù phụ huynh vừa xem báo cáo con khác).
      const home = homeLearnerId && (account?.children || []).find((c) => c.id === homeLearnerId)
      if (!home) { switchChild(); return } // vào từ màn chọn -> về màn chọn để con tự chọn + gõ PIN
      if (!activeChild || activeChild.id !== home.id) { setActiveChild(home.id); reloadChildData(); setActiveChildState(home) }
      setHomeLearnerId(null)
    }
    setParentUnlocked(false) // quay về vai Con -> khoá lại khu vực phụ huynh
    setRole(r); setView('home')
  }

  async function startReview(opts = {}) {
    const { title = 'Ôn tập', conceptNames, count = 10, mode = 'quiz', master = false, masterText = '', subject: subjectOpt = '', enLang = 'vi' } = opts
    lastReviewRef.current = opts // để nút "Thử lại" soạn lại đúng yêu cầu này
    // An toàn: nếu phụ huynh đã tắt trắc nghiệm thì mọi buổi ôn đều là tự điền.
    const m = settings.allowChoice ? mode : 'typed'
    const viewFor = { typed: 'typed', falling: 'falling', quickfire: 'quickfire', boss: 'boss', balloon: 'balloon', sushi: 'sushi', finderror: 'finderror', mario: 'mario' }
    setReviewTitle(title)
    setReviewMode(m)
    setReviewQuestions(null)
    setGenError(false)
    setNotApplic(false)
    setNoBasis(false)
    setGenerating(true)
    setView(viewFor[m] || 'review')
    // Bắt đầu bấm giờ CHỜ nạp bài (con vẫn đang "học" trong lúc đợi app soạn câu hỏi).
    const loadT0 = (typeof performance !== 'undefined' ? performance.now() : Date.now())
    let names = conceptNames
    if (!names || !names.length) {
      // Nếu đã chọn môn thì chỉ lấy khái niệm CỦA MÔN đó (không trộn môn khác).
      const pool = subjectOpt ? mem.filter((c) => subjectDisplayName(c.subject) === subjectDisplayName(subjectOpt)) : mem
      names = [...pool].sort((a, b) => a.mastery - b.mastery).slice(0, 4).map((c) => c.name)
    }
    // Master + chủ đề gõ tay: luyện đúng chủ đề con muốn "master" (không giới hạn trong bộ nhớ).
    // Cho gõ NHIỀU chủ đề (tách bằng dấu phẩy / xuống dòng / chấm phẩy) -> App KẾT HỢP bài khó của các chủ đề.
    const mt = (masterText || '').trim()
    let subject, topic, concepts
    if (master && mt) {
      subject = subjectOpt || (mem.find((c) => c.name === names[0])?.subject) || 'Môn khác'
      // Hiểu từng chủ đề gõ tay: bỏ chữ "ôn/luyện…", khớp khái niệm trong bản đồ của MÔN này,
      // "từ vựng"/"ngữ pháp" -> các từ vựng/điểm ngữ pháp con đã học. Lời chung chung -> phần yếu nhất.
      const subjMem = mem.filter((c) => subjectDisplayName(c.subject) === subjectDisplayName(subject))
      const topics = [...new Set(mt.split(/[,;\n]+/).map((s) => s.trim()).filter(Boolean)
        .flatMap((t) => resolveTopic(t, subjMem, { limit: 5, vocabLimit: 8 })))]
      concepts = topics.length ? topics : names
      topic = concepts.length > 1 ? `Kết hợp: ${concepts.join(' + ')}` : (concepts[0] || mt)
    } else {
      // Lấy đúng MÔN + CHỦ ĐỀ của khái niệm đang ôn (không mặc định "Phân số" nữa),
      // để câu hỏi ra đúng nội dung con đang học (số tự nhiên, hình học…).
      const first = mem.find((c) => c.name === names[0])
      subject = subjectOpt || first?.subject || 'Môn khác'
      topic = first?.topic || names[0] || 'Ôn tập'
      concepts = names
    }
    // KHÔNG bịa đề: đề ôn tập phải DỰA TRÊN bài con đã học (chụp/thêm) hoặc chủ đề anh gõ.
    // Chưa có cơ sở nào -> báo để thêm bài học, tuyệt đối không tự tạo đề vu vơ.
    if (!concepts || !concepts.length) {
      setGenerating(false)
      setNoBasis(true)
      return
    }
    reviewSubjectRef.current = subject
    // "Tìm lỗi sai" chỉ dùng cho môn có hồ sơ cho phép (ngôn ngữ: Tiếng Việt/Tiếng Anh); Toán & khung chung thì ẩn.
    if (m === 'finderror' && !subjectModes(subject).includes('finderror')) {
      setGenerating(false)
      setNotApplic(true)
      return
    }
    // Gửi kèm Ý NHỎ đã học của từng chủ đề lớn (câu mẫu, từ vựng, ví dụ) -> câu hỏi bám đúng nội dung bài.
    const memByKey = new Map(mem.map((c) => [conceptKey(c.name), c]))
    const conceptsForAI = concepts.map((n) => {
      const c = memByKey.get(conceptKey(n))
      const d = c && Array.isArray(c.details) ? c.details.slice(0, 20) : []
      return d.length ? { name: c.name, details: d } : n
    })
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
      // Nhanh nhờ generateQuestions chạy nhiều đợt nhỏ SONG SONG. Tối đa 4 lượt để gom đủ câu
      // KHÁC NHAU (KHÔNG lặp lại). Thiếu thì thà ít câu chứ KHÔNG nhân bản câu -> hết trùng.
      for (let round = 0; round < 4 && list.length < count; round++) {
        const ask = round === 0 ? count + 3 : (count - list.length) + 3
        // generateQuestions đã tự bắt lỗi nên không ném ra ngoài.
        const batch = await generateQuestions({ subject, grade: '4-5', topic, concepts: conceptsForAI, count: ask, format: fmt, master, enLang })
        // KHÔNG dừng khi một lượt rỗng (mạng chập chờn) — thử tiếp lượt sau để đủ số câu đã chọn.
        if (batch && batch.length) {
          raw = raw.concat(batch)
          list = norm(raw) // chuẩn hoá + khử trùng trên TOÀN BỘ các lượt đã gộp
        }
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
    // Gán nhãn khái niệm của từng câu về ĐÚNG khái niệm trong bộ nhớ (khớp theo nghĩa)
    // -> điểm thành thạo CỘNG DỒN vào đúng khái niệm qua các lần ôn khác nhau.
    // Nhãn chung khi câu hỏi không rõ thuộc khái niệm nào: buổi ôn TỪ VỰNG -> "Từ vựng", còn lại "Ôn tập".
    const generic = concepts.length && concepts.every((n) => n === 'Từ vựng' || isVocabItem({ name: n })) ? 'Từ vựng' : 'Ôn tập'
    qs = remapConcept(qs, mem, concepts, generic, subject)
    // Ghi nhớ các câu đã dùng để lần sau không lặp lại y hệt.
    pushRecent(qs.map((q) => q._k).filter(Boolean))
    // KHÔNG nhân bản câu để "cho đủ" nữa — thà ít câu chứ tuyệt đối không để TRÙNG câu hỏi.
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
      subject: reviewSubjectRef.current || 'Môn khác',
      total: summary.total || 0,
      correct: summary.correct || 0,
      sec: studySeconds,
    }))
    loadSecondsRef.current = 0 // đã cộng xong, tránh cộng trùng
    // MỘT phép tính duy nhất cho cả màn "Thay đổi hôm nay" và bản đồ kiến thức -> báo cáo của con
    // và của phụ huynh LUÔN KHỚP. Gộp chủ đề trùng (hoa/thường), tính từ điểm thật (không dùng mốc giả).
    const { mem: nextMem, deltas } = applyReviewResults(mem, perConcept, {
      choice: reviewMode !== 'typed', // tự gõ đáp án: +20/câu; trắc nghiệm & game: +14/câu
      subject: reviewSubjectRef.current || '',
    })
    setMem(nextMem)
    setSession({ ...summary, deltas, studySeconds })
    setStreak((s) => s + 1)
    setView('result')
  }

  // ===== TRÒ CHƠI TỪ VỰNG (chốt 6/10/2026) =====
  function openVocab(from) { setVocabFrom(from || 'home'); setView('vocabhub') }

  // Tra trước (chạy nền) các từ CHƯA có trong sổ -> con bấm chơi là chơi ngay. Lỗi mạng: bỏ qua, lần sau tra lại.
  function prefetchVocab(words, max = 30) {
    if (words && words.length) ensureEntries(words, { max }).catch(() => {})
  }

  // opts: { game, groupNames, level, count, keys? } — keys: chơi lại đúng các từ này (vd "Làm lại các từ sai").
  async function startVocabGame(opts = {}) {
    const { game, groupNames = null, level = 'weak', count = 10, keys = null } = opts
    const info = vocabGame(game)
    if (!info) return
    unlockSpeech() // iPhone: phải "mở loa" ngay trong cú chạm thì sau đó app mới tự đọc từ được
    lastVocabRef.current = opts
    const id = ++vocabSeq.current
    setVocab({ id, game, loading: true, msg: '' })
    setView('vocab')
    const t0 = nowMs()
    const groups = vocabGroupsOf(mem).filter((c) => !groupNames || !groupNames.length || groupNames.includes(c.name))
    const all = collectWords(groups)
    const vstats = loadVStats()
    let ordered
    if (keys && keys.length) {
      const byKey = new Map(collectWords(vocabGroupsOf(mem)).map((w) => [w.key, w]))
      ordered = keys.map((k) => byKey.get(k)).filter(Boolean)
    } else {
      ordered = pickWords(all, vstats, { level, count: all.length }) // xếp TẤT CẢ theo ưu tiên (từ hay sai / từ mới trước)
    }
    if (!ordered.length) { setVocab({ id, game, loading: false, error: 'empty' }); return }
    // Lấy dư một chút: không phải từ nào cũng có câu ví dụ / dạng biến đổi.
    const want = game === 'truefalse' ? Math.max(16, count) : (game === 'cloze' || game === 'wordform') ? count * 2 + 4 : count + 3
    const head = ordered.slice(0, want)
    let dict = loadDict()
    const missing = head.filter((x) => needsLookup(dict, x.key)).length
    if (missing) {
      setVocab({ id, game, loading: true, msg: `Đang tra từ điển cho ${missing} từ mới — mỗi từ chỉ tra một lần, lần sau chơi ngay.` })
      dict = await ensureEntries(head, { max: want })
    }
    if (vocabSeq.current !== id) return // con đã thoát/chọn trò khác trong lúc chờ
    const grade = gradeNum(activeChild && activeChild.grade)
    const items = game === 'truefalse'
      ? buildItems('spell', head, dict, vstats, { count: head.length, grade }) // "bể từ" để ghép cặp Đúng/Sai
      : buildItems(game, head, dict, vstats, { count, grade })
    if (items.length < (game === 'truefalse' ? 4 : 1)) {
      const stillMissing = head.some((x) => needsLookup(dict, x.key))
      setVocab({ id, game, loading: false, error: stillMissing ? 'fetch' : 'notenough' })
      return
    }
    loadSecondsRef.current = Math.min(180, (nowMs() - t0) / 1000)
    reviewSubjectRef.current = 'Tiếng Anh'
    setVocab({ id, game, loading: false, items })
  }

  // Xong một lượt trò chơi từ vựng: ghi đúng/sai TỪNG TỪ + nhật ký theo ngày + % thành thạo của CHỦ ĐỀ.
  // "Đúng hay sai" là trò khởi động -> KHÔNG tính vào % thành thạo (đoán 50/50 sẽ làm % ảo).
  function handleVocabFinish(summary, perConcept, wordResults) {
    const game = vocab && vocab.game
    const info = vocabGame(game) || {}
    const loadSec = loadSecondsRef.current || 0
    loadSecondsRef.current = 0
    vocabSeq.current += 1
    if (wordResults && wordResults.length) saveVStats(applyWordResults(loadVStats(), wordResults, loadDict()))
    const total = summary.total || 0
    if (!total) {
      setToast('Lượt này chưa trả lời câu nào nên không tính nhé.')
      setView('vocabhub')
      return
    }
    const studySeconds = Math.round((summary.activeSeconds || 0) + loadSec)
    setStats((s) => addSession(addSeconds(s, studySeconds), {
      subject: 'Tiếng Anh', total, correct: summary.correct || 0, sec: studySeconds,
    }))
    let deltas = []
    if (info.mastery && info.mastery !== 'none' && perConcept && Object.keys(perConcept).length) {
      const r = applyReviewResults(mem, perConcept, { choice: info.mastery === 'choice', subject: 'Tiếng Anh' })
      setMem(r.mem)
      deltas = r.deltas
    }
    const dict = loadDict()
    const wrongKeys = [...new Set((wordResults || []).filter((r) => r && !r.ok).map((r) => r.key))]
    const wrong = wrongKeys.map((k) => { const e = entryOf(dict, k); return e ? { key: k, w: e.w, mean: e.mean[0] } : null }).filter(Boolean)
    setSession({ ...summary, total, deltas, studySeconds, vocab: { game, name: info.name, wrong, warmup: info.mastery === 'none' } })
    setStreak((s) => s + 1)
    setView('result')
  }
  function retryWrongWords() {
    const v = session && session.vocab
    if (!v || !v.wrong || !v.wrong.length) return
    // Sai ở "Đúng hay sai" -> luyện lại bằng "Gõ nghĩa" (nhớ chủ động); trò khác -> chơi lại đúng trò đó.
    const game = v.game === 'truefalse' ? 'meaning' : v.game
    startVocabGame({ game, keys: v.wrong.map((x) => x.key), count: v.wrong.length })
  }

  function onExtracted(result) { setPending(result); setView('approve') }
  function onSaveApprove(checked, subject) {
    // Dùng MÔN phụ huynh đã chọn/xác nhận (tránh AI đoán sai -> Toán lẫn vào Tiếng Anh).
    const subj = subject || pending.subject
    const chosen = (pending?.concepts || [])
      .filter((c) => checked[c.id])
      .map((c) => ({ ...c, subject: subj, topic: pending.topic }))
    const nextMem = addConcepts(mem, chosen)
    setMem(nextMem)
    // Bài TIẾNG ANH có từ vựng -> tra trước sổ từ (chạy nền) để trò chơi từ vựng mở ra là chơi ngay.
    if (subjectKey(subj) === 'tieng-anh') prefetchVocab(collectWords(vocabGroupsOf(nextMem)), 40)
    setToast(`Đã lưu ${chosen.length} chủ đề vào bộ nhớ của con ✓`)
    setPending(null)
    setView(role === 'child' ? 'home' : 'dashboard')
  }
  const retryReview = () => { if (lastReviewRef.current) startReview(lastReviewRef.current) }
  const goHomeFromError = () => { setGenError(false); setView('home') }
  const genOrScreen = (node) => {
    if (noBasis) return <NoBasisScreen onCapture={() => { setNoBasis(false); setView('capture') }} onBack={() => { setNoBasis(false); setView('custom') }} />
    if (notApplic) return <NotApplicScreen onBack={() => { setNotApplic(false); setView('custom') }} />
    if (genError) return <GenErrorScreen onRetry={retryReview} onHome={goHomeFromError} />
    return (generating || !reviewQuestions) ? <GeneratingScreen /> : node
  }
  const homeView = role === 'child' ? 'home' : 'dashboard'

  // Cổng PIN phụ huynh (hiện đè lên mọi màn).
  const onlyDigit = (v) => (v || '').replace(/\D+/g, '')
  const gateEnterKey = (e) => { if (e.key === 'Enter') submitParentGate() }
  const gateModal = parentGate ? (
    <div className="modal-back" onClick={() => setParentGate(null)}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        {gateStep === 'enter' && (
          <>
            <h3>Dành cho Phụ huynh</h3>
            <p className="cr-hint">Nhập mã PIN phụ huynh (1 chữ số).</p>
            <input className="auth-in pin-in" type="password" inputMode="numeric" maxLength={1} autoFocus placeholder="•"
              value={gatePass} onChange={(e) => { setGatePass(onlyDigit(e.target.value)); setGateErr('') }} onKeyDown={gateEnterKey} />
            <button className="linkbtn" onClick={() => { setGateStep('forgot'); setGatePass(''); setGatePwd(''); setGateErr('') }}>Quên mã PIN?</button>
          </>
        )}
        {gateStep === 'set' && (
          <>
            <h3>Đặt mã PIN phụ huynh</h3>
            <p className="cr-hint">Chưa có mã PIN. Đặt 1 chữ số — dùng để vào mục Dành cho Phụ huynh, bật/tắt trắc nghiệm và xoá dữ liệu.</p>
            <input className="auth-in pin-in" type="password" inputMode="numeric" maxLength={1} autoFocus placeholder="•"
              value={gatePass} onChange={(e) => { setGatePass(onlyDigit(e.target.value)); setGateErr('') }} onKeyDown={gateEnterKey} />
          </>
        )}
        {gateStep === 'forgot' && (
          <>
            <h3>Đặt lại mã PIN</h3>
            <p className="cr-hint">Nhập mật khẩu tài khoản (lúc đăng nhập), rồi đặt mã PIN mới.</p>
            <input className="auth-in" type="password" inputMode="numeric" maxLength={12} autoFocus placeholder="Mật khẩu tài khoản"
              value={gatePwd} onChange={(e) => { setGatePwd(onlyDigit(e.target.value)); setGateErr('') }} onKeyDown={gateEnterKey} />
            <input className="auth-in pin-in" type="password" inputMode="numeric" maxLength={1} placeholder="PIN mới"
              value={gatePass} onChange={(e) => { setGatePass(onlyDigit(e.target.value)); setGateErr('') }} onKeyDown={gateEnterKey} />
          </>
        )}
        {gateErr && <div className="err">{gateErr}</div>}
        <div className="modal-btns">
          <button className="cta ghost" onClick={() => setParentGate(null)}>Huỷ</button>
          <button className="cta" onClick={submitParentGate}>{gateStep === 'enter' ? 'Vào' : 'Lưu & vào'}</button>
        </div>
      </div>
    </div>
  ) : null

  if (!authed) {
    return (
      <div className="stage">
        <div className="phone">
          <Auth account={account} onRegister={handleRegister} onLogin={handleLogin} onReset={handleReset} />
        </div>
      </div>
    )
  }

  // Đã đăng nhập nhưng CHƯA chọn con -> màn chọn con (các con hiện ra để chọn học).
  if (!activeChild) {
    return (
      <div className="stage">
        <div className="phone">
          <ChildPicker account={account} onEnter={enterChild} onAddChild={addChild} onParent={enterParentArea} requireParent={askParent} onLogout={logout} />
          {gateModal}
        </div>
      </div>
    )
  }

  let screen = null
  if (view === 'settings') {
    screen = <Settings account={account} settings={settings} stats={stats} unlocked={parentUnlocked} childName={activeChild?.name || ''}
      onChangePassword={changePassword} onSaveEmail={saveEmail} onSetPin={setParentPin} onResetData={resetLearningData}
      onSetGoal={(min) => setStats((s) => setGoalMin(s, min))}
      onToggleChoice={(v) => setSettings((s) => ({ ...s, allowChoice: v }))}
      onBack={() => { if (role === 'child') setParentUnlocked(false); setView(homeView) }} />
  } else if (role === 'child') {
    if (view === 'custom') {
      screen = <CustomReview mem={mem} allowChoice={settings.allowChoice} initialSubject={crSubject} onStart={startReview} onBack={() => setView('home')}
        onVocab={() => { setCrSubject('Tiếng Anh'); openVocab('custom') }} />
    } else if (view === 'vocabhub') {
      screen = <VocabHub mem={mem} grade={gradeNum(activeChild && activeChild.grade)} allowChoice={settings.allowChoice}
        onStart={startVocabGame} onBack={() => setView(vocabFrom === 'custom' ? 'custom' : 'home')}
        onCapture={() => setView('capture')} onPrefetch={(words) => prefetchVocab(words, 30)} />
    } else if (view === 'vocab') {
      const v = vocab || {}
      const toHub = () => { vocabSeq.current += 1; setView('vocabhub') }
      if (v.loading) screen = <VocabLoading msg={v.msg} />
      else if (v.error) screen = <VocabProblem kind={v.error} gameName={(vocabGame(v.game) || {}).name || ''} onRetry={() => startVocabGame(lastVocabRef.current || {})} onBack={toHub} />
      else if (v.game === 'truefalse') screen = <TrueFalseGame key={v.id} pool={v.items} onFinish={handleVocabFinish} onExit={toHub} />
      else screen = <VocabGame key={v.id} game={v.game} items={v.items} onFinish={handleVocabFinish} onExit={toHub} />
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
      screen = <Result session={session} onHome={() => setView('home')} onReport={() => setView('report')}
        onRetryWrong={retryWrongWords} onMoreGames={() => setView('vocabhub')} />
    } else if (view === 'report') {
      // Học sinh XEM báo cáo học tập của mình (chỉ xem — không sửa môn, không vào cài đặt, không cần mật khẩu).
      screen = <ParentDashboard mem={mem} stats={stats} child={activeChild} viewer="child" onBack={() => setView('home')} toast={toast} />
    } else {
      screen = <ChildHome mem={mem} stats={stats} child={activeChild}
        slogan={settings.slogan || ''}
        onSetSlogan={(s) => setSettings((x) => ({ ...x, slogan: s }))}
        onReview={() => { setCrSubject(null); setView('custom') }} onCapture={() => setView('capture')}
        vocabWords={collectWords(vocabGroupsOf(mem)).length} onVocab={() => openVocab('home')}
        onReport={() => setView('report')} onSwitchChild={switchChild} />
    }
  } else {
    // Phụ huynh chỉ xem báo cáo + vào Cài đặt (mục tiêu, bật/tắt trắc nghiệm).
    screen = <ParentDashboard key={activeChild?.id || 'none'} mem={mem} session={session} stats={stats} child={activeChild}
      kids={account?.children || []} onViewChild={viewChildInParent}
      onSettings={() => setView('settings')} toast={toast} />
  }

  return (
    <div className="stage">
      <div className="demoswitch">
        <span className="ds-label">Bản demo · xem với vai:</span>
        <div className="ds-seg">
          <button className={role === 'child' ? 'on' : ''} onClick={() => switchRole('child')}>Con</button>
          <button className={role === 'parent' ? 'on' : ''} onClick={() => switchRole('parent')}>Phụ huynh</button>
        </div>
        {activeChild && <button className="ds-logout" onClick={switchChild} title="Đổi người học">↔ Đổi người học</button>}
        <button className="ds-logout" onClick={() => askParent(() => setView('settings'))} title="Cài đặt (phụ huynh)">⚙️</button>
        <button className="ds-logout" onClick={logout} title="Đăng xuất">Đăng xuất</button>
      </div>
      <div className="phone">{screen}{gateModal}</div>
    </div>
  )
}
