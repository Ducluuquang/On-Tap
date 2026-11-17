// TRANG QUẢN TRỊ HỆ THỐNG — địa chỉ riêng /quan-tri (anh duyệt 17/11/2026). Không có lối vào từ app của phụ huynh / học sinh.
// Đăng nhập bằng tài khoản Ôn Tập có số trong ADMIN_PHONES. Các mục: Tổng quan · Thư viện sách · Người dùng · Góp ý · Định giá.
// Góp ý: nhật ký trò chuyện lưu vĩnh viễn; khi đóng phiếu ghi "Bài học / cách xử lý"; nút tải toàn bộ nhật ký để AI học sau này.
import { lazy, Suspense, useEffect, useState } from 'react'
import { adminCall, adminLogin, getAdminToken, setAdminToken, getPricesPublic, vnd } from '../lib/adminApi.js'
import { booksCall } from '../lib/books.js'
import logoRow from '../assets/logo-row.png'

const Library = lazy(() => import('../screens/Library.jsx'))
const TABS = [['home', '📊 Tổng quan'], ['books', '📚 Thư viện sách'], ['users', '👪 Người dùng'], ['fb', '💬 Góp ý'], ['price', '💰 Định giá']]
const KIND = { bug: 'Báo lỗi', idea: 'Kiến nghị', other: 'Khác' }
const STATUS = { new: 'Mới', answered: 'Đã trả lời', done: 'Đã xong' }
const ERR = { bad_login: 'Sai số điện thoại / email hoặc mật khẩu.', not_admin: 'Tài khoản này không phải quản trị hệ thống.', network: 'Mất mạng, thử lại.', slow_down: 'Thử sai nhiều lần quá, đợi ít phút.', bad_token: 'Phiên đăng nhập hết hạn, đăng nhập lại.' }
const p2 = (n) => String(n).padStart(2, '0')
const fmt = (ms) => { if (!ms) return '—'; const d = new Date(ms); return `${p2(d.getDate())}/${p2(d.getMonth() + 1)}/${d.getFullYear()} ${p2(d.getHours())}:${p2(d.getMinutes())}` }

function Login({ onDone }) {
  const [id, setId] = useState('')
  const [pass, setPass] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  async function go(e) {
    e.preventDefault(); setErr(''); setBusy(true)
    const r = await adminLogin(id.trim(), pass)
    setBusy(false)
    if (r.ok) onDone(); else setErr(ERR[r.error] || 'Không đăng nhập được (' + r.error + ').')
  }
  return (
    <form className="adm-login" onSubmit={go}>
      <img src={logoRow} alt="Ôn Tập" className="adm-logo" />
      <h1>Quản trị hệ thống</h1>
      <p className="adm-muted">Đăng nhập bằng tài khoản quản trị (số điện thoại có trong ADMIN_PHONES).</p>
      <input className="auth-in" placeholder="Số điện thoại hoặc email" value={id} onChange={(e) => setId(e.target.value)} autoComplete="username" />
      <input className="auth-in" type="password" placeholder="Mật khẩu" value={pass} onChange={(e) => setPass(e.target.value)} autoComplete="current-password" />
      {err && <div className="err">{err}</div>}
      <button className="cta" disabled={busy || !id || !pass}>{busy ? 'Đang đăng nhập…' : 'Đăng nhập'}</button>
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
          <div key={m.n} className={'adm-msg ' + (m.by === 'admin' ? 'me' : 'them')}>
            <div className="adm-msg-h">{m.by === 'admin' ? 'Ôn Tập' : m.who} · {fmt(m.at)}</div>
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
                <b>{t.pending ? '🔴 ' : ''}{KIND[t.kind]} · {t.who === 'child' ? 'Học sinh' + (t.child ? ' ' + t.child.name : '') : 'Phụ huynh'}</b>
                <span className="adm-muted">{STATUS[t.status]} · {fmt(t.updated)}</span>
              </div>
              <div className="adm-muted adm-first" onClick={() => setOpen(open === t.id ? null : t.id)}>{t.first}{t.n > 1 ? ` (${t.n} tin nhắn)` : ''}</div>
              {open === t.id && <Thread id={t.id} onChanged={(n) => { if (n) setNote(n); load() }} />}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function Pricing() {
  const [d, setD] = useState(null)
  const [msg, setMsg] = useState('')
  useEffect(() => { getPricesPublic().then((p) => setD(p || { error: 'Không tải được bảng giá' })) }, [])
  if (!d) return <p className="adm-muted">Đang tải…</p>
  if (d.error) return <div className="err">{d.error}</div>
  const set = (id, k, v) => setD({ ...d, plans: { ...d.plans, [id]: { ...d.plans[id], [k]: Number(String(v).replace(/\D+/g, '')) || 0 } } })
  async function save() {
    const r = await adminCall('prices_set', { plans: d.plans })
    setMsg(r.ok ? 'Đã lưu bảng giá ✓ Trang đăng ký hiện giá mới ngay.' : 'Lỗi: ' + r.error)
    if (r.ok) setD(r.prices)
  }
  return (
    <div data-testid="adm-price">
      <p className="adm-muted">Giá theo số học sinh trong gói (đồng). Để 0 = chưa đặt giá (trang đăng ký ghi "Giá: liên hệ").</p>
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
      <button className="cta small" onClick={save}>Lưu bảng giá</button>
      {msg && <div className={/Lỗi/.test(msg) ? 'err' : 'ok-msg'}>{msg}</div>}
      {d.updated ? <p className="adm-muted">Sửa lần cuối {fmt(d.updated)}</p> : null}
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
        <span className="adm-me">{me ? me.name || me.phone : ''}</span>
        <button className="cta small ghost" onClick={() => { setAdminToken(''); setLogged(false) }}>Đăng xuất</button>
      </header>
      <nav className="adm-tabs">
        {TABS.map(([k, l]) => <button key={k} className={'adm-tab' + (tab === k ? ' on' : '')} onClick={() => setTab(k)}>{l}</button>)}
      </nav>
      <main className="adm-main">
        {tab === 'home' && <Overview go={setTab} />}
        {tab === 'books' && <BooksTab />}
        {tab === 'users' && <Users />}
        {tab === 'fb' && <FeedbackTab />}
        {tab === 'price' && <Pricing />}
      </main>
    </div>
  )
}
