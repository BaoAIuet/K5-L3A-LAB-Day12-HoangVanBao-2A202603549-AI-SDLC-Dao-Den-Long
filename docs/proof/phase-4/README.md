# Kiểm chứng phát hành Phase 4

| Tiêu chí | Bằng chứng |
|---|---|
| Contract v1.3 và hồi quy | `npm run build` và `npm test` đạt 25/25. [Headless JSONL](out.jsonl) chạy 60 tick, seed 42. |
| Benchmark | [bench.json](bench.json) được sinh bằng lệnh trong README, với `BENCH_HEADLESS=1` ở lượt lưu cuối. Windows 10.0.26300, Node.js 26.13.1, Chrome WebGL 2 và Intel Iris Xe, 1280 × 720. |
| Soak | [soak.json](soak.json) chạy seed 7, 10 đêm, 0 crash. RSS 44,04 → 50,45 MiB, tăng khoảng 14,6%. Lệnh giới hạn vùng cấp phát thế hệ trẻ của V8 và thu gom trước hai lần đọc RSS. |
| Bảng điểm | Test kiểm tra tên, top 10, thứ tự khi bằng điểm, dữ liệu trên đĩa và xuất từ tiến trình mới. Chrome đi qua màn thua, gửi tên và thấy tên ở bảng điểm. |
| Dễ tiếp cận | Chrome xác nhận cỡ chữ HUD mặc định 18 px, bật chữ lớn và giảm chuyển động, báo trùng khi đổi phím, lưu phím mới và khôi phục mặc định. Đã quan sát cảnh báo dầu yếu trong lúc châm dầu. |
| Gói chạy | Giải nén ZIP vào thư mục mới, khởi động Node.js với Three.js đi kèm, kiểm tra HTTP và bảng điểm. Gói còn có thư mục web tĩnh. |
| Demo và tài liệu | [MP4 trực tiếp trong game](../../demo/demo.mp4), khoảng 11 giây. Các cảnh thử nhiên liệu và Tỏa Sáng dùng trạng thái chuẩn bị. Các số trên video thuộc lượt đo trước khi khóa bản phát hành. [Retro](../../notes/retro.md). |

Kết quả benchmark trên máy phát triển là **50,86 FPS trung bình**, **15,89 FPS p1 low**, **36,20 ms p95** và **3,96 giây tải**. Hai số FPS dưới ngưỡng 60/30 của ticket. Lượt Chrome cửa sổ trước đó cũng dưới ngưỡng. Cấu hình máy chấm chung chưa được kiểm tra. VSync được yêu cầu tắt qua cờ Chrome, nhưng bản web không xác nhận được nên báo `false`. RSS của trình kết xuất web được báo `null`.
