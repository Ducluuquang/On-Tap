// Âm thanh vui cho game — tạo bằng Web Audio API, KHÔNG cần file mp3.
// Dùng chung cho các game (Bắn bóng, Xếp sushi, Quick Fire, Boss Battle…).
// AudioContext chỉ được tạo khi cần và tự "resume" sau cú chạm đầu tiên (chính sách trình duyệt).

let ctx = null
export function audioCtx() {
  try {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)()
    if (ctx.state === 'suspended') ctx.resume().catch(() => {})
  } catch { ctx = null }
  return ctx
}

// Một nốt đơn (có thể trượt cao/thấp để tạo hiệu ứng).
function tone(c, { freq = 600, dur = 0.12, vol = 0.18, type = 'sine', slideTo = null, delay = 0 }) {
  if (!c) return
  const t0 = c.currentTime + delay
  const o = c.createOscillator(); const g = c.createGain()
  o.type = type
  o.frequency.setValueAtTime(freq, t0)
  if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), t0 + dur)
  o.connect(g); g.connect(c.destination)
  g.gain.setValueAtTime(0.0001, t0)
  g.gain.exponentialRampToValueAtTime(vol, t0 + 0.008)
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
  o.start(t0); o.stop(t0 + dur + 0.02)
}

// Tiếng "xì/đập" bằng nhiễu trắng tắt dần (cho cú smash, nổ bóng…).
function noise(c, { dur = 0.18, vol = 0.25, lopass = 1400 }) {
  if (!c) return
  const t0 = c.currentTime
  const n = Math.max(1, Math.floor(c.sampleRate * dur))
  const buf = c.createBuffer(1, n, c.sampleRate)
  const d = buf.getChannelData(0)
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n) // tắt dần
  const src = c.createBufferSource(); src.buffer = buf
  const g = c.createGain(); const f = c.createBiquadFilter()
  f.type = 'lowpass'; f.frequency.value = lopass
  src.connect(f); f.connect(g); g.connect(c.destination)
  g.gain.setValueAtTime(vol, t0)
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
  src.start(t0); src.stop(t0 + dur)
}

// ---- Các âm thanh dùng trong game ----
export function playPop() { const c = audioCtx(); if (!c) return; tone(c, { freq: 620, slideTo: 990, dur: 0.12, vol: 0.2, type: 'triangle' }); noise(c, { dur: 0.06, vol: 0.12, lopass: 2600 }) }
export function playHit() { const c = audioCtx(); if (!c) return; tone(c, { freq: 880, slideTo: 1350, dur: 0.1, vol: 0.18, type: 'square' }) }
export function playMiss() { const c = audioCtx(); if (!c) return; tone(c, { freq: 300, slideTo: 120, dur: 0.22, vol: 0.18, type: 'sawtooth' }) }
export function playSmash() { const c = audioCtx(); if (!c) return; noise(c, { dur: 0.22, vol: 0.38, lopass: 2000 }); tone(c, { freq: 170, slideTo: 48, dur: 0.24, vol: 0.32, type: 'square' }) }
export function playHurt() { const c = audioCtx(); if (!c) return; tone(c, { freq: 240, slideTo: 80, dur: 0.3, vol: 0.24, type: 'sawtooth' }); noise(c, { dur: 0.12, vol: 0.16, lopass: 900 }) }
export function playDing() { const c = audioCtx(); if (!c) return; tone(c, { freq: 880, dur: 0.12, vol: 0.16, type: 'sine' }); tone(c, { freq: 1320, dur: 0.16, vol: 0.12, type: 'sine', delay: 0.05 }) }
export function playWobble() { const c = audioCtx(); if (!c) return; tone(c, { freq: 210, slideTo: 330, dur: 0.14, vol: 0.15, type: 'triangle' }); tone(c, { freq: 330, slideTo: 200, dur: 0.14, vol: 0.13, type: 'triangle', delay: 0.1 }) }
// Tiếng "tích tắc" đồng hồ — urgent=true khi sắp hết giờ (cao & to hơn cho cảm giác gấp gáp).
export function playTick(urgent = false) { const c = audioCtx(); if (!c) return; tone(c, { freq: urgent ? 1150 : 760, dur: 0.05, vol: urgent ? 0.24 : 0.1, type: 'square' }) }
