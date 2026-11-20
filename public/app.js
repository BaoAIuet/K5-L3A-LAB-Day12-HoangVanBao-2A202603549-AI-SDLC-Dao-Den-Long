import * as THREE from "/vendor/three.module.js";
import { createGame } from "/src/game.js";

const world = document.querySelector("#world");
const scene = new THREE.Scene();
scene.background = new THREE.Color("#0E1430");
scene.fog = new THREE.Fog("#0E1430", 65, 180);
const camera = new THREE.PerspectiveCamera(54, 1, 0.1, 300);
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
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
let countdownPlayed = false;
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
let lanternLights = [];
let windLeaves;

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
    else if (event.name === "lantern_lit") { tone(520, 0.35, "triangle"); toastUntil = performance.now() + 1400; }
    else if (event.name === "pulse") tone(190, 0.25, "sawtooth");
    else if (event.name === "player_hit") tone(110, 0.24, "square");
    else if (event.name === "dash") tone(460, 0.1, "triangle");
    else if (event.name === "jump") tone(340, 0.1);
    else if (event.name === "shade_spawned") tone(150, 0.25);
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
  buildWorld(night);
  game = createGame((Date.now() ^ (night * 271)) >>> 0, {}, {}, night);
  cameraYaw = 0;
  handledFinish = false;
  countdownPlayed = false;
  accumulator = 0;
  document.querySelector("#night-title").textContent = names[night];
  showScreen(null);
}

function handleFinishedGame() {
  if (handledFinish || !game || !["won", "lost"].includes(game.state)) return;
  handledFinish = true;
  const won = game.state === "won";
  if (won) totalScore += game.score;
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
    action.onclick = () => { totalScore = 0; showIntro(1); };
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
  localStorage.setItem("dao-den-long-settings", JSON.stringify(settings));
  if (audioContext) {
    for (const node of ambientNodes) node.master.gain.setTargetAtTime(settings.volume, audioContext.currentTime, 0.08);
  }
}

document.querySelector("#begin").addEventListener("click", () => { totalScore = 0; showIntro(1); });
document.querySelector("#play-night").addEventListener("click", beginNight);
document.querySelector("#resume").addEventListener("click", () => { pending.pause = true; showScreen(null); });
document.querySelector("#replay").addEventListener("click", beginNight);
document.querySelector("#to-menu").addEventListener("click", () => { game = null; showScreen("menu"); });
document.querySelector("#result-menu").addEventListener("click", () => { game = null; showScreen("menu"); });
document.querySelector("#open-settings").addEventListener("click", () => { previousScreen = "menu"; showScreen("settings"); });
document.querySelector("#pause-settings").addEventListener("click", () => { previousScreen = "pause"; showScreen("settings"); });
document.querySelector("#close-settings").addEventListener("click", () => showScreen(previousScreen));
document.querySelector("#volume").addEventListener("input", settingsChanged);
document.querySelector("#sensitivity").addEventListener("input", settingsChanged);

addEventListener("keydown", event => {
  const key = event.key.toLowerCase();
  if ([" ", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(key)) event.preventDefault();
  keys.add(key);
  if ((key === "escape" || key === "p") && game && ["playing", "paused"].includes(game.state)) {
    pending.pause = true;
  }
  if (key === "r" && game && ["won", "lost"].includes(game.state)) beginNight();
});
addEventListener("keyup", event => keys.delete(event.key.toLowerCase()));
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

const v3 = p => new THREE.Vector3(p[0], p[1], p[2]);
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
    if (!child.isMesh) return;
    child.geometry.dispose();
    if (Array.isArray(child.material)) child.material.forEach(material => material.dispose());
    else child.material.dispose();
  });
}

