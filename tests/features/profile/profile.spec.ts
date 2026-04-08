import { expect, test } from '@playwright/test';
import { loginByGuest } from '../../helpers/auth';

test.describe.skip('Feature - 頭像與個人區（模板）', () => {
  test.beforeEach(async ({ page }) => {
    await loginByGuest(page);
    await page.getByTestId('avatar-btn').click();
  });

  test('頭像、暱稱、VIP、Lv 顯示正常', async ({ page }) => {
    await expect(page.getByTestId('profile-avatar')).toBeVisible();
    await expect(page.getByTestId('profile-nickname')).toBeVisible();
    await expect(page.getByTestId('profile-vip')).toBeVisible();
    await expect(page.getByTestId('profile-level')).toBeVisible();
  });

  test('背包可進入且項目可開啟', async ({ page }) => {
    await page.getByTestId('menu-bag').click();
    await expect(page.getByTestId('bag-balance')).toBeVisible();
    await page.getByTestId('bag-item').first().click();
    await expect(page.getByTestId('bag-item-modal')).toBeVisible();
  });
});
