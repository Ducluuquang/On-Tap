// CHI PHÍ AI (anh duyệt 25/11/2026) — mục "💸 Chi phí AI" của /quan-tri, CHỈ super admin.
// Bốn phần: Tổng quan (tiền AI thật theo ngày / loại việc / model / tài khoản), Cài đặt (model theo môn, giới hạn lượt soạn mới,
// trần tiền mỗi ngày, tỷ giá), Ngân hàng câu (xem / xoá câu ONTAP đã soạn), Thử model (Sonnet và Haiku soạn cùng đầu vào).
// Báo cáo ngày (anh yêu cầu 27/11/2026, tab đầu tiên): học + câu hỏi + tiền AI của một ngày, so với hôm qua / 7 ngày, từng gia đình;
// email mỗi tối (bật / tắt + "Gửi thử ngay" ở Cài đặt). Máy chủ: report_get, report_send (api/_report.mjs).
// Máy chủ: api/admin.mjs (ai_stats, ai_cfg_get/set, ai_bank_list/get/del, ai_try, ai_try_save). Ô chọn dùng SelectPicker (không <select>).
import { useEffect, useState } from 'react'
import { adminCall } from '../lib/adminApi.js'
import { SelectPicker } from '../components.jsx'

const SUBS = [['report', '📅 Báo cáo ngày'], ['stats', '📈 Tổng quan'], ['cfg', '⚙️ Cài đặt'], ['bank', '🏦 Ngân hàng câu'], ['try', '🧪 Thử model']]
const KIND_L = { gen: 'Soạn câu ôn', extract: 'Đọc bài (ảnh / chữ)', grade: 'Chấm bài', judge: 'Chấm câu tự gõ', spelling: 'Vở Spelling', arena: 'Thi đấu', cskh: 'ONTAP trả lời góp ý', books: 'Đọc sách (thư viện)', try: 'Thử model' }
const GROUP_L = { toan: 'Toán', 'tieng-viet': 'Tiếng Việt', 'tieng-anh': 'Tiếng Anh', 'ngu-van': 'Ngữ văn', default: 'Các môn khác', spelling: 'Vở Spelling', judge: 'Chấm câu tự gõ' }
const TIER_OPTS = [{ value: 'sonnet', label: 'Chính xác (Sonnet)' }, { value: 'haiku', label: 'Tiết kiệm (Haiku)' }]
const TIER_L = { sonnet: 'Sonnet', haiku: 'Haiku' }
const GRADES = Array.from({ length: 12 }, (_, i) => ({ value: 'Lớp ' + (i + 1), label: 'Lớp ' + (i + 1) }))
const SUBJECTS = ['Toán', 'Tiếng Việt', 'Tiếng Anh', 'Ngữ văn', 'Khoa học', 'Lịch sử và Địa lí', 'Tự nhiên và Xã hội', 'Khoa học tự nhiên'].map((s) => ({ value: s, label: s }))
const p2 = (n) => String(n).padStart(2, '0')
const dmy = (d) => (d ? `${d.slice(8, 10)}/${d.slice(5, 7)}` : '')
const fmt = (ms) => { if (!ms) return '—'; const d = new Date(ms); return `${p2(d.getDate())}/${p2(d.getMonth() + 1)}/${d.getFullYear()} ${p2(d.getHours())}:${p2(d.getMinutes())}` }
export const vndOf = (micro, rate) => Math.round(((Number(micro) || 0) / 1e6) * (Number(rate) || 26000))
export const dong = (n) => (Number(n) || 0).toLocaleString('vi-VN') + 'đ'
const usd = (micro) => '$' + ((Number(micro) || 0) / 1e6).toFixed((Number(micro) || 0) < 1e5 ? 4 : 2)
const tok = (n) => (Number(n) || 0).toLocaleString('vi-VN')

function Head({ desk, children }) {
  if (!desk) return null
  return (
    <div className="dk-ph">
      <div><h1>Chi phí AI</h1><p>Tiền AI thật (theo số token Anthropic tính), ngân hàng câu hỏi, giới hạn và thử model. Chỉ super admin.</p></div>
      {children ? <div className="dk-acts">{children}</div> : null}
    </div>
  )
}

