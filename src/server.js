import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const port = Number(process.env.PORT || 4173);
const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json" };

http.createServer((req, res) => {
  const urlPath = req.url === "/" ? "/index.html" : req.url.split("?")[0];
  const publicRoot = path.resolve(root, "public");
  const srcRoot = path.resolve(root, "src");
  const base = urlPath.startsWith("/src/") ? srcRoot : publicRoot;
  const relativePath = urlPath.startsWith("/src/")
    ? urlPath.slice("/src/".length)
    : urlPath.replace(/^\/+/, "");
  const file = path.resolve(base, relativePath);
  if (!file.startsWith(base)) {
    res.writeHead(403).end("Forbidden");
    return;
  }
  fs.readFile(file, (error, data) => {
    if (error) { res.writeHead(404).end("Not found"); return; }
    res.writeHead(200, { "Content-Type": types[path.extname(file)] || "application/octet-stream" });
    res.end(data);
  });
}).listen(port, "0.0.0.0", () => console.log(`Đảo Đèn Lồng: http://localhost:${port}`));
