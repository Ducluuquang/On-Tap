import { useState } from 'react'

export default function Auth({ account, onRegister, onLogin, onReset }) {
  const isReg = !account
  const [screen, setScreen] = useState('main') // main | forgot
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [parentName, setParentName] = useState('')
  const [stName, setStName] = useState('')
  const [grade, setGrade] = useState('')
  const [school, setSchool] = useState('')
  const [schoolType, setSchoolType] = useState('')
  const [u, setU] = useState('')
  const [p, setP] = useState('')
  const [np, setNp] = useState('')
  const [np2, setNp2] = useState('')
  const [err, setErr] = useState('')

  function submit() {
    setErr('')
    if (isReg) {
      const ph = phone.replace(/\s+/g, '')
      // Tất cả thông tin đều BẮT BUỘC.
      if (!parentName.trim()) { setErr('Nhập tên phụ huynh.'); return }
      if (!/^\d{8,12}$/.test(ph)) { setErr('Số điện thoại chưa hợp lệ (chỉ chữ số, 8–12 số).'); return }
      if (!/^\S+@\S+\.\S+$/.test(email.trim())) { setErr('Nhập email hợp lệ (dùng để nhận mã đăng nhập & đặt lại mật khẩu).'); return }
      if (!stName.trim()) { setErr('Nhập tên học sinh.'); return }
      if (!grade) { setErr('Chọn lớp của học sinh.'); return }
      if (!school.trim()) { setErr('Nhập tên trường.'); return }
      if (!schoolType) { setErr('Chọn hệ trường (công lập / tư thục / quốc tế).'); return }
      onRegister({ phone: ph, email: email.trim(), parentName: parentName.trim(), studentName: stName.trim(), grade, school: school.trim(), schoolType })
    } else if (!onLogin(u.trim(), p)) {
      setErr('Sai tên đăng nhập hoặc mật khẩu.')
    }
  }

  function submitReset() {
    setErr('')
    const ph = u.replace(/\s+/g, '')
    if (!/^\d{8,12}$/.test(ph)) { setErr('Nhập số điện thoại đã đăng ký.'); return }
    if (np.length < 4) { setErr('Mật khẩu mới cần ít nhất 4 ký tự.'); return }
    if (np !== np2) { setErr('Hai ô mật khẩu chưa khớp.'); return }
    if (!onReset(ph, np)) { setErr('Số điện thoại này chưa được đăng ký trên máy.') }
  }

  if (screen === 'forgot') {
    return (
      <div className="auth">
        <div className="auth-card">
          <div className="auth-brand"><span className="mark">OT</span><span className="nm">ON&nbsp;TAP</span></div>
          <h1>Quên mật khẩu</h1>
          <p className="auth-sub">Nhập số điện thoại đã đăng ký và đặt mật khẩu mới.</p>

          <label className="auth-lbl">Số điện thoại</label>
          <input className="auth-in" inputMode="numeric" placeholder="Số điện thoại đã đăng ký"
            value={u} onChange={(e) => setU(e.target.value)} />
          <label className="auth-lbl">Mật khẩu mới</label>
          <input className="auth-in" type="password" placeholder="Mật khẩu mới"
            value={np} onChange={(e) => setNp(e.target.value)} />
          <label className="auth-lbl">Nhập lại mật khẩu mới</label>
          <input className="auth-in" type="password" placeholder="Nhập lại mật khẩu mới"
            value={np2} onChange={(e) => setNp2(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submitReset()} />

          {err && <div className="err">{err}</div>}
          <button className="cta" onClick={submitReset}>Đặt lại mật khẩu</button>
          <button className="ghost small" onClick={() => { setScreen('main'); setErr('') }}>← Quay lại đăng nhập</button>
          <p className="auth-note">Bản chính thức sẽ gửi link đặt lại qua email. Bản này đặt lại ngay trên máy của anh/chị.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="auth">
      <div className="auth-card">
        <div className="auth-brand"><span className="mark">OT</span><span className="nm">ON&nbsp;TAP</span></div>
        <h1>{isReg ? 'Tạo tài khoản' : 'Đăng nhập'}</h1>

        {isReg ? (
          <>
            <p className="auth-sub">Điền thông tin phụ huynh và học sinh. Tên đăng nhập &amp; mật khẩu mặc định là <b>số điện thoại</b> (đổi được sau).</p>

            <div className="auth-grouplbl">Phụ huynh</div>
            <label className="auth-lbl">Tên phụ huynh</label>
            <input className="auth-in" placeholder="VD: Nguyễn Văn A"
              value={parentName} onChange={(e) => setParentName(e.target.value)} />
            <label className="auth-lbl">Số điện thoại</label>
            <input className="auth-in" inputMode="numeric" placeholder="VD: 0912345678"
              value={phone} onChange={(e) => setPhone(e.target.value)} />
            <label className="auth-lbl">Email</label>
            <input className="auth-in" type="email" placeholder="email@vidu.com"
              value={email} onChange={(e) => setEmail(e.target.value)} />

            <div className="auth-grouplbl">Học sinh</div>
            <label className="auth-lbl">Tên học sinh</label>
            <input className="auth-in" placeholder="VD: Nguyễn Văn Minh"
              value={stName} onChange={(e) => setStName(e.target.value)} />
            <label className="auth-lbl">Lớp</label>
            <select className="auth-in" value={grade} onChange={(e) => setGrade(e.target.value)}>
              <option value="">— Chọn lớp —</option>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((g) => <option key={g} value={'Lớp ' + g}>Lớp {g}</option>)}
            </select>
            <label className="auth-lbl">Trường</label>
            <input className="auth-in" placeholder="VD: Tiểu học Kim Đồng"
              value={school} onChange={(e) => setSchool(e.target.value)} />
            <label className="auth-lbl">Hệ trường</label>
            <select className="auth-in" value={schoolType} onChange={(e) => setSchoolType(e.target.value)}>
              <option value="">— Chọn hệ —</option>
              <option value="Công lập">Công lập</option>
              <option value="Tư thục">Tư thục</option>
              <option value="Quốc tế">Quốc tế</option>
            </select>
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
        {!isReg && <button className="linkbtn" onClick={() => { setScreen('forgot'); setErr(''); setNp(''); setNp2('') }}>Quên mật khẩu?</button>}
        {isReg && (
          <p className="auth-note">📱 Sắp có trên <b>App Store</b> &amp; <b>Google Play</b>. Khi phát hành, bấm link đăng ký sẽ tự đưa sang tải app. Hiện anh/chị dùng ngay trên web — có thể “Thêm vào màn hình chính” để dùng như một app.</p>
        )}
      </div>
    </div>
  )
}