function addIsland(cx, cz, radius, label, surface = "#2F5D50", top = 0) {
  const sand = addMesh(worldGroup, new THREE.CylinderGeometry(radius + 0.6, radius + 1, 0.8, 64),
    makeMaterial("#C9B48A"), [cx, top - 0.42, cz]);
  sand.receiveShadow = true;
  addMesh(worldGroup, new THREE.CylinderGeometry(radius, radius, 0.16, 64),
    makeMaterial(surface), [cx, top - 0.08, cz]);
  const labelCanvas = document.createElement("canvas");
  labelCanvas.width = 512;
  labelCanvas.height = 96;
  const labelContext = labelCanvas.getContext("2d");
  labelContext.fillStyle = "#F5F1E6";
  labelContext.font = "bold 42px system-ui";
  labelContext.textAlign = "center";
  labelContext.fillText(label, 256, 58);
  const texture = new THREE.CanvasTexture(labelCanvas);
  const tag = addMesh(worldGroup, new THREE.PlaneGeometry(10, 1.8),
    new THREE.MeshBasicMaterial({ map: texture, transparent: true, side: THREE.DoubleSide }),
    [cx, top + 0.15, cz - radius * 0.35]);
  tag.rotation.x = -Math.PI / 2;
  tag.castShadow = false;
}

function buildWorld(which) {
  if (worldGroup.parent) {
    scene.remove(worldGroup);
    disposeTree(worldGroup);
  }
  worldGroup = new THREE.Group();
  scene.add(worldGroup);
  camera.position.set(0, 20, 52);
  camera.lookAt(0, 0, 0);
  for (const group of Object.values(entityObjects)) {
    for (const object of group.values()) {
      worldGroup.remove(object);
      disposeTree(object);
    }
  }
  entityObjects = { motes: new Map(), lanterns: new Map(), shades: new Map(), drifters: new Map(), charms: new Map() };
  lanternLights = [];

  const sea = addMesh(worldGroup, new THREE.PlaneGeometry(500, 500),
    makeMaterial("#12384A", { roughness: 0.94 }), [0, -1.05, 0]);
  sea.rotation.x = -Math.PI / 2;
  sea.castShadow = false;
  if (which === 1) {
    addIsland(0, 0, 40, "ĐẢO BẾN");
  } else if (which === 2) {
    addIsland(0, 0, 28, "ĐẢO CAU · A");
    addIsland(70, 0, 28, "ĐẢO CAU · B");
    addMesh(worldGroup, new THREE.BoxGeometry(18, 0.45, 4), makeMaterial("#6B4A2F"), [35, 0.1, 0]);
    for (const [x, z] of [[20, 18], [50, -18]]) {
      addMesh(worldGroup, new THREE.CylinderGeometry(1, 1.25, 0.25, 20),
        makeMaterial("#F2C14E", { emissive: "#8A5E13", emissiveIntensity: 0.4 }), [x, 0.16, z]);
    }
  } else {
    addIsland(0, 0, 45, "ĐẢO CHUÔNG");
    const ring = addMesh(worldGroup, new THREE.RingGeometry(12, 24, 64),
      makeMaterial("#477264", { side: THREE.DoubleSide }), [0, 3, 0]);
    ring.rotation.x = -Math.PI / 2;
    const upper = addMesh(worldGroup, new THREE.CircleGeometry(8, 48),
      makeMaterial("#668677", { side: THREE.DoubleSide }), [0, 6, 0]);
    upper.rotation.x = -Math.PI / 2;
    addMesh(worldGroup, new THREE.CylinderGeometry(2, 2.4, 8, 24),
      makeMaterial("#6B4A2F"), [0, 10, 0]);
    for (const angle of [30, 150]) {
      const ramp = addMesh(worldGroup, new THREE.BoxGeometry(6.5, 0.22, 3),
        makeMaterial("#C9B48A"), [Math.cos(angle * Math.PI / 180) * 27, 1.5, Math.sin(angle * Math.PI / 180) * 27]);
      ramp.rotation.y = -angle * Math.PI / 180;
      ramp.rotation.z = -Math.atan(0.5);
    }
    addMesh(worldGroup, new THREE.CylinderGeometry(1, 1.25, 0.25, 20),
      makeMaterial("#F2C14E", { emissive: "#8A5E13", emissiveIntensity: 0.4 }), [0, 3.16, 13]);
  }

  const points = [];
  for (let i = 0; i < 180; i++) {
    const angle = i * 2.399;
    const radius = 65 + (i % 7) * 13;
    points.push(Math.cos(angle) * radius, 18 + (i % 5) * 6, Math.sin(angle) * radius);
  }
  const starGeometry = new THREE.BufferGeometry();
  starGeometry.setAttribute("position", new THREE.Float32BufferAttribute(points, 3));
  addMesh(worldGroup, starGeometry, new THREE.PointsMaterial({ color: "#DCE6FF", size: 0.36, sizeAttenuation: true }));
  playerObject = createPlayerMesh();
}

