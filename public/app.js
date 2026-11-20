import * as THREE from "/vendor/three.module.js";
import { createGame } from "/src/game.js";
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
  world.appendChild(renderer.domElement);
} catch (error) {
  world.textContent = `Không khởi tạo được WebGL: ${error.message}`;
}
const pointerTarget = renderer ? renderer.domElement : world;
const hud = document.querySelector("#hud");
const screens = Object.fromEntries(["menu", "intro", "pause", "result", "settings"]
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
let handledFinish = false;
let paused = false;
let lastCountdownSecond;
let windLeaves;
let cameraYaw = 0;
let dragging = false;
let lastPointerX = 0;
let toastUntil = 0;
let previousScreen = "menu";
let accumulator = 0;
let lastFrameAt = 0;
let audioContext = null;
let ambientNodes = [];
let worldGroup = new THREE.Group();
let entityObjects = { motes: new Map(), lanterns: new Map(), shades: new Map(), drifters: new Map(), charms: new Map() };
let playerObject;
let ambientLight;
let atmosphere;
let glowTexture;
let turfTexture;
let effects = [];
let hitUntil = 0;

let settings = { volume: 0.35, sensitivity: 1 };
try {
  settings = { ...settings, ...JSON.parse(localStorage.getItem("dao-den-long-settings") || "{}") };
} catch (error) {
  console.warn("Không đọc được cài đặt đã lưu:", error);
}
document.querySelector("#volume").value = settings.volume;
document.querySelector("#sensitivity").value = settings.sensitivity;

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
  hud.hidden = !game || !game.state === "playing";
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
      emitRing(game.player.pos, "#a3dbff", game.tuning.pulse_radius, 500);
    }
    else if (event.name === "player_hit") {
      tone(110, 0.24, "square");
      hitUntil = performance.now() + 380;
    }
    else if (event.name === "deposit") tone(620, 0.16);
    else if (event.name === "dash") tone(460, 0.1, "triangle");
    else if (event.name === "jump") tone(340, 0.1);
    else if (event.name === "shade_spawned") tone(150, 0.25);
  }
}

function showIntro(which) {
  night = which;
  document.querySelector("#intro-kicker").textContent = `HÀNH TRÌNH · ${which}/1`;
  document.querySelector("#intro-title").textContent = names[which];
  document.querySelector("#intro-story").textContent = stories[which];
  showScreen("intro");
}

function beginNight() {
  startAudio();
  game = createGame((Date.now() ^ (night * 271)) >>> 0, {}, {}, night);
  buildWorld(night);
  cameraYaw = 0;
  handledFinish = false;
  paused = false;
  lastCountdownSecond = undefined;
  accumulator = 0;
  hitUntil = toastUntil = 0;
  document.querySelector("#night-title").textContent = names[night];
  showScreen(null);
  updateHud();
}

function handleFinishedGame() {
  if (handledFinish || !game || !["won", "lost"].includes(game.state)) return;
  handledFinish = true;
  const won = game.state === "won";
  if (won) totalScore += game.score;
  document.querySelector("#result-kicker").textContent = won ? `ĐÃ THẮP SÁNG · ${night}/1` : "ĐÊM NAY CHƯA KẾT THÚC";
  document.querySelector("#result-title").textContent = won ? (night === 3 ? "Bình Minh" : "Đêm đã sáng") : "Sương đen phủ kín";
  document.querySelector("#result-copy").textContent = won
    ? `Điểm đêm này: ${game.score} · Tổng điểm: ${totalScore}`
    : `Điểm đêm này: ${game.score} · Có thể thử lại đêm ${night}.`;
  const action = document.querySelector("#result-action");
  action.textContent = "Ch?i l?i ??m";
  action.onclick = () => { totalScore = 0; beginNight(); };
  showScreen("result");
  if (won) tone(660, 0.5, "triangle");
  else tone(95, 0.55, "sawtooth");
}

function settingsChanged() {
  settings.volume = Number(document.querySelector("#volume").value);
  settings.sensitivity = Number(document.querySelector("#sensitivity").value);
  localStorage.setItem("dao-den-long-settings", JSON.stringify(settings));
  if (audioContext) {
    for (const node of ambientNodes) node.master.gain.setTargetAtTime(settings.volume, audioContext.currentTime, 0.08);
  }
}

