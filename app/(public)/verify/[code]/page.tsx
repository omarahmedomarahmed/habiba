import { redirect } from "next/navigation";

/**
 * `/verify/<code>` — the URL printed on a record extract's cover page.
 *
 * PLAN.md 28.5, 26.9. It exists so the cover page can print one string a
 * person types into a browser bar rather than a two-step instruction, and it
 * hands straight over to the form, which is the single implementation of the
 * answer (C143's rules about what may be returned live there and only there).
 *
 * A redirect rather than a duplicate page, because two renderings of "what a
 * third party may be told" is one more than this can safely have.
 */
export default async function VerifyCodePage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  redirect(`/verify?code=${encodeURIComponent(code)}`);
}
