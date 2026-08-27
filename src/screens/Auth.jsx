import { useState } from 'react'

export default function Auth({ account, onRegister, onLogin }) {
  const isReg = !account
  const [phone, setPhone] = useState('')
  const [u, setU] = useState('')
  const [p, setP] = useState('')
  const [err, setErr] = useState('')

  function submit() {
    setErr('')
    if (isReg) {
      const ph = phone.replace(/\s+/g, '')
      if (!/^\d{8,12}$/.test(ph)) { setErr('Số điện thoại chưa hợp lệ (chỉ chữ số, 8–12 số).'); return }
      onRegister(ph)
    } else if (!onLogin(u.trim(), p)) {
      setErr('Sai tên đăng nhập hoặc mật khẩu.')
    }
  }

  return (
    <div className="auth">
      <div className="auth-card">
        <div className="auth-brand"><span className="mark">OT</span><span className="nm">ON&nbsp;TAP</span></div>
        <h1>{isReg ? 'Tạo tài khoản' : 'Đăng nhập'}</h1>

        {isReg ? (
          <>
            <p className="auth-sub">Dùng chung cho cả con và bố mẹ. Tên đăng nhập &amp; mật khẩu mặc định là <b>số điện thoại</b>.</p>
            <label className="auth-lbl">Số điện thoại</label>
            <input className="auth-in" inputMode="numeric" placeholder="VD: 0912345678"
              value={phone} onChange={(e) => setPhone(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submit()} />
          </>
        ) : (
          <>
            <p className="auth-sub">Nhập số điện thoại đã đăng ký (mật khẩu mặc định cũng là số điện thoại).</p>
            <label className="auth-lbl">Tên đăng nhập</label>
            <input className="auth-in" inputMode="numeric" placeholder="Số điện thoại"
              value={u} onChange={(e) => setU(e.target.value)} />
            <label className="auth-lbl">Mật khẩu</label>
            <input className="auth-in" type="password" placeholder="Mật khẩu"
              value={p} onChange={(e) => setP(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submit()} />
          </>
        )}

        {err && <div className="err">{err}</div>}
        <button className="cta" onClick={submit}>{isReg ? 'Tạo tài khoản & vào học' : 'Đăng nhập'}</button>
      </div>
    </div>
  )
}
