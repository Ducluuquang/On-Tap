# Phép thử của Ôn Tập

Chạy: `bash tests/run-all.sh` (khoảng 30–40 phút cho tất cả; chỉ vài bộ: `bash tests/run-all.sh t_ui28 t_engine`).
Script tự cài phông thử vào `tests/.deps`, build app, bật Redis (cổng 6390) + lớp giả Upstash (4199) + 3 máy chủ thử:
4192 (đủ hàm `/api`, AI giả `MOCK=1`), 4193 (chưa gắn kho), 4194 (Scrabble rút ngắn giờ lượt; chưa cài gửi email `MAIL=0`).
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
| t_ui_pick | ô chọn tự vẽ chữ to thay danh sách xổ xuống của trình duyệt: Vở Spelling (Thách đấu, phòng thi, Thêm bộ từ), Ôn Tập (Đăng ký, Nội dung đã đọc được) |

Đối chứng bản cũ (khi sửa lỗi): build bản cũ vào thư mục khác, chạy `DIST=<thư mục dist cũ> MOCK=1 PORT=4195 node tests/server.mjs`,
rồi chạy bộ thử với `BASE=http://localhost:4195` (các bộ có đọc biến BASE) — bản cũ phải hỏng đúng chỗ đã sửa.