/* ---------- 📅 Báo cáo ngày ---------- */
const dmyy = (d) => (d ? `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}` : '')
const shiftDay = (d, k) => new Date(Date.parse(d + 'T12:00:00Z') + k * 86400000).toISOString().slice(0, 10)
const WD = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7']
const nf = (n) => (Math.round((Number(n) || 0) * 10) / 10).toLocaleString('vi-VN')
const usd2 = (micro) => { const u = (Number(micro) || 0) / 1e6; return u > 0 && u < 0.005 ? '<0,01 USD' : u.toFixed(2).replace('.', ',') + ' USD' }
const pctOf = (a, b) => (b ? Math.round((100 * a) / b) : 0)
const MAIL_WHY = {
  no_email: 'Chưa gửi thư được: chưa có email quản trị — vào /quan-tri → ⚙️ Cài đặt để nhập email nhận thư.',
  mail_off: 'Chưa gửi thư được: máy chủ chưa cài Gmail gửi thư của app (MAIL_USER, MAIL_APP_PASSWORD trên Vercel).',
  off: 'Email báo cáo ngày đang TẮT (bật lại ở ⚙️ Cài đặt của mục này).',
}
export const SEND_MSG = (r) => (r.ok && r.sent ? `Đã gửi thư báo cáo tới ${r.sent} email ✓` : r.skipped ? 'Lỗi: ' + (MAIL_WHY[r.skipped] || r.skipped) : 'Lỗi: gửi thư không được (' + (r.error || 'lỗi') + ').')
function Trend({ cur, base, money, rate }) {
  const a = money ? vndOf(cur, rate) : cur, b = money ? vndOf(base, rate) : base
  const d = Math.round((a - b) * 10) / 10
  if (!d) return <span className="rp-tr eq">= bằng</span>
  const p = b ? Math.round((100 * Math.abs(d)) / b) : null
  const tail = p == null ? '' : d > 0 && p >= 1000 ? ` (gấp ${nf(a / b)} lần)` : ` (${p}%)`
  return <span className={'rp-tr ' + (d > 0 ? 'up' : 'down')}>{d > 0 ? '▲ tăng ' : '▼ giảm '}{money ? dong(Math.abs(d)) : nf(Math.abs(d))}{tail}</span>
}
function Report({ desk }) {
  const [day, setDay] = useState('')
  const [r, setR] = useState(null)
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const [today, setToday] = useState('')
  useEffect(() => { setR(null); adminCall('report_get', day ? { day } : {}).then((x) => { setR(x); if (x.ok && !today) setToday(x.today) }) }, [day]) // eslint-disable-line react-hooks/exhaustive-deps
  async function sendNow() { setBusy(true); setMsg(''); const x = await adminCall('report_send'); setBusy(false); setMsg(SEND_MSG(x)) }
  const opts = today ? Array.from({ length: 30 }, (_, i) => { const d = shiftDay(today, -i); const w = WD[new Date(d + 'T12:00:00Z').getUTCDay()]; return { value: d, label: (i === 0 ? 'Hôm nay · ' : i === 1 ? 'Hôm qua · ' : w + ' · ') + dmyy(d) } }) : []
  const picker = opts.length ? <SelectPicker btnClass="auth-in" value={r && r.ok ? r.day : day || today} options={opts} onChange={setDay} ariaLabel="Chọn ngày" /> : null
  const bar = (
    <div className="rp-bar">
      <div className="rp-pick" data-testid="rp-day">{picker}</div>
      <button className="ghost small" data-testid="rp-send" onClick={sendNow} disabled={busy}>{busy ? 'Đang gửi…' : '📧 Gửi thử ngay'}</button>
    </div>
  )
  if (!r) return <div className="rp">{bar}<p className="adm-muted">Đang tải…</p></div>
  if (!r.ok) return <div className="rp">{bar}<div className="err">Lỗi: {r.error}</div></div>
  const rate = r.rate, s = r.study, q = r.q, a = r.ai, c = r.cmp
  const when = r.day === r.today ? 'Hôm nay' : 'Ngày ' + dmyy(r.day)
  const card = (cls, children, testid) => <section className={(desk ? 'dk-card dk-box ' : 'adm-card wide ') + cls} data-testid={testid}>{children}</section>
  const kpis = [['families', 'Gia đình', s.families], ['kids', 'Con đã học', s.kids], ['sessions', 'Lượt ôn', s.sessions], ['reviewed', 'Câu đã làm', s.reviewed], ['pct', 'Đúng', s.pct + '%'], ['min', 'Thời gian', s.min + ' phút']]
  const mailWhy = MAIL_WHY[r.mail.reason]
  const last = r.mail.last
  const CMP = [['kids', 'Con đã học'], ['reviewed', 'Câu đã làm'], ['min', 'Phút học'], ['pct', 'Đúng (%)'], ['sessions', 'Lượt ôn'], ['asked', 'Câu đưa cho con'], ['usd', 'Tiền AI']]
  return (
    <div className="rp" data-testid="rp">
      {bar}
      {msg && <div className={/Lỗi/.test(msg) ? 'err' : 'ok-msg'} data-testid="rp-msg">{msg}</div>}
      <p className="rp-sum" data-testid="rp-summary">{when} {s.kids} con học {s.min} phút, làm {nf(s.reviewed)} câu (đúng {s.pct}%). ONTAP tốn {dong(vndOf(a.usd, rate))} ({usd2(a.usd)}).</p>
      <p className={'adm-muted rp-mail' + (mailWhy ? ' warn' : '')} data-testid="rp-mail">
        {mailWhy || `📧 Thư báo cáo tự gửi mỗi tối khoảng 21–22 giờ tới ${r.mail.emails} email quản trị.`}
        {last ? ` Lần gửi gần nhất: ${fmt(last.at)}${last.test ? ' (gửi thử)' : ''} — ${last.sent ? 'đã gửi ' + last.sent + ' thư' : 'lỗi'}.` : ''}
      </p>
      <div className={desk ? 'dk-kpis rp-kpis' : 'adm-grid rp-kpis'}>
        {kpis.map(([k, l, v]) => (
          <div key={k} className={desk ? 'dk-card dk-kpi' : 'adm-card'} data-testid="rp-kpi" data-k={k}>
            {desk ? <><span className="k">{l}</span><span className="v">{typeof v === 'number' ? nf(v) : v}</span></> : <><span>{l}</span><b>{typeof v === 'number' ? nf(v) : v}</b></>}
          </div>
        ))}
      </div>
      <div className={desk ? 'aic-cols' : 'adm-main'}>
        <div className={desk ? 'aic-side' : 'adm-main'}>
          {card('rp-subj', <>
            <h3 className="adm-h">Học theo môn</h3>
            {!s.bySubject.length ? <p className="adm-muted">Ngày này chưa con nào học.</p> : (
              <div className="dk-tscroll"><table className="adm-table aic-table" data-testid="rp-subj"><thead><tr><th>Môn</th><th>Câu</th><th>Đúng</th><th>Phút</th><th>Con</th></tr></thead><tbody>
                {s.bySubject.map((t) => <tr key={t.subject} data-subj={t.subject}><td>{t.subject}</td><td className="n">{nf(t.reviewed)}</td><td className="n">{t.pct}%</td><td className="n">{t.min}</td><td className="n">{t.kids}</td></tr>)}
              </tbody></table></div>
            )}
          </>)}
          {card('rp-cmpcard', <>
            <h3 className="adm-h">So với hôm qua và trung bình 7 ngày trước</h3>
            <div className="dk-tscroll"><table className="adm-table aic-table rp-cmp" data-testid="rp-cmp"><thead><tr><th></th><th>{r.day === r.today ? 'Hôm nay' : dmy(r.day)}</th><th>Hôm qua</th><th>TB 7 ngày</th></tr></thead><tbody>
              {CMP.map(([k, l]) => (
                <tr key={k} data-k={k}><td>{l}</td>
                  <td className="n">{k === 'usd' ? dong(vndOf(c.cur[k], rate)) : nf(c.cur[k])}</td>
                  <td className="n">{k === 'usd' ? dong(vndOf(c.yday[k], rate)) : nf(c.yday[k])}<Trend cur={c.cur[k]} base={c.yday[k]} money={k === 'usd'} rate={rate} /></td>
                  <td className="n">{k === 'usd' ? dong(vndOf(c.avg7[k], rate)) : nf(c.avg7[k])}<Trend cur={c.cur[k]} base={c.avg7[k]} money={k === 'usd'} rate={rate} /></td>
                </tr>
              ))}
            </tbody></table></div>
          </>)}
        </div>
        <div className={desk ? 'aic-side' : 'adm-main'}>
          {card('rp-qcard', <>
            <h3 className="adm-h">Câu hỏi</h3>
            <ul className="rp-list" data-testid="rp-q">
              <li>Câu đưa cho con: <b>{nf(q.asked)}</b> = từ ngân hàng <b>{nf(q.bank_used)}</b> ({pctOf(q.bank_used, q.asked)}%) + mới soạn <b>{nf(q.fresh_used)}</b> ({pctOf(q.fresh_used, q.asked)}%)</li>
              <li>ONTAP soạn mới <b>{nf(q.new_q)}</b> câu ({nf(q.spare)} câu để dành cho lần sau)</li>
              <li>Ngân hàng hiện có <b>{nf(q.bankNow.questions)}</b> câu, <b>{nf(q.bankNow.concepts)}</b> khái niệm</li>
            </ul>
          </>)}
          {card('rp-aicard', <>
            <h3 className="adm-h">AI (ONTAP)</h3>
            <ul className="rp-list" data-testid="rp-ai">
              <li>Tiền: <b>{dong(vndOf(a.usd, rate))}</b> ({usd2(a.usd)}) · {nf(a.calls)} lời gọi</li>
              <li>Token: vào <b>{tok(a.in)}</b>, ra <b>{tok(a.out)}</b></li>
              <li>Trung bình: {dong(vndOf(a.perSession, rate))} / lượt ôn · {dong(vndOf(a.perKid, rate))} / con</li>
            </ul>
            {a.kinds.length ? <table className="adm-table aic-table" data-testid="rp-kinds"><tbody>
              {a.kinds.map((k) => <tr key={k.kind} data-kind={k.kind}><td>{KIND_L[k.kind] || k.kind}</td><td className="n">{dong(vndOf(k.usd, rate))}</td><td className="n">{k.n} lời gọi</td></tr>)}
            </tbody></table> : null}
          </>)}
        </div>
      </div>
      {card('rp-fams', <>
        <h3 className="adm-h">Từng gia đình ({r.families.length})</h3>
        {!r.families.length ? <p className="adm-muted">Chưa có gia đình nào học.</p> : (
          <div className="dk-tscroll"><table className="adm-table aic-table rp-ftable" data-testid="rp-fam"><thead><tr><th>Phụ huynh</th><th>Các con đã học</th><th>Câu</th><th>Phút</th><th>Lượt ôn</th><th>Ngân hàng / mới</th><th>Tiền</th></tr></thead><tbody>
            {r.families.map((f) => (
              <tr key={f.phone + f.name} data-phone={f.phone}>
                <td><b>{f.name || '(chưa ghi tên)'}</b><small>{f.phone}</small></td>
                <td className="rp-kids">{f.kids.map((k) => k.name).join(', ') || '—'}</td>
                <td className="n">{nf(f.reviewed)}</td><td className="n">{Math.round(f.sec / 60)}</td><td className="n">{f.sessions}</td>
                <td className="n">{f.bank_used} / {f.fresh_used}</td><td className="n">{dong(vndOf(f.usd, rate))}</td>
              </tr>
            ))}
          </tbody></table></div>
        )}
      </>)}
      <p className="adm-muted aic-note">Ngày theo giờ Việt Nam. Câu đã làm / phút lấy từ nhật ký học của từng con (gộp các máy); số liệu câu hỏi bắt đầu đếm từ 27/11/2026.</p>
    </div>
  )
}

