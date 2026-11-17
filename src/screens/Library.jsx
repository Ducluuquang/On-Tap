// THƯ VIỆN SÁCH (DÙNG CHUNG) — mục "📚 Thư viện sách" của trang quản trị /quan-tri (17/11/2026; trước đó nằm trong Cài đặt).
// Nạp sách PDF (ảnh chụp trang) -> trình duyệt vẽ + cắt đôi từng trang -> gửi máy chủ theo nhóm nhỏ -> AI chép chữ (Message
// Batches). Gửi ảnh xong đóng trang được; mở lại là thấy tiến độ. Nửa trang lỗi / bị cắt: app tự gửi lại khi còn
// giữ file, không thì hiện nút "Chọn lại file" để gửi phần còn thiếu.
import { useEffect, useRef, useState } from 'react'
import { SelectPicker } from '../components.jsx'
import { booksCall, guessFromFilename, costText, KIND_LABEL, KIND_SHORT, BOOK_SUBJECTS } from '../lib/books.js'

const GROUP_B64 = 3300000   // mỗi lần gửi < ~3,3 MB ảnh (base64) -> yêu cầu < 4 MB (Vercel giới hạn 4,5 MB)
const GROUP_ITEMS = 16
const pollMs = () => (typeof window !== 'undefined' && Number(window.__ontapBookPollMs)) || 30000   // hỏi tiến độ mỗi 30 giây (phép thử đặt ngắn hơn)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const ERR = {
  network: 'Mất mạng. Kiểm tra mạng rồi bấm "Gửi tiếp".',
  no_ai: 'Máy chủ chưa có khoá AI nên chưa đọc được sách.',
  not_admin: 'Tài khoản này không phải quản trị nên không nạp / xoá sách được.',
  bad_token: 'Cần đăng nhập lại để nạp sách.',
  too_large: 'Nhóm ảnh quá lớn.',
  img_too_big: 'Ảnh trang quá lớn.',
  not_jpeg: 'Ảnh trang không đúng dạng.',
  busy: 'Máy chủ đang bận với cuốn này. Thử lại sau ít phút.',
  store_limit: 'Kho dữ liệu đã hết lượt miễn phí của tháng.',
  ai_error: 'AI chưa nhận ảnh (lỗi tạm thời). Bấm "Gửi tiếp" để thử lại.',
  bad_info: 'Điền đủ lớp, môn, loại sách và tên sách.',
  bad_pages: 'Số trang không hợp lệ.',
  too_many: 'Thư viện đã đầy.',
  no_book: 'Không tìm thấy sách này (có thể đã bị xoá).',
}
const errText = (e) => ERR[e] || 'Có lỗi (' + (e || 'không rõ') + '). Thử lại sau ít phút.'

function pagesOf(cids) {
  const m = new Map()
  for (const c of cids) {
    const x = /^p(\d+)h([12])$/.exec(c)
    if (!x) continue
    const p = Number(x[1])
    if (!m.has(p)) m.set(p, [])
    m.get(p).push(Number(x[2]))
  }
  return [...m.entries()].sort((a, b) => a[0] - b[0])
}

