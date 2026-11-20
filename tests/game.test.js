import test from "node:test";
import assert from "node:assert/strict";
import { createGame } from "../src/game.js";

const emptyNight = (extra = {}) => ({
  random_motes: false, random_shades: false, random_drifters: false,
  motes: [], time_left_s: 300, ...extra
});

test("contract tuning, three night maps, and deterministic starting items", () => {
  for (const [night, count, duration] of [[1, 5, 240], [2, 6, 270], [3, 7, 300]]) {
    const game = createGame(42, {}, {}, night);
    assert.equal(game.lanterns.length, count);
    assert.equal(game.timeLeft, duration);
    assert.equal(game.motes.length, 20);
    assert.equal(new Set(game.motes.map(m => m.pos.join(","))).size, 20);
    assert.deepEqual(createGame(42, {}, {}, night).snapshot(), game.snapshot());
  }
});

test("movement accelerates to the standardized speed and jump is gravity-driven", () => {
  const game = createGame(1, emptyNight());
  for (let i = 0; i < 6; i++) game.step({ move: [0, 1] });
  assert.ok(Math.abs(game.player.vel[2] - 6) < 0.001);
  assert.ok(Math.abs(game.player.pos[2] - 0.467) < 0.01);
  game.step({ move: [0, 0], jump: true });
  assert.equal(game.player.grounded, false);
  assert.ok(game.player.vel[1] > 6);
});

test("mote pickup checks capacity and vertical distance", () => {
  const game = createGame(1, emptyNight({
    player: { pos: [0, 0, 0], carried: 9 },
    motes: [[0, 2, 0], [0, 1.5, 0], [0, 0, 0]]
  }));
  game.step();
  assert.equal(game.player.carried, 10);
  assert.equal(game.motes.length, 2);
  assert.equal(game.events.filter(e => e.name === "mote_picked").length, 1);
});

test("lantern interaction banks partial amounts and picks the nearest eligible lantern", () => {
  const game = createGame(1, emptyNight({
    player: { pos: [0, 0, 0], carried: 10 },
    lanterns: [
      { id: "L1", pos: [0, 0, 1], deposited: 8 },
      { id: "L2", pos: [0, 0, 0.5], deposited: 0 }
    ]
  }));
  game.step({ interact: true });
  assert.equal(game.lanterns.find(l => l.id === "L2").deposited, 10);
  assert.equal(game.lanterns.find(l => l.id === "L2").lit, true);
  assert.equal(game.lanterns.find(l => l.id === "L1").deposited, 8);
  assert.equal(game.player.carried, 0);
  assert.equal(game.score, 150);
});

test("dash has standardized duration, cooldown, and a rising-edge trigger", () => {
  const game = createGame(1, emptyNight());
  game.step({ move: [0, 1], dash: true });
  assert.equal(game.dashTicks, 11);
  assert.equal(game.dashCooldownTicks, 90);
  assert.equal(game.events.some(e => e.name === "dash"), true);
  for (let i = 0; i < 20; i++) game.step({ move: [0, 1], dash: true });
  assert.equal(game.events.some(e => e.name === "dash"), false);
  assert.equal(game.dashCooldownTicks, 70);
});

test("pulse consumes three carried motes, stuns and pushes shades deterministically", () => {
  const game = createGame(1, emptyNight({
    player: { pos: [0, 0, 0], carried: 5 },
    shades: [{ id: "S1", pos: [0, 0, 4], state: "wander" }]
  }));
  game.step({ pulse: true });
  assert.equal(game.player.carried, 2);
  assert.equal(game.shades[0].state, "stunned");
  assert.equal(game.shades[0].stunTicks, 119);
  assert.ok(game.shades[0].pos[2] > 4);
  assert.equal(game.score, 5);
  assert.equal(game.events.some(e => e.name === "pulse"), true);
});

