/**
 * 🔴 ETA's canonical serialization, the text a document's signature is over.
 *
 * From the SDK's "Document Serialization Approach": every property name in
 * culture-invariant upper case and quoted, every value quoted EXACTLY as it is
 * in the document, and an array's name written once and then again before each
 * element. `signatures` is never part of it: it is what is being made.
 *
 * "Exactly as it is in the document" is the trap. `10.50` in the JSON is
 * `"10.50"` in the serialization, and a JavaScript number has forgotten the
 * zero. So a number in an ETA document is an `EtaNumber`: its text, carried
 * unchanged from the builder into the signature and into the body we submit
 * (`toEtaJson`), and read back the same way (`parseEtaJson`). One character of
 * difference is a signature the Tax Authority rejects; `tests/eta.test.ts`
 * checks this file against the SDK's own published example, byte for byte.
 */

export type EtaNumber = { readonly etaNumber: string };

/** A number with the exact decimals ETA will see. Amounts use five. */
export function etaNumber(value: number, decimals = 5): EtaNumber {
  return { etaNumber: value.toFixed(decimals) };
}

function isEtaNumber(value: unknown): value is EtaNumber {
  return typeof value === "object" && value !== null && "etaNumber" in value;
}

export function serializeEta(value: unknown): string {
  if (value === null || value === undefined) return '""';
  if (isEtaNumber(value)) return `"${value.etaNumber}"`;
  if (typeof value !== "object") return `"${String(value)}"`;
  let out = "";
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (key === "signatures") continue;
    const name = `"${key.toUpperCase()}"`;
    if (Array.isArray(child)) {
      out += name;
      for (const element of child) out += name + serializeEta(element);
    } else {
      out += name + serializeEta(child);
    }
  }
  return out;
}

type RawJson = { rawJSON: (text: string) => unknown };

/** The JSON body to submit, with every number written as the text that was signed. */
export function toEtaJson(value: unknown): string {
  return JSON.stringify(value, (_key, child: unknown) =>
    isEtaNumber(child) ? (JSON as unknown as RawJson).rawJSON(child.etaNumber) : child,
  );
}

/** A document read back with its numbers as the text they were written in. */
export function parseEtaJson(text: string): unknown {
  return (JSON.parse as (t: string, r: (k: string, v: unknown, c?: { source?: string }) => unknown) => unknown)(
    text,
    (_key, child, context) =>
      typeof child === "number" ? { etaNumber: context?.source ?? String(child) } : child,
  );
}
