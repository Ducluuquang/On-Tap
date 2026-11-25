// Backend serverless (chuẩn Vercel). Giữ khóa API an toàn ở máy chủ.
// Trình duyệt gọi POST /api/ai với { action, ... } và KHÔNG bao giờ thấy khóa.
// Chi phí AI (anh duyệt 25/11/2026):
//  - CHỈ chạy khi có chìa khoá tài khoản hợp lệ (Authorization: Bearer <chìa khoá đăng nhập>); thiếu / sai -> 401 { error: "login" }.
//  - Trần đầu vào: generate count ≤ 20, mỗi chuỗi (chủ đề, tên khái niệm, ý nhỏ) ≤ 200 ký tự; extract ≤ 6 ảnh / tệp; judge mỗi chuỗi ≤ 500.
//  - Đếm token thật của mọi lời gọi AI, ghi tiền vào kho (api/_aicost.mjs); vượt trần tiền ngày của tài khoản -> 429 { error: "limit" }.
//  - generate: NGÂN HÀNG CÂU HỎI theo khái niệm + giới hạn lượt soạn mới mỗi con mỗi ngày (api/_qbank.mjs).
//  - Lỗi trả mã ngắn (không trả nguyên thông báo của máy chủ AI); chi tiết ghi console.error.
import { extractConcepts, extractFromText, generateQuestions, gradeHomework, judgeAnswer, subjKey } from './aiCore.mjs'
import { bookContext } from './_books/core.mjs'
import { send, readBody } from './_store.mjs'
import { userOf } from './_admin.mjs'
import { newCtx, recordCost, getAiCfg, overCap } from './_aicost.mjs'
import { bankGenerate, genAllowed, countGenRun, okQid } from './_qbank.mjs'

const KIND = { extract: 'extract', extract_text: 'extract', generate: 'gen', grade: 'grade', judge: 'judge' }
const cut = (s, n = 200) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim().slice(0, n)

// Lỗi của máy chủ AI -> mã ngắn (giống mapError của api/spelling.mjs)
export function aiErr(e) {
  const s = Number(e && e.status) || 0, t = String((e && e.type) || ''), m = String((e && e.message) || '')
  if (e instanceof SyntaxError) return [502, 'bad_output']
  if (/credit balance|billing/i.test(m)) return [402, 'no_credit']
  if (s === 401 || s === 403 || t === 'authentication_error' || t === 'permission_error') return [502, 'bad_key']
  if (s === 429 || t === 'rate_limit_error') return [429, 'rate_limited']
  if (s === 529 || t === 'overloaded_error') return [503, 'overloaded']
  if (t === 'invalid_request_error' || s === 400) return [400, 'bad_request']
  if (e && ['store_limit', 'store_error', 'no_store'].includes(e.code)) return [503, 'store']
  return [502, 'upstream']
}

// Đầu vào "generate" đã làm sạch + cắt trần
export function cleanGen(p0) {
  const p = p0 && typeof p0 === 'object' ? p0 : {}
  const concepts = (Array.isArray(p.concepts) ? p.concepts : []).slice(0, 12).map((c) => (typeof c === 'string'
    ? { name: cut(c), details: [] }
    : { name: cut(c && c.name), details: (Array.isArray(c && c.details) ? c.details : []).slice(0, 20).map((d) => cut(d)).filter(Boolean) }))
    .filter((c) => c.name)
  const n = Math.round(Number(p.count))
  return {
    subject: cut(p.subject) || 'Toán', grade: cut(p.grade), topic: cut(p.topic), concepts,
    count: Math.min(20, Math.max(1, Number.isFinite(n) && n > 0 ? n : 10)),
    format: p.format === 'open' ? 'open' : 'choice', master: !!p.master, enLang: p.enLang === 'en' ? 'en' : 'vi',
  }
}
// Model soạn câu theo nhóm môn (cài đặt cfg:ai): "sonnet" | "haiku"
export const genTier = (cfg, subject) => cfg.models[subjKey(subject)] || cfg.models.default || 'sonnet'

