// Ôn Tập (05/11/2026): ĐỒNG BỘ DỮ LIỆU HỌC CỦA TỪNG CON GIỮA CÁC MÁY (anh duyệt "Mục 1" ngày 05/11/2026).
// Trước đây chỉ tài khoản đồng bộ; bản đồ kiến thức, thời gian học, báo cáo, câu đã gặp, bộ từ + lịch ôn Vở Spelling
// chỉ nằm trên máy con đã học. Bây giờ mỗi con có một bản dữ liệu trên máy chủ (/api/account, hành động "data"):
//  1. Máy gửi bản của mình (khi có thay đổi), máy chủ GỘP với bản đang lưu (api/_sync/merge.mjs) rồi trả bản gộp.
//     Không có thay đổi thì chỉ hỏi "có bản mới hơn không" (rất nhẹ).
//  2. Máy ghi bản gộp vào đúng chỗ lưu cũ (ontap.memory.v2::<id con>…), nên mọi màn hình vẫn đọc như trước.
// Gộp không mất bài, không cộng trùng:
//  - Thời gian học + nhật ký: phần TĂNG THÊM trên máy này được cộng vào bộ đếm RIÊNG của máy (dev[mã máy]) và lưu NGAY
//    trước khi gửi -> gửi lại bao nhiêu lần (mạng chập chờn) cũng không cộng trùng. Tổng = cộng mọi máy.
//  - Bản đồ kiến thức: theo id, bản sửa sau thắng. Mục máy này đã GỘP vào mục lớn (hoặc quá hạn) -> gửi "dấu xoá" để mọi
//    máy cùng bỏ (không bị gộp, cộng điểm lần nữa). Mục chỉ lỡ mất trên máy này (hiếm) thì máy chủ trả lại, không xoá.
//  - Bộ từ Vở Spelling: bộ từ đã xoá trên máy này -> dấu xoá. Chỉ ghi bộ từ khi khung Vở Spelling ĐANG ĐÓNG
//    (đang mở thì trò chơi giữ bản riêng và sẽ ghi đè) -> để lần đồng bộ sau.
//  - Máy vừa ghi thêm trong lúc chờ máy chủ -> KHÔNG ghi bản gộp (khỏi mất phần vừa học), đồng bộ lại ngay sau đó.
//  - "Xoá hết dữ liệu & làm lại từ đầu" (markReset): mọi máy cùng bắt đầu lại.
// Giữ riêng trên máy (không đồng bộ): ontap.datasync.v1:<id con> (trạng thái đồng bộ), ontap.devid.v1 (mã máy).
import { call, getToken } from './sync.js'
import { normalizeMem } from './memory.js'
import { DEFAULT_SETTINGS } from './settings.js'
import { mergeDocs, totalsOf, stable } from '../../api/_sync/merge.mjs'

const BASES = { mem: 'ontap.memory.v2', stats: 'ontap.stats.v2', recent: 'ontap.recentq.v2', spell: 'ontap.spelling.v1' }
const PARTS = ['mem', 'stats', 'recent', 'spell']
const META = 'ontap.datasync.v1:'        // + id con — MỘT dấu ":" (khác kiểu "...::<id>" của dữ liệu học)
const SETTINGS = 'ontap.settings.v1'
const SET_META = 'ontap.datasync.v1:_settings'
const DEV = 'ontap.devid.v1'
const FIELDS = ['reviewed', 'correct', 'wrong', 'sec']

const read = (k) => { try { return localStorage.getItem(k) } catch { return null } }
const write = (k, v) => { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v) } catch { /* noop */ } }
const parse = (s, fb) => { if (s == null) return fb; try { const v = JSON.parse(s); return v == null ? fb : v } catch { return fb } }
const isObj = (x) => !!x && typeof x === 'object' && !Array.isArray(x)
const num = (x) => (Number.isFinite(Number(x)) ? Number(x) : 0)
const clone = (x) => JSON.parse(JSON.stringify(x == null ? null : x))
const okChild = (id) => typeof id === 'string' && /^[A-Za-z0-9_.:-]{1,120}$/.test(id)

