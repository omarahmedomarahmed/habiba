import { Fragment, type ReactNode } from "react";

/**
 * 🔴 A TRANSLATED SENTENCE WITH A LIVE THING INSIDE IT, usually an amount.
 *
 * `t()` returns a string, and a price inside a sentence ("Minimum {min}.")
 * has to be the hoverable `<Money>`, not its text. So the sentence is
 * translated with a marker where the value goes, and split on the marker:
 *
 *   rich(t("sponsor.topUpBody", { min: slot(0) }), [<Money cents={x} />])
 *
 * The markers are private-use characters no translation contains, and a
 * translation may move the value anywhere in the sentence (Arabic does).
 * Usable from server and client components alike.
 */
export function slot(index: number): string {
  return `${index}`;
}

export function rich(text: string, nodes: ReactNode[]): ReactNode {
  const parts = text.split(/(\d+)/);
  if (parts.length === 1) return text;
  return parts.map((part, i) =>
    i % 2 === 0 ? (part ? <Fragment key={i}>{part}</Fragment> : null) : <Fragment key={i}>{nodes[Number(part)]}</Fragment>,
  );
}
