import { Page, Locator, expect } from "@playwright/test";

/**
 * 大廳常見彈窗的根容器（首儲、活動、個人頁、漢堡內彈窗等都用這個 class）
 *   - 第一個 popup：活動 swiper（含 img[alt="event"]）
 *   - 第二個 popup：首儲禮包詳細（含「首儲禮包」文字）
 *   - 開個人頁：含「個人頁」標題
 *   - 開漢堡 / 公告 / 信箱 等：通常會塞在這個容器裡，含對應標題文字
 */
export const POPUP_CONTAINER = ".page-popup-container";

/**
 * 將大廳一進入時自動跳的彈窗（活動、首儲禮包詳細）依序關掉。
 * 使用 alt="close" 的圖按鈕；若有 .page-popup-container-close 也一併按。
 * 即使一個都沒有也會安靜結束（不會 throw）。
 */
export async function closeAllAutoPopups(page: Page, opts?: { timeoutMs?: number }) {
  const timeoutMs = opts?.timeoutMs ?? 8000;
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const closeBtns = page
      .locator(`${POPUP_CONTAINER} img[alt="close"], ${POPUP_CONTAINER} .page-popup-container-close`);
    const count = await closeBtns.count();
    if (count === 0) break;
    // 先關第一個（最上層）
    await closeBtns.first().click({ force: true }).catch(() => {});
    await page.waitForTimeout(300);
  }
}

/**
 * 取得「目前可見的」popup container 中，符合文字條件的那個。
 * 大廳同時可能有 2 個 .page-popup-container 並存。
 */
export function popupByText(page: Page, text: string | RegExp): Locator {
  return page.locator(POPUP_CONTAINER).filter({ hasText: text }).first();
}

/**
 * 等到大廳主要骨架就緒（頭像、coin 出現）。
 */
export async function waitLobbyReady(page: Page) {
  await expect(page.locator('img[alt="頭像"]').first()).toBeVisible({ timeout: 15_000 });
  await expect(page.locator(".coin-bg").first()).toBeVisible({ timeout: 15_000 });
}

/**
 * 嘗試點開頭像（會跳「個人頁」彈窗）。
 */
export async function openAvatarPopup(page: Page) {
  await page.locator(".avatar-box").first().click({ force: true });
  await expect(popupByText(page, "個人頁")).toBeVisible({ timeout: 5_000 });
}

/**
 * 切換個人頁分頁：我的 / 存摺 / 好友 / 背包
 * （tab 是 <p> 元素，未選 class 含 unactive-menu-text、選中 active-menu-text）
 */
export async function switchAvatarTab(page: Page, name: "我的" | "存摺" | "好友" | "背包") {
  const popup = popupByText(page, "個人頁");
  await popup.locator(`p:has-text("${name}")`).first().click({ force: true });
  await page.waitForTimeout(300);
}
