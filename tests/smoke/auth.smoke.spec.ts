import { expect, test } from "@playwright/test";
import { loginByGuest, loginByLineLogin } from "../helpers/auth";

// 更新瀏覽器 localStorage 的 noShow18Plus 值，用於控制是否顯示 18 歲溫馨提醒
async function updateBrowserLocalStorageFlag(
  page: import("@playwright/test").Page,
  noShow18Plus: boolean
) {
  // 先進到同 origin 頁面，避免 about:blank 讀寫 localStorage 被拒
  await page.goto("/auth");

  await page.evaluate((flag) => {
    const key = "browser";
    let raw: string | null = null;
    let browserState: Record<string, unknown> = {};

    try {
      raw = window.localStorage.getItem(key);
      browserState = raw ? JSON.parse(raw) : {};
    } catch {
      browserState = {};
    }

    browserState.noShow18Plus = flag;
    window.localStorage.setItem(key, JSON.stringify(browserState));
  }, noShow18Plus);
}

test.describe("Smoke - 核心流程", () => {
  test("有顯示溫馨提醒的訪客登入", async ({ page }) => {
    await updateBrowserLocalStorageFlag(page, false);

    await loginByGuest(page);
    const reminder = page
      .locator("div")
      .filter({
        hasText: "已滿18歲",
      })
      .first();

    await expect(reminder).toBeVisible();

    await page.getByRole("button", { name: "已滿18歲" }).click();

    await expect(page).toHaveURL("/");
  });

  test("無溫馨提醒的訪客登入", async ({ page }) => {
    await updateBrowserLocalStorageFlag(page, true);
    await loginByGuest(page);

    await expect(page).toHaveURL("/");
  });

  test("LINE 登入 @manual", async ({ page }) => {
    // await updateBrowserLocalStorageFlag(page, true);
    await loginByLineLogin(page);
  });
});
