import { useState } from 'react'
import { BackHeader } from '../components.jsx'

export default function Settings({ account, settings, stats, onChangePassword, onSaveEmail, onSetPin, onSetGoal, onToggleChoice, onBack }) {
  const [cur, setCur] = useState('')
  const [np, setNp] = useState('')
  const [np2, setNp2] = useState('')
  const [pwMsg, setPwMsg] = useState(null) // {ok, text}
  const [email, setEmail] = useState(account?.email || '')
  const [emailMsg, setEmailMsg] = useState('')
  const goalMin = stats?.goalMin ?? 15

  // ----- Khoá đổi cài đặt trắc nghiệm bằng mã PIN phụ huynh (1 chữ số) -----
  const hasPin = !!account?.pin
  const [pinStep, setPinStep] = useState(null) // null | 'set' | 'enter' | 'reset'
  const [pinTarget, setPinTarget] = useState(false) // giá trị allowChoice muốn đặt
  const [pin, setPin] = useState('')       // ô nhập PIN (đặt / nhập)
  const [pin2, setPin2] = useState('')     // PIN mới (khi đặt lại)
  const [resetUser, setResetUser] = useState('')
  const [pinMsg, setPinMsg] = useState('')

  function savePw() {
    setPwMsg(null)
    if (np.length < 4) { setPwMsg({ ok: false, text: 'Mật khẩu mới cần ít nhất 4 ký tự.' }); return }
    if (np !== np2) { setPwMsg({ ok: false, text: 'Hai ô mật khẩu chưa khớp.' }); return }
    if (!onChangePassword(cur, np)) { setPwMsg({ ok: false, text: 'Mật khẩu hiện tại chưa đúng.' }); return }
    setCur(''); setNp(''); setNp2(''); setPwMsg({ ok: true, text: 'Đã đổi mật khẩu ✓' })
  }
  function saveEmail() {
    onSaveEmail(email.trim()); setEmailMsg('Đã lưu email ✓')
    setTimeout(() => setEmailMsg(''), 2000)
  }
  function changeGoal(v) { onSetGoal(v) }

  const digit = (v) => v.replace(/\D/g, '').slice(0, 1)
  function openPin(target) {
    setPinTarget(target); setPin(''); setPin2(''); setResetUser(''); setPinMsg('')
    setPinStep(hasPin ? 'enter' : 'set')
  }
  function closePin() { setPinStep(null); setPin(''); setPin2(''); setResetUser(''); setPinMsg('') }
  function confirmPin() {
    if (pinStep === 'set') {
      if (!/^\d$/.test(pin)) { setPinMsg('Mã PIN là 1 chữ số (0–9).'); return }
      onSetPin(pin); onToggleChoice(pinTarget); closePin()
    } else if (pinStep === 'enter') {
      if (pin === String(account.pin)) { onToggleChoice(pinTarget); closePin() }
      else setPinMsg('Mã PIN chưa đúng.')
    } else if (pinStep === 'reset') {
      if (resetUser.trim() !== account?.username) { setPinMsg('Tên đăng nhập chưa đúng.'); return }
      if (!/^\d$/.test(pin2)) { setPinMsg('Mã PIN mới là 1 chữ số (0–9).'); return }
      onSetPin(pin2); onToggleChoice(pinTarget); closePin()
    }
  }
  const onEnter = (e) => { if (e.key === 'Enter') { e.preventDefault(); confirmPin() } }

  return (
    <div className="screen">
      <BackHeader title="Cài đặt" onBack={onBack} />

      <section className="set-sec">
        <h3>Tài khoản</h3>
        <div className="set-row"><span>Tên đăng nhập</span><b>{account?.username || '—'}</b></div>
      </section>

      <section className="set-sec">
        <h3>Đổi mật khẩu</h3>
        <input className="auth-in" type="password" placeholder="Mật khẩu hiện tại" value={cur} onChange={(e) => setCur(e.target.value)} />
        <input className="auth-in" type="password" placeholder="Mật khẩu mới" value={np} onChange={(e) => setNp(e.target.value)} />
        <input className="auth-in" type="password" placeholder="Nhập lại mật khẩu mới" value={np2} onChange={(e) => setNp2(e.target.value)} />
        {pwMsg && <div className={pwMsg.ok ? 'ok-msg' : 'err'}>{pwMsg.text}</div>}
        <button className="cta small" onClick={savePw}>Đổi mật khẩu</button>
      </section>

      <section className="set-sec">
        <h3>Email đặt lại mật khẩu</h3>
        <input className="auth-in" type="email" placeholder="email@vidu.com" value={email} onChange={(e) => setEmail(e.target.value)} />
        {emailMsg && <div className="ok-msg">{emailMsg}</div>}
        <button className="cta small" onClick={saveEmail}>Lưu email</button>
        <p className="cr-hint">Bản chính thức dùng email này để gửi link đặt lại mật khẩu khi quên.</p>
      </section>

      <section className="set-sec">
        <h3>Mục tiêu học mỗi ngày</h3>
        <div className="goal-row">
          <button className="goal-btn" onClick={() => changeGoal(Math.max(1, goalMin - 5))}>−</button>
          <div className="goal-val"><b>{goalMin}</b><span>phút / ngày</span></div>
          <button className="goal-btn" onClick={() => changeGoal(goalMin + 5)}>+</button>
        </div>
      </section>

      <section className="set-sec">
        <h3>Kiểu làm bài của con</h3>
        <label className="switch-row">
          <span className="switch-txt">
            <b>Cho phép chơi kiểu trắc nghiệm 🔒</b>
            <em>Tắt đi thì con phải tự nghĩ và điền đáp án (hiểu bài chắc hơn). Đổi cài đặt này cần mã PIN phụ huynh.</em>
          </span>
          <span className={'switch' + (settings?.allowChoice ? ' on' : '')} onClick={() => openPin(!settings?.allowChoice)} role="switch" aria-checked={!!settings?.allowChoice}>
            <span className="knob" />
          </span>
        </label>
      </section>

      {pinStep && (
        <div className="modal-back" onClick={closePin}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            {pinStep === 'set' && (
              <>
                <h3>Đặt mã PIN phụ huynh</h3>
                <p className="cr-hint">Mã 1 chữ số để khoá thay đổi cài đặt này — con sẽ không tự bật/tắt được.</p>
                <input className="auth-in pin-in" type="password" inputMode="numeric" maxLength={1} autoFocus
                  value={pin} onChange={(e) => setPin(digit(e.target.value))} onKeyDown={onEnter} placeholder="•" />
              </>
            )}
            {pinStep === 'enter' && (
              <>
                <h3>Nhập mã PIN phụ huynh</h3>
                <p className="cr-hint">Để bật/tắt kiểu trắc nghiệm.</p>
                <input className="auth-in pin-in" type="password" inputMode="numeric" maxLength={1} autoFocus
                  value={pin} onChange={(e) => setPin(digit(e.target.value))} onKeyDown={onEnter} placeholder="•" />
                <button className="linkbtn" onClick={() => { setPinStep('reset'); setPinMsg('') }}>Quên mã PIN?</button>
              </>
            )}
            {pinStep === 'reset' && (
              <>
                <h3>Đặt lại mã PIN</h3>
                <p className="cr-hint">Nhập tên đăng nhập (số điện thoại) rồi đặt mã PIN mới.</p>
                <input className="auth-in" value={resetUser} onChange={(e) => setResetUser(e.target.value)} placeholder="Tên đăng nhập" />
                <input className="auth-in pin-in" type="password" inputMode="numeric" maxLength={1}
                  value={pin2} onChange={(e) => setPin2(digit(e.target.value))} onKeyDown={onEnter} placeholder="Mã PIN mới (1 chữ số)" />
              </>
            )}
            {pinMsg && <div className="err">{pinMsg}</div>}
            <div className="modal-btns">
              <button className="cta small ghost" onClick={closePin}>Huỷ</button>
              <button className="cta small" onClick={confirmPin}>Xác nhận</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
