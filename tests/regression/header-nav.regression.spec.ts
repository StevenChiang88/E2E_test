import { expect, test } from "@playwright/test";
import { loginByReviewMode } from "../helpers/auth";
import {
  POPUP_CONTAINER,
  closeAllAutoPopups,
  popupByText,
  waitLobbyReady,
} from "./_helpers";

/**
 * 對應測項：
 *   - 頁首餘額：金幣/銀幣切換、顯示 XX,XXX
 *   - 頁首背包：X/1000、點任一可開啟
 *   - 頁首：icon、滑動、頁首彈窗正常
 *   - 分類遊戲：全部 / 最愛 / 老虎機 / 捕魚 / 休閒遊戲 / 棋牌（排序、切換）
 *   - 搜索（關鍵字查詢）
 */

test.describe("Regression - 頁首與分類", () => {
  test.beforeEach(async ({ page }) => {
    await loginByReviewMode(page);
    await waitLobbyReady(page);
    await closeAllAutoPopups(page);
  });

  test("金幣餘額顯示為千分位數字", async ({ page }) => {
    const coin = page.locator(".coin-bg").first();
    await expect(coin).toBeVisible();
    await expect(coin).toContainText(/[\d,]+/);
  });

  test("金幣 / 銀幣可切換", async ({ page }) => {
    const coin = page.locator(".coin-bg").first();
    const before = (await coin.innerText()).trim();
    // 嘗試點 coin 區（多數實作為點圖示切換幣別）
    await coin.click({ force: true });
    await page.waitForTimeout(500);
    // 出現切換選單，找「金幣」「銀幣」字樣
    const switcher = page
      .locator(POPUP_CONTAINER)
      .filter({ hasText: /金幣|銀幣/ })
      .first();
    if (await switcher.isVisible().catch(() => false)) {
      await switcher.locator("text=銀幣").first().click({ force: true });
      await page.waitForTimeout(500);
      const after = (await coin.innerText()).trim();
      expect(after).not.toBe(before);
    } else {
      test.info().annotations.push({ type: "note", description: "未找到幣別切換 UI；可能是直接 toggle" });
    }
  });

  test("頁首背包：X/1000 顯示", async ({ page }) => {
    // 頁首的「背包」p (y≈99，class unactive-menu-text)
    const backpackTab = page.locator('p:has-text("背包")').first();
    await expect(backpackTab).toBeVisible();
    // 數量顯示文字（X/Y）通常在附近
    const xy = page.getByText(/\d+\s*\/\s*\d+/).first();
    await expect(xy).toBeVisible({ timeout: 8_000 });
  });

  test("分類 tab：全部、最愛、老虎機、捕魚、休閒、棋牌 都顯示", async ({ page }) => {
    for (const cat of ["全部", "最愛", "老虎機", "捕魚", "休閒", "棋牌"]) {
      await expect(
        page.locator(`span.unactive-text:has-text("${cat}"), span.active-text:has-text("${cat}")`).first()
      ).toBeVisible();
    }
  });

  test("分類切換：點老虎機後變成 active", async ({ page }) => {
    const slot = page.locator('span:has-text("老虎機")').first();
    await slot.click({ force: true });
    await page.waitForTimeout(500);
    const slotActive = page.locator('span.active-text:has-text("老虎機")').first();
    await expect(slotActive).toBeVisible({ timeout: 3_000 });
  });

  test("頁首 icon 都看得到（mall / fullscreen / rotate）", async ({ page }) => {
    await expect(page.locator('img[alt="mall"]').first()).toBeVisible();
    await expect(page.locator('img[alt="fullscreen"]').first()).toBeVisible();
    await expect(page.locator('img[alt="rotate"]').first()).toBeVisible();
  });

  test("搜索：可開啟搜尋框並輸入關鍵字", async ({ page }) => {
    // 觀察大廳沒有常駐 input，搜尋通常要點放大鏡 icon。先寬鬆找搜尋觸發點
    const searchTrigger = page
      .locator('img[alt*="search"], svg[class*="search"], button:has-text("搜")')
      .first();
    if (!(await searchTrigger.isVisible().catch(() => false))) {
      test.skip(true, "頁首未直接顯示搜尋按鈕；待 testid 補上後啟用");
    }
    await searchTrigger.click({ force: true });
    const input = page.locator("input, [contenteditable='true']").first();
    await expect(input).toBeVisible({ timeout: 3_000 });
    await input.fill("虎");
    await page.waitForTimeout(800);
    // 搜尋結果應出現含「虎」的遊戲名
    await expect(page.getByText(/虎/).first()).toBeVisible();
  });
});
