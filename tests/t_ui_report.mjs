// BÁO CÁO NGÀY qua giao diện thật (27/11/2026): /quan-tri → 💸 Chi phí AI → tab đầu "📅 Báo cáo ngày". AI giả, kho thử,
// thư KHÔNG gửi thật (MAIL_MOCK_FILE). "Hôm nay" giả = một ngày năm 2042 (máy chủ), dữ liệu học dựng sẵn.
//  A  1440 px: tab đầu tiên mặc định, câu tóm tắt + 6 ô số + theo môn + câu hỏi + AI + so sánh + từng gia đình khớp report_get;
//     chọn ngày khác (ô chọn tự vẽ, không <select>) -> số liệu hôm qua; "Gửi thử ngay" -> thư; Cài đặt: bật / tắt email báo cáo.
//  B  390 px: cùng tab, không cuộn ngang, số khớp; chưa có email quản trị -> ghi rõ lý do.
import fs from 'node:fs'
import path from 'node:path'
import { pw, OUT_DIR, ROOT } from './_env.mjs'
import { useRealFonts } from './fonts.mjs'
import { check, finish, gen, adm, mock, day, account, superToken, RUN, store, restoreCfg, acct, BASE, SUPER, PASS, sleep } from './_ai.mjs'

const OUT = OUT_DIR
const MAIL = path.join(ROOT, 'tests', 'out', 'mail-4192.jsonl')
const mails = () => (fs.existsSync(MAIL) ? fs.readFileSync(MAIL, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)) : [])
const shift = (d, k) => new Date(Date.parse(d + 'T12:00:00Z') + k * 86400000).toISOString().slice(0, 10)
const dmy = (d) => `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`
const browser = await pw.chromium.launch({ headless: true })
const allErrs = []
async function device(name, { width = 1440, height = 900 } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 })
  await useRealFonts(ctx)
  const page = await ctx.newPage()
  page.on('pageerror', (e) => allErrs.push(name + ' pageerror: ' + e.message))
  page.on('console', (m) => { if (m.type() === 'error' && !/favicon|fonts\.g|status of 4\d\d/.test(m.text())) allErrs.push(name + ' console: ' + m.text()) })
  return { name, ctx, page }
}
async function until(fn, ms = 15000, step = 300) { const t0 = Date.now(); for (;;) { const v = await fn(); if (v) return v; if (Date.now() - t0 > ms) return v; await sleep(step) } }
async function adminLogin(d) {
  await d.page.goto(BASE + '/quan-tri', { waitUntil: 'networkidle' })
  await d.page.fill('.adm-login input[placeholder="Số điện thoại hoặc email"]', SUPER)
  await d.page.fill('.adm-login input[type=password]', PASS)
  await d.page.click('.adm-login button.cta')
  await d.page.waitForSelector('.adm-tabs', { timeout: 10000 })
}
const txt = (d, sel) => d.page.locator(sel).first().innerText().catch(() => '')
const noHScroll = (d) => d.page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)
const dong = (micro, rate) => Math.round((micro / 1e6) * rate).toLocaleString('vi-VN') + 'đ'

