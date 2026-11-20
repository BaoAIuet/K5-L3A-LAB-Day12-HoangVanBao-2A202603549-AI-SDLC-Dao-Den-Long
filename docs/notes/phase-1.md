# Ghi chép Phase 1

## Giả định
- Đo khoảng cách trên mặt phẳng XZ.
- Mỗi đèn cần một đơn vị đom đóm vì `lantern_cost = 1`.
- Bóng Mực bắt đầu cách người chơi tối thiểu 24 mét.
- Rơi khỏi đảo không bị phạt (`fall_enabled = false`) vì contract chưa yêu cầu cơ chế rơi cụ thể.
- Island radius là 30 mét để camera và môi trường hiển thị có phạm vi.

## Nhật ký AI
- Công cụ: Copilot SDK trong VS Code.
- Ước tính token: ghi lại sau khi hoàn thành quá trình build/test.
- Cách tiết kiệm: giao một module logic, một CLI headless, một test suite; tránh tự động cài dependency.

## Evaluation
- Cần chạy build/test/headless rồi mới cập nhật trạng thái đạt/chưa đạt.
