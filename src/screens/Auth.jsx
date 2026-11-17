import { useState, useEffect } from 'react'
import { CHILD_ICONS } from '../lib/icons.js'
import { SelectPicker } from '../components.jsx'
import logoFull from '../assets/logo-full.png'
import { getPricesPublic, vnd } from '../lib/adminApi.js'

// 4 khối trường (bấm tick để chọn).
const SCHOOL_TYPES = ['Công lập', 'Tư thục', 'Song ngữ', 'Quốc tế (đơn ngữ)']
const GRADES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
const PLANS = [1, 2, 3, 4, 5]

const blankKid = () => ({ name: '', pin: '', icon: '', grade: '', school: '', schoolType: '' })

// Lời báo cho phụ huynh (kết quả từ máy chủ tài khoản).
const MSG = {
  bad_login: 'Sai số điện thoại / email hoặc mật khẩu.',
  slow_down: 'Nhập sai nhiều lần quá. Đợi 15 phút rồi thử lại nhé.',
  offline: 'Chưa kết nối được máy chủ. Kiểm tra mạng rồi thử lại.',
  phone_taken: 'Số điện thoại này đã có tài khoản. Bấm “← Quay lại” rồi chọn “Đăng nhập” (đăng nhập được trên mọi máy).',
  email_taken: 'Email này đã dùng cho một tài khoản khác. Dùng email khác, hoặc đăng nhập bằng tài khoản đó.',
  error: 'Chưa làm được, anh/chị thử lại sau ít phút nhé.',
  not_on_server: 'Số điện thoại / email này chưa có tài khoản trên máy chủ. Nếu đã đăng ký từ trước trên máy khác: mở Ôn Tập trên máy đó một lần (tài khoản sẽ tự lên máy chủ), rồi đăng nhập lại ở đây. Chưa đăng ký thì bấm “← Quay lại” rồi chọn “Đăng ký”.',
  reset_not_on_server: 'Số điện thoại này chưa có tài khoản trên máy chủ. Mở Ôn Tập trên máy đã đăng ký một lần (tài khoản sẽ tự lên máy chủ), rồi bấm “Đăng nhập” ở đây bằng mật khẩu cũ.',
  reset_other_device: 'Máy này chưa đăng nhập tài khoản này lần nào. Hãy vào “Quên mật khẩu” trên máy đã đăng nhập trước đây để đặt mật khẩu mới, rồi đăng nhập ở đây bằng mật khẩu mới.',
  reset_offline: 'Chưa kết nối được máy chủ. Kiểm tra mạng rồi thử lại.',
  reset_stale: 'Mật khẩu tài khoản đã được đổi ở máy khác. Hãy đăng nhập bằng mật khẩu mới, hoặc đặt lại trên máy đang đăng nhập.',
}
// Quên mật khẩu bằng mã gửi tới email (10/11/2026) — lời báo theo lỗi máy chủ.
const FMSG = {
  bad_id: 'Nhập số điện thoại hoặc email đã đăng ký.',
  not_found: 'Số điện thoại / email này chưa có tài khoản. Nếu đã đăng ký từ trước trên máy khác: mở Ôn Tập trên máy đó một lần (tài khoản sẽ tự lên máy chủ) rồi thử lại. Chưa đăng ký thì quay lại và chọn “Đăng ký”.',
  no_email: 'Tài khoản này chưa có email nên chưa gửi được mã. Hãy làm “Quên mật khẩu” trên máy đã đăng nhập tài khoản này, hoặc đăng nhập rồi thêm email trong Cài đặt.',
  mail_off: 'Máy chủ chưa cài gửi email nên chưa gửi được mã. Anh/chị thử lại sau, hoặc làm “Quên mật khẩu” trên máy đã đăng nhập tài khoản này.',
  mail_error: 'Chưa gửi được email lúc này. Anh/chị thử lại sau ít phút.',
  send_limit: 'Đã gửi mã quá nhiều lần. Đợi 1 giờ rồi thử lại.',
  code_expired: 'Mã đã hết hạn hoặc đã được dùng. Bấm “Gửi lại mã” để nhận mã mới.',
  code_locked: 'Nhập sai mã 5 lần nên mã đã bị huỷ. Bấm “Gửi lại mã” để nhận mã mới.',
  bad_code: 'Nhập đủ mã 6 số trong email.',
  bad_pass: 'Mật khẩu mới phải gồm ĐÚNG 8 chữ số.',
  slow_down: MSG.slow_down,
  offline: MSG.offline,
  error: MSG.error,
}
const RESEND_WAIT = 60 // giây chờ trước khi "Gửi lại mã"

