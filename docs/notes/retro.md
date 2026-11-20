# Retro AI SDLC

## Qua bốn phase

**Phase 1.** Tách mô phỏng khỏi trình hiển thị ngay từ đầu giúp kiểm tra bằng seed. Ba test ban đầu vẫn bỏ sót nhảy, bảo vệ quanh đèn và điều kiện kết thúc. Khi đối chiếu PRD thật, mình bổ sung các tình huống đó và kiểm tra hai bản JSONL bằng hàm băm.

**Phase 2.** Test cấu trúc ba đêm và kịch bản CLI giúp phát hiện khác biệt giữa tài liệu và code. Bản đầu có lan can trên cầu, đẩy gió sai mốc, và báo gió thiếu chỉ báo. Ảnh chụp trình duyệt cũng phát hiện lỗi bóng đổ tạo sọc, chữ tiếng Việt hiển thị sai và HUD tràn trên màn hình hẹp. Việc đo ở đúng độ phân giải phát hiện chi phí bóng đổ và cỏ khi nâng chất lượng đồ họa.

**Phase 3.** Chuyển dầu sang số nguyên 1/60 khiến tiêu hao cộng dồn và ngày tắt đèn có thể kiểm tra đúng tick. Test thắng cũ không còn mô tả đúng mục tiêu, vì vậy đổi sang kiểm tra đủ đèn lúc bình minh, hết Ngọn Lửa đúng tick cuối và đèn tự tắt trước xét kết quả. ADR ghi thứ tự xử lý và lý do thay đổi.

**Phase 4.** Soak kiểm tra bộ nhớ đầu/cuối trong một tiến trình. Benchmark dựng cảnh thật với camera tự động. Kết quả trên laptop phát triển được ghi nguyên, kể cả những lần dưới ngưỡng hay khác môi trường máy chấm. Việc tách gói ZIP và ghi rõ phiên bản Node.js giảm phụ thuộc vào máy làm bài. Bảng điểm được kiểm qua đường xuất CLI và đọc lại từ đĩa.

## Harness và ngân sách

`AGENTS.md` giúp giữ quy tắc mô phỏng thuần, chạy đúng lệnh và yêu cầu bằng chứng cho mỗi tiêu chí. Test Contract và các scenario nhỏ là công cụ phát hiện sai hiệu quả nhất. Dùng các script Chrome để kiểm tra tương tác và phát hiện lỗi WebGL, thay vì chỉ dựa vào bài test logic.

Mức sử dụng token và giá thực tế của các phiên Copilot/Codex không có trong repo hay báo cáo khả dụng, nên không có ước tính tổng đáng tin cậy. Phần việc dài nhất là các lượt đối chiếu ticket và kiểm chứng trình duyệt. Tiết kiệm lượt làm bằng cách tái sử dụng cảnh, chạy test tập trung trước, nhóm các kiểm tra độc lập và dùng cùng fixtures cho nhiều lần hồi quy.

Nếu làm lại, mình sẽ chép acceptance criteria vào bảng kiểm ngay khi mở mỗi ticket, dùng scenario CLI làm bằng chứng cho từng nhánh, và đo WebGL trước khi thêm chi tiết cảnh quan. Mỗi phase cần giữ một tag độc lập với dữ liệu đo đi kèm.
