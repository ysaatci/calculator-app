import { expect, test, type Page } from "@playwright/test";

const display = (page: Page) => page.getByTestId("display");

async function press(page: Page, ...keys: string[]) {
  for (const key of keys) {
    await page.getByRole("button", { name: key, exact: true }).click();
  }
}

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await press(page, "C");
});

test("adds two numbers through the real backend", async ({ page }) => {
  await press(page, "1", "2", "+", "3", "=");
  await expect(display(page)).toHaveText("15");
});

test("runs each binary operation", async ({ page }) => {
  await press(page, "9", "−", "4", "=");
  await expect(display(page)).toHaveText("5");

  await press(page, "C", "6", "×", "7", "=");
  await expect(display(page)).toHaveText("42");

  await press(page, "C", "8", "÷", "2", "=");
  await expect(display(page)).toHaveText("4");

  await press(page, "C", "2", "xʸ", "1", "0", "=");
  await expect(display(page)).toHaveText("1,024");
});

test("applies unary operations to the displayed value", async ({ page }) => {
  await press(page, "8", "1", "√");
  await expect(display(page)).toHaveText("9");

  await press(page, "C", "5", "0", "%");
  await expect(display(page)).toHaveText("0.5");
});

test("keeps a pending operation while a unary key is used", async ({ page }) => {
  await press(page, "5", "+", "9", "√");
  await expect(display(page)).toContainText("3");

  await press(page, "=");
  await expect(display(page)).toHaveText("8");
});

test("shows the backend's error message for division by zero", async ({ page }) => {
  await press(page, "5", "÷", "0", "=");

  await expect(display(page)).toHaveText("Error");
  await expect(page.getByRole("alert")).toHaveText("division by zero");
});

test("recovers from an error without a reload", async ({ page }) => {
  await press(page, "5", "÷", "0", "=");
  await expect(page.getByRole("alert")).toBeVisible();

  await press(page, "C", "2", "+", "2", "=");
  await expect(display(page)).toHaveText("4");
  await expect(page.getByRole("alert")).toHaveCount(0);
});

test("hides float artefacts behind rounding", async ({ page }) => {
  // 0.1 + 0.2 really is 0.30000000000000004 over the wire.
  await press(page, "0", ".", "1", "+", "0", ".", "2", "=");
  await expect(display(page)).toHaveText("0.3");
});

test("accepts keyboard input", async ({ page }) => {
  await page.keyboard.type("48");
  await page.keyboard.press("/");
  await page.keyboard.type("6");
  await page.keyboard.press("Enter");

  await expect(display(page)).toHaveText("8");
});

test("groups long results into thousands", async ({ page }) => {
  await press(page, "9", "9", "9", "×", "9", "9", "9", "=");
  await expect(display(page)).toHaveText("998,001");
});

test("shows the sum being built above the value", async ({ page }) => {
  await press(page, "1", "2", "+");
  await expect(page.getByTestId("expression")).toHaveText("12 +");

  await press(page, "8", "=");
  await expect(display(page)).toHaveText("20");
  // The expression clears once the sum is settled.
  await expect(page.getByTestId("expression")).toHaveText("");
});

test("never shifts the keypad, whatever the display says", async ({ page }) => {
  const keypadTop = async () =>
    (await page.locator(".calculator-keypad").boundingBox())?.y;

  const idle = await keypadTop();

  await press(page, "5", "+");
  expect(await keypadTop()).toBe(idle);

  await press(page, "C", "5", "÷", "0", "=");
  await expect(display(page)).toHaveText("Error");
  expect(await keypadTop()).toBe(idle);
});

test("draws square keys as circles rather than ellipses", async ({ page }) => {
  // border-radius: 50% on a non-square box gives an ellipse, which is what
  // made these look subtly off against the phone keypad they imitate.
  const ratios = await page.evaluate(() =>
    [...document.querySelectorAll(".calculator-keypad .key")]
      .filter((key) => /^[1-9]$/.test(key.textContent?.trim() ?? ""))
      .map((key) => {
        const { width, height } = key.getBoundingClientRect();
        return width / height;
      }),
  );

  expect(ratios.length).toBeGreaterThan(0);
  for (const ratio of ratios) {
    expect(ratio).toBeCloseTo(1, 1);
  }
});

test("stays usable without sideways scrolling", async ({ page }) => {
  const overflows = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );
  expect(overflows).toBe(false);

  // Fitts's Law: every key has to stay a comfortable target, including on
  // the phone viewport this project claims to support.
  const smallest = await page.evaluate(() => {
    const sizes = [...document.querySelectorAll(".key")].map((key) => {
      const { width, height } = key.getBoundingClientRect();
      return Math.min(width, height);
    });
    return Math.min(...sizes);
  });
  expect(smallest).toBeGreaterThanOrEqual(44);
});
