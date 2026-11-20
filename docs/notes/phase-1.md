# Ghi chép Phase 1

- Khoảng cách gameplay đo trên XZ. Thông số nhảy giả định là 7 m/s, trọng lực −20 m/s². Vị trí đom đóm dùng tọa độ mặt đất; quầng sáng lơ lửng thuộc renderer.
- Đèn cần 1 đom đóm. Tỏa sáng tiêu hao 1 đom đóm đang mang. Máu và tài nguyên mang theo là hai chỉ số riêng.
- Bán kính Đảo Bến là 30 m; Phase 1 không phạt rơi khỏi đảo. Bóng Mực ban đầu xuất hiện trên vòng bán kính 24 m.
- Điểm +10 khi nhặt, +100 khi thắp, +25 mỗi Bóng Mực bị choáng. Kết thúc cộng +50 mỗi Ngọn Lửa còn lại; thắng cộng thêm số giây còn lại làm tròn lên × 5.
- Nhật ký AI. Bản ban đầu dùng Copilot trong VS Code; bản sửa dùng Codex để chuyển renderer sang WebGL, rà lại điều khoản v1.0, rồi chạy test và so SHA-256 của hai lượt CLI. Ước tính token/chi phí ban đầu không có dữ liệu.
- Retro. Test cũ chỉ bao phủ chuyển động ngang và nhặt/nạp. Thêm test cho nhảy, vùng an toàn, tiêu hao khi tỏa sáng và cả hai kết quả cuối đêm.
