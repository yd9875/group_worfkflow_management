import { expect, test } from "@playwright/test";

test("로그인 화면이 한국어로 표시된다", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "로그인" })).toBeVisible();
  await expect(page.getByRole("button", { name: "로그인" })).toBeVisible();
});

test("헬스 체크가 정상 상태를 반환한다", async ({ request }) => {
  const response = await request.get("/api/health");
  expect(response.ok()).toBeTruthy();
  expect(await response.json()).toMatchObject({ status: "ok" });
});

test("회원가입 화면에서 개인정보 수집·이용 내용을 고지한다", async ({ page }) => {
  await page.goto("/signup");
  await expect(
    page.getByRole("heading", { name: "[필수] 개인정보 수집·이용 안내" }),
  ).toBeVisible();
  await expect(page.getByText("수집·이용 목적")).toBeVisible();
  await expect(page.getByText("보유·이용 기간")).toBeVisible();
  await expect(page.getByText("동의 거부권과 불이익")).toBeVisible();
  await expect(
    page.getByRole("checkbox", { name: /개인정보 수집·이용 내용을 확인/ }),
  ).toHaveAttribute("required", "");
});

test("개인정보 처리방침에서 국외 보관·처리위탁을 공개한다", async ({ page }) => {
  await page.goto("/privacy");
  await expect(page.getByRole("heading", { name: "개인정보 처리방침" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "3. 국외 보관·처리위탁" })).toBeVisible();
  await expect(page.getByText("Aiven Ltd", { exact: false })).toBeVisible();
  await expect(page.getByText("싱가포르", { exact: true })).toBeVisible();
});
