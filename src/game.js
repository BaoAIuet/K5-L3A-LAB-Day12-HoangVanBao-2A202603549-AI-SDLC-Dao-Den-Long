export const DEFAULT_TUNING = {
  player_speed: 6, carry_capacity: 10, lantern_cost: 10,
  lantern_count_night1: 5, pickup_radius: 1, interact_radius: 2,
  pulse_cost: 3, pulse_radius: 5, night1_duration_s: 240,
  night2_duration_s: 270, night3_duration_s: 300, flames: 3,
  invuln_s: 1.5, hit_drop_ratio: 0.5, pulse_stun_s: 2,
  pulse_push_m: 4, pulse_cooldown_s: 3, safe_radius: 6,
  shade_speed: 4, shade_hit_radius: 1, dash_speed: 14,
  dash_duration_s: 0.2, dash_cooldown_s: 1.5, fall_enabled: true,
  fuel_max: 100, fuel_decay_per_s: 1, fuel_per_mote: 10, relight_cost: 5,
  win_ratio: 0.6, drain_per_s: 5, low_fuel_threshold: 30, capacity_max: 20,
  score: { per_mote: 5, per_lantern: 100, per_relight: 40, per_stun: 5, per_drain_stun: 15, per_dawn_lantern: 50, per_flame_left: 50 }
};

const TICK_RATE = 60;
const round3 = n => Math.round(n * 1000) / 1000;
const vectorRound = p => p.map(round3);
const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
const distanceXZ = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);
const distance3 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const directionXZ = (from, to) => {
  const x = to[0] - from[0];
  const z = to[2] - from[2];
  const length = Math.hypot(x, z);
  return length ? [x / length, z / length] : [1, 0];
};
const islandPad = (pos, target) => {
  const [x, z] = directionXZ(pos, target);
  return { pos, radius: 1, velocity: [24 * x, 14, 24 * z], target };
};
const compareIds = (a, b) => {
  const left = /^([A-Za-z]+)(\d+)$/.exec(a.id);
  const right = /^([A-Za-z]+)(\d+)$/.exec(b.id);
  return left && right && left[1] === right[1]
    ? Number(left[2]) - Number(right[2])
    : a.id.localeCompare(b.id);
};
const anglePoint = (radius, degrees, y = 0, cx = 0, cz = 0) => {
  const radians = degrees * Math.PI / 180;
  return [round3(cx + Math.cos(radians) * radius), y, round3(cz + Math.sin(radians) * radius)];
};

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

