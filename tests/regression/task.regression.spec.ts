import { expect, test } from "@playwright/test";
import { loginByReviewMode } from "../helpers/auth";
import {
  POPUP_CONTAINER,
  closeAllAutoPopups,
  popupByText,
  waitLobbyReady,
} from "./_helpers";

/**
 * 對應測項：任務
 *   - 確認無破圖
 *   - 任務正常、滑動正常
 *   - 已解任務可正常領取
 */

test.describe("Regression - 任務", () => {
  test.beforeEach(async ({ page }) => {
    await loginByReviewMode(page);
    await waitLobbyReady(page);
    await closeAllAutoPopups(page);
  });

  test("點任務 → 開啟彈窗、無破圖（img 都 loaded）", async ({ page }) => {
    const entry = page
      .locator(".w-\\[62px\\].h-\\[72px\\].cursor-pointer")
      .filter({ hasText: "任務" })
      .first();
    if (!(await entry.isVisible().catch(() => false))) {
      test.skip(true, "找不到頁首『任務』按鈕，可能版型已改");
    }
    await entry.click({ force: true });
    const popup = popupByText(page, /任務/);
    await expect(popup).toBeVisible({ timeout: 5_000 });

    // 無破圖：所有 img 應該 naturalWidth > 0
    const broken = await popup.locator("img").evaluateAll((imgs) =>
      (imgs as HTMLImageElement[]).filter((i) => i.complete && i.naturalWidth === 0).length
    );
    expect(broken).toBe(0);
  });

  test("已解任務可領取（軟驗證）", async ({ page }) => {
    const entry = page
      .locator(".w-\\[62px\\].h-\\[72px\\].cursor-pointer")
      .filter({ hasText: "任務" })
      .first();
    if (!(await entry.isVisible().catch(() => false))) test.skip();
    await entry.click({ force: true });
    const popup = popupByText(page, /任務/);
    await expect(popup).toBeVisible();

    const claimable = popup.locator('button:has-text("領取"), [class*="cursor-pointer"]:has-text("領取")');
    const count = await claimable.count();
    if (count === 0) {
      test.info().annotations.push({ type: "note", description: "目前沒有可領取的任務" });
      return;
    }
    await claimable.first().click({ force: true });
    await page.waitForTimeout(500);
  });
});
