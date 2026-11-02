// Nhiều từ, không lặp lại (24/10/2026): thử thẳng máy chủ /api/arena (AI giả làm đúng lời dặn "không lặp lại các từ này").
import { execSync } from 'node:child_process'
const B = 'http://localhost:4192/api/arena', SHIM = 'http://127.0.0.1:4199', MOCK = 'http://localhost:4192/__mock/ai'
const res = {}; const check = (n, c, x = '') => { res[n] = !!c; console.log((c ? '  ✓ ' : '  ✗ ') + n + (c ? '' : '  → ' + x)) }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
async function post(who, body) {
  const r = await fetch(B, { method: 'POST', headers: { 'content-type': 'application/json', ...(who && who.token ? { authorization: 'Bearer ' + who.token } : {}) }, body: JSON.stringify({ pid: who && who.pid, ...(who && who.prof), ...body }) })
  return { ...(await r.json()), http: r.status }
}
const hello = async (prof) => ({ ...(await post(null, { action: 'hello', ...prof })), prof })
const mock = async (path = '') => (await fetch(MOCK + path)).json()
const stats = async () => (await (await fetch(SHIM + '/stats')).json()).commands
const redis = (cmd) => execSync(`redis-cli -p 6390 --raw ${cmd}`).toString()
const lc = (w) => String(w.w).toLowerCase()
const noDup = (arr) => new Set(arr.map(lc)).size === arr.length
// ván chỉ chốt được sau khi đã bắt đầu (hết 4 giây đếm ngược)
const started = async (st) => { const w = st.round.start - st.now + 300; if (w > 0) await sleep(w) }

await mock('/reset')
const a = await hello({ name: 'Alex', icon: '🦊', grade: 'Lớp 7' }), b = await hello({ name: 'Bin', icon: '🐻', grade: 'Lớp 4' }), c = await hello({ name: 'Chi', icon: '🐱', grade: 'Lớp 5' })
let s = await post(a, { action: 'create' }); const code = s.code
await post(b, { action: 'join', code })
s = await post(a, { action: 'config', code, game: 'bee', minutes: 5, req: '' })
check('phạm vi từ ghi rõ "hết từ thì AI tạo thêm, không lặp lại"', /không lặp lại/.test(s.cfg.ruleText), s.cfg.ruleText)
s = await post(a, { action: 'start', code })
const n = s.round.n, base = s.round.words
check('bắt đầu ván: AI tạo 25 từ chung', s.round.src === 'ai' && base.length === 25 && noDup(base), `${s.round.src} ${base && base.length}`)

// ---- xin thêm từ
let calls0 = (await mock()).calls.length
const m1 = await post(a, { action: 'more', code, n, wx: 0 })
const ex1 = (m1.more && m1.more.list) || []
const call1 = (await mock()).calls.at(-1)
check('xin thêm từ: AI tạo thêm ~25 từ MỚI (bắt đầu từ vị trí 0)', m1.ok && m1.more && m1.more.from === 0 && ex1.length >= 20 && noDup(ex1), JSON.stringify(m1).slice(0, 200))
check('AI được dặn tránh 25 từ đã có trong ván', call1 && call1.avoid === 25 && (await mock()).calls.length === calls0 + 1, JSON.stringify(call1))
const baseSet = new Set(base.map(lc))
check('từ thêm không trùng từ đã có (máy chủ lọc cả từ AI lỡ lặp lại)', ex1.every((w) => !baseSet.has(lc(w))), ex1.map(lc).filter((w) => baseSet.has(w)).join(','))
check('từ thêm đủ nghĩa + câu ví dụ', ex1.every((w) => w.w && w.vi && w.ex))

