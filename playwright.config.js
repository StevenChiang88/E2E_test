require("dotenv").config({ quiet: true });
const { defineConfig, devices } = require("@playwright/test");

const baseURL = process.env.BASE_URL || "http://localhost:3000";
const STORAGE_STATE = "playwright/.auth/user.json";

module.exports = defineConfig({
  testDir: "./tests",
  timeout: 30_000,
  expect: {
    timeout: 5_000,
  },
  // 預設仍開檔案間平行
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  // regression 需要單一 session，本機跑也固定 1 worker，避免 cookie 被多開連線觸發踢線
  workers: 1,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    // ── Regression：先跑一次性登入 → 共用 storageState ──────────────────────
    {
      name: "setup-regression",
      testMatch: /regression\/auth\.setup\.ts/,
    },
    {
      name: "chromium-regression",
      testMatch: /regression\/.*\.spec\.ts/,
      dependencies: ["setup-regression"],
      // regression 強制序列：避免多 spec 同時開分頁，被遊戲後端視為多重連線而踢線
      fullyParallel: false,
      use: {
        ...devices["Desktop Chrome"],
        storageState: STORAGE_STATE,
      },
    },

    // ── 其他（smoke / features）維持既有行為，自行處理登入 ──────────────────
    {
      name: "chromium",
      testMatch: /(smoke|features)\/.*\.spec\.ts/,
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
