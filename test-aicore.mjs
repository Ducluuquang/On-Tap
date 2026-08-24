// Kiểm thử lõi backend (aiCore) bằng AI thật, chạy từ máy này.
// ANTHROPIC_API_KEY=sk-ant-... node scripts/test-aicore.mjs [ảnh]
import fs from 'node:fs'
import { extractConcepts, generateQuestions } from '../api/aiCore.mjs'

const key = process.env.ANTHROPIC_API_KEY
if (!key) { console.error('Thiếu ANTHROPIC_API_KEY'); process.exit(1) }
const p = process.argv[2] || 'scripts/sample-worksheet.png'
const b64 = fs.readFileSync(p).toString('base64')
const media = p.endsWith('.png') ? 'image/png' : 'image/jpeg'

const ex = await extractConcepts(key, b64, media)
console.log('== EXTRACT ==\n' + JSON.stringify(ex, null, 2))
const qs = await generateQuestions(key, { ...ex, count: 3 })
console.log('\n== GENERATE (3 câu) ==\n' + JSON.stringify(qs, null, 2))