test("a shade detects within 12 m, keeps chasing until 18 m, and checks range again after a stun", () => {
  const game = createGame(1, emptyNight({ shades: [{ pos: [0, 0, 13], state: "wander" }] }));
  const shade = game.shades[0];
  const stepAt = (distance, input) => {
    game.player.pos = [0, 0, 0];
    shade.pos = [0, 0, distance];
    game.step(input);
    return shade.state;
  };
  assert.equal(stepAt(12.01), "wander");
  assert.equal(stepAt(12), "chase");
  assert.equal(stepAt(17.99), "chase");
  assert.equal(stepAt(18), "wander");
  game.player.carried = 3;
  assert.equal(stepAt(4, { pulse: true }), "stunned");
  for (let i = 0; i < 119; i++) stepAt(14, { pulse: false });
  assert.equal(shade.state, "wander");
});

test("a shade with forward vision acquires from the front and loses pursuit at 18 m", () => {
  const check = (pos, expected) => {
    const game = createGame(1, emptyNight({
      player: { pos },
      shades: [{ pos: [0, 0, 0], state: "wander" }]
    }), { shade_view_deg: 90 });
    const shade = game.shades[0];
    shade.heading = [0, 1];
    game.step();
    assert.equal(shade.state, expected);
    return game;
  };
  check([0, 0, -6], "wander");
  check([6, 0, 0], "wander");
  check([-6, 0, 0], "wander");
  check([0, 0, 12.01], "wander");
  const game = check([2, 0, 6], "chase");
  const shade = game.shades[0];
  game.player.pos = [shade.pos[0], 0, shade.pos[2] - 16];
  game.step();
  assert.equal(shade.state, "chase");
  game.player.pos = [shade.pos[0], 0, shade.pos[2] + 18.01];
  game.step();
  assert.equal(shade.state, "wander");
});

test("pause advances wall tick but freezes simulation time until resumed", () => {
  const game = createGame(1, emptyNight());
  game.step({ pause: true, move: [1, 0] });
  assert.equal(game.tick, 1);
  assert.equal(game.simTick, 0);
  assert.equal(game.state, "paused");
  game.step({ pause: false });
  assert.equal(game.simTick, 0);
  game.step({ pause: true });
  assert.equal(game.state, "playing");
  assert.equal(game.simTick, 1);
  assert.ok(game.timeLeft < 300);
});

test("drifters steal carried motes and pulse makes a pursuing drifter flee", () => {
  const game = createGame(1, emptyNight({
    player: { pos: [0, 0, 0], carried: 7 },
    drifters: [{ id: "D1", pos: [0, 0, 0], state: "chase" }]
  }), {}, 2);
  game.step();
  assert.equal(game.player.carried, 4);
  assert.equal(game.drifters[0].stolen, 3);
  assert.equal(game.drifters[0].state, "flee");
  assert.equal(game.events.some(e => e.name === "drifter_steal"), true);
});

test("wind charm grants its duration and night-three wind is deterministic", () => {
  const game = createGame(17, emptyNight({
    player: { pos: [30, 0, 25] },
    charms: [{ id: "C1", pos: [30, 0, 25], available: true }]
  }), {}, 3);
  game.step();
  assert.equal(game.charmTicks, 600);
  assert.equal(game.charms[0].available, false);
  assert.equal(game.events.some(e => e.name === "charm_picked"), true);
  while (game.simTick < 1680) game.step();
  assert.equal(game.windWarning, true);
  assert.equal(game.windActive, false);
  while (game.simTick < 1800) game.step();
  assert.equal(game.windActive, true);
  assert.equal(game.snapshot().wind.active, true);
});

test("a hit drops half the carried motes and grants 90 ticks of invulnerability", () => {
  const game = createGame(1, emptyNight({
    player: { pos: [0, 0, 0], carried: 8 },
    shades: [{ id: "S1", pos: [0.5, 0, 0], state: "chase" }]
  }));
  game.step();
  assert.equal(game.player.flames, 2);
  assert.equal(game.player.carried, 4);
  assert.equal(game.invulnTicks, 90);
  assert.equal(game.motes.filter(m => m.kind === "dropped").length, 4);
  for (let i = 0; i < 89; i++) game.step();
  assert.equal(game.invulnTicks, 1);
});

