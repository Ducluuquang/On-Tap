# Phép thử của Ôn Tập

Chạy: `bash tests/run-all.sh` (khoảng 30–40 phút cho tất cả; chỉ vài bộ: `bash tests/run-all.sh t_ui28 t_engine`).
Script tự cài phông thử vào `tests/.deps`, build app, bật Redis (cổng 6390) + lớp giả Upstash (4199) + 3 máy chủ thử:
4192 (đủ hàm `/api`, AI giả `MOCK=1`), 4193 (chưa gắn kho), 4194 (Scrabble rút ngắn giờ lượt; chưa cài gửi email `MAIL=0`).
Thư viện sách: máy chủ 4192 có `ADMIN_PHONES=0912000777, 0912000778` (số thử), 4194 không có biến. AI đọc chữ sách = Message Batches GIẢ
trong `tests/server.mjs` (`/__mock/ocr`: xem các batch + kích thước từng ảnh; đặt chữ giả cho từng trang, nửa trang lỗi / bị cắt, giữ batch "đang đọc");
lời nhắc soạn câu hỏi gửi AI ghi lại ở `/__mock/ai` (`gen`). Sách trong phép thử là sách GIẢ tự tạo (kho công khai).
Thư (mã "Quên mật khẩu") KHÔNG gửi thật: máy chủ thử đặt `MAIL_MOCK_FILE` và ghi mỗi thư thành một dòng JSON vào `tests/out/mail-<cổng>.jsonl`
(địa chỉ nhận đuôi `@fail.test` giả lập gửi lỗi). Kết quả và ảnh chụp: `tests/out/`.

Cần: Node 22+, Playwright + Chromium (máy làm việc của Claude có sẵn; nơi khác: `npm i -g playwright && npx playwright install chromium`),
`redis-server` / `redis-cli`. Không gọi AI thật, không đụng kho thật.

| Bộ thử | Nội dung |
| - | - |
| t_acct_merge | gộp danh sách con khi hai máy đăng ký riêng cùng số (hàm thuần) |
| t_api_account | máy chủ tài khoản: đăng ký, đăng nhập số điện thoại / email, chìa khoá, đổi / quên mật khẩu, chống dò; phần 10: quên mật khẩu bằng mã email (gửi mã bằng số / email, email đã che, kho chỉ có HMAC + 900 giây, sai mã, hết hạn, dùng lại, sai 5 lần, giới hạn gửi, chưa có email, `mail_off`, gửi lỗi, nhật ký không chứa mã) |
| t_ui_account | đăng nhập nhiều máy qua giao diện (mỗi "máy" một trình duyệt riêng); phần 6: trình duyệt MỚI quên mật khẩu → mã qua email → vào app, máy cũ phải đăng nhập lại, sai mã, hai ô không khớp, gửi lại mã sau 60 giây, tài khoản chưa có email (cách cũ trên máy đã đăng nhập), máy chủ chưa cài gửi email |
| t_sync_merge, t_api_data, t_ui_data | đồng bộ dữ liệu học của từng con giữa các máy: hàm gộp + nhiều máy giả lập, máy chủ (hành động "data"), giao diện hai máy (A học -> B thấy, mục tiêu, Vở Spelling, xoá hết dữ liệu) |
| t_engine, t_engine_many, t_engine_multi | luật Scrabble, máy tự chơi, luật nhà đặt nhiều từ ở nhiều chỗ (so với bộ luật viết riêng) |
| t_api_arena, t_api_limit, t_api_scrabble, t_api_more, t_api_multi | máy chủ Thi đấu / Scrabble |
| t_ui24, t_ui26, t_arena_regress, t_solo_games, t_leave_race, t_ui_more, t_ui_multi | giao diện Vở Spelling, Thi đấu, Scrabble |
| t_ui28 | trang chủ của con + màn Bắt đầu ôn (giao diện mới), màn hẹp 320–430px, thanh trên cùng một hàng (280px → máy tính) |
| t_books_core | thư viện sách, hàm thuần: gợi ý lớp / môn / loại / tên từ tên file, chi phí ước tính, cắt đôi trang tại khe trắng (cả ảnh quét có nhiễu), lời nhắc chép chữ, kích thước JPEG, `ADMIN_PHONES`, ghép chữ trang, chia đoạn, tìm đúng đoạn sách (SGK > SBT > SGV, ≤ 3.500 ký tự) |
| t_api_books | máy chủ thư viện sách với Message Batches GIẢ: quyền (chưa đăng nhập, tài khoản thường, máy chủ chưa có `ADMIN_PHONES`), nạp sách, sonnet mới nhất + tắt thinking, nửa trang lỗi / bị cắt đọc lại, lỗi 3 lần thì bỏ qua, giới hạn kích thước, số lệnh kho, xoá sách (huỷ batch) |
| t_ui_books | thư viện sách qua giao diện với PDF ảnh GIẢ tự tạo: chỉ quản trị thấy, pdf.js chỉ tải khi chọn file, gợi ý từ tên file, chi phí, ảnh gửi đi (≤ 1100 px, ≤ 1,15 MP, cắt đúng khe trắng, < 4 MB mỗi lần), tự gửi lại nửa trang lỗi, đóng app → mở lại → chọn lại file, xoá sách |
| t_ui_pick | ô chọn tự vẽ chữ to thay danh sách xổ xuống của trình duyệt: Vở Spelling (Thách đấu, phòng thi, Thêm bộ từ), Ôn Tập (Đăng ký, Nội dung đã đọc được) |

Đối chứng bản cũ (khi sửa lỗi): build bản cũ vào thư mục khác, chạy `DIST=<thư mục dist cũ> MOCK=1 PORT=4195 node tests/server.mjs`,
rồi chạy bộ thử với `BASE=http://localhost:4195` (các bộ có đọc biến BASE) — bản cũ phải hỏng đúng chỗ đã sửa.
