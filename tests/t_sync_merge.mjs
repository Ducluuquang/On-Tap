// ĐỒNG BỘ DỮ LIỆU HỌC giữa các máy (05/11/2026) — hàm gộp của máy chủ (api/_sync/merge.mjs) + cách máy gửi/nhận
// (src/lib/datasync.js), chạy thẳng trong Node: mỗi "máy" một kho localStorage riêng, máy chủ giả dùng đúng hàm gộp thật.
//  M  Hàm gộp: không phụ thuộc thứ tự, gộp lại không đổi, dấu xoá, xoá hết dữ liệu, bộ đếm giờ học từng máy, lịch ôn từ.
//  D  Nhiều máy: A có dữ liệu -> B thấy; hai máy cùng học không cộng trùng (gửi đi gửi lại nhiều lần); cùng thêm một chủ đề
//     ở hai máy -> còn một mục, điểm cộng đúng một lần; mục lỡ mất trên một máy được trả lại; Vở Spelling đang mở thì chưa ghi
//     bộ từ; máy vừa học thêm trong lúc chờ máy chủ không bị mất; mất mạng rồi có lại; mục tiêu phút; xoá hết dữ liệu; cài đặt.
const res = {}
const check = (n, c, x = '') => { res[n] = !!c; console.log((c ? '  ✓ ' : '  ✗ ') + n + (c ? '' : '  → ' + x)) }

// ---------- máy giả: localStorage riêng ----------
class Mem {
  constructor() { this.m = new Map() }
  getItem(k) { return this.m.has(k) ? this.m.get(k) : null }
  setItem(k, v) { this.m.set(k, String(v)) }
  removeItem(k) { this.m.delete(k) }
  key(i) { return [...this.m.keys()][i] ?? null }
  get length() { return this.m.size }
}
const devs = { A: new Mem(), B: new Mem(), C: new Mem() }
globalThis.localStorage = devs.A
const use = (d) => { globalThis.localStorage = devs[d] }

const { mergeDocs, cleanDoc, stable, totalsOf } = await import('../api/_sync/merge.mjs')
const DS = await import('../src/lib/datasync.js')
const { addConcepts, applyReviewResults, normalizeMem, conceptKey } = await import('../src/lib/memory.js')
const { addSeconds, addSession, setGoalMin } = await import('../src/lib/stats.js')

// ---------- máy chủ giả: đúng cách api/account.mjs gộp + đánh số phiên bản ----------
const server = { docs: {}, hook: null, offline: false, calls: 0 }
const clone = (x) => JSON.parse(JSON.stringify(x))
function handle(b) {
  if (b.action !== 'data') return { ok: false, error: 'bad_action' }
  const cur = server.docs[b.child]
  if (b.doc == null) {
    if (cur && cur.rev === Number(b.rev)) return { ok: true, rev: cur.rev, same: true }
    if (!cur) return { ok: true, rev: 0, doc: null }
    return { ok: true, rev: cur.rev, doc: clone(cur.doc) }
  }
  const incoming = mergeDocs(b.doc, b.doc)
  const merged = cur ? mergeDocs(cur.doc, incoming) : incoming
  let rev = cur ? cur.rev : 0
  if (!cur || stable(merged) !== stable(cur.doc)) { rev++; server.docs[b.child] = { rev, doc: merged } }
  return stable(merged) === stable(incoming) ? { ok: true, rev, same: true } : { ok: true, rev, doc: clone(merged) }
}
globalThis.fetch = async (url, opts) => {
  const b = JSON.parse(opts.body)
  server.calls++
  if (server.offline) throw new TypeError('Failed to fetch')
  if (server.hook) { const h = server.hook; server.hook = null; await h(b) }
  const out = handle(b)
  return { ok: true, status: 200, json: async () => clone(out) }
}
for (const d of Object.keys(devs)) devs[d].setItem('ontap.acctoken.v1', 'tok-' + d)

