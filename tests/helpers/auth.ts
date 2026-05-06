import { expect, Page } from "@playwright/test";

type LineLoginOptions = {
  loginPath?: string;
  ageConfirmButtonName?: string | RegExp;
  pauseOnLinePage?: boolean;
  requireLinePage?: boolean;
  callbackUrlPattern?: RegExp;
  homeUrlPattern?: RegExp;
  timeoutMs?: number;
};

const loginPath = "/auth";
/**
 * 審核模式
 * @param page
 * @param options
 * @returns
 */
export async function loginByReviewMode(page: Page) {
  await page.goto(`${loginPath}?checkMode=true`);
  await page.getByPlaceholder("請輸入帳號").fill(process.env.E2E_ACCOUNT ?? "");
  await page
    .getByPlaceholder("請輸入密碼")
    .fill(process.env.E2E_PASSWORD ?? "");

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
  await page.goto(loginPath);
  await page.locator("#silent-login").getByText("訪客").click();
}

/**
 * LINE 登入
 * @param page
 * @param options
 * @returns
 */
/**
 * LINE 登入完整流程：
 * 1. 點 LINE 登入
 * 2. 點已滿18歲
 * 3. 導去 LINE 頁（部分站點點完已滿18歲會自動導轉）
 * 4. 完成 LINE 驗證後回 call-back/line
 * 5. 回首頁表示登入成功
 */
export async function loginByLineLogin(
  page: Page,
  options: LineLoginOptions = {}
) {
  const timeoutMs = options.timeoutMs ?? 120_000;
  const ageConfirmButtonName = options.ageConfirmButtonName ?? "已滿18歲";
  const requireLinePage = options.requireLinePage ?? true;
  const callbackUrlPattern =
    options.callbackUrlPattern ?? /\/call-back\/line(?:\?|$)/;
  const homeUrlPattern = options.homeUrlPattern ?? /\/(?:\?|$)/;
  const pauseOnLinePage = options.pauseOnLinePage ?? true;

  await page.goto(options.loginPath ?? loginPath);

  await page.locator("#silent-login").getByText("LINE").click();

  if (
    await page.getByRole("button", { name: ageConfirmButtonName }).isVisible()
  ) {
    await page.getByRole("button", { name: ageConfirmButtonName }).click();
  }

  // 必須先到 LINE 網域，避免「未進 LINE 登入頁卻被判成功」
  let reachedLinePage = false;
  try {
    await page.waitForURL((url) => url.hostname === "access.line.me", {
      timeout: 15_000,
    });
    reachedLinePage = true;
  } catch {
    reachedLinePage = false;
  }

  if (requireLinePage && !reachedLinePage) {
    throw new Error(
      `LINE login flow did not reach access.line.me. Current URL: ${page.url()}`
    );
  }

  // 外部 LINE 頁面通常需人工完成登入/授權
  if (pauseOnLinePage && page.url().includes("access.line.me")) {
    await page.pause();
  }

  // pause 解除後可能已經快速經過 callback 並回到首頁，先等「callback 或首頁」任一成立
  await page.waitForURL(
    (url) =>
      callbackUrlPattern.test(url.toString()) ||
      homeUrlPattern.test(url.toString()),
    { timeout: timeoutMs }
  );

  // 若目前停在 callback，才再等一次回首頁
  if (callbackUrlPattern.test(page.url())) {
    await page.waitForURL(homeUrlPattern, { timeout: timeoutMs });
  }
  await expect(page).toHaveURL(homeUrlPattern);
}
