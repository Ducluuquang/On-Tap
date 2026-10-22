import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { spellingUrl } from '../lib/spelling.js'

// TRÒ CHƠI TỪ VỰNG = app "Vở Spelling" chạy trong khung ngay bên trong Ôn Tập (chốt 22/10/2026, thay 6 trò cũ).
// - Khung cao VỪA ĐÚNG màn hình (cả trang không phải cuộn; bên trong Vở Spelling tự cuộn như app riêng).
// - Nút "‹" ở trang chính của Vở Spelling -> về lại "Bắt đầu ôn" (môn Tiếng Anh).
// - Xong mỗi lượt chơi, Vở Spelling báo số câu, số câu đúng và thời gian học -> Ôn Tập ghi vào
//   báo cáo + mục tiêu mỗi ngày của con (như các trò ôn tập khác).
export default function SpellingApp({ childId, onExit, onSession }) {
  const ref = useRef(null)
  const [top, setTop] = useState(null)
  const cb = useRef({ onExit, onSession })
  useEffect(() => { cb.current = { onExit, onSession } })

  // Đo vị trí khung để khung kết thúc đúng mép dưới màn hình; tạm bỏ "cao tối thiểu" của trang khi đang mở.
  useLayoutEffect(() => {
    const root = document.documentElement
    root.classList.add('spelling-open')
    window.scrollTo(0, 0)
    const measure = () => {
      const el = ref.current
      if (el) setTop(Math.round(el.getBoundingClientRect().top + window.scrollY))
    }
    measure()
    window.addEventListener('resize', measure)
    return () => {
      window.removeEventListener('resize', measure)
      root.classList.remove('spelling-open')
    }
  }, [])

  // Chỉ nhận tin từ ĐÚNG khung Vở Spelling của trang này.
  useEffect(() => {
    const onMsg = (e) => {
      if (e.origin !== window.location.origin) return
      const el = ref.current
      if (!el || e.source !== el.contentWindow) return
      const d = e.data
      if (!d || typeof d !== 'object' || d.source !== 'vo-spelling') return
      if (d.action === 'exit' && cb.current.onExit) cb.current.onExit()
      else if (d.action === 'session' && cb.current.onSession) cb.current.onSession(d)
    }
    window.addEventListener('message', onMsg)
    return () => window.removeEventListener('message', onMsg)
  }, [])

  return (
    <iframe
      ref={ref}
      className="spelling-frame"
      src={spellingUrl(childId)}
      title="Vở Spelling — trò chơi từ vựng"
      style={top != null ? { '--sp-top': top + 'px' } : undefined}
    />
  )
}
