import test from "node:test";
import assert from "node:assert/strict";
import { createGame } from "../src/game.js";

test("pickup, deposit and lantern lighting", () => {
  const game = createGame(1, {
    random_motes: false, random_shades: false,
    motes: [[0, 0, 1]],
    lanterns: [{ id: "L1", pos: [0, 0, 2], deposited: 0 }],
    time_left_s: 300
  });
  game.step({ move: [0, 1], interact: false });
  assert.equal(game.player.carried, 1);
  game.step({ move: [0, 0], interact: true });
  assert.equal(game.player.carried, 0);
  assert.equal(game.lanterns[0].lit, true);
  assert.equal(game.events.some(e => e.name === "lantern_lit"), true);
});

test("same seed and inputs are deterministic", () => {
  const build = () => {
    const game = createGame(99, { random_motes: true, random_shades: true, time_left_s: 300 });
    for (let i = 0; i < 60; i++) game.step({ move: [i % 2 ? 1 : 0, 1], cam_yaw_deg: 45 });
    return game.snapshot();
  };
  assert.deepEqual(build(), build());
});

test("movement follows contract camera yaw and is normalized", () => {
  const game = createGame(1, { random_motes: false, random_shades: false, motes: [] });
  game.step({ move: [1, 1], cam_yaw_deg: 0 });
  assert.ok(Math.abs(game.player.pos[0] - 5 / 60 / Math.sqrt(2)) < 0.001);
  assert.ok(Math.abs(game.player.pos[2] - 5 / 60 / Math.sqrt(2)) < 0.001);
});
