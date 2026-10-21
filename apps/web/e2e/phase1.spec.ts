import { expect, test } from '@playwright/test';

const phone = `011${String(Date.now()).slice(-8)}`;

test('engineer registers, admin verifies, engineer goes online', async ({ browser }) => {
  // — engineer signs up and lands on the dashboard (RTL page) —
  const eng = await (await browser.newContext()).newPage();
  await eng.goto('/register');
  await expect(eng.locator('html')).toHaveAttribute('dir', 'rtl');
  await eng.getByLabel('مهندس أقدّم خدمة').check({ force: true });
  await eng.getByLabel('الاسم').fill('كريم المهندس');
  await eng.getByLabel('رقم الهاتف').fill(phone);
  await eng.getByLabel('كلمة المرور').fill('password-1');
  await eng.getByLabel('تركيب كاميرات جديدة').check();
  await eng.getByRole('button', { name: 'إنشاء حساب' }).click();
  await expect(eng).toHaveURL(/\/engineer$/);
  await expect(eng.getByRole('heading', { name: 'كريم المهندس' })).toBeVisible();
  await expect(eng.getByText('حسابك قيد المراجعة', { exact: false }).first()).toBeVisible();
  await expect(eng.getByRole('button', { name: 'ابدأ استقبال الطلبات' })).toBeDisabled();

  // — a customer is kept out of the admin area —
  // — admin approves —
  const admin = await (await browser.newContext()).newPage();
  await admin.goto('/login');
  await admin.getByLabel('رقم الهاتف أو البريد الإلكتروني').fill('01012345678');
  await admin.getByLabel('كلمة المرور').fill('admin-pass-1');
  await admin.getByRole('button', { name: 'تسجيل الدخول' }).click();
  await expect(admin).toHaveURL(/\/admin\/engineers$/);
  const row = admin.locator('section', { hasText: 'كريم المهندس' });
  await row.getByRole('button', { name: 'توثيق' }).click();
  await expect(admin.getByText('كريم المهندس')).toHaveCount(0);

  // — engineer reloads: session restored from the saved refresh token, now verified —
  await eng.reload();
  await expect(eng.getByText('موثّق').first()).toBeVisible();
  await eng.getByRole('button', { name: 'ابدأ استقبال الطلبات' }).click();
  await expect(eng.getByText('متاح لاستقبال الطلبات')).toBeVisible();

  // — logout —
  await eng.goto('/');
  await eng.getByRole('button', { name: 'تسجيل الخروج' }).click();
  await expect(eng.getByRole('link', { name: 'تسجيل الدخول' })).toBeVisible();
});

test('wrong password shows an Arabic message; admin pages are guarded', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('رقم الهاتف أو البريد الإلكتروني').fill('01012345678');
  await page.getByLabel('كلمة المرور').fill('wrong-password');
  await page.getByRole('button', { name: 'تسجيل الدخول' }).click();
  await expect(page.getByRole('alert')).toHaveText('سجّل الدخول للمتابعة.');
  await page.goto('/admin/engineers');
  await expect(page).toHaveURL(/\/login$/);
});