// QR giả (chỉ để minh hoạ trang thanh toán) — 3 ô định vị góc + rải ô theo seed.
function qrCells(seed) {
  const N = 25, cells = []
  const finder = (ox, oy) => {
    for (let y = 0; y < 7; y++) for (let x = 0; x < 7; x++) {
      const border = x === 0 || x === 6 || y === 0 || y === 6
      const inner = x >= 2 && x <= 4 && y >= 2 && y <= 4
      if (border || inner) cells.push([ox + x, oy + y])
    }
  }
  finder(0, 0); finder(N - 7, 0); finder(0, N - 7)
  let s = (seed || 7) % 2147483647; if (s <= 0) s += 2147483646
  const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const inFinder = (x < 8 && y < 8) || (x > N - 9 && y < 8) || (x < 8 && y > N - 9)
    if (inFinder) continue
    if (rnd() > 0.55) cells.push([x, y])
  }
  return { N, cells }
}

function QR({ seed }) {
  const { N, cells } = qrCells(seed)
  return (
    <svg className="pay-qr" viewBox={`0 0 ${N} ${N}`} role="img" aria-label="QR chuyển khoản (demo)">
      <rect x="0" y="0" width={N} height={N} fill="#fff" />
      {cells.map(([x, y], i) => <rect key={i} x={x} y={y} width="1" height="1" fill="#14212E" />)}
    </svg>
  )
}

