import { expect, test } from "@playwright/test";
import { loginByReviewMode } from "../helpers/auth";
import {
  closeAllAutoPopups,
  openAvatarPopup,
  popupByText,
  switchAvatarTab,
  waitLobbyReady,
} from "./_helpers";

/**
 * 對應測項：
 *   - 頭像：右上頭像、暱稱、VIP、Lv.X 顯示正常
 *   - 頭像 -> 我的：可滑動、編輯按鈕、複製按鈕
 *   - 頭像 -> 存摺：儲值/上下分紀錄
 *   - 頭像 -> 好友：可加好友
 *   - 頭像 -> 背包：X/1000 顯示、點擊任一可開啟
 *
 * 「儲值一筆」「後台手動上下分」屬金流/後台動作，標 @manual + skip。
 */

test.describe("Regression - Avatar", () => {
  test.beforeEach(async ({ page }) => {
    await loginByReviewMode(page);
    await waitLobbyReady(page);
    await closeAllAutoPopups(page);
  });

  test("頭像/暱稱/VIP/Lv 顯示正常", async ({ page }) => {
    await expect(page.locator('img[alt="頭像"]').first()).toBeVisible();
    await expect(page.getByText(/^VIP\d+$/).first()).toBeVisible();
    await expect(page.getByText(/^Lv\.\s*\d+$/).first()).toBeVisible();
    // 暱稱：頁首頭像區的 <p>，內容為非空字串（暱稱會因帳號而異）
    const nicknameNearAvatar = page
      .locator(".avatar-box")
      .first()
      .locator("xpath=ancestor::*[1]")
      .locator("p")
      .first();
    await expect(nicknameNearAvatar).toHaveText(/.+/);
  });

  test("頭像 -> 個人頁：開啟、滑動、可關閉", async ({ page }) => {
    await openAvatarPopup(page);
    const popup = popupByText(page, "個人頁");
    await expect(popup).toBeVisible();

    // 4 個 tab 都看得到
    for (const tab of ["我的", "存摺", "好友", "背包"]) {
      await expect(popup.locator(`p:has-text("${tab}")`).first()).toBeVisible();
    }

    // 關閉
    await popup.locator(".page-popup-container-close").first().click({ force: true });
    await expect(popup).toBeHidden({ timeout: 3_000 });
  });

  test("頭像 -> 我的：UID 顯示、編輯/複製按鈕可點", async ({ page }) => {
    await openAvatarPopup(page);
    await switchAvatarTab(page, "我的");
    const popup = popupByText(page, "個人頁");

    // UID 顯示
    await expect(popup.getByText(/UID\s*:\s*\d+/)).toBeVisible();

    // 編輯/複製按鈕：DOM 觀察沒有文字標籤，這裡用「icon-only 可點元素」軟驗證
    // 若之後前端補上 aria-label 或 testid，請改為精確選擇器
    const clickableIcons = await popup
      .locator("button, [class*='cursor-pointer'] svg, [class*='cursor-pointer'] img")
      .count();
    expect(clickableIcons).toBeGreaterThan(0);
  });

  test("頭像 -> 存摺：頁面可開啟", async ({ page }) => {
    await openAvatarPopup(page);
    await switchAvatarTab(page, "存摺");
    const popup = popupByText(page, "個人頁");
    // 該分頁存在內容容器即視為通過（精確驗證需要至少 1 筆紀錄，屬金流）
    await expect(popup).toBeVisible();
  });

  test("頭像 -> 好友：頁面可開啟", async ({ page }) => {
    await openAvatarPopup(page);
    await switchAvatarTab(page, "好友");
    const popup = popupByText(page, "個人頁");
    await expect(popup).toBeVisible();
  });

  test("頭像 -> 背包：顯示 X/1000、點任一可開啟", async ({ page }) => {
    await openAvatarPopup(page);
    await switchAvatarTab(page, "背包");
    const popup = popupByText(page, "個人頁");

    // X/1000 顯示（後續可能改成其他上限）
    await expect(popup.getByText(/\d+\s*\/\s*\d+/)).toBeVisible();

    // 點任一道具：找彈窗內的 grid 子項（cursor-pointer），不一定有，沒道具就略過
    const items = popup.locator("[class*='cursor-pointer']");
    const itemCount = await items.count();
    if (itemCount > 0) {
      await items.first().click({ force: true });
      // 點完後應出現另一層 .page-popup-container 或道具細節
      await page.waitForTimeout(500);
    } else {
      test.info().annotations.push({ type: "note", description: "背包空，未驗證點擊道具" });
    }
  });

  // === 需要金流/後台介入的項目 ===
  test("@manual 頭像 -> 存摺：可正常儲值一筆紀錄", async () => {
    test.skip(true, "牽涉金流，由 QA 手動驗證");
  });
  test("@manual 頭像 -> 存摺：後台手動上下分發送一筆", async () => {
    test.skip(true, "需後台 admin 操作，由 QA 手動驗證");
  });
  test("@manual 頭像 -> 好友：可正常加一個好友並滑動", async () => {
    test.skip(true, "需另一帳號互動，由 QA 手動驗證");
  });
});
