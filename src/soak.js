import fs from "node:fs";
import { performance } from "node:perf_hooks";
import { createGame } from "./game.js";

function randomSource(seed) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

const args = Object.fromEntries(process.argv.slice(2).reduce((pairs, value, index, values) => {
  if (index % 2 === 0) pairs.push([value, values[index + 1]]);
  return pairs;
}, []));
const seed = Number(args["--seed"]);
const nights = Number(args["--nights"]);
if (!Number.isSafeInteger(seed) || !Number.isSafeInteger(nights) || nights < 1 || !args["--out"]) {
  console.error("Usage: npm run soak -- --seed 7 --nights 10 --out soak.json");
  process.exit(2);
}

const started = performance.now();
const memory = () => process.memoryUsage.rss() / 1048576;
const results = [];
let crashes = 0;
let startMemory;
for (let i = 0; i < nights; i++) {
  try {
    const nightSeed = seed + i;
    const game = createGame(nightSeed, {}, {}, i % 3 + 1);
    if (i === 0) {
      globalThis.gc?.();
      startMemory = memory();
    }
    const random = randomSource(nightSeed);
    let move = [0, 0];
    const ticks = Math.ceil(game.timeLeft * 60);
    for (let tick = 0; tick < ticks && !game.finished; tick++) {
      if (tick % 30 === 0) {
        const angle = random() * Math.PI * 2;
        move = [Math.cos(angle), Math.sin(angle)];
      }
      game.step({
        move, jump: random() < 0.05, dash: random() < 0.03,
        pulse: random() < 0.02, interact: random() < 0.10
      });
    }
    results.push(game.state);
  } catch (error) {
    crashes++;
    results.push("crashed");
    console.error(error.message);
  }
}
globalThis.gc?.();
const report = {
  nights, crashes, results, mem_start_mb: startMemory, mem_end_mb: memory(),
  duration_s: (performance.now() - started) / 1000
};
fs.writeFileSync(args["--out"], JSON.stringify(report, null, 2) + "\n");
if (crashes) process.exitCode = 1;
