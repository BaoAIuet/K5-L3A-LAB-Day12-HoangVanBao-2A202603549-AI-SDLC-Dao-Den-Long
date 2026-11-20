import * as THREE from "/vendor/three.module.js";
import { createGame } from "/src/game.js";
import { createMay } from "./character.js";
import { runBenchmark } from "./benchmark.js";
import { createAtmosphere, dressIsland, makeGlowTexture, makeTurfTexture } from "./scenery.js";

const world = document.querySelector("#world");
const scene = new THREE.Scene();
scene.background = new THREE.Color("#0E1430");
scene.fog = new THREE.Fog("#0E1430", 65, 180);
const camera = new THREE.PerspectiveCamera(54, 1, 0.1, 300);
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.shadowMap.autoUpdate = false;
  world.appendChild(renderer.domElement);
} catch (error) {
  world.textContent = `Không khởi tạo được WebGL: ${error.message}`;
}
const pointerTarget = renderer ? renderer.domElement : world;
const hud = document.querySelector("#hud");
const screens = Object.fromEntries(["menu", "intro", "pause", "result", "settings", "leaderboard"]
  .map(name => [name, document.querySelector(`#${name}-screen`)]));
const names = ["", "Đêm 1 — Đảo Bến", "Đêm 2 — Đảo Cau", "Đêm 3 — Đảo Chuông"];
const stories = ["", "Ông Đăng: Hãy thắp lại những ngọn đèn bên bến.", "Ông Đăng: Cây cầu tre sẽ đưa con qua hai đảo.", "Ông Đăng: Trên đỉnh đảo chuông, bình minh đang chờ."];
const keys = new Set();
const pending = {};
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
let dpr = 1;
let game = null;
let night = 1;
let totalScore = 0;
let nightsWon = 0;
let journeySeed = 0;
let shadeNotice;
let handledFinish = false;
let lastCountdownSecond;
let windCuePlayed = false;
let windLeaves;
let cameraYaw = 0;
let dragging = false;
let lastPointerX = 0;
let toastUntil = 0;
let previousScreen = "menu";
let accumulator = 0;
let lastFrameAt = 0;
let lastShadowFrame = -Infinity;
let audioContext = null;
let ambientNodes = [];
let worldGroup = new THREE.Group();
let entityObjects = { motes: new Map(), lanterns: new Map(), shades: new Map(), drifters: new Map(), charms: new Map() };
let playerObject;
let may;
let footEffects = [];
let nextFootEffect = 0;
let trailTimer = 0;
let wasGrounded = true;
const priorPlayerPosition = new THREE.Vector3();
const currentPlayerPosition = new THREE.Vector3();
let ambientLight;
let atmosphere;
let glowTexture;
let turfTexture;
let effects = [];
let impacts = [];
let hitUntil = 0;

const actions = {
  forward: ["Tiến", ["w", "arrowup"]], backward: ["Lùi", ["s", "arrowdown"]],
  left: ["Trái", ["a", "arrowleft"]], right: ["Phải", ["d", "arrowright"]],
  jump: ["Nhảy", [" "]], dash: ["Lướt", ["shift"]], interact: ["Nạp đèn", ["e"]],
  pulse: ["Tỏa sáng", ["f"]], pause: ["Tạm dừng", ["escape", "p"]]
};
let settings = { volume: 0.35, sensitivity: 1, accessiblePalette: false, reduceMotion: false, largeText: false, bindings: {} };
let captureAction;
try {
  settings = { ...settings, ...JSON.parse(localStorage.getItem("dao-den-long-settings") || "{}") };
} catch (error) {
  console.warn("Không đọc được cài đặt đã lưu:", error);
}
document.querySelector("#volume").value = settings.volume;
document.querySelector("#sensitivity").value = settings.sensitivity;
document.querySelector("#accessible-palette").checked = settings.accessiblePalette;
document.querySelector("#reduce-motion").checked = settings.reduceMotion;
document.querySelector("#large-text").checked = settings.largeText;
applyAccessibility();
renderBindings();

function applyAccessibility() {
  document.documentElement.classList.toggle("accessible-palette", settings.accessiblePalette);
  document.documentElement.classList.toggle("reduce-motion", settings.reduceMotion);
  document.documentElement.classList.toggle("large-text", settings.largeText);
}

function boundKeys(action) {
  return settings.bindings[action] ?? actions[action][1];
}

function keyName(key) {
  return { " ": "Space", escape: "Esc", arrowup: "↑", arrowdown: "↓", arrowleft: "←", arrowright: "→", shift: "Shift" }[key] ?? key.toUpperCase();
}

function renderBindings() {
  const controls = document.querySelector("#menu-controls");
  const editor = document.querySelector("#key-bindings");
  controls.replaceChildren();
  editor.replaceChildren();
  for (const [action, [label]] of Object.entries(actions)) {
    const keysText = boundKeys(action).map(keyName).join("/");
    const item = document.createElement("span");
    item.textContent = `${label} · ${keysText}`;
    controls.append(item);
    const button = document.createElement("button");
    button.className = "secondary";
    button.type = "button";
    button.textContent = `${label} · ${keysText}`;
    button.addEventListener("click", () => {
      captureAction = action;
      document.querySelector("#key-message").textContent = `Nhấn phím cho hành động ${label.toLowerCase()}.`;
    });
    editor.append(button);
  }
  document.querySelector("#ability-bar > div:first-child kbd").textContent = keyName(boundKeys("dash")[0]);
  document.querySelector("#ability-bar > div:nth-child(2) kbd").textContent = keyName(boundKeys("pulse")[0]);
}

function resize() {
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  if (!renderer) return;
  renderer.setPixelRatio(dpr);
  renderer.setSize(innerWidth, innerHeight, false);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
}
addEventListener("resize", resize);
resize();

function showScreen(name) {
  for (const [screenName, element] of Object.entries(screens)) element.hidden = screenName !== name;
  hud.hidden = !game || !["playing", "paused"].includes(game.state);
}

function startAudio() {
  if (audioContext) return;
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return;
  audioContext = new AudioContext();
  const master = audioContext.createGain();
  master.gain.value = Number(settings.volume);
  master.connect(audioContext.destination);
  for (const frequency of [55, 82.4]) {
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = frequency;
    gain.gain.value = 0.025;
    oscillator.connect(gain);
    gain.connect(master);
    oscillator.start();
    ambientNodes.push({ oscillator, gain, master });
  }
}

function tone(frequency, duration = 0.12, waveform = "sine") {
  if (!audioContext || settings.volume <= 0) return;
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  oscillator.type = waveform;
  oscillator.frequency.value = frequency;
  gain.gain.setValueAtTime(Math.max(0.001, settings.volume * 0.12), audioContext.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + duration);
  oscillator.connect(gain);
  gain.connect(audioContext.destination);
  oscillator.start();
  oscillator.stop(audioContext.currentTime + duration);
}