function createPlayerMesh() {
  const group = new THREE.Group();
  addMesh(group, new THREE.CylinderGeometry(0.28, 0.38, 0.9, 12),
    makeMaterial("#E8E2D0"), [0, 0.78, 0]);
  addMesh(group, new THREE.SphereGeometry(0.26, 16, 12),
    makeMaterial("#E8B99A"), [0, 1.42, 0]);
  addMesh(group, new THREE.ConeGeometry(0.62, 0.42, 20),
    makeMaterial("#C8102E"), [0, 1.78, 0]);
  const lamp = addMesh(group, new THREE.SphereGeometry(0.13, 12, 10),
    makeMaterial("#FFE58A", { emissive: "#FFE58A", emissiveIntensity: 1.5 }), [0.36, 1.12, 0.18]);
  const lampLight = new THREE.PointLight("#FFE58A", 1.1, 4);
  lampLight.position.copy(lamp.position);
  group.add(lampLight);
  worldGroup.add(group);
  return group;
}

function makeMote() {
  const group = new THREE.Group();
  addMesh(group, new THREE.SphereGeometry(0.16, 12, 10),
    makeMaterial("#FFF6C2", { emissive: "#FFE58A", emissiveIntensity: 1.7 }));
  const light = new THREE.PointLight("#FFE58A", 0.6, 3);
  light.position.y = 0.15;
  group.add(light);
  return group;
}

function makeLantern() {
  const group = new THREE.Group();
  addMesh(group, new THREE.CylinderGeometry(0.07, 0.09, 2.2, 8), makeMaterial("#6B4A2F"), [0, 1.1, 0]);
  addMesh(group, new THREE.BoxGeometry(0.7, 0.85, 0.55),
    makeMaterial("#FFB347", { emissive: "#FFB347", emissiveIntensity: 0.05 }), [0, 2.1, 0]);
  addMesh(group, new THREE.SphereGeometry(0.19, 12, 10),
    makeMaterial("#FFE9B0", { emissive: "#FFE9B0", emissiveIntensity: 0.15 }), [0, 2.1, 0]);
  const light = new THREE.PointLight("#FFB347", 0.05, 13);
  light.position.y = 2.3;
  group.add(light);
  group.userData.light = light;
  lanternLights.push(light);
  return group;
}

function makeShade() {
  const group = new THREE.Group();
  const body = addMesh(group, new THREE.IcosahedronGeometry(0.68, 1),
    makeMaterial("#120A1A", { emissive: "#241035", emissiveIntensity: 0.35 }));
  const rim = addMesh(group, new THREE.TorusGeometry(0.67, 0.06, 8, 24),
    makeMaterial("#7A3CFF", { emissive: "#7A3CFF", emissiveIntensity: 0.45 }), [0, -0.22, 0]);
  rim.rotation.x = Math.PI / 2;
  group.userData.body = body;
  return group;
}

