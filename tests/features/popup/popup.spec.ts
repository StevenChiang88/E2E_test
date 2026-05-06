import { expect, test } from '@playwright/test';
import { loginByReviewMode } from '../../helpers/auth';

test.describe('Feature - Popup（模板）', () => {
  test.beforeEach(async ({ page }) => {
    await loginByReviewMode(page);
  });

  test('首儲 popup：顯示、滑動、可跳轉', async ({ page }) => {
    await expect(page.getByTestId('popup-first-deposit')).toBeVisible();
    await page.getByTestId('popup-first-deposit-next').click();
    await page.getByTestId('popup-first-deposit-cta').click();
    await expect(page).toHaveURL(/deposit|store|recharge/);
  });

  test('活動 popup：顯示、滑動、可跳轉', async ({ page }) => {
    await expect(page.getByTestId('popup-event')).toBeVisible();
    await page.getByTestId('popup-event-next').click();
    await page.getByTestId('popup-event-cta').click();
    await expect(page).toHaveURL(/event|activity/);
  });
});