function playEvents() {
  for (const event of game.events) {
    if (event.name === "mote_picked" || event.name === "charm_picked") tone(880, 0.1);
    else if (event.name === "lantern_lit") {
      tone(520, 0.35, "triangle");
      tone(780, 0.55);
      toastUntil = performance.now() + 1700;
      const lantern = game.lanterns.find(item => item.id === event.data.lantern_id);
      if (lantern) emitRing(lantern.pos, "#ffbd68", game.tuning.safe_radius, 850);
    }
    else if (event.name === "pulse") {
      tone(190, 0.25, "sawtooth");
      const now = performance.now();
      emitRing(game.player.pos, "#a3dbff", game.tuning.pulse_radius, 370, now);
      emitRing(game.player.pos, "#5377ff", game.tuning.pulse_radius * 0.88, 430, now + 45);
      for (const id of event.data.stunned_ids) {
        const shade = game.shades.find(item => item.id === id);
        if (shade) emitShadeImpact(shade, now);
      }
      if (event.data.stunned_ids.length) tone(390, 0.24, "triangle");
    }
    else if (event.name === "refuel") tone(590, 0.16);
    else if (event.name === "lantern_out") tone(125, 0.26, "triangle");
    else if (event.name === "player_hit") {
      tone(110, 0.24, "square");
      if (!settings.reduceMotion) hitUntil = performance.now() + 380;
    }
    else if (event.name === "deposit") tone(620, 0.16);
    else if (event.name === "dash") tone(460, 0.1, "triangle");
    else if (event.name === "jump") tone(340, 0.1);
    else if (event.name === "shade_spawned") {
      tone(150, 0.25);
      shadeNotice = { id: event.data.id, until: game.simTick + 180 };
    }
  }
}

function showIntro(which) {
  night = which;
  document.querySelector("#intro-kicker").textContent = `HÀNH TRÌNH · ${which}/3`;
  document.querySelector("#intro-title").textContent = names[which];
  document.querySelector("#intro-story").textContent = stories[which];
  showScreen("intro");
}

function beginNight() {
  startAudio();
  game = createGame((journeySeed ^ (night * 271)) >>> 0, {}, { shade_view_deg: 90 }, night);
  buildWorld(night);
  cameraYaw = 0;
  handledFinish = false;
  lastCountdownSecond = undefined;
  windCuePlayed = false;
  accumulator = 0;
  hitUntil = toastUntil = 0;
  shadeNotice = undefined;
  document.querySelector("#night-title").textContent = names[night];
  showScreen(null);
  updateHud();
}

function handleFinishedGame() {
  if (handledFinish || !game || !["won", "lost"].includes(game.state)) return;
  handledFinish = true;
  const won = game.state === "won";
  if (won) {
    totalScore += game.score;
    nightsWon++;
  }
  const form = document.querySelector("#score-form");
  form.hidden = won && night < 3;
  form.reset();
  document.querySelector("#score-message").textContent = "";
  form.querySelector("button").disabled = false;
  document.querySelector("#result-kicker").textContent = won ? `ĐÃ THẮP SÁNG · ${night}/3` : "ĐÊM NAY CHƯA KẾT THÚC";
  document.querySelector("#result-title").textContent = won ? (night === 3 ? "Bình Minh" : "Đêm đã sáng") : "Sương đen phủ kín";
  document.querySelector("#result-copy").textContent = won
    ? `Điểm đêm này: ${game.score} · Tổng điểm: ${totalScore}`
    : `Điểm đêm này: ${game.score} · Có thể thử lại đêm ${night}.`;
  const action = document.querySelector("#result-action");
  if (won && night < 3) {
    action.textContent = "Đêm tiếp theo";
    action.onclick = () => showIntro(night + 1);
  } else if (won) {
    action.textContent = "Chơi lại hành trình";
    action.onclick = startJourney;
  } else {
    action.textContent = "Chơi lại đêm";
    action.onclick = beginNight;
  }
  showScreen("result");
  if (won) tone(660, 0.5, "triangle");
  else tone(95, 0.55, "sawtooth");
}

function settingsChanged() {
  settings.volume = Number(document.querySelector("#volume").value);
  settings.sensitivity = Number(document.querySelector("#sensitivity").value);
  settings.accessiblePalette = document.querySelector("#accessible-palette").checked;
  settings.reduceMotion = document.querySelector("#reduce-motion").checked;
  settings.largeText = document.querySelector("#large-text").checked;
  applyAccessibility();
  localStorage.setItem("dao-den-long-settings", JSON.stringify(settings));
  if (audioContext) {
    for (const node of ambientNodes) node.master.gain.setTargetAtTime(settings.volume, audioContext.currentTime, 0.08);
  }
}

function startJourney() {
  totalScore = 0;
  nightsWon = 0;
  journeySeed = Date.now() >>> 0;
  showIntro(1);
}

document.querySelector("#begin").addEventListener("click", startJourney);
document.querySelector("#play-night").addEventListener("click", beginNight);
document.querySelector("#resume").addEventListener("click", () => { pending.pause = true; showScreen(null); });
document.querySelector("#replay").addEventListener("click", beginNight);
function returnToMenu() {
  game = null;
  buildWorld(1);
  showScreen("menu");
}

document.querySelector("#to-menu").addEventListener("click", returnToMenu);
document.querySelector("#result-menu").addEventListener("click", returnToMenu);
document.querySelector("#open-settings").addEventListener("click", () => { previousScreen = "menu"; showScreen("settings"); });
document.querySelector("#pause-settings").addEventListener("click", () => { previousScreen = "pause"; showScreen("settings"); });
document.querySelector("#close-settings").addEventListener("click", () => {
  captureAction = undefined;
  showScreen(previousScreen);
});
document.querySelector("#volume").addEventListener("input", settingsChanged);
document.querySelector("#sensitivity").addEventListener("input", settingsChanged);
document.querySelector("#accessible-palette").addEventListener("change", settingsChanged);
document.querySelector("#reduce-motion").addEventListener("change", settingsChanged);
document.querySelector("#large-text").addEventListener("change", settingsChanged);
document.querySelector("#reset-keys").addEventListener("click", () => {
  captureAction = undefined;
  settings.bindings = {};
  settingsChanged();
  renderBindings();
  document.querySelector("#key-message").textContent = "Đã khôi phục phím mặc định.";
});

async function fetchScores(options) {
  const response = await fetch("/api/leaderboard", options);
  if ([404, 405, 501].includes(response.status)) {
    const entries = JSON.parse(localStorage.getItem("dao-den-long-static-leaderboard") || "[]");
    if (!options) return entries;
    const input = JSON.parse(options.body);
    if (!/^[A-Za-z0-9_]{3,12}$/.test(input.name)) throw new Error("Tên lưu điểm không hợp lệ.");
    entries.push({ ...input, achieved_at: new Date().toISOString() });
    entries.sort((a, b) => b.score - a.score || a.achieved_at.localeCompare(b.achieved_at));
    const top = entries.slice(0, 10);
    localStorage.setItem("dao-den-long-static-leaderboard", JSON.stringify(top));
    return top;
  }
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || "Không truy cập được bảng xếp hạng.");
  return body.entries;
}

document.querySelector("#score-form").addEventListener("submit", async event => {
  event.preventDefault();
  const button = event.currentTarget.querySelector("button");
  const status = document.querySelector("#score-message");
  button.disabled = true;
  try {
    await fetchScores({
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: document.querySelector("#score-name").value, score: totalScore, nights_won: nightsWon, seed: journeySeed
      })
    });
    status.textContent = "Đã ghi nhận điểm.";
  } catch (error) {
    status.textContent = error.message;
    button.disabled = false;
  }
});

