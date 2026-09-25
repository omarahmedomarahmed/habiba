# What earlier runs hit, so this one does not

Read once. Every other file in this folder says what is true now; this is the only one allowed
to talk about the past (`npm run verify:runbook` holds that).

| What was hit | What it means for this run |
|---|---|
| Sign-in is rate limited per network, and every agent shares one egress address | While `SIMULATION_RUNNING=1` every per-network limit is multiplied by 25. The platform-wide ceiling is not. If an agent sees "too many attempts", that is a finding only if the variable is off |
| A patient signs up with a phone and a first name, never an email | Patients are found by phone. `verify:cast` looks them up by digits |
| An organisation on the wrong region is offered the wrong rail | Every cast organisation is region `eg`. A card page from another processor is a finding |
| Onboarding chips (languages, specialties) are hidden checkboxes inside labels | Click the label, and pick them before pressing Save, because they belong to the same form |
| The country select is by code and its labels carry a flag | Select by value `eg`, not by the visible text |
| An upload takes about two seconds to land | Wait for the field to fill before submitting |
| The submit button reads disabled until the page hydrates | Wait for network idle before judging a button |
| `simulate:seed` refuses a second practice or employer by name | Start from `seed:demo -- --empty`, which clears people and keeps configuration |
| Only `main` builds on Vercel, by an ignored build step | A push to any other branch cancels in seconds. That is correct |
| A dev server and a build both write `.next` | `rm -rf .next` before any local build |
| A transcriber given the default fake microphone hears a sine tone and returns nothing | Every session with consent uses a synthesised conversation file (`06-THE-AUDIO.md`) |

Product defects go in `docs/simulation-run/BUGS.md` the moment they are hit. Tooling hazards go
in `HAZARDS.md` with the next H number.
