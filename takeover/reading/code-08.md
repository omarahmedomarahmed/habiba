# Slice 08: app-other (patient, clinic, sponsor, partner, auth, public incl. /design, root files)

Per-page redesign fields used below: **Screen** (what it is for), **Next** (what a person does next), **Empty** (empty state), **RTL** (Arabic/RTL handling), **Promise**.

## Files

### app/(auth)/forgot-password/page.tsx (23 lines)
- For: clinician password reset request, inside `AuthShell who="therapist" kind="signin"`.
- Decides: nothing; renders `ForgotPasswordForm` (components/auth/forms).
- Assumes: `AuthShell` chrome, `tauth.*` and `auth.therapist.*` dictionary keys.
- Promises: none.
- Notes: Screen: request a reset email. Next: check email. Empty: n/a. RTL: all copy through `t()`; `metadata.title` "Reset password" is English only. Only for clinicians (patient has its own at /patient/forgot-password).

### app/(auth)/layout.tsx (21 lines)
- For: pass-through layout (returns children). Comment (task 154) explains chrome moved to `components/auth/auth-shell.tsx` and the language switch moved into the site header the shell renders.
- Decides: nothing.
- Assumes: every (auth) page renders `AuthShell` or `QuietAuthShell` itself.
- Promises: none.
- Notes: RTL: html dir is set in root layout, not here.

### app/(auth)/login/page.tsx (55 lines)
- For: clinician sign in at `/login`.
- Decides: notice text from `?reset`, `?changed`, `?expired` (lines 11 to 32); passes `next` to `SignInForm`.
- Assumes: `/session-expired` has already revoked the session (comment line 14); `SignInForm` validates `next`.
- Promises: none directly (the entry for T1..T5 testers).
- Notes: Screen: sign in. Next: `/forgot-password` link. RTL: the three `NOTICES` strings (lines 12 to 17) are hardcoded English, shown to an Arabic reader untranslated. `next` open-redirect handling lives in `SignInForm` / action, not visible here.

### app/(auth)/reset-password/page.tsx (49 lines)
- For: set a new password from an emailed token.
- Decides: no token, show "Link not valid" plus "Request a new link" (lines 20 to 35); else `ResetPasswordForm token`.
- Assumes: token checked by the form's action.
- Promises: none.
- Notes: RTL: "Link not valid", "This reset link is missing its token...", "Request a new link" (lines 25, 26, 31) hardcoded English. Expired/used token path is inside the form action (not in slice).

### app/(auth)/signup/page.tsx (57 lines)
- For: clinician signup, the only signup that creates an account on the spot (comment lines 13 to 22). A switcher (in `AuthShell kind="signup"`) shows the four account kinds so a clinic owner does not create a personal account.
- Decides: terms/privacy sentence split on `{terms}` / `{privacy}` placeholders (lines 36 to 50).
- Assumes: `SignUpForm`.
- Promises: none. `metadata.description` "Your first session is free." is a claim (English only).
- Notes: RTL: body via `t()`; metadata English.

### app/(auth)/staff/sign-in/page.tsx (41 lines)
- For: staff console door `/staff/sign-in`, noindex/nofollow, linked from nowhere (comment lines 7 to 21, `verify:sprint21r`).
- Decides: passes `next` to `StaffSignInForm`.
- Assumes: `QuietAuthShell` (no switcher).
- Promises: A5 entry point.
- Notes: `QuietAuthShell title=""` (line 35) renders an empty `<h1>` (components/auth/auth-shell.tsx:216): an empty heading for screen readers. RTL: form component only; page has no text.

