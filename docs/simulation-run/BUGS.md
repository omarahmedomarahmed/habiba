# Bugs found by the run

Shape and severity order: `docs/simulation/07-THE-RECORD.md`.

### B1 · The simulation banner shows the production database host to every visitor
round R0 · step AD1.1 · board row 1
expected: a banner that says the site is a simulation, and nothing about infrastructure
saw:      "Simulation. Everybody here is invented. ep-wild-lake-a6tgm2r6-pooler" on every public page, signed in or not
where:    the site chrome that renders the SIMULATION_RUNNING banner
severity: privacy
status:   open

### B2 · Production's in-session copilot quota is 4, not the shipped 10
round R0 · step AD14 · board row 1
expected: messagesPerPatientPerSession = 10, the product default
saw:      4 on production, left by an earlier seed that lowered it to save a budget
where:    platform_settings key copilot (data, not code)
severity: wrong
status:   open, to be set back through /admin/settings in R0 so the change is audited
