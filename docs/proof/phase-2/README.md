# Bằng chứng Phase 2

| Yêu cầu | Cách kiểm chứng | Kết quả |
|---|---|---|
| Build JavaScript | `npm run build` | Đạt |
| Kiểm thử gameplay và CLI | `npm test` | 17/17 test đạt |
| Chạy hết thời lượng Đêm 1 | [full-night.jsonl](full-night.jsonl), seed 42, 18.000 tick | Hoàn tất tới 0 giây; trạng thái `lost` là kết quả mô phỏng không có input |
| Chạy hết thời lượng Đêm 3 | [perf-night3.jsonl](perf-night3.jsonl), seed 42, 21.600 tick | Hoàn tất tới 0 giây; trạng thái `lost` là kết quả mô phỏng không có input |
| Hiệu năng headless Đêm 3 | `node src/headless.js --seed 42 --night 3 --ticks 21600 --out docs/proof/phase-2/perf-night3.jsonl --snapshot-every 60` | 0,634 giây trên Node.js 26.13.1 / Windows (một lần đo; phụ thuộc máy) |
| Renderer Three.js | Mở `http://localhost:4173`, vào Đêm 1 | Canvas 1408×964, WebGL context không mất; thấy đảo, nhân vật và đom đóm |
| Pause và cài đặt | Trong game nhấn `Esc`, mở Cài đặt, đóng rồi Tiếp tục | Màn pause/cài đặt hoạt động; đồng hồ giữ nguyên `01:51` khi đang tạm dừng |
| Các nhánh gameplay mới | Test lịch Bóng Mực, rơi/hồi sinh, vùng an toàn, Gió Lạc, bệ phóng và tầng/đường dốc | Có test tự động trong `tests/game.test.js` |

Chạy lại các kiểm tra:

```bash
npm test
npm run build
node src/headless.js --seed 42 --night 3 --ticks 21600 --out docs/proof/phase-2/perf-night3.jsonl --snapshot-every 60
```

Các bản ghi full-night dùng input mặc định (không điều khiển người chơi), vì vậy kết thúc `lost` không phải bằng chứng thắng màn; chúng xác nhận mô phỏng chạy hết số tick và ghi snapshot/event JSONL tới khi hết giờ.
