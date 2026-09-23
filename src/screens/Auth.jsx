import { useState } from 'react'
import { CHILD_ICONS } from '../lib/icons.js'

// 4 khối trường (bấm tick để chọn).
const SCHOOL_TYPES = ['Công lập', 'Tư thục', 'Song ngữ', 'Quốc tế (đơn ngữ)']
const GRADES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
const PLANS = [1, 2, 3, 4, 5]

const blankKid = () => ({ name: '', pin: '', icon: '', grade: '', school: '', schoolType: '' })

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

export default function Auth({ account, onRegister, onLogin, onReset }) {
  const [mode, setMode] = useState('landing') // landing | login | register | pay | forgot
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
  // Thanh toán (demo)
  const [cycle, setCycle] = useState('year')
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

  function goPay() {
    setTouched(true)
    if (!regValid) { setErr('Còn mục chưa điền (được tô màu) — bổ sung để tiếp tục.'); return }
    setErr(''); setMode('pay')
  }
  function finishRegister() {
    onRegister({
      parentName: parentName.trim(), phone: onlyDigits(phone), email: email.trim(),
      parentPass: pass, province: province.trim(), plan,
      children: kids.map((k) => ({ name: k.name.trim(), pin: k.pin, icon: k.icon, grade: k.grade, school: k.school.trim(), schoolType: k.schoolType })),
    })
  }
  function submitLogin() { setErr(''); if (!onLogin(u.trim(), p)) setErr('Sai số điện thoại hoặc mật khẩu.') }
  function submitReset() {
    setErr('')
    const ph = onlyDigits(u)
    if (!/^\d{8,12}$/.test(ph)) { setErr('Nhập số điện thoại đã đăng ký.'); return }
    if (!/^\d{8}$/.test(np)) { setErr('Mật khẩu mới phải gồm ĐÚNG 8 chữ số.'); return }
    if (np !== np2) { setErr('Hai ô mật khẩu chưa khớp.'); return }
    if (!onReset(ph, np)) { setErr('Số điện thoại này chưa được đăng ký trên máy.') }
  }

  const Brandline = () => <div className="auth-brand"><span className="mark">OT</span><span className="nm">ON&nbsp;TAP</span></div>

  // ================= MÀN ĐẦU =================
  if (mode === 'landing') {
    return (
      <div className="auth">
        <div className="auth-card auth-landing">
          <Brandline />
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
          <p className="auth-sub">Đăng nhập bằng số điện thoại và mật khẩu phụ huynh (8 chữ số).</p>
          <label className="auth-lbl">Số điện thoại</label>
          <input className="auth-in" inputMode="numeric" placeholder="Số điện thoại" value={u} onChange={(e) => setU(e.target.value)} />
          <label className="auth-lbl">Mật khẩu phụ huynh</label>
          <input className="auth-in" type="password" inputMode="numeric" placeholder="Mật khẩu 8 số" value={p}
            onChange={(e) => setP(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submitLogin()} />
          {err && <div className="err">{err}</div>}
          <button className="cta" onClick={submitLogin}>Đăng nhập</button>
          <button className="linkbtn" onClick={() => { setMode('forgot'); setErr(''); setNp(''); setNp2('') }}>Quên mật khẩu?</button>
          <button className="ghost small" onClick={() => { setMode('landing'); setErr('') }}>← Quay lại</button>
        </div>
      </div>
    )
  }

  // ================= QUÊN MẬT KHẨU =================
  if (mode === 'forgot') {
    return (
      <div className="auth">
        <div className="auth-card">
          <Brandline />
          <h1>Quên mật khẩu</h1>
          <p className="auth-sub">Nhập số điện thoại đã đăng ký và đặt mật khẩu mới (8 chữ số).</p>
          <label className="auth-lbl">Số điện thoại</label>
          <input className="auth-in" inputMode="numeric" placeholder="Số điện thoại đã đăng ký" value={u} onChange={(e) => setU(e.target.value)} />
          <label className="auth-lbl">Mật khẩu mới (8 số)</label>
          <input className="auth-in" type="password" inputMode="numeric" maxLength={8} placeholder="8 chữ số" value={np} onChange={(e) => setNp(onlyDigits(e.target.value))} />
          <label className="auth-lbl">Nhập lại mật khẩu mới</label>
          <input className="auth-in" type="password" inputMode="numeric" maxLength={8} placeholder="Nhập lại 8 chữ số" value={np2}
            onChange={(e) => setNp2(onlyDigits(e.target.value))} onKeyDown={(e) => e.key === 'Enter' && submitReset()} />
          {err && <div className="err">{err}</div>}
          <button className="cta" onClick={submitReset}>Đặt lại mật khẩu</button>
          <button className="ghost small" onClick={() => { setMode('login'); setErr('') }}>← Quay lại đăng nhập</button>
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
          <button className="cta" onClick={finishRegister}>Hoàn tất & vào học →</button>
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
            <select className={ec(!!k.grade)} value={k.grade} onChange={(e) => setKid(i, 'grade', e.target.value)}>
              <option value="">— Chọn lớp —</option>
              {GRADES.map((g) => <option key={g} value={'Lớp ' + g}>Lớp {g}</option>)}
            </select>
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
        <button className="cta" disabled={!regValid} onClick={goPay}>Tiếp theo →</button>
        {!regValid && touched && <p className="auth-hint auth-hint--warn">Còn mục được tô màu chưa điền.</p>}
        <button className="ghost small" onClick={() => { setMode('landing'); setErr('') }}>← Quay lại</button>
        <p className="auth-note">📱 Sắp có trên App Store &amp; Google Play. Đăng nhập nhiều máy sẽ có ở bản kế tiếp (cần máy chủ).</p>
      </div>
    </div>
  )
}
