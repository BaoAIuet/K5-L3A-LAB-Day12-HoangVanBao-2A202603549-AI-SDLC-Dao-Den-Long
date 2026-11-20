# Đảo Đèn Lồng

[![Video demo](https://img.shields.io/badge/Video-Demo-orange)](docs/demo/demo.mp4)

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
- `E`: nạp đom đóm vào đèn gần.
- `Space`: tỏa sáng, xua và làm choáng Bóng Mực.
- `R`: chơi lại.

## Điểm số

- Mỗi đom đóm: 10 điểm.
- Mỗi đèn thắp: 100 điểm.
- Mỗi Bóng Mực bị làm choáng: 25 điểm.
- Khi thắng: cộng thời gian còn lại × 5 và ánh sáng còn lại × 50.

## Chế độ headless

```bash
npm test
npm run headless -- --seed 42 --night 1 --ticks 360 --out docs/proof/phase-1/output.jsonl --snapshot-every 10
```

Đầu ra JSONL tuân theo `game.contract.json`. Tệp input/scenario phải dùng tham số `--inputs` hoặc `--scenario`.

## Cấu trúc

- `src/game.js`: logic gameplay độc lập phần hiển thị.
- `src/headless.js`: CLI theo Test Contract.
- `public/`: giao diện HTML Canvas pseudo-3D.
- `tests/`: test unit và kiểm tra tính tất định.
- `docs/notes/`: giả định, nhật ký AI, retro.
- `docs/proof/`: bằng chứng kiểm chứng từng phase.

## Sáng tạo của tôi

Bản màn hình dùng Canvas pseudo-3D gọn nhẹ, đảo phát sáng dần theo trạng thái đèn và HUD hiển thị thời gian, điểm, số ánh sáng và số đom đóm mang theo.
