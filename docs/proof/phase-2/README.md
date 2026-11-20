# Bằng chứng Phase 2

| Yêu cầu | Cách kiểm chứng | Kết quả |
|---|---|---|
| Build JavaScript | `npm run build` | Đạt |
| Kiểm thử gameplay và CLI | `npm test` | 18/18 test đạt |
| Chạy hết thời lượng Đêm 1 | [full-night.jsonl](full-night.jsonl), seed 42, 18.000 tick | Hoàn tất tới 0 giây; trạng thái `lost` là kết quả mô phỏng không có input |
| Chạy hết thời lượng Đêm 3 | [perf-night3.jsonl](perf-night3.jsonl), seed 42, [scenario đo](perf-scenario.json) | Đủ 21.600 tick, còn 0 giây và có 10 Bóng Mực. Scenario cấp bất tử để tránh kết thúc sớm do đứng yên; các hệ thống sinh thực thể và gió vẫn chạy |
| Hiệu năng headless Đêm 3 | Lệnh đo bên dưới | 1,24 giây trên Node.js 26.13.1 / Windows, dưới ngưỡng 30 giây |
| Hiệu năng bản có giao diện | Chrome WebGL 2, 1280 × 720, Intel Iris Xe/ANGLE D3D11, lấy mẫu 3 giây sau khi vào từng đêm | 54,3 FPS ở Đêm 1, 50,7 ở Đêm 2 và 57,3 ở Đêm 3. Trung bình 54,1 FPS |
| Renderer Three.js | Mở `http://localhost:4173`, vào Đêm 1 | Canvas 1408×964, WebGL context không mất; thấy đảo, nhân vật và đom đóm |
| Pause và cài đặt | Trong game nhấn `Esc`, mở Cài đặt, đóng rồi Tiếp tục | Màn pause/cài đặt hoạt động; đồng hồ giữ nguyên `01:51` khi đang tạm dừng |
| Các nhánh gameplay mới | Test lịch Bóng Mực, rơi/hồi sinh, vùng an toàn, Gió Lạc, bệ phóng và tầng/đường dốc | Có test tự động trong `tests/game.test.js` |

Chạy lại các kiểm tra:

```bash
npm test
npm run build
node src/headless.js --seed 42 --night 3 --ticks 21600 --scenario docs/proof/phase-2/perf-scenario.json --out docs/proof/phase-2/perf-night3.jsonl --snapshot-every 60
```

Các bản ghi full-night dùng input mặc định (không điều khiển người chơi), vì vậy kết thúc `lost` không phải bằng chứng thắng màn; chúng xác nhận mô phỏng chạy hết số tick và ghi snapshot/event JSONL tới khi hết giờ.

## Kiểm chứng bản nâng cấp đồ họa Phase 1 và Phase 2

- Chrome headless với WebGL 2 ở 1280 × 800 đã mở menu, cài đặt và dựng được cả ba đêm. HUD hiển thị lần lượt 5, 6 và 7 đèn.
- Kiểm tra bố cục HUD ở 360 × 700 và xem ảnh chụp menu cùng cảnh đầu mỗi đêm.
- Kiểm tra tạm dừng và tiếp tục qua giao diện. Với trạng thái chuẩn bị trong phiên kiểm thử, nhấn `F` tiêu hao 3 đom đóm và nhấn `E` để thắp đèn cập nhật HUD thành `1 / 5` cùng thông báo.
- Chuỗi thắng ở cả ba đêm đi đến Bình Minh. Đã thử thắng bằng lần nạp đèn cuối, chơi lại sau khi mất hết Ngọn Lửa và mở cài đặt khi đang tạm dừng. Trạng thái trước mỗi tình huống được chuẩn bị bằng Chrome DevTools.
- Build và 18 kiểm thử đều đạt. [Bản ghi headless Đêm 1, seed 42, 60 tick](out.jsonl).

## Kiểm chứng bản nâng cấp nhân vật và cảnh quan

- Chrome WebGL 2 nhận phím chạy, nhảy và lướt. Phiên thử quan sát được hạt dưới chân khi chạy, trạng thái trên không và tiếp đất. Ảnh kiểm tra menu cho thấy nón, khuôn mặt và đèn cầm tay.
- Lấy mẫu 3 giây đầu ở 1280 × 720 trên Chrome, Intel Iris Xe/ANGLE D3D11. Đêm 1 đạt 44,7 FPS, Đêm 2 đạt 31,2 FPS, Đêm 3 đạt 38,5 FPS. Đây là số đo đầu mỗi đêm trên máy kiểm tra.
- Build và 18 test đạt. Chạy lại lệnh headless 60 tick với seed 42 cho bản ghi khớp với tệp đã lưu.

## Kiểm chứng hướng điều khiển và hiệu ứng cảnh vật

- Chrome WebGL 2 xác nhận A/D và ←/→ di chuyển đúng phía theo camera ở góc 0° và 90°. Đối chiếu độ dời của Mây với trục ngang của camera.
- Kiểm tra ảnh chụp menu và Đêm 1, gồm sao, núi, nước, tán cây và Bóng Mực. Tình huống có Bóng Mực được chuẩn bị trong phiên thử để xác nhận quầng sáng và bốn dải sương.
- Mẫu Chrome ở 1280 × 720 trên Intel Iris Xe đạt 51,1 FPS ở Đêm 1, 44,8 ở Đêm 2 và 48,7 ở Đêm 3.

## Kiểm chứng Bóng Mực phát hiện và phản hồi Tỏa Sáng

- Test mô phỏng kiểm tra các mốc 12 m và 18 m, cùng việc kiểm tra lại khoảng cách khi hết choáng. Toàn bộ 19 test đạt.
- Chrome chạy tình huống có Bóng Mực ở gần Mây. Bóng Mực chuyển sang đuổi, rồi phím F tạo hai vòng sóng, chớp sáng, tia bung và vệt đẩy lùi. Hiệu ứng va chạm được thu hồi khi kết thúc trong khi Bóng Mực vẫn choáng.
- Bản trình duyệt bật tầm nhìn 90° theo hướng mắt Bóng Mực. Test tập trung kiểm tra phía trước, hai bên hông, phía sau, ngoài bán kính 12 m và việc ngừng đuổi ở 18 m. CLI theo quy tắc phát hiện bằng bán kính của Contract v1.1. Toàn bộ 20 test đạt.
