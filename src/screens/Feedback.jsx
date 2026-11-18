// GÓP Ý / BÁO LỖI (anh duyệt 17/11/2026) — học sinh và phụ huynh gửi góp ý / báo lỗi / kiến nghị, kèm ảnh chụp màn hình nếu muốn;
// quản trị trả lời ở trang /quan-tri; câu trả lời hiện ở "Góp ý của tôi" (chấm đỏ báo mới), người dùng nhắn tiếp được.
import { useEffect, useState } from 'react'
import { BackHeader } from '../components.jsx'
import { fbCall, fbMeta, shotB64, setUnreadCache, viewerOf } from '../lib/feedback.js'

const KINDS = [['bug', '🐞 Báo lỗi'], ['idea', '💡 Kiến nghị'], ['other', '💬 Khác']]
const KIND = { bug: 'Báo lỗi', idea: 'Kiến nghị', other: 'Khác' }
const STATUS = { new: 'Đang chờ trả lời', answered: 'Đã trả lời', done: 'Đã xong' }
const ERR = { network: 'Mất mạng. Kiểm tra mạng rồi gửi lại nhé.', bad_token: 'Cần đăng nhập (và có mạng) để gửi góp ý.', slow_down: 'Hôm nay đã gửi nhiều quá, mai gửi tiếp nhé.', empty: 'Viết vài chữ nhé.', bad_img: 'Ảnh không đúng dạng (dùng ảnh JPG / PNG).', too_large: 'Ảnh quá lớn.' }
const p2 = (n) => String(n).padStart(2, '0')
const fmt = (ms) => { const d = new Date(ms); return `${p2(d.getHours())}:${p2(d.getMinutes())} ${p2(d.getDate())}/${p2(d.getMonth() + 1)}` }

function ThreadView({ t, who, child, onUpdated }) {
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  useEffect(() => { if (t.unread) fbCall('seen', { id: t.id, ...viewerOf(who, child) }).then((r) => { if (r.ok) { setUnreadCache(viewerOf(who, child), r.unread); onUpdated({ ...t, unread: false }, r.unread) } }) }, [t.id]) // eslint-disable-line react-hooks/exhaustive-deps
  async function send() {
    setBusy(true); setErr('')
    const r = await fbCall('reply', { id: t.id, text, ...viewerOf(who, child) })
    setBusy(false)
    if (r.ok) { setText(''); onUpdated({ ...r.thread, unread: false }) } else setErr(ERR[r.error] || 'Chưa gửi được (' + r.error + ').')
  }
  return (
    <div className="fb-thread">
      {t.msgs.map((m) => (
        <div key={m.n} className={'fb-msg ' + (m.by === 'admin' ? 'them' : m.by === 'ai' ? 'ai' : 'me')}>
          <div className="fb-msg-h">{m.by === 'admin' ? '🧑‍💼 Ôn Tập' : m.by === 'ai' ? '🤖 ONTAP' : m.who} · {fmt(m.at)}</div>
          <div className="fb-msg-t">{m.text}</div>
          {m.img && <div className="fb-msg-h">📎 có ảnh chụp màn hình</div>}
        </div>
      ))}
      {t.status !== 'done' && (
        <>
          <textarea className="auth-in fb-ta" rows={2} placeholder="Nhắn thêm…" value={text} onChange={(e) => setText(e.target.value)} aria-label="Nhắn thêm" />
          {err && <div className="err">{err}</div>}
          <button className="cta small" disabled={busy || !text.trim()} onClick={send}>{busy ? 'Đang gửi… ONTAP đang đọc' : 'Gửi'}</button>
        </>
      )}
    </div>
  )
}