document.querySelector("#begin").addEventListener("click", () => { totalScore = 0; showIntro(1); });
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
document.querySelector("#close-settings").addEventListener("click", () => showScreen(previousScreen));
document.querySelector("#volume").addEventListener("input", settingsChanged);
document.querySelector("#sensitivity").addEventListener("input", settingsChanged);

addEventListener("keydown", event => {
  if (event.target instanceof HTMLInputElement || (event.target instanceof HTMLButtonElement && event.key === " ")) return;
  const key = event.key.toLowerCase();
  if ([" ", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(key)) event.preventDefault();
  keys.add(key);
  if (!event.repeat && (key === "escape" || key === "p") && screens.settings.hidden
    && game && ["playing", "paused"].includes(game.state)) {
    pending.pause = true;
  }
  if (key === "r" && game && ["won", "lost"].includes(game.state)) beginNight();
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
  let x = 0, z = 0;
  if (keys.has("a") || keys.has("arrowleft")) x -= 1;
  if (keys.has("d") || keys.has("arrowright")) x += 1;
  if (keys.has("w") || keys.has("arrowup")) z += 1;
  if (keys.has("s") || keys.has("arrowdown")) z -= 1;
  const input = {
    move: [x, z], cam_yaw_deg: cameraYaw,
    jump: keys.has(" "), dash: keys.has("shift"),
    interact: keys.has("e"), pulse: keys.has("f"),
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

function emitRing(position, color, radius, duration) {
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.9, 1, 64),
    new THREE.MeshBasicMaterial({
      color, transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending
    }));
  ring.position.set(position[0], position[1] + 0.065, position[2]);
  ring.rotation.x = -Math.PI / 2;
  worldGroup.add(ring);
  effects.push({ ring, radius, duration, started: performance.now() });
}

function addIsland(cx, cz, radius) {
  addMesh(worldGroup, new THREE.CylinderGeometry(radius, radius * 0.975, 1.2, 96),
    makeMaterial("#C9B48A", { flatShading: true }), [cx, -0.63, cz]);
  const turf = addMesh(worldGroup, new THREE.CylinderGeometry(radius, radius, 0.12, 96),
    makeMaterial(atmosphere.turf, { map: turfTexture }), [cx, -0.06, cz]);
  turf.castShadow = false;
  const shore = new THREE.Mesh(new THREE.RingGeometry(radius - 0.75, radius, 128),
    new THREE.MeshBasicMaterial({ color: "#8ca8a3", transparent: true, opacity: 0.36, depthWrite: false }));
  shore.position.set(cx, 0.008, cz);
  shore.rotation.x = -Math.PI / 2;
  worldGroup.add(shore);
  dressIsland(worldGroup, cx, cz, radius);
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
    for (const x of [-1.9, 1.9]) {
      addMesh(worldGroup, new THREE.BoxGeometry(0.23, 4.2, 0.25),
        makeMaterial("#71544a"), [x, 8.1, 0]);
    }
    addMesh(worldGroup, new THREE.ConeGeometry(3, 1.5, 4),
      makeMaterial("#37415d", { metalness: 0.28 }), [0, 10.55, 0]).rotation.y = Math.PI / 4;
    addMesh(worldGroup, new THREE.CylinderGeometry(0.42, 0.95, 1.25, 16),
      makeMaterial("#c59c61", { metalness: 0.65 }), [0, 8.9, 0]);
    for (const angle of [30, 150]) {
      const ramp = addMesh(worldGroup, new THREE.BoxGeometry(6.5, 0.22, 3),
        makeMaterial("#C9B48A"), [Math.cos(angle * Math.PI / 180) * 27, 1.5, Math.sin(angle * Math.PI / 180) * 27]);
      ramp.rotation.y = -angle * Math.PI / 180;
      ramp.rotation.z = -Math.atan(0.5);
    }
  }
  for (const pad of game?.map.pads ?? []) addLaunchPad(...pad.pos);
  windLeaves = which === 3 ? createWindLeaves() : null;
  playerObject = createPlayerMesh();
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
  }
}

