import { spawn } from "node:child_process";
import process from "node:process";
import "dotenv/config";

function runCommand(command) {
  return new Promise((resolve) => {
    const child = spawn(command, {
      shell: true,
      stdio: "inherit",
      env: process.env,
    });
    child.on("close", (code) => resolve(code ?? 1));
    child.on("error", () => resolve(1));
  });
}

async function sendTelegramMessage(text) {
  const token = process.env.TG_BOT_TOKEN;
  const chatId = process.env.TG_CHAT_ID;

  if (!token || !chatId) {
    console.warn("Skip Telegram notify: TG_BOT_TOKEN or TG_CHAT_ID is missing.");
    return;
  }

  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  const payload = {
    chat_id: chatId,
    text,
  };

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Telegram notify failed: ${response.status} ${body}`);
  }
}

async function main() {
  const command =
    process.env.SMOKE_COMMAND ?? "npx playwright test tests/smoke --grep-invert @manual";
  const startedAt = new Date();
  const exitCode = await runCommand(command);
  const finishedAt = new Date();
  const durationSec = Math.round((finishedAt - startedAt) / 1000);
  const baseUrl = process.env.BASE_URL ?? "N/A";
  const statusText = exitCode === 0 ? "PASS" : "FAIL";
  const statusEmoji = exitCode === 0 ? "✅" : "❌";

  const lines = [
    `${statusEmoji} Smoke Test ${statusText}`,
    `Command: ${command}`,
    `Base URL: ${baseUrl}`,
    `Duration: ${durationSec}s`,
    `At: ${finishedAt.toISOString()}`,
  ];

  if (process.env.PLAYWRIGHT_REPORT_URL) {
    lines.push(`Report: ${process.env.PLAYWRIGHT_REPORT_URL}`);
  }

  try {
    await sendTelegramMessage(lines.join("\n"));
  } catch (error) {
    console.error(error);
  }

  process.exit(exitCode);
}

await main();