document.querySelector("#open-leaderboard").addEventListener("click", async () => {
  showScreen("leaderboard");
  const list = document.querySelector("#score-list");
  const message = document.querySelector("#leaderboard-message");
  list.replaceChildren();
  message.textContent = "Đang tải…";
  try {
    const entries = await fetchScores();
    message.textContent = entries.length ? "" : "Chưa có điểm được lưu.";
    for (const entry of entries) {
      const row = document.createElement("li");
      row.textContent = `${entry.name} · ${entry.score} điểm · ${entry.nights_won}/3 đêm`;
      list.append(row);
    }
  } catch (error) {
    message.textContent = error.message;
  }
});
document.querySelector("#close-leaderboard").addEventListener("click", returnToMenu);

addEventListener("keydown", event => {
  const key = event.key.toLowerCase();
  if (captureAction && screens.settings.hidden === false) {
    event.preventDefault();
    const message = document.querySelector("#key-message");
    const conflict = Object.keys(actions).find(action => action !== captureAction && boundKeys(action).includes(key));
    if (conflict) {
      message.textContent = `Phím ${keyName(key)} đang dùng cho ${actions[conflict][0]}.`;
      return;
    }
    if (event.ctrlKey || event.altKey || event.metaKey || ["control", "alt", "meta", "tab"].includes(key)) {
      message.textContent = "Hãy chọn một phím chơi game.";
      return;
    }
    settings.bindings[captureAction] = [key];
    captureAction = undefined;
    settingsChanged();
    renderBindings();
    message.textContent = `Đã lưu phím ${keyName(key)}.`;
    return;
  }
  if (event.target instanceof HTMLInputElement || (event.target instanceof HTMLButtonElement && event.key === " ")) return;
  if (game?.state === "playing" && [" ", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(key)) event.preventDefault();
  keys.add(key);
  if (!event.repeat && boundKeys("pause").includes(key) && screens.settings.hidden
    && game && ["playing", "paused"].includes(game.state)) {
    pending.pause = true;
  }
  if (!event.repeat && key === "r" && game && ["won", "lost"].includes(game.state)) {
    document.querySelector("#result-action").click();
  }
});
addEventListener("keyup", event => keys.delete(event.key.toLowerCase()));
addEventListener("blur", () => { keys.clear(); dragging = false; });
pointerTarget.addEventListener("pointerdown", event => {
  dragging = true;
  lastPointerX = event.clientX;
  pointerTarget.setPointerCapture(event.pointerId);
});
pointerTarget.addEventListener("pointermove", event => {
  if (!dragging || !game) return;
  cameraYaw = (cameraYaw + (event.clientX - lastPointerX) * settings.sensitivity * 0.25) % 360;
  lastPointerX = event.clientX;
});
pointerTarget.addEventListener("pointerup", () => { dragging = false; });
pointerTarget.addEventListener("pointercancel", () => { dragging = false; });

function readInput() {
  const pressed = action => boundKeys(action).some(key => keys.has(key));
  let x = 0, z = 0;
  // At zero yaw the camera looks along +Z, so screen-right is -X.
  if (pressed("left")) x += 1;
  if (pressed("right")) x -= 1;
  if (pressed("forward")) z += 1;
  if (pressed("backward")) z -= 1;
  const input = {
    move: [x, z], cam_yaw_deg: cameraYaw,
    jump: pressed("jump"), dash: pressed("dash"),
    interact: pressed("interact"), pulse: pressed("pulse"),
    pause: Boolean(pending.pause)
  };
  pending.pause = false;
  return input;
}

const makeMaterial = (color, options = {}) => new THREE.MeshStandardMaterial({
  color, roughness: 0.78, metalness: 0.02, ...options
});

function addMesh(parent, geometry, material, position = [0, 0, 0]) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(...position);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function disposeTree(object) {
  object.traverse(child => {
    child.geometry?.dispose();
    if (child.isInstancedMesh) child.dispose();
    child.userData.ownedTexture?.dispose();
    child.material?.dispose();
  });
}

function glow(parent, color, size, y, x = 0, z = 0) {
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTexture, color, blending: THREE.AdditiveBlending, depthWrite: false, fog: true
  }));
  sprite.position.set(x, y, z);
  sprite.scale.setScalar(size);
  parent.add(sprite);
  return sprite;
}

function emitRing(position, color, radius, duration, started = performance.now()) {
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.9, 1, 64),
    new THREE.MeshBasicMaterial({
      color, transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending
    }));
  ring.position.set(position[0], position[1] + 0.065, position[2]);
  ring.rotation.x = -Math.PI / 2;
  worldGroup.add(ring);
  ring.visible = false;
  effects.push({ ring, radius, duration, started });
}

function emitShadeImpact(shade, started) {
  const [x, , z] = shade.pos;
  const [dx, dz] = shade.pushDirection;
  const y = Math.max(shade.pos[1], game.floorAt(x, z, shade.pos[1]) ?? shade.pos[1]) + 0.62;
  const group = new THREE.Group();
  group.position.set(x, y, z);
  group.rotation.y = Math.atan2(dx, dz);
  worldGroup.add(group);
  const flash = glow(group, "#b7eeff", 2.75, 0);
  const sparks = Array.from({ length: 13 }, (_, i) => {
    const angle = i * 2.39996;
    return {
      sprite: glow(group, i % 3 ? "#72ceff" : "#b98bff", 0.60, 0),
      x: Math.cos(angle) * (0.5 + i % 4 * 0.25),
      y: Math.sin(angle) * 0.57 + 0.23,
      z: 1.24 + i % 5 * 0.27
    };
  });
  impacts.push({ group, flash, sparks, started });
}

function updateShadeImpacts(timestamp) {
  impacts = impacts.filter(({ group, flash, sparks, started }) => {
    const age = clamp((timestamp - started) / 490, 0, 1);
    if (age === 1) {
      worldGroup.remove(group);
      disposeTree(group);
      return false;
    }
    const spread = 1 - (1 - age) ** 2;
    flash.scale.setScalar(0.88 + spread * 2.3);
    flash.material.opacity = (1 - age) ** 5;
    for (const { sprite, x, y, z } of sparks) {
      sprite.position.set(x * spread, y * spread - age * age * 0.29, z * spread);
      sprite.material.opacity = (1 - age) ** 2 * 0.96;
      sprite.scale.setScalar(0.41 - age * 0.31);
    }
    return true;
  });
}

function addIsland(cx, cz, radius) {
  addMesh(worldGroup, new THREE.CylinderGeometry(radius, radius * 0.975, 1.2, 96),
    makeMaterial("#C9B48A", { flatShading: true }), [cx, -0.63, cz]);
  const turf = addMesh(worldGroup, new THREE.CylinderGeometry(radius, radius, 0.12, 96),
    makeMaterial(atmosphere.turf, benchmarkMode
      ? { map: turfTexture }
      : { map: turfTexture, bumpMap: turfTexture, bumpScale: 0.095 }), [cx, -0.06, cz]);
  turf.castShadow = false;
  const shore = new THREE.Mesh(new THREE.RingGeometry(radius - 0.75, radius, 128),
    new THREE.MeshBasicMaterial({ color: "#8ca8a3", transparent: true, opacity: 0.36, depthWrite: false }));
  shore.position.set(cx, 0.008, cz);
  shore.rotation.x = -Math.PI / 2;
  worldGroup.add(shore);
  dressIsland(worldGroup, cx, cz, radius, atmosphere.time, !benchmarkMode);
}

