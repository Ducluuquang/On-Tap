// Máy chủ thử cục bộ (giống Vercel): phục vụ bản build (dist) + các hàm /api/*.
//  - /api/ai        -> api/ai.mjs thật (Ôn Tập)
//  - /api/spelling  -> MOCK=1: AI giả (không tốn tiền, để thử giao diện); không có MOCK: api/spelling.mjs THẬT
//  - /api/ics       -> api/ics.mjs thật
//  - /api/arena     -> api/arena.mjs thật; kho = Redis thật qua lớp giả Upstash REST (upstash_shim.mjs). ARENA=0: chưa gắn kho.
//  - /api/account   -> api/account.mjs thật (tài khoản đăng nhập nhiều máy, cùng kho với Thi đấu). ARENA=0: chưa gắn kho.
//  - /api/books     -> api/books.mjs thật (THƯ VIỆN SÁCH, chỉ quản trị). Quản trị thử: ADMIN_PHONES (cổng 4192: 0912000777, 0912000778;
//    cổng 4194: KHÔNG có biến -> không ai nạp được). AI đọc chữ = Message Batches GIẢ (không gửi ảnh đi đâu):
//    /__mock/ocr (GET: các batch đã nhận + kích thước từng ảnh; POST {reset, books:{tên:{trang:[nửa trên, nửa dưới]}},
//    fail:[...], cut:[...], hold:true|false}). fail/cut: "<tên sách>|p3h1" -> lần đọc kế tiếp của nửa trang đó lỗi / bị cắt.
//  - /api/ai soạn câu hỏi (MOCK=1): trả câu hỏi giả; lời nhắc gửi AI ghi lại ở /__mock/ai (gen: 30 lời nhắc gần nhất).
//    Danh sách model giả: sonnet-5-5 (không nhận thinking "disabled", như thật), sonnet-5, opus-5-5, haiku-5-5.
//  - Gửi email (mã "Quên mật khẩu", api/_mail.mjs): KHÔNG gửi thật — MAIL_MOCK_FILE=tests/out/mail-<cổng>.jsonl (mỗi thư một dòng JSON).
//    MAIL=0: như máy chủ chưa cài gửi email (không có MAIL_USER / MAIL_APP_PASSWORD) -> "mail_off".
// Khoá AI chỉ lấy từ biến môi trường, không ghi vào file.
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'

const DIST = process.env.DIST || path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', 'dist')
const PORT = Number(process.env.PORT || 4192)
const MOCK = process.env.MOCK === '1'
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.json': 'application/json', '.mjs': 'text/javascript', '.webmanifest': 'application/manifest+json' }
if (process.env.MAIL === '0') { delete process.env.MAIL_MOCK_FILE; delete process.env.MAIL_USER; delete process.env.MAIL_APP_PASSWORD }
else {
  process.env.MAIL_MOCK_FILE = process.env.MAIL_MOCK_FILE || path.resolve(path.dirname(new URL(import.meta.url).pathname), 'out', `mail-${PORT}.jsonl`)
  process.env.MAIL_USER = process.env.MAIL_USER || 'ontap.app@example.com'
  delete process.env.MAIL_APP_PASSWORD
  fs.mkdirSync(path.dirname(process.env.MAIL_MOCK_FILE), { recursive: true })
}
process.env.BOOK_IDX_TTL_MS = process.env.BOOK_IDX_TTL_MS || '500'   // thử: danh sách sách chỉ nhớ 0,5 giây
if (process.env.ADMIN_PHONES == null && PORT === 4192) process.env.ADMIN_PHONES = '0912000777, 0912000778'
if (process.env.ARENA !== '0') { process.env.KV_REST_API_URL = process.env.KV_REST_API_URL || 'http://127.0.0.1:4199'; process.env.KV_REST_API_TOKEN = process.env.KV_REST_API_TOKEN || 'test-token' }
const FRUITS = [['apple', 'quả táo', '🍎'], ['banana', 'quả chuối', '🍌'], ['orange', 'quả cam', '🍊'], ['grape', 'quả nho', '🍇'], ['lemon', 'quả chanh', '🍋'],
  ['mango', 'quả xoài', '🥭'], ['peach', 'quả đào', '🍑'], ['pear', 'quả lê', '🍐'], ['cherry', 'quả anh đào', '🍒'], ['strawberry', 'quả dâu tây', '🍓'],
  ['watermelon', 'dưa hấu', '🍉'], ['pineapple', 'quả dứa', '🍍'], ['coconut', 'quả dừa', '🥥'], ['kiwi', 'quả kiwi', '🥝'], ['melon', 'dưa lưới', '🍈'],
  ['papaya', 'đu đủ', ''], ['plum', 'quả mận', ''], ['lime', 'chanh xanh', ''], ['avocado', 'quả bơ', '🥑'], ['guava', 'quả ổi', ''],
  ['durian', 'sầu riêng', ''], ['lychee', 'quả vải', ''], ['longan', 'nhãn', ''], ['jackfruit', 'mít', ''], ['tangerine', 'quýt', '']]
