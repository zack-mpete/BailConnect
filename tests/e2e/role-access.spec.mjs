import { expect, test } from "@playwright/test";

const credentials = {
  admin: {
    email: process.env.E2E_ADMIN_EMAIL,
    password: process.env.E2E_ADMIN_PASSWORD
  },
  bailleur: {
    email: process.env.E2E_LANDLORD_EMAIL,
    password: process.env.E2E_LANDLORD_PASSWORD
  },
  locataire: {
    email: process.env.E2E_TENANT_EMAIL,
    password: process.env.E2E_TENANT_PASSWORD
  }
};

async function login(page, account) {
  await page.goto("/auth");
  await page.getByLabel(/email/i).fill(account.email);
  await page.getByLabel(/mot de passe/i).fill(account.password);
  await page.getByRole("button", { name: /se connecter/i }).click();
  await expect(page).toHaveURL(/dashboard/);
}

for (const [role, account] of Object.entries(credentials)) {
  test(`${role} ouvre son dashboard protégé`, async ({ page }) => {
    test.skip(!account.email || !account.password, "Identifiants E2E non configurés.");
    await login(page, account);
    await expect(page.getByText(/espace|centre de contrôle/i).first()).toBeVisible();
  });
}

test("un visiteur est invité à se connecter avant une demande", async ({ page }) => {
  await page.goto("/search");
  const loginLink = page.getByRole("link", { name: /se connecter/i }).first();
  await expect(loginLink).toBeVisible();
});
