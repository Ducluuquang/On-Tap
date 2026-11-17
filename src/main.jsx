import { StrictMode, lazy, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Trang quản trị hệ thống (17/11/2026): địa chỉ riêng /quan-tri, tải riêng (không làm nặng app của con / phụ huynh).
const AdminApp = lazy(() => import('./admin/AdminApp.jsx'))
const isAdminPage = /^\/quan-tri\/?$/.test(window.location.pathname)

// Ôn Tập (02/11/2026): app là một cột rộng 430px — trên màn máy tính trông "nhỏ xíu", phải tự phóng to rồi kéo qua lại.
// Màn rộng thì tự phóng to vừa màn hình (theo cả chiều ngang lẫn chiều cao), tối đa 2 lần; điện thoại giữ nguyên.
function fitScreen() {
  const w = window.innerWidth, h = window.innerHeight
  let f = Math.min(w / 900, h / 560)
  f = Math.max(1, Math.min(2, Math.floor(f * 20) / 20))
  document.documentElement.style.setProperty('--fit', String(f))
}
if (!isAdminPage) { fitScreen(); window.addEventListener('resize', fitScreen) }

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {isAdminPage ? <Suspense fallback={null}><AdminApp /></Suspense> : <App />}
  </StrictMode>,
)
