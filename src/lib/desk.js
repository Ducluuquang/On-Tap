// BẢN MÁY TÍNH (anh duyệt 19/11/2026, đợt 1): màn từ 1024 px trở lên (máy tính, iPad nằm ngang) dùng bố cục riêng cho
// Đăng nhập / Đăng ký, Chọn người học, khu Phụ huynh và trang quản trị /quan-tri. Màn hẹp hơn giữ nguyên như cũ.
// useDesk(): true khi màn rộng, tự cập nhật khi kéo cửa sổ qua lại mốc 1024 px (state của màn hình vẫn giữ nguyên).
import { useEffect, useState } from 'react'

export const DESK_QUERY = '(min-width: 1024px)'
export const isDesk = () => typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia(DESK_QUERY).matches

export function useDesk() {
  const [desk, setDesk] = useState(isDesk)
  useEffect(() => {
    if (!window.matchMedia) return undefined
    const mq = window.matchMedia(DESK_QUERY)
    const on = () => setDesk(mq.matches)
    on()
    if (mq.addEventListener) mq.addEventListener('change', on); else mq.addListener(on)
    return () => { if (mq.removeEventListener) mq.removeEventListener('change', on); else mq.removeListener(on) }
  }, [])
  return desk
}
