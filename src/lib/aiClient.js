// Cầu nối từ trình duyệt tới backend AI (/api/ai). Trình duyệt KHÔNG giữ khóa API.
// Nút "bài mẫu" dùng AI giả lập để xem thử khi chưa có ảnh / chưa deploy.

import { extractFromCapture } from './mockAI.js'

async function callApi(body) {
  const r = await fetch('/api/ai', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!r.ok) {
    let msg = 'Máy chủ AI chưa sẵn sàng (cần deploy để dùng ảnh thật).'
    try { msg = (await r.json()).error || msg } catch { /* noop */ }
    throw new Error(msg)
  }
  return r.json()
}

export function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const rd = new FileReader()
    rd.onload = () => resolve(String(rd.result).split(',')[1])
    rd.onerror = () => reject(new Error('Không đọc được ảnh'))
    rd.readAsDataURL(file)
  })
}

export async function extractFromImage(file) {
  const image = await fileToBase64(file)
  return callApi({ action: 'extract', image, media: file.type || 'image/jpeg' })
}

export async function extractFromSample(sampleId) {
  return extractFromCapture(sampleId)
}

export async function generateQuestions(payload) {
  const d = await callApi({ action: 'generate', payload })
  return d.questions
}
