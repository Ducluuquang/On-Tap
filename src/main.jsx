import { StrictMode, lazy, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Trang quản trị hệ thống (17/11/2026): địa chỉ riêng /quan-tri, tải riêng (không làm nặng app của con / phụ huynh).
const AdminApp = lazy(() => import('./admin/AdminApp.jsx'))
const isAdminPage = /^\/quan-tri\/?$/.test(window.location.pathname)

// Ôn Tập (02/11/2026): app là một cột rộng 430px — trên màn máy tính trông "nhỏ xíu", phải tự phóng to rồi kéo qua lại.
// Màn rộng thì tự phóng to vừa màn hình (theo cả chiều ngang lẫn chiều cao), tối đa 3 lần (19/11/2026: màn 2K / 4K như Surface
// trước đây tối đa 2 lần nên vẫn nhỏ); điện thoại giữ nguyên.
function fitScreen() {
  const w = window.innerWidth, h = window.innerHeight
  let f = Math.min(w / 900, h / 560)
  f = Math.max(1, Math.min(3, Math.floor(f * 20) / 20))
  document.documentElement.style.setProperty('--fit', String(f))
}
if (!isAdminPage) { fitScreen(); window.addEventListener('resize', fitScreen) }
// BẢN MÁY TÍNH (anh báo 19/11/2026, ảnh Surface: "nhỏ tí, đọc không ra chữ, khoảng trống mênh mông"): màn có bề ngang lớn
// (Surface, màn 2K / 4K, trình duyệt thu nhỏ) -> bản máy tính tự phóng to theo cỡ màn, lấy 1440 × 900 làm chuẩn (bản mẫu anh duyệt):
// rộng / cao gấp bao nhiêu thì chữ, nút, khoảng cách to gấp bấy nhiêu (tối đa 3 lần). Màn ≤ 1440 × 900 giữ nguyên cỡ mẫu.
function deskFit() {
  const w = window.innerWidth, h = window.innerHeight
  let z = Math.min(w / 1440, h / 900)
  z = Math.max(1, Math.min(3, Math.floor(z * 20) / 20))
  document.documentElement.style.setProperty('--dk-z', String(z))
}
deskFit(); window.addEventListener('resize', deskFit)

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {isAdminPage ? <Suspense fallback={null}><AdminApp /></Suspense> : <App />}
  </StrictMode>,
)
