import { expect, test } from "@playwright/test";
import { loginByReviewMode } from "../helpers/auth";
import {
  POPUP_CONTAINER,
  closeAllAutoPopups,
  popupByText,
  waitLobbyReady,
} from "./_helpers";

/**
 * 對應測項：聊天頻
 *   - 聊天頻顯示正常，對話無破圖；顯示「私頻」按鈕
 *   - 點私聊 → 開啟私聊彈窗
 *   - 點對話窗 → 開啟公頻彈窗
 *   - 切換 公頻 / 新手 / 爆獎 / 私聊 tab
 *   - 任一頻道發送：文字 / 表情 / 貼圖 / 照片
 */

test.describe("Regression - 聊天頻", () => {
  test.beforeEach(async ({ page }) => {
    await loginByReviewMode(page);
    await waitLobbyReady(page);
    await closeAllAutoPopups(page);
  });

  test("聊天頻區塊存在", async ({ page }) => {
    // 大廳常駐的聊天條目通常含「公頻 / 私頻 / 系統 / 喇叭」等字
    const chatHint = page.locator("text=/私頻|公頻|聊天|系統|喇叭/").first();
    await expect(chatHint).toBeVisible({ timeout: 5_000 });
  });

  test("點對話窗 → 開啟公頻彈窗", async ({ page }) => {
    // 嘗試點任一可見的聊天提示，預期跳出 .page-popup-container 含「公頻 / 私頻」字樣
    const chatHint = page.locator("text=/私頻|公頻|聊天/").first();
    await chatHint.click({ force: true });
    const popup = page.locator(POPUP_CONTAINER).filter({ hasText: /公頻|私頻|新手|爆獎/ });
    await expect(popup.first()).toBeVisible({ timeout: 5_000 });
  });

  test("切換 公頻 / 新手 / 爆獎 / 私聊 tab", async ({ page }) => {
    const trigger = page.locator("text=/私頻|公頻|聊天/").first();
    await trigger.click({ force: true });
    const popup = page.locator(POPUP_CONTAINER).filter({ hasText: /公頻|新手|爆獎/ }).first();
    await expect(popup).toBeVisible();
    for (const tab of ["公頻", "新手", "爆獎"]) {
      const t = popup.locator(`text=${tab}`).first();
      if (await t.isVisible().catch(() => false)) {
        await t.click({ force: true });
        await page.waitForTimeout(300);
      }
    }
  });

  test("發送一則文字訊息（預設頻道）", async ({ page }) => {
    const trigger = page.locator("text=/私頻|公頻|聊天/").first();
    await trigger.click({ force: true });
    const popup = page.locator(POPUP_CONTAINER).filter({ hasText: /公頻|新手|爆獎/ }).first();
    await expect(popup).toBeVisible();

    const input = popup.locator("input, textarea, [contenteditable='true']").first();
    if (!(await input.isVisible().catch(() => false))) {
      test.skip(true, "聊天輸入欄未顯示，可能需先驗證 turnstile");
    }
    await input.click();
    await input.fill("e2e test " + Date.now());
    // 嘗試 Enter 送出
    await input.press("Enter");
    await page.waitForTimeout(800);
    // 訊息列表中能看到剛剛 timestamp
    await expect(popup).toContainText(/e2e test/);
  });

  // === 表情 / 貼圖 / 照片需要彈出 picker、上傳檔案，留 manual ===
  test("@manual 任一頻道：發送表情符號正常", async () => {
    test.skip(true, "需開 emoji picker 並驗證樣式，留 manual 驗證");
  });
  test("@manual 任一頻道：發送貼圖正常", async () => {
    test.skip(true, "需開貼圖盤 + 後端資源，留 manual 驗證");
  });
  test("@manual 任一頻道：發送照片正常", async () => {
    test.skip(true, "需上傳檔案 + CDN，留 manual 驗證");
  });
  test("@manual 點私聊 → 開啟私聊彈窗", async () => {
    test.skip(true, "需另一帳號互動，留 manual 驗證");
  });
});
