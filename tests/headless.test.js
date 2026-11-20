import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cli = path.join(root, "src", "headless.js");

test("headless v1.1 emits required snapshots for each requested night", () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), "lantern-contract-"));
  try {
    for (const [night, expectedLanterns] of [[1, 5], [2, 6], [3, 7]]) {
      const output = path.join(temp, `night-${night}.jsonl`);
      const result = spawnSync(process.execPath, [cli, "--seed", "42", "--night", String(night), "--ticks", "0", "--out", output], { encoding: "utf8" });
      assert.equal(result.status, 0, result.stderr);
      const records = fs.readFileSync(output, "utf8").trim().split(/\r?\n/).map(line => JSON.parse(line));
      const snapshot = records.find(record => record.type === "snapshot");
      assert.equal(snapshot.night, night);
      assert.equal(snapshot.lanterns.length, expectedLanterns);
      assert.ok(Array.isArray(snapshot.motes));
      assert.ok(Array.isArray(snapshot.drifters));
      assert.ok(Array.isArray(snapshot.charms));
      assert.deepEqual(records.find(record => record.name === "night_start").data, { night });
    }
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
});

test("invalid headless input format exits with contract error code 2", () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), "lantern-invalid-"));
  try {
    const inputs = path.join(temp, "inputs.json");
    const output = path.join(temp, "out.jsonl");
    fs.writeFileSync(inputs, JSON.stringify({ frames: [{ tick: 2 }, { tick: 1 }] }));
    const result = spawnSync(process.execPath, [
      cli, "--seed", "1", "--night", "1", "--ticks", "10",
      "--inputs", inputs, "--out", output
    ], { encoding: "utf8" });
    assert.equal(result.status, 2);
    assert.match(result.stderr, /increase strictly/);
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
});
