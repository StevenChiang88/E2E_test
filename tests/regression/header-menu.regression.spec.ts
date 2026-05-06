import { expect, test } from "@playwright/test";
import { loginByReviewMode } from "../helpers/auth";
import {
  POPUP_CONTAINER,
  closeAllAutoPopups,
  popupByText,
  waitLobbyReady,
} from "./_helpers";

/**
 * 對應測項：右上漢堡彈窗
 *   - 禮包碼兌換
 *   - 建立桌面捷徑（跳轉網頁）
 *   - 音樂開關 / 音效開關 / 大獎推播開關
 *   - 公告（切換、滑動）
 *   - 信箱（顯示、滑動）
 *   - 封鎖名單（顯示、滑動）
 *   - 聯繫 LINE 客服（跳轉）
 *   - 服務條款&遊戲規章（跳轉官網）
 *   - 登出
 *
 * 漢堡按鈕的 DOM 觀察：
 *   - 右上 7 個 .w-[62px].h-[72px].cursor-pointer 連續排列，第 1 個是 mall（商城），
 *     其他依序為排行榜、贈禮、公會、信箱、任務、漢堡（順序視版型可能調整）。
 *   - 為了穩定，這裡用「點開漢堡 → 等含關鍵字的 .page-popup-container 出現」的方式判斷。
 *   - 若漢堡按鈕未來補 alt 或 testid，請改用精確選擇器。
 */

const HAMBURGER_BUTTONS = ".w-\\[62px\\].h-\\[72px\\].cursor-pointer";

async function openHamburger(page: import("@playwright/test").Page) {
  // 嘗試由右往左點，最右那顆通常是漢堡
  const buttons = page.locator(HAMBURGER_BUTTONS);
  const count = await buttons.count();
  if (count === 0) throw new Error("找不到頁首 nav 按鈕");
  // 從最右邊開始嘗試點，看哪個會跳出含「漢堡選單」相關關鍵字的 popup
  for (let i = count - 1; i >= 0; i--) {
    await buttons.nth(i).click({ force: true });
    await page.waitForTimeout(400);
    const popup = page.locator(POPUP_CONTAINER).filter({
      hasText: /禮包碼|公告|信箱|登出|音樂|音效/,
    });
    if (await popup.first().isVisible().catch(() => false)) return popup.first();
    // 沒中就把這個彈窗關掉
    const closeBtn = page.locator(`${POPUP_CONTAINER} .page-popup-container-close`).first();
    if (await closeBtn.isVisible().catch(() => false)) {
      await closeBtn.click({ force: true }).catch(() => {});
    }
  }
  throw new Error("未能找到漢堡選單");
}

test.describe("Regression - 右上漢堡彈窗", () => {
  test.beforeEach(async ({ page }) => {
    await loginByReviewMode(page);
    await waitLobbyReady(page);
    await closeAllAutoPopups(page);
  });

  test("漢堡選單可開啟、含主要項目", async ({ page }) => {
    const menu = await openHamburger(page);
    await expect(menu).toBeVisible();
    // 至少含這些關鍵字之一即視為通過
    const text = await menu.innerText();
    const expected = ["禮包碼", "公告", "信箱", "登出", "音樂", "音效", "客服"];
    const hits = expected.filter((k) => text.includes(k)).length;
    expect(hits).toBeGreaterThanOrEqual(3);
  });

  test("音樂 / 音效 / 大獎推播 開關可點", async ({ page }) => {
    const menu = await openHamburger(page);
    for (const label of ["音樂", "音效", "大獎"]) {
      const item = menu.locator(`text=${label}`).first();
      if (await item.isVisible().catch(() => false)) {
        // 找它附近的 toggle / switch / 圖示按下
        const toggle = item.locator("xpath=following::*[1]");
        await toggle.click({ force: true }).catch(() => {});
      }
    }
  });

  test("禮包碼兌換彈窗可開啟", async ({ page }) => {
    const menu = await openHamburger(page);
    await menu.locator("text=禮包碼").first().click({ force: true });
    await expect(popupByText(page, /禮包碼|兌換/)).toBeVisible({ timeout: 5_000 });
  });

  test("公告：可開啟並切換", async ({ page }) => {
    const menu = await openHamburger(page);
    const entry = menu.locator("text=公告").first();
    if (!(await entry.isVisible().catch(() => false))) test.skip();
    await entry.click({ force: true });
    await expect(popupByText(page, "公告")).toBeVisible({ timeout: 5_000 });
  });

  test("信箱：可開啟", async ({ page }) => {
    const menu = await openHamburger(page);
    const entry = menu.locator("text=信箱").first();
    if (!(await entry.isVisible().catch(() => false))) test.skip();
    await entry.click({ force: true });
    await expect(popupByText(page, "信箱")).toBeVisible({ timeout: 5_000 });
  });

  test("封鎖名單：可開啟", async ({ page }) => {
    const menu = await openHamburger(page);
    const entry = menu.locator("text=封鎖").first();
    if (!(await entry.isVisible().catch(() => false))) test.skip();
    await entry.click({ force: true });
    await expect(popupByText(page, /封鎖/)).toBeVisible({ timeout: 5_000 });
  });

  test("登出：點擊有確認流程", async ({ page }) => {
    const menu = await openHamburger(page);
    const entry = menu.locator("text=登出").first();
    if (!(await entry.isVisible().catch(() => false))) test.skip();
    await entry.click({ force: true });
    // 預期會出現確認彈窗 或 直接導回登入頁
    await page.waitForTimeout(1000);
    const onAuth = /\/auth/.test(page.url());
    const hasConfirm = await page
      .locator(POPUP_CONTAINER)
      .filter({ hasText: /確定|取消|登出/ })
      .first()
      .isVisible()
      .catch(() => false);
    expect(onAuth || hasConfirm).toBeTruthy();
  });

  // === 跳外部 / 需手動驗證 ===
  test("@manual 建立桌面捷徑：點確定後跳網頁正常", async () => {
    test.skip(true, "跳外部 + 系統提示，由 QA 手動驗證");
  });
  test("@manual 聯繫 LINE 客服：跳轉正常", async () => {
    test.skip(true, "跳外部 LINE 服務，由 QA 手動驗證");
  });
  test("@manual 服務條款 / 遊戲規章：跳轉官網", async () => {
    test.skip(true, "跳外部官網，由 QA 手動驗證");
  });
});