const tS = await superToken()
await restoreCfg(tS)
const supBefore = (await adm('settings_get', {}, tS)).settings
const D = '2042-' + String(1 + (Number(RUN) % 12)).padStart(2, '0') + '-' + String(1 + (Number(RUN) % 28)).padStart(2, '0')
const Y = shift(D, -1)
await store(Array.from({ length: 9 }, (_, i) => shift(D, -i)).flatMap((d) => [['DEL', 'ai:d:' + d], ['DEL', 'rp:a:' + d], ['DEL', 'rp:sent:' + d]]))
await mock('/usage?in=1000&out=500')
const P = '0975' + RUN, K1 = 'kR1' + RUN, K2 = 'kR2' + RUN
const tok = await account(P, [{ id: K1, name: 'Mai', grade: 'Lớp 3' }, { id: K2, name: 'Nam', grade: 'Lớp 6' }])
const doc = (log) => ({ v: 1, resetAt: 0, mem: { items: {}, dead: {} }, recent: [], goal: null, dev: { m1: { e: 1, days: {}, log } }, spell: null })
const L = (reviewed, correct, sec) => ({ reviewed, correct, wrong: reviewed - correct, sec })
await day(D)
await acct('data', { child: K1, doc: doc({ [Y]: { 'Toán': L(8, 6, 240) }, [D]: { 'Toán': L(24, 21, 900), 'Tiếng Việt': L(6, 3, 300) } }) }, tok)
await acct('data', { child: K2, doc: doc({ [D]: { 'Ngữ văn': L(12, 9, 600) } }) }, tok)
await gen({ subject: 'Toán', grade: 'Lớp 3', topic: 'Nhân', concepts: [{ name: 'Bảng nhân 7 ' + RUN, details: [] }], count: 10 }, { token: tok, childId: K1 })
const EM = 'bao-cao-ui-' + RUN + '@example.com'
await adm('settings_set', { alertEmails: EM }, tS)
await adm('ai_cfg_set', { reportOn: true }, tS)
const R = await adm('report_get', {}, tS), RY = await adm('report_get', { day: Y }, tS)
check('dữ liệu thử: 1 gia đình, 2 con, 42 câu, 30 phút, 1 lượt ôn', R.ok && R.study.kids === 2 && R.study.reviewed === 42 && R.study.min === 30 && R.study.sessions === 1, JSON.stringify(R.study).slice(0, 300))
const sumLine = `Hôm nay 2 con học 30 phút, làm 42 câu (đúng ${R.study.pct}%). ONTAP tốn ${dong(R.ai.usd, R.rate)}`

