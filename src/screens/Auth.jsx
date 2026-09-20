import { useState } from 'react'

// 4 hệ trường (đủ dùng): công lập, tư thục, song ngữ, quốc tế đơn ngữ.
const SCHOOL_TYPES = ['Công lập', 'Tư thục', 'Song ngữ', 'Quốc tế (đơn ngữ)']
const GRADES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]

export default function Auth({ account, onRegister, onLogin, onReset }) {
  const isReg = !account
  const [screen, setScreen] = useState('main') // main | forgot
  // Phụ huynh
  const [parentName, setParentName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [pass, setPass] = useState('')   // mật khẩu phụ huynh (8 số)
  const [pass2, setPass2] = useState('')
  const [plan, setPlan] = useState(1)    // gói: 1 hoặc 3 con
  // Con đầu tiên
  const [stName, setStName] = useState('')
  const [grade, setGrade] = useState('')
  const [school, setSchool] = useState('')
  const [schoolType, setSchoolType] = useState('')
  const [childPin, setChildPin] = useState('')
  // Đăng nhập
  const [u, setU] = useState('')
  const [p, setP] = useState('')
  const [np, setNp] = useState('')
  const [np2, setNp2] = useState('')
  const [err, setErr] = useState('')

  const onlyDigits = (s) => (s || '').replace(/\D+/g, '')

  function submit() {
    setErr('')
    if (isReg) {
      const ph = onlyDigits(phone)
      if (!parentName.trim()) { setErr('Nhập tên phụ huynh.'); return }
      if (!/^\d{8,12}$/.test(ph)) { setErr('Số điện thoại chưa hợp lệ (chỉ chữ số, 8–12 số).'); return }
      if (!/^\S+@\S+\.\S+$/.test(email.trim())) { setErr('Nhập email hợp lệ (dùng để nhận mã & đặt lại mật khẩu).'); return }
      if (!/^\d{8}$/.test(pass)) { setErr('Mật khẩu phụ huynh phải gồm ĐÚNG 8 chữ số (để bảo mật).'); return }
      if (pass !== pass2) { setErr('Hai ô mật khẩu phụ huynh chưa khớp.'); return }
      if (!stName.trim()) { setErr('Nhập tên tài khoản của con.'); return }
      if (!grade) { setErr('Chọn lớp của con.'); return }
      if (!school.trim()) { setErr('Nhập tên trường.'); return }
      if (!schoolType) { setErr('Chọn hệ trường.'); return }
      if (!/^\d{4}$/.test(childPin)) { setErr('Đặt mã PIN cho con gồm 4 chữ số (con dùng để vào học).'); return }
      onRegister({
        parentName: parentName.trim(), phone: ph, email: email.trim(),
        parentPass: pass, plan,
        child: { name: stName.trim(), grade, school: school.trim(), schoolType, pin: childPin },
      })
    } else if (!onLogin(u.trim(), p)) {
      setErr('Sai số điện thoại hoặc mật khẩu.')
    }
  }

  function submitReset() {
    setErr('')
    const ph = onlyDigits(u)
    if (!/^\d{8,12}$/.test(ph)) { setErr('Nhập số điện thoại đã đăng ký.'); return }
    if (!/^\d{8}$/.test(np)) { setErr('Mật khẩu mới phải gồm ĐÚNG 8 chữ số.'); return }
    if (np !== np2) { setErr('Hai ô mật khẩu chưa khớp.'); return }
    if (!onReset(ph, np)) { setErr('Số điện thoại này chưa được đăng ký trên máy.') }
  }

  if (screen === 'forgot') {
    return (
      <div className="auth">
        <div className="auth-card">
          <div className="auth-brand"><span className="mark">OT</span><span className="nm">ON&nbsp;TAP</span></div>
          <h1>Quên mật khẩu</h1>
          <p className="auth-sub">Nhập số điện thoại đã đăng ký và đặt mật khẩu phụ huynh mới (8 chữ số).</p>

          <label className="auth-lbl">Số điện thoại</label>
          <input className="auth-in" inputMode="numeric" placeholder="Số điện thoại đã đăng ký"
            value={u} onChange={(e) => setU(e.target.value)} />
          <label className="auth-lbl">Mật khẩu mới (8 số)</label>
          <input className="auth-in" type="password" inputMode="numeric" maxLength={8} placeholder="8 chữ số"
            value={np} onChange={(e) => setNp(onlyDigits(e.target.value))} />
          <label className="auth-lbl">Nhập lại mật khẩu mới</label>
          <input className="auth-in" type="password" inputMode="numeric" maxLength={8} placeholder="Nhập lại 8 chữ số"
            value={np2} onChange={(e) => setNp2(onlyDigits(e.target.value))} onKeyDown={(e) => e.key === 'Enter' && submitReset()} />

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
            <p className="auth-sub">Phụ huynh đăng ký một lần. Sau đó tạo tài khoản cho từng con để con tự vào học bằng mã PIN riêng.</p>

            <div className="auth-grouplbl">1 · Phụ huynh</div>
            <label className="auth-lbl">Tên phụ huynh</label>
            <input className="auth-in" placeholder="VD: Nguyễn Văn A"
              value={parentName} onChange={(e) => setParentName(e.target.value)} />
            <label className="auth-lbl">Số điện thoại</label>
            <input className="auth-in" inputMode="numeric" placeholder="VD: 0912345678"
              value={phone} onChange={(e) => setPhone(e.target.value)} />
            <label className="auth-lbl">Email</label>
            <input className="auth-in" type="email" placeholder="email@vidu.com"
              value={email} onChange={(e) => setEmail(e.target.value)} />
            <label className="auth-lbl">Mật khẩu phụ huynh (8 chữ số)</label>
            <input className="auth-in" type="password" inputMode="numeric" maxLength={8} placeholder="8 chữ số — để bảo mật"
              value={pass} onChange={(e) => setPass(onlyDigits(e.target.value))} />
            <label className="auth-lbl">Nhập lại mật khẩu phụ huynh</label>
            <input className="auth-in" type="password" inputMode="numeric" maxLength={8} placeholder="Nhập lại 8 chữ số"
              value={pass2} onChange={(e) => setPass2(onlyDigits(e.target.value))} />

            <div className="auth-grouplbl">2 · Gói học</div>
            <label className="auth-lbl">Số tài khoản con</label>
            <div className="chips auth-plan">
              <button type="button" className={'chip' + (plan === 1 ? ' on' : '')} onClick={() => setPlan(1)}>Gói 1 con</button>
              <button type="button" className={'chip' + (plan === 3 ? ' on' : '')} onClick={() => setPlan(3)}>Gói 3 con</button>
            </div>
            <p className="auth-hint">Gói 1: tạo 1 tài khoản con. Gói 3: tạo tối đa 3 tài khoản con (mỗi con một bản đồ kiến thức riêng). Giờ tạo con đầu tiên, các con khác thêm sau khi vào.</p>

            <div className="auth-grouplbl">3 · Con đầu tiên</div>
            <label className="auth-lbl">Tên tài khoản con</label>
            <input className="auth-in" placeholder="VD: Anna (bố mẹ tự đặt)"
              value={stName} onChange={(e) => setStName(e.target.value)} />
            <label className="auth-lbl">Lớp</label>
            <select className="auth-in" value={grade} onChange={(e) => setGrade(e.target.value)}>
              <option value="">— Chọn lớp —</option>
              {GRADES.map((g) => <option key={g} value={'Lớp ' + g}>Lớp {g}</option>)}
            </select>
            <label className="auth-lbl">Trường</label>
            <input className="auth-in" placeholder="VD: Tiểu học Kim Đồng"
              value={school} onChange={(e) => setSchool(e.target.value)} />
            <label className="auth-lbl">Hệ trường</label>
            <select className="auth-in" value={schoolType} onChange={(e) => setSchoolType(e.target.value)}>
              <option value="">— Chọn hệ —</option>
              {SCHOOL_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <label className="auth-lbl">Mã PIN của con (4 số)</label>
            <input className="auth-in" inputMode="numeric" maxLength={4} placeholder="VD: 1234 — con gõ để vào học"
              value={childPin} onChange={(e) => setChildPin(onlyDigits(e.target.value))} />
          </>
        ) : (
          <>
            <p className="auth-sub">Đăng nhập bằng số điện thoại và mật khẩu phụ huynh (8 chữ số).</p>
            <label className="auth-lbl">Số điện thoại</label>
            <input className="auth-in" inputMode="numeric" placeholder="Số điện thoại"
              value={u} onChange={(e) => setU(e.target.value)} />
            <label className="auth-lbl">Mật khẩu phụ huynh</label>
            <input className="auth-in" type="password" inputMode="numeric" placeholder="Mật khẩu 8 số"
              value={p} onChange={(e) => setP(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submit()} />
          </>
        )}

        {err && <div className="err">{err}</div>}
        <button className="cta" onClick={submit}>{isReg ? 'Tạo tài khoản & vào học' : 'Đăng nhập'}</button>
        {!isReg && <button className="linkbtn" onClick={() => { setScreen('forgot'); setErr(''); setNp(''); setNp2('') }}>Quên mật khẩu?</button>}
        {isReg && (
          <p className="auth-note">📱 Sắp có trên <b>App Store</b> &amp; <b>Google Play</b>. Hiện anh/chị dùng ngay trên web — có thể “Thêm vào màn hình chính” để dùng như một app. Đăng nhập trên nhiều máy sẽ có ở bản kế tiếp.</p>
        )}
      </div>
    </div>
  )
}
