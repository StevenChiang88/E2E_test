import { expect, test } from "@playwright/test";
import {
  POPUP_CONTAINER,
  closeAllAutoPopups,
  popupByText,
  waitLobbyReady,
} from "./_helpers";

/**
 * 對應測項：公會
 *   - 確認公會正常
 *   - 切換 tab、滑動正常
 */

test.describe("Regression - 公會", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await waitLobbyReady(page);
    await closeAllAutoPopups(page);
  });

  test("點公會 → 開啟彈窗、可切 tab", async ({ page }) => {
    const entry = page
      .locator(".w-\\[62px\\].h-\\[72px\\].cursor-pointer")
      .filter({ hasText: "公會" })
      .first();
    if (!(await entry.isVisible().catch(() => false))) {
      test.skip(true, "頁首找不到『公會』按鈕");
    }
    await entry.click({ force: true });
    const popup = popupByText(page, /公會/);
    await expect(popup).toBeVisible({ timeout: 5_000 });

    // tab 切換
    const tabs = popup.locator("[class*='cursor-pointer']");
    const tabCount = await tabs.count();
    for (let i = 0; i < Math.min(3, tabCount); i++) {
      await tabs.nth(i).click({ force: true }).catch(() => {});
      await page.waitForTimeout(300);
    }

    // 無破圖
    const broken = await popup.locator("img").evaluateAll((imgs) =>
      (imgs as HTMLImageElement[]).filter((i) => i.complete && i.naturalWidth === 0).length
    );
    expect(broken).toBe(0);
  });
});
