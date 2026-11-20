import fs from "node:fs";
import path from "node:path";

const defaultFile = path.resolve(process.env.LEADERBOARD_FILE || "data/leaderboard.json");
const order = (a, b) => b.score - a.score || Date.parse(a.achieved_at) - Date.parse(b.achieved_at);

export function leaderboard(file = defaultFile) {
  try {
    return { entries: JSON.parse(fs.readFileSync(file, "utf8")).entries.sort(order).slice(0, 10) };
  } catch (error) {
    if (error.code === "ENOENT") return { entries: [] };
    throw error;
  }
}

export function saveScore(input, file = defaultFile) {
  const { name, score, nights_won, seed } = input;
  if (typeof name !== "string" || !/^[A-Za-z0-9_]{3,12}$/.test(name) || !Number.isSafeInteger(score) || score < 0
    || !Number.isInteger(nights_won) || nights_won < 0 || nights_won > 3 || !Number.isSafeInteger(seed)) {
    throw new RangeError("Tên phải có 3–12 ký tự A–Z, 0–9 hoặc dấu gạch dưới. Điểm không hợp lệ.");
  }
  const entries = leaderboard(file).entries;
  entries.push({ name, score, nights_won, seed, achieved_at: new Date().toISOString() });
  const data = { entries: entries.sort(order).slice(0, 10) };
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, JSON.stringify(data, null, 2) + "\n");
  fs.renameSync(temporary, file);
  return data;
}
