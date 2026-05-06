import { spawn } from "node:child_process";
import process from "node:process";
import fs from "node:fs/promises";
import "dotenv/config";

const token = process.env.TG_BOT_TOKEN;
const allowedChatId = process.env.TG_CHAT_ID;
const pollTimeoutSec = Number(process.env.TG_POLL_TIMEOUT_SEC ?? 30);
const pollIntervalMs = Number(process.env.TG_POLL_INTERVAL_MS ?? 1000);
const offsetFile = process.env.TG_OFFSET_FILE ?? ".telegram-bot-offset.json";
const reportJsonPath = process.env.PLAYWRIGHT_JSON_REPORT ?? "test-results/results.json";
const TG_MESSAGE_LIMIT = 3500; // 留 buffer，Telegram 上限 4096
const FAILED_LIST_MAX = 30;

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

async function readFailedSpecs(jsonPath) {
  try {
    const raw = await fs.readFile(jsonPath, "utf8");
    const report = JSON.parse(raw);
    const failed = [];

    const walk = (suites, fileName, parentTitles) => {
      for (const suite of suites ?? []) {
        const isTopLevel = !fileName;
        const currentFile = isTopLevel ? suite.file || suite.title || "" : fileName;
        const currentParents = isTopLevel
          ? []
          : [...parentTitles, suite.title].filter(Boolean);

        for (const spec of suite.specs ?? []) {
          if (spec.ok === false) {
            const titlePath = [...currentParents, spec.title].filter(Boolean).join(" › ");
            failed.push({ file: currentFile, title: titlePath });
          }
        }

        if (suite.suites?.length) {
          walk(suite.suites, currentFile, currentParents);
        }
      }
    };

    walk(report.suites ?? [], "", []);
    return failed;
  } catch (error) {
    console.error(`讀取 Playwright JSON 報告失敗 (${jsonPath}):`, error.message);
    return [];
  }
}

function formatFailedSpecs(failed) {
  if (failed.length === 0) return "";
  const shown = failed.slice(0, FAILED_LIST_MAX);
  const lines = [`Failed (${failed.length}):`];
  for (const item of shown) {
    const file = item.file ? `${item.file}: ` : "";
    lines.push(`• ${file}${item.title}`);
  }
  if (failed.length > shown.length) {
    lines.push(`…還有 ${failed.length - shown.length} 個未列出`);
  }
  return lines.join("\n");
}

async function clearReport(jsonPath) {
  try {
    await fs.unlink(jsonPath);
  } catch {
    // 檔案不存在或無法刪除都忽略
  }
}

function truncateMessage(text, limit = TG_MESSAGE_LIMIT) {
  if (text.length <= limit) return text;
  return text.slice(0, limit - 20) + "\n…(訊息已截斷)";
}

function parseRunTarget(text) {
  const trimmed = text.trim();
  if (!trimmed.startsWith("/")) return null;
  // 取出 /xxx 或 /xxx@botname 的 xxx 部分
  const [head] = trimmed.split(/\s+/, 1);
  const name = head.slice(1).split("@", 1)[0].toLowerCase();
  return name || null;
}

async function handleMessage(message) {
  const chatId = String(message.chat?.id ?? "");
  if (chatId !== String(allowedChatId)) return;

  const text = message.text?.trim() ?? "";
  if (!text) return;

  const target = parseRunTarget(text);
  if (!target) return;

  if (target === "start" || target === "help") {
    await sendMessage(
      chatId,
      [
        "可用指令：",
        "/smoke",
        "/features",
        "/regression",
        "/all",
        "/status",
      ].join("\n")
    );
    return;
  }

  if (target === "status") {
    await sendMessage(chatId, isRunning ? "目前有測試正在執行中。" : "目前閒置中。");
    return;
  }

  const command = commandMap[target];
  if (!command) {
    await sendMessage(chatId, `未知指令：/${target}\n請用 /help 看可用指令。`);
    return;
  }

  if (isRunning) {
    await sendMessage(chatId, "已有測試執行中，請稍後再試。");
    return;
  }

  isRunning = true;
  await sendMessage(chatId, `開始執行：${target}`);

  try {
    await clearReport(reportJsonPath);
    const result = await runCommand(command);
    const emoji = result.code === 0 ? "✅" : "❌";
    const status = result.code === 0 ? "PASS" : "FAIL";

    const lines = [
      `${emoji} ${target} ${status}`,
      `Command: ${result.command}`,
      `Duration: ${result.seconds}s`,
    ];

    if (result.code !== 0) {
      const failed = await readFailedSpecs(reportJsonPath);
      const failedBlock = formatFailedSpecs(failed);
      if (failedBlock) lines.push("", failedBlock);
    }

    await sendMessage(chatId, truncateMessage(lines.join("\n")));
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
