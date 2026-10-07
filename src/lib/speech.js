// ĐỌC TO từ tiếng Anh bằng GIỌNG ĐỌC CÓ SẴN trong máy (miễn phí, không tốn token).
// Máy không có giọng tiếng Anh -> trò chơi vẫn chạy (con nhìn nghĩa để làm).
let voice = null
let checked = false

export function speechSupported() {
  return typeof window !== 'undefined' && 'speechSynthesis' in window && typeof window.SpeechSynthesisUtterance === 'function'
}
function englishVoices() {
  try { return (window.speechSynthesis.getVoices() || []).filter((v) => /^en([-_]|$)/i.test(v.lang || '')) } catch { return [] }
}
// Ưu tiên giọng Anh-Anh (sách giáo khoa VN dùng phiên âm Anh-Anh), rồi Anh-Mỹ; giọng có sẵn trong máy trước.
function pickVoice() {
  const vs = englishVoices()
  if (!vs.length) return null
  const score = (v) => (/en[-_]GB/i.test(v.lang) ? 3 : /en[-_]US/i.test(v.lang) ? 2 : 1) + (v.localService ? 1 : 0)
  return vs.slice().sort((a, b) => score(b) - score(a))[0]
}
// Gọi khi mở màn chơi: máy nạp danh sách giọng đọc (có máy nạp chậm). onReady(true|false) = có giọng tiếng Anh không.
export function warmSpeech(onReady) {
  if (!speechSupported()) { if (onReady) onReady(false); return }
  const synth = window.speechSynthesis
  let fired = false
  const done = () => {
    if (fired) return
    fired = true
    voice = pickVoice(); checked = true
    if (onReady) onReady(!!voice)
  }
  if ((synth.getVoices() || []).length) { done(); return }
  try { synth.addEventListener('voiceschanged', done, { once: true }) } catch { /* trình duyệt cũ */ }
  setTimeout(done, 1500)
}
export function hasEnglishVoice() {
  if (!speechSupported()) return false
  if (!checked) voice = pickVoice()
  return !!voice
}
// Đọc một từ/câu. rate < 1 = đọc chậm (🐢).
export function speak(text, { rate = 0.85 } = {}) {
  if (!speechSupported() || !text) return false
  try {
    const synth = window.speechSynthesis
    const u = new window.SpeechSynthesisUtterance(String(text))
    const v = voice || pickVoice()
    if (v) { u.voice = v; u.lang = v.lang } else u.lang = 'en-GB'
    u.rate = rate
    if (synth.speaking || synth.pending) { synth.cancel(); setTimeout(() => synth.speak(u), 80) } // Chrome: cancel rồi đọc ngay có khi bị nuốt
    else synth.speak(u)
    return true
  } catch { return false }
}
// iPhone/iPad chỉ cho đọc sau một lần chạm: gọi NGAY trong lúc con bấm nút chơi.
export function unlockSpeech() {
  if (!speechSupported()) return
  try { const u = new window.SpeechSynthesisUtterance(' '); u.volume = 0; window.speechSynthesis.speak(u) } catch { /* noop */ }
}
export function stopSpeech() {
  try { if (speechSupported()) window.speechSynthesis.cancel() } catch { /* noop */ }
}
