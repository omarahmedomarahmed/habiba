import type { MessageKey } from "./messages";
import { getI18n } from "./server";

/**
 * One sentence in the reader's language, for a server action's `{ error }`.
 * Due diligence F18: the refusal under an Arabic form is Arabic too.
 */
export async function say(key: MessageKey, values?: Record<string, string | number>): Promise<string> {
  return (await getI18n()).t(key, values);
}