// ---------- tiện ích dữ liệu trên từng máy ----------
const KID = 'kid1'
const k = (base) => base + '::' + KID
const get = (d, base, fb) => { const v = devs[d].getItem(k(base)); return v == null ? fb : JSON.parse(v) }
const put = (d, base, v) => devs[d].setItem(k(base), JSON.stringify(v))
const memOf = (d) => get(d, 'ontap.memory.v2', [])
const statsOf = (d) => get(d, 'ontap.stats.v2', { goalMin: 15, days: {}, log: {} })
const spellOf = (d) => get(d, 'ontap.spelling.v1', null)
const today = new Date().toISOString().slice(0, 10)
const sec = (d) => (statsOf(d).days || {})[today] || 0
async function sync(d, opts = {}) { use(d); const r = await DS.syncChild(KID, opts); return r }
function study(d, s, subject = 'Toán', total = 0, correct = 0) {   // giống handleFinish: cộng giây + nhật ký
  const st = statsOf(d)
  put(d, 'ontap.stats.v2', total ? addSession(addSeconds(st, s), { subject, total, correct, sec: s }) : addSeconds(st, s))
}
function addLesson(d, names, subject = 'Toán') {
  put(d, 'ontap.memory.v2', normalizeMem(addConcepts(memOf(d), names.map((n) => ({ name: n, subject, topic: 'Bài thử' })))))
}
function review(d, name, cor, wr) {
  const m = memOf(d), c = m.find((x) => conceptKey(x.name) === conceptKey(name))
  const { mem } = applyReviewResults(m, { [c.id]: { correct: cor, wrong: wr, seq: '1'.repeat(cor) + '0'.repeat(wr) } }, { choice: true, subject: c.subject })
  put(d, 'ontap.memory.v2', mem)
}
const byKey = (d, name) => memOf(d).filter((c) => conceptKey(c.name) === conceptKey(name))

