// Kho Upstash hết lượt miễn phí của tháng ("max requests limit exceeded"): máy chủ báo rõ store_limit, không treo — cả với Scrabble.
const B = 'http://localhost:4192/api/arena', SHIM = 'http://127.0.0.1:4199'
const res = {}; const check = (n, c, x = '') => { res[n] = !!c; console.log((c ? '  ✓ ' : '  ✗ ') + n + (c ? '' : '  → ' + x)) }
async function post(who, body) {
  const r = await fetch(B, { method: 'POST', headers: { 'content-type': 'application/json', ...(who && who.token ? { authorization: 'Bearer ' + who.token } : {}) }, body: JSON.stringify({ pid: who && who.pid, ...(who && who.prof), ...body }) })
  return { ...(await r.json()), http: r.status }
}
const hello = async (prof) => ({ ...(await post(null, { action: 'hello', ...prof })), prof })
const limit = (on) => fetch(SHIM + '/limit/' + (on ? 'on' : 'off'), { method: 'POST' })
try {
  await limit(false)
  const a = await hello({ name: 'Alex', icon: '🦊', grade: 'Lớp 7' }), b = await hello({ name: 'Bin', icon: '🐻', grade: 'Lớp 4' })
  const s = await post(a, { action: 'create' }); const code = s.code
  await post(b, { action: 'join', code })
  await limit(true)
  const h = await post(a, { action: 'hello' })
  check('hết lượt: bạn đã có chìa khoá vẫn được nhận (không cần hỏi kho)', h.ok && h.pid === a.pid)
  const h2 = await post(null, { action: 'hello', name: 'Chi' })
  check('hết lượt: bạn mới -> báo store_limit (503)', h2.http === 503 && h2.error === 'store_limit')
  const c = await post(a, { action: 'create' })
  check('hết lượt: tạo phòng -> báo store_limit', c.http === 503 && c.error === 'store_limit')
  const y = await post(a, { action: 'sync', code })
  check('hết lượt: hỏi phòng -> báo store_limit', y.http === 503 && y.error === 'store_limit')
  const sv = await post(a, { action: 'solo' })
  check('hết lượt: Scrabble với Bạn AI -> báo store_limit', sv.http === 503 && sv.error === 'store_limit')
  const r = await post(b, { action: 'random', level: 'k35' })
  check('hết lượt: thách đấu ngẫu nhiên -> báo store_limit', r.http === 503 && r.error === 'store_limit')
  await limit(false)
  const y2 = await post(a, { action: 'sync', code })
  check('có lượt lại: phòng vẫn còn, chơi tiếp được', y2.ok && y2.code === code && y2.players.length === 2)
  await post(a, { action: 'leave', code })
} finally { await limit(false) }
console.log(Object.values(res).every(Boolean) ? `ALL PASS ✓ (${Object.keys(res).length} checks)` : 'FAILED: ' + Object.entries(res).filter(([, v]) => !v).map(([k]) => k).join(' | '))
