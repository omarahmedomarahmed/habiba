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