// ---- bạn khác nhận từ thêm qua "sync" (không tốn thêm lệnh kho)
let y = await post(b, { action: 'sync', code, wn: 0, wx: 0 })
check('máy mới vào ván: nhận bộ từ đầu + toàn bộ từ thêm', Array.isArray(y.round.words) && y.round.words.length === 25 && y.round.more && y.round.more.from === 0 && y.round.more.list.length === ex1.length)
y = await post(b, { action: 'sync', code, wn: n, wx: 0 })
check('máy đã có bộ từ đầu: chỉ nhận từ thêm', y.round.words === undefined && y.round.more && y.round.more.list.length === ex1.length)
y = await post(b, { action: 'sync', code, wn: n, wx: ex1.length })
check('máy đã đủ từ: không gửi lại', y.round.words === undefined && !y.round.more)
const c0 = await stats()
await post(b, { action: 'sync', code, wn: n, wx: ex1.length, n, p: 10, d: 1, c: 1 })
check('lúc đang chơi: mỗi lần gửi điểm vẫn chỉ tốn 6 lệnh kho', (await stats()) - c0 === 6, String((await stats()) - c0))
y = await post(b, { action: 'sync', code, wn: n })
check('máy bản cũ (không gửi wx): không nhận thêm gì lạ', !y.round.more)
calls0 = (await mock()).calls.length
const m2 = await post(b, { action: 'more', code, n, wx: 0 })
check('bạn xin thêm khi phòng đã có từ thêm: nhận ngay, không gọi AI lần nữa', m2.more && m2.more.from === 0 && m2.more.list.length === ex1.length && (await mock()).calls.length === calls0)

// ---- hai máy cùng xin một lúc: chỉ một lần nhờ AI
await mock('/delay/1500')
calls0 = (await mock()).calls.length
const [r1, r2] = await Promise.all([post(a, { action: 'more', code, n, wx: ex1.length }), sleep(150).then(() => post(b, { action: 'more', code, n, wx: ex1.length }))])
const got = [r1, r2].filter((r) => r.more), pend = [r1, r2].filter((r) => r.pending)
check('hai máy cùng xin: chỉ 1 lần nhờ AI, máy kia được báo "đang tạo"', (await mock()).calls.length === calls0 + 1 && got.length === 1 && pend.length === 1, JSON.stringify([r1, r2]).slice(0, 200))
await mock('/delay/20')
y = await post(b, { action: 'sync', code, wn: n, wx: ex1.length })
check('máy kia nhận từ mới ở lần hỏi phòng sau', y.round.more && y.round.more.from === ex1.length && y.round.more.list.length === got[0].more.list.length)

// ---- xin tới giới hạn 150 từ thêm mỗi ván
let all = ex1.concat(got[0].more.list), guard = 0, last = null
while (guard++ < 12) {
  last = await post(a, { action: 'more', code, n, wx: all.length })
  if (!last.more) break
  all = all.concat(last.more.list)
}
check('xin thêm nhiều lần: đúng tối đa 150 từ thêm, rồi máy chủ báo đủ', all.length === 150 && last.done === true, `${all.length} ${JSON.stringify(last).slice(0, 80)}`)
check('cả ván không có từ nào lặp lại (bộ đầu + mọi lần thêm)', noDup(base.concat(all)), String(base.length + all.length))
const scf = redis(`hget arena:room:${code}:sc w:${n}`)
check('từ thêm lưu ở ô "w:<ván>" của bảng điểm', JSON.parse(scf).length === all.length)

// ---- không phải thành viên
const nm = await post(c, { action: 'more', code, n, wx: 0 })
check('không ở trong phòng thì không xin được', nm.http === 403)

// ---- hết ván: nhớ từ đã chơi, ván sau không lặp lại
await started(s)
await post(a, { action: 'sync', code, wn: n, wx: all.length, n, p: 30, d: 3, c: 3, f: 1 })
y = await post(b, { action: 'sync', code, wn: n, wx: all.length, n, p: 20, d: 2, c: 2, f: 1 })
check('mọi bạn xong: chốt ván', y.status === 'results', y.status)
const meta = JSON.parse(redis(`get arena:room:${code}`))
check('phòng nhớ các từ đã chơi (bộ đầu + từ thêm) để tránh ở ván sau', Array.isArray(meta.hist) && meta.hist.length === Math.min(300, base.length + all.length), String(meta.hist && meta.hist.length))
check('xoá ô từ thêm của ván đã xong', redis(`hexists arena:room:${code}:sc w:${n}`).trim() === '0')
check('kết quả ván không còn gửi từ thêm', !y.round || !y.round.more)
calls0 = (await mock()).calls.length
s = await post(a, { action: 'start', code })
const base2 = s.round.words, call2 = (await mock()).calls.at(-1)
const hist = new Set(meta.hist)
check('ván 2: AI được dặn tránh các từ của ván 1', call2.avoid === meta.hist.length && (await mock()).calls.length === calls0 + 1, JSON.stringify(call2))
check('ván 2: bộ từ mới hoàn toàn (không trùng ván 1)', base2.length >= 20 && base2.every((w) => !hist.has(lc(w))), base2.map(lc).filter((w) => hist.has(w)).join(','))
y = await post(b, { action: 'sync', code, wn: s.round.n - 1, wx: 0 })
check('ván 2 chưa có từ thêm (không lẫn từ thêm của ván 1)', !y.round.more, JSON.stringify(y.round.more || '').slice(0, 80))

