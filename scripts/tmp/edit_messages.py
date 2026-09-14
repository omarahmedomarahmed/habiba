"""Sprint 65 helper. Replace or delete whole dictionary entries in lib/i18n/messages.ts.

An entry is `  "key": "…"` on one line, or `  "key":\n    "…"` on two. Both dictionaries
hold the same keys, so every operation names an English value and an Arabic one and the
script edits the first occurrence for EN and the second for AR.
"""

import re
import sys

PATH = "lib/i18n/messages.ts"


def entry_span(text: str, key: str, start: int):
    """Return (begin, end) of the whole entry for `key` at or after `start`."""
    needle = f'  "{key}":'
    begin = text.index(needle, start)
    # The entry ends at the first line that closes with `",` or `"` + newline.
    i = begin
    while True:
        eol = text.index("\n", i)
        line = text[i:eol]
        if line.rstrip().endswith(",") and line.rstrip().endswith('",'):
            return begin, eol + 1
        if line.rstrip().endswith('"'):
            return begin, eol + 1
        i = eol + 1


def replace(text: str, key: str, en_block: str, ar_block: str) -> str:
    a, b = entry_span(text, key, 0)
    text = text[:a] + en_block + text[b:]
    a2, b2 = entry_span(text, key, a + len(en_block))
    return text[:a2] + ar_block + text[b2:]


def apply(ops):
    text = open(PATH, encoding="utf-8").read()
    for key, en_block, ar_block in ops:
        text = replace(text, key, en_block, ar_block)
    open(PATH, "w", encoding="utf-8").write(text)


def line(key: str, value: str) -> str:
    return f'  "{key}": {value!r}\n'.replace("'", '"') if False else f'  "{key}": "{value}",\n'
