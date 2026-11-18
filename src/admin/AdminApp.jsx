// TRANG QUẢN TRỊ HỆ THỐNG — địa chỉ riêng /quan-tri (anh duyệt 17/11/2026). Không có lối vào từ app của phụ huynh / học sinh.
// Đăng nhập bằng tài khoản Ôn Tập có số trong ADMIN_PHONES. Các mục: Tổng quan · Thư viện sách · Người dùng · Góp ý · Định giá.
// Góp ý: nhật ký trò chuyện lưu vĩnh viễn; khi đóng phiếu ghi "Bài học / cách xử lý"; nút tải toàn bộ nhật ký để AI học sau này.
import { lazy, Suspense, useEffect, useState } from 'react'
import { adminCall, adminLogin, adminSetup, getAdminToken, setAdminToken, getPricesPublic, vnd } from '../lib/adminApi.js'
import { booksCall } from '../lib/books.js'
import logoRow from '../assets/logo-row.png'

const Library = lazy(() => import('../screens/Library.jsx'))
// Hai cấp (18/11/2026): super admin (ADMIN_PHONES) thấy thêm "Quản trị viên" + "Cài đặt" và DUYỆT thay đổi; admin làm việc hằng ngày.
const TABS = [['home', '📊 Tổng quan'], ['books', '📚 Thư viện sách'], ['users', '👪 Người dùng'], ['fb', '💬 Góp ý'], ['price', '💰 Định giá'],
  ['chg', '✅ Duyệt & nhật ký'], ['staff', '👥 Quản trị viên', 'super'], ['cfg', '⚙️ Cài đặt', 'super']]
const ROLE = { super: 'Super admin', admin: 'Admin' }
const CHG_ST = { pending: '⏳ Chờ duyệt', applied: '✓ Áp dụng ngay (super admin)', approved: '✓ Đã duyệt', rejected: '✗ Không duyệt' }
const KIND = { bug: 'Báo lỗi', idea: 'Kiến nghị', other: 'Khác' }
const STATUS = { new: 'Mới', answered: 'Đã trả lời', done: 'Đã xong' }
const ERR = { bad_login: 'Sai số điện thoại / email hoặc mật khẩu. Chưa có tài khoản quản trị thì bấm "Lần đầu: tạo tài khoản quản trị" bên dưới.',
  setup_off: 'Chưa bật tạo tài khoản quản trị: vào Vercel → Settings → Environment Variables, thêm ADMIN_SETUP_CODE (mã anh tự đặt, ít nhất 8 ký tự), rồi Redeploy.',
  bad_code: 'Mã cài đặt chưa đúng (là giá trị ADMIN_SETUP_CODE anh đặt ở Vercel).',
  not_admin_phone: 'Số này chưa có trong ADMIN_PHONES ở Vercel (sửa biến xong phải Redeploy).',
  bad_pass: 'Mật khẩu cần ít nhất 8 ký tự.', not_admin: 'Tài khoản này không phải quản trị hệ thống.', network: 'Mất mạng, thử lại.', slow_down: 'Thử sai nhiều lần quá, đợi ít phút.', bad_token: 'Phiên đăng nhập hết hạn, đăng nhập lại.' }
const p2 = (n) => String(n).padStart(2, '0')
const fmt = (ms) => { if (!ms) return '—'; const d = new Date(ms); return `${p2(d.getDate())}/${p2(d.getMonth() + 1)}/${d.getFullYear()} ${p2(d.getHours())}:${p2(d.getMinutes())}` }

