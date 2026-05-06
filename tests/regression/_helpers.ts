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
 * 大廳常見的蓋板廣告 / 彈窗，包含但不限於：
 *   - .page-popup-container（活動 swiper、首儲禮包詳細、個人頁、漢堡內彈窗…）
 *   - 其他可能的 ad / banner / mask / overlay class
 */
const POPUP_SELECTORS = [
  ".page-popup-container",
  "[class*='ad-popup']",
  "[class*='banner-popup']",
  "[class*='banner-mask']",
  "[class*='overlay-ad']",
  "[role='dialog']",
];

/**
 * 各種「關閉」按鈕的選擇器，依優先順序嘗試。
 * 注意：有些網站只有 parent 容器綁 click handler，img 本身點下去沒反應 —
 * 所以 closeAllAutoPopups 內若 click img 失敗，會 fallback 點它的 parent。
 */
const CLOSE_SELECTORS = [
  ".page-popup-container-close",
  "img[alt='close']",
  "img[alt='關閉']",
  "[aria-label='close']",
  "[aria-label='關閉']",
  "button[class*='close']",
  "[class*='popup-close']",
  "[class*='btn-close']",
];

const POPUP_UNION = POPUP_SELECTORS.join(", ");
const CLOSE_UNION = CLOSE_SELECTORS.join(", ");

/**
 * 把大廳所有蓋板廣告 / 跳出彈窗依序關掉。會撐住「關掉一個 → 下一個冒出來 →
 * 再關 → ...」的連環攻擊。即使一個都沒有也會安靜結束（不會 throw）。
 *
 * @param opts.timeoutMs 整段最多花多少毫秒（預設 15s）
 * @param opts.maxAttempts 最多關幾個（預設 20，防無限迴圈）
 * @param opts.settleMs 每關完一個等多久讓下一個冒出（預設 600ms）
 */
export async function closeAllAutoPopups(
  page: Page,
  opts?: { timeoutMs?: number; maxAttempts?: number; settleMs?: number }
) {
  const timeoutMs = opts?.timeoutMs ?? 15_000;
  const maxAttempts = opts?.maxAttempts ?? 20;
  const settleMs = opts?.settleMs ?? 600;
  const deadline = Date.now() + timeoutMs;

  let attempts = 0;
  let consecutiveEmpty = 0;

  while (Date.now() < deadline && attempts < maxAttempts) {
    // 先看還有沒有可見的彈窗容器
    const popups = page.locator(POPUP_UNION);
    const popupCount = await popups.count();
    if (popupCount === 0) {
      // 連續兩輪都沒看到才真的離開（防止下一個彈窗剛好還沒 render）
      consecutiveEmpty++;
      if (consecutiveEmpty >= 2) break;
      await page.waitForTimeout(settleMs);
      continue;
    }
    consecutiveEmpty = 0;

    // 找最上層那個彈窗（DOM 中通常最後一個）的 close 鈕
    const top = popups.last();
    const closeBtn = top.locator(CLOSE_UNION).first();
    const hasClose = await closeBtn.count();

    if (hasClose > 0) {
      // 先試點 close 本身
      let closed = await tryClickAndWait(page, closeBtn, top, settleMs);
      // 點不掉就試點它的 parent（有些站把 click handler 綁在 parent）
      if (!closed) {
        const parent = closeBtn.locator("xpath=..");
        closed = await tryClickAndWait(page, parent, top, settleMs);
      }
      if (!closed) {
        // 最後手段：按 Escape
        await page.keyboard.press("Escape").catch(() => {});
        await page.waitForTimeout(settleMs);
      }
    } else {
      // 沒 close 鈕（例如純蓋板）→ 按 Escape
      await page.keyboard.press("Escape").catch(() => {});
      await page.waitForTimeout(settleMs);
    }
    attempts++;
  }
}

async function tryClickAndWait(
  page: Page,
  target: Locator,
  popup: Locator,
  settleMs: number
): Promise<boolean> {
  await target.click({ force: true, timeout: 1500 }).catch(() => {});
  // 等 popup 真的消失（不是只 sleep 固定時間）
  try {
    await popup.waitFor({ state: "detached", timeout: settleMs });
    return true;
  } catch {
    // 沒 detached 也許只是 hidden
    const visible = await popup.isVisible().catch(() => false);
    if (!visible) return true;
  }
  return false;
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
