/**
 * 🔴 WALKTHROUGH DEVIATION W1, recorded rather than hidden.
 *
 * 37R.1 says every account is created through the real forms, and every one
 * was. The single exception is the three verification documents: uploading
 * needs Vercel Blob (`BLOB_READ_WRITE_TOKEN`), this deployment has no storage
 * configured, and the onboarding page says so itself in an amber banner. The
 * upload path is therefore NOT walked in this sprint and is named as a gap.
 *
 * What this writes is exactly what a successful upload writes: a URL in each
 * document column. Everything after it — the real Submit for verification
 * button, the real admin queue, the real approval — runs through the product.
 */
import { eq } from "drizzle-orm";
import { dbFor } from "../lib/db";
import { DEFAULT_REGION } from "../lib/db/region";
import { therapistVerifications, users } from "../lib/db/schema";

const db = dbFor(DEFAULT_REGION);

async function main() {
  const email = process.argv[2]!;
  const [user] = await db.select({ id: users.id }).from(users).where(eq(users.email, email));
  if (!user) throw new Error(`no user ${email}`);

  await db
    .update(therapistVerifications)
    .set({
      idFrontUrl: "https://example.invalid/walkthrough/id-front.jpg",
      licenseDocUrl: "https://example.invalid/walkthrough/licence.jpg",
      headshotUrl: "https://example.invalid/walkthrough/headshot.jpg",
      updatedAt: new Date(),
    })
    .where(eq(therapistVerifications.userId, user.id));

  console.log(`stubbed documents for ${email} (W1: no blob storage on this deployment)`);
}

void main();
