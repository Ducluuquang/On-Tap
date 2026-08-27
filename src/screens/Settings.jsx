import { useState } from 'react'
import { BackHeader } from '../components.jsx'

export default function Settings({ account, settings, stats, onChangePassword, onSaveEmail, onSetGoal, onToggleChoice, onBack }) {
  const [cur, setCur] = useState('')
  const [np, setNp] = useState('')
  const [np2, setNp2] = useState('')
  const [pwMsg, setPwMsg] = useState(null) // {ok, text}
  const [email, setEmail] = useState(account?.email || '')
  const [emailMsg, setEmailMsg] = useState('')
  const [goal, setGoal] = useState(settings ? '' : '')
  const goalMin = stats?.goalMin ?? 15

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
            <b>Cho phép chơi kiểu trắc nghiệm</b>
            <em>Tắt đi thì con phải tự nghĩ và điền đáp án (hiểu bài chắc hơn).</em>
          </span>
          <span className={'switch' + (settings?.allowChoice ? ' on' : '')} onClick={() => onToggleChoice(!settings?.allowChoice)} role="switch" aria-checked={!!settings?.allowChoice}>
            <span className="knob" />
          </span>
        </label>
      </section>
    </div>
  )
}
