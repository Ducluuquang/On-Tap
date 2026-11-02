// Môi trường chạy thử dùng chung: Playwright + Chromium (cài sẵn trong máy làm việc của Claude), thư mục gốc dự án,
// thư mục ảnh chụp (tests/out, không đưa lên git).
import { createRequire } from 'node:module'
import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const TESTS = path.dirname(fileURLToPath(import.meta.url))
export const ROOT = path.resolve(TESTS, '..')
export const OUT_DIR = process.env.TEST_OUT || path.join(TESTS, 'out')
fs.mkdirSync(OUT_DIR, { recursive: true })

function loadPlaywright() {
  const req = createRequire(import.meta.url)
  try { return req('playwright') } catch { /* thử chỗ cài toàn cục */ }
  try { return req(path.join(execSync('npm root -g').toString().trim(), 'playwright')) } catch { /* không có */ }
  throw new Error('Không tìm thấy Playwright: chạy "npm i -g playwright" (hoặc dùng máy làm việc có cài sẵn).')
}
const raw = loadPlaywright()
// chromium.launch(): dùng trình duyệt cài sẵn; PW_CHROMIUM=<đường dẫn> để chỉ định trình duyệt khác.
export const pw = {
  ...raw,
  chromium: {
    ...raw.chromium,
    launch: (opts = {}) => {
      const o = { ...opts }
      delete o.executablePath
      if (process.env.PW_CHROMIUM) o.executablePath = process.env.PW_CHROMIUM
      return raw.chromium.launch(o)
    },
  },
}
