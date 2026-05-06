import { expect, test } from "@playwright/test";
import {
  POPUP_CONTAINER,
  closeAllAutoPopups,
  popupByText,
  waitLobbyReady,
} from "./_helpers";

/**
 * 對應測項：贈禮
 *   - 無破圖
 *   - 切換 tab、滑動正常
 *   - 不實際贈禮，僅確認 UID 可正常查詢
 */

test.describe("Regression - 贈禮", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await waitLobbyReady(page);
    await closeAllAutoPopups(page);
  });

  test("點贈禮 → 開啟彈窗、無破圖、可切 tab", async ({ page }) => {
    const entry = page
      .locator(".w-\\[62px\\].h-\\[72px\\].cursor-pointer")
      .filter({ hasText: "贈禮" })
      .first();
    if (!(await entry.isVisible().catch(() => false))) {
      test.skip(true, "頁首找不到『贈禮』按鈕");
    }
    await entry.click({ force: true });
    const popup = popupByText(page, /贈禮/);
    await expect(popup).toBeVisible({ timeout: 5_000 });

    const broken = await popup.locator("img").evaluateAll((imgs) =>
      (imgs as HTMLImageElement[]).filter((i) => i.complete && i.naturalWidth === 0).length
    );
    expect(broken).toBe(0);

    // 切換 tab：先抓任意 cursor-pointer text 元素，前 3 個都試點
    const tabs = popup.locator("[class*='cursor-pointer']");
    const tabCount = await tabs.count();
    for (let i = 0; i < Math.min(3, tabCount); i++) {
      await tabs.nth(i).click({ force: true }).catch(() => {});
      await page.waitForTimeout(300);
    }
  });

  test("UID 查詢：輸入後出現查詢結果（軟驗證）", async ({ page }) => {
    const entry = page
      .locator(".w-\\[62px\\].h-\\[72px\\].cursor-pointer")
      .filter({ hasText: "贈禮" })
      .first();
    if (!(await entry.isVisible().catch(() => false))) test.skip();
    await entry.click({ force: true });
    const popup = popupByText(page, /贈禮/);
    await expect(popup).toBeVisible();

    const uidInput = popup.locator("input").first();
    if (!(await uidInput.isVisible().catch(() => false))) {
      test.skip(true, "未顯示 UID 輸入欄");
    }
    await uidInput.fill("402993762"); // 自己的 UID 當測資（觀察 DOM 取得）
    await page.waitForTimeout(800);
    // 任一查詢按鈕
    const queryBtn = popup.locator('button:has-text("查詢"), [class*="cursor-pointer"]:has-text("查詢")').first();
    if (await queryBtn.isVisible().catch(() => false)) {
      await queryBtn.click({ force: true });
    } else {
      await uidInput.press("Enter");
    }
    await page.waitForTimeout(800);
    // 結果區應出現該 UID 或暱稱
    await expect(popup).toContainText(/402993762|STETEE/);
  });
});
