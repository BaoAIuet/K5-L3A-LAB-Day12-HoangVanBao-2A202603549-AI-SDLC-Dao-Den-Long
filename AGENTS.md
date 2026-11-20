# AGENTS

- Stack: dependency-free HTML Canvas/JavaScript with a Node.js CLI.
- Use `npm run build` for syntax checks and `npm test` for tests.
- Run headless with `node src/headless.js --seed 42 --night 1 --ticks 60 --out /tmp/out.jsonl`.
- Keep gameplay logic in `src/game.js`; rendering and server must not change game state.
- The Test Contract is the source of truth. Update `game.contract.json` and headless behavior together.
- Do not add external assets or API keys. Keep scenarios deterministic for a given seed.
- Every change affecting rules needs a test in `tests/`.
