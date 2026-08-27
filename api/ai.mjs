// Backend serverless (chuẩn Vercel). Giữ khóa API an toàn ở máy chủ.
// Trình duyệt gọi POST /api/ai với { action, ... } và KHÔNG bao giờ thấy khóa.

import { extractConcepts, extractFromText, generateQuestions, gradeHomework } from './aiCore.mjs'

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
      const data = await extractConcepts(key, body.image, body.media || 'image/jpeg')
      res.status(200).json(data)
      return
    }
    if (action === 'extract_text') {
      const data = await extractFromText(key, String(body.text || '').slice(0, 2000))
      res.status(200).json(data)
      return
    }
    if (action === 'generate') {
      const questions = await generateQuestions(key, body.payload || {})
      res.status(200).json({ questions })
      return
    }
    if (action === 'grade') {
      const data = await gradeHomework(key, body.image, body.media || 'image/jpeg')
      res.status(200).json(data)
      return
    }
    res.status(400).json({ error: 'action không hợp lệ' })
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) })
  }
}