function addBridge() {
  for (let i = 0; i < 30; i++) {
    const x = 26.3 + i * 0.6;
    addMesh(worldGroup, new THREE.BoxGeometry(0.58, 0.18, 4),
      makeMaterial(i % 3 === 0 ? "#704D31" : "#6B4A2F"), [x, -0.09, 0]);
  }
}

function addLaunchPad(x, y, z) {
  addMesh(worldGroup, new THREE.CylinderGeometry(1, 1, 0.16, 12),
    makeMaterial("#4b626b", { metalness: 0.36 }), [x, y + 0.04, z]);
  const ring = addMesh(worldGroup, new THREE.TorusGeometry(0.77, 0.035, 8, 36),
    makeMaterial("#8ff9ec", { emissive: "#28c7be", emissiveIntensity: 1.1 }), [x, y + 0.14, z]);
  ring.rotation.x = -Math.PI / 2;
  glow(worldGroup, "#58ffe4", 2.8, y + 0.2, x, z);
}

function buildWorld(which) {
  lastShadowFrame = -Infinity;
  if (worldGroup.parent) {
    scene.remove(worldGroup);
    disposeTree(worldGroup);
  }
  worldGroup = new THREE.Group();
  scene.add(worldGroup);
  camera.position.set(...(game ? [0, 5.5, -11.5] : [11, 8, -23]));
  camera.lookAt(0, 1.3, game ? 0 : 15);
  entityObjects = { motes: new Map(), lanterns: new Map(), shades: new Map(), drifters: new Map(), charms: new Map() };
  effects = [];
  impacts = [];
  atmosphere = createAtmosphere(scene, worldGroup, which);
  if (which === 1) {
    addIsland(0, 0, 40);
  } else if (which === 2) {
    addIsland(0, 0, 28);
    addIsland(70, 0, 28);
    addBridge();
  } else {
    addIsland(0, 0, 45);
    const ring = addMesh(worldGroup, new THREE.RingGeometry(12, 24, 64, 1, 0, Math.PI),
      makeMaterial("#637e83", { side: THREE.DoubleSide }), [0, 3, 0]);
    ring.rotation.x = -Math.PI / 2;
    ring.rotation.z = Math.PI;
    ring.castShadow = false;
    const upper = addMesh(worldGroup, new THREE.CircleGeometry(8, 48),
      makeMaterial("#668677", { side: THREE.DoubleSide }), [0, 6, 0]);
    upper.rotation.x = -Math.PI / 2;
    upper.castShadow = false;
    for (const [angle, radius, height] of [[20, 22, 3], [70, 22, 3], [110, 22, 3], [160, 22, 3], [20, 7.3, 6], [160, 7.3, 6]]) {
      const radians = THREE.MathUtils.degToRad(angle);
      const post = addMesh(worldGroup, new THREE.CylinderGeometry(0.37, 0.63, height, 6),
        makeMaterial("#5c6774"), [Math.cos(radians) * radius, height / 2, Math.sin(radians) * radius]);
      post.rotation.y = radians;
    }
    addMesh(worldGroup, new THREE.CylinderGeometry(1.84, 2, 6.5, 16),
      makeMaterial("#71544a"), [0, 9.25, 0]);
    addMesh(worldGroup, new THREE.ConeGeometry(2, 1.5, 16),
      makeMaterial("#37415d", { metalness: 0.28 }), [0, 13.25, 0]);
    addMesh(worldGroup, new THREE.CylinderGeometry(0.42, 0.95, 1.25, 16),
      makeMaterial("#c59c61", { metalness: 0.65 }), [0, 11.7, 1.7]);
    for (const angle of [30, 150]) {
      const ramp = addMesh(worldGroup, new THREE.BoxGeometry(6.5, 0.22, 3),
        makeMaterial("#C9B48A"), [Math.cos(angle * Math.PI / 180) * 27, 1.5, Math.sin(angle * Math.PI / 180) * 27]);
      ramp.rotation.y = -angle * Math.PI / 180;
      ramp.rotation.z = -Math.atan(0.5);
    }
  }
  for (const pad of game?.map.pads ?? []) addLaunchPad(...pad.pos);
  windLeaves = which === 3 ? createWindLeaves() : null;
  may = createMay(worldGroup, glow);
  playerObject = may.root;
  priorPlayerPosition.set(...(game?.player.pos ?? [0, 0, 0]));
  nextFootEffect = trailTimer = 0;
  wasGrounded = game?.player.grounded ?? true;
  footEffects = Array.from({ length: 25 }, () => {
    const sprite = glow(worldGroup, "#ffffff", 1, 0);
    sprite.visible = false;
    return { sprite, until: 0, life: 0 };
  });
  if (!game) {
    for (const [x, z] of [[-6, -2], [5, 2], [-15, 8], [12, 11], [1, 19]]) {
      const lantern = makeLantern();
      lantern.position.set(x, 0, z);
      styleLantern(lantern, { lit: true }, 0);
      worldGroup.add(lantern);
    }
    for (let i = 0; i < 22; i++) {
      const mote = makeMote();
      mote.position.set(Math.sin(i * 2.4) * (3 + i * 0.64), 0.3 + i % 4 * 0.34, -4 + i * 1.15);
      worldGroup.add(mote);
    }
    playerObject.position.set(1, 0, -4);
    playerObject.rotation.y = Math.PI * 0.97;
    camera.position.set(2.1, 2.25, -9.5);
    camera.lookAt(3.9, 1.55, -4);
    const portraitLight = new THREE.PointLight("#ffe0b4", 12, 9);
    portraitLight.position.set(0, 2.55, -6);
    worldGroup.add(portraitLight);
  }
}

function emitFootEffect(time, life, color, x, y, z, dust = false) {
  const effect = footEffects[nextFootEffect];
  nextFootEffect = (nextFootEffect + 1) % footEffects.length;
  effect.until = time + life;
  effect.life = life;
  effect.dust = dust;
  effect.height = y;
  effect.sprite.position.set(x, y, z);
  effect.sprite.material.color.set(color);
  effect.sprite.material.blending = dust ? THREE.NormalBlending : THREE.AdditiveBlending;
  effect.sprite.visible = true;
}

