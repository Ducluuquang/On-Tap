// Máy chủ thử cục bộ (giống Vercel): phục vụ bản build (dist) + các hàm /api/*.
//  - /api/ai        -> api/ai.mjs thật (Ôn Tập)
//  - /api/spelling  -> MOCK=1: AI giả (không tốn tiền, để thử giao diện); không có MOCK: api/spelling.mjs THẬT
//  - /api/ics       -> api/ics.mjs thật
//  - /api/arena     -> api/arena.mjs thật; kho = Redis thật qua lớp giả Upstash REST (upstash_shim.mjs). ARENA=0: chưa gắn kho.
//  - /api/account   -> api/account.mjs thật (tài khoản đăng nhập nhiều máy, cùng kho với Thi đấu). ARENA=0: chưa gắn kho.
// Khoá AI chỉ lấy từ biến môi trường, không ghi vào file.
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'

const DIST = process.env.DIST || path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', 'dist')
const PORT = Number(process.env.PORT || 4192)
const MOCK = process.env.MOCK === '1'
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.json': 'application/json', '.webmanifest': 'application/manifest+json' }
if (process.env.ARENA !== '0') { process.env.KV_REST_API_URL = process.env.KV_REST_API_URL || 'http://127.0.0.1:4199'; process.env.KV_REST_API_TOKEN = process.env.KV_REST_API_TOKEN || 'test-token' }
const FRUITS = [['apple', 'quả táo', '🍎'], ['banana', 'quả chuối', '🍌'], ['orange', 'quả cam', '🍊'], ['grape', 'quả nho', '🍇'], ['lemon', 'quả chanh', '🍋'],
  ['mango', 'quả xoài', '🥭'], ['peach', 'quả đào', '🍑'], ['pear', 'quả lê', '🍐'], ['cherry', 'quả anh đào', '🍒'], ['strawberry', 'quả dâu tây', '🍓'],
  ['watermelon', 'dưa hấu', '🍉'], ['pineapple', 'quả dứa', '🍍'], ['coconut', 'quả dừa', '🥥'], ['kiwi', 'quả kiwi', '🥝'], ['melon', 'dưa lưới', '🍈'],
  ['papaya', 'đu đủ', ''], ['plum', 'quả mận', ''], ['lime', 'chanh xanh', ''], ['avocado', 'quả bơ', '🥑'], ['guava', 'quả ổi', ''],
  ['durian', 'sầu riêng', ''], ['lychee', 'quả vải', ''], ['longan', 'nhãn', ''], ['jackfruit', 'mít', ''], ['tangerine', 'quýt', '']]
// MOCK=1: AI tạo bộ từ cho ván thi đấu cũng là AI giả (trả về nhanh, không tốn tiền).
// AI giả làm đúng lời dặn: tạo đúng N từ, KHÔNG lặp lại các từ trong danh sách "do not repeat any of them".
// Từ lấy trong từ điển Scrabble (từ thông dụng 4–8 chữ). /__mock/ai: số lần gọi + lời dặn gần nhất; fail/on|off; delay/<ms>.
const MOCKAI = { calls: [], fail: false, delay: 300 }
let MOCK_WORDS = null
async function mockWordList() {
  if (MOCK_WORDS) return MOCK_WORDS
  const txt = (await import('../api/_scrabble/words.mjs')).default
  MOCK_WORDS = txt.split('\n').filter((w) => /^[a-z]{4,8}$/.test(w))
  return MOCK_WORDS
}
if (MOCK) {
  process.env.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || 'mock-key'
  const realFetch = globalThis.fetch
  globalThis.fetch = async (url, opts) => {
    if (String(url).startsWith('https://api.anthropic.com/')) {
      const body = JSON.parse(opts.body)
      const prompt = String(body.messages[0].content)
      const count = Number((prompt.match(/List exactly (\d+)/) || [])[1] || 25)
      const avoidM = prompt.match(/do not repeat any of them: ([^\n]*)/)
      const avoid = new Set(avoidM ? avoidM[1].split(', ').map((x) => x.trim().toLowerCase()) : [])
      const topic = (prompt.match(/Topic \(may be written in Vietnamese or English\): "([^"]*)"/) || [])[1] || ''
      MOCKAI.calls.push({ count, avoid: avoid.size, topic, t: Date.now() })
      console.log('mock anthropic (arena words)', body.model, 'count', count, 'avoid', avoid.size, 'topic', topic)
      await new Promise((r) => setTimeout(r, MOCKAI.delay))
      if (MOCKAI.fail) return new Response(JSON.stringify({ error: { message: 'mock failure' } }), { status: 500, headers: { 'content-type': 'application/json' } })
      const words = []
      if (!avoid.size) for (const [w, vi, e] of FRUITS) { if (words.length < count) words.push({ w, vi, ex: `I like to eat a ${w}.`, e }) }
      else {
        // giống AI thật: thỉnh thoảng lỡ lặp lại 1 từ đã có (máy chủ phải tự lọc)
        const first = [...avoid][0]; if (first && /^[a-z]+$/.test(first)) words.push({ w: first, vi: 'từ lặp', ex: `This is a ${first}.`, e: '' })
        const list = await mockWordList()
        let i = (MOCKAI.calls.length * 7919) % list.length
        for (let k = 0; k < list.length && words.length < count; k++, i = (i + 13) % list.length) {
          const w = list[i]; if (avoid.has(w) || words.some((x) => x.w === w)) continue
          words.push({ w, vi: 'nghĩa của ' + w, ex: `We can see the ${w} here.`, e: '' })
        }
      }
      const text = ['{"name":"Fruits"}', ...words.map((o) => JSON.stringify(o))].join('\n')
      return new Response(JSON.stringify({ content: [{ type: 'text', text }], stop_reason: 'end_turn' }), { status: 200, headers: { 'content-type': 'application/json' } })
    }
    return realFetch(url, opts)
  }
}
const aiHandler = (await import('../api/ai.mjs')).default
const spellingHandler = (await import('../api/spelling.mjs')).default
const icsHandler = (await import('../api/ics.mjs')).default
const arenaHandler = (await import('../api/arena.mjs')).default
const accountHandler = (await import('../api/account.mjs')).default