// ---- AI hỏng: dùng bộ từ dự phòng (lớn hơn, không lặp lại)
await mock('/fail/on')
const m3 = await post(a, { action: 'more', code, n: s.round.n, wx: 0 })
const fb = (m3.more && m3.more.list) || []
const seen2 = new Set([...hist, ...base2.map(lc)])
check('AI hỏng: vẫn có thêm 25 từ từ bộ dự phòng, không trùng từ đã chơi', fb.length === 25 && noDup(fb) && fb.every((w) => !seen2.has(lc(w)) && w.vi && w.ex), `${fb.length}`)
await started(s)
await post(a, { action: 'sync', code, wn: s.round.n, wx: fb.length, n: s.round.n, p: 0, d: 0, c: 0, f: 1 })
await post(b, { action: 'sync', code, wn: s.round.n, wx: fb.length, n: s.round.n, p: 0, d: 0, c: 0, f: 1 })
s = await post(a, { action: 'start', code })
const meta3 = JSON.parse(redis(`get arena:room:${code}`)), h3 = new Set(meta3.hist.slice(0, -0 || undefined))
check('AI hỏng lúc bắt đầu ván: bộ từ dự phòng 25 từ, tránh từ đã chơi', s.round.src === 'fallback' && s.round.words.length === 25 && s.round.words.every((w) => !fb.some((x) => lc(x) === lc(w))), `${s.round.src} ${s.round.words.length}`)
await mock('/fail/off')

// ---- phạm vi "từ của mình": xin thêm cũng được (khi đã chơi hết kho từ của mình)
await started(s)
await post(a, { action: 'sync', code, wn: s.round.n, wx: 0, n: s.round.n, f: 1 })
await post(b, { action: 'sync', code, wn: s.round.n, wx: 0, n: s.round.n, f: 1 })
s = await post(a, { action: 'config', code, req: '10 từ mới nhất' })
check('phạm vi "10 từ mới nhất": ghi rõ chơi 10 từ đó trước rồi sang từ khác, không lặp lại', /10 từ mới học gần nhất/.test(s.cfg.ruleText) && /không lặp lại/.test(s.cfg.ruleText), s.cfg.ruleText)
s = await post(a, { action: 'start', code })
const m4 = await post(a, { action: 'more', code, n: s.round.n, wx: 0 })
check('từ của mình đã hết: xin thêm được từ mới cho cả phòng', s.round.words === null && m4.more && m4.more.list.length >= 20, JSON.stringify(m4).slice(0, 120))

// ---- Scrabble: không có "xin thêm từ"
await started(s)
await post(a, { action: 'sync', code, n: s.round.n, f: 1 }); await post(b, { action: 'sync', code, n: s.round.n, f: 1 })
await post(a, { action: 'config', code, game: 'scrabble' })
s = await post(a, { action: 'start', code })
const m5 = await post(a, { action: 'more', code, n: s.round.n, wx: 0 })
check('Scrabble: xin thêm từ -> không làm gì (done)', m5.ok && m5.done && !m5.more)
await post(a, { action: 'sb_end', code, n: s.round.n })
await post(a, { action: 'leave', code })
console.log(Object.values(res).every(Boolean) ? `ALL PASS ✓ (${Object.keys(res).length} checks)` : 'FAILED: ' + Object.entries(res).filter(([, v]) => !v).map(([k]) => k).join(' | '))