// ======================= M — hàm gộp =======================
console.log('— M. Hàm gộp (máy chủ)')
{
  let seed = 7
  const rnd = (n) => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed % n }
  const randDoc = () => {
    const items = {}, dead = {}, dev = {}, sets = {}, stats = {}, sdead = {}
    for (let i = 0; i < 6; i++) { const id = 'c' + rnd(8); items[id] = { id, name: 'Mục ' + id, updatedAt: 1000 + rnd(50), pts: rnd(100) } }
    for (let i = 0; i < 3; i++) dead['c' + rnd(8)] = 1000 + rnd(50)
    for (let i = 0; i < 3; i++) { const id = 'dev' + rnd(4); dev[id] = { e: 0, days: { '2026-11-01': rnd(900), '2026-11-02': rnd(900) }, log: { '2026-11-01': { 'Toán': { reviewed: rnd(20), correct: rnd(10), wrong: rnd(10), sec: rnd(900) } } } } }
    for (let i = 0; i < 3; i++) { const id = 's' + rnd(5); sets[id] = { id, name: 'Bộ ' + id, words: [{ w: 'cat' }], updatedAt: 1000 + rnd(50), createdAt: 1 }; stats[id] = { words: { cat: { f: 1, s: rnd(4), l: 20000 + rnd(9), d: 20010, h: '1'.repeat(rnd(5)) } }, best: { bee: rnd(10) }, updatedAt: 1000 + rnd(50) } }
    if (rnd(2)) sdead['s' + rnd(5)] = 1000 + rnd(50)
    return { v: 1, resetAt: 0, mem: { items, dead }, recent: ['q' + rnd(9), 'q' + rnd(9)], goal: { v: 10 + rnd(20), at: rnd(100) }, dev, spell: { sets, stats, dead: sdead } }
  }
  const core = (d) => stable({ mem: d.mem, dev: d.dev, spell: d.spell, goal: d.goal, resetAt: d.resetAt })
  let comm = true, idem = true, assoc = true
  for (let t = 0; t < 300; t++) {
    const a = randDoc(), b = randDoc(), c = randDoc()
    if (core(mergeDocs(a, b)) !== core(mergeDocs(b, a))) comm = false
    const ab = mergeDocs(a, b)
    if (stable(mergeDocs(ab, ab)) !== stable(ab)) idem = false
    if (core(mergeDocs(mergeDocs(a, b), c)) !== core(mergeDocs(a, mergeDocs(b, c)))) assoc = false
  }
  check('300 bộ dữ liệu ngẫu nhiên: gộp(a,b) = gộp(b,a); gộp lại lần nữa không đổi; gộp 3 bản theo thứ tự nào cũng như nhau', comm && idem && assoc, JSON.stringify({ comm, idem, assoc }))

  const A = { mem: { items: { x: { id: 'x', name: 'X', updatedAt: 10 } }, dead: {} } }
  const delOld = { mem: { items: {}, dead: { x: 9 } } }, delNew = { mem: { items: {}, dead: { x: 10 } } }
  check('dấu xoá: xoá TRƯỚC lần sửa cuối -> mục vẫn còn; xoá sau (hoặc cùng lúc) -> mục mất ở mọi máy', !!mergeDocs(A, delOld).mem.items.x && !mergeDocs(A, delNew).mem.items.x && mergeDocs(A, delNew).mem.dead.x === 10)
  const A2 = { mem: { items: { x: { id: 'x', name: 'X sửa', updatedAt: 20 } }, dead: {} } }
  check('mục sửa SAU lúc bị xoá ở máy khác -> sống lại (không mất bài vừa học)', mergeDocs(mergeDocs(A, delNew), A2).mem.items.x.name === 'X sửa')
  const d1 = { dev: { a: { e: 0, days: { [today]: 300 }, log: {} } } }, d2 = { dev: { a: { e: 0, days: { [today]: 500 }, log: {} }, b: { e: 0, days: { [today]: 200 }, log: {} } } }
  const md = mergeDocs(d1, d2)
  check('giờ học: mỗi máy lấy số lớn hơn (300 vs 500 -> 500), tổng = cộng các máy (500 + 200 = 700)', totalsOf(md).days[today] === 700 && totalsOf(mergeDocs(md, d1)).days[today] === 700)
  const R = { resetAt: 5000, mem: { items: { y: { id: 'y', name: 'Y', updatedAt: 6000 } }, dead: {} }, dev: { b: { e: 5000, days: { [today]: 60 }, log: {} } }, spell: { sets: { mau: { id: 'mau', example: true, updatedAt: 1 }, s1: { id: 's1', updatedAt: 4000 } }, stats: { mau: { words: {}, best: {}, updatedAt: 1 } }, dead: {} } }
  const old = { mem: { items: { x: { id: 'x', name: 'X', updatedAt: 4000 } }, dead: {} }, dev: { a: { e: 0, days: { [today]: 900 }, log: {} } }, goal: { v: 30, at: 4000 } }
  const mr = mergeDocs(old, R)
  check('xoá hết dữ liệu: bỏ mục / giờ học / mục tiêu cũ hơn lúc xoá, giữ phần học sau đó + bộ từ mẫu (bỏ tiến độ cũ của nó)',
    !mr.mem.items.x && !!mr.mem.items.y && totalsOf(mr).days[today] === 60 && mr.goal === null && !!mr.spell.sets.mau && !mr.spell.sets.s1 && !mr.spell.stats.mau, JSON.stringify(mr).slice(0, 300))
  const w1 = { spell: { sets: { s: { id: 's', updatedAt: 1 } }, stats: { s: { words: { cat: { l: 20001, s: 1, h: '1' }, dog: { l: 20000, s: 0, h: '0' } }, best: { bee: 6 }, updatedAt: 5 } }, dead: {} } }
  const w2 = { spell: { sets: { s: { id: 's', updatedAt: 1 } }, stats: { s: { words: { cat: { l: 20000, s: 0, h: '0' }, dog: { l: 20003, s: 2, h: '11' } }, best: { bee: 8, mem: 3 }, updatedAt: 7 } }, dead: {} } }
  const ws = mergeDocs(w1, w2).spell.stats.s
  check('lịch ôn từng từ: lấy bản ôn gần nhất mỗi từ; điểm cao nhất lấy số lớn hơn', ws.words.cat.l === 20001 && ws.words.dog.l === 20003 && ws.best.bee === 8 && ws.best.mem === 3)
  const bad = cleanDoc({ mem: { items: { __proto__: { x: 1 }, 'ok-1': { id: 'ok-1' }, 'bad id!': { id: 'z' } }, dead: { 'ok-1': 'abc' } }, dev: 'x', recent: [1, 'a', 'a'], spell: 5 })
  check('dữ liệu gửi lên sai kiểu / khoá lạ (__proto__) -> bị lọc, không lỗi', Object.keys(bad.mem.items).join() === 'ok-1' && !Object.keys(bad.mem.dead).length && JSON.stringify(bad.dev) === '{}' && bad.recent.join() === 'a' && bad.spell === null && ({}).x === undefined)
  const s1 = { settings: { v: { allowChoice: false }, at: 100 } }, s2 = { settings: { v: { allowChoice: true }, at: 0 } }
  check('cài đặt phụ huynh: bản đổi sau cùng thắng (mặc định chưa đổi không đè)', mergeDocs(s1, s2).settings.v.allowChoice === false && mergeDocs(s2, s1).settings.v.allowChoice === false)
}

