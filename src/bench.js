import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as sleep } from "node:timers/promises";
import { performance } from "node:perf_hooks";

const started = performance.timeOrigin;
const root = fileURLToPath(new URL("..", import.meta.url));
const options = process.argv.slice(2);
const arg = key => {
  const index = options.indexOf(`--${key}`);
  return index < 0 ? undefined : options[index + 1];
};
const seed = Number(arg("seed"));
const duration = Number(arg("duration"));
const out = arg("out");
if (!Number.isSafeInteger(seed) || !Number.isFinite(duration) || duration <= 0 || !out) {
  console.error("Usage: node src/bench.js --seed 42 --duration 30 --out bench.json");
  process.exit(2);
}
const candidates = process.platform === "win32"
  ? ["C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"]
  : process.platform === "darwin" ? ["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"]
    : ["/usr/bin/google-chrome", "/usr/bin/chromium", "/usr/bin/chromium-browser"];
const browserPath = process.env.BENCH_BROWSER ?? candidates.find(candidate => fs.existsSync(candidate));
if (!browserPath) {
  console.error("Cần Chrome/Chromium. Đặt BENCH_BROWSER thành đường dẫn trình duyệt nếu cần.");
  process.exit(1);
}
const profile = fs.mkdtempSync(path.join(os.tmpdir(), "dao-den-long-bench-"));
let browser;
let socket;
const server = spawn(process.execPath, ["src/server.js"], {
  cwd: root, env: { ...process.env, PORT: "0", BIND_HOST: "127.0.0.1" }, stdio: ["ignore", "pipe", "inherit"]
});
function serverUrl() {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.once("exit", code => reject(new Error(`Server exited (${code})`)));
    server.stdout.on("data", data => {
      const match = data.toString().match(/http:\/\/localhost:\d+/);
      if (match) resolve(match[0].replace("localhost", "127.0.0.1"));
    });
  });
}

async function connect(url) {
  const deadline = Date.now() + 12000;
  let port, target;
  do {
    try {
      port = Number(fs.readFileSync(path.join(profile, "DevToolsActivePort"), "utf8").split(/\r?\n/)[0]);
      const reply = await fetch(`http://127.0.0.1:${port}/json/list`);
      target = (await reply.json()).find(page => page.type === "page" && page.url.startsWith(url));
    } catch {
      await sleep(90);
    }
  } while (!target && Date.now() < deadline);
  if (!target) throw new Error("Chrome không mở được cổng đo WebGL.");
  socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", reject, { once: true });
  });
}

let messageId = 0;
function call(method, params = {}, timeout = 12000) {
  return new Promise((resolve, reject) => {
    const id = ++messageId;
    const finished = (error, result) => {
      socket.removeEventListener("message", listener);
      clearTimeout(timer);
      if (error) reject(error);
      else resolve(result);
    };
    const listener = event => {
      const message = JSON.parse(event.data);
      if (message.id === id) finished(message.error && new Error(message.error.message), message.result);
    };
    const timer = setTimeout(() => finished(new Error(`Chrome timeout: ${method}`)), timeout);
    socket.addEventListener("message", listener);
    socket.send(JSON.stringify({ id, method, params }));
  });
}

try {
  const url = await serverUrl();
  const pageUrl = `${url}/?benchmark=1`;
  const headless = process.env.BENCH_HEADLESS === "1";
  browser = spawn(browserPath, [
    "--no-first-run", "--disable-background-timer-throttling", "--disable-renderer-backgrounding",
    "--disable-backgrounding-occluded-windows", "--disable-gpu-vsync", "--disable-frame-rate-limit",
    "--enable-unsafe-swiftshader", "--window-size=1280,720", "--remote-debugging-port=0", `--user-data-dir=${profile}`,
    ...(headless ? ["--headless"] : []), `--app=${pageUrl}`
  ], { stdio: "ignore", windowsHide: headless });
  browser.on("error", error => console.error(error.message));
  await connect(pageUrl);
  await call("Emulation.setDeviceMetricsOverride", { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
  let ready = false;
  const readyBy = Date.now() + 10000;
  while (!ready && Date.now() < readyBy) {
    try {
      const response = await call("Runtime.evaluate", { expression: 'typeof window.measureBench === "function"' });
      ready = response.result.value;
    } catch {
      // Navigation can discard the previous execution context.
    }
    if (!ready) await sleep(100);
  }
  if (!ready) throw new Error("Trang benchmark chưa sẵn sàng.");
  const result = await call("Runtime.evaluate", {
    expression: `window.measureBench(${seed},${duration})`,
    awaitPromise: true, returnByValue: true
  }, Math.max(35000, (duration + 55) * 1000));
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description ?? "Lỗi benchmark trong trình duyệt.");
  const { firstFrame, samples, gpu } = result.result.value;
  const sorted = samples.slice().sort((a, b) => a - b);
  const frames = sorted.length;
  if (!frames) throw new Error("Benchmark không nhận được khung hình trong khoảng đo.");
  const slowest = sorted.slice(-Math.max(1, Math.ceil(frames * 0.01)));
  const mean = values => values.reduce((sum, value) => sum + value, 0) / values.length;
  const round = value => Number(value.toFixed(2));
  const report = {
    contract_version: "1.3", avg_fps: round(1000 / mean(sorted)), p1_low_fps: round(1000 / mean(slowest)),
    frame_ms_p95: round(sorted[Math.ceil(frames * 0.95) - 1]), frames,
    load_ms: Math.max(0, Math.round(firstFrame - started)), peak_mem_mb: null, vsync_off: false,
    renderer: `Three.js r180 / WebGL 2 / ${gpu}`, os: `${os.type()} ${os.release()} ${os.arch()}`
  };
  fs.writeFileSync(out, JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify(report));
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  socket?.close();
  browser?.kill();
  server.kill();
}
