import { spawn } from "node:child_process";
import process from "node:process";
import "dotenv/config";

const intervalMinutes = Number(process.env.SMOKE_SCHEDULE_MINUTES ?? 30);
const command = process.env.SMOKE_SCHEDULE_COMMAND ?? "npm run test:smoke:notify";
let running = false;

function runCommand(commandText) {
  return new Promise((resolve) => {
    const child = spawn(commandText, {
      shell: true,
      stdio: "inherit",
      env: process.env,
    });
    child.on("close", (code) => resolve(code ?? 1));
    child.on("error", () => resolve(1));
  });
}

async function runOnce(trigger) {
  if (running) {
    console.log(`[scheduler] Skip (${trigger}), previous run still executing.`);
    return;
  }
  running = true;
  const startedAt = new Date();
  console.log(`[scheduler] Start (${trigger}) at ${startedAt.toISOString()}`);
  const code = await runCommand(command);
  const endedAt = new Date();
  console.log(`[scheduler] End with code ${code} at ${endedAt.toISOString()}`);
  running = false;
}

if (!Number.isFinite(intervalMinutes) || intervalMinutes <= 0) {
  throw new Error("SMOKE_SCHEDULE_MINUTES 必須是正數。");
}

const intervalMs = intervalMinutes * 60 * 1000;
console.log(
  `[scheduler] Running command every ${intervalMinutes} minutes: ${command}`
);

await runOnce("startup");
setInterval(() => {
  void runOnce("interval");
}, intervalMs);
