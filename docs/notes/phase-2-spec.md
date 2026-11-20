# Phase 2 — Ba hòn đảo

## Mục tiêu

Triển khai Test Contract v1.1 với ba đêm có bản đồ và thời lượng riêng. Logic trong `src/game.js` chạy độc lập renderer; CLI JSONL và giao diện trình duyệt cùng dùng mô phỏng này.

## Điều khiển

- `WASD` hoặc phím mũi tên: di chuyển; `Space`: nhảy; `Shift`: lướt.
- `E`: gửi đom đóm vào đèn gần; `F`: phát xung ánh sáng.
- `Esc` hoặc `P`: tạm dừng/tiếp tục; kéo chuột: xoay camera.

## Bản đồ và tiến trình

| Đêm | Bản đồ | Đèn | Thời gian |
|---|---|---:|---:|
| 1 | Đảo Bến | 5 | 300 giây |
| 2 | Đảo Cau, hai đảo nối cầu tre; có bệ phóng và Bùa Gió | 6 | 330 giây |
| 3 | Đảo Chuông, các tầng cao và đường dốc; có bệ phóng, Bùa Gió và Gió Lạc | 7 | 360 giây |

Tốc độ đi bộ là 6 m/s, sức chứa 10 đom đóm; mỗi đèn cần 10. Nhảy dùng trọng lực. Lướt đạt 14 m/s trong 0,2 giây, hồi chiêu 1,5 giây. Gió Đêm 3 hoạt động 5 giây mỗi 30 giây, có báo trước.

## Tương tác và tính điểm

- Thu đom đóm trong bán kính 1 m; gửi vào đèn trong 2 m. Đèn đã sáng tạo vùng an toàn bán kính 6 m.
- Xung sáng tiêu hao 3 đom đóm, tác động trong bán kính 5 m, làm choáng 120 tick và hồi chiêu 180 tick.
- Trúng đòn làm mất một ngọn lửa, rơi một nửa số đom đóm đang mang và nhận 90 tick bất tử. Rơi khỏi đảo làm mất một ngọn lửa rồi hồi sinh tại điểm đầu.
- Bóng Mực xuất hiện theo lịch từng đêm; Gió Lạc có thể lấy tối đa 3 đom đóm và bị xua để làm rơi số đã lấy. Bùa Gió tăng tốc và cho phép lướt không hồi chiêu trong thời gian hiệu lực.
- Điểm: 10 mỗi đom đóm gửi, 100 mỗi đèn thắp, 5 mỗi Bóng Mực trúng xung; thắng cộng `floor(time_left) × 2 + flames × 50`.

## Giao diện và headless

Trình duyệt render thế giới bằng Three.js tải cục bộ từ dependency `three`; giao diện có HUD, menu, giới thiệu đêm, pause, cài đặt âm thanh/độ nhạy, kết quả và âm thanh tổng hợp. CLI `src/headless.js` nhận `--night 1|2|3`, seed, input và scenario, xuất JSONL theo schema v1.1; cùng seed/input cho trạng thái xác định.

## Kiểm chứng

Chi tiết lệnh, số liệu chạy và smoke test trình duyệt nằm trong [bằng chứng Phase 2](../proof/phase-2/README.md).
