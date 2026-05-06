import { expect, test } from "@playwright/test";
import {
  closeAllAutoPopups,
  waitLobbyReady,
} from "./_helpers";

/**
 * 對應測項：商城
 *   - 無破圖
 *   - icon 正常、滑動、點擊後可正常跳轉
 *   - 確認儲值正常（金流，留 manual）
 */

test.describe("Regression - 商城", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await waitLobbyReady(page);
    await closeAllAutoPopups(page);
  });

  test("點商城 → 跳轉商城頁、無破圖", async ({ page }) => {
    const mall = page.locator('img[alt="mall"]').first();
    await expect(mall).toBeVisible();
    await mall.click({ force: true });
    await expect(page).toHaveURL(/mall|store|shop/i, { timeout: 5_000 });

    // 無破圖
    const broken = await page.locator("img").evaluateAll((imgs) =>
      (imgs as HTMLImageElement[]).filter((i) => i.complete && i.naturalWidth === 0).length
    );
    expect(broken).toBe(0);
  });

  test("@manual 商城：儲值流程正常", async () => {
    test.skip(true, "牽涉金流，由 QA 手動驗證");
  });
});