// MOCK=1: AI tạo bộ từ cho ván thi đấu cũng là AI giả (trả về nhanh, không tốn tiền).
// AI giả làm đúng lời dặn: tạo đúng N từ, KHÔNG lặp lại các từ trong danh sách "do not repeat any of them".
// Từ lấy trong từ điển Scrabble (từ thông dụng 4–8 chữ). /__mock/ai: số lần gọi + lời dặn gần nhất; fail/on|off; delay/<ms>.
const MOCKAI = { calls: [], fail: false, delay: 300, gen: [] }
// Message Batches giả (đọc chữ sách)
const OCR = { batches: [], status: {}, books: {}, fail: new Set(), cut: new Set(), hold: false, canceled: [], seq: 0 }
const jres = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json' } })
function jpegDims(buf) {
  if (buf[0] !== 0xff || buf[1] !== 0xd8) return null
  let i = 2
  while (i + 9 < buf.length) {
    if (buf[i] !== 0xff) { i++; continue }
    const m = buf[i + 1]
    if (m === 0xd8 || m === 0x01 || (m >= 0xd0 && m <= 0xd7)) { i += 2; continue }
    if ((m >= 0xc0 && m <= 0xc3) || (m >= 0xc5 && m <= 0xc7)) return { h: buf.readUInt16BE(i + 5), w: buf.readUInt16BE(i + 7) }
    i += 2 + buf.readUInt16BE(i + 2)
  }
  return null
}
function ocrText(title, page, half) {
  const b = OCR.books[title]
  if (b && b[page]) return b[page][half - 1] || '[Trống]'
  return half === 1 ? `# Trang ${page} của ${title}\nNội dung giả nửa trên trang ${page}.` : `Nội dung giả nửa dưới trang ${page}.\n[Trang in: ${page + 2}]`
}
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
    const u = String(url)
    if (u === 'https://api.anthropic.com/v1/models') return jres({ data: [{ id: 'claude-sonnet-5-5' }, { id: 'claude-sonnet-5' }, { id: 'claude-opus-5-5' }, { id: 'claude-haiku-5-5' }] })
    if (u.startsWith('https://api.anthropic.com/v1/messages/batches')) {
      const rest = u.slice('https://api.anthropic.com/v1/messages/batches'.length)
      if (!rest && opts && opts.method === 'POST') {
        const body = JSON.parse(opts.body)
        const id = 'msgbatch_mock' + (++OCR.seq)
        const items = body.requests.map((r) => {
          const img = r.params.messages[0].content.find((c) => c.type === 'image')
          const txt = r.params.messages[0].content.find((c) => c.type === 'text').text
          const m = /^Đây là (nửa trên|nửa dưới) của trang (\d+) trong sách (.+?)\. Chép lại CHÍNH XÁC/.exec(txt) || []
          const buf = Buffer.from(img.source.data, 'base64')
          return { cid: r.custom_id, title: m[3], page: Number(m[2]), half: m[1] === 'nửa trên' ? 1 : 2, bytes: buf.length, ...(jpegDims(buf) || {}),
            model: r.params.model, thinking: r.params.thinking || null, max_tokens: r.params.max_tokens, prompt: txt }
        })
        OCR.batches.push({ id, items, at: Date.now() })
        OCR.status[id] = OCR.hold ? 'in_progress' : 'ended'
        console.log('mock batch', id, items.length, 'nửa trang')
        return jres({ id, type: 'message_batch', processing_status: 'in_progress' })
      }
      const m = /^\/(msgbatch_mock\d+)(\/results|\/cancel)?$/.exec(rest)
      if (!m) return jres({ error: { type: 'not_found_error', message: 'not found' } }, 404)
      const bt = OCR.batches.find((x) => x.id === m[1])
      if (!bt) return jres({ error: { type: 'not_found_error', message: 'not found' } }, 404)
      if (m[2] === '/cancel') { OCR.canceled.push(bt.id); OCR.status[bt.id] = 'canceled'; return jres({ id: bt.id, processing_status: 'canceling' }) }
      if (!m[2]) {
        const st = OCR.status[bt.id] === 'in_progress' && !OCR.hold ? (OCR.status[bt.id] = 'ended') : OCR.status[bt.id]
        return jres({ id: bt.id, processing_status: st === 'canceled' ? 'ended' : st, results_url: 'https://api.anthropic.com/v1/messages/batches/' + bt.id + '/results' })
      }
      const lines = bt.items.map((it) => {
        const k = it.title + '|' + it.cid
        if (OCR.status[bt.id] === 'canceled') return { custom_id: it.cid, result: { type: 'canceled' } }
        if (OCR.fail.has(k)) { OCR.fail.delete(k); return { custom_id: it.cid, result: { type: 'errored', error: { type: 'error', error: { type: 'overloaded_error', message: 'mock' } } } } }
        const text = ocrText(it.title, it.page, it.half)
        if (OCR.cut.has(k)) { OCR.cut.delete(k); return { custom_id: it.cid, result: { type: 'succeeded', message: { content: [{ type: 'text', text: text.slice(0, 12) }], stop_reason: 'max_tokens' } } } }
        return { custom_id: it.cid, result: { type: 'succeeded', message: { content: [{ type: 'text', text }], stop_reason: 'end_turn' } } }
      })
      return new Response(lines.map((l) => JSON.stringify(l)).join('\n') + '\n', { status: 200, headers: { 'content-type': 'application/binary' } })
    }
    if (u.startsWith('https://api.anthropic.com/')) {
      const body = JSON.parse(opts.body)
      // như model thật: sonnet-5-5 không nhận thinking "disabled"
      if (body.model === 'claude-sonnet-5-5' && body.thinking && body.thinking.type === 'disabled') return jres({ type: 'error', error: { type: 'invalid_request_error', message: 'thinking.type "disabled" is not supported for this model' } }, 400)
      const allText = (body.messages[0].content || []).map ? [].concat(body.messages[0].content).map((c) => (typeof c === 'string' ? c : c.text || '')).join('\n') : String(body.messages[0].content)
      if (allText.includes('{"questions":[')) {
        // soạn câu hỏi (api/aiCore.mjs): ghi lại lời nhắc, trả câu giả
        const n = Number((/Tạo (\d+) câu/.exec(allText) || [])[1] || 3)
        await new Promise((r) => setTimeout(r, 1500))   // như AI thật: soạn câu mất vài giây (app hiện "Đang chuẩn bị…")
        MOCKAI.gen.push({ model: body.model, thinking: body.thinking || null, prompt: allText, t: Date.now() }); if (MOCKAI.gen.length > 30) MOCKAI.gen.shift()
        const open = allText.includes('"answer":"","explain":""}]}') && !allText.includes('"options"')
        const qs = Array.from({ length: n }, (_, i) => open
          ? { concept: '', q: `Câu hỏi giả ${i + 1} (${Math.random().toString(36).slice(2, 6)})`, answer: 'đáp án', explain: 'Giải thích giả.' }
          : { concept: '', q: `Câu hỏi giả ${i + 1} (${Math.random().toString(36).slice(2, 6)})`, options: ['Đúng', 'Sai một', 'Sai hai', 'Sai ba'], answer: 'Đúng', explain: 'Giải thích giả.' })
        return jres({ content: [{ type: 'text', text: JSON.stringify({ questions: qs }) }], stop_reason: 'end_turn' })
      }
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
const booksHandler = (await import('../api/books.mjs')).default

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
    if (m && m[1] === 'reset') { MOCKAI.calls = []; MOCKAI.fail = false; MOCKAI.delay = 300; MOCKAI.gen = [] }
    if (m && m[1] === 'fail') MOCKAI.fail = m[2] === 'on'
    if (m && m[1] === 'delay') MOCKAI.delay = Number(m[2]) || 0
    res.setHeader('content-type', 'application/json'); return res.end(JSON.stringify(MOCKAI))
  }
  if (url === '/__mock/ocr') {
    let raw = ''
    req.on('data', (c) => { raw += c })
    req.on('end', () => {
      if (req.method === 'POST') {
        const b = JSON.parse(raw || '{}')
        if (b.reset) { OCR.batches = []; OCR.status = {}; OCR.books = {}; OCR.fail.clear(); OCR.cut.clear(); OCR.hold = false; OCR.canceled = [] }
        if (b.books) Object.assign(OCR.books, b.books)
        for (const k of b.fail || []) OCR.fail.add(k)
        for (const k of b.cut || []) OCR.cut.add(k)
        if (typeof b.hold === 'boolean') OCR.hold = b.hold
      }
      res.setHeader('content-type', 'application/json')
      res.end(JSON.stringify({ batches: OCR.batches.map((x) => ({ id: x.id, status: OCR.status[x.id], items: x.items.map(({ prompt, ...r }) => ({ ...r, prompt: prompt.slice(0, 400) })) })), canceled: OCR.canceled, hold: OCR.hold }))
    })
    return
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
        else if (url === '/api/books') { vercelify(req, res, raw); await booksHandler(req, res) }
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
