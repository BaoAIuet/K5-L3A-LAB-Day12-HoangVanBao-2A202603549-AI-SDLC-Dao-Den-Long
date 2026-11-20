import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { leaderboard, saveScore } from "./leaderboard.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const port = Number(process.env.PORT || 4173);
const args = process.argv.slice(2);
if (args[0] === "--export-leaderboard") {
  if (args.length !== 2 || !args[1]) {
    console.error("Usage: node src/server.js --export-leaderboard out.json");
    process.exit(2);
  }
  fs.writeFileSync(args[1], JSON.stringify(leaderboard(), null, 2) + "\n");
  process.exit(0);
}
const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json" };

async function handleLeaderboard(req, res) {
  try {
    let data;
    if (req.method === "GET") data = leaderboard();
    else if (req.method === "POST") {
      if (req.headers["content-type"] !== "application/json") return res.writeHead(415).end();
      let body = "";
      for await (const chunk of req) {
        body += chunk.toString();
        if (body.length > 4096) return res.writeHead(413).end();
      }
      const input = JSON.parse(body);
      if (!input || typeof input !== "object") throw new RangeError("Điểm không hợp lệ.");
      data = saveScore(input);
    } else return res.writeHead(405).end();
    res.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store" }).end(JSON.stringify(data));
  } catch (error) {
    const invalid = error instanceof RangeError || error instanceof SyntaxError;
    res.writeHead(invalid ? 400 : 500, { "Content-Type": "application/json" })
      .end(JSON.stringify({ error: invalid ? error.message : "Không đọc hoặc ghi được bảng xếp hạng." }));
  }
}

const server = http.createServer((req, res) => {
  const requestPath = req.url.split("?")[0];
  if (requestPath === "/api/leaderboard") return void handleLeaderboard(req, res);
  const urlPath = requestPath === "/" ? "/index.html" : requestPath;
  const publicRoot = path.resolve(root, "public");
  const srcRoot = path.resolve(root, "src");
  const vendorRoot = path.resolve(root, "node_modules", "three", "build");
  const base = urlPath.startsWith("/src/") ? srcRoot
    : urlPath.startsWith("/vendor/") ? vendorRoot : publicRoot;
  const relativePath = urlPath.startsWith("/src/") ? urlPath.slice("/src/".length)
    : urlPath.startsWith("/vendor/") ? urlPath.slice("/vendor/".length)
      : urlPath.replace(/^\/+/, "");
  const file = path.resolve(base, relativePath);
  if (!file.startsWith(base + path.sep)) {
    res.writeHead(403).end("Forbidden");
    return;
  }
  fs.readFile(file, (error, data) => {
    if (error) { res.writeHead(404).end("Not found"); return; }
    res.writeHead(200, { "Content-Type": types[path.extname(file)] || "application/octet-stream" });
    res.end(data);
  });
});
server.listen(port, process.env.BIND_HOST || "127.0.0.1", () => console.log(`Đảo Đèn Lồng: http://localhost:${server.address().port}`));
