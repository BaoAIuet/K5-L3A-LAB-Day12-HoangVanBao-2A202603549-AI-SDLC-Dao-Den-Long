# Đảo Đèn Lồng

Game 3D góc nhìn thứ ba về Mây, người giữ đèn nhỏ tuổi thu thập đom đóm, thắp lại đèn và né Bóng Mực.

## Cài đặt và chạy

```bash
npm install
npm run build
npm start
```

Mở `http://localhost:4173`.

## Điều khiển

- `WASD` hoặc mũi tên: di chuyển.
- `Space`: nhảy; `Shift`: lướt.
- `E`: nạp đom đóm vào đèn gần.
- `F`: tỏa sáng, làm choáng Bóng Mực và xua Gió Lạc.
- `Esc` hoặc `P`: tạm dừng; kéo chuột: xoay camera.
- `R`: chơi lại màn đã kết thúc.

## Điểm số

- Mỗi đom đóm: 10 điểm.
- Mỗi đèn thắp: 100 điểm.
- Mỗi Bóng Mực bị làm choáng: 5 điểm.
- Khi thắng: cộng thời gian còn lại × 2 và mỗi ngọn lửa còn lại × 50.

## Chế độ headless

```bash
npm test
npm run headless -- --seed 42 --night 1 --ticks 360 --out docs/proof/phase-2/sample.jsonl --snapshot-every 10
```

`--night` nhận 1, 2 hoặc 3; JSONL có snapshot tick/sim_tick và các entity đang hoạt động. Input/scenario truyền bằng `--inputs` hoặc `--scenario`. Logic headless không phụ thuộc GPU.

## Cấu trúc

- `src/game.js`: logic gameplay độc lập phần hiển thị, 3 đêm.
- `src/headless.js`: CLI theo Test Contract.
- `public/`: giao diện game 3D Three.js và HUD.
- `tests/`: test unit và kiểm tra tính tất định.
- `docs/notes/`: giả định, nhật ký AI, retro.
- `docs/proof/`: bằng chứng kiểm chứng từng phase.

## Phase 1 và Phase 2

Tag `phase-1` là bản một đêm với Test Contract v1.0. Tag `phase-2` là bản ba đêm với Test Contract v1.1. Xem [spec Phase 2](docs/notes/phase-2-spec.md) và [bằng chứng kiểm chứng](docs/proof/phase-2/README.md).

## Sáng tạo của tôi

Thế giới Three.js có mặt nước chuyển động, quầng sáng cho đom đóm và vòng sáng khi thắp đèn. Phần hiển thị đọc dữ liệu từ mô phỏng; các bài test xác nhận kết quả headless lặp lại với cùng seed và input.