function Stats({ desk }) {
  const [d, setD] = useState(null)
  useEffect(() => { adminCall('ai_stats').then(setD) }, [])
  if (!d) return <p className="adm-muted">Đang tải…</p>
  if (!d.ok) return <div className="err">Lỗi: {d.error}</div>
  const rate = d.rate
  const sum = (n) => d.days.slice(0, n).reduce((s, x) => s + x.usd, 0)
  const tiles = [['Hôm nay', sum(1), 'aic-today'], ['7 ngày', sum(7), 'aic-7'], ['30 ngày', sum(30), 'aic-30']]
  const kinds = {}, models = {}
  for (const x of d.days) {
    for (const [k, v] of Object.entries(x.kinds)) { const r = kinds[k] || (kinds[k] = { usd: 0, n: 0 }); r.usd += v.usd; r.n += v.n }
    for (const [m, v] of Object.entries(x.models)) { const r = models[m] || (models[m] = { in: 0, out: 0 }); r.in += v.in; r.out += v.out }
  }
  const active = d.days.filter((x) => x.calls || x.bank_q || x.new_q || x.usd)
  const card = (cls, children, testid) => <section className={(desk ? 'dk-card dk-box ' : 'adm-card wide ') + cls} data-testid={testid}>{children}</section>
  return (
    <div className="aic-stats" data-testid="aic-stats">
      <div className={desk ? 'dk-kpis aic-kpis' : 'adm-grid'}>
        {tiles.map(([k, v, id]) => (
          <div key={id} className={desk ? 'dk-card dk-kpi' : 'adm-card'} data-testid={id}>
            {desk ? <><span className="k">{k}</span><span className="v">{dong(vndOf(v, rate))}</span><span className="s">{usd(v)}</span></>
              : <><span>{k}</span><b>{dong(vndOf(v, rate))}</b><em>{usd(v)}</em></>}
          </div>
        ))}
      </div>
      <p className="adm-muted aic-note">Anthropic Console tính ngày theo giờ UTC; muốn so thì so phần tăng trong cùng một khoảng thời gian. Tỷ giá: {dong(rate)} / USD.</p>
      <div className={desk ? 'aic-cols' : 'adm-main'}>
        {card('aic-days', <>
          <h3 className="adm-h">30 ngày gần nhất</h3>
          {!active.length ? <p className="adm-muted">Chưa có số liệu.</p> : (
            <div className="dk-tscroll"><table className="adm-table aic-table" data-testid="aic-days">
              <thead><tr><th>Ngày</th><th>Tiền</th><th>Lời gọi</th><th>Lượt soạn mới</th><th>Câu từ ngân hàng</th><th>Câu soạn mới</th></tr></thead>
              <tbody>{active.map((x) => (
                <tr key={x.day} data-day={x.day}><td>{dmy(x.day)}</td><td className="n">{dong(vndOf(x.usd, rate))}<small>{usd(x.usd)}</small></td><td className="n">{x.calls}</td><td className="n">{x.gen_runs}</td><td className="n">{x.bank_q}</td><td className="n">{x.new_q}</td></tr>
              ))}</tbody>
            </table></div>
          )}
        </>, 'aic-days-card')}
        <div className={desk ? 'aic-side' : 'adm-main'}>
          {card('aic-kinds', <>
            <h3 className="adm-h">Theo loại việc (30 ngày)</h3>
            {!Object.keys(kinds).length ? <p className="adm-muted">Chưa có.</p> : (
              <table className="adm-table aic-table" data-testid="aic-kinds"><tbody>
                {Object.entries(kinds).sort((a, b) => b[1].usd - a[1].usd).map(([k, v]) => <tr key={k} data-kind={k}><td>{KIND_L[k] || k}</td><td className="n">{dong(vndOf(v.usd, rate))}</td><td className="n">{v.n} lời gọi</td></tr>)}
              </tbody></table>
            )}
          </>)}
          {card('aic-models', <>
            <h3 className="adm-h">Token theo model (30 ngày)</h3>
            {!Object.keys(models).length ? <p className="adm-muted">Chưa có.</p> : (
              <table className="adm-table aic-table" data-testid="aic-models"><thead><tr><th>Model</th><th>Vào</th><th>Ra</th></tr></thead><tbody>
                {Object.entries(models).map(([m, v]) => <tr key={m} data-model={m}><td>{m}</td><td className="n">{tok(v.in)}</td><td className="n">{tok(v.out)}</td></tr>)}
              </tbody></table>
            )}
          </>)}
          {card('aic-top', <>
            <h3 className="adm-h">10 tài khoản tốn nhất tháng {d.month.slice(5)}/{d.month.slice(0, 4)}</h3>
            {!d.top.length ? <p className="adm-muted">Chưa có.</p> : (
              <table className="adm-table aic-table" data-testid="aic-top"><tbody>
                {d.top.map((t) => <tr key={t.phone} data-phone={t.phone}><td><b>{t.name || '(chưa ghi tên)'}</b><small>{t.phone} · {t.kids} con</small></td><td className="n">{dong(vndOf(t.usd, rate))}</td></tr>)}
              </tbody></table>
            )}
          </>)}
        </div>
      </div>
    </div>
  )
}

