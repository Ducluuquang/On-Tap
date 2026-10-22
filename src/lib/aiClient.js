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
    let msg = 'Máy chủ chưa sẵn sàng (cần đưa app lên mạng để dùng ảnh thật).'
    try { msg = (await r.json()).error || msg } catch { /* noop */ }
    throw new Error(msg)
  }
  return r.json()
}

// Thu nhỏ ảnh trước khi gửi lên: nhẹ hơn nhiều (tránh "Failed to fetch" do ảnh quá lớn),
// và AI cũng đọc nhanh hơn. Ảnh điện thoại 3–5 MB được nén còn vài trăm KB.
export function imageToBase64(file, maxDim = 1300, quality = 0.72) {
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

// Đọc nguyên file thành base64 (dùng cho PDF).
function fileToRawBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => { const r = String(reader.result || ''); resolve(r.split(',')[1] || '') }
    reader.onerror = () => reject(new Error('Không đọc được file'))
    reader.readAsDataURL(file)
  })
}

async function fileToItem(file) {
  const type = file.type || ''
  if (type.startsWith('image/')) {
    const { b64, media } = await imageToBase64(file)
    return { type: 'image', b64, media }
  }
  if (type === 'application/pdf' || /\.pdf$/i.test(file.name)) {
    if (file.size > 10 * 1024 * 1024) {
      throw new Error(`File "${file.name}" quá lớn (>10MB). Anh thử chụp ảnh từng trang thay vì PDF.`)
    }
    const b64 = await fileToRawBase64(file)
    return { type: 'document', b64, media: 'application/pdf' }
  }
  throw new Error(`Chưa hỗ trợ định dạng của "${file.name}". Anh dùng ảnh (JPG/PNG) hoặc PDF nhé.`)
}

// Tải NHIỀU ảnh/file cùng lúc → gộp cho AI đọc trong một lần.
export async function extractFromFiles(files) {
  const arr = Array.from(files || [])
  if (!arr.length) throw new Error('Chưa chọn ảnh/file nào.')
  if (arr.length > 8) throw new Error('Mỗi lần tối đa 8 ảnh/file. Anh chia thành nhiều lần nhé.')
  const items = []
  for (const f of arr) items.push(await fileToItem(f)) // xử lý tuần tự cho nhẹ máy
  return callApi({ action: 'extract', items })
}

export async function extractFromSample(sampleId) {
  return extractFromCapture(sampleId)
}

export async function extractFromText(text) {
  return callApi({ action: 'extract_text', text })
}

export async function generateQuestions(payload) {
  const d = await callApi({ action: 'generate', payload })
  return d.questions
}

// Nhờ AI chấm câu tự điền (hiểu các cách đọc/diễn đạt khác nhau nhưng cùng nghĩa).
export async function judgeAnswer(payload) {
  return callApi({ action: 'judge', payload })
}

export async function gradeImage(file) {
  const { b64, media } = await imageToBase64(file)
  return callApi({ action: 'grade', image: b64, media })
}