// FNV-1a 32 bit — chỉ để biết dữ liệu trên máy có đổi không.
export function hash(str) {
  let h = 0x811c9dc5
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193) }
  return (h >>> 0).toString(36)
}
const keyOf = (part, id) => BASES[part] + '::' + id
function readRaw(id) { const o = {}; for (const p of PARTS) o[p] = read(keyOf(p, id)); return o }
const rawHash = (raw) => hash(PARTS.map((p) => (raw[p] == null ? '\u0000' : raw[p])).join('\u0001'))

// Mã riêng của máy này (cho bộ đếm thời gian học riêng của máy).
export function deviceId() {
  let d = read(DEV)
  if (!d || !/^d[a-z0-9]{6,24}$/.test(d)) {
    let r = ''
    try { const a = new Uint32Array(3); crypto.getRandomValues(a); r = [...a].map((x) => x.toString(36)).join('') } catch { r = Math.random().toString(36).slice(2) + Date.now().toString(36) }
    d = ('d' + r.replace(/[^a-z0-9]/g, '')).slice(0, 20)
    write(DEV, d)
  }
  return d
}

const emptyMeta = () => ({
  rev: 0, hash: '', resetAt: 0, pendingReset: 0,
  own: { e: 0, days: {}, log: {} },   // bộ đếm riêng của máy này (chỉ tăng)
  base: { days: {}, log: {} },        // tổng thời gian học trên máy lúc đồng bộ lần trước (để tính phần tăng thêm)
  goal: null,                          // mục tiêu phút / ngày + lúc đổi
  mb: {},                              // id khái niệm -> [mã nội dung, updatedAt, tên, môn, chủ đề, ngày học, ngày ôn] lúc nhận
  spellIds: null,                      // id các bộ từ lúc nhận (để biết bộ nào đã xoá trên máy này)
  pendingDead: {},                     // dấu xoá chưa gửi (mục đã gộp vào mục lớn lúc nhận dữ liệu)
  ok: 0, err: '',
})
function loadMeta(id) { const m = parse(read(META + id), null); return isObj(m) ? { ...emptyMeta(), ...m } : emptyMeta() }
function saveMeta(id, m) { write(META + id, JSON.stringify(m)) }

// Mục `id` (đã có lúc nhận, nay không còn trên máy) có phải đã được GỘP vào mục khác / quá hạn không?
// Thử thêm lại vào bản đồ rồi chuẩn hoá: biến mất -> đúng là đã gộp / quá hạn. Còn nguyên -> chỉ lỡ mất trên máy này.
function absorbed(list, id, b) {
  const probe = {
    id, name: b[2] || '', subject: b[3] || '', topic: b[4] || '', learnedOn: b[5] || '', lastReviewed: b[6] || '', details: [],
    mastery: 0, pts: 0, hist: '', reviews: 0, correct: 0, wrong: 0, updatedAt: num(b[1]),
  }
  if (!probe.name) return false
  try { return !normalizeMem([...list, probe]).some((c) => c.id === id) } catch { return false }
}

