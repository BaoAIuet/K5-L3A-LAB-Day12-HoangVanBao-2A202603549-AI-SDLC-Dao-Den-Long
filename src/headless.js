import fs from "node:fs";
import { createGame } from "./game.js";

function usageError(message) {
  console.error(message);
  process.exit(2);
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    if (!argv[i].startsWith("--")) continue;
    const key = argv[i].slice(2);
    const value = argv[i + 1];
    if (value != null && !value.startsWith("--")) { args[key] = value; i++; }
    else args[key] = true;
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));
if (!args.seed || !args.out || !args.ticks) usageError("Required: --seed <int> --ticks <int> --out <file>");

let tuning = {};
let scenario = {};
try {
  tuning = JSON.parse(fs.readFileSync(new URL("../game.contract.json", import.meta.url), "utf8")).tuning;
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
try {
  if (args.scenario) scenario = JSON.parse(fs.readFileSync(args.scenario, "utf8"));
  if (args.inputs) {
    const parsed = JSON.parse(fs.readFileSync(args.inputs, "utf8"));
    globalThis.inputsData = parsed.frames || [];
  }
} catch (error) {
  usageError(`Invalid input or scenario: ${error.message}`);
}

const seed = Number(args.seed);
const ticks = Number(args.ticks);
if (!Number.isInteger(seed) || !Number.isInteger(ticks) || ticks < 0) usageError("Seed and ticks must be integers");

const snapshotEvery = args["snapshot-every"] == null ? 10 : Number(args["snapshot-every"]);
if (!Number.isInteger(snapshotEvery) || snapshotEvery <= 0) usageError("snapshot-every must be a positive integer");

const game = createGame(seed, scenario, tuning);
const lines = [game.snapshot()];
const frames = globalThis.inputsData || [];
let frameIndex = 0;
let currentInput = { move: [0, 0], cam_yaw_deg: 0, jump: false, interact: false, pulse: false };

for (let k = 0; k < ticks && game.state === "playing"; k++) {
  while (frameIndex < frames.length && frames[frameIndex].tick <= k) {
    const frame = frames[frameIndex++];
    if (!Number.isInteger(frame.tick)) usageError("Input frame tick must be an integer");
    if (frameIndex > 1 && frame.tick <= frames[frameIndex - 2].tick) usageError("Input frame ticks must increase strictly");
    for (const key of ["move", "cam_yaw_deg", "jump", "interact", "pulse"]) {
      if (Object.prototype.hasOwnProperty.call(frame, key)) currentInput[key] = frame[key];
    }
  }
  game.step(currentInput);
  for (const event of game.events) lines.push(event);
  if ((k + 1) % snapshotEvery === 0) lines.push(game.snapshot());
}

lines.push({ type: "end", ticks: game.tick, state: game.state, score: game.score });
try {
  fs.writeFileSync(args.out, lines.map(x => JSON.stringify(x)).join("\n") + "\n");
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
