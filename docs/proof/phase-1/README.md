# Bằng chứng Phase 1

| Yêu cầu | Kiểm chứng |
|---|---|
| Đảo Bến 3D, 5 đèn, camera và HUD | Chrome WebGL 2 ở 1280 × 720; mở menu và vào chơi. |
| Di chuyển, nhảy, nhặt và nạp | Build và 6 test đạt; test điều khiển theo camera, nhảy, XZ, nhặt và nạp. |
| Bóng Mực, tỏa sáng và vùng an toàn | Test tiêu hao đom đóm, choáng Bóng Mực và bảo vệ quanh đèn; nhấn F trong Chrome với trạng thái chuẩn bị. |
| Thắng, thua, chơi lại | Nạp đèn cuối để thắng và làm cạn Ngọn Lửa để thua trong trạng thái thử nghiệm; nút chơi lại khởi động lại Đêm 1. |
| Headless v1.0 | [360 tick, seed 42](output.jsonl); [lần 1](determinism-a.jsonl) và [lần 2](determinism-b.jsonl) trùng SHA‑256. |
| Bàn giao | README, game.contract.json, AGENTS.md và ghi chép Phase 1 nằm trong bản này. |

```bash
npm run build
npm test
node src/headless.js --seed 42 --night 1 --ticks 360 --out docs/proof/phase-1/output.jsonl
```