test("night-one shade schedule starts with two and respects the map limit", () => {
  const game = createGame(7, emptyNight({ random_shades: true }));
  for (let i = 0; i < 300; i++) game.step();
  assert.equal(game.shades.length, 2);
  assert.ok(game.shades.every(shade => shade.state === "spawning"));
  for (let i = 0; i < 3000; i++) game.step();
  assert.ok(game.shades.filter(shade => shade.state !== "removed").length <= game.map.shadeLimit);
});

test("falling costs one flame and respawns at the island start", () => {
  const game = createGame(1, emptyNight({ player: { pos: [41, 0, 0] } }));
  for (let i = 0; i < 120 && game.player.flames === 3; i++) game.step();
  assert.equal(game.player.flames, 2);
  assert.equal(game.respawnTicks, 60);
  for (let i = 0; i < 60; i++) game.step();
  assert.deepEqual(game.player.pos, [0, 0, 0]);
  assert.equal(game.player.grounded, true);
  assert.equal(game.invulnTicks, 90);
});

test("safe zones repel shades and a pulse makes a fleeing drifter drop stolen motes", () => {
  const safeGame = createGame(1, emptyNight({
    lanterns: [{ id: "L1", pos: [0, 0, 0], lit: true }],
    shades: [{ id: "S1", pos: [0, 0, 2], state: "chase" }]
  }));
  safeGame.step();
  assert.ok(Math.abs(Math.hypot(safeGame.shades[0].pos[0], safeGame.shades[0].pos[2]) - 6) < 0.01);

  const drifterGame = createGame(1, emptyNight({
    player: { pos: [0, 0, 0], carried: 3 },
    drifters: [{ id: "D1", pos: [2, 0, 0], state: "flee", stolen: 4, state_ticks_left: 100 }]
  }), {}, 2);
  drifterGame.step({ pulse: true });
  assert.equal(drifterGame.drifters[0].state, "flee");
  assert.ok(drifterGame.motes.every(mote => mote.pos.join() === "2,0,0"));
  assert.equal(drifterGame.motes.filter(mote => mote.kind === "dropped").length, 4);
  assert.ok(drifterGame.events.some(event => event.name === "drifter_drop"));
});

test("night-two launch pads and night-three stepped floors use their intended heights", () => {
  const islandGame = createGame(1, emptyNight({ player: { pos: [20, 0, 18] } }), {}, 2);
  islandGame.step();
  assert.equal(islandGame.player.launched, true);
  const [vx, vy, vz] = islandGame.player.launchVelocity;
  assert.equal(vy, 14);
  assert.ok(Math.abs(Math.hypot(vx, vz) - 24) < 0.001);
  assert.ok(Math.abs(vz / vx + 18 / 50) < 0.001);
  for (let i = 0; i < 90 && islandGame.player.launched; i++) islandGame.step({ move: [-1, 0] });
  assert.ok(Math.hypot(islandGame.player.pos[0] - 70, islandGame.player.pos[2]) < 28);

  const mountainGame = createGame(1, emptyNight(), {}, 3);
  assert.equal(mountainGame.floorAt(0, 0), 6);
  assert.equal(mountainGame.floorAt(0, 16), 3);
  assert.equal(mountainGame.floorAt(27 * Math.cos(Math.PI / 6), 13.5), 1.5);
});

test("headless state remains deterministic for equal seeds and input streams", () => {
  const run = () => {
    const game = createGame(99, {}, {}, 2);
    for (let i = 0; i < 600; i++) game.step({ move: [i % 2 ? 1 : 0, 1], cam_yaw_deg: 45 });
    return game.snapshot();
  };
  assert.deepEqual(run(), run());
});
