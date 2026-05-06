import { test as setup } from "@playwright/test";
import { loginByReviewMode } from "../helpers/auth";
import { closeAllAutoPopups, waitLobbyReady } from "./_helpers";

/**
 * Regression 專用的一次性登入。
 * 透過 playwright.config.js 內的 `setup-regression` project 執行，
 * 把登入後的 cookies / localStorage 存到 STORAGE_STATE，
 * 後面所有 regression spec 直接載入這份 storageState，不再呼叫登入 API
 * （避免遊戲後端「重複登入會踢掉前一個 session」的問題）。
 *
 * 大廳會連續跳多個蓋板廣告 / 彈窗，這裡在存 storageState 之前先全部關掉 ——
 * 有些站台關閉時會寫 localStorage 標記（如「今日不再顯示」），這樣後續所有
 * regression spec 就能少碰到一些彈窗。但每次 page.goto('/') 仍可能跳新的，
 * 所以各 spec 的 beforeEach 也都會再呼叫一次 closeAllAutoPopups。
 */
export const STORAGE_STATE = "playwright/.auth/user.json";

setup("一次性登入並保存 storage state", async ({ page }) => {
  await loginByReviewMode(page);
  await waitLobbyReady(page);
  await closeAllAutoPopups(page);
  await page.context().storageState({ path: STORAGE_STATE });
});
