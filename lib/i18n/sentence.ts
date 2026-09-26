/**
 * 🔴 Board 489: somebody's own words, placed where a sentence ends.
 *
 * The rejection email said "The reason: {reason}." and operators write
 * reasons as sentences, so Rania read "...and submit again.." A template
 * cannot know whether the words it is given already end, so it leaves the
 * stop off and this adds one only when the words have none of their own.
 */
export function asSentence(words: string): string {
  const text = words.trim();
  if (text === "") return text;
  return /[.!?؟…:;)"'»”]$/.test(text) ? text : `${text}.`;
}
