import { useState } from 'react'
import { Brand } from '../components.jsx'
import { newChildId } from '../lib/auth.js'

const SCHOOL_TYPES = ['Công lập', 'Tư thục', 'Song ngữ', 'Quốc tế (đơn ngữ)']
const GRADES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
const AVATAR = ['🦊', '🐼', '🐧', '🐨', '🦁', '🐯', '🐸', '🦉']

// Màn CHỌN CON: sau khi phụ huynh đăng nhập, các tài khoản con hiện ra để chọn học.
// Bấm 1 con -> gõ PIN (nếu có) -> vào học. Còn slot theo gói -> thêm con mới.
export default function ChildPicker({ account, onEnter, onAddChild, onParent, onLogout }) {
  const children = account?.children || []
  const plan = account?.plan || 1
  const canAdd = children.length < plan

  const [pinFor, setPinFor] = useState(null) // con đang mở khoá
  const [pin, setPin] = useState('')
  const [err, setErr] = useState('')

  const [adding, setAdding] = useState(false)
  const [pass, setPass] = useState('')      // mật khẩu phụ huynh để thêm con
  const [name, setName] = useState('')
  const [grade, setGrade] = useState('')
  const [school, setSchool] = useState('')
  const [schoolType, setSchoolType] = useState('')
  const [npin, setNpin] = useState('')
  const onlyDigits = (s) => (s || '').replace(/\D+/g, '')

  function tapChild(c) {
    setErr('')
    if (!c.pin) { onEnter(c); return } // chưa đặt PIN -> vào thẳng
    setPinFor(c); setPin('')
  }
  function submitPin() {
    if (!pinFor) return
    if (pin === pinFor.pin) { setPinFor(null); setPin(''); onEnter(pinFor) }
    else setErr('Mã PIN chưa đúng.')
  }

  function submitAdd() {
    setErr('')
    if (pass !== (account.parentPass || account.password)) { setErr('Sai mật khẩu phụ huynh.'); return }
    if (!name.trim()) { setErr('Nhập tên tài khoản con.'); return }
    if (!grade) { setErr('Chọn lớp.'); return }
    if (!school.trim()) { setErr('Nhập tên trường.'); return }
    if (!schoolType) { setErr('Chọn hệ trường.'); return }
    if (!/^\d{4}$/.test(npin)) { setErr('Đặt PIN 4 số cho con.'); return }
    onAddChild({ id: newChildId(), name: name.trim(), grade, school: school.trim(), schoolType, pin: npin })
    setAdding(false); setPass(''); setName(''); setGrade(''); setSchool(''); setSchoolType(''); setNpin('')
  }

  // ---- Nhập PIN để vào 1 con ----
  if (pinFor) {
    return (
      <div className="screen pick">
        <header className="topbar"><Brand /></header>
        <div className="pick-pinbox">
          <div className="pick-ava big">{AVATAR[Math.abs(hash(pinFor.id)) % AVATAR.length]}</div>
          <h2>Chào {pinFor.name} 👋</h2>
          <p className="cr-hint">Gõ mã PIN của con để vào học.</p>
          <input className="auth-in pin-in" inputMode="numeric" maxLength={4} autoFocus placeholder="• • • •"
            value={pin} onChange={(e) => { setPin(onlyDigits(e.target.value)); setErr('') }}
            onKeyDown={(e) => e.key === 'Enter' && submitPin()} />
          {err && <div className="err">{err}</div>}
          <button className="cta" onClick={submitPin}>Vào học →</button>
          <button className="ghost small" onClick={() => { setPinFor(null); setErr('') }}>← Chọn bạn khác</button>
        </div>
      </div>
    )
  }

  // ---- Thêm tài khoản con ----
  if (adding) {
    return (
      <div className="screen pick">
        <header className="topbar"><Brand /></header>
        <h2 className="pick-h">Thêm tài khoản con</h2>
        <p className="cr-hint">Còn {plan - children.length} chỗ trong gói {plan} con. Cần mật khẩu phụ huynh để thêm.</p>

        <label className="auth-lbl">Mật khẩu phụ huynh</label>
        <input className="auth-in" type="password" inputMode="numeric" maxLength={12} placeholder="Xác nhận là phụ huynh"
          value={pass} onChange={(e) => setPass(onlyDigits(e.target.value))} />
        <label className="auth-lbl">Tên tài khoản con</label>
        <input className="auth-in" placeholder="VD: Bin" value={name} onChange={(e) => setName(e.target.value)} />
        <label className="auth-lbl">Lớp</label>
        <select className="auth-in" value={grade} onChange={(e) => setGrade(e.target.value)}>
          <option value="">— Chọn lớp —</option>
          {GRADES.map((g) => <option key={g} value={'Lớp ' + g}>Lớp {g}</option>)}
        </select>
        <label className="auth-lbl">Trường</label>
        <input className="auth-in" placeholder="VD: Tiểu học Kim Đồng" value={school} onChange={(e) => setSchool(e.target.value)} />
        <label className="auth-lbl">Hệ trường</label>
        <select className="auth-in" value={schoolType} onChange={(e) => setSchoolType(e.target.value)}>
          <option value="">— Chọn hệ —</option>
          {SCHOOL_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <label className="auth-lbl">Mã PIN của con (4 số)</label>
        <input className="auth-in" inputMode="numeric" maxLength={4} placeholder="VD: 1234"
          value={npin} onChange={(e) => setNpin(onlyDigits(e.target.value))} />

        {err && <div className="err">{err}</div>}
        <button className="cta" onClick={submitAdd}>Thêm con</button>
        <button className="ghost small" onClick={() => { setAdding(false); setErr('') }}>← Quay lại</button>
      </div>
    )
  }

  // ---- Danh sách con ----
  return (
    <div className="screen pick">
      <header className="topbar">
        <Brand />
        <button className="ds-logout" onClick={onLogout} title="Đăng xuất">Đăng xuất</button>
      </header>

      <section className="hello">
        <h1>Ai học hôm nay?</h1>
        <p>{account?.parentName ? `Tài khoản của ${account.parentName}` : 'Chọn tài khoản con để bắt đầu'}</p>
      </section>

      <div className="pick-grid">
        {children.map((c) => (
          <button key={c.id} className="pick-card" onClick={() => tapChild(c)}>
            <span className="pick-ava">{AVATAR[Math.abs(hash(c.id)) % AVATAR.length]}</span>
            <b className="pick-name">{c.name}</b>
            <em className="pick-sub">{c.grade || 'Chưa đặt lớp'}</em>
            {c.pin ? <span className="pick-lock">🔒 PIN</span> : <span className="pick-lock open">Vào thẳng</span>}
          </button>
        ))}

        {canAdd && (
          <button className="pick-card add" onClick={() => { setAdding(true); setErr('') }}>
            <span className="pick-ava">➕</span>
            <b className="pick-name">Thêm con</b>
            <em className="pick-sub">Còn {plan - children.length} chỗ</em>
          </button>
        )}
      </div>

      <button className="cta ghost pick-parent" onClick={() => onParent && onParent()}>⚙️ Khu vực phụ huynh</button>
      <p className="cr-hint" style={{ textAlign: 'center' }}>
        Gói hiện tại: {plan} con{!canAdd && children.length >= plan ? ' · đã dùng hết chỗ' : ''}.
      </p>
    </div>
  )
}

// Băm nhẹ id -> chọn avatar ổn định cho mỗi con.
function hash(s) {
  let h = 0
  for (let i = 0; i < (s || '').length; i++) { h = (h * 31 + s.charCodeAt(i)) | 0 }
  return h
}