export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'method' })
  const key = process.env.ANTHROPIC_API_KEY
  if (!key) return send(res, 500, { error: 'no_key' })
  let body
  try { body = await readBody(req, 12000000) } catch (e) { return send(res, e && e.code === 'too_large' ? 413 : 400, { error: e && e.code === 'too_large' ? 'too_large' : 'bad_request' }) }
  body = body && typeof body === 'object' ? body : {}
  let u
  try { u = await userOf(req) } catch (e) { console.error('ai login check', e && (e.code || e.message)); return send(res, 503, { error: 'store' }) }
  if (!u) return send(res, 401, { error: 'login' })
  const action = String(body.action || '')
  if (!KIND[action]) return send(res, 400, { error: 'bad_action' })
  try { if (await overCap(u.phone, u.acc)) return send(res, 429, { error: 'limit' }) } catch (e) { console.error('ai cap check', e && (e.code || e.message)) }
  const ctx = newCtx(KIND[action], u.phone)
  let extra = {}
  try {
    if (action === 'extract') {
      const items = Array.isArray(body.items) && body.items.length
        ? body.items
        : [{ type: 'image', b64: body.image, media: body.media || 'image/jpeg' }]
      if (items.length > 6) return send(res, 400, { error: 'too_many' })
      return send(res, 200, await extractConcepts(key, items, 'image/jpeg', { ctx }))
    }
    if (action === 'extract_text') {
      return send(res, 200, await extractFromText(key, String(body.text || '').slice(0, 2000), { ctx }))
    }
    if (action === 'generate') {
      const p = cleanGen(body.payload)
      if (!p.concepts.length) return send(res, 400, { error: 'bad_request' })
      const childId = String(body.childId || '')
      if (!childId || !(u.acc.children || []).some((c) => c && c.id === childId)) return send(res, 400, { error: 'bad_child' })
      const recent = (Array.isArray(body.recent) ? body.recent : []).slice(0, 400).filter(okQid)
      const cfg = await getAiCfg()
      const tier = genTier(cfg, p.subject)
      // Thư viện sách chung (09/11/2026): đoạn sách đúng lớp + môn để AI tham khảo — CHỈ lấy khi phải soạn mới.
      const gen = async (concepts, n) => {
        const bookRef = await bookContext({ subject: p.subject, grade: p.grade, topic: p.topic, concepts })
        const qs = await generateQuestions(key, { ...p, concepts, count: n, bookRef, tier, ctx })
        const model = (ctx.uses[ctx.uses.length - 1] || {}).model || ''
        return (qs || []).map((q) => ({ ...q, model }))
      }
      const r = await bankGenerate(p, { recent, gen, gate: () => genAllowed(u.phone, childId, cfg.genLimit) })
      if (r.genRun) await countGenRun(u.phone, childId).catch(() => {})
      extra = { bank_q: r.source.bank, new_q: r.newQ, gen_runs: r.genRun ? 1 : 0 }
      return send(res, 200, { questions: r.questions, source: r.source, limited: r.limited, ...(r.limited ? { genLimit: cfg.genLimit } : {}) })
    }
    if (action === 'grade') {
      if (!body.image) return send(res, 400, { error: 'bad_request' })
      return send(res, 200, await gradeHomework(key, body.image, body.media || 'image/jpeg', { ctx }))
    }
    if (action === 'judge') {
      const p = body.payload && typeof body.payload === 'object' ? body.payload : {}
      const cfg = await getAiCfg()
      return send(res, 200, await judgeAnswer(key, { question: cut(p.question, 500), correct: cut(p.correct, 500), answer: cut(p.answer, 500) }, { tier: cfg.models.judge, ctx }))
    }
  } catch (e) {
    console.error('ai error', action, e && e.status, e && e.type, e && (e.message || e))
    const [st, code] = aiErr(e)
    return send(res, st, { error: code })
  } finally {
    await recordCost(ctx, extra)
  }
}
