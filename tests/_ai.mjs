// Tiện ích chung cho các bộ thử CHI PHÍ AI (25/11/2026): t_api_ai, t_ai_bank, t_ai_limit, t_ai_cost, t_ai_model, t_ui_aicost.
// Máy chủ thử 4192 (AI giả MOCK=1, kho = Redis thử qua lớp giả Upstash 4199). Không gọi AI thật, không đụng kho thật.
export const BASE = process.env.BASE || 'http://localhost:4192'
export const SHIM = 'http://127.0.0.1:4199'
export const SUPER = '0912000777'   // super admin của máy chủ thử (ADMIN_PHONES giả)
export const PASS = '12345678'
export const RUN = String(Date.now()).slice(-6)
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
export const results = {}
export const check = (n, c, x = '') => { results[n] = c ? 'PASS' : 'FAIL'; console.log((c ? '  ✓ ' : '  ✗ ') + n + (c || !x ? '' : '  → ' + String(x).slice(0, 600))) }
export function finish(extra = '') {
  const fails = Object.entries(results).filter(([, v]) => v !== 'PASS')
  console.log(fails.length ? `\n${fails.length} FAIL` : `\nALL PASS ✓ (${Object.keys(results).length} checks${extra})`)
  process.exit(fails.length ? 1 : 0)
}
let ipn = 0
const ip = () => '10.31.' + (Number(RUN) % 250) + '.' + (1 + (ipn++ % 250))
export async function post(p, body, token = '', raw = false) {
  const r = await fetch(BASE + p, { method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': ip(), ...(token ? { authorization: 'Bearer ' + token } : {}) }, body: JSON.stringify(body) })
  if (raw) return r
  const text = await r.text()
  let j = {}
  try { j = JSON.parse(text) } catch { j = { _text: text } }
  return { ...j, _status: r.status, _raw: text }
}
export const acct = (action, body, token) => post('/api/account', { action, ...body }, token)
export const adm = (action, body, token) => post('/api/admin', { action, ...body }, token)
export const ai = (body, token) => post('/api/ai', body, token)
export const gen = (payload, { token, childId, recent = [] } = {}) => post('/api/ai', { action: 'generate', payload, childId, recent }, token)
export const mock = async (p = '') => (await fetch(BASE + '/__mock/ai' + p)).json()
export const day = async (d) => (await fetch(BASE + '/__mock/day/' + (d || 'off'))).json()
export const store = async (cmds) => (await (await fetch(SHIM + '/pipeline', { method: 'POST', headers: { authorization: 'Bearer test-token' }, body: JSON.stringify(cmds) })).json()).map((x) => x.result)
export const hash = (r) => { const o = {}; for (let i = 0; i + 1 < (r || []).length; i += 2) o[r[i]] = Number(r[i + 1]); return o }
export const aiDay = async (d) => hash((await store([['HGETALL', 'ai:d:' + d]]))[0])
// Ngày giờ Việt Nam (UTC+7), giống api/_aicost.mjs
export const vnToday = () => new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10)
// Đăng ký (hoặc đăng nhập lại) một tài khoản thử có các con
export async function account(phone, kids = [{ id: 'k' + phone.slice(-6), grade: 'Lớp 4' }]) {
  const children = kids.map((k, i) => ({ id: k.id, name: k.name || 'Con' + (i + 1), pin: '1', icon: '🦊', grade: k.grade || '' }))
  const r = await acct('register', { phone, pass: PASS, parentName: 'PH ' + phone.slice(-4), plan: Math.max(1, children.length), pin: '1', children })
  return r.ok ? r.token : (await acct('login', { id: phone, pass: PASS })).token
}
export const superToken = () => account(SUPER, [{ id: 'kSup' + RUN, grade: 'Lớp 7' }])
// Số câu AI giả được nhờ soạn trong các lời nhắc (cộng "Tạo N câu" của mọi đợt)
export const askedN = (prompts) => prompts.reduce((s, g) => s + Number((/Tạo (\d+) câu/.exec(g.prompt) || [])[1] || 0), 0)
export const DEFAULT_CFG = { models: { toan: 'sonnet', 'tieng-viet': 'sonnet', 'tieng-anh': 'sonnet', 'ngu-van': 'sonnet', default: 'sonnet', spelling: 'sonnet', judge: 'sonnet' }, genLimit: 5, capVnd: 10000, rate: 26000 }
export async function restoreCfg(tS) { await adm('ai_cfg_set', DEFAULT_CFG, tS); await day('off'); await mock('/reset') }
// Đọc hết luồng của /api/spelling
export async function spelling(body, token) {
  const r = await post('/api/spelling', body, token, true)
  const text = await r.text()
  return { status: r.status, text, lines: text.split('\n').filter((l) => l.trim().startsWith('{')).map((l) => { try { return JSON.parse(l) } catch { return null } }).filter(Boolean) }
}