// ======================= D — nhiều máy =======================
console.log('— D. Nhiều máy (máy chủ giả + kho riêng từng máy)')
// A: máy con học từ trước khi có đồng bộ (bài học + giờ học + câu đã gặp + một bộ từ)
use('A')
addLesson('A', ['Phân số', 'Số thập phân', 'Tìm x'])
review('A', 'Phân số', 3, 1)
study('A', 600, 'Toán', 4, 3)
put('A', 'ontap.recentq.v2', ['cau-1', 'cau-2'])
put('A', 'ontap.spelling.v1', { sets: [{ id: 'sA', name: 'Animals', words: [{ w: 'cat', vi: 'con mèo' }], createdAt: 1, updatedAt: 100 }], stats: { sA: { words: { cat: { f: 20390, s: 1, l: 20390, d: 20392, h: '1' } }, best: { bee: 7 }, updatedAt: 100 } } })
let r = await sync('A')
check('máy A (có dữ liệu cũ) đồng bộ lần đầu -> máy chủ có đủ: 3 chủ đề, 600 giây, câu đã gặp, bộ từ', r.ok && Object.keys(server.docs[KID].doc.mem.items).length === 3 && totalsOf(server.docs[KID].doc).days[today] === 600 && server.docs[KID].doc.recent.length === 2 && !!server.docs[KID].doc.spell.sets.sA, JSON.stringify(r))
r = await sync('B')
const bm = memOf('B'), bs = statsOf('B')
check('máy B (chưa có gì) đồng bộ -> thấy đúng bài học, % Phân số, 600 giây + nhật ký, câu đã gặp, bộ từ + lịch ôn',
  r.ok && bm.length === 3 && byKey('B', 'Phân số')[0].correct === 3 && bs.days[today] === 600 && bs.log[today]['Toán'].reviewed === 4 && get('B', 'ontap.recentq.v2', []).join() === 'cau-1,cau-2' && spellOf('B').sets[0].id === 'sA' && spellOf('B').stats.sA.best.bee === 7, JSON.stringify({ r, n: bm.length, bs }))

// B học thêm 300 giây + ôn Phân số; đồng bộ qua lại nhiều lần -> không cộng trùng
study('B', 300, 'Toán', 5, 5); review('B', 'Phân số', 5, 0)
for (const d of ['B', 'A', 'B', 'A', 'A', 'B']) await sync(d)
check('B học thêm 300 giây -> cả hai máy 900 giây; đồng bộ đi lại 6 lần vẫn đúng 900 (không cộng trùng)', sec('A') === 900 && sec('B') === 900 && totalsOf(server.docs[KID].doc).days[today] === 900, `${sec('A')} ${sec('B')}`)
check('kết quả ôn ở B (Phân số đúng 8 câu) có ở A; nhật ký 9 câu', byKey('A', 'Phân số')[0].correct === 8 && statsOf('A').log[today]['Toán'].reviewed === 9, JSON.stringify(byKey('A', 'Phân số')[0]))

