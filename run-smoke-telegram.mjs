import { spawn } from "node:child_process";
import process from "node:process";
import fs from "node:fs/promises";
import "dotenv/config";

const reportJsonPath =
  process.env.PLAYWRIGHT_JSON_REPORT ?? "test-results/results.json";
const TG_MESSAGE_LIMIT = 3500;
const FAILED_LIST_MAX = 30;

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

async function readFailedSpecs(jsonPath) {
  try {
    const raw = await fs.readFile(jsonPath, "utf8");
    const report = JSON.parse(raw);
    const failed = [];

    const walk = (suites, fileName, parentTitles) => {
      for (const suite of suites ?? []) {
        const isTopLevel = !fileName;
        const currentFile = isTopLevel
          ? suite.file || suite.title || ""
          : fileName;
        const currentParents = isTopLevel
          ? []
          : [...parentTitles, suite.title].filter(Boolean);

        for (const spec of suite.specs ?? []) {
          if (spec.ok === false) {
            const titlePath = [...currentParents, spec.title]
              .filter(Boolean)
              .join(" › ");
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
    console.error(
      `讀取 Playwright JSON 報告失敗 (${jsonPath}):`,
      error.message
    );
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
    // 不存在就忽略
  }
}

function truncateMessage(text, limit = TG_MESSAGE_LIMIT) {
  if (text.length <= limit) return text;
  return text.slice(0, limit - 20) + "\n…(訊息已截斷)";
}

async function sendTelegramMessage(text) {
  const token = process.env.TG_BOT_TOKEN;
  const chatId = process.env.TG_CHAT_ID;

  if (!token || !chatId) {
    console.warn(
      "Skip Telegram notify: TG_BOT_TOKEN or TG_CHAT_ID is missing."
    );
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
    process.env.SMOKE_COMMAND ??
    "npx playwright test tests/smoke --grep-invert @manual";
  const startedAt = new Date();
  await clearReport(reportJsonPath);
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

  if (exitCode !== 0) {
    const failed = await readFailedSpecs(reportJsonPath);
    const failedBlock = formatFailedSpecs(failed);
    if (failedBlock) lines.push("", failedBlock);
  }

  try {
    await sendTelegramMessage(truncateMessage(lines.join("\n")));
  } catch (error) {
    console.error(error);
  }

  process.exit(exitCode);
}

await main();
