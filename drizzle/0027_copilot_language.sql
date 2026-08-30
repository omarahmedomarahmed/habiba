-- What language the copilot answers in, per patient thread.
--
-- Until now the prompt was English and said nothing about language, so an
-- Arabic question reliably got an English answer. A clinician can already tell
-- the copilot to answer in Arabic through the corrections box — measured at
-- zero obeyed out of six on a real thread, because the correction was appended
-- after the output schema and lost to the weight of the context.
--
-- `auto` means "answer in the language the question was asked in".

ALTER TABLE "copilot_threads"
  ADD COLUMN IF NOT EXISTS "reply_language" text NOT NULL DEFAULT 'auto';
