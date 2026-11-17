// Vẽ trang PDF (ảnh chụp trang sách) thành ảnh JPEG nửa trang để gửi AI chép chữ (09/11/2026).
// File này (và pdf.js) CHỈ được nạp khi quản trị mở màn Thư viện sách — không làm nặng app của con.
//  - Vẽ mỗi trang rộng ~1100 px.
//  - Cắt đôi tại hàng ÍT MỰC nhất trong khoảng 42–58% chiều cao (không cắt ngang dòng chữ).
//  - Mỗi nửa ≤ 1,15 MP (AI đọc đủ nét); JPEG chất lượng ~0,85.
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs'
import workerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url'
import { findCutRow, cutRange, MARGIN } from './bookCut.js'

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl

export const TARGET_W = 1100
export const HALF_MAX_PX = 1150000
export const JPEG_Q = 0.85

export async function openPdf(file) {
  const data = new Uint8Array(await file.arrayBuffer())
  const doc = await pdfjs.getDocument({ data, isEvalSupported: false }).promise
  return doc
}

function toBlob(canvas, q) {
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('jpeg'))), 'image/jpeg', q))
}
async function blobB64(blob) {
  const buf = new Uint8Array(await blob.arrayBuffer())
  let s = ''
  for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000))
  return btoa(s)
}
function crop(src, y0, y1) {
  let w = src.width, h = y1 - y0
  const scale = Math.min(1, Math.sqrt(HALF_MAX_PX / (w * h)))
  const c = document.createElement('canvas')
  c.width = Math.max(1, Math.floor(w * scale)); c.height = Math.max(1, Math.floor(h * scale))
  const g = c.getContext('2d')
  g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height)
  g.drawImage(src, 0, y0, w, h, 0, 0, c.width, c.height)
  return c
}

// Trang n (1..) -> [{ half: 1, b64, w, h }, { half: 2, … }] (chỉ các nửa trong `halves`).
export async function renderHalves(doc, n, halves = [1, 2]) {
  const page = await doc.getPage(n)
  const v1 = page.getViewport({ scale: 1 })
  const vp = page.getViewport({ scale: TARGET_W / v1.width })
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(vp.width); canvas.height = Math.round(vp.height)
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height)
  await page.render({ canvasContext: ctx, canvas, viewport: vp }).promise
  const { width: w, height: h } = canvas
  const [r0, r1] = cutRange(h)
  const lo = Math.max(0, r0 - MARGIN), hi = Math.min(h, r1 + MARGIN + 1)
  const img = ctx.getImageData(0, lo, w, hi - lo).data
  const gray = new Uint8Array(w * h)
  for (let y = lo; y < hi; y++) for (let x = 0; x < w; x += 2) {
    const i = ((y - lo) * w + x) * 4
    gray[y * w + x] = (img[i] * 299 + img[i + 1] * 587 + img[i + 2] * 114) / 1000
  }
  const cut = findCutRow(gray, w, h)
  const out = []
  for (const half of halves) {
    const c = half === 1 ? crop(canvas, 0, cut) : crop(canvas, cut, h)
    const b64 = await blobB64(await toBlob(c, JPEG_Q))
    out.push({ page: n, half, b64, w: c.width, h: c.height })
    c.width = c.height = 0
  }
  canvas.width = canvas.height = 0
  page.cleanup()
  return out
}
