import { createGame } from "/src/game.js";

const canvas = document.querySelector("#game");
const ctx = canvas.getContext("2d");
const status = document.querySelector("#status");
const overlay = document.querySelector("#overlay");
const result = document.querySelector("#result");
const keys = new Set();
let yaw = 0;
let game = createGame(Date.now() & 0xffff, {}, {});

function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = innerWidth * dpr;
  canvas.height = innerHeight * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
window.addEventListener("resize", resize);
resize();

addEventListener("keydown", event => {
  keys.add(event.key.toLowerCase());
  if (event.key.toLower() === "r") restart();
});
addEventListener("keyup", event => keys.delete(event.key.toLowerCase()));
canvas.addEventListener("pointerdown", event => {
  yaw = (yaw + (event.clientX < innerWidth / 2 ? -30 : 30)) % 360;
});
document.querySelector("#restart").addEventListener("click", restart);

function restart() {
  game = createGame(Date.now() & 0xffff, {}, {});
  overlay.hidden = true;
  yaw = 0;
}

function project(pos) {
  const dx = pos[0] - game.player.pos[0];
  const dz = pos[2] - game.player.pos[2];
  const theta = yaw * Math.PI / 180;
  const rx = dx * Math.cos(theta) - dz * Math.sin(theta);
  const rz = dx * Math.sin(theta) + dz * Math.cos(theta);
  const scale = 520 / (rz + 32);
  return [canvas.clientWidth / 2 + rx * scale, canvas.clientHeight * 0.66 - pos[1] * scale - rz * 1.5];
}

function drawCircle(pos, radius, fill, outline = "") {
  const [x, y] = project(pos);
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
  if (outline) { ctx.strokeStyle = outline; ctx.stroke(); }
}

function draw() {
  ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);
  ctx.fillStyle = "#09071a";
  ctx.fillRect(0, 0, canvas.clientWidth, canvas.clientHeight);

  ctx.beginPath();
  ctx.ellipse(canvas.clientWidth / 2, canvas.clientHeight * 0.68, 280, 150, 0, 0, Math.PI * 2);
  ctx.fillStyle = "#233a3d";
  ctx.fill();
  ctx.strokeStyle = "#77b39b";
  ctx.stroke();

  for (const mote of game.motes) drawCircle(mote.pos, 5, "#ffe66d", "#fff9bc");
  for (const lantern of game.lanterns) {
    const color = lantern.lit ? "#ffd36a" : "#8a7561";
    drawCircle(lantern.pos, lantern.lit ? 13 : 9, color, lantern.lit ? "#fff2a6" : "");
  }
  for (const shade of game.shades) drawCircle(shade.pos, 10, shade.state === "stunned" ? "#9a8cae" : "#241a3c", "#d28cff");
  drawCircle(game.player.pos, 12, "#f0b79b", "#ffe0ba");

  status.textContent = `Ánh sáng: ${game.player.flames} · Mang: ${game.player.carried} · Điểm: ${game.score} · Thời gian: ${Math.ceil(game.timeLeft)}`;
  if (game.state !== "playing") {
    overlay.hidden = false;
    result.textContent = game.state === "won" ? "Bạn đã thắp sáng đảo!" : "Đêm đã nuốt mất đảo";
  }
}

let previousPulse = false;
let previousInteract = false;
function frame() {
  if (game.state === "playing") {
    let mx = 0, mz = 0;
    if (keys.has("w") || keys.has("arrowup")) mz = 1;
    if (keys.has("s") || keys.has("arrowdown")) mz = -1;
    if (keys.has("a") || keys.has("arrowleft")) mx = -1;
    if (keys.has("d") || keys.has("arrowright")) mx = 1;
    const interact = keys.has("e");
    const pulse = keys.has(" ");
    game.step({ move: [mx, mz], cam_yaw_deg: yaw, interact, pulse });
    previousInteract = interact;
    previousPulse = pulse;
  }
  draw();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
