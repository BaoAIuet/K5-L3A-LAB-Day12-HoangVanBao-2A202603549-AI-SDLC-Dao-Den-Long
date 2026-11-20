# ADR — Duy trì ánh sáng đến bình minh

Mỗi đèn lưu dầu theo đơn vị 1/60, tách khỏi số đom đóm đang tích lũy. Số nguyên giữ ngưỡng 30 và thời điểm cạn dầu chính xác khi nhiều Bóng Mực cùng hút. Chỉ snapshot và dữ liệu sự kiện làm tròn dầu về một chữ số thập phân. Đèn tắt xóa tiến độ nạp, giữ lịch sử từng thắp và số lần thắp lại. Đèn đặt sẵn trong scenario chỉ thiết lập trạng thái đầu.

Dầu tự hao và lượng hút được áp dụng trước di chuyển, tương tác và Tỏa Sáng. Một phiên hút không gián đoạn ghi sự kiện theo các mốc 60 tick của Bóng Mực đó. Phục hồi vùng an toàn tạo đẩy lùi ngay trong tick tương tác, nằm trong giới hạn 30 tick.

Điều kiện thắng đọc số đèn còn sáng sau mọi cập nhật của tick bình minh. Hết Ngọn Lửa được xét trước. Test Phase 2 về thời lượng và điểm nạp được đổi sang 240/270/300 giây và 150 điểm cho một lần thắp đủ 10 đom đóm. Test mới bao phủ việc thắp đủ nhưng vẫn chơi, cạn dầu đúng tick cuối, thắp lại, hút cộng dồn và điểm bình minh.

Codex hỗ trợ đối chiếu ticket và chạy hồi quy. Không có số đo token/chi phí của các phiên trước; lượt này giảm việc chạy thử bằng các scenario ngắn trước khi kiểm tra trình duyệt.
