# AGENTS

- Stack: Three.js in the browser, JavaScript gameplay simulation, and a Node.js headless CLI.
- Use `npm run build` for syntax checks and `npm test` for tests.
- Run headless with `node src/headless.js --seed 42 --night 1 --ticks 60 --out docs/proof/phase-2/out.jsonl`.
- Keep gameplay logic in `src/game.js`; rendering and server must not change game state.
- The Test Contract v1.1 is the source of truth for all three nights. Update `game.contract.json` and headless behavior together.
- Do not add external assets or API keys. Keep scenarios deterministic for a given seed.
- Every ticket acceptance criterion needs a focused test or a recorded manual verification.
- Ticket-02 specifies input order, three standard maps, HUD placement, and palette. Keep browser effects out of gameplay and JSONL.
- Run the executable headless scenarios before changing a phase tag. Record headless runtime and browser FPS at 1280 × 720 with the test environment.