function Login({ onDone }) {
  const [mode, setMode] = useState('login')   // login | setup (lần đầu tạo tài khoản quản trị / quên mật khẩu)
  const [id, setId] = useState('')
  const [pass, setPass] = useState('')
  const [pass2, setPass2] = useState('')
  const [code, setCode] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  async function go(e) {
    e.preventDefault(); setErr('')
    if (mode === 'setup' && pass !== pass2) { setErr('Hai ô mật khẩu chưa khớp.'); return }
    setBusy(true)
    const r = mode === 'setup' ? await adminSetup(id.trim(), pass, code.trim()) : await adminLogin(id.trim(), pass)
    setBusy(false)
    if (r.ok) onDone(); else setErr(ERR[r.error] || 'Không đăng nhập được (' + r.error + ').')
  }
  const sw = (m) => { setMode(m); setErr(''); setPass(''); setPass2('') }
  return (
    <form className="adm-login" onSubmit={go}>
      <img src={logoRow} alt="Ôn Tập" className="adm-logo" />
      <h1>Quản trị hệ thống</h1>
      {mode === 'login' ? (
        <>
          <p className="adm-muted">Đăng nhập bằng tài khoản quản trị (số điện thoại có trong ADMIN_PHONES ở Vercel).</p>
          <input className="auth-in" placeholder="Số điện thoại hoặc email" value={id} onChange={(e) => setId(e.target.value)} autoComplete="username" />
          <input className="auth-in" type="password" placeholder="Mật khẩu" value={pass} onChange={(e) => setPass(e.target.value)} autoComplete="current-password" />
          {err && <div className="err">{err}</div>}
          <button className="cta" disabled={busy || !id || !pass}>{busy ? 'Đang đăng nhập…' : 'Đăng nhập'}</button>
          <button type="button" className="linkbtn adm-setup-link" onClick={() => sw('setup')}>Lần đầu: tạo tài khoản quản trị (hoặc quên mật khẩu)</button>
        </>
      ) : (
        <>
          <p className="adm-muted">Tạo tài khoản quản trị lần đầu, hoặc đặt lại mật khẩu khi quên. Cần: số điện thoại có trong <b>ADMIN_PHONES</b> và <b>mã cài đặt</b> = giá trị biến <b>ADMIN_SETUP_CODE</b> anh tự đặt ở Vercel.</p>
          <input className="auth-in" placeholder="Số điện thoại quản trị (vd 0912…)" inputMode="tel" value={id} onChange={(e) => setId(e.target.value)} aria-label="Số điện thoại quản trị" />
          <input className="auth-in" type="password" placeholder="Mật khẩu mới (ít nhất 8 ký tự)" value={pass} onChange={(e) => setPass(e.target.value)} autoComplete="new-password" aria-label="Mật khẩu mới" />
          <input className="auth-in" type="password" placeholder="Nhập lại mật khẩu" value={pass2} onChange={(e) => setPass2(e.target.value)} autoComplete="new-password" aria-label="Nhập lại mật khẩu" />
          <input className="auth-in" type="password" placeholder="Mã cài đặt (ADMIN_SETUP_CODE)" value={code} onChange={(e) => setCode(e.target.value)} autoComplete="off" aria-label="Mã cài đặt" />
          {err && <div className="err">{err}</div>}
          <button className="cta" disabled={busy || !id || !pass || !pass2 || !code}>{busy ? 'Đang tạo…' : 'Tạo tài khoản & vào trang quản trị'}</button>
          <button type="button" className="linkbtn" onClick={() => sw('login')}>← Quay lại đăng nhập</button>
        </>
      )}
    </form>
  )
}

function Overview({ go }) {
  const [d, setD] = useState(null)
  useEffect(() => { adminCall('overview').then(setD) }, [])
  if (!d) return <p className="adm-muted">Đang tải…</p>
  if (!d.ok) return <div className="err">{ERR[d.error] || 'Lỗi: ' + d.error}</div>
  const plans = Object.entries(d.byPlan || {}).sort((a, b) => a[0] - b[0])
  return (
    <div className="adm-grid" data-testid="adm-overview">
      <div className="adm-card"><b>{d.users}</b><span>tài khoản phụ huynh</span></div>
      <div className="adm-card"><b>{d.kids}</b><span>học sinh</span></div>
      <div className="adm-card"><b>{d.new7}</b><span>đăng ký mới 7 ngày</span><em>{d.new30} trong 30 ngày</em></div>
      <div className="adm-card"><b>{d.active7}</b><span>tài khoản dùng app 7 ngày qua</span></div>
      <button className="adm-card link" onClick={() => go('fb')}><b>{d.fbPending}</b><span>góp ý đang chờ trả lời</span></button>
      <button className="adm-card link" onClick={() => go('books')}><b>{d.books}</b><span>sách trong thư viện</span></button>
      <div className="adm-card wide"><span>Theo gói</span><em>{plans.length ? plans.map(([n, c]) => `${n} học sinh: ${c}`).join(' · ') : '—'}</em></div>
      <div className="adm-card wide"><span>💵 Doanh thu</span><em>Chưa có số liệu: app chưa ghép cổng thanh toán thật (VNPay / MoMo / Stripe…). Khi ghép cổng, doanh thu sẽ hiện ở đây.</em></div>
    </div>
  )
}