function createPlayerMesh() {
  const group = new THREE.Group();
  addMesh(group, new THREE.CylinderGeometry(0.28, 0.49, 0.94, 12),
    makeMaterial("#E8E2D0"), [0, 0.82, 0]);
  addMesh(group, new THREE.CylinderGeometry(0.35, 0.38, 0.13, 12),
    makeMaterial("#C8102E"), [0, 0.77, 0]);
  const boots = [-0.18, 0.18].map(x => addMesh(group, new THREE.BoxGeometry(0.23, 0.35, 0.34),
    makeMaterial("#352536"), [x, 0.22, 0.05]));
  group.userData.boots = boots;
  addMesh(group, new THREE.SphereGeometry(0.26, 16, 12),
    makeMaterial("#E8B99A"), [0, 1.42, 0]);
  addMesh(group, new THREE.ConeGeometry(0.64, 0.39, 18),
    makeMaterial("#cf9562"), [0, 1.76, 0]);
  addMesh(group, new THREE.CylinderGeometry(0.61, 0.64, 0.05, 18),
    makeMaterial("#743c39"), [0, 1.55, 0]);
  const lamp = addMesh(group, new THREE.SphereGeometry(0.13, 12, 10),
    makeMaterial("#FFE58A", { emissive: "#FFE58A", emissiveIntensity: 1.5 }), [0.36, 1.12, 0.18]);
  const lampLight = new THREE.PointLight("#ffbf73", 7, 7);
  lampLight.position.copy(lamp.position);
  group.add(lampLight);
  glow(group, "#ffb861", 1.4, lamp.position.y, lamp.position.x, lamp.position.z);
  worldGroup.add(group);
  return group;
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
  Object.assign(group.userData, { light, body, core, halo: glow(group, "#FFB347", 4.8, 2.05) });
  return group;
}

function styleLantern(object, lantern, time) {
  const { light, body, core, halo } = object.userData;
  const charge = lantern.lit ? 1 : lantern.deposited / game.tuning.lantern_cost;
  light.intensity = charge * (27 + Math.sin(time * 4 + object.position.x) * 2);
  body.material.emissiveIntensity = 0.025 + charge * 1.25;
  body.material.color.set(lantern.lit ? "#FFB347" : "#5B5F6E");
  core.visible = lantern.lit;
  halo.material.opacity = 0.12 + charge * 0.78;
  halo.material.color.set(lantern.lit || charge > 0 ? "#ff9d42" : "#89b6ff");
}