// Bản dữ liệu gửi lên máy chủ (đồng thời chuyển phần giờ học tăng thêm vào bộ đếm riêng của máy).
export function buildDoc(raw, meta, now = Date.now()) {
  const dev = deviceId()
  const m = clone(meta)
  const mem = parse(raw.mem, null), stats = parse(raw.stats, null), recent = parse(raw.recent, []), spell = parse(raw.spell, null)
  // 1) Thời gian học + nhật ký: phần TĂNG THÊM so với lần đồng bộ trước -> bộ đếm riêng của máy này
  const own = isObj(m.own) && num(m.own.e) === num(m.resetAt) ? m.own : { e: num(m.resetAt), days: {}, log: {} }
  own.days = isObj(own.days) ? own.days : {}
  own.log = isObj(own.log) ? own.log : {}
  const days = isObj(stats) && isObj(stats.days) ? stats.days : {}
  const log = isObj(stats) && isObj(stats.log) ? stats.log : {}
  const bd = (m.base && m.base.days) || {}, bl = (m.base && m.base.log) || {}
  for (const d of Object.keys(days)) { const inc = num(days[d]) - num(bd[d]); if (inc > 0) own.days[d] = num(own.days[d]) + inc }
  for (const d of Object.keys(log)) {
    const day = isObj(log[d]) ? log[d] : {}
    for (const s of Object.keys(day)) {
      for (const f of FIELDS) {
        const inc = num(day[s] && day[s][f]) - num(bl[d] && bl[d][s] && bl[d][s][f])
        if (inc <= 0) continue
        const od = own.log[d] || (own.log[d] = {})
        const os = od[s] || (od[s] = { reviewed: 0, correct: 0, wrong: 0, sec: 0 })
        os[f] = num(os[f]) + inc
      }
    }
  }
  m.own = own
  m.base = { days: clone(days), log: clone(log) }
  // 2) Mục tiêu phút mỗi ngày (mặc định 15 chưa từng đổi thì không đè lên mục tiêu phụ huynh đặt ở máy khác)
  const gv = isObj(stats) && Number.isFinite(Number(stats.goalMin)) ? Math.round(Number(stats.goalMin)) : 15
  if (!m.goal || m.goal.v !== gv) m.goal = { v: gv, at: !m.goal && gv === 15 ? 0 : now }
  // 3) Bản đồ kiến thức
  const list = Array.isArray(mem) ? mem : []
  const items = {}
  for (const c of list) {
    if (!c || typeof c.id !== 'string') continue
    const b = m.mb[c.id]
    // đã sửa trên máy (vd gộp mục, chuẩn hoá tên) mà giờ sửa không tăng -> lấy giờ hiện tại để bản này thắng khi gộp
    items[c.id] = b && b[0] !== hash(stable(c)) && num(c.updatedAt) <= num(b[1]) ? { ...c, updatedAt: now } : c
  }
  const dead = { ...(m.pendingDead || {}) }
  for (const id of Object.keys(m.mb || {})) if (!items[id] && absorbed(list, id, m.mb[id])) dead[id] = now
  // 4) Bộ từ + lịch ôn Vở Spelling
  let sp = null
  if (isObj(spell) && Array.isArray(spell.sets)) {
    const sets = {}
    for (const s of spell.sets) if (s && typeof s.id === 'string') sets[s.id] = s
    const sdead = {}
    for (const sid of m.spellIds || []) if (!sets[sid]) sdead[sid] = now
    sp = { sets, stats: isObj(spell.stats) ? spell.stats : {}, dead: sdead }
  }
  const doc = { v: 1, resetAt: num(m.resetAt), mem: { items, dead }, recent: Array.isArray(recent) ? recent : [], goal: m.goal, dev: { [dev]: own }, spell: sp }
  return { doc, meta: m }
}

