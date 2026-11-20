# AGENTS

- Stack: Three.js in the browser, JavaScript gameplay simulation, and a Node.js headless CLI.
- Use `npm run build` for syntax checks and `npm test` for tests.
- Run headless with `node src/headless.js --seed 42 --night 1 --ticks 60 --out docs/proof/phase-2/out.jsonl`.
- Keep gameplay logic in `src/game.js`; rendering and server must not change game state.
- The Test Contract v1.1 is the source of truth for all three nights. Update `game.contract.json` and headless behavior together.
- Do not add external assets or API keys. Keep scenarios deterministic for a given seed.
- Every ticket acceptance criterion needs a focused test or a recorded manual verification.
