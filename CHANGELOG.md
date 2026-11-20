# Changelog

## Phase 4 — v1.0.0, Contract v1.3

- Thêm benchmark WebGL, soak test 10 đêm, bảng xếp hạng trên đĩa và lệnh xuất JSON.
- Thêm đổi phím, phát hiện trùng, cỡ chữ lớn, chế độ giảm chuyển động và cảnh báo trực quan.
- Bổ sung hướng dẫn cài, Dockerfile, gói chạy độc lập với npm install, kiểm chứng và video demo.

## Phase 3 — Contract v1.2

- Breaking: đèn tiêu hao dầu, có thể tắt và cần 5 đom đóm để thắp lại. Tương tác chọn cả đèn đang sáng nếu có thể châm dầu.
- Breaking: Bóng Mực có trạng thái `drain`; vùng an toàn mất khi dầu dưới 30.
- Breaking: thời lượng 240/270/300 giây. Thắng tại bình minh nếu đủ đèn. `all_lit` được thay bằng `dawn_survived`.
- Breaking: điểm nạp còn 5 mỗi đom đóm; bỏ thưởng thời gian và cộng thưởng đèn tại bình minh. Snapshot và sự kiện bổ sung dữ liệu dầu và sức chứa.
- Thêm HUD dầu và bảng màu hỗ trợ phân biệt.

## Phase 2 — Contract v1.1

- Ba đêm với bản đồ, điều khiển và số liệu chuẩn. Thêm lướt, bệ phóng, gió, Bùa Gió, Gió Lạc, tạm dừng và lưu cài đặt.

## Phase 1 — Contract v1.0

- Đảo Bến, năm đèn, Bóng Mực, Tỏa Sáng, HUD, kết quả và CLI JSONL theo seed.