function makeShade() {
  const group = new THREE.Group();
  const body = addMesh(group, new THREE.IcosahedronGeometry(0.68, 1),
    makeMaterial("#120A1A", { emissive: "#241035", emissiveIntensity: 0.35 }));
  const rim = addMesh(group, new THREE.TorusGeometry(0.67, 0.06, 8, 24),
    makeMaterial("#7A3CFF", { emissive: "#7A3CFF", emissiveIntensity: 0.45 }), [0, -0.22, 0]);
  rim.rotation.x = Math.PI / 2;
  glow(group, "#a353ff", 2.9, -0.1);
  for (const x of [-0.22, 0.22]) {
    addMesh(group, new THREE.SphereGeometry(0.085, 8, 6),
      new THREE.MeshBasicMaterial({ color: "#e3c5ff" }), [x, 0.06, 0.59]);
  }
  group.userData.body = body;
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
  const time = timestamp / 1000;
  atmosphere.time.value = time;
  if (!game) {
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
    const stunned = object.userData.entity.state === "stunned";
    object.userData.body.material.color.set(stunned ? "#3A3450" : "#120A1A");
    object.position.y += 0.2 + Math.sin(time * 3 + object.position.x) * 0.14;
    object.rotation.y = Math.atan2(game.player.pos[0] - object.position.x, game.player.pos[2] - object.position.z);
  }
  for (const object of entityObjects.drifters.values()) object.rotation.y = time * 1.5;
  for (const object of entityObjects.charms.values()) {
    object.position.y += 0.4 + Math.sin(time * 3) * 0.16;
    object.rotation.y = time * 1.2;
  }

  playerObject.position.set(...game.player.pos);
  playerObject.rotation.y = (90 - game.player.facing) * Math.PI / 180;
  playerObject.visible = !game.invulnTicks || Math.floor(game.simTick / 5) % 2 === 0;
  const stride = Math.sin(game.simTick * 0.46) * Math.min(0.55, Math.hypot(game.player.vel[0], game.player.vel[2]) * 0.095);
  playerObject.userData.boots[0].rotation.x = stride;
  playerObject.userData.boots[1].rotation.x = -stride;
  ambientLight.intensity = game.environmentLight;
  document.documentElement.style.setProperty("--impact", Math.max(0, (hitUntil - timestamp) / 380));
  effects = effects.filter(({ ring, radius, duration, started }) => {
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

  const yaw = cameraYaw * Math.PI / 180;
  cameraTarget.set(game.player.pos[0], game.player.pos[1] + 1.35, game.player.pos[2]);
  const distance = game.dashTicks ? 12.6 : 11.5;
  cameraOffset.set(Math.sin(yaw) * distance, 4.5, -Math.cos(yaw) * distance);
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
}

addLighting();
glowTexture = makeGlowTexture();
turfTexture = makeTurfTexture();
buildWorld(1);

function updateHud() {
  if (!game || game.state !== "playing") return;
  document.querySelector("#night-title").textContent = names[night];
  document.querySelector("#flames").textContent = "♥ ".repeat(Math.max(0, game.player.flames));
  const seconds = Math.max(0, Math.ceil(game.timeLeft));
  if (seconds <= 10 && seconds > 0 && seconds !== lastCountdownSecond) {
    lastCountdownSecond = seconds;
    tone(740, 0.16);
  }
  const clock = document.querySelector("#clock");
  clock.textContent = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
  clock.classList.toggle("urgent", seconds <= 30);
  const lit = game.lanterns.filter(l => l.lit).length;
  document.querySelector("#lantern-count").textContent = `${lit} / ${game.lanterns.length}`;
  document.querySelector("#lantern-progress").value = lit / game.lanterns.length;
  document.querySelector("#score").textContent = `${totalScore + game.score} điểm`;
  const bar = document.querySelector("#mote-bar");
  if (bar.childElementCount !== game.tuning.carry_capacity) {
    bar.replaceChildren(...Array.from({ length: game.tuning.carry_capacity }, () => {
      const cell = document.createElement("span");
      cell.className = "mote-cell";
      return cell;
    }));
  }
  for (let i = 0; i < bar.children.length; i++) bar.children[i].classList.toggle("full", i < game.player.carried);
  document.querySelector("#mote-count").textContent = `${game.player.carried} / ${game.tuning.carry_capacity}`;
  const pulseCooldown = game.pulseCooldownTicks / 60;
  const pulse = document.querySelector("#pulse-status");
  pulse.textContent = pulseCooldown > 0 ? `Tỏa sáng · ${pulseCooldown.toFixed(1)}s` : `Tỏa sáng · ${game.tuning.pulse_cost} đom đóm`;
  pulse.classList.toggle("cooling", pulseCooldown > 0 || game.player.carried < game.tuning.pulse_cost);
  nearestLantern = undefined;
  let nearestDistance = Infinity;
  for (const lantern of game.lanterns) {
    if (lantern.lit) continue;
    const [x, , z] = lantern.pos;
    const distance = Math.hypot(x - game.player.pos[0], z - game.player.pos[2]);
    if (distance < nearestDistance || (distance === nearestDistance && lantern.id.localeCompare(nearestLantern.id) < 0)) {
      nearestLantern = lantern;
      nearestDistance = distance;
    }
  }
  const prompt = document.querySelector("#prompt");
  prompt.hidden = nearestDistance > game.tuning.interact_radius;
  if (!prompt.hidden) {
    prompt.textContent = `E — Nạp ánh sáng (${game.player.carried}/${game.tuning.lantern_cost})`;
  }
  const toast = document.querySelector("#toast");
  toast.hidden = performance.now() > toastUntil;
  toast.textContent = "Một Đèn Lồng Lớn đã sáng!";
}

function fixedStep() {
  if (!game || handledFinish) return;
  if (screens.intro.hidden && screens.menu.hidden && screens.result.hidden && screens.settings.hidden) {
    const input = readInput();
    if (input.pause) {
      paused = !paused;
      showScreen(paused ? "pause" : null);
    }
    if (paused) return;
    game.step(input);
    playEvents();
    if (game.state === "playing") {
      if (game.simTick % 90 === 1) {
        const notes = [220, 261.63, 329.63, 293.66, 196, 246.94, 293.66, 261.63];
        tone(notes[Math.floor(game.simTick / 90) % notes.length], 1.25);
      }
    }
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
requestAnimationFrame(frame);
