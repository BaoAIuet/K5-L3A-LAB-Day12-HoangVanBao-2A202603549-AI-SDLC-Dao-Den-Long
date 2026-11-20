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

test("CLI scenarios cover Ticket-02 inputs, creatures, charms and warning cadence", () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), "lantern-ticket-02-"));
  try {
    const run = (night, ticks, scenario, frames = [], snapshotEvery = 1) => {
      const inputs = path.join(temp, "inputs.json");
      const setup = path.join(temp, "scenario.json");
      const output = path.join(temp, "out.jsonl");
      fs.writeFileSync(inputs, JSON.stringify({ frames }));
      fs.writeFileSync(setup, JSON.stringify({
        random_motes: false, random_shades: false, random_drifters: false, ...scenario
      }));
      const result = spawnSync(process.execPath, [
        cli, "--seed", "42", "--night", String(night), "--ticks", String(ticks), "--snapshot-every", String(snapshotEvery),
        "--scenario", setup, "--inputs", inputs, "--out", output
      ], { encoding: "utf8" });
      assert.equal(result.status, 0, result.stderr);
      return fs.readFileSync(output, "utf8").trim().split(/\r?\n/).map(JSON.parse);
    };
    const progression = run(2, 19, {
      player: { pos: [35, 0, 0], carried: 8 },
      drifters: [{ id: "D1", state: "chase", pos: [35, 0, 0] }]
    }, [
      { tick: 1, pause: true }, { tick: 2, pause: false }, { tick: 5, pause: true, pulse: true },
      { tick: 6, pause: false, dash: true }, { tick: 7, dash: false }, { tick: 18, dash: true }
    ]);
    for (const [name, tick] of [["charm_picked", 1], ["drifter_steal", 1], ["paused", 2],
      ["resumed", 6], ["drifter_drop", 6], ["dash", 7], ["dash", 19]]) {
      assert.ok(progression.some(event => event.name === name && event.tick === tick), name);
    }
    const at = (records, tick) => records.find(entry => entry.type === "snapshot" && entry.tick === tick);
    assert.equal(at(progression, 5).sim_tick, 1);
    assert.equal(at(progression, 7).player.dash_cd_s, 0);

    const wind = run(3, 2100, {}, [], 100);
    assert.equal(at(wind, 1700).wind.active, false);
    assert.equal(at(wind, 1800).wind.active, true);
    assert.equal(at(wind, 2100).wind.active, false);
    assert.ok(at(wind, 2100).drifters.length === 0 && at(wind, 2100).shades.length === 0);
    assert.ok(Math.hypot(at(wind, 2100).player.pos[0], at(wind, 2100).player.pos[2]) > 9.8);
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
});