// Vercel: res.status().json(), req.body = JSON đã đọc (khi Content-Type là JSON).
function vercelify(req, res, raw) {
  res.status = (c) => { res.statusCode = c; return res }
  res.json = (o) => { res.setHeader('content-type', 'application/json; charset=utf-8'); res.end(JSON.stringify(o)) }
  let body = raw
  if (/json/i.test(req.headers['content-type'] || '')) { try { body = raw ? JSON.parse(raw) : {} } catch { body = raw } }
  Object.defineProperty(req, 'body', { value: body, configurable: true })
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
async function mockSpelling(req, res, raw) {
  if (req.method === 'GET') { res.setHeader('content-type', 'application/json'); return res.end(JSON.stringify({ ok: true, ai: true })) }
  const b = JSON.parse(raw || '{}')
  res.statusCode = 200; res.setHeader('content-type', 'text/plain; charset=utf-8')
  const line = async (o) => { res.write(JSON.stringify(o) + '\n'); await sleep(15) }
  if (b.mode === 'topic') {
    await line({ name: 'Fruits' })
    const have = new Set((b.avoid || []).map((x) => String(x).toLowerCase()))
    let n = 0
    for (const [w, vi, e] of FRUITS) { if (n >= (b.count || 10)) break; if (have.has(w)) continue; await line({ w, vi, ex: `I like to eat a ${w}.`, e }); n++ }
  } else if (b.mode === 'enrich') {
    await line({ name: 'Bộ từ mới' })
    for (const it of b.items || []) await line({ orig: it.w, w: it.w, vi: it.vi || 'nghĩa của ' + it.w, ex: `This is a ${it.w}.`, e: '⭐' })
  } else if (b.mode === 'context') {
    for (const it of b.items || []) await line({ w: it.w, ex: `Every morning I eat one ${it.w} for breakfast.` })
  } else if (b.mode === 'register') {
    MOCKAI.calls.push({ mode: 'register', avoid: (b.avoid || []).length, t: Date.now() })
    const have = new Set((b.avoid || []).map((x) => String(x).toLowerCase()))
    let n = 0
    for (let i = 1; i <= 400 && n < (b.count || 8); i++) {
      const inf = 'casual' + String.fromCharCode(97 + (i % 26)) + String.fromCharCode(97 + Math.floor(i / 26) % 26), fml = 'formal' + inf.slice(6)
      if (have.has(inf) || have.has(fml)) continue
      await line({ inf, fml, vi: 'nghĩa ' + inf.slice(6), exi: `Hey, ${inf} works.`, exf: `The ${fml} is appropriate.` }); n++
    }
  } else { res.statusCode = 400; return res.end(JSON.stringify({ error: 'bad_request' })) }
  res.end()
}

const server = http.createServer((req, res) => {
  const url = req.url.split('?')[0]
  if (url.startsWith('/__mock/ai')) {
    const m = url.match(/^\/__mock\/ai(?:\/(reset|fail|delay)\/?(\w+)?)?$/)
    if (m && m[1] === 'reset') { MOCKAI.calls = []; MOCKAI.fail = false; MOCKAI.delay = 300 }
    if (m && m[1] === 'fail') MOCKAI.fail = m[2] === 'on'
    if (m && m[1] === 'delay') MOCKAI.delay = Number(m[2]) || 0
    res.setHeader('content-type', 'application/json'); return res.end(JSON.stringify(MOCKAI))
  }
  if (url.startsWith('/api/')) {
    let raw = ''
    req.setEncoding('utf8')
    req.on('data', (c) => { raw += c })
    req.on('end', async () => {
      try {
        if (url === '/api/ai') { vercelify(req, res, raw); await aiHandler(req, res) }
        else if (url === '/api/spelling') { if (MOCK) await mockSpelling(req, res, raw); else { vercelify(req, res, raw); await spellingHandler(req, res) } }
        else if (url === '/api/ics') { icsHandler(req, res) }
        else if (url === '/api/arena') { vercelify(req, res, raw); await arenaHandler(req, res) }
        else if (url === '/api/account') { vercelify(req, res, raw); await accountHandler(req, res) }
        else { res.statusCode = 404; res.end('not found') }
      } catch (e) { console.error('api error', e); if (!res.headersSent) { res.statusCode = 500; res.end(String(e)) } }
    })
    return
  }
  let p = path.join(DIST, decodeURIComponent(url))
  if (!p.startsWith(DIST)) { res.statusCode = 403; return res.end() }
  if (fs.existsSync(p) && fs.statSync(p).isDirectory()) p = path.join(p, 'index.html')
  if (!fs.existsSync(p)) p = path.join(DIST, 'index.html')
  res.setHeader('content-type', TYPES[path.extname(p)] || 'application/octet-stream')
  fs.createReadStream(p).pipe(res)
})
server.listen(PORT, () => console.log(`test server on ${PORT}${MOCK ? ' (MOCK AI)' : ''}`))
