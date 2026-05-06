import { expect, test } from "@playwright/test";
import {
  POPUP_CONTAINER,
  closeAllAutoPopups,
  popupByText,
  waitLobbyReady,
} from "./_helpers";

/**
 * 對應測項：popup 彈窗：首儲、活動
 *   - 確認活動彈窗左右滑動正常、左右箭頭正常
 *   - 可正常關閉
 *   - 首儲彈窗顯示正常、滑動正常、可以正常跳轉
 *   - 活動彈窗顯示正常、滑動正常、可以正常跳轉
 *
 * 實際 DOM 觀察結果：
 *   - 進大廳後同時存在 2 個 .page-popup-container
 *     (1) 活動 swiper：含 img[alt="event"]、有 .swiper-button-prev/.swiper-button-next、.swiper-pagination-bullet
 *     (2) 首儲禮包詳細：含「首儲禮包」字眼、$ 金額、支付方式
 *   - 關閉：img[alt="close"]
 */

test.describe("Regression - Popup", () => {
  test.beforeEach(async ({ page }) => {
    // 已透過 setup-regression 共用 storageState，這裡只 goto 大廳，不重新登入
    await page.goto("/");
    await waitLobbyReady(page);
  });

  test("活動彈窗：顯示、左右箭頭、分頁圓點、可關閉", async ({ page }) => {
    const eventPopup = page
      .locator(POPUP_CONTAINER)
      .filter({ has: page.locator('img[alt="event"]') })
      .first();
    await expect(eventPopup).toBeVisible({ timeout: 8_000 });

    // 左右箭頭
    await expect(eventPopup.locator(".swiper-button-prev")).toBeVisible();
    await expect(eventPopup.locator(".swiper-button-next")).toBeVisible();

    // 分頁圓點 >= 2
    const bulletCount = await eventPopup.locator(".swiper-pagination-bullet").count();
    expect(bulletCount).toBeGreaterThanOrEqual(2);

    // 點下一頁，active slide 會變
    const activeSlideBefore = await eventPopup.locator(".swiper-slide-active").innerHTML();
    await eventPopup.locator(".swiper-button-next").click({ force: true });
    await page.waitForTimeout(600);
    const activeSlideAfter = await eventPopup.locator(".swiper-slide-active").innerHTML();
    // 內容或 active index 至少有一個會變
    expect(activeSlideBefore).not.toBe(activeSlideAfter);

    // 可關閉
    await eventPopup.locator('img[alt="close"]').click({ force: true });
    await expect(eventPopup).toBeHidden({ timeout: 3_000 });
  });

  test("首儲彈窗：顯示、可正常跳轉商城/儲值頁", async ({ page }) => {
    // 先把活動彈窗關掉，露出首儲
    const eventPopup = page
      .locator(POPUP_CONTAINER)
      .filter({ has: page.locator('img[alt="event"]') })
      .first();
    if (await eventPopup.isVisible().catch(() => false)) {
      await eventPopup.locator('img[alt="close"]').click({ force: true });
      await expect(eventPopup).toBeHidden({ timeout: 3_000 });
    }

    const firstDepositPopup = popupByText(page, /首儲禮包/);
    await expect(firstDepositPopup).toBeVisible({ timeout: 8_000 });

    // 內含金額 / 禮包圖片
    await expect(firstDepositPopup.locator('img[alt="禮包圖片"]').first()).toBeVisible();

    // 點 banner 跳轉（多數實作為 click banner img）
    await firstDepositPopup
      .locator('img[alt="首儲禮包banner"]')
      .first()
      .click({ force: true });

    // 跳轉到 deposit / store / mall 等任一個
    await expect(page).toHaveURL(/deposit|store|recharge|mall|first/i, { timeout: 8_000 });
  });

  test("彈窗可全部關閉（活動 + 首儲）", async ({ page }) => {
    await closeAllAutoPopups(page);
    await expect(page.locator(POPUP_CONTAINER)).toHaveCount(0, { timeout: 5_000 });
  });
});