function makeDrifter() {
  const group = new THREE.Group();
  addMesh(group, new THREE.TorusKnotGeometry(0.42, 0.11, 48, 8, 2, 3),
    makeMaterial("#8FA3B8", { emissive: "#263746", emissiveIntensity: 0.4 }));
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

function updateScene() {
  if (!renderer) return;
  if (!game) {
    renderer.render(scene, camera);
    return;
  }
  syncEntities(entityObjects.motes, game.motes, makeMote);
  syncEntities(entityObjects.lanterns, game.lanterns, makeLantern);
  syncEntities(entityObjects.shades, game.shades, makeShade);
  syncEntities(entityObjects.drifters, game.drifters.filter(d => d.state !== "removed"), makeDrifter);
  syncEntities(entityObjects.charms, game.charms.filter(c => c.available), makeCharm);

  for (const object of entityObjects.motes.values()) {
    object.position.y += 0.18 + Math.sin(performance.now() / 280 + object.position.x) * 0.12;
    if (object.userData.entity.kind === "dropped") object.scale.setScalar(0.82);
  }
  for (const [id, object] of entityObjects.lanterns) {
    const lantern = game.lanterns.find(item => item.id === id);
    const lit = lantern && lantern.lit;
    object.userData.light.intensity = lit ? 2.4 : 0.08;
    object.userData.light.distance = lit ? 16 : 3;
    const body = object.children[1].material;
    body.emissiveIntensity = lit ? 1.2 : 0.03;
    if (lit) body.color.set("#FFB347");
    else body.color.set("#5B5F6E");
  }
  for (const object of entityObjects.shades.values()) {
    const stunned = object.userData.entity.state === "stunned";
    object.userData.body.material.color.set(stunned ? "#3A3450" : "#120A1A");
    object.rotation.y += 0.008;
  }
  for (const object of entityObjects.drifters.values()) object.rotation.y += 0.025;
  for (const object of entityObjects.charms.values()) object.rotation.y += 0.02;

  playerObject.position.copy(v3(game.player.pos));
  playerObject.rotation.y = (90 - game.player.facing) * Math.PI / 180;
  playerObject.visible = !game.invulnTicks || Math.floor(game.simTick / 5) % 2 === 0;
  ambientLight.intensity = 0.25 + game.environmentLight * 1.2;

  const yaw = cameraYaw * Math.PI / 180;
  const target = new THREE.Vector3(game.player.pos[0], game.player.pos[1] + 1.1, game.player.pos[2]);
  const cameraOffset = new THREE.Vector3(Math.sin(yaw) * 14, 7.5, -Math.cos(yaw) * 14);
  camera.position.lerp(target.clone().add(cameraOffset), 0.16);
  camera.lookAt(target);

  const unlit = game.lanterns.filter(l => !l.lit).sort((a, b) => {
    const da = Math.hypot(a.pos[0] - game.player.pos[0], a.pos[2] - game.player.pos[2]);
    const db = Math.hypot(b.pos[0] - game.player.pos[0], b.pos[2] - game.player.pos[2]);
    return da - db || a.id.localeCompare(b.id);
  })[0];
  const arrow = document.querySelector("#direction-arrow");
  if (unlit) {
    const projected = new THREE.Vector3(unlit.pos[0], unlit.pos[1] + 1, unlit.pos[2]).project(camera);
    const sx = (projected.x * 0.5 + 0.5) * innerWidth;
    const sy = (-projected.y * 0.5 + 0.5) * innerHeight;
    const offscreen = projected.z < 0 || sx < 35 || sx > innerWidth - 35 || sy < 55 || sy > innerHeight - 55;
    arrow.hidden = !offscreen;
    if (offscreen) {
      const angle = Math.atan2(sy - innerHeight / 2, sx - innerWidth / 2);
      const radius = Math.min(innerWidth, innerHeight) * 0.38;
      arrow.style.left = `${clamp(innerWidth / 2 + Math.cos(angle) * radius, 25, innerWidth - 25)}px`;
      arrow.style.top = `${clamp(innerHeight / 2 + Math.sin(angle) * radius, 55, innerHeight - 55)}px`;
      arrow.style.transform = `translate(-50%, -50%) rotate(${angle}rad)`;
    }
  } else {
    arrow.hidden = true;
  }

  const phase = game.simTick % 1800;
  const warning = night === 3 && !game.windActive && (phase < 120 || phase > 1680);
  const windLabel = document.querySelector("#wind-label");
  windLabel.hidden = !game.windActive && !warning;
  windLabel.textContent = game.windActive ? "GIÓ MẠNH · GIỮ CHẮC NÓN LÁ" : "LÁ BAY · GIÓ ĐANG ĐẾN";
  renderer.render(scene, camera);
}

function addStarField() {
  const ambient = new THREE.HemisphereLight("#D9E2FF", "#233A3D", 0.7);
  scene.add(ambient);
  ambientLight = ambient;
  const key = new THREE.DirectionalLight("#FFE9B0", 2);
  key.position.set(-20, 35, -10);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.left = -80;
  key.shadow.camera.right = 80;
  key.shadow.camera.top = 80;
  key.shadow.camera.bottom = -80;
  scene.add(key);
}

addStarField();
buildWorld(1);

function updateHud() {
  if (!game || !["playing", "paused"].includes(game.state)) return;
  document.querySelector("#night-title").textContent = names[night];
  document.querySelector("#flames").textContent = "♥ ".repeat(Math.max(0, game.player.flames));
  const seconds = Math.max(0, Math.ceil(game.timeLeft));
  if (seconds === 10 && !countdownPlayed) {
    countdownPlayed = true;
    tone(740, 0.16);
  }
  const clock = document.querySelector("#clock");
  clock.textContent = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
  clock.classList.toggle("urgent", seconds <= 30);
  document.querySelector("#lantern-count").textContent = `Đèn ${game.lanterns.filter(l => l.lit).length}/${game.lanterns.length}`;
  document.querySelector("#score").textContent = `${totalScore + game.score} điểm`;
  const bar = document.querySelector("#mote-bar");
  bar.replaceChildren(...Array.from({ length: 10 }, (_, i) => {
    const cell = document.createElement("span");
    cell.className = `mote-cell${i < game.player.carried ? " full" : ""}`;
    return cell;
  }));
  const dash = document.querySelector("#dash-status");
  const dashCooldown = game.dashCooldownTicks / 60;
  const charmSeconds = game.charmTicks / 60;
  const pulseCooldown = game.pulseCooldownTicks / 60;
  dash.textContent = charmSeconds > 0 ? "Lướt ∞" : `Lướt ${dashCooldown.toFixed(1)}s`;
  dash.classList.toggle("cooling", dashCooldown > 0 && charmSeconds === 0);
  const pulse = document.querySelector("#pulse-status");
  pulse.textContent = `Tỏa sáng ${pulseCooldown.toFixed(1)}s`;
  pulse.classList.toggle("cooling", pulseCooldown > 0);
  const nearest = game.lanterns.filter(l => !l.lit).sort((a, b) => {
    const da = Math.hypot(a.pos[0] - game.player.pos[0], a.pos[2] - game.player.pos[2]);
    const db = Math.hypot(b.pos[0] - game.player.pos[0], b.pos[2] - game.player.pos[2]);
    return da - db || a.id.localeCompare(b.id);
  })[0];
  const close = nearest && Math.hypot(nearest.pos[0] - game.player.pos[0], nearest.pos[2] - game.player.pos[2]) <= 2;
  document.querySelector("#prompt").textContent = close ? `E — Nạp ánh sáng (${game.player.carried}/10)` : "";
  const toast = document.querySelector("#toast");
  toast.hidden = performance.now() > toastUntil;
  toast.textContent = "Một Đèn Lồng Lớn đã sáng!";
}

function fixedStep() {
  if (!game || handledFinish) return;
  if (screens.intro.hidden && screens.menu.hidden && screens.result.hidden && screens.settings.hidden) {
    const wasPaused = game.state === "paused";
    game.step(readInput());
    playEvents();
    if (game.state === "paused" && !wasPaused) showScreen("pause");
    else if (wasPaused && game.state === "playing") showScreen(null);
    updateHud();
    handleFinishedGame();
  }
}

function frame(timestamp) {
  if (!lastFrameAt) lastFrameAt = timestamp;
  accumulator += Math.min(0.25, (timestamp - lastFrameAt) / 1000);
  lastFrameAt = timestamp;
  const step = 1 / 60;
  while (accumulator >= step) {
    fixedStep();
    accumulator -= step;
  }
  updateScene();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
