import { expect, Page } from "@playwright/test";

type LoginOptions = {
  account: string;
  password: string;
  loginPath: string;
};

/**
 * 審核模式
 * @param page
 * @param options
 * @returns
 */
export async function loginByReviewMode(page: Page, options: LoginOptions) {
  await page.goto(options.loginPath);
  await page.getByPlaceholder("請輸入帳號").fill(options.account);
  await page.getByPlaceholder("請輸入密碼").fill(options.password);

  await Promise.all([
    page.locator("#silent-login").click(),
    page.waitForURL("**/"),
  ]);

  await expect(page).toHaveURL(/\/$/);
}

/**
 * 訪客模式
 * @param page
 * @returns
 */

export async function loginByGuest(page: Page) {
  const loginPath = "/auth";

  await page.goto(loginPath);
  await page.locator("#silent-login").getByText("訪客").click();
}

/**
 * LINE 登入
 * @param page
 * @param options
 * @returns
 */
export async function loginByLineLogin(page: Page) {
  const loginPath = "/auth/lineLogin";

  await page.goto(loginPath);
}