function updateFootEffects(time, delta, state, foot) {
  const { x, y, z } = playerObject.position;
  const yaw = playerObject.rotation.y;
  if (foot || (state.grounded && !wasGrounded && !game.respawnTicks)) {
    const landing = !wasGrounded && state.grounded;
    const count = landing ? 7 : 3;
    for (let i = 0; i < count; i++) {
      const angle = i * 2.399 + time;
      const distance = landing ? 0.48 : 0.22;
      emitFootEffect(time, 0.36 + i * 0.035, "#b1a592",
        x + Math.cos(yaw) * foot * 0.15 + Math.cos(angle) * distance, y + 0.09,
        z - Math.sin(yaw) * foot * 0.15 + Math.sin(angle) * distance, true);
    }
  }
  wasGrounded = state.grounded;
  trailTimer -= delta;
  if (trailTimer <= 0 && (state.dashing || (state.charmed && state.speed > 0.5))) {
    emitFootEffect(time, 0.29, state.dashing ? "#93d2ff" : "#ffcc78",
      x + Math.cos(yaw) * Math.sin(time * 45) * 0.41, y + 0.52 + Math.sin(time * 25) * 0.24,
      z - Math.cos(yaw) * 0.44);
    trailTimer = 0.026;
  }
  for (const effect of footEffects) {
    const remaining = Math.max(0, (effect.until - time) / effect.life);
    effect.sprite.visible = effect.until > time;
    if (!effect.sprite.visible) continue;
    const age = 1 - remaining;
    effect.sprite.position.y = effect.height + age * (effect.dust ? 0.23 : 0.27);
    effect.sprite.scale.setScalar(effect.dust ? 0.26 + age * 0.78 : 0.19 + age * 0.67);
    effect.sprite.material.opacity = remaining ** 2 * (effect.dust ? 0.64 : 0.36);
  }
}

function makeMote() {
  const group = new THREE.Group();
  group.add(new THREE.Mesh(new THREE.OctahedronGeometry(0.18), new THREE.MeshBasicMaterial({ color: "#FFF6C2" })));
  glow(group, "#FFE58A", 1.65, 0);
  return group;
}

function makeLantern() {
  const group = new THREE.Group();
  addMesh(group, new THREE.CylinderGeometry(0.22, 0.48, 0.28, 8), makeMaterial("#65757c"), [0, 0.14, 0]);
  addMesh(group, new THREE.CylinderGeometry(0.1, 0.17, 1.58, 8), makeMaterial("#523c3d"), [0, 0.94, 0]);
  const body = addMesh(group, new THREE.CylinderGeometry(0.33, 0.4, 0.74, 6),
    makeMaterial("#5B5F6E", { emissive: "#FFB347" }), [0, 1.99, 0]);
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.17, 8, 6),
    new THREE.MeshBasicMaterial({ color: "#FFE9B0" }));
  core.position.set(0, 2.03, 0.35);
  group.add(core);
  addMesh(group, new THREE.ConeGeometry(0.6, 0.41, 6),
    makeMaterial("#584652", { metalness: 0.3 }), [0, 2.55, 0]);
  addMesh(group, new THREE.CylinderGeometry(0.46, 0.41, 0.12, 6),
    makeMaterial("#906e59"), [0, 1.57, 0]);
  for (let i = 0; i < 6; i++) {
    const angle = i * Math.PI / 3;
    addMesh(group, new THREE.CylinderGeometry(0.027, 0.037, 0.78, 5),
      makeMaterial("#805952"), [Math.sin(angle) * 0.37, 1.98, Math.cos(angle) * 0.37]);
  }
  const light = new THREE.PointLight("#ffaf58", 0, 15);
  light.position.y = 2.35;
  group.add(light);
  const tearShape = new THREE.Shape();
  tearShape.moveTo(-0.09, 0.28);
  for (const [x, y] of [[0.02, 0.10], [-0.024, 0.02], [0.08, -0.19], [-0.12, -0.02], [-0.066, 0.08]]) tearShape.lineTo(x, y);
  tearShape.closePath();
  const tornPaper = addMesh(body, new THREE.ShapeGeometry(tearShape),
    new THREE.MeshBasicMaterial({ color: "#20222e", side: THREE.DoubleSide }), [0, 0, -0.37]);
  tornPaper.castShadow = false;
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 16;
  const gaugeTexture = new THREE.CanvasTexture(canvas);
  const gauge = new THREE.Sprite(new THREE.SpriteMaterial({ map: gaugeTexture, depthWrite: false }));
  gauge.userData.ownedTexture = gaugeTexture;
  gauge.position.y = 2.96;
  gauge.scale.set(1.35, 0.17, 1);
  group.add(gauge);
  Object.assign(group.userData, { light, body, core, tornPaper, gauge, halo: glow(group, "#FFB347", 4.8, 2.05) });
  return group;
}

function styleLantern(object, lantern, time) {
  const { light, body, core, halo, tornPaper, gauge } = object.userData;
  const fuel = lantern.fuelTicks == null ? 100 : lantern.fuelTicks / 60;
  const weak = lantern.lit && fuel < 30;
  const charge = lantern.lit ? 0.32 + 0.68 * fuel / 100 : lantern.deposited / game.lanternCost(lantern);
  const flicker = weak ? 0.6 + 0.4 * Math.cos(time * Math.PI * 2) : 1;
  light.intensity = charge * flicker * (27 + Math.sin(time * 4 + object.position.x) * 2);
  body.material.emissiveIntensity = 0.025 + charge * flicker * 1.25;
  body.material.color.set(lantern.lit ? "#FFB347" : "#5B5F6E");
  core.visible = lantern.lit;
  body.scale.y = lantern.lit ? 1 : 0.8;
  tornPaper.visible = !lantern.lit;
  halo.material.opacity = 0.12 + charge * flicker * 0.78;
  halo.material.color.set(lantern.lit || charge > 0 ? "#ff9d42" : "#89b6ff");
  gauge.visible = lantern.lit;
  gauge.material.opacity = weak ? 0.48 + flicker * 0.52 : 1;
  const level = Math.ceil(fuel);
  const color = weak && settings.accessiblePalette ? "#ffffff" : weak ? "#ff5a5f" : "#f2c14e";
  if (gauge.visible && (gauge.userData.level !== level || gauge.userData.color !== color)) {
    const ctx = gauge.material.map.image.getContext("2d");
    ctx.fillStyle = "#14172c";
    ctx.fillRect(0, 0, 128, 16);
    ctx.fillStyle = color;
    ctx.fillRect(3, 3, 122 * level / 100, 10);
    gauge.userData.level = level;
    gauge.userData.color = color;
    gauge.material.map.needsUpdate = true;
  }
}

function makeShade() {
  const group = new THREE.Group();
  const body = addMesh(group, new THREE.IcosahedronGeometry(0.59, 3),
    makeMaterial("#120A1A", { emissive: "#341850", emissiveIntensity: 0.42 }));
  body.scale.set(0.93, 1.14, 0.82);
  const rim = addMesh(group, new THREE.TorusGeometry(0.67, 0.06, 8, 24),
    makeMaterial("#7A3CFF", { emissive: "#7A3CFF", emissiveIntensity: 0.45 }), [0, -0.22, 0]);
  rim.rotation.x = Math.PI / 2;
  rim.castShadow = false;
  const aura = glow(group, "#7A3CFF", 2.55, -0.03);
  const wisps = Array.from({ length: 4 }, () => glow(group, "#7232bb", 0.70, 0));
  const taper = new THREE.ConeGeometry(0.13, 0.76, 6);
  taper.rotateX(Math.PI);
  const tails = [];
  for (let i = 0; i < 5; i++) {
    const angle = i * 2.39996;
    const tail = addMesh(group, taper, body.material, [Math.cos(angle) * 0.33, -0.33, Math.sin(angle) * 0.26]);
    tail.castShadow = false;
    tails.push(tail);
  }
  const eyes = [];
  for (const x of [-0.22, 0.22]) {
    const eye = addMesh(group, new THREE.SphereGeometry(0.084, 10, 8),
      new THREE.MeshBasicMaterial({ color: "#7A3CFF" }), [x, 0.07, 0.42]);
    eye.scale.set(1.34, 0.45, 0.54);
    eye.rotation.z = Math.sign(x) * 0.26;
    eye.castShadow = false;
    eyes.push(eye);
  }
  const alert = glow(group, "#ffb085", 1.15, 1.0);
  alert.visible = false;
  const streak = glow(group, "#80d5ff", 1.0, 0.03);
  streak.visible = false;
  Object.assign(group.userData, { body, rim, aura, wisps, tails, alert, streak, eyes });
  return group;
}

