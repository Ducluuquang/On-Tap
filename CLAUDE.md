# Ôn Tập — hướng dẫn làm việc cho Claude

Đọc hết trước khi làm. Kho này công khai: KHÔNG ghi khoá, mật khẩu, chìa khoá, số điện thoại / email thật vào mã, commit hay tài liệu.

## Người dùng
- Chủ dự án là phụ huynh, không làm kỹ thuật. Gọi là "anh", Claude xưng "em". Trả lời tiếng Việt, ngắn, dễ hiểu, ít thuật ngữ.
- Ưu tiên CHÍNH XÁC hơn nhanh. Làm xong phải thử kỹ rồi mới báo.
- Yêu cầu thường đến dạng file "sua <ngày>.docx" hoặc ảnh chụp màn hình. Chỗ nào là quyết định của anh (luật chơi, giao diện, chữ hiển thị…) thì hỏi ngắn, kèm phương án đề xuất.

## Sản phẩm
- PWA "Ôn Tập" (React 19 + Vite) cho học sinh ôn bài; chạy trên Vercel: https://on-tap-three.vercel.app — Vercel tự đưa lên khi nhánh `main` có commit mới.
- Hàm máy chủ: `api/*.mjs` — `ai` (soạn câu hỏi), `spelling` (Vở Spelling), `arena` (Thi đấu + Scrabble, `api/_scrabble/`), `account` (tài khoản đăng nhập nhiều máy), `ics` (lịch nhắc). Kho dữ liệu: Upstash Redis; khoá AI `ANTHROPIC_API_KEY` và thông tin kho chỉ nằm trong cài đặt Vercel.
- Trò chơi từ vựng = app "Vở Spelling" trong `public/spelling/` (`index.html`, `arena.js`, `scrabble.js`, css). Chỗ sửa so với bản gốc có ghi chú "Ôn Tập:".
- Mỗi con có dữ liệu học riêng trên máy (khoá `<kho>::<id con>`); tài khoản phụ huynh + danh sách con đồng bộ qua `/api/account` (`src/lib/sync.js`).

## Quy trình mỗi yêu cầu
1. Làm thay đổi; viết / cập nhật phép thử trong `tests/` (Playwright + máy chủ thử, AI giả). Sửa lỗi thì có đối chứng: bản cũ phải hỏng đúng chỗ.
2. Chạy `bash tests/run-all.sh` (tất cả phải đạt). Không gọi AI thật khi thử nếu không cần.
3. Commit lên `main` (nếu chỉ đẩy được nhánh riêng thì mở pull request và gộp vào `main`). Cuối commit ghi dòng `Co-Authored-By` theo hướng dẫn của phiên.
4. Kiểm tra Vercel triển khai xong (trạng thái commit trên GitHub) và trang thật có đúng bản mới.
5. Gửi anh file zip mã nguồn (`src api public index.html vercel.json`) trong cuộc trò chuyện; báo anh ngắn gọn: đã làm gì, đã thử gì, anh cần làm gì.

## Các quyết định đã chốt (đừng làm ngược lại)
- Mọi chữ "AI" hiện cho người dùng ghi là "ONTAP"; người chơi máy: "Bạn ONTAP <tên>" + 🤖 + nhãn "máy", luôn kém con một chút, không nhận vương miện.
- Scrabble, luật nhà (31/10/2026): một lượt đặt được nhiều từ ở nhiều chỗ, mỗi từ phải có nghĩa và chạm chữ đã có trên bàn (lượt đầu qua ô ★). Người chơi máy vẫn đi một hàng.
- Thi đấu: nhiều từ, không lặp lại trong ván; rời phòng khi mạng chậm không bị kéo lại phòng.
- Xếp chữ: lúc chơi chỉ có chữ xáo trộn + "Gợi ý 1 chữ"; xếp xong mới hiện hình + nghĩa.
- Thanh trên cùng (04/11/2026): "Con | Phụ huynh", "Đổi người học", "Đăng xuất" luôn MỘT HÀNG, ba ô cao bằng nhau, thẳng mép khung — kể cả iPhone bật "Thu phóng màn hình" (chỉ rộng 320px): màn hẹp thì chữ + đệm cùng thu nhỏ (`--ds-fs` trong `src/index.css`), không cho xuống hàng. Phép thử: `t_ui28` phần T.
- Giao diện của con (28/10/2026): trang chủ chia vùng màu (việc chính hôm nay, chuỗi ngày + quà, việc khác, môn học); màn "Bắt đầu ôn" có Cách 1 (gợi ý) và Cách 2 (3 bước). Thẻ gợi ý chỉ ghi chủ đề CẦN ÔN.
- Đăng nhập (01/11/2026): bằng số điện thoại hoặc email trên mọi máy; mật khẩu chỉ lưu mã băm; mất mạng vẫn đăng nhập trên máy như cũ. Bài học / báo cáo của con chưa đồng bộ giữa các máy.
- Tài khoản đăng ký trước 01/11 chỉ nằm trên máy đã đăng ký: mở app trên máy đó (kể cả đang đăng xuất) là tự lên máy chủ (03/11/2026). Máy mới đăng nhập số chưa có trên máy chủ thì báo rõ phải mở máy cũ hoặc đăng ký.
- Tài liệu chi tiết từng phần nằm trong Claude Project "On Tap" (các file `claude/*.md`) nếu phiên có gắn dự án đó.
