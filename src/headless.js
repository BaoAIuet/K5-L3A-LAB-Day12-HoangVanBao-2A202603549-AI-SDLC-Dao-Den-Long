import fs from "node:fs";
import { createGame } from "./game.js";

function fail(message, code = 2) {
  console.error(message);
  process.exit(code);
}

function parseArgs(argv) {
  const parsed = {};
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (!token.startsWith("--")) fail(`Unexpected argument: ${token}`);
    const key = token.slice(2);
    if (key === "help") {
      console.log("Usage: node src/headless.js --seed <int> --night <1|2|3> --ticks <int> --out <file> [--scenario <file>] [--inputs <file>] [--snapshot-every <int>]");
      process.exit(0);
    }
    const value = argv[i + 1];
    if (value == null || value.startsWith("--")) fail(`Missing value for --${key}`);
    parsed[key] = value;
    i++;
  }
  return parsed;
}

function readJson(file, label) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (error) {
    fail(`Invalid ${label}: ${error.message}`);
  }
}

const args = parseArgs(process.argv.slice(2));
if (args.seed == null || args.ticks == null || args.out == null) {
  fail("Required: --seed <int> --ticks <int> --out <file>");
}
const seed = Number(args.seed);
const ticks = Number(args.ticks);
const night = args.night == null ? 1 : Number(args.night);
const snapshotEvery = args["snapshot-every"] == null ? 10 : Number(args["snapshot-every"]);
if (!Number.isInteger(seed)) fail("--seed must be an integer");
if (!Number.isSafeInteger(ticks) || ticks < 0) fail("--ticks must be a non-negative integer");
if (!Number.isInteger(night) || ![1, 2, 3].includes(night)) fail("--night must be 1, 2, or 3");
if (!Number.isInteger(snapshotEvery) || snapshotEvery <= 0) fail("--snapshot-every must be a positive integer");

const contract = readJson(new URL("../game.contract.json", import.meta.url), "game.contract.json");
const scenario = args.scenario ? readJson(args.scenario, "scenario") : {};
if (!scenario || typeof scenario !== "object" || Array.isArray(scenario)) fail("Scenario must be a JSON object");
const inputDocument = args.inputs ? readJson(args.inputs, "inputs") : { frames: [] };
if (!inputDocument || typeof inputDocument !== "object" || Array.isArray(inputDocument)) fail("Inputs must be a JSON object");
const frames = args.inputs ? inputDocument.frames : [];
if (!Array.isArray(frames)) fail("inputs.frames must be an array");
let lastTick = -1;
for (const frame of frames) {
  if (!frame || !Number.isInteger(frame.tick) || frame.tick < 0 || frame.tick <= lastTick) {
    fail("Input frame ticks must be non-negative integers and increase strictly");
  }
  lastTick = frame.tick;
  if ("move" in frame && (!Array.isArray(frame.move) || frame.move.length !== 2
    || frame.move.some(n => typeof n !== "number" || n < -1 || n > 1))) {
    fail("Input move must be [x,z] with each component in [-1,1]");
  }
  if ("cam_yaw_deg" in frame && !Number.isFinite(frame.cam_yaw_deg)) fail("Input cam_yaw_deg must be a number");
  for (const key of ["jump", "dash", "interact", "pulse", "pause"]) {
    if (key in frame && typeof frame[key] !== "boolean") fail(`Input ${key} must be a boolean`);
  }
}

const isObject = value => value !== null && typeof value === "object" && !Array.isArray(value);
const isPosition = value => Array.isArray(value) && value.length === 3 && value.every(Number.isFinite);
const isCount = value => Number.isSafeInteger(value) && value >= 0;
const optional = (object, key, check) => !(key in object) || check(object[key]);
const isId = value => typeof value === "string" && value.length > 0;
const isBoolean = value => typeof value === "boolean";
const enumValue = values => value => values.includes(value);
const item = (value, checks) => isObject(value) && Object.entries(checks).every(([key, check]) => optional(value, key, check));
const playerFields = {
  pos: isPosition, vel: isPosition, grounded: isBoolean, facing: Number.isFinite, carried: isCount, flames: isCount,
  invuln_ticks: isCount, dash_cd_ticks: isCount, pulse_cd_ticks: isCount, charm_ticks: isCount
};
const scenarioFields = {
  player: value => item(value, playerFields),
  time_left_s: value => Number.isFinite(value) && value >= 0,
  random_motes: isBoolean, random_shades: isBoolean, random_drifters: isBoolean, wind_enabled: isBoolean,
  lanterns: value => Array.isArray(value) && value.every(entry => item(entry, {
    id: isId, pos: isPosition, lit: isBoolean, deposited: isCount
  }) && isId(entry.id)),
  motes: value => Array.isArray(value) && value.every(entry => isPosition(entry) || item(entry, {
    id: isId, pos: isPosition, kind: enumValue(["random", "dropped"]), ttl_ticks: isCount,
    ttl_s: value => value === null || (Number.isFinite(value) && value >= 0)
  }) && isPosition(entry.pos)),
  shades: value => Array.isArray(value) && value.every(entry => item(entry, {
    id: isId, pos: isPosition, state_ticks_left: isCount, state: enumValue(["spawning", "wander", "chase", "recoil", "stunned"])
  }) && isPosition(entry.pos)),
  drifters: value => Array.isArray(value) && value.every(entry => item(entry, {
    id: isId, pos: isPosition, state_ticks_left: isCount, stolen: isCount, state: enumValue(["idle", "chase", "flee", "removed"])
  }) && isPosition(entry.pos)),
  charms: value => Array.isArray(value) && value.every(entry => item(entry, {
    id: isId, pos: isPosition, available: isBoolean, respawn_ticks: isCount
  }) && isId(entry.id))
};
for (const [key, check] of Object.entries(scenarioFields)) {
  if (!optional(scenario, key, check)) fail(`Invalid scenario field: ${key}`);
}

let game;
try {
  game = createGame(seed, scenario, contract.tuning, night);
} catch (error) {
  fail(`Invalid scenario: ${error.message}`);
}
const lines = [game.snapshot(), ...game.events];
let frameIndex = 0;
const currentInput = { move: [0, 0], cam_yaw_deg: 0, jump: false, dash: false, interact: false, pulse: false, pause: false };
for (let frameTick = 0; frameTick < ticks && !game.finished; frameTick++) {
  while (frameIndex < frames.length && frames[frameIndex].tick <= frameTick) {
    Object.assign(currentInput, frames[frameIndex]);
    frameIndex++;
  }
  game.step(currentInput);
  lines.push(...game.events);
  if (game.tick % snapshotEvery === 0) lines.push(game.snapshot());
}
lines.push({ type: "end", ticks: game.tick, sim_tick: game.simTick, state: game.state, score: game.score });
try {
  fs.writeFileSync(args.out, lines.map(line => JSON.stringify(line)).join("\n") + "\n");
} catch (error) {
  fail(`Cannot write output: ${error.message}`, 1);
}
