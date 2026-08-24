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

// Thu nhỏ ảnh trước khi gửi lên: nhẹ hơn nhiều (tránh "Failed to fetch" do ảnh quá lớn),
// và AI cũng đọc nhanh hơn. Ảnh điện thoại 3–5 MB được nén còn vài trăm KB.
export function imageToBase64(file, maxDim = 1500, quality = 0.85) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height))
      const w = Math.max(1, Math.round(img.width * scale))
      const h = Math.max(1, Math.round(img.height * scale))
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      canvas.getContext('2d').drawImage(img, 0, 0, w, h)
      try {
        const dataUrl = canvas.toDataURL('image/jpeg', quality)
        resolve({ b64: dataUrl.split(',')[1], media: 'image/jpeg' })
      } catch {
        reject(new Error('Không xử lý được ảnh'))
      }
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Không đọc được ảnh')) }
    img.src = url
  })
}

export async function extractFromImage(file) {
  const { b64, media } = await imageToBase64(file)
  return callApi({ action: 'extract', image: b64, media })
}

export async function extractFromSample(sampleId) {
  return extractFromCapture(sampleId)
}

export async function generateQuestions(payload) {
  const d = await callApi({ action: 'generate', payload })
  return d.questions
}

export async function gradeImage(file) {
  const { b64, media } = await imageToBase64(file)
  return callApi({ action: 'grade', image: b64, media })
}