function makeDrifter() {
  const group = new THREE.Group();
  const ribbon = new THREE.PlaneGeometry(1.8, 0.34, 18, 2);
  const points = ribbon.attributes.position;
  for (let i = 0; i < points.count; i++) {
    const x = points.getX(i);
    points.setY(i, points.getY(i) * (1 - Math.abs(x) * 0.7) + Math.sin(x * 4.5) * 0.23);
    points.setZ(i, Math.cos(x * 4) * 0.18);
  }
  ribbon.computeVertexNormals();
  addMesh(group, ribbon, makeMaterial("#8FA3B8", { side: THREE.DoubleSide, emissive: "#263746", emissiveIntensity: 0.4 }));
  return group;
}

function makeCharm() {
  const group = new THREE.Group();
  addMesh(group, new THREE.OctahedronGeometry(0.42),
    makeMaterial("#C8102E", { emissive: "#7A0A1B", emissiveIntensity: 0.45 }));
  addMesh(group, new THREE.TorusGeometry(0.48, 0.035, 8, 20),
    makeMaterial("#F2C14E"), [0, 0, 0]);
  group.children[1].rotation.x = Math.PI / 2;
  return group;
}

function syncEntities(map, items, builder) {
  const active = new Set(items.map(item => item.id));
  for (const [id, object] of map) {
    if (active.has(id)) continue;
    worldGroup.remove(object);
    disposeTree(object);
    map.delete(id);
  }
  for (const item of items) {
    let object = map.get(item.id);
    if (!object) {
      object = builder(item);
      object.userData.id = item.id;
      map.set(item.id, object);
      worldGroup.add(object);
    }
    object.position.set(item.pos[0], item.pos[1], item.pos[2]);
    object.userData.entity = item;
  }
}

const cameraTarget = new THREE.Vector3();
const cameraOffset = new THREE.Vector3();
const markerPoint = new THREE.Vector3();
let nearestLantern;

function createWindLeaves() {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(42 * 3), 3));
  const leaves = new THREE.Points(geometry, new THREE.PointsMaterial({ color: "#cbbb6d", size: 0.18 }));
  leaves.frustumCulled = false;
  worldGroup.add(leaves);
  return leaves;
}

