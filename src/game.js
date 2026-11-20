export const DEFAULT_TUNING = {
  player_speed: 5, carry_capacity: 5, lantern_cost: 1, lantern_count_night1: 5,
  pickup_radius: 1, interact_radius: 2, pulse_cost: 1, pulse_radius: 8,
  night1_duration_s: 300, flames: 5, invuln_s: 1, hit_drop_ratio: 0.5,
  pulse_stun_s: 3, pulse_push_m: 4, pulse_cooldown_s: 2, safe_radius: 3,
  shade_speed: 2.5, shade_hit_radius: 0.8, fall_enabled: false,
  score: { per_mote: 10, per_lantern: 100, per_stun: 25, per_second_left: 5, per_flame_left: 50 }
};

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const distanceXZ = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);
const round3 = n => Math.round(n * 1000) / 1000;
const posRound = p => p.map(round3);

function mulberry32(seed) {
  let value = seed >>> 0;
  return () => {
    value += 0x6D2B79F5;
    let t = value;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

export class Game {
  constructor(seed = 0, scenario = {}, tuning = {}) {
    this.tuning = structuredClone(DEFAULT_TUNING);
    Object.assign(this.tuning, tuning);
    if (tuning.score) this.tuning.score = { ...DEFAULT_TUNING.score, ...tuning.score };
    this.random = mulberry32(Number(seed) || 0);
    this.tick = 0;
    this.state = "playing";
    this.score = 0;
    this.night = 1;
    this.map = { pads: [] };
    this.drifters = [];
    this.charms = [];
    this.verticalSpeed = 0;
    this.nextDropId = 1;
    this.events = [];
    this.invulnerableTicks = 0;
    this.pulseCooldownTicks = 0;
    this.input = { move: [0, 0], cam_yaw_deg: 0, jump: false, interact: false, pulse: false };
    this.previousInput = { ...this.input };

    const player = scenario.player || {};
    this.player = {
      pos: [...(player.pos || [0, 0, 0])],
      vel: [0, 0, 0],
      facing: 90,
      carried: player.carried ?? 0,
      flames: player.flames ?? this.tuning.flames
    };
    this.timeLeft = scenario.time_left_s ?? this.tuning.night1_duration_s;
    this.initialTimeLeft = this.timeLeft;

    this.lanterns = [
      { id: "L1", pos: [0, 0, 25], deposited: 0, lit: false },
      { id: "L2", pos: [18, 0, 16], deposited: 0, lit: false },
      { id: "L3", pos: [-18, 0, 16], deposited: 0, lit: false },
      { id: "L4", pos: [20, 0, -12], deposited: 0, lit: false },
      { id: "L5", pos: [-20, 0, -12], deposited: 0, lit: false }
    ];
    if (Array.isArray(scenario.lanterns)) {
      for (const item of scenario.lanterns) {
        const lantern = this.lanterns.find(x => x.id === item.id);
        if (!lantern) continue;
        if (item.pos) lantern.pos = [...item.pos];
        if (item.deposited != null) lantern.deposited = item.deposited;
        lantern.lit = item.lit === true || lantern.deposited >= this.tuning.lantern_cost;
      }
    }

    this.motes = [];
    if (scenario.random_motes !== false) {
      for (let i = 0; i < 19; i++) {
        const angle = this.random() * Math.PI * 2;
        const radius = 5 + this.random() * 20;
        this.motes.push({ id: `M${i + 1}`, pos: [round3(Math.cos(angle) * radius), 0, round3(Math.sin(angle) * radius)] });
      }
    }
    if (Array.isArray(scenario.motes)) {
      this.motes = scenario.motes.map((m, i) => ({ id: m.id || `M${i + 1}`, pos: Array.isArray(m) ? [...m] : [...m.pos] }));
    }

    this.shades = [];
    if (scenario.random_shades !== false) {
      for (let i = 0; i < 3; i++) {
        const angle = this.random() * Math.PI * 2;
        this.shades.push({ id: `S${i + 1}`, pos: [round3(Math.cos(angle) * 24), 0, round3(Math.sin(angle) * 24)], state: "chase", stunTicks: 0 });
      }
    }
    if (Array.isArray(scenario.shades)) {
      this.shades = scenario.shades.map((s, i) => ({ id: s.id || `S${i + 1}`, pos: [...s.pos], state: "chase", stunTicks: 0 }));
    }
  }

  applyInput(input = {}) {
    for (const key of ["move", "cam_yaw_deg", "jump", "interact", "pulse"]) {
      if (Object.prototype.hasOwnProperty.call(input, key)) this.input[key] = input[key];
    }
  }

  step(input = {}) {
    if (this.state !== "playing") return;
    this.events = [];
    this.applyInput(input);
    this.tick++;

    if (this.invulnerableTicks > 0) this.invulnerableTicks--;
    if (this.pulseCooldownTicks > 0) this.pulseCooldownTicks--;

    let [mx, mz] = this.input.move || [0, 0];
    mx = clamp(mx, -1, 1);
    mz = clamp(mz, -1, 1);
    let length = Math.hypot(mx, mz);
    if (length > 1) { mx /= length; mz /= length; }
    const theta = (this.input.cam_yaw_deg || 0) * Math.PI / 180;
    const wx = mx * Math.cos(theta) + mz * Math.sin(theta);
    const wz = -mx * Math.sin(theta) + mz * Math.cos(theta);
    this.player.pos[0] += wx * this.tuning.player_speed / 60;
    this.player.pos[2] += wz * this.tuning.player_speed / 60;
    this.player.pos[0] = round3(this.player.pos[0]);
    this.player.pos[2] = round3(this.player.pos[2]);
    this.player.vel[0] = wx * this.tuning.player_speed;
    this.player.vel[2] = wz * this.tuning.player_speed;
    if (wx || wz) this.player.facing = Math.atan2(wz, wx) * 180 / Math.PI;
    if (this.input.jump && !this.previousInput.jump && this.player.pos[1] <= 0) this.verticalSpeed = 7;
    if (this.player.pos[1] > 0 || this.verticalSpeed > 0) {
      this.verticalSpeed -= 20 / 60;
      this.player.pos[1] = Math.max(0, this.player.pos[1] + this.verticalSpeed / 60);
      if (this.player.pos[1] === 0) this.verticalSpeed = 0;
    }
    this.player.vel[1] = this.verticalSpeed;

    for (let i = this.motes.length - 1; i >= 0; i--) {
      if (distanceXZ(this.player.pos, this.motes[i].pos) <= this.tuning.pickup_radius) {
        if (this.player.carried < this.tuning.carry_capacity) {
          this.motes.splice(i, 1);
          this.player.carried++;
          this.score += this.tuning.score.per_mote;
          this.events.push({ type: "event", tick: this.tick, name: "mote_picked", data: { carried: this.player.carried } });
        }
      }
    }

    const interactRise = this.input.interact === true && this.previousInput.interact !== true;
    if (interactRise) {
      for (const lantern of this.lanterns) {
        if (!lantern.lit && distanceXZ(this.player.pos, lantern.pos) <= this.tuning.interact_radius && this.player.carried > 0) {
          const amount = Math.min(this.tuning.lantern_cost - lantern.deposited, this.player.carried);
          if (amount > 0) {
            lantern.deposited += amount;
            this.player.carried -= amount;
            this.events.push({ type: "event", tick: this.tick, name: "deposit", data: { lantern_id: lantern.id, amount, deposited: lantern.deposited } });
            if (lantern.deposited >= this.tuning.lantern_cost) {
              lantern.lit = true;
              this.score += this.tuning.score.per_lantern;
              this.events.push({ type: "event", tick: this.tick, name: "lantern_lit", data: { lantern_id: lantern.id } });
            }
          }
          break;
        }
      }
    }

    const pulseRise = this.input.pulse === true && this.previousInput.pulse !== true;
    if (pulseRise && this.player.carried >= this.tuning.pulse_cost && this.pulseCooldownTicks === 0) {
      this.player.carried -= this.tuning.pulse_cost;
      this.pulseCooldownTicks = this.tuning.pulse_cooldown_s * 60;
      const stunned = [];
      for (const shade of this.shades) {
        if (distanceXZ(this.player.pos, shade.pos) <= this.tuning.pulse_radius) {
          shade.state = "stunned";
          shade.stunTicks = this.tuning.pulse_stun_s * 60;
          stunned.push(shade.id);
          this.score += this.tuning.score.per_stun;
          const dx = shade.pos[0] - this.player.pos[0];
          const dz = shade.pos[2] - this.player.pos[2];
          const d = Math.hypot(dx, dz);
          shade.pos[0] = round3(shade.pos[0] + (d ? dx / d : 1) * this.tuning.pulse_push_m);
          shade.pos[2] = round3(shade.pos[2] + (d ? dz / d : 0) * this.tuning.pulse_push_m);
        }
      }
      this.events.push({ type: "event", tick: this.tick, name: "pulse", data: { stunned_ids: stunned } });
    }

    for (const shade of this.shades) {
      if (shade.state === "stunned") {
        shade.stunTicks--;
        if (shade.stunTicks <= 0) shade.state = "chase";
        continue;
      }
      const dx = this.player.pos[0] - shade.pos[0];
      const dz = this.player.pos[2] - shade.pos[2];
      const d = Math.hypot(dx, dz);
      if (d > 0.001) {
        const move = Math.min(this.tuning.shade_speed / 60, d);
        shade.pos[0] = round3(shade.pos[0] + dx / d * move);
        shade.pos[2] = round3(shade.pos[2] + dz / d * move);
      }
      for (const lantern of this.lanterns) {
        if (!lantern.lit || distanceXZ(shade.pos, lantern.pos) >= this.tuning.safe_radius) continue;
        const x = shade.pos[0] - lantern.pos[0];
        const z = shade.pos[2] - lantern.pos[2];
        const length = Math.hypot(x, z);
        shade.pos[0] = lantern.pos[0] + (length ? x / length : 1) * this.tuning.safe_radius;
        shade.pos[2] = lantern.pos[2] + (length ? z / length : 0) * this.tuning.safe_radius;
      }
      const protectedPlayer = this.lanterns.some(lantern => lantern.lit && distanceXZ(this.player.pos, lantern.pos) <= this.tuning.safe_radius);
      if (!protectedPlayer && distanceXZ(this.player.pos, shade.pos) <= this.tuning.shade_hit_radius && this.invulnerableTicks === 0) {
        this.invulnerableTicks = this.tuning.invuln_s * 60;
        const dropped = Math.floor(this.player.carried * this.tuning.hit_drop_ratio);
        this.player.carried -= dropped;
        for (let i = 0; i < dropped; i++) {
          const angle = this.random() * 2 * Math.PI;
          this.motes.push({ id: "drop" + this.nextDropId++, kind: "dropped", pos: [
            round3(this.player.pos[0] + Math.cos(angle) * 1.5), 0,
            round3(this.player.pos[2] + Math.sin(angle) * 1.5)
          ] });
        }
        this.player.flames = Math.max(0, this.player.flames - 1);
        this.events.push({ type: "event", tick: this.tick, name: "player_hit", data: { by: "shade", flames: this.player.flames, dropped } });
      }
    }

    this.timeLeft = Math.max(0, (scenarioTime(this) - this.tick / 60));
    this.previousInput = {
      move: [...this.input.move],
      cam_yaw_deg: this.input.cam_yaw_deg,
      jump: this.input.jump,
      interact: this.input.interact,
      pulse: this.input.pulse
    };

    if (this.lanterns.every(l => l.lit)) {
      this.finish("won", "all_lit");
    } else if (this.player.flames <= 0) {
      this.finish("lost", "no_flames");
    } else if (this.timeLeft <= 0) {
      this.finish("lost", "dawn");
    }
  }

  finish(result, reason) {
    this.state = result;
    if (result === "won") this.score += Math.ceil(this.timeLeft) * this.tuning.score.per_second_left;
    this.score += this.player.flames * this.tuning.score.per_flame_left;
    this.events.push({ type: "event", tick: this.tick, name: "game_over", data: { result, reason } });
  }

  get environmentLight() {
    return 0.15 + 0.55 * this.lanterns.filter(l => l.lit).length / this.lanterns.length;
  }

  get simTick() { return this.tick; }
  get invulnTicks() { return this.invulnerableTicks; }

  snapshot() {
    return {
      type: "snapshot", tick: this.tick, sim_tick: this.tick,
      state: this.state, time_left_s: round3(this.timeLeft),
      score: this.score,
      player: { pos: posRound(this.player.pos), flames: this.player.flames, carried: this.player.carried },
      lanterns: this.lanterns.map(l => ({ id: l.id, pos: posRound(l.pos), lit: l.lit, deposited: l.deposited })),
      shades: this.shades.map(s => ({ id: s.id, pos: posRound(s.pos), state: s.state })),
      motes: this.motes.map(m => ({ id: m.id, pos: posRound(m.pos) })),
      motes_active: this.motes.length
    };
  }
}

function scenarioTime(game) {
  return game.initialTimeLeft;
}

export function createGame(seed, scenario, tuning) {
  const initialScenario = scenario || {};
  const game = new Game(seed, initialScenario, tuning);
  game.initialTimeLeft = initialScenario.time_left_s ?? tuning?.night1_duration_s ?? DEFAULT_TUNING.night1_duration_s;
  game.timeLeft = game.initialTimeLeft;
  return game;
}