// Bản gộp từ máy chủ -> ghi vào chỗ lưu trên máy. Máy vừa ghi thêm trong lúc chờ -> không ghi (đồng bộ lại sau).
function adopt(id, doc, rev, raw0, meta, opts) {
  const raw1 = readRaw(id)
  if (rawHash(raw1) !== rawHash(raw0)) { again.add(id); return { ok: true, retry: true } }
  const now = Date.now()
  const m = clone(meta)
  // máy khác vừa "xoá hết dữ liệu & làm lại": bộ đếm riêng của máy này cũng bắt đầu lại
  if (num(doc.resetAt) > num(m.resetAt)) { m.own = { e: num(doc.resetAt), days: {}, log: {} }; m.pendingReset = 0 }
  m.resetAt = num(doc.resetAt)
  // Bản đồ kiến thức: xếp cố định (máy nào cũng chuẩn hoá ra cùng kết quả), chuẩn hoá như lúc mở app
  const items = Object.values((doc.mem && doc.mem.items) || {})
  items.sort((a, b) => String(a.learnedOn || '').localeCompare(String(b.learnedOn || '')) || num(a.updatedAt) - num(b.updatedAt) || String(a.id).localeCompare(String(b.id)))
  const norm = normalizeMem(items)
  const kept = new Set(norm.map((c) => c.id))
  m.pendingDead = {}
  for (const c of items) if (!kept.has(c.id)) m.pendingDead[c.id] = now   // vừa gộp vào mục khác: báo máy chủ lần gửi sau
  const byId = new Map(items.map((c) => [c.id, c]))
  m.mb = {}
  for (const c of norm) {
    const src = byId.get(c.id) || c   // bản máy chủ (trước chuẩn hoá): khác bản trên máy -> lần gửi sau bản trên máy thắng
    m.mb[c.id] = [hash(stable(src)), num(src.updatedAt), c.name || '', c.subject || '', c.topic || '', c.learnedOn || '', c.lastReviewed || '']
  }
  // Thời gian học + nhật ký = tổng mọi máy
  const tot = totalsOf(doc)
  const st0 = parse(raw1.stats, null)
  const stats = { ...(isObj(st0) ? st0 : {}), goalMin: doc.goal ? doc.goal.v : 15, days: tot.days, log: tot.log }
  m.base = { days: clone(tot.days), log: clone(tot.log) }
  m.goal = doc.goal || { v: 15, at: 0 }
  const recent = Array.isArray(doc.recent) ? doc.recent : []
  // Ghi (bỏ qua phần trống mà trên máy cũng chưa có — khỏi tạo dữ liệu rỗng cho con chưa học trên máy này)
  const out = { ...raw1 }
  if (norm.length || raw1.mem != null) out.mem = JSON.stringify(norm)
  if (Object.keys(tot.days).length || Object.keys(tot.log).length || doc.goal || raw1.stats != null) out.stats = JSON.stringify(stats)
  if (recent.length || raw1.recent != null) out.recent = JSON.stringify(recent)
  let spellLater = false
  if (doc.spell) {
    if (opts.spellingOpen && opts.spellingOpen(id)) spellLater = true   // Vở Spelling đang mở: để lần sau
    else {
      const sets = Object.values(doc.spell.sets || {}).sort((a, b) => num(a.createdAt) - num(b.createdAt) || String(a.id).localeCompare(String(b.id)))
      out.spell = JSON.stringify({ sets, stats: doc.spell.stats || {} })
      m.spellIds = sets.map((s) => s.id)
    }
  }
  for (const p of ['mem', 'stats', 'recent', 'spell']) if (out[p] !== raw1[p]) write(keyOf(p, id), out[p])
  m.hash = rawHash(out)
  m.rev = spellLater ? m.rev : rev   // chưa ghi được bộ từ -> lần sau hỏi lại bản này
  m.ok = now; m.err = ''
  saveMeta(id, m)
  if (opts.onApplied) { try { opts.onApplied(id) } catch { /* noop */ } }
  return { ok: true, changed: true }
}

async function syncOnce(id, opts) {
  const token = opts.token || getToken()
  if (!token) return { skipped: 'no_token' }
  const raw0 = readRaw(id)
  const meta = loadMeta(id)
  const hasLocal = PARTS.some((p) => raw0[p] != null)
  const needPut = !!meta.pendingReset || Object.keys(meta.pendingDead || {}).length > 0 || (hasLocal && rawHash(raw0) !== meta.hash)
  let built = null, r
  if (needPut) {
    built = buildDoc(raw0, meta)
    saveMeta(id, built.meta)   // phần giờ học tăng thêm đã vào bộ đếm riêng: lưu NGAY (gửi lại nhiều lần không cộng trùng)
    r = await call('data', { child: id, doc: built.doc }, token, 25000)
  } else {
    r = await call('data', { child: id, rev: meta.rev }, token, 15000)
  }
  const m = loadMeta(id)
  if (!r.ok) {
    m.err = r.offline ? 'offline' : (r.error || 'error'); saveMeta(id, m)
    return { offline: !!r.offline, error: r.error || 'error' }
  }
  if (needPut) { m.pendingReset = 0; m.pendingDead = {} }   // máy chủ đã nhận
  if (r.same) {
    // máy chủ giống hệt bản máy vừa gửi -> ghi lại đúng bản đó (giờ sửa vừa cập nhật…)
    if (needPut) return adopt(id, mergeDocs(built.doc, built.doc), r.rev, raw0, m, opts)
    m.ok = Date.now(); m.err = ''; saveMeta(id, m)
    return { ok: true, changed: false }
  }
  if (!r.doc) {   // máy chủ chưa có bản nào
    m.rev = 0; m.hash = ''; m.ok = Date.now(); m.err = ''; saveMeta(id, m)
    if (hasLocal) again.add(id)
    return { ok: true, changed: false }
  }
  return adopt(id, r.doc, r.rev, raw0, m, opts)
}