function updateScene(timestamp, delta) {
  if (!renderer) return;
  if (timestamp - lastShadowFrame >= 1000 / 30) {
    renderer.shadowMap.needsUpdate = true;
    lastShadowFrame = timestamp;
  }
  const time = timestamp / 1000;
  atmosphere.time.value = time;
  if (!game) {
    may.pose({ time, delta, speed: 0, grounded: true, vertical: 0, yaw: Math.PI * 0.97 });
    atmosphere.sky.position.copy(camera.position);
    renderer.render(scene, camera);
    return;
  }
  syncEntities(entityObjects.motes, game.motes, makeMote);
  syncEntities(entityObjects.lanterns, game.lanterns, makeLantern);
  syncEntities(entityObjects.shades, game.shades, makeShade);
  syncEntities(entityObjects.drifters, game.drifters.filter(d => d.state !== "removed"), makeDrifter);
  syncEntities(entityObjects.charms, game.charms.filter(c => c.available), makeCharm);

  for (const object of entityObjects.motes.values()) {
    object.position.y += 0.24 + Math.sin(time * 3.6 + object.position.x) * 0.12;
    object.rotation.y = time * 1.8 + object.position.x;
    if (object.userData.entity.kind === "dropped") object.scale.setScalar(0.82);
  }
  for (const object of entityObjects.lanterns.values()) styleLantern(object, object.userData.entity, time);
  for (const object of entityObjects.shades.values()) {
    const { entity, body, rim, aura, wisps, tails, alert, streak, eyes } = object.userData;
    const accent = settings.accessiblePalette ? "#00B3FF" : "#7A3CFF";
    rim.material.color.set(accent);
    rim.material.emissive.set(accent);
    for (const eye of eyes) eye.material.color.set(accent);
    const stunned = entity.state === "stunned";
    const chasing = entity.state === "chase";
    if (chasing && object.userData.lastState !== "chase") {
      object.userData.alertAt = timestamp;
      const [x, , z] = game.player.pos;
      if (Math.hypot(object.position.x - x, object.position.z - z) < 16) tone(255, 0.16, "triangle");
    }
    object.userData.lastState = entity.state;
    const alertAge = (timestamp - (object.userData.alertAt ?? -Infinity)) / 420;
    alert.visible = chasing && alertAge < 1;
    alert.material.opacity = alert.visible ? (1 - alertAge) ** 2 : 0;
    alert.scale.setScalar(alert.visible ? 0.75 + alertAge * 0.64 : 1);
    streak.visible = entity.pushTicks > 0;
    streak.material.opacity = streak.visible ? 0.78 * entity.pushTicks / 15 : 0;
    streak.scale.set(2.0, 0.69, 1);
    if (streak.visible) {
      const [dx, dz] = entity.pushDirection;
      const matrix = camera.matrixWorld.elements;
      streak.material.rotation = Math.atan2(dx * matrix[4] + dz * matrix[6], dx * matrix[0] + dz * matrix[2]);
      streak.position.z = 0.43;
    }
    const progress = entity.state === "spawning" ? 1 - entity.stateTicksLeft / 30 : 1;
    const phase = time * (stunned ? 1.7 : 5.2) + object.position.x;
    body.material.color.set(stunned ? "#3A3450" : "#120A1A");
    body.material.emissiveIntensity = (stunned ? 0.21 : 0.48) + 0.12 * Math.sin(phase);
    body.scale.y = 1.14 + Math.sin(phase) * 0.10;
    rim.rotation.set(Math.PI / 2 + Math.sin(phase) * 0.12, Math.cos(phase) * 0.13, 0);
    rim.scale.setScalar(0.92 + Math.sin(phase) * 0.12);
    aura.material.opacity = (stunned ? 0.40 : chasing ? 0.78 : 0.56) + Math.sin(phase) * 0.12;
    for (let i = 0; i < wisps.length; i++) {
      const age = (time * 0.71 + i / wisps.length) % 1;
      const angle = phase * 0.54 + i * 2.4;
      const wisp = wisps[i];
      wisp.position.set(Math.cos(angle) * (0.34 + age * 0.60), 0.04 + age * 0.56, Math.sin(angle) * (0.28 + age * 0.44));
      wisp.material.opacity = Math.sin(age * Math.PI) * 0.45;
      wisp.scale.setScalar(0.40 + age * 0.91);
    }
    for (let i = 0; i < tails.length; i++) {
      tails[i].rotation.x = 0.26 + Math.sin(phase + i * 1.6) * 0.36;
      tails[i].rotation.z = Math.cos(phase + i * 2.4) * 0.35;
    }
    object.scale.setScalar(0.32 + 0.68 * progress);
    object.position.y += 0.37 + Math.sin(phase * 0.58) * 0.13;
    const [headingX, headingZ] = entity.heading ?? game.shadeWanderHeading(entity);
    object.rotation.y = Math.atan2(headingX, headingZ);
  }
  for (const object of entityObjects.drifters.values()) object.rotation.y = time * 1.5;
  for (const object of entityObjects.charms.values()) {
    object.position.y += 0.4 + Math.sin(time * 3) * 0.16;
    object.rotation.y = time * 1.2;
  }

  currentPlayerPosition.set(...game.player.pos);
  playerObject.position.copy(currentPlayerPosition);
  if (priorPlayerPosition.distanceToSquared(currentPlayerPosition) < 2) {
    playerObject.position.lerp(priorPlayerPosition, 1 - clamp(accumulator * 60, 0, 1));
  }
  playerObject.visible = !game.invulnTicks || Math.floor(game.simTick / 5) % 2 === 0;
  const state = {
    time, delta: game.state === "paused" ? 0 : delta,
    speed: Math.hypot(game.player.vel[0], game.player.vel[2]),
    grounded: game.player.grounded, vertical: game.player.vel[1],
    dashing: game.dashTicks > 0, charmed: game.charmTicks > 0,
    yaw: (90 - game.player.facing) * Math.PI / 180
  };
  const foot = may.pose(state);
  if (game.state === "playing") updateFootEffects(time, delta, state, foot);
  ambientLight.intensity = game.environmentLight;
  document.documentElement.style.setProperty("--impact", settings.reduceMotion ? 0 : Math.max(0, (hitUntil - timestamp) / 380));
  effects = effects.filter(({ ring, radius, duration, started }) => {
    if (timestamp < started) return true;
    ring.visible = true;
    const progress = clamp((timestamp - started) / duration, 0, 1);
    if (progress === 1) {
      worldGroup.remove(ring);
      disposeTree(ring);
      return false;
    }
    ring.scale.setScalar(0.1 + (radius - 0.1) * (1 - (1 - progress) ** 2));
    ring.material.opacity = (1 - progress) * 0.85;
    return true;
  });
  updateShadeImpacts(timestamp);

  const yaw = cameraYaw * Math.PI / 180;
  cameraTarget.copy(playerObject.position);
  cameraTarget.y += 1.22;
  const distance = game.dashTicks && !settings.reduceMotion ? 10.6 : 9.1;
  cameraOffset.set(-Math.sin(yaw) * distance, 3.55, -Math.cos(yaw) * distance);
  camera.position.lerp(cameraOffset.add(cameraTarget), 1 - Math.exp(-delta * 11));
  camera.lookAt(cameraTarget);
  camera.updateMatrixWorld();
  atmosphere.sky.position.copy(camera.position);

  const arrow = document.querySelector("#direction-arrow");
  arrow.hidden = !nearestLantern;
  if (nearestLantern) {
    const [x, y, z] = nearestLantern.pos;
    markerPoint.set(x, y + 3.2, z).applyMatrix4(camera.matrixWorldInverse);
    const behind = markerPoint.z >= 0;
    markerPoint.applyMatrix4(camera.projectionMatrix);
    const dx = markerPoint.x * innerWidth * 0.5 * (behind ? -1 : 1);
    const dy = -markerPoint.y * innerHeight * 0.5 * (behind ? -1 : 1);
    const offscreen = behind || Math.abs(dx) > innerWidth / 2 - 42 || Math.abs(dy) > innerHeight / 2 - 112;
    const angle = Math.atan2(dy, dx);
    const radius = Math.min(innerWidth, innerHeight) * 0.32;
    arrow.hidden = !offscreen;
    arrow.classList.toggle("offscreen", offscreen);
    arrow.style.left = `${innerWidth / 2 + (offscreen ? Math.cos(angle) * radius : dx)}px`;
    arrow.style.top = `${innerHeight / 2 + (offscreen ? Math.sin(angle) * radius : dy)}px`;
    arrow.style.setProperty("--bearing", `${angle}rad`);
  }

  const warning = game.windWarning;
  const shadeArrow = document.querySelector("#shade-arrow");
  const noticed = shadeNotice && shadeNotice.until >= game.simTick && entityObjects.shades.get(shadeNotice.id);
  shadeArrow.hidden = !noticed;
  if (noticed) {
    markerPoint.copy(noticed.position).applyMatrix4(camera.matrixWorldInverse);
    const behind = markerPoint.z >= 0;
    markerPoint.applyMatrix4(camera.projectionMatrix);
    const dx = markerPoint.x * innerWidth * (behind ? -1 : 1);
    const dy = -markerPoint.y * innerHeight * (behind ? -1 : 1);
    const scale = 1 / Math.max(Math.abs(dx) / (innerWidth * 0.5 - 28),
      Math.abs(dy) / (innerHeight * 0.5 - 76), 0.001);
    shadeArrow.style.left = `${innerWidth / 2 + dx * scale}px`;
    shadeArrow.style.top = `${innerHeight / 2 + dy * scale}px`;
    shadeArrow.style.setProperty("--bearing", `${Math.atan2(dy, dx)}rad`);
  }
  const windLabel = document.querySelector("#wind-label");
  windLabel.hidden = !game.windActive && !warning;
  windLabel.textContent = game.windActive ? "GIÓ MẠNH · GIỮ CHẮC NÓN LÁ" : "LÁ BAY · GIÓ ĐANG ĐẾN";
  if (windLeaves) {
    windLeaves.visible = warning || game.windActive;
    if (windLeaves.visible) {
      const points = windLeaves.geometry.attributes.position;
      const [x, y, z] = game.player.pos;
      const t = game.simTick / 60;
      const heading = THREE.MathUtils.degToRad(game.windDirection);
      for (let i = 0; i < points.count; i++) {
        const along = (i * 3.37 + t * 5) % 24 - 12;
        const across = i * 2.19 % 18 - 9;
        points.setXYZ(i, x + Math.cos(heading) * along - Math.sin(heading) * across,
          y + 0.4 + (i * 0.37 % 4) + Math.sin(t * 4 + i) * 0.3,
          z + Math.sin(heading) * along + Math.cos(heading) * across);
      }
      points.needsUpdate = true;
    }
  }
  renderer.render(scene, camera);
}