// ĐĂNG NHẬP NHIỀU MÁY (01/11/2026): tài khoản lưu ở máy chủ — đăng ký ở máy nào cũng đăng nhập được ở máy khác,
// bằng SỐ ĐIỆN THOẠI hoặc EMAIL + mật khẩu (onLogin/onRegister/onReset gọi máy chủ nên chờ kết quả).
// QUÊN MẬT KHẨU (10/11/2026): máy nào cũng làm được — onForgotSend gửi mã 6 số tới email đã đăng ký, onForgotReset
// kiểm mã + đặt mật khẩu mới rồi vào app. Máy đã từng đăng nhập tài khoản đó (localResetPhone) vẫn có cách cũ
// (onReset, không cần mã) làm dự phòng khi không gửi được email.
export default function Auth({ account, notice = '', onRegister, onLogin, onReset, onCheck, onForgotSend, onForgotReset, localResetPhone }) {
  const [mode, setMode] = useState(notice ? 'login' : 'landing') // landing | login | register | pay | forgot
  const [busy, setBusy] = useState(false) // đang chờ máy chủ
  const [touched, setTouched] = useState(false)
  // Phụ huynh
  const [parentName, setParentName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [pass, setPass] = useState('')
  const [pass2, setPass2] = useState('')
  const [province, setProvince] = useState('')
  const [plan, setPlan] = useState(1)
  const [kids, setKids] = useState([blankKid()])
  // Đăng nhập / quên mật khẩu
  const [u, setU] = useState('')
  const [p, setP] = useState('')
  const [np, setNp] = useState('')
  const [np2, setNp2] = useState('')
  const [fStep, setFStep] = useState('send') // quên mật khẩu: send (nhập số / email) | code (nhập mã + mật khẩu mới) | old (cách cũ trên máy này)
  const [code, setCode] = useState('')
  const [sentTo, setSentTo] = useState('')
  const [sentAt, setSentAt] = useState(0)
  const [now, setNow] = useState(() => Date.now())
  const [fbPhone, setFbPhone] = useState('') // máy này có tài khoản đó -> được dùng cách cũ
  useEffect(() => {
    if (mode !== 'forgot' || fStep !== 'code') return undefined
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [mode, fStep])
  // Thanh toán (demo)
  const [cycle, setCycle] = useState('year')
  // Bảng giá gói do quản trị đặt ở trang /quan-tri (17/11/2026). Chưa đặt (0) -> "liên hệ".
  const [prices, setPrices] = useState(null)
  useEffect(() => { getPricesPublic().then(setPrices) }, [])
  const priceOf = (n, c) => { const x = prices && prices.plans && prices.plans[String(n)]; return x && x[c] ? vnd(x[c]) : '' }
  const priceLine = (n) => { const m = priceOf(n, 'month'), y = priceOf(n, 'year'); return m || y ? [m && m + ' / tháng', y && y + ' / năm'].filter(Boolean).join(' · ') : 'Giá: liên hệ' }
  const [err, setErr] = useState('')

  const onlyDigits = (s) => (s || '').replace(/\D+/g, '')
  const bind = (setter, digits = false) => (e) => { setTouched(true); setter(digits ? onlyDigits(e.target.value) : e.target.value) }

  function setPlanN(n) {
    setPlan(n)
    setKids((cur) => {
      const next = cur.slice(0, n)
      while (next.length < n) next.push(blankKid())
      return next
    })
  }
  function setKid(i, key, val) {
    setTouched(true)
    setKids((cur) => cur.map((k, idx) => (idx === i ? { ...k, [key]: val } : k)))
  }

  // ---- Kiểm tra bắt buộc ----
  const vName = parentName.trim().length > 0
  const vPhone = /^\d{8,12}$/.test(onlyDigits(phone))
  const vEmail = /^\S+@\S+\.\S+$/.test(email.trim())
  const vPass = /^\d{8}$/.test(pass)
  const vPass2 = pass.length > 0 && pass2 === pass
  const vProv = province.trim().length > 0
  const kidValid = (k) => k.name.trim() && /^\d{1,2}$/.test(k.pin) && k.icon && k.grade && k.school.trim() && k.schoolType
  const allKids = kids.length === plan && kids.every(kidValid)
  const regValid = vName && vPhone && vEmail && vPass && vPass2 && vProv && allKids
  const ec = (ok) => 'auth-in' + (touched && !ok ? ' auth-in--err' : '') // tô đỏ ô còn thiếu (sau khi bắt đầu điền)

  async function goPay() {
    setTouched(true)
    if (!regValid) { setErr('Còn mục chưa điền (được tô màu) — bổ sung để tiếp tục.'); return }
    setErr('')
    // số điện thoại / email đã có tài khoản (đăng ký ở máy khác) -> báo ngay, không cho đăng ký trùng
    if (onCheck) {
      setBusy(true)
      const c = await onCheck(onlyDigits(phone), email.trim()).catch(() => ({}))
      setBusy(false)
      if (c.phoneTaken) { setErr(MSG.phone_taken); return }
      if (c.emailTaken) { setErr(MSG.email_taken); return }
    }
    setMode('pay')
  }
  async function finishRegister() {
    if (busy) return
    setErr(''); setBusy(true)
    const r = await onRegister({
      parentName: parentName.trim(), phone: onlyDigits(phone), email: email.trim(),
      parentPass: pass, province: province.trim(), plan,
      children: kids.map((k) => ({ name: k.name.trim(), pin: k.pin, icon: k.icon, grade: k.grade, school: k.school.trim(), schoolType: k.schoolType })),
    }).catch(() => ({ error: 'error' }))
    setBusy(false)
    if (r && r.error) setErr(MSG[r.error] || MSG.error)
  }
  async function submitLogin() {
    if (busy) return
    setErr('')
    if (!u.trim() || !p) { setErr('Nhập số điện thoại (hoặc email) và mật khẩu.'); return }
    setBusy(true)
    const r = await onLogin(u.trim(), p).catch(() => ({ error: 'offline' }))
    setBusy(false)
    if (!r || !r.ok) setErr(MSG[(r && r.error) || 'bad_login'] || MSG.bad_login)
  }
  // ---- Quên mật khẩu bằng mã email ----
  async function sendCode() {
    if (busy) return
    setErr(''); setFbPhone('')
    const id = u.trim()
    if (!id) { setErr(FMSG.bad_id); return }
    setBusy(true)
    const r = await onForgotSend(id).catch(() => ({ error: 'offline' }))
    setBusy(false)
    if (r && r.ok) {
      setSentTo(r.to || ''); setSentAt(Date.now()); setNow(Date.now()); setCode(''); setNp(''); setNp2(''); setFStep('code')
      return
    }
    const e = (r && r.error) || 'error'
    setErr(FMSG[e] || FMSG.error)
    if (localResetPhone) setFbPhone(localResetPhone(id) || '')
  }
  async function submitCode() {
    if (busy) return
    setErr('')
    if (!/^\d{6}$/.test(code)) { setErr(FMSG.bad_code); return }
    if (!/^\d{8}$/.test(np)) { setErr(FMSG.bad_pass); return }
    if (np !== np2) { setErr('Hai ô mật khẩu mới chưa khớp.'); return }
    setBusy(true)
    const r = await onForgotReset(u.trim(), code, np).catch(() => ({ error: 'offline' }))
    setBusy(false)
    if (r && r.ok) return
    const e = (r && r.error) || 'error'
    if (e === 'code_wrong') { setErr(`Mã chưa đúng. Còn ${r.left} lần thử.`); return }
    if (e === 'code_expired' || e === 'code_locked') setCode('')
    setErr(FMSG[e] || FMSG.error)
  }
  // Cách cũ (máy đã từng đăng nhập tài khoản này)
  async function submitReset() {
    if (busy) return
    setErr('')
    const ph = fbPhone || onlyDigits(u)
    if (!/^\d{8,12}$/.test(ph)) { setErr('Nhập số điện thoại đã đăng ký.'); return }
    if (!/^\d{8}$/.test(np)) { setErr('Mật khẩu mới phải gồm ĐÚNG 8 chữ số.'); return }
    if (np !== np2) { setErr('Hai ô mật khẩu chưa khớp.'); return }
    setBusy(true)
    const r = await onReset(ph, np).catch(() => 'offline')
    setBusy(false)
    if (r !== true) setErr(MSG['reset_' + r] || MSG.error)
  }

  const Brandline = ({ big = false }) => <div className="auth-brand"><img className={'auth-logo' + (big ? ' big' : '')} src={logoFull} alt="Ôn Tập" /></div>

  // ================= MÀN ĐẦU =================
  if (mode === 'landing') {
    return (
      <div className="auth">
        <div className="auth-card auth-landing">
          <Brandline big />
          <h1>Ôn tập thông minh cho con</h1>
          <p className="auth-sub">Chọn một trong hai để bắt đầu.</p>
          <button className="cta" onClick={() => { setMode('login'); setErr('') }}>Đăng nhập</button>
          <button className="cta ghost" onClick={() => { setMode('register'); setErr(''); setTouched(false) }}>Đăng ký</button>
          <p className="auth-note">Chưa có tài khoản thì bấm <b>Đăng ký</b>. Đây là tài khoản phụ huynh (mua gói) — các tài khoản con sẽ nằm trong đó.</p>
        </div>
      </div>
    )
  }

  // ================= ĐĂNG NHẬP =================
  if (mode === 'login') {
    return (
      <div className="auth">
        <div className="auth-card">
          <Brandline />
          <h1>Đăng nhập</h1>
          {notice && <div className="auth-notice">{notice}</div>}
          <p className="auth-sub">Dùng số điện thoại hoặc email và mật khẩu phụ huynh. Đăng ký ở máy nào cũng đăng nhập được ở máy khác.</p>
          <label className="auth-lbl">Số điện thoại hoặc email</label>
          <input className="auth-in" type="text" autoCapitalize="none" autoCorrect="off" spellCheck={false} placeholder="Số điện thoại hoặc email" value={u} onChange={(e) => setU(e.target.value)} />
          <label className="auth-lbl">Mật khẩu phụ huynh</label>
          <input className="auth-in" type="password" inputMode="numeric" placeholder="Mật khẩu 8 số" value={p}
            onChange={(e) => setP(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submitLogin()} />
          {err && <div className="err">{err}</div>}
          <button className="cta" disabled={busy} onClick={submitLogin}>{busy ? 'Đang đăng nhập…' : 'Đăng nhập'}</button>
          <button className="linkbtn" onClick={() => { setMode('forgot'); setFStep('send'); setFbPhone(''); setErr(''); setNp(''); setNp2(''); setCode('') }}>Quên mật khẩu?</button>
          <button className="ghost small" onClick={() => { setMode('landing'); setErr('') }}>← Quay lại</button>
        </div>
      </div>
    )
  }

  // ================= QUÊN MẬT KHẨU =================
  if (mode === 'forgot') {
    const back = <button className="ghost small" onClick={() => { setMode('login'); setErr('') }}>← Quay lại đăng nhập</button>
    // Cách cũ: đặt mật khẩu mới ngay trên máy đã từng đăng nhập tài khoản này (không cần mã email)
    if (fStep === 'old') {
      return (
        <div className="auth">
          <div className="auth-card">
            <Brandline />
            <h1>Đặt mật khẩu mới trên máy này</h1>
            <p className="auth-sub">Máy này đã từng đăng nhập tài khoản này nên đặt được mật khẩu mới ngay, không cần mã email. Xong thì mọi máy dùng mật khẩu mới.</p>
            <label className="auth-lbl">Mật khẩu mới (8 số)</label>
            <input className="auth-in" type="password" inputMode="numeric" maxLength={8} placeholder="8 chữ số" value={np} onChange={(e) => setNp(onlyDigits(e.target.value))} />
            <label className="auth-lbl">Nhập lại mật khẩu mới</label>
            <input className="auth-in" type="password" inputMode="numeric" maxLength={8} placeholder="Nhập lại 8 chữ số" value={np2}
              onChange={(e) => setNp2(onlyDigits(e.target.value))} onKeyDown={(e) => e.key === 'Enter' && submitReset()} />
            {err && <div className="err">{err}</div>}
            <button className="cta" disabled={busy} onClick={submitReset}>{busy ? 'Đang đặt lại…' : 'Đặt lại mật khẩu'}</button>
            <button className="ghost small" onClick={() => { setFStep('send'); setErr('') }}>← Quay lại</button>
          </div>
        </div>
      )
    }
    // Bước 2: nhập mã 6 số trong email + mật khẩu mới
    if (fStep === 'code') {
      const left = Math.max(0, RESEND_WAIT - Math.floor((now - sentAt) / 1000))
      return (
        <div className="auth">
          <div className="auth-card">
            <Brandline />
            <h1>Quên mật khẩu</h1>
            <div className="auth-notice auth-sent">Đã gửi mã 6 số tới <b>{sentTo}</b>. Mở hộp thư (xem cả mục Thư rác/Spam). Mã dùng được 15 phút.</div>
            <label className="auth-lbl">Mã 6 số</label>
            <input className="auth-in" inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="6 chữ số trong email" value={code} onChange={(e) => setCode(onlyDigits(e.target.value).slice(0, 6))} />
            <label className="auth-lbl">Mật khẩu mới (8 số)</label>
            <input className="auth-in" type="password" inputMode="numeric" maxLength={8} placeholder="8 chữ số" value={np} onChange={(e) => setNp(onlyDigits(e.target.value))} />
            <label className="auth-lbl">Nhập lại mật khẩu mới</label>
            <input className="auth-in" type="password" inputMode="numeric" maxLength={8} placeholder="Nhập lại 8 chữ số" value={np2}
              onChange={(e) => setNp2(onlyDigits(e.target.value))} onKeyDown={(e) => e.key === 'Enter' && submitCode()} />
            {err && <div className="err">{err}</div>}
            <button className="cta" disabled={busy} onClick={submitCode}>{busy ? 'Đang đặt lại…' : 'Đặt lại mật khẩu'}</button>
            <button className="ghost small f-resend" disabled={busy || left > 0} onClick={sendCode}>{left > 0 ? `Gửi lại mã (sau ${left} giây)` : 'Gửi lại mã'}</button>
            {back}
          </div>
        </div>
      )
    }
    // Bước 1: nhập số điện thoại hoặc email -> gửi mã
    return (
      <div className="auth">
        <div className="auth-card">
          <Brandline />
          <h1>Quên mật khẩu</h1>
          <p className="auth-sub">Nhập số điện thoại hoặc email đã đăng ký. Ôn Tập gửi <b>mã 6 số</b> tới email của tài khoản để đặt mật khẩu mới — làm được trên mọi máy.</p>
          <label className="auth-lbl">Số điện thoại hoặc email</label>
          <input className="auth-in" type="text" autoCapitalize="none" autoCorrect="off" spellCheck={false} placeholder="Số điện thoại hoặc email đã đăng ký" value={u}
            onChange={(e) => setU(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && sendCode()} />
          {err && <div className="err">{err}</div>}
          <button className="cta" disabled={busy} onClick={sendCode}>{busy ? 'Đang gửi mã…' : 'Gửi mã'}</button>
          {err && fbPhone && (
            <button className="cta ghost f-old" onClick={() => { setFStep('old'); setErr(''); setNp(''); setNp2('') }}>Đặt mật khẩu mới ngay trên máy này</button>
          )}
          {back}
        </div>
      </div>
    )
  }

  // ================= THANH TOÁN (demo) =================
  if (mode === 'pay') {
    const seed = Number(onlyDigits(phone).slice(-6)) || 123456
    return (
      <div className="auth">
        <div className="auth-card">
          <Brandline />
          <h1>Thanh toán</h1>
          <p className="auth-sub">Gói <b>{plan} học sinh</b> · {kids.map((k) => k.name.trim()).filter(Boolean).join(', ')}</p>

          <div className="pay-cycle chips">
            <button className={'chip' + (cycle === 'month' ? ' on' : '')} onClick={() => setCycle('month')}>Hàng tháng</button>
            <button className={'chip' + (cycle === 'year' ? ' on' : '')} onClick={() => setCycle('year')}>Hàng năm</button>
          </div>

          <p className="auth-sub pay-price" data-testid="pay-price">{priceOf(plan, cycle) ? <>Số tiền: <b>{priceOf(plan, cycle)}</b> / {cycle === 'year' ? 'năm' : 'tháng'}</> : 'Giá: liên hệ'}</p>
          <div className="pay-box">
            <div className="pay-qr-wrap"><QR seed={seed} /></div>
            <div className="pay-bank">
              <b>Chuyển khoản</b>
              <span>Ngân hàng: <i>(Admin cấu hình)</i></span>
              <span>Số TK: <i>(Admin cấu hình)</i></span>
              <span>Nội dung: <b>ONTAP {onlyDigits(phone)}</b></span>
            </div>
          </div>

          <div className="auth-grouplbl">Hoặc thẻ tín dụng (tự động gia hạn)</div>
          <label className="auth-lbl">Số thẻ</label>
          <input className="auth-in" inputMode="numeric" autoComplete="off" placeholder="•••• •••• •••• ••••" />
          <div className="pay-row">
            <div><label className="auth-lbl">Hết hạn</label><input className="auth-in" autoComplete="off" placeholder="MM/YY" /></div>
            <div><label className="auth-lbl">CVC</label><input className="auth-in" inputMode="numeric" autoComplete="off" placeholder="•••" /></div>
          </div>
          <label className="auth-lbl">Tên trên thẻ</label>
          <input className="auth-in" autoComplete="off" placeholder="NGUYEN VAN A" />

          <p className="auth-note">⚠️ <b>Bản demo</b>: giá gói do Admin đặt theo thời điểm. Việc đọc tiền/xác nhận thẻ và gửi <b>mã kích hoạt qua email</b> sẽ chạy khi ghép <b>cổng thanh toán + máy chủ</b>. Tuyệt đối không lưu số thẻ thô — dùng cổng thanh toán đạt chuẩn (vd Stripe).</p>

          {err && <div className="err">{err}</div>}
          <button className="cta" disabled={busy} onClick={finishRegister}>{busy ? 'Đang tạo tài khoản…' : 'Hoàn tất & vào học →'}</button>
          <button className="ghost small" onClick={() => { setMode('register'); setErr('') }}>← Sửa thông tin đăng ký</button>
        </div>
      </div>
    )
  }

  // ================= ĐĂNG KÝ =================
  return (
    <div className="auth">
      <div className="auth-card">
        <Brandline />
        <h1>Đăng ký</h1>
        <p className="auth-sub">Điền đủ thông tin. Thiếu mục nào, mục đó tô màu và nút “Tiếp theo” sẽ mờ.</p>

        <div className="auth-grouplbl">Thông tin phụ huynh</div>
        <label className="auth-lbl">Họ và tên</label>
        <input className={ec(vName)} placeholder="VD: Nguyễn Văn A" value={parentName} onChange={bind(setParentName)} />
        <label className="auth-lbl">Số điện thoại (dùng để đăng nhập)</label>
        <input className={ec(vPhone)} inputMode="numeric" placeholder="VD: 0912345678" value={phone} onChange={bind(setPhone)} />
        <label className="auth-lbl">Mật khẩu (8 chữ số)</label>
        <input className={ec(vPass)} type="password" inputMode="numeric" maxLength={8} placeholder="8 chữ số" value={pass} onChange={bind(setPass, true)} />
        <label className="auth-lbl">Nhập lại mật khẩu</label>
        <input className={ec(vPass2)} type="password" inputMode="numeric" maxLength={8} placeholder="Nhập lại 8 chữ số" value={pass2} onChange={bind(setPass2, true)} />
        <label className="auth-lbl">Email</label>
        <input className={ec(vEmail)} type="email" placeholder="email@vidu.com" value={email} onChange={bind(setEmail)} />
        <label className="auth-lbl">Tỉnh / Thành phố</label>
        <input className={ec(vProv)} placeholder="VD: TP. Hồ Chí Minh" value={province} onChange={bind(setProvince)} />

        <div className="auth-grouplbl">Chọn gói ôn tập</div>
        <div className="chips reg-plan">
          {PLANS.map((n) => (
            <button type="button" key={n} className={'chip' + (plan === n ? ' on' : '')} onClick={() => setPlanN(n)}>{n} học sinh</button>
          ))}
        </div>
        <p className="auth-hint reg-price" data-testid="reg-price">💰 Gói {plan} học sinh: <b>{priceLine(plan)}</b></p>
        <p className="auth-hint">Gói {plan} học sinh → điền {plan} khối thông tin con dưới đây. Mỗi con có bản đồ kiến thức riêng.</p>

        {kids.map((k, i) => (
          <div className="reg-kid" key={i}>
            <div className="reg-kid-h">👦 Học sinh {i + 1}</div>
            <label className="auth-lbl">Tên hoặc nickname</label>
            <input className={ec(!!k.name.trim())} placeholder="VD: Anna" value={k.name} onChange={(e) => setKid(i, 'name', e.target.value)} />
            <label className="auth-lbl">Mã PIN (1–2 số, con gõ để vào học)</label>
            <input className={ec(/^\d{1,2}$/.test(k.pin))} inputMode="numeric" maxLength={2} placeholder="VD: 7 hoặc 12" value={k.pin} onChange={(e) => setKid(i, 'pin', onlyDigits(e.target.value))} />
            <label className="auth-lbl">Chọn icon ưa thích</label>
            <div className={'icon-pick' + (touched && !k.icon ? ' icon-pick--err' : '')}>
              {CHILD_ICONS.map((ic) => (
                <button type="button" key={ic} className={'icon-opt' + (k.icon === ic ? ' on' : '')} onClick={() => setKid(i, 'icon', ic)}>{ic}</button>
              ))}
            </div>
            <label className="auth-lbl">Lớp</label>
            <SelectPicker btnClass={ec(!!k.grade)} value={k.grade} onChange={(v) => setKid(i, 'grade', v)} placeholder="— Chọn lớp —" ariaLabel="Lớp"
              options={GRADES.map((g) => ({ value: 'Lớp ' + g, label: 'Lớp ' + g }))} />
            <label className="auth-lbl">Trường</label>
            <input className={ec(!!k.school.trim())} placeholder="VD: Tiểu học Kim Đồng" value={k.school} onChange={(e) => setKid(i, 'school', e.target.value)} />
            <label className="auth-lbl">Thuộc khối</label>
            <div className={'chips reg-types' + (touched && !k.schoolType ? ' reg-types--err' : '')}>
              {SCHOOL_TYPES.map((t) => (
                <button type="button" key={t} className={'chip' + (k.schoolType === t ? ' on' : '')} onClick={() => setKid(i, 'schoolType', t)}>{k.schoolType === t ? '✓ ' : ''}{t}</button>
              ))}
            </div>
          </div>
        ))}

        {err && <div className="err">{err}</div>}
        <button className="cta" disabled={!regValid || busy} onClick={goPay}>{busy ? 'Đang kiểm tra…' : 'Tiếp theo →'}</button>
        {!regValid && touched && <p className="auth-hint auth-hint--warn">Còn mục được tô màu chưa điền.</p>}
        <button className="ghost small" onClick={() => { setMode('landing'); setErr('') }}>← Quay lại</button>
        <p className="auth-note">📱 Đăng ký xong, đăng nhập được trên mọi máy (điện thoại, máy tính bảng, máy tính) bằng số điện thoại hoặc email và mật khẩu này. Sắp có trên App Store &amp; Google Play.</p>
      </div>
    </div>
  )
}
