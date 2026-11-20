import test from "node:test";
import assert from "node:assert/strict";
import { createGame } from "../src/game.js";

const empty = { random_motes: false, random_shades: false };
test("v1.0 jump rises and lands while XZ determines pickups", () => {
  const game = createGame(1, { ...empty, motes: [[0, 20, 0]] });
  game.step({ jump: true });
  assert.ok(game.player.pos[1] > 0);
  assert.equal(game.player.carried, 1);
  for (let i = 0; i < 50; i++) game.step();
  assert.equal(game.player.pos[1], 0);
});
test("v1.0 pulse costs carried lights, and lit lamps repel shades", () => {
  const game = createGame(1, {
    ...empty, player: { carried: 1 }, shades: [{ id: "S1", pos: [0.5, 0, 0] }]
  });
  game.step({ pulse: true });
  assert.equal(game.player.carried, 0);
  assert.equal(game.player.flames, 5);
  assert.deepEqual(game.events.find(e => e.name === "pulse").data.stunned_ids, ["S1"]);
  const safe = createGame(1, { ...empty, lanterns: [{ id: "L1", pos: [0, 0, 0], lit: true }], shades: [{ pos: [0.5, 0, 0] }] });
  safe.step();
  assert.equal(safe.player.flames, 5);
  assert.ok(safe.shades[0].pos[0] >= 3);
});
test("v1.0 reaches win after the last deposit and loses to the last hit", () => {
  const win = createGame(1, {
    ...empty, player: { carried: 1 },
    lanterns: [{ id: "L1", pos: [0, 0, 0] }, ...[2, 3, 4, 5].map(n => ({ id: "L" + n, lit: true }))]
  });
  assert.equal(win.score, 0);
  assert.deepEqual(win.events, []);
  win.step({ interact: true });
  assert.equal(win.state, "won");
  assert.equal(win.events.at(-1).data.reason, "all_lit");
  const loss = createGame(1, { ...empty, player: { flames: 1 }, shades: [{ pos: [0.5, 0, 0] }] });
  loss.step();
  assert.equal(loss.state, "lost");
  assert.equal(loss.events.at(-1).data.reason, "no_flames");
});
