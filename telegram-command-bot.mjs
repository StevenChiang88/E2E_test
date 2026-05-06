import { spawn } from "node:child_process";
import process from "node:process";
import fs from "node:fs/promises";
import "dotenv/config";

const token = process.env.TG_BOT_TOKEN;
const allowedChatId = process.env.TG_CHAT_ID;
const pollTimeoutSec = Number(process.env.TG_POLL_TIMEOUT_SEC ?? 30);
const pollIntervalMs = Number(process.env.TG_POLL_INTERVAL_MS ?? 1000);
const offsetFile = process.env.TG_OFFSET_FILE ?? ".telegram-bot-offset.json";

const commandMap = {
  smoke: "npx playwright test tests/smoke --grep-invert @manual",
  features: "npx playwright test tests/features --grep-invert @manual",
  regression: "npx playwright test tests/regression --grep-invert @manual",
  all: "npx playwright test --grep-invert @manual",
};

let isRunning = false;

function ensureEnv() {
  if (!token || !allowedChatId) {
    throw new Error("TG_BOT_TOKEN 或 TG_CHAT_ID 未設定，無法啟動 Telegram 指令機器人。");
  }
}

async function readOffset() {
  try {
    const raw = await fs.readFile(offsetFile, "utf8");
    const parsed = JSON.parse(raw);
    return Number(parsed.update_id ?? 0);
  } catch {
    return 0;
  }
}

async function writeOffset(updateId) {
  await fs.writeFile(offsetFile, JSON.stringify({ update_id: updateId }, null, 2));
}

async function tgApi(method, payload) {
  const url = `https://api.telegram.org/bot${token}/${method}`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const body = await response.json();
  if (!body.ok) {
    throw new Error(`${method} failed: ${JSON.stringify(body)}`);
  }
  return body.result;
}

async function sendMessage(chatId, text) {
  await tgApi("sendMessage", { chat_id: chatId, text });
}

function runCommand(command) {
  return new Promise((resolve) => {
    const startedAt = Date.now();
    const child = spawn(command, {
      shell: true,
      env: process.env,
      stdio: "inherit",
    });
    child.on("close", (code) => {
      const seconds = Math.round((Date.now() - startedAt) / 1000);
      resolve({ code: code ?? 1, seconds, command });
    });
    child.on("error", () => {
      const seconds = Math.round((Date.now() - startedAt) / 1000);
      resolve({ code: 1, seconds, command });
    });
  });
}

function parseRunTarget(text) {
  const trimmed = text.trim();
  if (!trimmed.startsWith("/run")) return null;
  const [, target] = trimmed.split(/\s+/, 2);
  return target?.toLowerCase();
}

async function handleMessage(message) {
  const chatId = String(message.chat?.id ?? "");
  if (chatId !== String(allowedChatId)) return;

  const text = message.text?.trim() ?? "";
  if (!text) return;

  if (text === "/start" || text === "/help") {
    await sendMessage(
      chatId,
      [
        "可用指令：",
        "/run smoke",
        "/run features",
        "/run regression",
        "/run all",
        "/status",
      ].join("\n")
    );
    return;
  }

  if (text === "/status") {
    await sendMessage(chatId, isRunning ? "目前有測試正在執行中。" : "目前閒置中。");
    return;
  }

  const target = parseRunTarget(text);
  if (!target) return;

  const command = commandMap[target];
  if (!command) {
    await sendMessage(chatId, `未知目標：${target}\n請用 /help 看可用指令。`);
    return;
  }

  if (isRunning) {
    await sendMessage(chatId, "已有測試執行中，請稍後再試。");
    return;
  }

  isRunning = true;
  await sendMessage(chatId, `開始執行：${target}`);

  try {
    const result = await runCommand(command);
    const emoji = result.code === 0 ? "✅" : "❌";
    const status = result.code === 0 ? "PASS" : "FAIL";
    await sendMessage(
      chatId,
      `${emoji} ${target} ${status}\nCommand: ${result.command}\nDuration: ${result.seconds}s`
    );
  } finally {
    isRunning = false;
  }
}

async function pollLoop() {
  let offset = await readOffset();
  while (true) {
    try {
      const updates = await tgApi("getUpdates", {
        offset: offset + 1,
        timeout: pollTimeoutSec,
      });

      for (const update of updates) {
        offset = update.update_id;
        await writeOffset(offset);
        if (update.message) {
          await handleMessage(update.message);
        }
      }
    } catch (error) {
      console.error("Telegram poll error:", error);
      await new Promise((r) => setTimeout(r, pollIntervalMs));
    }
  }
}

ensureEnv();
console.log("Telegram command bot started.");
await pollLoop();
