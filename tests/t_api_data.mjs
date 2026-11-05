// ĐỒNG BỘ DỮ LIỆU HỌC (05/11/2026): thử thẳng máy chủ /api/account, hành động "data" (Redis thật qua lớp giả Upstash).
// Hỏi khi chưa có gì, gửi bản đầu, gửi lại y hệt (same, không tăng phiên bản), máy thứ hai gửi -> bản gộp có cả hai máy,
// hỏi theo phiên bản, con không thuộc tài khoản / chìa khoá giả, cài đặt "_settings", 6 máy gửi cùng lúc không mất phần nào
// (khoá ngắn; gộp xong mở khoá, khoá đang bị giữ thì "busy", mở khoá không xoá khoá của lần gộp khác), dữ liệu lưu nén
// trong kho, dữ liệu sai kiểu bị lọc, quá lớn bị từ chối, đếm số lệnh kho mỗi lần.
import { execFileSync } from 'node:child_process'
import { UNLOCK } from '../api/account.mjs'
const BASE = 'http://localhost:4192/api/account', SHIM = 'http://127.0.0.1:4199'
const res = {}; const check = (n, c, x = '') => { res[n] = !!c; console.log((c ? '  ✓ ' : '  ✗ ') + n + (c ? '' : '  → ' + x)) }
const RUN = String(Date.now()).slice(-6)
const IP = '10.8.' + (Number(RUN) % 250) + '.'
let ipN = 1
async function call(action, body = {}, token = '') {
  const r = await fetch(BASE, { method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': IP + (ipN++ % 250), ...(token ? { authorization: 'Bearer ' + token } : {}) }, body: JSON.stringify({ action, ...body }) })
  let j = {}; try { j = await r.json() } catch {}
  return { ...j, http: r.status }
}
const rget = (k) => execFileSync('redis-cli', ['-p', '6390', '--raw', 'GET', k]).toString().trim()
const today = new Date().toISOString().slice(0, 10)
const P = '0911' + RUN
const reg = await call('register', { phone: P, pass: '12345678', parentName: 'Ba', plan: 2, children: [{ id: 'kA' + RUN, name: 'An' }, { id: 'kB' + RUN, name: 'Bình' }] })
const T = reg.token, KA = 'kA' + RUN, KB = 'kB' + RUN
check('chuẩn bị: đăng ký tài khoản thử (máy chủ thử, không phải máy chủ thật)', reg.ok && !!T, JSON.stringify(reg).slice(0, 120))

const devDoc = (dev, secs, extra = {}) => ({ v: 1, resetAt: 0, mem: { items: {}, dead: {} }, recent: [], goal: null, dev: { [dev]: { e: 0, days: { [today]: secs }, log: {} } }, spell: null, ...extra })
let j = await call('data', { child: KA, rev: 0 }, T)
check('chưa có gì: hỏi -> rev 0, doc null', j.ok && j.rev === 0 && j.doc === null, JSON.stringify(j))
const d1 = devDoc('dA', 300, { mem: { items: { 'c-1': { id: 'c-1', name: 'Phân số', updatedAt: 10, correct: 3 } }, dead: {} }, recent: ['q1'] })
j = await call('data', { child: KA, doc: d1 }, T)
check('máy A gửi bản đầu -> rev 1, giống hệt bản gửi (same)', j.ok && j.rev === 1 && j.same === true, JSON.stringify(j))
const raw = rget('acct:d:' + P + ':' + KA)
check('trong kho: dữ liệu học lưu NÉN (gz:…), số phiên bản riêng', raw.startsWith('gz:') && !raw.includes('Phân số') && rget('acct:dr:' + P + ':' + KA) === '1', raw.slice(0, 40))
j = await call('data', { child: KA, doc: d1 }, T)
check('gửi lại y hệt -> same, phiên bản không tăng (rev 1)', j.ok && j.same === true && j.rev === 1, JSON.stringify(j))
j = await call('data', { child: KA, doc: devDoc('dB', 120) }, T)
const total = (doc) => Object.values(doc.dev).reduce((s, e) => s + (e.days[today] || 0), 0)
check('máy B gửi -> rev 2, trả bản gộp: có bài học của A + giờ học của cả hai máy (300 + 120)', j.ok && j.rev === 2 && !!j.doc && j.doc.mem.items['c-1'].correct === 3 && total(j.doc) === 420 && j.doc.recent[0] === 'q1', JSON.stringify(j).slice(0, 300))
j = await call('data', { child: KA, rev: 2 }, T)
check('hỏi với phiên bản đang có (2) -> same, không gửi cả bản dữ liệu', j.ok && j.same === true && !j.doc, JSON.stringify(j))
j = await call('data', { child: KA, rev: 1 }, T)
check('hỏi với phiên bản cũ (1) -> nhận bản mới nhất (rev 2)', j.ok && j.rev === 2 && total(j.doc) === 420)
j = await call('data', { child: KB, rev: 0 }, T)
check('con thứ hai có dữ liệu riêng (chưa có gì)', j.ok && j.rev === 0 && j.doc === null)
j = await call('data', { child: 'kX' + RUN, rev: 0 }, T)
check('con không thuộc tài khoản -> no_child', j.ok === false && j.error === 'no_child', JSON.stringify(j))
j = await call('data', { child: KA, rev: 0 }, 'x' + T.slice(1))
check('chìa khoá giả -> bad_token', j.ok === false && j.error === 'bad_token', JSON.stringify(j))
const reg2 = await call('register', { phone: '0912' + RUN, pass: '12345678', children: [{ id: 'kZ' + RUN, name: 'Zi' }] })
j = await call('data', { child: KA, rev: 0 }, reg2.token)
check('tài khoản khác không đọc được dữ liệu con của tài khoản này -> no_child', j.ok === false && j.error === 'no_child', JSON.stringify(j))

// cài đặt phụ huynh: tài liệu "_settings", bản đổi sau cùng thắng
j = await call('data', { child: '_settings', doc: { v: 1, settings: { v: { allowChoice: false }, at: 200 } } }, T)
const j2 = await call('data', { child: '_settings', doc: { v: 1, settings: { v: { allowChoice: true }, at: 100 } } }, T)
check('cài đặt "_settings": bản đổi sau cùng thắng (bản cũ hơn gửi sau không đè)', j.ok && j2.ok && j2.doc && j2.doc.settings.v.allowChoice === false, JSON.stringify(j2).slice(0, 200))

// 6 máy gửi CÙNG LÚC -> bản cuối có đủ cả 6 (khoá ngắn: lần lượt gộp, không máy nào ghi đè mất phần của máy kia)
const many = await Promise.all([1, 2, 3, 4, 5, 6].map((n) => call('data', { child: KB, doc: devDoc('p' + n, n * 10, { mem: { items: { ['m' + n]: { id: 'm' + n, name: 'Mục ' + n, updatedAt: n } }, dead: {} } }) }, T)))
j = await call('data', { child: KB, rev: 0 }, T)
check('6 máy gửi cùng lúc -> cả 6 ok; bản cuối có đủ 6 mục + giờ học 10+20+…+60 = 210', many.every((x) => x.ok) && Object.keys(j.doc.mem.items).length === 6 && total(j.doc) === 210, JSON.stringify(many.map((x) => x.error || x.rev)) + ' ' + JSON.stringify(j).slice(0, 200))
check('gộp xong thì mở khoá (trong kho không còn khoá acct:dl:…)', rget('acct:dl:' + P + ':' + KB) === '' && rget('acct:dl:' + P + ':' + KA) === '', rget('acct:dl:' + P + ':' + KB))
// máy khác đang giữ khoá quá lâu -> chờ rồi báo "busy" (máy sẽ tự gửi lại sau), không ghi, không đụng khoá của máy kia
const LKB = 'acct:dl:' + P + ':' + KB, revB = rget('acct:dr:' + P + ':' + KB)
execFileSync('redis-cli', ['-p', '6390', 'SET', LKB, 'khoa-may-khac', 'PX', '20000'])
j = await call('data', { child: KB, doc: devDoc('pz', 5) }, T)
check('khoá đang bị máy khác giữ -> "busy", không ghi, khoá của máy kia còn nguyên', j.ok === false && j.error === 'busy' && rget('acct:dr:' + P + ':' + KB) === revB && rget(LKB) === 'khoa-may-khac', JSON.stringify(j) + ' ' + rget(LKB))
execFileSync('redis-cli', ['-p', '6390', 'DEL', LKB])
// mở khoá chỉ xoá khoá CỦA CHÍNH LẦN GỘP ĐÓ (khoá đã hết hạn và máy khác vừa giữ thì để nguyên)
const LKT = 'acct:dl:thu:' + RUN
execFileSync('redis-cli', ['-p', '6390', 'SET', LKT, 'cua-minh', 'PX', '20000'])
execFileSync('redis-cli', ['-p', '6390', 'EVAL', UNLOCK, '1', LKT, 'cua-may-khac'])
const keepT = rget(LKT)
execFileSync('redis-cli', ['-p', '6390', 'EVAL', UNLOCK, '1', LKT, 'cua-minh'])
check('mở khoá: không xoá khoá của lần gộp khác; xoá đúng khoá của mình', keepT === 'cua-minh' && rget(LKT) === '', keepT + ' / ' + rget(LKT))

// dữ liệu sai kiểu bị lọc, không làm hỏng bản trên máy chủ
j = await call('data', { child: KB, doc: { mem: { items: { __proto__: { a: 1 }, 'bad id!': {}, ok2: 'chuỗi' }, dead: 'x' }, dev: [1, 2], recent: 'q', spell: 7, resetAt: 'abc' } }, T)
const j3 = await call('data', { child: KB, rev: 0 }, T)
check('dữ liệu sai kiểu -> bị lọc (không lỗi), bản trên máy chủ vẫn nguyên 6 mục + 210 giây', j.ok && Object.keys(j3.doc.mem.items).length === 6 && total(j3.doc) === 210, JSON.stringify(j).slice(0, 200))

// quá lớn -> too_big (không lưu)
const huge = { mem: { items: {} } }
for (let i = 0; i < 9000; i++) huge.mem.items['h' + i] = { id: 'h' + i, name: 'x'.repeat(700), updatedAt: 1 }
j = await call('data', { child: KB, doc: huge }, T)
check('bản dữ liệu quá lớn (> 6 MB) -> too_big, không lưu', j.ok === false && j.error === 'too_big', JSON.stringify(j).slice(0, 120))

// số lệnh kho mỗi lần (Upstash tính tiền theo lệnh)
await fetch(SHIM + '/stats/reset', { method: 'POST' })
await call('data', { child: KA, rev: 2 }, T)
const sGet = (await (await fetch(SHIM + '/stats')).json()).commands
await fetch(SHIM + '/stats/reset', { method: 'POST' })
await call('data', { child: KA, doc: devDoc('dA', 360) }, T)
const sPut = (await (await fetch(SHIM + '/stats')).json()).commands
check(`số lệnh kho: hỏi bản mới (không đổi) ${sGet} lệnh; gửi bản có thay đổi ${sPut} lệnh`, sGet <= 3 && sPut <= 9, `${sGet} ${sPut}`)

const fails = Object.entries(res).filter(([, v]) => !v)
console.log(fails.length ? `FAILED ${fails.length}/${Object.keys(res).length}: ` + fails.map(([n]) => n).join(' | ') : `ALL PASS ✓ (${Object.keys(res).length} checks)`)
