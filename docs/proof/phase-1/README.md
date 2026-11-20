# Bằng chứng Phase 1

| Yêu cầu | Cách kiểm chứng | Bằng chứng | Kết quả |
|---|---|---|---|
| Build/CLI chạy được | `npm run build` | Node syntax check hai module chính | Đạt |
| Test logic core | `npm test` | 3 test đơn vị vượt qua | Đạt |
| Headless JSONL | Chạy 360 tick với seed 42 | [output.jsonl](output.jsonl) | Đạt |
| Tính tất định | Chạy hai lần seed 123, 120 tick | [determinism-a.jsonl](determinism-a.jsonl), [determinism-b.jsonl](determinism-b.jsonl); SHA-256 hai file giống nhau | Đạt |
| Giao diện chạy được | Khởi động `npm start`, truy cập localhost:4173 | HTTP 200 cho `/` và `/src/game.js`; trình duyệt hiển thị HUD | Đạt |

Chạy mẫu:

```bash
npm run headless -- --seed 42 --night 1 --ticks 360 --out docs/proof/phase-1/output.jsonl --snapshot-every 10
```
