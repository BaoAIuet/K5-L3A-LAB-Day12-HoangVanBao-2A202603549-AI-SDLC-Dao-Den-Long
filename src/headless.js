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
if (!Number.isInteger(ticks) || ticks < 0 || ticks > 21600) fail("--ticks must be an integer between 0 and 21600");
if (!Number.isInteger(night) || ![1, 2, 3].includes(night)) fail("--night must be 1, 2, or 3");
if (!Number.isInteger(snapshotEvery) || snapshotEvery <= 0) fail("--snapshot-every must be a positive integer");

const contract = readJson(new URL("../game.contract.json", import.meta.url), "game.contract.json");
const scenario = args.scenario ? readJson(args.scenario, "scenario") : {};
if (!scenario || typeof scenario !== "object" || Array.isArray(scenario)) fail("Scenario must be a JSON object");
const inputDocument = args.inputs ? readJson(args.inputs, "inputs") : { frames: [] };
if (!inputDocument || typeof inputDocument !== "object" || Array.isArray(inputDocument)) fail("Inputs must be a JSON object");
const frames = inputDocument.frames ?? [];
if (!Array.isArray(frames)) fail("inputs.frames must be an array");
let lastTick = -1;
for (const frame of frames) {
  if (!frame || !Number.isInteger(frame.tick) || frame.tick < 0 || frame.tick <= lastTick) {
    fail("Input frame ticks must be non-negative integers and increase strictly");
  }
  lastTick = frame.tick;
  if (frame.move != null && (!Array.isArray(frame.move) || frame.move.length !== 2
    || frame.move.some(n => typeof n !== "number" || n < -1 || n > 1))) {
    fail("Input move must be [x,z] with each component in [-1,1]");
  }
  if (frame.cam_yaw_deg != null && typeof frame.cam_yaw_deg !== "number") fail("Input cam_yaw_deg must be a number");
  for (const key of ["jump", "dash", "interact", "pulse", "pause"]) {
    if (frame[key] != null && typeof frame[key] !== "boolean") fail(`Input ${key} must be a boolean`);
  }
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