// Đồng bộ dữ liệu học của MỘT con. Đang đồng bộ con đó -> chờ lượt đang chạy rồi chạy thêm một lượt.
// opts: { spellingOpen(id) -> bool, onApplied(id) — gọi sau khi đã ghi dữ liệu mới vào máy }
const running = new Map()
const again = new Set()
export function syncChild(id, opts = {}) {
  if (!okChild(id)) return Promise.resolve({ skipped: 'bad_id' })
  if (running.has(id)) { again.add(id); return running.get(id) }
  const p = (async () => {
    let res = {}, n = 0
    do {
      again.delete(id)
      res = await syncOnce(id, opts)
      n++
      if (again.has(id) && !res.offline && n < 4) await new Promise((ok) => setTimeout(ok, res.retry ? 1200 : 30))
    } while (again.has(id) && !res.offline && !res.error && n < 4)
    return res
  })().finally(() => running.delete(id))
  running.set(id, p)
  return p
}

// "Xoá hết dữ liệu & làm lại từ đầu" của một con: lần đồng bộ tới báo mọi máy cùng bắt đầu lại.
export function markReset(id, now = Date.now()) {
  if (!okChild(id)) return
  const m = loadMeta(id)
  saveMeta(id, { ...emptyMeta(), rev: m.rev, resetAt: now, pendingReset: now, own: { e: now, days: {}, log: {} } })
}

// Tình trạng đồng bộ (Cài đặt): ok = lần đồng bộ được gần nhất; pending = trên máy có phần chưa gửi.
export function dataSyncStatus(id) {
  const m = loadMeta(id), raw = readRaw(id)
  const hasLocal = PARTS.some((p) => raw[p] != null)
  return { ok: m.ok || 0, err: m.err || '', pending: !!m.pendingReset || (hasLocal && rawHash(raw) !== m.hash) }
}

// CÀI ĐẶT PHỤ HUYNH (bật/tắt trắc nghiệm, khẩu hiệu) — chung cả tài khoản, bản đổi sau cùng thắng.
const isDefault = (s) => isObj(s) && Object.keys(DEFAULT_SETTINGS).every((k) => stable(s[k]) === stable(DEFAULT_SETTINGS[k])) && Object.keys(s).every((k) => k in DEFAULT_SETTINGS)
let setRunning = null
export function syncSettings(opts = {}) {
  if (setRunning) return setRunning
  setRunning = (async () => {
    const token = opts.token || getToken()
    if (!token) return { skipped: 'no_token' }
    const raw = read(SETTINGS)
    const meta = parse(read(SET_META), {}) || {}
    const local = parse(raw, null)
    const changed = raw != null && raw !== meta.raw
    const r = changed
      ? await call('data', { child: '_settings', doc: { v: 1, settings: { v: local, at: !meta.raw && isDefault(local) ? 0 : Date.now() } } }, token)
      : await call('data', { child: '_settings', rev: meta.rev || 0 }, token)
    if (!r.ok) return { offline: !!r.offline, error: r.error }
    const s = r.same ? null : r.doc && r.doc.settings
    if (!s || !isObj(s.v)) { write(SET_META, JSON.stringify({ raw: changed ? raw : (meta.raw || ''), rev: r.rev || 0 })); return { ok: true, changed: false } }
    if (read(SETTINGS) !== raw) return { ok: true, retry: true }   // vừa đổi cài đặt trong lúc chờ: lần sau
    const nraw = JSON.stringify({ ...(isObj(local) ? local : {}), ...s.v })
    write(SETTINGS, nraw)
    write(SET_META, JSON.stringify({ raw: nraw, rev: r.rev }))
    if (opts.onApplied) { try { opts.onApplied() } catch { /* noop */ } }
    return { ok: true, changed: nraw !== raw }
  })().finally(() => { setRunning = null })
  return setRunning
}