function Cfg({ desk }) {
  const [c, setC] = useState(null)
  const [msg, setMsg] = useState('')
  const [groups, setGroups] = useState([])
  useEffect(() => { adminCall('ai_cfg_get').then((r) => { if (r.ok) { setC(r.cfg); setGroups(r.groups) } else setMsg('Lỗi: ' + r.error) }) }, [])
  if (!c) return msg ? <div className="err">{msg}</div> : <p className="adm-muted">Đang tải…</p>
  const num = (k, v) => setC({ ...c, [k]: String(v).replace(/\D+/g, '') })
  async function save() {
    const r = await adminCall('ai_cfg_set', { models: c.models, genLimit: c.genLimit, capVnd: c.capVnd, rate: c.rate, reportOn: c.reportOn })
    if (r.ok) { setC(r.cfg); setMsg('Đã lưu ✓ Áp dụng cho lượt ôn kế tiếp (máy chủ nhớ cài đặt tối đa 1 phút).') } else setMsg(r.error === 'bad_value' ? 'Lỗi: số chưa hợp lệ (' + r.field + ').' : 'Lỗi: ' + r.error)
  }
  return (
    <div className={(desk ? 'dk-card dk-pad aic-cfg' : 'aic-cfg') + ' adm-form'} data-testid="aic-cfg">
      <b>🤖 Model cho từng việc</b>
      <p className="adm-muted">Chính xác (Sonnet) là mặc định. Tiết kiệm (Haiku) rẻ khoảng 20 lần — nên “Thử model” trước khi bật. Dùng model mới nhất có trong tài khoản Anthropic.</p>
      <div className="aic-models">
        {groups.map((g) => (
          <label key={g} className="aic-mrow" data-group={g}>
            <span>{GROUP_L[g] || g}</span>
            <SelectPicker btnClass="auth-in" value={c.models[g]} options={TIER_OPTS} onChange={(v) => setC({ ...c, models: { ...c.models, [g]: v } })} ariaLabel={'Model ' + (GROUP_L[g] || g)} />
          </label>
        ))}
      </div>
      <b>⏱️ Giới hạn</b>
      <label className="auth-lbl" htmlFor="aic-lim">Số lượt PHẢI SOẠN MỚI mỗi con mỗi ngày (0 = không giới hạn; lượt lấy đủ câu từ ngân hàng không tính)</label>
      <input id="aic-lim" className="auth-in" inputMode="numeric" value={c.genLimit} onChange={(e) => num('genLimit', e.target.value)} />
      <label className="auth-lbl" htmlFor="aic-cap">Trần tiền AI mỗi ngày cho mỗi con (đồng; tài khoản = số này × số con, 0 = không có trần)</label>
      <input id="aic-cap" className="auth-in" inputMode="numeric" value={c.capVnd} onChange={(e) => num('capVnd', e.target.value)} />
      <label className="auth-lbl" htmlFor="aic-rate">Tỷ giá (đồng / USD)</label>
      <input id="aic-rate" className="auth-in" inputMode="numeric" value={c.rate} onChange={(e) => num('rate', e.target.value)} />
      <b>📅 Email báo cáo ngày</b>
      <label className="rp-on" data-testid="aic-report-on">
        <input type="checkbox" checked={c.reportOn !== false} onChange={(e) => setC({ ...c, reportOn: e.target.checked })} />
        <span>Tự gửi email báo cáo mỗi tối (gửi khoảng 21–22 giờ, giờ Việt Nam) tới email quản trị ở ⚙️ Cài đặt</span>
      </label>
      <button type="button" className="ghost small" data-testid="aic-report-send" onClick={async () => { setMsg('Đang gửi…'); setMsg(SEND_MSG(await adminCall('report_send'))) }}>📧 Gửi thử ngay</button>
      <button className="cta small" onClick={save}>Lưu cài đặt</button>
      {msg && <div className={/Lỗi/.test(msg) ? 'err' : 'ok-msg'}>{msg}</div>}
      {c.updated ? <p className="adm-muted">Sửa lần cuối {fmt(c.updated)}</p> : null}
    </div>
  )
}