for (const [label, W, H] of [['A', 1440, 900], ['B', 390, 844]]) {
  console.log(`— ${label}. /quan-tri ${W} px`)
  const d = await device(label, { width: W, height: H })
  await adminLogin(d)
  await d.page.click('.adm-tab:has-text("Chi phí AI")')
  await d.page.waitForSelector('[data-testid=rp-summary]', { timeout: 15000 })
  const subs = await d.page.locator('.aic-subs .chip').allInnerTexts()
  check(`${W}px: "📅 Báo cáo ngày" là tab đầu tiên và mở sẵn`, /Báo cáo ngày/.test(subs[0]) && (await d.page.locator('.aic-subs .chip.on').innerText()).includes('Báo cáo ngày'), subs.join(' | '))
  const sum = await txt(d, '[data-testid=rp-summary]')
  check(`${W}px: câu tóm tắt "${sumLine}…"`, sum.startsWith(sumLine), sum)
  const kp = {}
  for (const el of await d.page.locator('[data-testid=rp-kpi]').all()) kp[await el.getAttribute('data-k')] = await el.innerText()
  check(`${W}px: 6 ô số khớp report_get (gia đình 1, con 2, lượt 1, câu 42, đúng ${R.study.pct}%, 30 phút)`, /\b1\b/.test(kp.families) && /\b2\b/.test(kp.kids) && /\b1\b/.test(kp.sessions) && /42/.test(kp.reviewed) && kp.pct.includes(R.study.pct + '%') && /30 phút/.test(kp.min), JSON.stringify(kp))
  const subj = await txt(d, '[data-testid=rp-subj]')
  check(`${W}px: bảng theo môn (Toán 24, Ngữ văn 12, Tiếng Việt 6)`, /Toán\s+24\s+88%\s+15/.test(subj) && /Ngữ văn\s+12\s+75%\s+10/.test(subj) && /Tiếng Việt\s+6\s+50%\s+5/.test(subj), subj)
  const qq = await txt(d, '[data-testid=rp-q]')
  check(`${W}px: câu hỏi: 10 câu đưa cho con = ngân hàng 0 + mới soạn 10; ONTAP soạn mới ${R.q.new_q}; ngân hàng hiện có`, qq.includes(`Câu đưa cho con: 10 = từ ngân hàng 0 (0%) + mới soạn 10 (100%)`) && qq.includes(`ONTAP soạn mới ${R.q.new_q} câu (${R.q.spare} câu để dành cho lần sau)`) && qq.includes(`Ngân hàng hiện có ${R.q.bankNow.questions} câu`), qq)
  const aa = await txt(d, '[data-testid=rp-ai]')
  check(`${W}px: AI: tiền, token vào ${R.ai.in.toLocaleString('vi-VN')} / ra ${R.ai.out.toLocaleString('vi-VN')}, trung bình mỗi lượt / con`, aa.includes(dong(R.ai.usd, R.rate)) && aa.includes(`vào ${R.ai.in.toLocaleString('vi-VN')}, ra ${R.ai.out.toLocaleString('vi-VN')}`) && /\/ lượt ôn/.test(aa) && /\/ con/.test(aa) && /Soạn câu ôn/.test(await txt(d, '[data-testid=rp-kinds]')), aa)
  const cmp = await txt(d, '[data-testid=rp-cmp]')
  check(`${W}px: so với hôm qua (8 câu) / TB 7 ngày; mũi tên tăng`, /Câu đã làm\s+42\s+8\s*▲ tăng 34 \(425%\)/.test(cmp) && /TB 7 ngày/.test(cmp), cmp.slice(0, 400))
  const fam = await txt(d, '[data-testid=rp-fam]')
  check(`${W}px: bảng gia đình: tên phụ huynh, số che 09xx…${P.slice(-3)}, Mai + Nam, 42 câu, 30 phút`, fam.includes('PH ' + P.slice(-4)) && fam.includes('09xx…' + P.slice(-3)) && !fam.includes(P) && /Mai, Nam/.test(fam) && /42\s+30\s+1\s+0 \/ 10/.test(fam), fam)
  check(`${W}px: thư sẵn sàng ("tự gửi mỗi tối khoảng 21–22 giờ"), không có <select>`, /khoảng 21–22 giờ tới 1 email/.test(await txt(d, '[data-testid=rp-mail]')) && (await d.page.locator('[data-testid=rp] select').count()) === 0)
  check(`${W}px: không cuộn ngang`, await noHScroll(d))
  await d.page.screenshot({ path: `${OUT}/report_${W}.png`, fullPage: true })
  // chọn ngày hôm qua
  await d.page.click('[data-testid=rp-day] .sel-btn')
  const optN = await d.page.locator('[data-testid=rp-day] .sel-opt').count()
  await d.page.click(`[data-testid=rp-day] .sel-opt:has-text("Hôm qua")`)
  await until(async () => (await txt(d, '[data-testid=rp-summary]')).startsWith('Ngày ' + dmy(Y)))
  const sumY = await txt(d, '[data-testid=rp-summary]')
  check(`${W}px: chọn được 30 ngày; "Hôm qua" -> "Ngày ${dmy(Y)} 1 con học 4 phút, làm 8 câu (đúng 75%)"`, optN === 30 && sumY.startsWith(`Ngày ${dmy(Y)} 1 con học 4 phút, làm 8 câu (đúng 75%). ONTAP tốn ${dong(RY.ai.usd, RY.rate)}`), [optN, sumY].join(' | '))
  // Gửi thử ngay
  const m0 = mails().length
  await d.page.click('[data-testid=rp-send]')
  await until(async () => /Đã gửi thư báo cáo/.test(await txt(d, '[data-testid=rp-msg]')))
  const nm = mails().slice(m0)
  check(`${W}px: "Gửi thử ngay" -> "Đã gửi thư báo cáo tới 1 email ✓", thư báo cáo HÔM NAY`, /Đã gửi thư báo cáo tới 1 email/.test(await txt(d, '[data-testid=rp-msg]')) && nm.length === 1 && nm[0].to === EM && nm[0].subject === `[Ôn Tập] Báo cáo ${dmy(D)}: 2 con · 42 câu · 30 phút · AI ${dong(R.ai.usd, R.rate)}`, JSON.stringify(nm.map((x) => x.subject)))
  if (label === 'A') {
    // Cài đặt: bật / tắt email báo cáo ngày
    await d.page.click('.aic-subs .chip:has-text("Cài đặt")')
    await d.page.waitForSelector('[data-testid=aic-report-on]')
    const lab = await txt(d, '[data-testid=aic-report-on]')
    check('Cài đặt: ô "Tự gửi email báo cáo mỗi tối (gửi khoảng 21–22 giờ…)" đang bật + nút "Gửi thử ngay"', /gửi khoảng 21–22 giờ/.test(lab) && await d.page.locator('[data-testid=aic-report-on] input').isChecked() && (await d.page.locator('[data-testid=aic-report-send]').count()) === 1, lab)
    await d.page.locator('[data-testid=aic-report-on] input').uncheck()
    await d.page.click('[data-testid=aic-cfg] button:has-text("Lưu cài đặt")')
    await until(async () => /Đã lưu/.test(await txt(d, '[data-testid=aic-cfg]')))
    const c1 = (await adm('ai_cfg_get', {}, tS)).cfg
    await d.page.click('.aic-subs .chip:has-text("Báo cáo ngày")')
    await d.page.waitForSelector('[data-testid=rp-mail]')
    await until(async () => /đang TẮT/.test(await txt(d, '[data-testid=rp-mail]')))
    check('tắt + Lưu -> máy chủ reportOn false; tab Báo cáo ngày ghi "Email báo cáo ngày đang TẮT"', c1.reportOn === false && /đang TẮT/.test(await txt(d, '[data-testid=rp-mail]')), JSON.stringify(c1))
    await d.page.click('.aic-subs .chip:has-text("Cài đặt")')
    await d.page.waitForSelector('[data-testid=aic-report-on]')
    await d.page.locator('[data-testid=aic-report-on] input').check()
    const m1 = mails().length
    await d.page.click('[data-testid=aic-report-send]')
    await until(async () => /Đã gửi thư báo cáo/.test(await txt(d, '[data-testid=aic-cfg]')))
    await d.page.click('[data-testid=aic-cfg] button:has-text("Lưu cài đặt")')
    await until(async () => /Đã lưu/.test(await txt(d, '[data-testid=aic-cfg]')))
    check('Cài đặt → "Gửi thử ngay" gửi thư; bật lại + Lưu -> reportOn true', mails().length === m1 + 1 && (await adm('ai_cfg_get', {}, tS)).cfg.reportOn === true)
    await d.page.screenshot({ path: `${OUT}/report_1440_cfg.png`, fullPage: true })
  } else {
    // chưa có email quản trị -> ghi rõ lý do
    await adm('settings_set', { alertEmails: '' }, tS)
    await d.page.click('.aic-subs .chip:has-text("Tổng quan")')
    await d.page.click('.aic-subs .chip:has-text("Báo cáo ngày")')
    await until(async () => /chưa có email quản trị/.test(await txt(d, '[data-testid=rp-mail]')))
    check('390px: chưa có email quản trị -> "Chưa gửi thư được: chưa có email quản trị…"', /Chưa gửi thư được: chưa có email quản trị/.test(await txt(d, '[data-testid=rp-mail]')))
    await d.page.click('[data-testid=rp-send]')
    await until(async () => /Lỗi/.test(await txt(d, '[data-testid=rp-msg]')))
    check('390px: Gửi thử khi chưa có email -> báo lỗi rõ ràng, không gửi', /chưa có email quản trị/.test(await txt(d, '[data-testid=rp-msg]')))
  }
  await d.ctx.close()
}
check('không có lỗi trang', !allErrs.length, allErrs.join(' | '))
await adm('settings_set', { alertEmails: (supBefore.alertEmails || []).join(','), aiOn: supBefore.aiOn }, tS)
await day('off')
await browser.close()
finish()