function addLighting() {
  const ambient = new THREE.HemisphereLight("#D9E2FF", "#233A3D", 0.7);
  scene.add(ambient);
  ambientLight = ambient;
  const key = new THREE.DirectionalLight("#adc9ff", 2.1);
  key.position.set(-26, 32, 24);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.normalBias = 0.055;
  key.shadow.bias = -0.0002;
  key.shadow.camera.left = -80;
  key.shadow.camera.right = 80;
  key.shadow.camera.top = 80;
  key.shadow.camera.bottom = -80;
  scene.add(key);
  const reflectedLight = new THREE.DirectionalLight("#768fb8", 0.38);
  reflectedLight.position.set(16, 8, -24);
  scene.add(reflectedLight);
}

addLighting();
glowTexture = makeGlowTexture();
turfTexture = makeTurfTexture();
const benchmarkMode = new URLSearchParams(location.search).has("benchmark");
if (!benchmarkMode) buildWorld(1);

function updateHud() {
  if (!game || !["playing", "paused"].includes(game.state)) return;
  document.querySelector("#night-title").textContent = names[night];
  document.querySelector("#flames").textContent = "♥ ".repeat(Math.max(0, game.player.flames));
  const seconds = Math.max(0, Math.ceil(game.timeLeft));
  if (seconds <= 10 && seconds > 0 && seconds !== lastCountdownSecond) {
    lastCountdownSecond = seconds;
    tone(740, 0.16);
  }
  const clock = document.querySelector("#clock");
  clock.textContent = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
  if (settings.accessiblePalette && seconds <= 30) clock.textContent = `⚠ ${clock.textContent}`;
  clock.classList.toggle("urgent", seconds <= 30);
  const lit = game.lanterns.filter(l => l.lit).length;
  const weak = game.lanterns.filter(l => l.lit && !game.isSafeLantern(l));
  const caption = (id, message) => {
    const element = document.querySelector(`#${id}-caption`);
    if (element.textContent !== message) element.textContent = message;
    element.hidden = !message;
  };
  caption("shade", shadeNotice && shadeNotice.until >= game.simTick ? "⚠ Bóng Mực xuất hiện" : "");
  caption("dawn", seconds <= 10 && seconds > 0 ? `⚠ Còn ${seconds} giây tới bình minh` : "");
  caption("fuel", weak.length ? `⚠ Sắp cạn dầu: ${weak.map(l => l.id).join(", ")}` : "");
  document.querySelector("#lantern-count").textContent = `${lit} / ${game.lanterns.length}`;
  document.querySelector("#lantern-progress").value = lit / game.lanterns.length;
  document.querySelector("#dawn-goal").textContent = `Bình minh cần ${game.requiredLights} đèn`;
  document.querySelector("#score").textContent = `${totalScore + game.score} điểm`;
  const bar = document.querySelector("#mote-bar");
  if (bar.childElementCount !== game.capacity) {
    bar.replaceChildren(...Array.from({ length: game.capacity }, () => {
      const cell = document.createElement("span");
      cell.className = "mote-cell";
      return cell;
    }));
  }
  for (let i = 0; i < bar.children.length; i++) bar.children[i].classList.toggle("full", i < game.player.carried);
  document.querySelector("#mote-count").textContent = `${game.player.carried} / ${game.capacity}`;
  const dash = document.querySelector("#dash-status");
  const dashCooldown = game.dashCooldownTicks / 60;
  const charmSeconds = game.charmTicks / 60;
  const pulseCooldown = game.pulseCooldownTicks / 60;
  dash.textContent = charmSeconds > 0 ? "Lướt ∞" : dashCooldown > 0 ? `Lướt · ${dashCooldown.toFixed(1)}s` : "Lướt";
  dash.classList.toggle("cooling", dashCooldown > 0 && charmSeconds === 0);
  const pulse = document.querySelector("#pulse-status");
  pulse.textContent = pulseCooldown > 0 ? `Tỏa sáng · ${pulseCooldown.toFixed(1)}s` : `Tỏa sáng · ${game.tuning.pulse_cost} đom đóm`;
  pulse.classList.toggle("cooling", pulseCooldown > 0 || game.player.carried < game.tuning.pulse_cost);
  nearestLantern = undefined;
  let nearestDistance = Infinity;
  for (const lantern of game.lanterns) {
    if (lantern.lit && game.isSafeLantern(lantern)) continue;
    const [x, , z] = lantern.pos;
    const distance = Math.hypot(x - game.player.pos[0], z - game.player.pos[2]);
    if (distance < nearestDistance || (distance === nearestDistance && lantern.id.localeCompare(nearestLantern.id) < 0)) {
      nearestLantern = lantern;
      nearestDistance = distance;
    }
  }
  const prompt = document.querySelector("#prompt");
  const target = game.interactionLantern();
  prompt.hidden = !target;
  if (target) {
    const interact = keyName(boundKeys("interact")[0]);
    prompt.textContent = target.lit ? `${interact} — Châm dầu (${game.lanternFuel(target)}%)`
      : `${interact} — ${target.everLit ? "Thắp lại" : "Nạp ánh sáng"} (${target.deposited}/${game.lanternCost(target)})`;
  }
  const toast = document.querySelector("#toast");
  toast.hidden = performance.now() > toastUntil;
  toast.textContent = "Một Đèn Lồng Lớn đã sáng!";
}

function fixedStep() {
  if (!game || handledFinish) return;
  if (screens.intro.hidden && screens.menu.hidden && screens.result.hidden && screens.settings.hidden) {
    const wasPaused = game.state === "paused";
    priorPlayerPosition.set(...game.player.pos);
    game.step(readInput());
    playEvents();
    if (game.state === "playing") {
      if (game.windWarning && !windCuePlayed) tone(235, 0.45, "triangle");
      windCuePlayed = game.windWarning;
      if (game.simTick % 90 === 1) {
        const notes = [220, 261.63, 329.63, 293.66, 196, 246.94, 293.66, 261.63];
        tone(notes[Math.floor(game.simTick / 90) % notes.length], 1.25);
      }
    }
    if (game.state === "paused" && !wasPaused) showScreen("pause");
    else if (wasPaused && game.state === "playing") showScreen(null);
    updateHud();
    handleFinishedGame();
  }
}

function frame(timestamp) {
  if (!lastFrameAt) lastFrameAt = timestamp;
  const delta = Math.min(0.25, (timestamp - lastFrameAt) / 1000);
  accumulator += delta;
  lastFrameAt = timestamp;
  const step = 1 / 60;
  while (accumulator >= step) {
    fixedStep();
    accumulator -= step;
  }
  updateScene(timestamp, delta);
  requestAnimationFrame(frame);
}
if (benchmarkMode) {
  window.measureBench = (seed, duration) => {
    if (!renderer) throw new Error("WebGL 2 không khả dụng.");
    showScreen(null);
    return runBenchmark({
      seed, duration, renderer, scene, camera, glow: glowTexture,
      prepare(benchmarkGame) {
        game = benchmarkGame;
        buildWorld(1);
        ambientLight.intensity = game.environmentLight;
        may.pose({ time: 0, delta: 0, speed: 0, grounded: true, vertical: 0, yaw: 0 });
        for (const lantern of game.lanterns) {
          const object = makeLantern();
          object.position.set(...lantern.pos);
          styleLantern(object, lantern, 0);
          object.userData.light.visible = lantern.lit;
          worldGroup.add(object);
        }
        return { group: worldGroup, atmosphere };
      }
    });
  };
} else requestAnimationFrame(frame);
