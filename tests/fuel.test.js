import test from "node:test";
import assert from "node:assert/strict";
import { createGame } from "../src/game.js";

const setup = scenario => createGame(42, {
  random_motes: false, random_shades: false, random_drifters: false, ...scenario
});
const near = { id: "L1", pos: [0, 0, 0] };

test("fuel ticks, refueling, lantern expiry and relighting retain the correct history", () => {
  const game = setup({ player: { carried: 7 }, lanterns: [{ ...near, lit: true, fuel: 90 }] });
  assert.equal(game.snapshot().player.capacity, 10);
  game.step({ interact: true });
  assert.deepEqual(game.events.at(-1).data, { lantern_id: "L1", amount: 2, fuel: 100 });
  assert.equal(game.score, 10);
  assert.equal(game.interactionLantern(), undefined);
  assert.equal(game.lanterns[0].fuelTicks, 6000);
  for (let i = 0; i < 6000; i++) game.step({ interact: false });
  assert.deepEqual(game.events.at(-1).data, { lantern_id: "L1" });
  assert.equal(game.events.at(-1).name, "lantern_out");
  assert.equal(game.snapshot().lanterns[0].deposited, 0);
  assert.equal(game.snapshot().lanterns[0].ever_lit, true);
  game.step({ interact: true });
  assert.deepEqual(game.events.at(-1).data, { lantern_id: "L1", relight: true });
  assert.equal(game.snapshot().lanterns[0].relit_count, 1);
  assert.equal(game.snapshot().player.capacity, 12);
  assert.equal(game.score, 75);
});

test("the dawn check uses live lamps after this tick's updates and death takes priority", () => {
  const lamps = [1, 2, 3, 4, 5].map(i => ({ id: `L${i}`, lit: true }));
  const early = setup({ lanterns: lamps });
  early.step();
  assert.equal(early.state, "playing");
  const scenario = { time_left_s: 1 / 60, lanterns: lamps.slice(0, 3) };
  const win = setup(scenario);
  win.step();
  assert.equal(win.events.at(-1).data.reason, "dawn_survived");
  assert.equal(win.score, 3 * (50 + 99) + 150);
  const out = setup({ ...scenario, lanterns: [lamps[0], lamps[1], { ...lamps[2], fuel: 1 / 60 }] });
  out.step();
  assert.equal(out.events.at(-1).data.reason, "dawn");
  const dead = setup({ ...scenario, player: { flames: 0 } });
  dead.step();
  assert.equal(dead.events.at(-1).data.reason, "no_flames");
});

test("wanderers drain weak lamps cumulatively, emit at 60 ticks and leave when refueled", () => {
  const game = setup({
    player: { pos: [20, 0, 0], carried: 4 },
    lanterns: [{ ...near, lit: true, fuel: 29 }],
    shades: [{ pos: [1, 0, 0] }, { pos: [0, 0, 1] }]
  });
  game.step();
  assert.ok(game.shades.every(shade => shade.state === "drain"));
  for (let i = 0; i < 60; i++) game.step();
  assert.equal(game.snapshot().lanterns[0].fuel, 18);
  assert.equal(game.events.filter(event => event.name === "fuel_drain").length, 2);
  game.player.pos = [0, 0, 0];
  game.step({ interact: true });
  assert.ok(game.isSafeLantern(game.lanterns[0]));
  assert.ok(game.shades.every(shade => shade.state !== "drain" && shade.safePushTicks > 0));
  assert.equal(game.player.flames, 3);
});

test("pulse against a draining shade is worth 15 and a capped inventory stays at 20", () => {
  const game = setup({
    player: { carried: 3, successful_lights: 6 },
    lanterns: [{ ...near, lit: true, fuel: 24 }],
    shades: [{ pos: [1, 0, 0], state: "drain", target_lantern_id: "L1" }]
  });
  game.step({ pulse: true });
  assert.equal(game.snapshot().player.capacity, 20);
  assert.equal(game.shades[0].state, "stunned");
  assert.equal(game.score, 15);
});