// Cùng lúc hai máy mất mạng, mỗi máy học riêng -> có mạng lại: cộng đủ cả hai
server.offline = true
study('A', 120); study('B', 60)
r = await sync('A'); const offA = r.offline
await sync('B')
study('A', 30)
server.offline = false
for (const d of ['A', 'B', 'A', 'B']) await sync(d)
check('mất mạng: A học 120 + 30, B học 60 -> có mạng lại cả hai máy 1.110 giây (không mất, không trùng)', offA && sec('A') === 1110 && sec('B') === 1110, `${sec('A')} ${sec('B')}`)

// Cùng thêm một chủ đề ở hai máy (chưa đồng bộ) -> còn MỘT mục, điểm của hai máy cộng đúng một lần
addLesson('A', ['Hình học không gian']); review('A', 'Hình học không gian', 2, 0)
await new Promise((ok) => setTimeout(ok, 5))   // máy khác, lúc khác -> id khác (id có mốc thời gian)
addLesson('B', ['Hình học không gian']); review('B', 'Hình học không gian', 1, 1)
const twoIds = byKey('A', 'Hình học không gian')[0].id !== byKey('B', 'Hình học không gian')[0].id
for (const d of ['A', 'B', 'A', 'B', 'A', 'B']) await sync(d)
const hA = byKey('A', 'Hình học không gian'), hB = byKey('B', 'Hình học không gian')
const srvH = Object.values(server.docs[KID].doc.mem.items).filter((c) => conceptKey(c.name) === conceptKey('Hình học không gian'))
check('cùng thêm "Hình học không gian" ở 2 máy -> mỗi máy (và máy chủ) còn 1 mục; đúng 3 câu đúng / 1 sai (cộng một lần)',
  twoIds && hA.length === 1 && hB.length === 1 && srvH.length === 1 && hA[0].correct === 3 && hA[0].wrong === 1 && hB[0].correct === 3 && hB[0].id === hA[0].id, JSON.stringify({ hA, hB, srvH: srvH.length }))
for (const d of ['A', 'B', 'A']) await sync(d)
check('đồng bộ thêm 3 lần: điểm "Hình học không gian" không tăng nữa', byKey('A', 'Hình học không gian')[0].correct === 3 && byKey('B', 'Hình học không gian')[0].correct === 3)

// Mục lỡ mất trên một máy (không phải gộp / quá hạn) -> máy chủ trả lại, không xoá ở máy khác
put('B', 'ontap.memory.v2', memOf('B').filter((c) => conceptKey(c.name) !== conceptKey('Tìm x')))
await sync('B'); await sync('A')
check('mục "Tìm x" lỡ mất trên B -> đồng bộ xong B có lại; A vẫn còn', byKey('B', 'Tìm x').length === 1 && byKey('A', 'Tìm x').length === 1)

// Vở Spelling đang mở trên B -> chưa ghi bộ từ (trò chơi đang giữ bản riêng); đóng lại thì ghi
const sp = spellOf('A'); sp.sets.push({ id: 'sA2', name: 'Fruits', words: [{ w: 'apple' }], createdAt: 2, updatedAt: 200 }); put('A', 'ontap.spelling.v1', sp)
await sync('A')
const before = devs.B.getItem(k('ontap.spelling.v1'))
await sync('B', { spellingOpen: () => true })
const whileOpen = devs.B.getItem(k('ontap.spelling.v1')) === before
await sync('B', { spellingOpen: () => false })
check('Vở Spelling đang mở trên B -> chưa ghi bộ từ mới; đóng lại đồng bộ -> có bộ "Fruits"', whileOpen && spellOf('B').sets.some((s) => s.id === 'sA2'))
const spB = spellOf('B'); spB.sets = spB.sets.filter((s) => s.id !== 'sA'); delete spB.stats.sA; put('B', 'ontap.spelling.v1', spB)
await sync('B'); await sync('A')
check('xoá bộ từ "Animals" ở B -> A cũng mất bộ đó (cả lịch ôn)', !spellOf('A').sets.some((s) => s.id === 'sA') && !spellOf('A').stats.sA && spellOf('A').sets.some((s) => s.id === 'sA2'))

