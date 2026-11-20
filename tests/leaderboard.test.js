import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { leaderboard, saveScore } from "../src/leaderboard.js";

test("leaderboard retains ten scores and exports disk data in rank order", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "dao-scores-"));
  try {
    const file = path.join(dir, "leaderboard.json");
    const out = path.join(dir, "export.json");
    assert.deepEqual(leaderboard(file), { entries: [] });
    const add = (name, score) => saveScore({ name, score, nights_won: 1, seed: 42 }, file);
    assert.throws(() => add("x !", 3), RangeError);
    add("first", 100);
    add("later", 100);
    for (let i = 0; i < 11; i++) add(`Player${i}`, i);
    const result = spawnSync(process.execPath, ["src/server.js", "--export-leaderboard", out], {
      env: { ...process.env, LEADERBOARD_FILE: file }, encoding: "utf8"
    });
    assert.equal(result.status, 0, result.stderr);
    const { entries } = JSON.parse(fs.readFileSync(out, "utf8"));
    assert.equal(entries.length, 10);
    assert.deepEqual(entries.slice(0, 3).map(entry => entry.name), ["first", "later", "Player10"]);
    assert.equal(entries[0].seed, 42);
    assert.match(entries[0].achieved_at, /Z$/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