function nightData(night) {
  if (night === 2) {
    const lanterns = [[0, 0, 20], [17, 0, -10], [-17, 0, -10], [70, 0, 20], [87, 0, -10], [53, 0, -10]];
    const motePoints = [];
    for (const [cx, cz] of [[0, 0], [70, 0]]) {
      for (let d = 0; d < 360; d += 90) motePoints.push(anglePoint(10, d, 0, cx, cz));
      for (let d = 0; d < 360; d += 45) motePoints.push(anglePoint(22, d, 0, cx, cz));
    }
    const shadePoints = [];
    for (const [cx, cz] of [[0, 0], [70, 0]]) {
      for (let d = 22.5; d < 360; d += 45) shadePoints.push(anglePoint(26, d, 0, cx, cz));
    }
    return {
      lanterns, motePoints, shadePoints, shadeLimit: 8,
      shadeFirst: 420, shadeInterval: 420, islandRadius: 28,
      charms: [{ id: "C1", pos: [35, 0, 0] }],
      pads: [islandPad([20, 0, 18], [70, 0, 0]), islandPad([50, 0, -18], [0, 0, 0])],
      bridge: true, wind: false
    };
  }
  if (night === 3) {
    const lanterns = [[0, 6, 6], [18, 3, 10], [-18, 3, 10], [35, 0, -10], [-35, 0, -10], [20, 0, -35], [-20, 0, -35]];
    const motePoints = [];
    for (let d = 0; d < 360; d += 20) motePoints.push(anglePoint(34, d));
    for (let d = 20; d < 180; d += 20) motePoints.push(anglePoint(18, d, 3));
    for (const d of [45, 135, 225, 315]) motePoints.push(anglePoint(5, d, 6));
    const shadePoints = [];
    for (let d = 0; d < 360; d += 22.5) shadePoints.push(anglePoint(43, d));
    return {
      lanterns, motePoints, shadePoints, shadeLimit: 10,
      shadeFirst: 360, shadeInterval: 360, islandRadius: 45,
      charms: [{ id: "C1", pos: [30, 0, 25] }, { id: "C2", pos: [-30, 0, 25] }],
      pads: [{ pos: [0, 3, 13], radius: 1, velocity: [0, 12, -8], target: [0, 6, 5] }],
      bridge: false, wind: true
    };
  }
  const lanterns = [[0, 0, 25], [23.8, 0, 7.7], [14.7, 0, -20.2], [-14.7, 0, -20.2], [-23.8, 0, 7.7]];
  const motePoints = [];
  for (let d = 0; d < 360; d += 45) motePoints.push(anglePoint(12, d));
  for (let d = 0; d < 360; d += 22.5) motePoints.push(anglePoint(33, d));
  const shadePoints = [];
  for (let d = 15; d < 360; d += 30) shadePoints.push(anglePoint(37, d));
  return {
    lanterns, motePoints, shadePoints, shadeLimit: 6,
    shadeFirst: 300, shadeInterval: 480, islandRadius: 40, charms: [], pads: [],
    bridge: false, wind: false
  };
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export class Game {
  constructor(seed = 0, scenario = {}, tuning = {}, night = 1) {
    this.night = clamp(Number(night) || 1, 1, 3);
    this.map = nightData(this.night);
    this.tuning = { ...DEFAULT_TUNING, ...tuning, score: { ...DEFAULT_TUNING.score, ...(tuning.score || {}) } };
    this.random = mulberry32(Number(seed) || 0);
    this.tick = 0;
    this.simTick = 0;
    this.state = "playing";
    this.score = 0;
    this.events = [{ type: "event", tick: 0, name: "night_start", data: { night: this.night } }];
    this.nextShadeId = 1;
    this.nextDrifterId = 1;
    this.invulnTicks = 0;
    this.dashCooldownTicks = 0;
    this.pulseCooldownTicks = 0;
    this.charmTicks = 0;
    this.respawnTicks = 0;
    this.randomMotes = scenario.random_motes !== false;
    this.randomShades = scenario.random_shades !== false;
    this.randomDrifters = scenario.random_drifters !== false;
    this.windDirection = round3(this.random() * 360);
    this.lastWindDirectionTick = -1;
    this.input = { move: [0, 0], cam_yaw_deg: 0, jump: false, dash: false, interact: false, pulse: false, pause: false };
    this.previousInput = { ...this.input };

    const playerData = scenario.player || {};
    this.player = {
      pos: [...(playerData.pos || [0, 0, 0])],
      vel: [...(playerData.vel || [0, 0, 0])],
      carried: playerData.carried ?? 0,
      flames: playerData.flames ?? this.tuning.flames,
      grounded: playerData.grounded ?? true,
      facing: playerData.facing ?? 90,
      launched: false,
      launchVelocity: null
    };
    this.invulnTicks = playerData.invuln_ticks ?? 0;
    this.dashCooldownTicks = playerData.dash_cd_ticks ?? 0;
    this.pulseCooldownTicks = playerData.pulse_cd_ticks ?? 0;
    this.charmTicks = playerData.charm_ticks ?? 0;
    this.successfulLights = playerData.successful_lights ?? 0;
    this.timeLeft = scenario.time_left_s ?? this.tuning[`night${this.night}_duration_s`];
    this.initialTimeLeft = this.timeLeft;

    this.lanterns = this.map.lanterns.map((pos, i) => ({
      id: `L${i + 1}`, pos: [...pos], deposited: 0, lit: false, fuelTicks: 0,
      everLit: false, relitCount: 0, safePushTicks: 0
    }));
    for (const item of scenario.lanterns || []) {
      const lantern = this.lanterns.find(x => x.id === item.id);
      if (!lantern) continue;
      if (item.pos) lantern.pos = [...item.pos];
      if (item.deposited != null) lantern.deposited = item.deposited;
      lantern.lit = item.lit ?? lantern.deposited >= this.tuning.lantern_cost;
      lantern.everLit = lantern.lit || item.ever_lit === true;
      if (lantern.lit) {
        lantern.fuelTicks = Math.round(clamp(item.fuel ?? this.tuning.fuel_max, 0, this.tuning.fuel_max) * TICK_RATE);
        if (item.deposited == null) lantern.deposited = this.tuning.lantern_cost;
      }
    }

    const positions = [...this.map.motePoints];
    for (let i = positions.length - 1; i > 0; i--) {
      const j = Math.floor(this.random() * (i + 1));
      [positions[i], positions[j]] = [positions[j], positions[i]];
    }
    this.motes = [];
    if (this.randomMotes) {
      for (let i = 0; i < Math.min(20, positions.length); i++) {
        this.motes.push({ id: `M${i + 1}`, pos: [...positions[i]], kind: "random", ttlTicks: null, activeFrom: 0 });
      }
    }
    if (Array.isArray(scenario.motes)) {
      this.motes = scenario.motes.map((m, i) => ({
        id: m.id || `M${i + 1}`,
        pos: [...(Array.isArray(m) ? m : m.pos)],
        kind: Array.isArray(m) ? "random" : (m.kind || "random"),
        ttlTicks: m.ttl_ticks ?? (m.ttl_s == null ? null : Math.round(m.ttl_s * TICK_RATE)),
        activeFrom: 0
      }));
    }

    this.shades = [];
    if (Array.isArray(scenario.shades)) {
      this.shades = scenario.shades.map((s, i) => ({
        id: s.id || `S${i + 1}`, pos: [...s.pos], state: s.state || "wander",
        targetLanternId: s.target_lantern_id, drainTicks: 0,
        stateTicksLeft: s.state_ticks_left ?? 0, stolen: s.stolen ?? 0,
        hitCooldownTicks: 0, safePushTicks: 0, stunTicks: s.state === "stunned" ? (s.state_ticks_left ?? 0) : 0,
        recoilTicks: s.state === "recoil" ? (s.state_ticks_left ?? 0) : 0,
        pushTicks: 0, pushDirection: [0, 0], recoilDirection: directionXZ(this.player.pos, s.pos)
      }));
    }

    this.drifters = [];
    if (Array.isArray(scenario.drifters)) {
      this.drifters = scenario.drifters.map((d, i) => ({
        id: d.id || `D${i + 1}`, pos: [...d.pos], state: d.state || "idle",
        stolen: d.stolen ?? 0, stateTicksLeft: d.state_ticks_left ?? (d.state === "flee" ? 240 : 0)
      }));
    }

    this.charms = this.map.charms.map(c => ({ id: c.id, pos: [...c.pos], available: true, respawnTicks: 0 }));
    if (Array.isArray(scenario.charms)) {
      this.charms = scenario.charms.map(c => ({
        id: c.id, pos: [...(c.pos || [0, 0, 0])],
        available: c.available ?? true,
        respawnTicks: c.respawn_ticks ?? 0
      }));
    }
    this.pads = this.map.pads;
    this.windEnabled = scenario.wind_enabled ?? this.map.wind;
    this.paused = false;
    this.dashTicks = 0;
    this.dashDirection = [0, 0];
    this.finished = false;
  }

  spawnShade(position) {
    if (this.shades && this.shades.length >= this.map.shadeLimit) return null;
    const candidates = this.map.shadePoints;
    let pos = position;
    if (!pos) {
      const start = Math.floor(this.random() * candidates.length);
      for (let offset = 0; offset < candidates.length; offset++) {
        const candidate = candidates[(start + offset) % candidates.length];
        if (distanceXZ(candidate, this.player.pos) >= 15
          && !this.shades.some(shade => distanceXZ(shade.pos, candidate) < 1)) {
          pos = [...candidate];
          break;
        }
      }
      if (!pos) return null;
    }
    while (this.shades.some(shade => shade.id === `S${this.nextShadeId}`)) this.nextShadeId++;
    const shade = {
      id: `S${this.nextShadeId++}`, pos: [...pos], state: "spawning",
      stateTicksLeft: 30, stolen: 0, hitCooldownTicks: 0, safePushTicks: 0,
      stunTicks: 0, recoilTicks: 0, pushTicks: 0, pushDirection: [0, 0]
    };
    this.shades.push(shade);
    this.events.push({ type: "event", tick: this.tick, name: "shade_spawned", data: { id: shade.id } });
    return shade;
  }

  spawnDrifter(position) {
    if (this.drifters && this.drifters.filter(d => d.state !== "removed").length >= 2) return null;
    const angle = this.random() * 360;
    const pos = position || anglePoint(30, angle, 1, this.night === 2 && this.random() < 0.5 ? 70 : 0, 0);
    while (this.drifters.some(drifter => drifter.id === `D${this.nextDrifterId}`)) this.nextDrifterId++;
    const drifter = { id: `D${this.nextDrifterId++}`, pos: [...pos], state: "idle", stolen: 0, stateTicksLeft: 0 };
    if (!this.drifters) this.drifters = [];
    this.drifters.push(drifter);
    return drifter;
  }

  applyInput(input = {}) {
    for (const key of ["move", "cam_yaw_deg", "jump", "dash", "interact", "pulse", "pause"]) {
      if (Object.prototype.hasOwnProperty.call(input, key)) this.input[key] = input[key];
    }
  }

  emit(name, data = {}) {
    this.events.push({ type: "event", tick: this.tick, name, data });
  }

  get windActive() {
    return this.windEnabled && this.simTick >= 1800 && this.simTick % 1800 < 300;
  }

  get windWarning() {
    return this.windEnabled && this.simTick % 1800 >= 1680;
  }

  get environmentLight() {
    return round3(0.15 + 0.55 * this.lanterns.filter(l => l.lit).length / this.lanterns.length);
  }

  get capacity() {
    return Math.min(this.tuning.capacity_max, this.tuning.carry_capacity + 2 * this.successfulLights);
  }

  get requiredLights() {
    return Math.ceil(this.tuning.win_ratio * this.lanterns.length);
  }

  isSafeLantern(lantern) {
    return lantern.lit && lantern.fuelTicks >= this.tuning.low_fuel_threshold * TICK_RATE;
  }

  lanternFuel(lantern) {
    return Math.round(lantern.fuelTicks / 6) / 10;
  }

  step(input = {}) {
    if (this.finished) return;
    this.events = [];
    this.applyInput(input);
    this.tick++;

    const pauseRise = this.input.pause === true && this.previousInput.pause !== true;
    if (pauseRise) {
      this.paused = !this.paused;
      this.state = this.paused ? "paused" : "playing";
      this.emit(this.paused ? "paused" : "resumed");
      if (this.paused) {
        this.previousInput = { ...this.input, move: [...this.input.move] };
        return;
      }
    }
    if (this.paused) {
      this.previousInput = { ...this.input, move: [...this.input.move] };
      return;
    }

    this.simTick++;
    this.reduceTimers();
    if (this.windActive && this.simTick % 1800 === 0
      && this.lastWindDirectionTick !== this.simTick) {
      this.windDirection = round3(this.random() * 360);
      this.lastWindDirectionTick = this.simTick;
    }
    if (this.respawnTicks > 0) {
      this.respawnTicks--;
      if (this.respawnTicks === 0) {
        this.player.pos = [0, 0, 0];
        this.player.vel = [0, 0, 0];
        this.player.grounded = true;
        this.invulnTicks = 90;
      }
    } else {
      this.movePlayer();
      if (!this.checkFall()) {
        this.collectItems();
        this.interactLantern();
        this.updateSafeZones();
        this.activatePulse();
        this.updateShades();
        this.updateDrifters();
        this.checkHits();
      }
    }
    if (!this.finished) this.spawnScheduled();

    this.timeLeft = Math.max(0, this.initialTimeLeft - this.simTick / TICK_RATE);
    if (this.player.flames <= 0) this.finish("lost", "no_flames");
    else if (this.timeLeft <= 0) {
      const survived = this.lanterns.filter(l => l.lit).length >= this.requiredLights;
      this.finish(survived ? "won" : "lost", survived ? "dawn_survived" : "dawn");
    }
    this.previousInput = { ...this.input, move: [...this.input.move] };
  }

  reduceTimers() {
    this.updateFuel();
    for (const key of ["invulnTicks", "dashCooldownTicks", "pulseCooldownTicks", "charmTicks"]) {
      if (this[key] > 0) this[key]--;
    }
    for (const shade of this.shades) if (shade.safePushTicks > 0) shade.safePushTicks--;
    for (const mote of this.motes) if (mote.ttlTicks != null && this.simTick > mote.activeFrom) mote.ttlTicks--;
    this.motes = this.motes.filter(m => m.ttlTicks == null || m.ttlTicks > 0);
    for (const charm of this.charms) {
      if (!charm.available && charm.respawnTicks > 0) {
        charm.respawnTicks--;
        if (charm.respawnTicks === 0) charm.available = true;
      }
    }
  }

  updateFuel() {
    for (const lantern of this.lanterns) {
      if (!lantern.lit) continue;
      const draining = this.isSafeLantern(lantern) ? [] : this.shades.filter(shade => shade.state === "drain"
        && shade.targetLanternId === lantern.id && distanceXZ(shade.pos, lantern.pos) <= 2);
      lantern.fuelTicks = Math.max(0, lantern.fuelTicks - this.tuning.fuel_decay_per_s
        - draining.length * this.tuning.drain_per_s);
      for (const shade of draining) {
        shade.drainTicks = (shade.drainTicks ?? 0) + 1;
        if (shade.drainTicks % TICK_RATE === 0) {
          this.emit("fuel_drain", { lantern_id: lantern.id, shade_id: shade.id, fuel: this.lanternFuel(lantern) });
        }
      }
      if (lantern.fuelTicks === 0) {
        lantern.lit = false;
        lantern.deposited = 0;
        lantern.safePushTicks = 0;
        this.emit("lantern_out", { lantern_id: lantern.id });
      }
    }
  }

  movePlayer() {
    const wasGrounded = this.player.grounded;
    const oldX = this.player.pos[0];
    const oldZ = this.player.pos[2];
    let [mx, mz] = this.input.move || [0, 0];
    mx = clamp(mx, -1, 1);
    mz = clamp(mz, -1, 1);
    const length = Math.hypot(mx, mz);
    if (length > 1) { mx /= length; mz /= length; }
    const yaw = (this.input.cam_yaw_deg || 0) * Math.PI / 180;
    const wx = mx * Math.cos(yaw) + mz * Math.sin(yaw);
    const wz = -mx * Math.sin(yaw) + mz * Math.cos(yaw);
    const moveLength = Math.hypot(wx, wz);
    const moving = moveLength > 0.001;
    if (moving) {
      const facing = Math.atan2(wz, wx) * 180 / Math.PI;
      this.player.facing = (facing + 360) % 360;
    }
    if (this.input.jump && !this.previousInput.jump && this.player.grounded && this.respawnTicks === 0) {
      this.player.vel[1] = 7;
      this.player.grounded = false;
      this.emit("jump");
    }
    if (this.input.dash && !this.previousInput.dash && this.dashTicks === 0
      && (this.dashCooldownTicks === 0 || this.charmTicks > 0)) {
      if (moving) this.dashDirection = [wx / moveLength, wz / moveLength];
      else {
        const facingRadians = this.player.facing * Math.PI / 180;
        this.dashDirection = [Math.cos(facingRadians), Math.sin(facingRadians)];
      }
      this.dashTicks = 12;
      if (this.charmTicks === 0) this.dashCooldownTicks = 90;
      this.emit("dash");
    }

    const dashing = this.dashTicks > 0;
    if (dashing) {
      this.player.vel[0] = this.dashDirection[0] * this.tuning.dash_speed;
      this.player.vel[2] = this.dashDirection[1] * this.tuning.dash_speed;
      this.dashTicks--;
    } else if (this.player.launched && this.player.launchVelocity) {
      this.player.vel[0] = this.player.launchVelocity[0];
      this.player.vel[2] = this.player.launchVelocity[2];
    } else {
      const targetSpeed = this.charmTicks > 0 ? 7.2 : this.tuning.player_speed;
      const targetX = wx * targetSpeed;
      const targetZ = wz * targetSpeed;
      const acceleration = 100 / TICK_RATE;
      this.player.vel[0] += clamp(targetX - this.player.vel[0], -acceleration, acceleration);
      this.player.vel[2] += clamp(targetZ - this.player.vel[2], -acceleration, acceleration);
    }

    const pad = this.pads.find(p => distanceXZ(this.player.pos, p.pos) <= p.radius
      && Math.abs(this.player.pos[1] - p.pos[1]) <= 1.5 && wasGrounded);
    if (pad) {
      this.player.vel = [...pad.velocity];
      this.player.launchVelocity = [...pad.velocity];
      this.player.launched = true;
      this.player.grounded = false;
    }

    const windRadians = this.windDirection * Math.PI / 180;
    const windSpeed = this.windActive ? 2 : 0;
    this.player.pos[0] += (this.player.vel[0] + Math.cos(windRadians) * windSpeed) / TICK_RATE;
    this.player.pos[2] += (this.player.vel[2] + Math.sin(windRadians) * windSpeed) / TICK_RATE;
    if (this.night === 3 && this.player.pos[1] >= 6 && this.player.pos[1] < 14
      && Math.hypot(this.player.pos[0], this.player.pos[2]) <= 2) {
      this.player.pos[0] = oldX;
      this.player.pos[2] = oldZ;
    }
    const horizontalFloor = this.floorAt(this.player.pos[0], this.player.pos[2], this.player.pos[1] + 0.24);
    if (this.player.grounded && horizontalFloor != null && horizontalFloor > this.player.pos[1]) {
      this.player.pos[1] = horizontalFloor;
    } else if (this.player.grounded && horizontalFloor !== this.player.pos[1]) {
      this.player.grounded = false;
    }
    if ((!dashing || pad) && (!this.player.grounded || this.player.vel[1] !== 0)) {
      const previousY = this.player.pos[1];
      this.player.vel[1] -= 20 / TICK_RATE;
      this.player.pos[1] += this.player.vel[1] / TICK_RATE;
      const floor = this.floorAt(this.player.pos[0], this.player.pos[2], previousY);
      if (floor != null && previousY >= floor && this.player.pos[1] <= floor && this.player.vel[1] <= 0) {
        this.player.pos[1] = floor;
        this.player.vel[1] = 0;
        this.player.grounded = true;
        this.player.launched = false;
        this.player.launchVelocity = null;
      } else {
        this.player.grounded = false;
      }
    }
    this.player.pos = vectorRound(this.player.pos);
    this.player.vel = vectorRound(this.player.vel);
  }

  floorAt(x, z, maxY = Infinity) {
    const radius = Math.hypot(x, z);
    if (this.night === 3) {
      for (const angle of [Math.PI / 6, Math.PI * 5 / 6]) {
        const along = x * Math.cos(angle) + z * Math.sin(angle);
        const across = -x * Math.sin(angle) + z * Math.cos(angle);
        const height = round3((30 - along) * 0.5);
        if (along >= 24 - 1e-6 && along <= 30 + 1e-6 && Math.abs(across) <= 1.5 && height <= maxY) return height;
      }
      if (radius <= 8 && 6 <= maxY) return 6;
      if (radius >= 12 && radius <= 24 && z > 0 && 3 <= maxY) return 3;
    }
    if (this.night === 2) {
      if ((radius <= 28 || Math.hypot(x - 70, z) <= 28 || (x >= 26 && x <= 44 && Math.abs(z) <= 2)) && 0 <= maxY) return 0;
      return null;
    }
    return radius <= this.map.islandRadius && 0 <= maxY ? 0 : null;
  }

  checkFall() {
    if (!this.tuning.fall_enabled || this.player.pos[1] >= -10) return false;
    this.player.flames = Math.max(0, this.player.flames - 1);
    const lost = this.player.carried;
    this.player.carried = 0;
    this.emit("player_hit", { by: "fall", flames: this.player.flames, dropped: 0, lost });
    if (this.player.flames <= 0) {
      this.finish("lost", "no_flames");
      return true;
    }
    this.respawnTicks = 60;
    this.invulnTicks = 0;
    this.dashTicks = 0;
    this.player.launched = false;
    this.player.launchVelocity = null;
    this.player.vel = [0, 0, 0];
    return true;
  }

  collectItems() {
    for (let i = this.motes.length - 1; i >= 0; i--) {
      const mote = this.motes[i];
      if (mote.activeFrom >= this.simTick || this.player.carried >= this.capacity) continue;
      if (distanceXZ(this.player.pos, mote.pos) <= this.tuning.pickup_radius
        && Math.abs(this.player.pos[1] - mote.pos[1]) <= 1.5) {
        this.motes.splice(i, 1);
        this.player.carried++;
        this.emit("mote_picked", { carried: this.player.carried });
      }
    }
    for (const charm of this.charms) {
      if (charm.available && distanceXZ(this.player.pos, charm.pos) <= 1
        && Math.abs(this.player.pos[1] - charm.pos[1]) <= 1.5) {
        charm.available = false;
        charm.respawnTicks = 2700;
        this.charmTicks = 600;
        this.emit("charm_picked", { charm_id: charm.id, charm_ticks: this.charmTicks });
      }
    }
  }

  nearestLantern(position, eligible) {
    let nearest;
    let best = Infinity;
    for (const lantern of this.lanterns) {
      if (!eligible(lantern)) continue;
      const dx = position[0] - lantern.pos[0];
      const dz = position[2] - lantern.pos[2];
      const squared = dx * dx + dz * dz;
      if (squared < best || (squared === best && compareIds(lantern, nearest) < 0)) {
        nearest = lantern;
        best = squared;
      }
    }
    return nearest;
  }

  lanternCost(lantern) {
    return lantern.everLit ? this.tuning.relight_cost : this.tuning.lantern_cost;
  }

  interactionLantern() {
    const max = this.tuning.fuel_max * TICK_RATE;
    return this.nearestLantern(this.player.pos, lamp => (!lamp.lit || lamp.fuelTicks < max)
      && distanceXZ(this.player.pos, lamp.pos) <= this.tuning.interact_radius);
  }

  interactLantern() {
    if (!(this.input.interact && !this.previousInput.interact) || this.player.carried <= 0) return;
    const lantern = this.interactionLantern();
    if (!lantern) return;
    if (lantern.lit) {
      const max = this.tuning.fuel_max * TICK_RATE;
      const fuelPerMote = this.tuning.fuel_per_mote * TICK_RATE;
      const amount = Math.min(this.player.carried, Math.ceil((max - lantern.fuelTicks) / fuelPerMote));
      const wasSafe = this.isSafeLantern(lantern);
      lantern.fuelTicks = Math.min(max, lantern.fuelTicks + amount * fuelPerMote);
      if (!wasSafe && this.isSafeLantern(lantern)) lantern.safePushTicks = 30;
      this.player.carried -= amount;
      this.score += amount * this.tuning.score.per_mote;
      this.emit("refuel", { lantern_id: lantern.id, amount, fuel: this.lanternFuel(lantern) });
      return;
    }
    const cost = this.lanternCost(lantern);
    const amount = Math.min(this.player.carried, cost - lantern.deposited);
    lantern.deposited += amount;
    this.player.carried -= amount;
    this.score += amount * this.tuning.score.per_mote;
    this.emit("deposit", { lantern_id: lantern.id, amount, deposited: lantern.deposited });
    if (lantern.deposited >= cost) {
      const relight = lantern.everLit;
      lantern.lit = true;
      lantern.everLit = true;
      lantern.relitCount += Number(relight);
      lantern.fuelTicks = this.tuning.fuel_max * TICK_RATE;
      lantern.safePushTicks = 30;
      this.successfulLights++;
      this.score += relight ? this.tuning.score.per_relight : this.tuning.score.per_lantern;
      this.emit("lantern_lit", { lantern_id: lantern.id, relight });
    }
  }

  updateSafeZones() {
    for (const lantern of this.lanterns) {
      if (!this.isSafeLantern(lantern)) continue;
      if (lantern.safePushTicks > 0) lantern.safePushTicks--;
      for (const shade of this.shades) {
        const dx = shade.pos[0] - lantern.pos[0];
        const dz = shade.pos[2] - lantern.pos[2];
        const distance = Math.hypot(dx, dz);
        if (distance < this.tuning.safe_radius) {
          if (lantern.safePushTicks > 0) shade.safePushTicks = Math.max(shade.safePushTicks, lantern.safePushTicks);
          const direction = distance > 0.001 ? [dx / distance, dz / distance] : [1, 0];
          shade.pos[0] = round3(lantern.pos[0] + direction[0] * this.tuning.safe_radius);
          shade.pos[2] = round3(lantern.pos[2] + direction[1] * this.tuning.safe_radius);
        }
      }
    }
  }

  activatePulse() {
    if (!(this.input.pulse && !this.previousInput.pulse) || this.pulseCooldownTicks > 0 || this.player.carried < this.tuning.pulse_cost) return;
    this.player.carried -= this.tuning.pulse_cost;
    this.pulseCooldownTicks = 180;
    const center = [this.player.pos[0], this.player.pos[1] + 0.8, this.player.pos[2]];
    const stunned = [];
    for (const shade of this.shades) {
      if (distance3(center, shade.pos) <= this.tuning.pulse_radius) {
        const wasDraining = shade.state === "drain";
        shade.state = "stunned";
        shade.stunTicks = 120;
        shade.pushTicks = 15;
        const dx = shade.pos[0] - center[0];
        const dz = shade.pos[2] - center[2];
        const distance = Math.hypot(dx, dz);
        shade.pushDirection = distance > 0.001 ? [dx / distance, dz / distance] : [1, 0];
        stunned.push(shade.id);
        this.score += wasDraining ? this.tuning.score.per_drain_stun : this.tuning.score.per_stun;
      }
    }
    for (const drifter of this.drifters) {
      if (drifter.state === "chase" && distance3(center, drifter.pos) <= this.tuning.pulse_radius) {
        drifter.state = "flee";
        drifter.stateTicksLeft = 240;
      } else if (drifter.state === "flee" && drifter.stolen > 0 && distance3(center, drifter.pos) <= this.tuning.pulse_radius) {
        this.dropMotes(drifter.pos, drifter.stolen, drifter.id);
        this.emit("drifter_drop", { drifter_id: drifter.id, amount: drifter.stolen });
        drifter.stolen = 0;
        drifter.stateTicksLeft = 120;
      }
    }
    this.emit("pulse", { stunned_ids: stunned });
  }

  shadeCanDetect(shade, distance) {
    if (distance > 12) return false;
    if (!this.tuning.shade_view_deg || distance === 0) return true;
    const [forwardX, forwardZ] = shade.heading ?? this.shadeWanderHeading(shade);
    const x = this.player.pos[0] - shade.pos[0];
    const z = this.player.pos[2] - shade.pos[2];
    const minimumDot = Math.cos(this.tuning.shade_view_deg * Math.PI / 360);
    return (forwardX * x + forwardZ * z) / distance >= minimumDot;
  }

  shadeWanderHeading(shade) {
    const angle = this.simTick / 120 + (Number(shade.id.slice(1)) || 0);
    return [Math.cos(angle), Math.sin(angle)];
  }

  updateShades({ wanderOnly = false } = {}) {
    const weakLamps = this.lanterns.filter(lamp => lamp.lit && !this.isSafeLantern(lamp));
    const unlit = lamp => !lamp.lit;
    const weak = lamp => weakLamps.includes(lamp);
    for (const shade of this.shades) {
      if (shade.hitCooldownTicks > 0) shade.hitCooldownTicks--;
      if (shade.stateTicksLeft > 0) shade.stateTicksLeft--;
      if (shade.pushTicks > 0) {
        const stepDistance = this.tuning.pulse_push_m / 15;
        const x = shade.pos[0] + shade.pushDirection[0] * stepDistance;
        const z = shade.pos[2] + shade.pushDirection[1] * stepDistance;
        const tower = this.night === 3 && shade.pos[1] >= 6 && Math.hypot(x, z) <= 2;
        if (tower || this.floorAt(x, z, shade.pos[1]) == null) shade.pushTicks = 0;
        else {
          shade.pos[0] = round3(x);
          shade.pos[2] = round3(z);
          shade.pushTicks--;
        }
      }
      if (shade.state === "spawning") {
        if (shade.stateTicksLeft === 0) shade.state = "wander";
        continue;
      }
      if (shade.state === "stunned") {
        shade.stunTicks--;
        if (shade.stunTicks <= 0) {
          shade.state = "wander";
        }
        continue;
      }
      const distance = distanceXZ(this.player.pos, shade.pos);
      if (shade.state === "drain") {
        const target = this.lanterns.find(lamp => lamp.id === shade.targetLanternId);
        if (distance <= 6) shade.state = "chase";
        else if (target?.lit && !this.isSafeLantern(target) && distanceXZ(shade.pos, target.pos) <= 2) continue;
        else shade.state = "wander";
        shade.targetLanternId = undefined;
      }
      if (shade.state !== "recoil") {
        if (!wanderOnly && shade.state === "wander" && this.shadeCanDetect(shade, distance)) shade.state = "chase";
        else if (distance >= 18) shade.state = "wander";
      }
      let speed = this.night === 3 ? 4.5 : this.tuning.shade_speed;
      let dx = this.player.pos[0] - shade.pos[0];
      let dz = this.player.pos[2] - shade.pos[2];
      let drainingTarget;
      if (shade.state === "recoil") {
        dx = shade.recoilDirection[0];
        dz = shade.recoilDirection[1];
        speed = 2;
        shade.recoilTicks--;
        if (shade.recoilTicks <= 0) shade.state = "wander";
      } else if (shade.state === "wander") {
        const target = (weakLamps.length ? this.nearestLantern(shade.pos, weak) : undefined)
          ?? this.nearestLantern(shade.pos, unlit);
        if (target?.lit) drainingTarget = target;
        [dx, dz] = target ? [target.pos[0] - shade.pos[0], target.pos[2] - shade.pos[2]] : this.shadeWanderHeading(shade);
        speed = drainingTarget && distanceXZ(shade.pos, drainingTarget.pos) <= 2 ? 0 : 1;
      }
      const magnitude = Math.hypot(dx, dz) || 1;
      if (dx || dz) shade.heading = [dx / magnitude, dz / magnitude];
      shade.pos[0] = round3(shade.pos[0] + dx / magnitude * speed / TICK_RATE);
      shade.pos[2] = round3(shade.pos[2] + dz / magnitude * speed / TICK_RATE);
      if (drainingTarget && distanceXZ(shade.pos, drainingTarget.pos) <= 2) {
        shade.state = "drain";
        shade.targetLanternId = drainingTarget.id;
        shade.drainTicks = 0;
      }
      for (const lantern of this.lanterns) {
        if (!this.isSafeLantern(lantern)) continue;
        const safeDx = shade.pos[0] - lantern.pos[0];
        const safeDz = shade.pos[2] - lantern.pos[2];
        const safeDistance = Math.hypot(safeDx, safeDz);
        if (safeDistance < this.tuning.safe_radius) {
          shade.safePushTicks = Math.max(shade.safePushTicks, lantern.safePushTicks);
          const direction = safeDistance > 0.001 ? [safeDx / safeDistance, safeDz / safeDistance] : [1, 0];
          shade.pos[0] = round3(lantern.pos[0] + direction[0] * this.tuning.safe_radius);
          shade.pos[2] = round3(lantern.pos[2] + direction[1] * this.tuning.safe_radius);
        }
      }
    }
  }

  updateDrifters() {
    for (const drifter of this.drifters) {
      if (drifter.state === "removed") {
        continue;
      }
      const distance = distanceXZ(this.player.pos, drifter.pos);
      if (drifter.state === "idle") {
        if (this.player.carried >= 5 && distance <= 15) drifter.state = "chase";
        else {
          drifter.pos[0] += Math.cos(this.simTick / 90) * 2 / TICK_RATE;
          drifter.pos[2] += Math.sin(this.simTick / 90) * 2 / TICK_RATE;
        }
      } else if (drifter.state === "chase") {
        if (this.player.carried < 5 || distance > 15) {
          drifter.state = "idle";
        } else {
          const dx = this.player.pos[0] - drifter.pos[0];
          const dz = this.player.pos[2] - drifter.pos[2];
          const d = Math.hypot(dx, dz) || 1;
          drifter.pos[0] += dx / d * 7 / TICK_RATE;
          drifter.pos[2] += dz / d * 7 / TICK_RATE;
        }
      } else if (drifter.state === "flee") {
        drifter.stateTicksLeft--;
        const [x, z] = directionXZ(this.player.pos, drifter.pos);
        drifter.pos[0] += x * 7 / TICK_RATE;
        drifter.pos[2] += z * 7 / TICK_RATE;
        if (drifter.stateTicksLeft <= 0) {
          drifter.state = "removed";
          drifter.stolen = 0;
        }
      }
      drifter.pos = vectorRound(drifter.pos);
      if (drifter.state === "chase" && distanceXZ(this.player.pos, drifter.pos) <= 1.2) {
        const amount = Math.min(3, this.player.carried);
        if (amount > 0) {
          this.player.carried -= amount;
          drifter.stolen += amount;
          drifter.state = "flee";
          drifter.stateTicksLeft = 240;
          this.emit("drifter_steal", { drifter_id: drifter.id, amount, carried: this.player.carried });
        }
      }
    }
  }

  checkHits() {
    if (this.respawnTicks > 0 || this.invulnTicks > 0) return;
    const hit = this.shades
      .filter(shade => !["spawning", "stunned", "drain"].includes(shade.state) && shade.safePushTicks === 0
        && distanceXZ(this.player.pos, shade.pos) <= 1
        && Math.abs(this.player.pos[1] - shade.pos[1]) <= 1.5)
      .sort(compareIds)[0];
    if (!hit) return;
    this.player.flames = Math.max(0, this.player.flames - 1);
    const dropped = Math.floor(this.player.carried / 2);
    this.player.carried -= dropped;
    if (dropped > 0) this.dropMotes(this.player.pos, dropped);
    this.invulnTicks = 90;
    this.emit("player_hit", { by: "shade", flames: this.player.flames, dropped });
    hit.state = "recoil";
    hit.recoilDirection = directionXZ(this.player.pos, hit.pos);
    hit.recoilTicks = 60;
  }

  dropMotes(origin, amount, sourceId = "M") {
    const startId = this.motes.length + 1;
    for (let i = 0; i < amount && this.motes.length < 30; i++) {
      const angle = this.random() * Math.PI * 2;
      const radius = sourceId === "M" ? 1.5 + this.random() : 0;
      this.motes.push({
        id: `${sourceId}-drop-${this.simTick}-${i + startId}`,
        pos: [round3(origin[0] + Math.cos(angle) * radius), origin[1] || 0, round3(origin[2] + Math.sin(angle) * radius)],
        kind: "dropped", ttlTicks: 480, activeFrom: this.simTick
      });
    }
  }

  spawnScheduled() {
    if (this.randomMotes && this.simTick % 240 === 0 && this.motes.length < 30) {
      const used = new Set(this.motes.map(m => m.pos.join(",")));
      const point = this.map.motePoints.find(p => !used.has(p.join(",")));
      if (point) {
        const mote = { id: `M${this.simTick / 240 + 20}`, pos: [...point], kind: "random", ttlTicks: null, activeFrom: this.simTick };
        this.motes.push(mote);
      }
    }

    if (this.randomShades && this.simTick >= this.map.shadeFirst
      && (this.simTick - this.map.shadeFirst) % this.map.shadeInterval === 0) {
      const count = this.simTick === this.map.shadeFirst && this.night === 1 ? 2 : 1;
      for (let i = 0; i < count; i++) {
        if (this.shades.filter(s => s.state !== "removed").length < this.map.shadeLimit) this.spawnShade();
      }
    }
    if (this.randomDrifters && this.night >= 2 && this.simTick % 1200 === 0) this.spawnDrifter();
  }

  finish(result, reason) {
    if (this.finished) return;
    this.finished = true;
    this.state = result;
    if (result === "won") {
      for (const lantern of this.lanterns) {
        if (lantern.lit) this.score += this.tuning.score.per_dawn_lantern + Math.floor(lantern.fuelTicks / TICK_RATE);
      }
      this.score += this.player.flames * this.tuning.score.per_flame_left;
    }
    this.emit("game_over", { result, reason });
  }

  snapshot() {
    const seconds = value => round3(Math.max(0, value) / TICK_RATE);
    return {
      type: "snapshot", tick: this.tick, sim_tick: this.simTick, night: this.night,
      state: this.state, time_left_s: round3(this.timeLeft), score: this.score,
      wind: { active: this.windActive, dir_deg: this.windDirection },
      player: {
        pos: vectorRound(this.player.pos), vel: vectorRound(this.player.vel),
        flames: this.player.flames, carried: this.player.carried, capacity: this.capacity,
        grounded: this.player.grounded, invuln: this.invulnTicks > 0,
        invuln_ticks: this.invulnTicks, dash_cd_s: seconds(this.dashCooldownTicks),
        pulse_cd_s: seconds(this.pulseCooldownTicks), charm_s: seconds(this.charmTicks)
      },
      lanterns: this.lanterns.map(l => ({
        id: l.id, pos: vectorRound(l.pos), lit: l.lit, deposited: l.deposited, fuel: this.lanternFuel(l),
        ever_lit: l.everLit, relit_count: l.relitCount
      })),
      shades: this.shades.map(s => ({
        id: s.id, pos: vectorRound(s.pos), state: s.state,
        state_ticks_left: s.state === "stunned" ? s.stunTicks : s.state === "recoil" ? s.recoilTicks : s.stateTicksLeft
      })),
      motes: this.motes.map(m => ({ id: m.id, pos: vectorRound(m.pos), kind: m.kind, ttl_s: m.ttlTicks == null ? null : seconds(m.ttlTicks) })),
      drifters: this.drifters.map(d => ({ id: d.id, pos: vectorRound(d.pos), state: d.state, stolen: d.stolen })),
      charms: this.charms.map(c => ({ id: c.id, available: c.available, respawn_s: seconds(c.respawnTicks) })),
      motes_active: this.motes.length,
      environment_light: this.environmentLight
    };
  }
}

export function createGame(seed, scenario = {}, tuning = {}, night = 1) {
  return new Game(seed, scenario, tuning, night);
}