function Bank({ desk }) {
  const [f, setF] = useState({ q: '', subject: '', grade: 'all' })
  const [d, setD] = useState(null)
  const [open, setOpen] = useState(null)   // { key, items, meta }
  const [ask, setAsk] = useState(false)
  const [msg, setMsg] = useState('')
  const load = (ff = f) => adminCall('ai_bank_list', { q: ff.q, subject: ff.subject, grade: ff.grade === 'all' ? '' : ff.grade }).then(setD)
  useEffect(() => { load() }, []) // eslint-disable-line react-hooks/exhaustive-deps
  async function view(key) { setAsk(false); setMsg(''); const r = await adminCall('ai_bank_get', { key }); setOpen(r.ok ? r : null) }
  async function del() {
    const r = await adminCall('ai_bank_del', { key: open.key })
    setAsk(false)
    if (r.ok) { setMsg('Đã xoá ngân hàng ✓ Lần ôn sau ONTAP soạn lại câu mới cho khái niệm này.'); setOpen(null); load() } else setMsg('Lỗi: ' + r.error)
  }
  const detail = open && (
    <div className={desk ? 'dk-card dk-pad aic-bank-detail' : 'adm-card wide aic-bank-detail'} data-testid="aic-bank-detail">
      <div className="adm-row"><b>{open.meta.concept || open.key}</b><button className="linkbtn" onClick={() => setOpen(null)}>Đóng</button></div>
      <p className="adm-muted">{open.meta.subject} · {open.meta.grade || 'chưa rõ lớp'} · {open.meta.format === 'open' ? 'Tự điền' : 'Trắc nghiệm'}{open.meta.master ? ' · Nâng cao' : ''} · {open.items.length} câu · {open.meta.uses || 0} lượt dùng</p>
      <ol className="aic-qs">
        {open.items.map((q) => (
          <li key={q.id} data-qid={q.id}>
            <div className="aic-q">{q.q}</div>
            {q.options ? <ul className="aic-opts">{q.options.map((o, i) => <li key={i} className={o === q.answer ? 'ok' : ''}>{o === q.answer ? '✓ ' : ''}{o}</li>)}</ul> : <div className="aic-ans">Đáp án: <b>{q.answer}</b></div>}
            <div className="adm-muted">💡 {q.explain}</div>
            <div className="adm-muted aic-small">Soạn bởi {q.model || '?'} · {fmt(q.at)}</div>
          </li>
        ))}
      </ol>
      {!ask ? <button className="cta small ghost aic-del" onClick={() => setAsk(true)}>🗑️ Xoá ngân hàng này</button> : (
        <div className="adm-pend" data-testid="aic-del-ask">
          Xoá hết {open.items.length} câu của “{open.meta.concept}”? Lần ôn sau ONTAP sẽ soạn lại (tốn tiền AI).
          <div className="modal-btns"><button className="cta small ghost" onClick={() => setAsk(false)}>Thôi</button><button className="cta small" onClick={del}>Xoá</button></div>
        </div>
      )}
    </div>
  )
  return (
    <div className="aic-bank" data-testid="aic-bank">
      <form className={'adm-search aic-filter' + (desk ? ' dk-card dk-pad' : '')} onSubmit={(e) => { e.preventDefault(); load() }}>
        <input className="auth-in" placeholder="Tên khái niệm" value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} aria-label="Tìm theo tên khái niệm" />
        <input className="auth-in" placeholder="Môn" value={f.subject} onChange={(e) => setF({ ...f, subject: e.target.value })} aria-label="Tìm theo môn" />
        <SelectPicker btnClass="auth-in" value={f.grade} options={[{ value: 'all', label: 'Mọi lớp' }, ...GRADES]} onChange={(v) => { const ff = { ...f, grade: v }; setF(ff); load(ff) }} ariaLabel="Lọc theo lớp" />
        <button className="cta small">Tìm</button>
      </form>
      {msg && <div className={/Lỗi/.test(msg) ? 'err' : 'ok-msg'}>{msg}</div>}
      {!d ? <p className="adm-muted">Đang tải…</p> : !d.ok ? <div className="err">Lỗi: {d.error}</div> : (
        <>
          <div className={desk ? 'dk-kpis aic-kpis3' : 'adm-grid'} data-testid="aic-bank-total">
            {[['Khái niệm', d.total.concepts], ['Câu hỏi', d.total.questions], ['Lượt dùng', d.total.uses]].map(([k, v]) => (
              <div key={k} className={desk ? 'dk-card dk-kpi' : 'adm-card'}>{desk ? <><span className="k">{k}</span><span className="v">{v}</span></> : <><span>{k}</span><b>{v}</b></>}</div>
            ))}
          </div>
          {desk && open ? detail : null}
          {!d.list.length ? <p className="adm-muted">Chưa có ngân hàng nào{f.q || f.subject || f.grade !== 'all' ? ' khớp' : ''}.</p> : desk ? (
            <section className="dk-card dk-tablecard"><div className="dk-tscroll"><table className="dk-table" data-testid="aic-bank-list">
              <thead><tr><th>Khái niệm</th><th>Môn</th><th>Lớp</th><th>Dạng</th><th>Số câu</th><th>Lượt dùng</th><th>Dùng gần nhất</th></tr></thead>
              <tbody>{d.list.map((r) => (
                <tr key={r.key} data-bank={r.key} className={'adm-user' + (open && open.key === r.key ? ' on' : '')} onClick={() => view(r.key)}>
                  <td><b>{r.concept}</b>{r.master ? <span className="adm-tag">Nâng cao</span> : null}</td><td>{r.subject}</td><td>{r.grade || '—'}</td><td>{r.format === 'open' ? 'Tự điền' : 'Trắc nghiệm'}</td><td className="n">{r.n}</td><td className="n">{r.uses || 0}</td><td className="n">{fmt(r.last)}</td>
                </tr>
              ))}</tbody>
            </table></div></section>
          ) : (
            <ul className="adm-list" data-testid="aic-bank-list">
              {d.list.map((r) => (
                <li key={r.key} data-bank={r.key} className="adm-user" onClick={() => (open && open.key === r.key ? setOpen(null) : view(r.key))}>
                  <div className="adm-row"><b>{r.concept}</b><span className="adm-tag">{r.n} câu</span></div>
                  <div className="adm-muted">{r.subject} · {r.grade || '—'} · {r.format === 'open' ? 'Tự điền' : 'Trắc nghiệm'}{r.master ? ' · Nâng cao' : ''} · {r.uses || 0} lượt dùng · {fmt(r.last)}</div>
                  {open && open.key === r.key ? <div onClick={(e) => e.stopPropagation()}>{detail}</div> : null}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  )
}

function TryCol({ r, rate, wrong, toggle, tier }) {
  if (!r) return null
  return (
    <div className="aic-col" data-testid={'aic-try-' + tier}>
      <div className="aic-col-h">
        <b>{TIER_L[tier]}</b><span className="adm-muted">{r.model || '—'}</span>
        <div className="aic-col-m"><span>{r.questions.length} câu</span><span data-testid={'aic-try-cost-' + tier}>{dong(r.vnd)}</span><span>{tok(r.inTok)} vào · {tok(r.outTok)} ra</span><span>{r.sec} giây</span><span>{wrong.size} câu sai</span></div>
        {r.error ? <div className="err">Lỗi khi soạn: {r.error}</div> : null}
      </div>
      <ol className="aic-qs">
        {r.questions.map((q, i) => (
          <li key={i} className={wrong.has(i) ? 'bad' : ''} data-qi={i}>
            <div className="aic-q">{q.q}{!q.ok ? <span className="dk-pill red">sai quy cách</span> : null}</div>
            {q.options ? <ul className="aic-opts">{q.options.map((o, j) => <li key={j} className={o === q.answer ? 'ok' : ''}>{o === q.answer ? '✓ ' : ''}{o}</li>)}</ul> : <div className="aic-ans">Đáp án: <b>{q.answer}</b></div>}
            <div className="adm-muted">💡 {q.explain}</div>
            <button type="button" className={'chip aic-wrong' + (wrong.has(i) ? ' on' : '')} aria-pressed={wrong.has(i)} onClick={() => toggle(i)}>{wrong.has(i) ? '✗ Sai' : 'Sai'}</button>
          </li>
        ))}
      </ol>
    </div>
  )
}

function Try({ desk }) {
  const [f, setF] = useState({ subject: 'Toán', grade: 'Lớp 4', topic: '', concepts: '', format: 'choice', count: '10' })
  const [busy, setBusy] = useState(false)
  const [res, setRes] = useState(null)
  const [wrong, setWrong] = useState({ sonnet: new Set(), haiku: new Set() })
  const [tab, setTab] = useState('sonnet')
  const [msg, setMsg] = useState('')
  const [sum, setSum] = useState(null)
  const [saved, setSaved] = useState(false)
  useEffect(() => { adminCall('ai_stats').then((r) => { if (r.ok) setSum(r.tries) }) }, [])
  async function run(e) {
    e.preventDefault(); setMsg(''); setBusy(true); setRes(null); setSaved(false)
    const r = await adminCall('ai_try', { ...f, count: Math.min(20, Math.max(1, Number(f.count) || 10)) })
    setBusy(false)
    if (!r.ok) { setMsg(r.error === 'no_concepts' ? 'Gõ ít nhất 1 khái niệm.' : 'Lỗi: ' + r.error); return }
    setRes(r); setWrong({ sonnet: new Set(), haiku: new Set() }); setTab('sonnet')
  }
  const toggle = (tier) => (i) => { const s = new Set(wrong[tier]); if (s.has(i)) s.delete(i); else s.add(i); setWrong({ ...wrong, [tier]: s }); setSaved(false) }
  async function save() {
    const rows = ['sonnet', 'haiku'].map((t) => ({ tier: t, model: res[t].model, n: res[t].questions.length, wrong: wrong[t].size, usd: res[t].usd }))
    const r = await adminCall('ai_try_save', { subject: res.input.subject, grade: res.input.grade, topic: res.input.topic, rows })
    if (r.ok) { setSum(r.tries); setSaved(true); setMsg('Đã lưu đánh giá ✓') } else setMsg('Lỗi: ' + r.error)
  }
  const rate = res ? res.rate : 26000
  return (
    <div className="aic-try" data-testid="aic-try">
      <form className={(desk ? 'dk-card dk-pad ' : '') + 'adm-form aic-tryform'} onSubmit={run}>
        <div className="aic-row2">
          <label><span className="auth-lbl">Môn</span><SelectPicker btnClass="auth-in" value={f.subject} options={SUBJECTS} onChange={(v) => setF({ ...f, subject: v })} ariaLabel="Môn thử" /></label>
          <label><span className="auth-lbl">Lớp</span><SelectPicker btnClass="auth-in" value={f.grade} options={GRADES} onChange={(v) => setF({ ...f, grade: v })} ariaLabel="Lớp thử" /></label>
          <label><span className="auth-lbl">Dạng</span><SelectPicker btnClass="auth-in" value={f.format} options={[{ value: 'choice', label: 'Trắc nghiệm' }, { value: 'open', label: 'Tự điền' }]} onChange={(v) => setF({ ...f, format: v })} ariaLabel="Dạng câu thử" /></label>
          <label><span className="auth-lbl">Số câu (tối đa 20)</span><input className="auth-in" inputMode="numeric" value={f.count} onChange={(e) => setF({ ...f, count: e.target.value.replace(/\D+/g, '').slice(0, 2) })} aria-label="Số câu thử" /></label>
        </div>
        <label className="auth-lbl" htmlFor="aic-topic">Chủ đề</label>
        <input id="aic-topic" className="auth-in" placeholder="vd Phân số" value={f.topic} onChange={(e) => setF({ ...f, topic: e.target.value })} />
        <label className="auth-lbl" htmlFor="aic-concepts">Khái niệm (1–3, cách nhau dấu phẩy)</label>
        <input id="aic-concepts" className="auth-in" placeholder="vd Rút gọn phân số, So sánh phân số" value={f.concepts} onChange={(e) => setF({ ...f, concepts: e.target.value })} />
        <button className="cta small" disabled={busy || !f.concepts.trim()}>{busy ? 'ONTAP đang soạn bằng cả hai model…' : '🧪 Thử'}</button>
        <p className="adm-muted">Soạn cùng lúc bằng Sonnet và Haiku, cùng đầu vào (có đoạn sách như lúc thật). Không lưu vào ngân hàng câu, không tính vào trần tiền của tài khoản nào.</p>
      </form>
      {msg && <div className={/Lỗi|Gõ/.test(msg) ? 'err' : 'ok-msg'}>{msg}</div>}
      {res && (
        <>
          <p className="adm-muted">{res.input.subject} · {res.input.grade} · “{res.input.topic}” · {res.book ? 'có đoạn sách' : 'không có đoạn sách khớp'}. Bấm “Sai” ở câu sai rồi “Lưu đánh giá”.</p>
          {!desk && (
            <div className="chips aic-tabs">
              {['sonnet', 'haiku'].map((t) => <button key={t} type="button" className={'chip' + (tab === t ? ' on' : '')} onClick={() => setTab(t)}>{TIER_L[t]} · {dong(res[t].vnd)}</button>)}
            </div>
          )}
          <div className={desk ? 'aic-two' : ''}>
            {(desk ? ['sonnet', 'haiku'] : [tab]).map((t) => <div key={t} className={desk ? 'dk-card dk-pad' : 'adm-card wide'}><TryCol r={res[t]} rate={rate} tier={t} wrong={wrong[t]} toggle={toggle(t)} /></div>)}
          </div>
          <button className="cta small" data-testid="aic-try-save" onClick={save} disabled={saved}>{saved ? '✓ Đã lưu đánh giá' : '💾 Lưu đánh giá'}</button>
        </>
      )}
      <section className={desk ? 'dk-card dk-pad' : 'adm-card wide'} data-testid="aic-try-sum">
        <h3 className="adm-h">Tổng kết các lần thử (môn × model)</h3>
        {!sum || !sum.rows.length ? <p className="adm-muted">Chưa có đánh giá nào.</p> : (
          <div className="dk-tscroll"><table className="adm-table aic-table">
            <thead><tr><th>Môn</th><th>Model</th><th>Lần thử</th><th>Tổng câu</th><th>Câu sai</th><th>Tỷ lệ sai</th><th>Tiền TB / 10 câu</th></tr></thead>
            <tbody>{sum.rows.map((r) => (
              <tr key={r.group + r.tier} data-row={r.group + '|' + r.tier}><td>{r.group}</td><td>{TIER_L[r.tier] || r.tier}</td><td className="n">{r.runs}</td><td className="n">{r.n}</td><td className="n">{r.wrong}</td><td className="n">{String(r.wrongPct).replace('.', ',')}%</td><td className="n">{dong(vndOf(r.usd10, rate))}</td></tr>
            ))}</tbody>
          </table></div>
        )}
      </section>
    </div>
  )
}

export default function AiCost({ desk = false }) {
  const [sub, setSub] = useState('report')
  return (
    <div data-testid="adm-aicost" className="aic">
      <Head desk={desk} />
      <div className="chips adm-chips aic-subs">
        {SUBS.map(([k, l]) => <button key={k} type="button" className={'chip' + (sub === k ? ' on' : '')} onClick={() => setSub(k)} aria-pressed={sub === k}>{l}</button>)}
      </div>
      {sub === 'report' && <Report desk={desk} />}
      {sub === 'stats' && <Stats desk={desk} />}
      {sub === 'cfg' && <Cfg desk={desk} />}
      {sub === 'bank' && <Bank desk={desk} />}
      {sub === 'try' && <Try desk={desk} />}
    </div>
  )
}