function BooksTab() {
  const [st, setSt] = useState(null)
  useEffect(() => { booksCall('list').then(setSt) }, [])
  if (!st) return <p className="adm-muted">Đang tải…</p>
  if (!st.ok || !st.admin) return <div className="err">{ERR[st.error] || 'Không tải được thư viện sách.'}</div>
  return <Suspense fallback={null}><Library initial={st.books || []} /></Suspense>
}

function Users() {
  const [q, setQ] = useState('')
  const [d, setD] = useState(null)
  const [open, setOpen] = useState(null)
  async function load(off = 0, query = q) {
    const r = await adminCall('users', { q: query, offset: off })
    setD((cur) => (off && cur && r.ok ? { ...r, users: [...cur.users, ...r.users] } : r))
  }
  useEffect(() => { load(0, '') }, []) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div data-testid="adm-users">
      <form className="adm-search" onSubmit={(e) => { e.preventDefault(); load(0) }}>
        <input className="auth-in" placeholder="Tìm theo số điện thoại hoặc email" value={q} onChange={(e) => setQ(e.target.value)} />
        <button className="cta small">Tìm</button>
      </form>
      {!d ? <p className="adm-muted">Đang tải…</p> : !d.ok ? <div className="err">{ERR[d.error] || d.error}</div> : (
        <>
          <p className="adm-muted">{d.total} tài khoản{q ? ' khớp' : ''}</p>
          <ul className="adm-list">
            {d.users.map((u) => (
              <li key={u.phone} className="adm-user" onClick={() => setOpen(open === u.phone ? null : u.phone)}>
                <div className="adm-row"><b>{u.parentName || '(chưa ghi tên)'}</b><span className="adm-tag">Gói {u.plan}</span></div>
                <div className="adm-muted">{u.phone}{u.email ? ' · ' + u.email : ''}{u.province ? ' · ' + u.province : ''}</div>
                <div className="adm-muted">Đăng ký {fmt(u.created)} · Dùng gần nhất {fmt(u.seen)}</div>
                {open === u.phone && (
                  <ul className="adm-kids">
                    {u.children.map((c, i) => <li key={i}>👦 {c.name} · {c.grade || 'chưa đặt lớp'}{c.school ? ' · ' + c.school : ''}</li>)}
                  </ul>
                )}
              </li>
            ))}
          </ul>
          {d.users.length < d.total && <button className="cta small ghost" onClick={() => load(d.users.length)}>Xem thêm</button>}
        </>
      )}
    </div>
  )
}