// Máy vừa học thêm trong lúc chờ máy chủ trả lời -> không bị ghi đè, đồng bộ lại ngay
const before2 = sec('A')
server.hook = async () => { study('A', 45) }
study('B', 15); await sync('B')
await sync('A')
for (const d of ['A', 'B']) await sync(d)
check('A học thêm 45 giây đúng lúc đang chờ máy chủ -> không mất: A và B đều có thêm 45 + 15 giây', sec('A') === before2 + 60 && sec('B') === before2 + 60, `${before2} ${sec('A')} ${sec('B')}`)

// Mục tiêu phút: B (phụ huynh) đặt 25 -> A thấy; máy mới C (mặc định 15) không đè mất
put('B', 'ontap.stats.v2', setGoalMin(statsOf('B'), 25)); await sync('B'); await sync('A')
await sync('C'); await sync('B')
check('mục tiêu 25 phút đặt ở B -> A và máy mới C đều 25; C không đè thành 15', statsOf('A').goalMin === 25 && statsOf('C').goalMin === 25 && statsOf('B').goalMin === 25 && sec('C') === sec('A'))

// Cài đặt phụ huynh (tắt trắc nghiệm) ở B -> A thấy; máy C mặc định không đè
use('B'); devs.B.setItem('ontap.settings.v1', JSON.stringify({ allowChoice: false, slogan: 'Cố lên' })); await DS.syncSettings()
use('A'); await DS.syncSettings()
use('C'); devs.C.setItem('ontap.settings.v1', JSON.stringify({ allowChoice: true, slogan: 'Tương lai khóc hay cười phụ thuộc vào độ lười của hiện tại.' })); await DS.syncSettings()
use('B'); await DS.syncSettings()
const setOf = (d) => JSON.parse(devs[d].getItem('ontap.settings.v1'))
check('tắt trắc nghiệm + khẩu hiệu ở B -> A, C cùng nhận; C (mặc định) không đè ngược lại', setOf('A').allowChoice === false && setOf('A').slogan === 'Cố lên' && setOf('C').allowChoice === false && setOf('B').allowChoice === false, JSON.stringify([setOf('A'), setOf('C'), setOf('B')]))

// Xoá hết dữ liệu ở A -> mọi máy bắt đầu lại; học sau đó được tính
use('A'); DS.markReset(KID)
for (const base of ['ontap.memory.v2', 'ontap.stats.v2', 'ontap.recentq.v2', 'ontap.spelling.v1']) devs.A.removeItem(k(base))
await sync('A'); await sync('B')
check('xoá hết dữ liệu ở A -> B cũng trống (bài học, giờ học, câu đã gặp, bộ từ)', memOf('B').length === 0 && sec('B') === 0 && get('B', 'ontap.recentq.v2', []).length === 0 && (spellOf('B') || { sets: [] }).sets.length === 0, JSON.stringify({ m: memOf('B').length, s: sec('B'), sp: spellOf('B') }))
study('B', 100); addLesson('B', ['Chia hết'])
for (const d of ['B', 'A', 'C', 'B']) await sync(d)
check('học sau khi xoá: 100 giây + "Chia hết" có ở A, B, C; giờ học cũ của C không quay lại', sec('A') === 100 && sec('B') === 100 && sec('C') === 100 && byKey('A', 'Chia hết').length === 1 && memOf('C').length === 1, `${sec('A')} ${sec('B')} ${sec('C')}`)

// Không có gì mới -> chỉ hỏi (1 lần gọi, không gửi bản dữ liệu)
const calls0 = server.calls
r = await sync('A')
check('không có gì mới -> một lần hỏi nhẹ, không gửi lại cả bản dữ liệu', r.ok && !r.changed && server.calls === calls0 + 1)

const fails = Object.entries(res).filter(([, v]) => !v)
console.log(fails.length ? `FAILED ${fails.length}/${Object.keys(res).length}: ` + fails.map(([n]) => n).join(' | ') : `ALL PASS ✓ (${Object.keys(res).length} checks)`)
