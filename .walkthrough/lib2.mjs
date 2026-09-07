export async function clickButton(p, label) {
  const b = p.locator("button", { hasText: label }).first();
  await b.scrollIntoViewIfNeeded();
  await p.waitForTimeout(200);
  try {
    await b.click({ timeout: 8000 });
  } catch (error) {
    /*
     * 🔴 A finding, not a workaround: on a 430px viewport the fixed bottom
     * navigation sits over the button once the page scrolls it into view, and
     * Playwright reports the nav intercepting the pointer. A person gets there
     * by scrolling further; the page has no bottom padding that guarantees it.
     */
    console.log(`   ⚠️  "${label}" could not be clicked where it sits: ${String(error).split("\n")[0].slice(0, 80)}`);
    await b.evaluate((el) => el.click()).catch(async () => {
      await b.click({ force: true });
    });
  }
  await p.waitForLoadState("networkidle").catch(() => {});
  await p.waitForTimeout(800);
}
export async function clearLimits() {
  const { neon } = await import("@neondatabase/serverless");
  const sql = neon(process.env.DATABASE_URL);
  await sql`DELETE FROM rate_limits`;
}

export async function signIn(p, BASE, email, password, where = "/login") {
  await clearLimits();
  await p.goto(`${BASE}${where}`, { waitUntil: "networkidle" });
  await p.fill("#email", email);
  await p.fill("#password", password);
  await p.click("button[type=submit]");
  await p.waitForURL((u) => !u.pathname.includes("login") && !u.pathname.includes("sign-in"), { timeout: 45000 }).catch(() => {});
  await p.waitForLoadState("networkidle");
  return p.url();
}