function Thread({ id, onChanged }) {
  const [t, setT] = useState(null)
  const [reply, setReply] = useState('')
  const [lesson, setLesson] = useState('')
  const [imgs, setImgs] = useState({})
  const [msg, setMsg] = useState('')
  useEffect(() => { adminCall('fb_get', { id }).then((r) => { setT(r); if (r.ok) setLesson(r.thread.lesson || '') }) }, [id])
  if (!t) return <p className="adm-muted">Đang tải…</p>
  if (!t.ok) return <div className="err">{t.error}</div>
  const th = t.thread
  async function send() {
    if (!reply.trim()) return
    const r = await adminCall('fb_reply', { id, text: reply })
    if (r.ok) { setReply(''); setT({ ...t, thread: { ...th, ...r.thread } }); onChanged() } else setMsg('Lỗi: ' + r.error)
  }
  async function setStatus(status) {
    const r = await adminCall('fb_status', { id, status, lesson })
    if (r.ok) { setT({ ...t, thread: { ...th, ...r.thread } }); setMsg(status === 'done' ? 'Đã đóng phiếu ✓ (bài học đã lưu)' : 'Đã lưu ✓'); onChanged(status === 'done' ? 'Đã đóng phiếu ✓ (bài học đã lưu) — xem lại ở mục "Đã xong".' : '') } else setMsg('Lỗi: ' + r.error)
  }
  async function loadImg(n) { const r = await adminCall('fb_img', { id, n }); if (r.ok) setImgs({ ...imgs, [n]: r.img }) }
  return (
    <div className="adm-thread" data-testid="adm-thread">
      <div className="adm-row"><b>{KIND[th.kind]} · {STATUS[th.status]}</b><span className="adm-muted">{fmt(th.created)}</span></div>
      <div className="adm-muted">
        {th.who === 'child' ? `Học sinh ${th.child ? th.child.name + ' (' + (th.child.grade || '?') + ')' : ''}` : 'Phụ huynh'} · {th.user ? th.user.parentName : ''} · {th.phone}{th.user && th.user.email ? ' · ' + th.user.email : ''}
        {th.ctx && th.ctx.screen ? ' · màn ' + th.ctx.screen : ''}
      </div>
      <div className="adm-msgs">
        {th.msgs.map((m) => (
          <div key={m.n} className={'adm-msg ' + (m.by === 'admin' ? 'me' : m.by === 'ai' ? 'ai' : 'them')}>
            <div className="adm-msg-h">{m.by === 'admin' ? '🧑‍💼 Ôn Tập (người)' : m.by === 'ai' ? '🤖 ONTAP (AI)' : m.who} · {fmt(m.at)}</div>
            <div className="adm-msg-t">{m.text}</div>
            {m.img && (imgs[m.n] ? <img className="adm-shot" alt="Ảnh chụp màn hình" src={'data:image/jpeg;base64,' + imgs[m.n]} /> : <button className="linkbtn" onClick={() => loadImg(m.n)}>🖼️ Xem ảnh chụp màn hình</button>)}
          </div>
        ))}
      </div>
      <textarea className="auth-in adm-ta" rows={3} placeholder="Trả lời người dùng…" value={reply} onChange={(e) => setReply(e.target.value)} aria-label="Trả lời" />
      <button className="cta small" disabled={!reply.trim()} onClick={send}>Gửi trả lời</button>
      <label className="auth-lbl">Bài học / cách xử lý (lưu lại để AI chăm sóc khách hàng học, tránh lỗi lặp lại)</label>
      <textarea className="auth-in adm-ta" rows={3} placeholder="vd: Lỗi do … đã sửa ngày …; lần sau gặp thì hướng dẫn …" value={lesson} onChange={(e) => setLesson(e.target.value)} aria-label="Bài học" />
      <div className="modal-btns">
        <button className="cta small ghost" onClick={() => setStatus(th.status)}>Lưu bài học</button>
        {th.status !== 'done' ? <button className="cta small" onClick={() => setStatus('done')}>✓ Đóng phiếu (đã xong)</button>
          : <button className="cta small ghost" onClick={() => setStatus('answered')}>Mở lại phiếu</button>}
      </div>
      {msg && <div className={/Lỗi/.test(msg) ? 'err' : 'ok-msg'}>{msg}</div>}
    </div>
  )
}

