// Backend serverless (chuẩn Vercel). Giữ khóa API an toàn ở máy chủ.
// Trình duyệt gọi POST /api/ai với { action, ... } và KHÔNG bao giờ thấy khóa.

import { extractConcepts, extractFromText, generateQuestions, gradeHomework, judgeAnswer } from './aiCore.mjs'
import { bookContext } from './_books/core.mjs'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Chỉ hỗ trợ POST' })
    return
  }
  const key = process.env.ANTHROPIC_API_KEY
  if (!key) {
    res.status(500).json({ error: 'Máy chủ chưa cấu hình ANTHROPIC_API_KEY' })
    return
  }
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {})
    const { action } = body
    if (action === 'extract') {
      const items = Array.isArray(body.items) && body.items.length
        ? body.items
        : [{ type: 'image', b64: body.image, media: body.media || 'image/jpeg' }]
      const data = await extractConcepts(key, items)
      res.status(200).json(data)
      return
    }
    if (action === 'extract_text') {
      const data = await extractFromText(key, String(body.text || '').slice(0, 2000))
      res.status(200).json(data)
      return
    }
    if (action === 'generate') {
      // Thư viện sách chung (09/11/2026): đoạn sách đúng lớp + môn của con để AI tham khảo (mọi tài khoản).
      // Không có sách khớp / kho lỗi -> bookRef rỗng, soạn như cũ. Không gửi nguyên văn sách về trình duyệt.
      const p = body.payload && typeof body.payload === 'object' ? body.payload : {}
      const bookRef = await bookContext({ subject: p.subject, grade: p.grade, topic: p.topic, concepts: Array.isArray(p.concepts) ? p.concepts.slice(0, 12) : [] })
      const questions = await generateQuestions(key, { ...p, bookRef })
      res.status(200).json({ questions })
      return
    }
    if (action === 'grade') {
      const data = await gradeHomework(key, body.image, body.media || 'image/jpeg')
      res.status(200).json(data)
      return
    }
    if (action === 'judge') {
      const data = await judgeAnswer(key, body.payload || {})
      res.status(200).json(data)
      return
    }
    res.status(400).json({ error: 'action không hợp lệ' })
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) })
  }
}
