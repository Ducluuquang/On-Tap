// Giả lập API REST của Upstash (/pipeline) bằng một Redis THẬT chạy trên máy thử — để thử phần Thi đấu
// đúng như khi chạy trên Vercel + Upstash (cùng đường REST, cùng cách Redis xử lý lệnh).
// Đếm lệnh (Upstash tính tiền theo từng lệnh, kể cả lệnh trong pipeline): GET /stats, POST /stats/reset.
// Giả lập kho hết lượt miễn phí của tháng: POST /limit/on, POST /limit/off (Upstash trả lỗi "max requests limit exceeded").
import http from 'node:http'
import net from 'node:net'
const PORT = Number(process.env.SHIM_PORT || 4199)
const REDIS_PORT = Number(process.env.REDIS_PORT || 6390)
const TOKEN = process.env.SHIM_TOKEN || 'test-token'
let commandCount = 0, perCmd = {}, LIMIT = false

function encode(cmds) {
  const parts = []
  for (const c of cmds) {
    parts.push(Buffer.from('*' + c.length + '\r\n'))
    for (const a of c) { const b = Buffer.from(String(a), 'utf8'); parts.push(Buffer.from('$' + b.length + '\r\n'), b, Buffer.from('\r\n')) }
  }
  return Buffer.concat(parts)
}
function parse(buf, i) {
  if (i >= buf.length) return null
  const end = buf.indexOf('\r\n', i)
  if (end < 0) return null
  const t = String.fromCharCode(buf[i]), line = buf.toString('utf8', i + 1, end)
  if (t === '+') return { v: line, n: end + 2 }
  if (t === '-') return { v: { __err: line }, n: end + 2 }
  if (t === ':') return { v: Number(line), n: end + 2 }
  if (t === '$') { const len = Number(line); if (len < 0) return { v: null, n: end + 2 }; const s = end + 2, e = s + len; if (buf.length < e + 2) return null; return { v: buf.toString('utf8', s, e), n: e + 2 } }
  if (t === '*') { const len = Number(line); if (len < 0) return { v: null, n: end + 2 }; const arr = []; let p = end + 2; for (let k = 0; k < len; k++) { const r = parse(buf, p); if (!r) return null; arr.push(r.v); p = r.n } return { v: arr, n: p } }
  throw new Error('bad reply ' + t)
}
function run(cmds) {
  return new Promise((resolve, reject) => {
    const sock = net.connect({ host: '127.0.0.1', port: REDIS_PORT })
    let buf = Buffer.alloc(0); const out = []
    sock.on('connect', () => sock.write(encode(cmds)))
    sock.on('data', (ch) => {
      buf = Buffer.concat([buf, ch])
      while (out.length < cmds.length) { const r = parse(buf, 0); if (!r) break; out.push(r.v); buf = buf.subarray(r.n) }
      if (out.length === cmds.length) { sock.destroy(); resolve(out) }
    })
    sock.on('error', reject)
  })
}
http.createServer((req, res) => {
  if (req.url === '/stats' && req.method === 'GET') { res.setHeader('content-type', 'application/json'); return res.end(JSON.stringify({ commands: commandCount, perCmd })) }
  if (req.url === '/stats/reset' && req.method === 'POST') { commandCount = 0; perCmd = {}; return res.end('{"ok":true}') }
  if (req.url === '/limit/on' && req.method === 'POST') { LIMIT = true; return res.end('{"ok":true}') }
  if (req.url === '/limit/off' && req.method === 'POST') { LIMIT = false; return res.end('{"ok":true}') }
  if (req.method !== 'POST' || req.url !== '/pipeline') { res.statusCode = 404; return res.end('{"error":"not found"}') }
  if (req.headers.authorization !== 'Bearer ' + TOKEN) { res.statusCode = 401; return res.end('{"error":"Unauthorized"}') }
  if (LIMIT) { res.statusCode = 400; res.setHeader('content-type', 'application/json'); return res.end('{"error":"ERR max requests limit exceeded. Limit: 500000, Usage: 500000. See https://upstash.com/docs/redis/troubleshooting/max_requests_limit for details"}') }
  let body = ''
  req.on('data', (c) => { body += c })
  req.on('end', async () => {
    try {
      const cmds = JSON.parse(body)
      if (!Array.isArray(cmds) || !cmds.every((c) => Array.isArray(c) && c.every((x) => typeof x === 'string'))) { res.statusCode = 400; return res.end('{"error":"bad pipeline"}') }
      commandCount += cmds.length
      for (const c of cmds) perCmd[c[0]] = (perCmd[c[0]] || 0) + 1
      const out = await run(cmds)
      res.setHeader('content-type', 'application/json')
      res.end(JSON.stringify(out.map((v) => (v && v.__err ? { error: v.__err } : { result: v }))))
    } catch (e) { res.statusCode = 500; res.end(JSON.stringify({ error: String(e) })) }
  })
}).listen(PORT, () => console.log('upstash shim on', PORT, '-> redis', REDIS_PORT))