function FeedbackTab() {
  const [st, setSt] = useState('open')
  const [d, setD] = useState(null)
  const [open, setOpen] = useState(null)
  const [note, setNote] = useState('')
  const [kb, setKb] = useState('')
  const load = (s = st) => adminCall('fb_list', { status: s }).then(setD)
  useEffect(() => { load(st) }, [st]) // eslint-disable-line react-hooks/exhaustive-deps
  async function exportAll() {
    const r = await adminCall('fb_export')
    if (!r.ok) return
    const blob = new Blob([JSON.stringify(r, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob); a.download = `ontap-gop-y-${new Date().toISOString().slice(0, 10)}.json`; a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 2000)
  }
  return (
    <div data-testid="adm-fb">
      <div className="chips adm-chips">
        {[['open', 'Đang mở'], ['new', 'Chờ trả lời'], ['answered', 'Đã trả lời'], ['done', 'Đã xong'], ['all', 'Tất cả']].map(([k, l]) => (
          <button key={k} className={'chip' + (st === k ? ' on' : '')} onClick={() => { setSt(k); setOpen(null); setNote('') }}>{l}</button>
        ))}
      </div>
      {note && <div className="ok-msg">{note}</div>}
      <details className="adm-kb" onToggle={(e) => { if (e.currentTarget.open && !kb) adminCall('kb').then((r) => setKb(r.ok ? r.text : 'Chưa tải được.')) }}>
        <summary>📘 Hiểu biết hệ thống cho chăm sóc khách hàng (để trả lời đúng; sau này AI cũng đọc tài liệu này)</summary>
        <pre className="adm-kb-t">{kb || 'Đang tải…'}</pre>
      </details>
      <p className="adm-muted">Nhật ký góp ý được lưu vĩnh viễn để sau này AI chăm sóc khách hàng đọc và học. <button className="linkbtn" onClick={exportAll}>⬇️ Tải toàn bộ nhật ký (JSON, không kèm số điện thoại)</button></p>
      {!d ? <p className="adm-muted">Đang tải…</p> : !d.ok ? <div className="err">{d.error}</div> : !d.threads.length ? <p className="adm-muted">Không có góp ý nào.</p> : (
        <ul className="adm-list">
          {d.threads.map((t) => (
            <li key={t.id} className={'adm-fbi' + (t.pending ? ' pending' : '')} data-fb={t.id}>
              <div className="adm-row" onClick={() => setOpen(open === t.id ? null : t.id)}>
                <b>{t.pending ? '🔴 ' : ''}{t.urgent ? '🔥 GẤP · ' : ''}{t.escalated ? '⚠️ ONTAP chuyển người · ' : t.last === 'ai' ? '🤖 ONTAP đã trả lời · ' : ''}{KIND[t.kind]} · {t.who === 'child' ? 'Học sinh' + (t.child ? ' ' + t.child.name : '') : 'Phụ huynh'}</b>
                <span className="adm-muted">{STATUS[t.status]} · {fmt(t.updated)}</span>
              </div>
              <div className="adm-muted adm-first" onClick={() => setOpen(open === t.id ? null : t.id)}>{t.first}{t.n > 1 ? ` (${t.n} tin nhắn)` : ''}{t.aiSummary ? <><br />🤖 Tóm tắt: {t.aiSummary}</> : null}</div>
              {open === t.id && <Thread id={t.id} onChanged={(n) => { if (n) setNote(n); load() }} />}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function Pricing({ role }) {
  const [d, setD] = useState(null)
  const [msg, setMsg] = useState('')
  const [pend, setPend] = useState(null)
  useEffect(() => { getPricesPublic().then((p) => setD(p || { error: 'Không tải được bảng giá' })); adminCall('prices_pending').then((r) => setPend(r.ok ? r.change : null)) }, [])
  if (!d) return <p className="adm-muted">Đang tải…</p>
  if (d.error) return <div className="err">{d.error}</div>
  const set = (id, k, v) => setD({ ...d, plans: { ...d.plans, [id]: { ...d.plans[id], [k]: Number(String(v).replace(/\D+/g, '')) || 0 } } })
  async function save() {
    const r = await adminCall('prices_set', { plans: d.plans })
    if (r.ok && r.pending) { setPend(r.change); setMsg('Đã gửi đề xuất giá ✓ Chờ super admin duyệt (trang đăng ký vẫn hiện giá cũ).'); return }
    setMsg(r.ok ? 'Đã lưu bảng giá ✓ Trang đăng ký hiện giá mới ngay.' : 'Lỗi: ' + r.error)
    if (r.ok) { setD(r.prices); setPend(null) }
  }
  return (
    <div data-testid="adm-price">
      <p className="adm-muted">Giá theo số học sinh trong gói (đồng). Để 0 = chưa đặt giá (trang đăng ký ghi "Giá: liên hệ").{role !== 'super' ? ' Admin đổi giá thì phải chờ super admin duyệt.' : ''}</p>
      {pend && <div className="adm-pend" data-testid="price-pend">⏳ Đang có đề xuất giá chờ duyệt (của {pend.byName || pend.by}, {fmt(pend.at)}): {Object.entries(pend.after).filter(([, x]) => x.month || x.year).map(([k, x]) => `gói ${k}: ${x.month ? vnd(x.month) + '/tháng' : ''}${x.month && x.year ? ', ' : ''}${x.year ? vnd(x.year) + '/năm' : ''}`).join(' · ') || 'bỏ hết giá'}{role === 'super' ? ' — xem ở mục "Duyệt & nhật ký".' : ''}</div>}
      <table className="adm-table">
        <thead><tr><th>Gói</th><th>Hàng tháng</th><th>Hàng năm</th></tr></thead>
        <tbody>
          {Object.keys(d.plans).map((id) => (
            <tr key={id}>
              <td>{id} học sinh</td>
              <td><input className="auth-in" inputMode="numeric" aria-label={`Gói ${id} hàng tháng`} value={d.plans[id].month || ''} placeholder="0" onChange={(e) => set(id, 'month', e.target.value)} /><small>{d.plans[id].month ? vnd(d.plans[id].month) : ''}</small></td>
              <td><input className="auth-in" inputMode="numeric" aria-label={`Gói ${id} hàng năm`} value={d.plans[id].year || ''} placeholder="0" onChange={(e) => set(id, 'year', e.target.value)} /><small>{d.plans[id].year ? vnd(d.plans[id].year) : ''}</small></td>
            </tr>
          ))}
        </tbody>
      </table>
      <button className="cta small" onClick={save}>{role === 'super' ? 'Lưu bảng giá' : 'Gửi đề xuất giá (chờ duyệt)'}</button>
      {msg && <div className={/Lỗi/.test(msg) ? 'err' : 'ok-msg'}>{msg}</div>}
      {d.updated ? <p className="adm-muted">Sửa lần cuối {fmt(d.updated)}</p> : null}
    </div>
  )
}

function priceText(plans) {
  return Object.entries(plans || {}).map(([k, x]) => `gói ${k}: ${x.month ? vnd(x.month) : '—'} / ${x.year ? vnd(x.year) : '—'}`).join(' · ')
}
function Changes({ role }) {
  const [d, setD] = useState(null)
  const [msg, setMsg] = useState('')
  const [prev, setPrev] = useState({})
  const [notes, setNotes] = useState({})
  const load = () => adminCall('chg_list').then(setD)
  useEffect(() => { load() }, [])
  async function decide(c, ok) {
    const r = await adminCall(ok ? 'chg_approve' : 'chg_reject', { id: c.id, note: notes[c.id] || '' })
    setMsg(r.ok ? (ok ? 'Đã duyệt ✓ Thay đổi đã áp dụng.' : 'Đã từ chối.') : r.error === 'not_ready' ? 'Sách chưa đọc xong, chưa duyệt được.' : 'Lỗi: ' + r.error)
    load()
  }
  async function preview(c) { const r = await adminCall('book_preview', { id: c.ref }); setPrev({ ...prev, [c.id]: r.ok ? r.pages : [] }) }
  if (!d) return <p className="adm-muted">Đang tải…</p>
  if (!d.ok) return <div className="err">{ERR[d.error] || d.error}</div>
  const pend = d.changes.filter((c) => c.status === 'pending'), done = d.changes.filter((c) => c.status !== 'pending')
  const detail = (c) => c.type === 'prices' ? <><div>Giá cũ: {priceText(c.before)}</div><div>Giá mới: <b>{priceText(c.after)}</b></div></> : null
  return (
    <div data-testid="adm-chg">
      <p className="adm-muted">{role === 'super' ? 'Thay đổi của admin (bảng giá, đưa sách mới vào dùng, xoá sách) chờ anh duyệt mới áp dụng cho người dùng.' : 'Thay đổi của bạn (bảng giá, sách mới, xoá sách) chờ super admin duyệt mới áp dụng.'}</p>
      {msg && <div className={/Lỗi|chưa/.test(msg) ? 'err' : 'ok-msg'}>{msg}</div>}
      <h3 className="adm-h">⏳ Chờ duyệt ({pend.length})</h3>
      {!pend.length ? <p className="adm-muted">Không có thay đổi nào chờ duyệt.</p> : (
        <ul className="adm-list">
          {pend.map((c) => (
            <li key={c.id} className="adm-user adm-chg" data-chg={c.id}>
              <div className="adm-row"><b>{d.types[c.type] || c.type}: {c.title}</b><span className="adm-muted">{c.byName || c.by} · {fmt(c.at)}</span></div>
              {detail(c)}
              {c.type === 'book_publish' && (
                <>
                  <button className="linkbtn" onClick={() => preview(c)}>👁️ Xem thử chữ ONTAP đọc được (4 trang đầu)</button>
                  {prev[c.id] && (prev[c.id].length ? prev[c.id].map((p) => <pre key={p.n} className="adm-kb-t adm-prev"><b>Trang {p.printed || p.n}</b>{'\n'}{p.text}</pre>) : <p className="adm-muted">Sách chưa đọc xong (chưa có chữ).</p>)}
                </>
              )}
              {role === 'super' && (
                <>
                  <input className="auth-in" placeholder="Ghi chú (không bắt buộc)" value={notes[c.id] || ''} onChange={(e) => setNotes({ ...notes, [c.id]: e.target.value })} aria-label="Ghi chú duyệt" />
                  <div className="modal-btns">
                    <button className="cta small ghost" onClick={() => decide(c, false)}>✗ Từ chối</button>
                    <button className="cta small" onClick={() => decide(c, true)}>✓ Duyệt</button>
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
      <h3 className="adm-h">📜 Nhật ký thay đổi</h3>
      {!done.length ? <p className="adm-muted">Chưa có.</p> : (
        <ul className="adm-list">
          {done.map((c) => (
            <li key={c.id} className="adm-user adm-log">
              <div className="adm-row"><b>{d.types[c.type] || c.type}: {c.title}</b><span className="adm-muted">{CHG_ST[c.status]}</span></div>
              {detail(c)}
              <div className="adm-muted">Làm: {c.byName || c.by} · {fmt(c.at)}{c.reviewedBy && c.status !== 'applied' ? ` · Duyệt: ${c.reviewedBy} · ${fmt(c.reviewedAt)}` : ''}{c.note ? ' · Ghi chú: ' + c.note : ''}</div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function Staff() {
  const [d, setD] = useState(null)
  const [f, setF] = useState({ phone: '', name: '', pass: '' })
  const [msg, setMsg] = useState('')
  const load = () => adminCall('staff_list').then(setD)
  useEffect(() => { load() }, [])
  const SERR = { bad_phone: 'Số điện thoại chưa đúng.', is_super: 'Số này đã là super admin.', bad_pass: 'Số này chưa có tài khoản: cần mật khẩu ban đầu ít nhất 8 ký tự.' }
  async function add(e) {
    e.preventDefault()
    const r = await adminCall('staff_add', f)
    setMsg(r.ok ? (r.created ? 'Đã thêm admin ✓ (đã tạo tài khoản; báo người đó đăng nhập /quan-tri bằng số + mật khẩu ban đầu, rồi đổi mật khẩu trong app).' : 'Đã thêm admin ✓ (dùng tài khoản sẵn có của số này).') : SERR[r.error] || 'Lỗi: ' + r.error)
    if (r.ok) { setF({ phone: '', name: '', pass: '' }); load() }
  }
  async function remove(p) { const r = await adminCall('staff_remove', { phone: p }); setMsg(r.ok ? 'Đã bỏ quyền admin ✓' : 'Lỗi: ' + r.error); load() }
  return (
    <div data-testid="adm-staff">
      <p className="adm-muted">Super admin = các số trong ADMIN_PHONES ở Vercel (duyệt thay đổi). Admin = người làm việc hằng ngày, anh thêm / bỏ ở đây; thay đổi về giá và sách của admin phải chờ anh duyệt.</p>
      {!d ? <p className="adm-muted">Đang tải…</p> : !d.ok ? <div className="err">{d.error}</div> : (
        <ul className="adm-list">
          {d.staff.map((x) => (
            <li key={x.phone} className="adm-user">
              <div className="adm-row"><b>{x.name || '(chưa ghi tên)'}</b><span className="adm-tag">{ROLE[x.role]}</span></div>
              <div className="adm-muted">{x.phone}{x.hasAccount ? '' : ' · chưa tạo tài khoản'} · Dùng gần nhất {fmt(x.seen)}</div>
              {x.role === 'admin' && <button className="linkbtn" onClick={() => remove(x.phone)}>Bỏ quyền admin</button>}
            </li>
          ))}
        </ul>
      )}
      <form className="adm-form" onSubmit={add}>
        <b>Thêm admin</b>
        <input className="auth-in" placeholder="Số điện thoại" inputMode="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} aria-label="Số điện thoại admin" />
        <input className="auth-in" placeholder="Tên" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} aria-label="Tên admin" />
        <input className="auth-in" type="password" placeholder="Mật khẩu ban đầu (nếu số chưa có tài khoản, ≥ 8 ký tự)" value={f.pass} onChange={(e) => setF({ ...f, pass: e.target.value })} aria-label="Mật khẩu ban đầu" autoComplete="new-password" />
        <button className="cta small" disabled={!f.phone}>Thêm admin</button>
      </form>
      {msg && <div className={/Lỗi|chưa|đã là/.test(msg) && !/✓/.test(msg) ? 'err' : 'ok-msg'}>{msg}</div>}
    </div>
  )
}

function Settings() {
  const [d, setD] = useState(null)
  const [emails, setEmails] = useState('')
  const [msg, setMsg] = useState('')
  useEffect(() => { adminCall('settings_get').then((r) => { setD(r); if (r.ok) setEmails(r.settings.alertEmails.join(', ')) }) }, [])
  if (!d) return <p className="adm-muted">Đang tải…</p>
  if (!d.ok) return <div className="err">{d.error}</div>
  async function save(patch) {
    const r = await adminCall('settings_set', patch)
    setMsg(r.ok ? 'Đã lưu ✓' : r.error === 'bad_email' ? 'Email chưa đúng (tối đa 5 email, cách nhau dấu phẩy).' : 'Lỗi: ' + r.error)
    if (r.ok) { setD({ ...d, settings: r.settings }); setEmails(r.settings.alertEmails.join(', ')) }
  }
  const st = d.settings
  return (
    <div data-testid="adm-cfg" className="adm-form">
      <b>🤖 ONTAP chăm sóc khách hàng</b>
      <label className="switch-row">
        <span className="switch-txt"><b>ONTAP tự trả lời góp ý</b><em>Bật: ONTAP trả lời ngay trong app (cách dùng, câu hỏi thường). Việc cần người (lỗi thật, cần thay đổi hệ thống, tiền, việc gấp, ONTAP không chắc) thì ONTAP chuyển phiếu cho quản trị + gửi email báo.</em></span>
        <span className={'switch' + (st.aiOn ? ' on' : '')} onClick={() => save({ aiOn: !st.aiOn })} role="switch" aria-checked={!!st.aiOn} aria-label="ONTAP tự trả lời"><span className="knob" /></span>
      </label>
      <label className="auth-lbl">Email nhận báo khi ONTAP chuyển phiếu (gấp / cần thay đổi), tối đa 5, cách nhau dấu phẩy</label>
      <input className="auth-in" type="email" multiple placeholder="email@vidu.com" value={emails} onChange={(e) => setEmails(e.target.value)} aria-label="Email nhận báo" />
      <button className="cta small" onClick={() => save({ alertEmails: emails })}>Lưu email</button>
      {!st.alertEmails.length && <p className="adm-muted">⚠️ Chưa có email: ONTAP vẫn chuyển phiếu sang mục Góp ý nhưng không gửi thư báo.</p>}
      {msg && <div className={/Lỗi|chưa đúng/.test(msg) ? 'err' : 'ok-msg'}>{msg}</div>}
    </div>
  )
}

export default function AdminApp() {
  const [logged, setLogged] = useState(!!getAdminToken())
  const [tab, setTab] = useState('home')
  const [me, setMe] = useState(null)
  useEffect(() => {
    if (!logged) return
    adminCall('whoami').then((r) => { if (r.ok) setMe(r); else if (['bad_token', 'not_admin'].includes(r.error)) { setAdminToken(''); setLogged(false) } })
  }, [logged])
  useEffect(() => { document.title = 'Quản trị · Ôn Tập' }, [])
  if (!logged) return <div className="adm"><Login onDone={() => setLogged(true)} /></div>
  return (
    <div className="adm">
      <header className="adm-top">
        <img src={logoRow} alt="Ôn Tập" className="adm-logo" />
        <span className="adm-title">Quản trị hệ thống</span>
        <span className="adm-me">{me ? `${me.name || me.phone} · ${ROLE[me.role] || ''}` : ''}</span>
        <button className="cta small ghost" onClick={() => { setAdminToken(''); setLogged(false) }}>Đăng xuất</button>
      </header>
      <nav className="adm-tabs">
        {TABS.filter((x) => !x[2] || (me && me.role === x[2])).map(([k, l]) => <button key={k} className={'adm-tab' + (tab === k ? ' on' : '')} onClick={() => setTab(k)}>{l}</button>)}
      </nav>
      <main className="adm-main">
        {tab === 'home' && <Overview go={setTab} />}
        {tab === 'books' && <BooksTab />}
        {tab === 'users' && <Users />}
        {tab === 'fb' && <FeedbackTab />}
        {tab === 'price' && <Pricing role={me && me.role} />}
        {tab === 'chg' && <Changes role={me && me.role} />}
        {tab === 'staff' && me && me.role === 'super' && <Staff />}
        {tab === 'cfg' && me && me.role === 'super' && <Settings />}
      </main>
    </div>
  )
}