// who: 'child' (học sinh) | 'parent' (phụ huynh)
export default function Feedback({ who = 'parent', child = null, screen = '', onBack }) {
  const [tab, setTab] = useState('new')
  const [kind, setKind] = useState('bug')
  const [text, setText] = useState('')
  const [shot, setShot] = useState(null)   // { name, b64 }
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null)
  const [list, setList] = useState(null)
  const [open, setOpen] = useState(null)

  async function loadMine() {
    const r = await fbCall('mine', viewerOf(who, child))
    setList(r)
    if (r.ok) setUnreadCache(viewerOf(who, child), r.unread)
    return r
  }
  useEffect(() => { loadMine().then((r) => { if (r.ok && r.unread) setTab('mine') }) }, [])

  async function pickShot(e) {
    const f = e.target.files && e.target.files[0]
    e.target.value = ''
    if (!f) return
    try { setShot({ name: f.name, b64: await shotB64(f) }) } catch { setMsg({ ok: false, text: 'Không đọc được ảnh này.' }) }
  }
  async function send() {
    setBusy(true); setMsg(null)
    const r = await fbCall('send', { kind, text, ...viewerOf(who, child), img: shot ? shot.b64 : '', ...fbMeta(screen) })
    setBusy(false)
    if (!r.ok) { setMsg({ ok: false, text: ERR[r.error] || 'Chưa gửi được (' + r.error + ').' }); return }
    setText(''); setShot(null)
    const ai = (r.thread.msgs || []).some((m) => m.by === 'ai')
    setMsg({ ok: true, text: ai ? 'Đã gửi ✓ ONTAP đã trả lời ' + (who === 'child' ? 'con' : 'anh/chị') + ' ngay bên dưới.'
      : 'Đã gửi ✓ Cảm ơn ' + (who === 'child' ? 'con' : 'anh/chị') + '! Ôn Tập sẽ trả lời trong mục "Góp ý của ' + (who === 'child' ? 'con' : 'tôi') + '".' })
    await loadMine()
    if (ai) { setTab('mine'); setOpen(r.thread.id) }
  }
  const unread = list && list.ok ? list.unread : 0
  const upd = (t, n) => setList((l) => (l && l.ok ? { ...l, threads: l.threads.map((x) => (x.id === t.id ? { ...x, ...t } : x)), unread: n == null ? l.unread : n } : l))

  return (
    <div className="screen fb" data-testid="feedback">
      <BackHeader title="Góp ý cho Ôn Tập" onBack={onBack} />
      <div className="chips fb-tabs">
        <button className={'chip' + (tab === 'new' ? ' on' : '')} onClick={() => setTab('new')}>✏️ Gửi góp ý</button>
        <button className={'chip' + (tab === 'mine' ? ' on' : '')} onClick={() => setTab('mine')}>📬 Góp ý của {who === 'child' ? 'con' : 'tôi'}{unread ? <i className="dot" aria-label="có trả lời mới" /> : null}</button>
      </div>
      {tab === 'new' ? (
        <section className="set-sec">
          <p className="cr-hint">{who === 'child' ? 'Con gặp lỗi gì, hay muốn Ôn Tập thêm gì? Viết cho Ôn Tập nhé!' : 'Anh/chị gặp lỗi, có kiến nghị hay câu hỏi gì khi dùng Ôn Tập? Ôn Tập sẽ trả lời ngay trong app.'}</p>
          <div className="chips">
            {KINDS.map(([k, l]) => <button key={k} className={'chip' + (kind === k ? ' on' : '')} onClick={() => setKind(k)}>{l}</button>)}
          </div>
          <textarea className="auth-in fb-ta" rows={5} maxLength={2000} placeholder={kind === 'bug' ? 'Lỗi xảy ra ở đâu, lúc nào? (vd: bấm "Bắt đầu ôn" thì màn hình trắng)' : 'Viết ở đây…'} value={text} onChange={(e) => setText(e.target.value)} aria-label="Nội dung góp ý" />
          <label className="cta small ghost fb-shot">
            📷 {shot ? 'Đổi ảnh chụp màn hình' : 'Thêm ảnh chụp màn hình (không bắt buộc)'}
            <input type="file" accept="image/*" hidden onChange={pickShot} />
          </label>
          {shot && <div className="cr-hint">📎 {shot.name} <button className="linkbtn" onClick={() => setShot(null)}>bỏ ảnh</button></div>}
          {msg && <div className={msg.ok ? 'ok-msg' : 'err'}>{msg.text}</div>}
          <button className="cta" disabled={busy || text.trim().length < 3} onClick={send}>{busy ? 'Đang gửi… ONTAP đang đọc' : 'Gửi góp ý'}</button>
        </section>
      ) : (
        <section className="set-sec">
          {msg && msg.ok && <div className="ok-msg">{msg.text}</div>}
          {!list ? <p className="cr-hint">Đang tải…</p> : !list.ok ? <div className="err">{ERR[list.error] || 'Chưa tải được.'}</div>
            : !list.threads.length ? <p className="cr-hint">Chưa có góp ý nào.</p> : (
              <ul className="fb-list">
                {list.threads.map((t) => (
                  <li key={t.id} className={'fb-item' + (t.unread ? ' unread' : '')} data-fb={t.id}>
                    <button className="fb-item-h" onClick={() => setOpen(open === t.id ? null : t.id)}>
                      <b>{t.unread ? <i className="dot" aria-label="có trả lời mới" /> : null}{KIND[t.kind]} · {STATUS[t.status]}</b>
                      <span>{(t.msgs[0] || {}).text}</span>
                    </button>
                    {open === t.id && <ThreadView t={t} who={who} child={child} onUpdated={upd} />}
                  </li>
                ))}
              </ul>
            )}
        </section>
      )}
    </div>
  )
}
