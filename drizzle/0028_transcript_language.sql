-- What language a session is actually spoken in.
--
-- Until now `transcribeChunk` sent `language: "en"` on every request, hardcoded.
-- Every Arabic session on the platform was therefore decoded by a model that
-- had been told the audio was English, which is the single largest source of
-- transcript noise in the product and the real cause of the "the AI is bad at
-- Arabic" complaint. It was never a vocabulary problem.
--
-- Null means "we do not know" and the language parameter is omitted entirely,
-- which lets the model detect it. A value pins the whole session to one
-- language, which matters because chunks are ~8 seconds long and independent:
-- per-chunk detection on "mm-hmm" is a coin flip, and a transcript that changes
-- language every third line is worse than one that is confidently wrong.

ALTER TABLE "sessions"
  ADD COLUMN IF NOT EXISTS "transcript_language" text;
