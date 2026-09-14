-- 🔴 63.1 / C324 — CLINIC STAFF IS ITS OWN PRINCIPAL, AND IT ALREADY IS.
--
-- `clinic_managers` and `clinic_auth_sessions` have been a separate table with a
-- separate cookie since sprint 54, which is what C324 asks for. What is missing
-- is everything above it: roles a practice names, assignments that scope what a
-- role reaches, and the link between one human's two principals.
--
-- Additive throughout (H16). Nothing here rewrites a row that exists.

-- 🔴 63.3 — UP TO TWO CUSTOM ROLES, AND THE LIMIT IS A COLUMN.
--
-- `slot` is 1 or 2 with a unique index on (organization_id, slot), so "up to two"
-- is enforced by the database rather than by a count somebody reads and then
-- writes against. Two requests arriving together both counting one existing role
-- is the same race the sponsor allowance had, and the fix is the same shape:
-- make the limit a constraint rather than a check.
CREATE TABLE IF NOT EXISTS clinic_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  organization_id uuid NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,

  -- 1 or 2. The practice gets two, named by them.
  slot integer NOT NULL,
  name text NOT NULL,

  -- 🔴 C353 — STRINGS, AND THE CODE DECIDES WHAT THEY MEAN.
  --
  -- This column is not the vocabulary. `lib/clinic-auth/capabilities.ts` is, and
  -- `parseCapabilities` discards anything here that is not in it. A capability
  -- set stored as editable JSON is an escalation vector exactly when the check
  -- reads it back and trusts it, so nothing reads this back and trusts it.
  capabilities jsonb NOT NULL DEFAULT '[]'::jsonb,

  created_by_manager_id uuid REFERENCES clinic_managers (id) ON DELETE SET NULL,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

ALTER TABLE clinic_roles DROP CONSTRAINT IF EXISTS clinic_roles_slot_bounded;
ALTER TABLE clinic_roles ADD CONSTRAINT clinic_roles_slot_bounded
  CHECK (slot IN (1, 2))
  NOT VALID;
ALTER TABLE clinic_roles VALIDATE CONSTRAINT clinic_roles_slot_bounded;

ALTER TABLE clinic_roles DROP CONSTRAINT IF EXISTS clinic_roles_capabilities_is_array;
ALTER TABLE clinic_roles ADD CONSTRAINT clinic_roles_capabilities_is_array
  CHECK (jsonb_typeof(capabilities) = 'array')
  NOT VALID;
ALTER TABLE clinic_roles VALIDATE CONSTRAINT clinic_roles_capabilities_is_array;

-- 🔴 63.7 — AND THE TWO THAT CAN NEVER BE DELEGATED ARE REFUSED IN THE DATABASE.
--
-- `roleProblem` refuses them at write time, which is where the sentence somebody
-- reads comes from. This is the second lock, and it is here because "money and
-- membership are never delegable" is the kind of rule that gets around a single
-- guard through a script, a fixture or a future endpoint nobody has written yet.
ALTER TABLE clinic_roles DROP CONSTRAINT IF EXISTS clinic_roles_never_delegable;
ALTER TABLE clinic_roles ADD CONSTRAINT clinic_roles_never_delegable
  CHECK (
    NOT (capabilities @> '["seats.manage"]'::jsonb)
    AND NOT (capabilities @> '["clinicians.manage"]'::jsonb)
  )
  NOT VALID;
ALTER TABLE clinic_roles VALIDATE CONSTRAINT clinic_roles_never_delegable;

CREATE UNIQUE INDEX IF NOT EXISTS clinic_roles_slot_unique
  ON clinic_roles (organization_id, slot)
  WHERE deleted_at IS NULL;

COMMENT ON TABLE clinic_roles IS
  'C326 / C353. Up to two custom roles a practice names. The capability strings here mean nothing until lib/clinic-auth/capabilities.ts recognises them, and seats.manage and clinicians.manage are refused by a constraint because money and membership are never delegable.';

-- 🔴 63.4 / C325 — THE ASSIGNMENT, WHICH IS WHAT MAKES A CAPABILITY SCOPED.
--
-- "Assistant 1 assigned to therapist A is refused therapist B's calendar on the
-- same route." Holding `schedule.read` is not permission to see everybody: it is
-- permission to see the clinicians in this table. A staff member with no rows
-- here sees nothing under a scoped capability, which is the safe direction for an
-- empty list to point.
CREATE TABLE IF NOT EXISTS clinic_staff_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  organization_id uuid NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
  clinic_manager_id uuid NOT NULL REFERENCES clinic_managers (id) ON DELETE CASCADE,
  -- The clinician they are assigned to.
  user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,

  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS clinic_staff_assignments_unique
  ON clinic_staff_assignments (clinic_manager_id, user_id);

CREATE INDEX IF NOT EXISTS clinic_staff_assignments_org_idx
  ON clinic_staff_assignments (organization_id);

COMMENT ON TABLE clinic_staff_assignments IS
  'C325. Which clinicians a staff member may see under a therapist-scoped capability. No rows means no clinicians, never all of them.';

-- The role a manager holds, when it is a custom one. Null means the built-in
-- `admin` or `viewer` on the existing column, which is unchanged.
ALTER TABLE clinic_managers
  ADD COLUMN IF NOT EXISTS role_id uuid REFERENCES clinic_roles (id) ON DELETE SET NULL;

-- 🔴 63.2 / C352 — ONE HUMAN, TWO PRINCIPALS, AND THE LINK IS A COLUMN.
--
-- A therapist who upgrades is a clinician AND the clinic admin. The ruling is two
-- principal rows, linked, with the session naming which is ACTIVE, and switching
-- explicit and audited. This column is the link; `lib/clinic-auth/switch.ts` is
-- the switch, and it revokes the other principal's sessions on the way through so
-- one session can never carry both capability sets.
ALTER TABLE clinic_managers
  ADD COLUMN IF NOT EXISTS linked_user_id uuid REFERENCES users (id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS clinic_managers_linked_user_unique
  ON clinic_managers (linked_user_id)
  WHERE linked_user_id IS NOT NULL AND deleted_at IS NULL;

COMMENT ON COLUMN clinic_managers.linked_user_id IS
  'C352. The clinician row that is the same human as this manager. Unique, so one clinician cannot be linked to two management principals. Switching between them revokes the sessions of the one being left.';

-- 🔴 63.12 / C327 — THE PATIENT IS TOLD, AND THIS IS WHERE WE RECORD THAT WE SAID IT.
--
-- *A disclosed leak is a trade; an undisclosed one is a breach.* The disclosure
-- itself is a label on the radar card and a section on the record page (C354, no
-- wall). This column is the audit trail of the disclosure having been served,
-- stamped by the page that renders it, in the same shape `clinician_invitations`
-- uses for `terms_shown_at` and for the same reason: it is not proof anybody read
-- it, it is proof we said it, in a column an auditor can read.
ALTER TABLE patients
  ADD COLUMN IF NOT EXISTS clinic_visibility_shown_at timestamptz;

COMMENT ON COLUMN patients.clinic_visibility_shown_at IS
  'C327 / C354. When this patient was shown what clinic administrative staff can see about them: first name, last initial and appointment times. Null means the disclosure has not been rendered to them yet.';