export default function Library({ initial = [] }) {
  const [books, setBooks] = useState(initial)
  const [form, setForm] = useState(null)        // { file, doc, pages, grade, subject, kind, title, err }
  const [work, setWork] = useState(null)        // { id, done, total, text } khi đang gửi ảnh
  const [msg, setMsg] = useState(null)          // { id?, ok, text }
  const [confirmDel, setConfirmDel] = useState(null)
  const docs = useRef(new Map())                // id sách -> file PDF đang mở (để tự gửi lại nửa trang lỗi)
  const busy = useRef(false)
  const alive = useRef(true)
  useEffect(() => () => { alive.current = false }, [])

  const putBook = (b) => setBooks((list) => {
    const i = list.findIndex((x) => x.id === b.id)
    if (i < 0) return [...list, b]
    const next = list.slice(); next[i] = b; return next
  })

  async function loadPdf(file) {
    const { openPdf } = await import('../lib/bookIngest.js')
    return openPdf(file)
  }

  async function pickNew(e) {
    const file = e.target.files && e.target.files[0]
    e.target.value = ''
    if (!file) return
    const g = guessFromFilename(file.name)
    setForm({ file, doc: null, pages: 0, grade: g.grade, subject: g.subject, kind: g.kind, title: g.title, err: '', loading: true })
    try {
      const doc = await loadPdf(file)
      setForm((f) => f && f.file === file ? { ...f, doc, pages: doc.numPages, loading: false } : f)
    } catch {
      setForm((f) => f && f.file === file ? { ...f, loading: false, err: 'Không mở được file này. Chọn file PDF khác.' } : f)
    }
  }

  // Gửi các nửa trang còn thiếu của một cuốn (cids) theo nhóm nhỏ.
  async function sendMissing(book, doc, cids) {
    if (busy.current || !cids.length) return
    busy.current = true
    setMsg(null)
    const { renderHalves } = await import('../lib/bookIngest.js')
    const list = pagesOf(cids)
    let group = [], size = 0, done = 0, last = book
    const flush = async () => {
      if (!group.length) return true
      for (let t = 0; t < 4; t++) {
        const r = await booksCall('upload', { id: book.id, items: group })
        if (r.ok) { last = r.book; if (alive.current) putBook(r.book); group = []; size = 0; return true }
        if (!['network', 'busy', 'ai_error'].includes(r.error) || t === 3) { if (alive.current) setMsg({ id: book.id, ok: false, text: errText(r.error) }); return false }
        await sleep(2000 * (t + 1))
      }
      return false
    }
    try {
      for (const [p, halves] of list) {
        if (!alive.current) break
        setWork({ id: book.id, done, total: list.length, text: `Đang gửi ảnh trang ${p} (${done + 1}/${list.length})…` })
        const items = await renderHalves(doc, p, halves)
        for (const it of items) {
          if (group.length && (size + it.b64.length > GROUP_B64 || group.length >= GROUP_ITEMS)) { if (!(await flush())) return }
          group.push({ page: it.page, half: it.half, b64: it.b64 }); size += it.b64.length
        }
        done++
      }
      if (!(await flush())) return
      if (alive.current) setMsg({ id: book.id, ok: true, text: 'Đã gửi ảnh xong ✓ AI đang đọc chữ (thường dưới 1 giờ). Anh có thể đóng trang; mở lại trang quản trị để xem tiến độ.' })
      return last
    } catch {
      if (alive.current) setMsg({ id: book.id, ok: false, text: 'Không vẽ được trang sách từ file này. Thử chọn lại file.' })
    } finally {
      busy.current = false
      if (alive.current) setWork(null)
    }
  }

  async function start() {
    const f = form
    if (!f || !f.doc) return
    if (!f.grade || !f.subject || !f.kind || !f.title.trim()) { setForm({ ...f, err: errText('bad_info') }); return }
    setForm({ ...f, err: '', starting: true })
    const r = await booksCall('create', { title: f.title.trim(), grade: f.grade, subject: f.subject, kind: f.kind, pages: f.pages, file: f.file.name })
    if (!r.ok) { setForm({ ...f, starting: false, err: errText(r.error) }); return }
    docs.current.set(r.book.id, f.doc)
    putBook(r.book)
    setForm(null)
    await sendMissing(r.book, f.doc, r.book.progress.missing)
  }

  // Chọn lại file cho cuốn đang đọc dở (đóng app giữa chừng / có nửa trang cần đọc lại)
  async function pickAgain(book, e) {
    const file = e.target.files && e.target.files[0]
    e.target.value = ''
    if (!file) return
    try {
      const doc = await loadPdf(file)
      if (doc.numPages !== book.pages) { setMsg({ id: book.id, ok: false, text: `File này có ${doc.numPages} trang, sách "${book.title}" cần đúng file ${book.pages} trang.` }); return }
      docs.current.set(book.id, doc)
      await sendMissing(book, doc, book.progress.missing)
    } catch { setMsg({ id: book.id, ok: false, text: 'Không mở được file này.' }) }
  }

  async function del(book) {
    setConfirmDel(null)
    const r = await booksCall('delete', { id: book.id })
    if (!r.ok) { setMsg({ id: book.id, ok: false, text: errText(r.error) }); return }
    docs.current.delete(book.id)
    setBooks((list) => list.filter((x) => x.id !== book.id))
  }

  // Hỏi tiến độ các cuốn đang đọc; còn giữ file thì tự gửi lại nửa trang lỗi / bị cắt.
  useEffect(() => {
    const reading = books.filter((b) => b.status === 'reading')
    if (!reading.length) return undefined
    const t = setInterval(async () => {
      if (busy.current) return
      for (const b of reading) {
        if (!(b.progress.inflight > 0)) continue
        const r = await booksCall('poll', { id: b.id })
        if (!alive.current) return
        if (r.ok && r.book) putBook(r.book)
      }
    }, pollMs())
    return () => clearInterval(t)
  }, [books])
  useEffect(() => {
    if (busy.current) return
    const b = books.find((x) => x.status === 'reading' && x.progress.inflight === 0 && x.progress.missing.length && docs.current.has(x.id))
    if (b) sendMissing(b, docs.current.get(b.id), b.progress.missing)
  }, [books]) // eslint-disable-line react-hooks/exhaustive-deps

  const gradeOpts = Array.from({ length: 12 }, (_, i) => ({ value: 'Lớp ' + (i + 1), label: 'Lớp ' + (i + 1) }))
  const subjOpts = BOOK_SUBJECTS.map((s) => ({ value: s, label: s }))
  const kindOpts = Object.entries(KIND_LABEL).map(([value, label]) => ({ value, label }))

  return (
    <section className="set-sec lib" data-testid="library">
      <h3>Thư viện sách (dùng chung)</h3>
      <p className="cr-hint">Chỉ quản trị thấy mục này. Sách chỉ để AI <b>tham khảo</b> khi soạn câu hỏi cho mọi tài khoản, đúng lớp + môn của con; con không thấy nguyên văn sách.</p>
      {!books.length && <p className="lib-empty">Chưa có sách nào.</p>}
      <ul className="lib-list">
        {books.map((b) => {
          const p = b.progress || { total: b.pages * 2, done: 0, failed: 0, inflight: 0, missing: [] }
          const pct = Math.round((100 * (p.done + p.failed)) / Math.max(1, p.total))
          const sending = work && work.id === b.id
          return (
            <li key={b.id} className="lib-book" data-book={b.id}>
              <div className="lib-top">
                <span className={'lib-kind k-' + b.kind}>{KIND_SHORT[b.kind]}</span>
                <b className="lib-title">{b.title}</b>
              </div>
              <div className="lib-sub">Lớp {b.grade} · {b.subject} · {b.pages} trang</div>
              {b.status === 'ready' ? (
                <div className="lib-st ok" data-st="ready">✓ Đã đọc xong{p.failed ? ` · ${p.failed} nửa trang không đọc được` : ''}</div>
              ) : (
                <>
                  <div className="lib-bar"><i style={{ width: pct + '%' }} /></div>
                  <div className="lib-st" data-st="reading">
                    {sending ? work.text
                      : p.inflight ? `AI đang đọc: xong ${p.done}/${p.total} nửa trang`
                        : p.missing.length ? `Còn ${p.missing.length} nửa trang cần gửi${p.done ? ` (đã xong ${p.done}/${p.total})` : ''}`
                          : `Đang hoàn tất (${p.done}/${p.total})`}
                  </div>
                  {!sending && !p.inflight && p.missing.length > 0 && !docs.current.has(b.id) && (
                    <label className="cta small ghost lib-again">
                      📄 Chọn lại file PDF để gửi tiếp
                      <input type="file" accept="application/pdf,.pdf" hidden onChange={(e) => pickAgain(b, e)} />
                    </label>
                  )}
                  {!sending && !p.inflight && p.missing.length > 0 && docs.current.has(b.id) && (
                    <button className="cta small ghost" onClick={() => sendMissing(b, docs.current.get(b.id), p.missing)}>Gửi tiếp</button>
                  )}
                </>
              )}
              {msg && msg.id === b.id && <div className={msg.ok ? 'ok-msg' : 'err'}>{msg.text}</div>}
              {confirmDel === b.id ? (
                <div className="modal-btns">
                  <button className="cta small ghost" onClick={() => setConfirmDel(null)}>Huỷ</button>
                  <button className="cta small danger" onClick={() => del(b)}>Xoá sách</button>
                </div>
              ) : (
                <button className="linkbtn lib-del" disabled={!!sending} onClick={() => setConfirmDel(b.id)}>🗑️ Xoá</button>
              )}
            </li>
          )
        })}
      </ul>

      {!form ? (
        <label className={'cta small lib-add' + (work ? ' disabled' : '')}>
          ＋ Nạp sách
          <input type="file" accept="application/pdf,.pdf" hidden disabled={!!work} onChange={pickNew} />
        </label>
      ) : (
        <div className="lib-form">
          <div className="lib-file">📄 {form.file.name}</div>
          {form.loading && <p className="cr-hint">Đang mở file…</p>}
          {form.pages > 0 && (
            <p className="lib-cost" data-testid="lib-cost"><b>{form.pages} trang</b> · chi phí đọc chữ ước tính <b>{costText(form.pages)}</b></p>
          )}
          <label className="auth-lbl">Lớp</label>
          <SelectPicker btnClass="auth-in" value={form.grade} onChange={(v) => setForm({ ...form, grade: v })} placeholder="— Chọn lớp —" ariaLabel="Lớp của sách" options={gradeOpts} />
          <label className="auth-lbl">Môn</label>
          <SelectPicker btnClass="auth-in" value={form.subject} onChange={(v) => setForm({ ...form, subject: v })} placeholder="— Chọn môn —" ariaLabel="Môn của sách" options={subjOpts} />
          <label className="auth-lbl">Loại sách</label>
          <SelectPicker btnClass="auth-in" value={form.kind} onChange={(v) => setForm({ ...form, kind: v })} placeholder="— Chọn loại —" ariaLabel="Loại sách" options={kindOpts} />
          <label className="auth-lbl">Tên sách</label>
          <input className="auth-in" value={form.title} maxLength={120} placeholder="vd Ngữ văn 7 tập 1" onChange={(e) => setForm({ ...form, title: e.target.value })} aria-label="Tên sách" />
          {form.err && <div className="err">{form.err}</div>}
          <div className="modal-btns">
            <button className="cta small ghost" onClick={() => setForm(null)}>Huỷ</button>
            <button className="cta small" disabled={!form.doc || form.starting} onClick={start}>{form.starting ? 'Đang tạo…' : `Bắt đầu đọc (${form.pages || '…'} trang)`}</button>
          </div>
        </div>
      )}
    </section>
  )
}
