-- 🔴 SPRINT 71 — THE FINANCIAL MODEL, AND WHY IT IS NOT IN `platform_settings`.
--
-- `platform_settings` prices the product: a number in it changes what a clinician is billed
-- on their next invoice. A forecast input must be structurally incapable of that, so it lives
-- in its own tables, read by its own module, and `verify:finance` asserts that nothing under
-- `lib/finance/` can import anything that writes money.
--
-- Two tables and the split between them is the point.
--
-- Additive (H16).

-- 🔴 AN IMMUTABLE, DATED MEASUREMENT.
--
-- If a forecast reads live rows it changes under you, and last month's number cannot be
-- reproduced. That is fine for a dashboard and fatal for a figure somebody was shown in a
-- fundraising conversation. So a measurement is SNAPSHOTTED: taken once, stamped, and never
-- updated. Re-measuring writes a new row.
CREATE TABLE IF NOT EXISTS finance_benchmarks (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label         text NOT NULL,
  -- Every measured input, with its sample size, exactly as lib/finance/assumptions.ts holds it.
  measured      jsonb NOT NULL,
  -- What the database looked like when it was taken, so a reader can judge the sample.
  source        jsonb NOT NULL DEFAULT '{}'::jsonb,
  taken_by      uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS finance_benchmarks_created_idx ON finance_benchmarks (created_at DESC);

-- A named set of assumptions. Editable, clonable, and pointed at one benchmark.
CREATE TABLE IF NOT EXISTS finance_scenarios (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug          text NOT NULL,
  name          text NOT NULL,
  -- The whole Assumptions object. One column because the model takes it whole: a forecast
  -- assembled from twenty columns is a forecast where nineteen of them can be stale.
  assumptions   jsonb NOT NULL,
  -- 🔴 Which measurement this was built on. Null means it was built on the shipped estimates,
  -- and the screen says so rather than implying it was measured.
  benchmark_id  uuid REFERENCES finance_benchmarks(id) ON DELETE SET NULL,
  notes         text,
  created_by    uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS finance_scenarios_slug_unique ON finance_scenarios (slug);

COMMENT ON TABLE finance_benchmarks IS
  'Sprint 71. An immutable dated measurement of the unit economics. Never updated: re-measuring writes a new row, so a forecast quoted in March can be reproduced in June.';

COMMENT ON TABLE finance_scenarios IS
  'Sprint 71. A named set of forecast assumptions. Deliberately NOT platform_settings: a number here must never be able to charge anybody, and verify:finance asserts the module graph that keeps it that way.';

COMMENT ON COLUMN finance_scenarios.benchmark_id IS
  'Which measurement this scenario was built on. Null means the shipped estimates, and the screen says so rather than implying a measurement happened.';
