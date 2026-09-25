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
status:   fixed in R0 through /admin/settings (board row 2), audited

B1 was also reported independently by OPS, THERAPISTS-A and PARTNER-WEB in round 1.

### B3 · Pot balance never shown: 'Not enough activity to report yet' after welcome credit and after a confirmed $500 top-up
round R1 · step CO7.2 (also CO1.2) · found by COMPANIES · shot docs/simulation-run/shots/R1/E1-HR-CO7.2-sponsor-pot.png
expected: CO7.2: publishTopUp adds the net to the published balance, so the balance card shows the new figure (console says Pot $600 = EGP 30,000). CO1.2: the $100 welcome credit is also published
saw:      /sponsor/pot and /sponsor still read 'Left in your pot: Not enough activity to report yet' after SU3 confirmed
where:    /sponsor/pot, /sponsor
severity: money
status:   open

### B4 · Public profile /t/<id> is a 404 for a verified, priced clinician with open hours until they open Crisis Radar
round R1 · step TH4.1 · found by THERAPISTS-A · shot /home/user/habiba/docs/simulation-run/shots/R1/VISITOR-TH4.1-public.png
expected: Per TH4.1, the patient booking page /t/<T1 id> shows the open hours. Settings links to it as 'Your public page'.
saw:      /t/cc4f3d11-... returned 'Clinician not found' 404. publicProfile inner-joins therapist_radar, and only ensureRadarProfile on /on-call creates that row. After visiting /on-call the page worked.
where:    /t/[id], lib/data/radar.ts publicProfile
severity: stuck
status:   open

### B5 · WhatsApp record invite has no link
round R1 · step TH5.3 · found by THERAPISTS-A · shot /home/user/habiba/docs/simulation-run/shots/R1/T1-TH5.3-Layla.png
expected: The patient receives /patient/invite/<token> (TH5.3 'outbox to patient ... with /patient/invite/<token>')
saw:      The kept WhatsApp messages to +201009000041/42 say 'Open the link below to set up your account' but contain no URL. sendWhatsapp keeps only body plus variables and drops message.link, and the claim_invite template has one variable (the therapist name) and no link, so a phone-only patient cannot claim from the message. The on-screen link sits behind a 'Copy' button and is never shown as text.
where:    lib/notify/whatsapp.ts keep(), lib/notify/templates.ts claim.invite, app/(app)/patients/actions.ts
severity: stuck
status:   open

### B6 · Proving the number offers the patient's already-claimed record again, and claiming it gives an error page
round R1 · step PA6.2/PA6.5 · found by PATIENTS-A · shot docs/simulation-run/shots/R1/P1-PA6.2.png, P1-PA6.5-send.png, P1-PA6.5.png, P2-PA6.2.png
expected: After the invite claim (PA7.3), /patient/claim should list no open challenge for the record that is already claimed
saw:      After the code was checked, the page showed 'يحتفظ معالج بملاحظات لشخص يحمل رقم هاتفك... L•••• D•••' with 'نعم، أرسل لي رمزًا'. The next screen said 'تفقد بريدك الإلكتروني' (check your email), but the code went by WhatsApp. Entering the valid code and pressing 'طالِب بهذا السجل' gave 'حدث خطأ من جانبنا'. P2 was offered her own claimed record in the same way.
where:    /patient/claim
severity: stuck
status:   open

### B7 · The first load of the invite link showed the error page
round R1 · step PA7.1 · found by PATIENTS-A · shot docs/simulation-run/shots/R1/P1-PA7.1.png (retry)
expected: The invite page renders ('معالجك أرسل لك هذا')
saw:      The first visit from an ar-EG phone browser showed 'Something went wrong · حدث خطأ ما' with html lang=en. The same link loaded fine a minute later. This shot was overwritten by the retry
where:    /patient/invite/<token>
severity: stuck
status:   open

### B8 · The top-ups staff member cannot reach the sponsors list
round R1 · step AD7.8 · found by OPS · shot docs/simulation-run/shots/R1/SU3-AD7.8-list.png
expected: SU3 (Amal), whose queue is sponsors and pot top-ups, can reach the sponsor detail page. AD7.8 says a staff member reads /admin/sponsors/[id].
saw:      /admin/sponsors is super_admin only and sends her to not-yours. /admin/sponsors/[id] does open for staff (requireStaff), but only by typing the URL.
where:    /admin/sponsors
severity: stuck
status:   open

### B9 · WhatsApp payment confirmation has no link, and the Arabic message has an English amount
round R1 · step AD5.3 · found by OPS
expected: The /join link is in the WhatsApp message, and the Arabic message shows its amount in Arabic.
saw:      The message says 'Use the link below' but has no link and ends with 'EGP 600'. Layla's Arabic message ends with 'EGP 1,000' in English.
where:    outbox +201009000042 and +201009000041
severity: stuck
status:   open

### B10 · Public page headline price in USD for an Egypt clinician priced in EGP
round R1 · step TH4.1 · found by THERAPISTS-A · shot /home/user/habiba/docs/simulation-run/shots/R1/TA-VISITOR-TH4.1-public2.png
expected: EGP shown first to every user (EGP 1,000)
saw:      The /t/<T1> page shows '$20' as the main price, with 'EGP 1,000' in small print
where:    /t/[id]
severity: wrong
status:   open

### B11 · Two different 'You keep' amounts for the same price
round R1 · step TH3.5 · found by THERAPISTS-A · shot /home/user/habiba/docs/simulation-run/shots/R1/T1-TH16-oncall.png
expected: One fee and one net figure
saw:      For 1000 EGP, /settings says 'You keep EGP 850, 24Therapy fee (15%) EGP 150' and /on-call says 'You keep EGP 900'
where:    /settings Getting paid vs /on-call
severity: wrong
status:   open

### B12 · Settings 'Your details' licence fields blank after approval
round R1 · step TH3.1 · found by THERAPISTS-A · shot /home/user/habiba/docs/simulation-run/shots/R1/T1-TH3.1.png
expected: The card says 'the licence we checked', so it should show the approved licence number EG-PSY-10041
saw:      Licence number, type, state and credentials are empty and read-only for T1, T2 and T3
where:    /settings You
severity: wrong
status:   open

### B13 · Resubmit is enabled after a rejection with nothing changed
round R1 · step TH2.6 · found by THERAPISTS-B · shot docs/simulation-run/shots/R1/T4-TH2.6-rejected.png
expected: Per flows TH2.6, replacing a document moves the state from rejected to draft, and only then is 'Submit for verification' enabled again
saw:      Right after the rejection, 'Submit for verification' is already enabled with the same documents. submitForReview only checks that the fields are present, so the same blurred licence can be sent back unchanged
where:    /onboarding (submitForReview in app/(app)/onboarding/actions.ts:214)
severity: wrong
status:   open

### B14 · 'Your public page' link for a rejected clinician leads to a 404
round R1 · step TH2.6 · found by THERAPISTS-B · shot docs/simulation-run/shots/R1/T4-TH2.6-publicpage.png
expected: Hide the link, or explain the page is not public until the clinician is verified
saw:      It opens a 404 'We could not find that page', and the 404 is served with HTTP status 200
where:    /settings > You > 'Your public page' -> /t/e52c0885-9b00-41c8-a366-204d58ff7db8
severity: wrong
status:   open

### B15 · Manager invite email has the wrong footer
round R1 · step CL1.3 · found by CLINIC
expected: A footer that fits a practice manager's account invite
saw:      'This message was sent by 24Therapy about an appointment you booked. If you were not expecting it, you can safely ignore it.'
where:    outbox hana.example@example.com, 'Your 24Therapy account', 2026-09-25T18:51:48Z
severity: wrong
status:   open

### B16 · Seats page shows solo-plan copy, no price line at 0, and '1 seats'
round R1 · step CL6.1 · found by CLINIC · shot docs/simulation-run/shots/R1/C1-M-CL6.1-quote-1seat.png
expected: A card reading '{count} seats, {monthly} a month.' with a 'Number of seats' slider, and correct plurals
saw:      'Your own plan. Add seats to bring colleagues onto one account.' then a bare slider showing 0 and no price line. After moving to 1 seat: '1 seats: EGP 4,000 a month, up from EGP 0.' and a button 'Change to 1 seats'.
where:    /clinic/seats
severity: wrong
status:   open

### B17 · Records page shows confusing developer wording, is a dead end, and is half English in Arabic
round R1 · step CL11.2 · found by CLINIC · shot docs/simulation-run/shots/R1/C1-M-CL-read-records.png
expected: 'Connect {name}' controls, or a plain explanation for a manager of why connecting is not available
saw:      A yellow card: 'This deployment cannot hold a connection yet. It needs no client registration and no token sealing key.' This is developer wording, and it reads as if nothing is needed. There is no control on the page. In Arabic it reads 'لا يستطيع هذا النشر حفظ ربط بعد. يحتاج no client registration and no token sealing key.'
where:    /clinic/records
severity: wrong
status:   open

### B18 · Coverage editor shows balance EGP 0 / 0 sessions although the pot holds money
round R1 · step CO8.1 · found by COMPANIES · shot docs/simulation-run/shots/R1/E1-HR-CO8.1-100-moved.png
expected: Preview uses the real or published balance: $100 = EGP 5,000 = about 5 sessions at the time. The code comment says 'Null is NOT zero and must never be rendered as it'
saw:      'At 100% you pay EGP 1,000 of a EGP 1,000 session, so your balance of EGP 0 covers about 0 sessions.'
where:    /sponsor/pot, What you cover editor
severity: wrong
status:   open

### B19 · Payment receipt page refuses to issue the receipt
round R1 · step CO7.4 · found by COMPANIES · shot docs/simulation-run/shots/R1/E1-HR-CO7.4-receipt.png
expected: 'Payment receipt', a number, the line, VAT at its rate, 'Paid'
saw:      Only 'We cannot issue this document yet. Ask us and we will send it.' with no reason and no way to ask. invoiceFor probably returns {missing} because the eg entity's legal name, address or tax id is not in the invoice settings
where:    /sponsor/pot/43af6783-aa3d-4e04-9aac-691de6391790
severity: wrong
status:   open

### B20 · Abandoned EGP 5,700 cart lingers as 'Sent it? Tap to finish' after the real top-up is confirmed
round R1 · step CO7.5 · found by COMPANIES · shot docs/simulation-run/shots/R1/E1-HR-CO7.5-stalebar.png
expected: After the confirm no pending bar is left, or only one for the payment actually declared
saw:      Just pressing Pay now opened an EGP 5,700 cart at the default $100 step. Choosing $500 created a separate EGP 28,500 cart. After confirmation every sponsor page shows 'Your pot top-up EGP 5,700 Sent it? Tap to finish. Open' for a payment she never made. 'Open' only links to /sponsor/pot
where:    every /sponsor page
severity: wrong
status:   open

### B21 · Invite card names the patient as the one keeping the notes
round R1 · step PA7.3 · found by PATIENTS-A · shot docs/simulation-run/shots/R1/P2-PA7.2.png, P1-PA7.2.png
expected: Copy that names the therapist who keeps the notes, or reads clearly
saw:      'S•••• E•••••• keeps notes under this name' / 'يحتفظ L•••• D••• بملاحظات تحت هذا الاسم': the patient's own masked name is the subject
where:    /patient/invite/<token>
severity: wrong
status:   open

### B22 · Transfer sheet promises a bank transfer but shows only InstaPay
round R1 · step PA12.1 · found by PATIENTS-A · shot docs/simulation-run/shots/R1/P2-PA12.1.png
expected: Bank details, per the flows doc
saw:      Heading 'InstaPay / Bank Transfer' but only '24therapy@instapay'; no bank account shown
where:    /pay/<token>
severity: wrong
status:   open

### B23 · Emails to staff, managers, companies and clinicians carry a patient footer
round R1 · step AD2.2 · found by OPS
expected: The footer fits the reader: staff, a practice manager, a company, or a clinician.
saw:      The console code email and every account invite end with 'This message was sent by 24Therapy about an appointment you booked.' T4's own password reset ends 'This message was sent by your therapist through 24Therapy'.
where:    outbox: console code email, 'Your 24Therapy account' invites, 'Your payment is confirmed', therapist password reset
severity: wrong
status:   open

### B24 · Account invite emails do not name the organisation or the role
round R1 · step AD7.4 · found by OPS
expected: The invite says which practice, company or partner it is for, and in what role.
saw:      The whole body is only 'Choose your password. The link works once.'
where:    outbox hana/dalia/tamer 'Your 24Therapy account'
severity: wrong
status:   open

### B25 · /admin/clinics is slow, and 'Billed from' never shows the current region
round R1 · step AD12.1 · found by OPS · shot docs/simulation-run/shots/R1/OP-AD12.1-before.png
expected: The page loads in under 8 seconds and shows the current region, eg.
saw:      The first load took 13.4 seconds. 'Billed from' shows only the other choice ('US'), so it reads as if the practice is billed from US. Nothing confirms that Create manager worked. The browser console logs React hydration error #418.
where:    /admin/clinics (also /admin/sponsors)
severity: wrong
status:   open

### B26 · Overview tiles count far more practices and clinicians than exist
round R1 · step AD1.4 · found by OPS · shot docs/simulation-run/shots/R1/OP2-AD19b-1.png
expected: Clinicians 3 and Practices 1 plus the 3 solo practices, on day 1.
saw:      Practices 5 and Clinicians 11. It looks like staff and the founder are counted as clinicians.
where:    /admin
severity: wrong
status:   open

### B27 · No confirmation line after confirming the last transfer in the queue
round R1 · step AD5.3 · found by OPS · shot docs/simulation-run/shots/R1/SU1-AD5.3-P1.png
expected: The page shows 'Confirmed. They can carry on.'
saw:      It showed only when another row was still waiting. After confirming the last row (Cairo Foundry, and Layla), the page said only 'Nothing waiting'.
where:    /admin/transfers
severity: wrong
status:   open

### B28 · Company payment-confirmed email greets the company and links to the home page
round R1 · step AD7.7 · found by OPS
expected: It greets Dalia and links to /sponsor/pot.
saw:      'Hi Cairo Foundry', 'Open your account' linking to https://24therapy.app, and the appointment footer.
where:    outbox dalia.example@example.com
severity: wrong
status:   open

### B29 · Partner first-password page states the wrong rule and gives no confirmation
round R1 · step PT3 · found by PARTNER-WEB · shot docs/simulation-run/shots/R1/D1-PT3-welcome.png
expected: the partner rule of at least 12 characters (PT3), and a 'password set' confirmation on sign-in; the account email names Helio Health and the developer role
saw:      'Choose a new password' with 'At least 10 characters.', 'Update password' leads to /partner/sign-in with no confirmation; the email 'Your 24Therapy account' names neither partner nor role and ends 'about an appointment you booked'
where:    /welcome/[token] for a partner user
severity: wrong
status:   open

### B30 · Home promises clinicians online now and shows invented $50-$75 clinicians while the radar is empty
round R1 · step WB1 · found by PARTNER-WEB · shot docs/simulation-run/shots/R1/VIS-WB_.png
expected: a live count equal to the /radar list (WB1), and demo prices in line with real ones
saw:      no live count; the copy says 'the radar has clinicians online this minute' and 'FREE NOW' cards show Dr Nour Demo/Dr Karim Example/Dr Salma Demo at $60/$75/$50, while /radar says 'Nobody is online right now' and real clinicians charge $12-$20. 'Dr Karim Example' collides with the real T3 'Karim Demo'
where:    / (and /for-patients, /for-therapists mockups)
severity: wrong
status:   open

### B31 · Pricing says 'No seat fee' next to a per-seat clinic price
round R1 · step WB3 · found by PARTNER-WEB · shot docs/simulation-run/shots/R1/VIS-WB_pricing.png
expected: consistent pricing copy
saw:      'Joining is free. No seat fee, no setup fee, no minimum.' directly under the Clinic plan at '$72 a seat, a month'. /pricing and /radar also have no h1
where:    /pricing, / and /for-therapists
severity: wrong
status:   open

### B32 · Arabic legal pages and integrations page are entirely English
round R1 · step WB4 · found by PARTNER-WEB · shot docs/simulation-run/shots/R1/VIS-WB_ar_privacy.png
expected: Arabic content under lang=ar
saw:      titles and all body text in English ('Privacy Policy', 'Terms of Service', 'Compliance', 'Security', 'What this connects to'). The footer links Privacy/Terms/Compliance/Security stay English on every Arabic page, including /patient/signup
where:    /ar/privacy, /ar/terms, /ar/hipaa, /ar/security, /ar/integrations, and the footer on every Arabic page
severity: wrong
status:   open

### B33 · Contact form sends no acknowledgement and has no topic for partners or companies
round R1 · step WB5 · found by PARTNER-WEB · shot docs/simulation-run/shots/R1/VIS-WB5.png
expected: the sender receives the reference and a way back to the ticket
saw:      the reference JAXBB6 is shown only on screen and nothing arrives in the outbox. Topics are patient/therapist-only plus 'Something else'
where:    /contact
severity: wrong
status:   open

### B34 · Arabic verify form drops the /ar prefix and answers in English
round R1 · step WB13 · found by PARTNER-WEB · shot docs/simulation-run/shots/R1/VIS-WB13-ar.png
expected: the result in Arabic
saw:      the form submits to /verify?code=..., and the result page is lang=en English; /ar/verify/ABCD-1234 also lands on English /verify. The page nests two <main> elements
where:    /ar/verify and /ar/verify/[code]
severity: wrong
status:   open

### B35 · Not-found page returns HTTP 200
round R1 · step WB24 · found by PARTNER-WEB · shot docs/simulation-run/shots/R1/VIS-WB6_nothing-here.png
expected: HTTP 404 (WB24)
saw:      curl status 200 with the 'We could not find that page' body (a soft 404)
where:    /nothing-here, /pay, /t/<unknown>, /verify/<code>
severity: wrong
status:   open

### B36 · English on Arabic clinician screens
round R1 · step TH3.2 · found by THERAPISTS-A · shot /home/user/habiba/docs/simulation-run/shots/R1/T3-TH3.2-ar-dashboard.png
expected: Every label translated once the locale is ar
saw:      /dashboard shows 'Pay as you go', /onboarding shows 'Practising licence or syndicate card', /settings shows 'Speed · 1.0×'
where:    T3 in Arabic
severity: cosmetic
status:   open

### B37 · Onboarding 'Nearly there' checklist does not update after uploads
round R1 · step TH2.2 · found by THERAPISTS-A · shot /home/user/habiba/docs/simulation-run/shots/R1/T1-TH2.2.png
expected: The list shrinks as each document lands
saw:      After three uploads showed 'uploaded', the list still named 'Photo ID' and 'Licence document' as missing until the page was reloaded
where:    /onboarding
severity: cosmetic
status:   open

### B38 · Egypt shows no regulator chips
round R1 · step TH2.1 · found by THERAPISTS-A · shot /home/user/habiba/docs/simulation-run/shots/R1/T1-TH2.1.png
expected: One-tap regulator chips under 'Regulator or licensing body' (TH2.1)
saw:      No chips appear for EG, so the regulator has to be typed. Also, the country option value is 'EG', not 'eg' as 00-LESSONS.md says.
where:    /onboarding
severity: cosmetic
status:   open

### B39 · Record invite to an Arabic-speaking patient goes out in English
round R1 · step TH5.1 · found by THERAPISTS-A · shot /home/user/habiba/docs/simulation-run/shots/R1/T1-TH5.1-Layla-form.png
expected: A way to set the patient's language when adding them, so Layla's messages are in Arabic
saw:      The add-patient form has no language field, and Layla's claim invite is in English
where:    /patients Add a patient
severity: cosmetic
status:   open

### B40 · Slow or failed loads
round R1 · step TH1.1 · found by THERAPISTS-A · shot /home/user/habiba/docs/simulation-run/shots/R1/T1-TH16-oncall.png
expected: Pages load in under 8 s
saw:      The first /signup load took 10.8 s and rendered with no form (it happened twice). Once /on-call returned 502 'upstream request failed' after 10.8 s, and it worked on retry. This may be the agent proxy rather than the product.
where:    /signup, /on-call
severity: cosmetic
status:   open

### B41 · A clinician's own password-reset email has a footer written for patients
round R1 · step TH1.5 · found by THERAPISTS-B · shot docs/simulation-run/shots/R1/T4-TH1.5.png
expected: A footer written for a clinician resetting their own password
saw:      'This message was sent by your therapist through 24Therapy. If you were not expecting it, you can safely ignore it.'
where:    outbox omar.demo@example.com, 'Reset your 24Therapy password' at 19:53:20
severity: cosmetic
status:   open

### B42 · Rejection email says 'Sign in' but has no link
round R1 · step TH2.5 · found by THERAPISTS-B
expected: A link to sign in or to /onboarding
saw:      The body says 'Sign in and update your details.' but sim:inbox shows no link line for it, while the reset email does have one
where:    outbox email 'We need something else from you'
severity: cosmetic
status:   open

### B43 · First-password page says 'new password', gives no confirmation, and the spent link is unexplained
round R1 · step CL1.4 · found by CLINIC · shot docs/simulation-run/shots/R1/C1-M-CL1.4-reuse.png
expected: A page to choose a first password, then a line saying the password is set on the sign-in page. A spent link should say the link was already used.
saw:      The page reads 'Choose a new password' with a button 'Update password'. After submitting, it goes to /clinic/sign-in with no message. Reopening the link shows only 'The link may be old, or the page has moved.' with 'Back to sign in', and no heading.
where:    /welcome/<token>
severity: cosmetic
status:   open

### B44 · Time zone name stays in English on the Arabic week page
round R1 · step CL9.1 · found by CLINIC · shot docs/simulation-run/shots/R1/C1-M-CL-ar-clinic.png
expected: The whole line in Arabic
saw:      'الأوقات بتوقيت Cairo'
where:    /clinic (Arabic)
severity: cosmetic
status:   open

### B45 · Clinic sign-in form once failed to render within 30 s
round R1 · step CL1.5 · found by CLINIC
expected: The form renders in under 8 s
saw:      One load did not show the 'Email address' field within 30 s. The retry loaded in 4.0 s, and other loads took 4-4.5 s to network idle.
where:    /clinic/sign-in
severity: cosmetic
status:   open

### B46 · Transfer sheet copy is inconsistent
round R1 · step CO7.1 · found by COMPANIES · shot docs/simulation-run/shots/R1/E1-HR-CO7.1-submitted.png
expected: Minimum and timing stated the same way everywhere, and a 'Track your payment' link on the bar
saw:      The sheet says 'Send at least EGP 5,000' while the minimum transfer is EGP 5,700 incl. VAT. The bar says 'Usually within a few hours' while the sheet says 'Usually a few minutes.' The bar's link reads 'Open'. After the first press, the Pay now button disappears and the sheet reopens on every load
where:    /sponsor/pot
severity: cosmetic
status:   open

### B47 · Transfer emails address the company, link to the home page, and use the wrong footer
round R1 · step CO7.2 · found by COMPANIES
expected: Addressed to Dalia, with 'Track it'/'Open your account' going to /sponsor/pot and a footer that fits a company
saw:      'Hi Cairo Foundry'. Both links go to https://24therapy.app. The footer says 'sent ... about an appointment you booked'
where:    outbox dalia.example@example.com 20:12:26 and 20:13:37
severity: cosmetic
status:   open

### B48 · First-password page for the company admin has wrong copy and no confirmation
round R1 · step CO1.3 · found by COMPANIES · shot docs/simulation-run/shots/R1/E1-HR-CO1.3-welcome.png
expected: A first-password page, the same length rule as the portal (twelve characters), then a 'Password set' line on sign-in
saw:      'Choose a new password' / 'Update password' with hint 'At least 10 characters.' while /sponsor/team says 'twelve characters or more'. It lands on /sponsor/sign-in with no confirmation. The invite email names neither the company nor the role, and ends 'about an appointment you booked'
where:    /welcome/<token>
severity: cosmetic
status:   open

### B49 · Slow patient pages
round R1 · step PA10.2 / PA23 · found by PATIENTS-A · shot docs/simulation-run/shots/R1/P2-PA10.2.png, P1-sweep_patient_summary.png
expected: Pages load in under 8 s
saw:      /patient/sessions took 13.2 s once (3 s later on); /patient/summary took 12.6 s
where:    /patient/sessions, /patient/summary
severity: cosmetic
status:   open

### B50 · English left on Arabic patient screens
round R1 · step PA9.3/PA10.1/PA12.1/PA23/PA1.1 · found by PATIENTS-A · shot docs/simulation-run/shots/R1/P1-PA12.1.png, P1-PA10.1.png, P1-PA9.3.png, P1-PA23-settings-ar.png
expected: Every P1 screen fully in Arabic
saw:      '(Cairo)' on booking confirmations and session cards; 'Cairo' as the settings time zone; 'Egypt'/'United States' in the number-change country select; 'InstaPay / Bank Transfer' and 'Fastest option' on /pay; 'Egyptian Supreme Council for Mental Health' on the therapist page; footer 'Privacy/Terms/Compliance/Security' and the whole IANA timezone list in English on /patient/signup; WhatsApp claim codes in English until the language was saved
where:    patient app in Arabic
severity: cosmetic
status:   open

### B51 · Masculine Arabic forms for a female therapist
round R1 · step PA9.3 · found by PATIENTS-A · shot docs/simulation-run/shots/R1/P1-PA9.3.png
expected: Correct gender for Dr Amira
saw:      'ليس في مناوبته الآن', 'راجعنا مستنداته. ولا نقيّم عمله', 'فور أن يصبح Amira متاحًا'
where:    /patient/t/<T1>
severity: cosmetic
status:   open

### B52 · Patient code and reset emails carry the wrong footer
round R1 · step PA3.1/PA4.1 · found by PATIENTS-A · shot outbox salma.example@example.com 20:28
expected: A footer that fits a sign-in code or password reset
saw:      'This message was sent by 24Therapy about an appointment you booked.' on sign-in, claim and reset codes
where:    email templates
severity: cosmetic
status:   open

### B53 · Some buttons ignore a press made right after the page loads
round R1 · step PA4.1/PA6.1/PA5.2 · found by PATIENTS-A
expected: The button works once visible
saw:      Once each: 'Send me a code' on forgot-password sent nothing, 'Send me a code' on /patient/claim did not respond for 30 s, and 'Sign out' could not be found for 30 s. Each worked on retry. Likely a press before the page hydrated
where:    /patient/forgot-password, /patient/claim, /patient/account
severity: cosmetic
status:   open

### B54 · Join page contradicts itself for a signed-in patient
round R1 · step PA12.3 · found by PATIENTS-A · shot docs/simulation-run/shots/R1/P2-PA12.3-pay.png
expected: Only 'Joining as {name}' for a signed-in patient
saw:      'No account needed. Just tell us what to call you.' shown with 'Joining as Salma.' (same in Arabic)
where:    /join/<token>
severity: cosmetic
status:   open

### B55 · Language save shows no confirmation
round R1 · step PA23 · found by PATIENTS-A · shot docs/simulation-run/shots/R1/P1-PA23.lang.png
expected: A 'Saved' line
saw:      The page reloaded with no confirmation; the saved language did work at the next sign-in
where:    /patient/account?tab=settings
severity: cosmetic
status:   open

### B56 · Two vault cards share the title 'HELD FOR CLINICIANS'
round R1 · step AD11 · found by OPS · shot docs/simulation-run/shots/R1/OP2-AD19b-3.png
expected: Each card has its own title.
saw:      One card says 'Nothing held $0 ... straight into its clinician's own account'. The other says '$0 Earned, not yet paid out'. Both have the same title.
where:    /admin/vault
severity: cosmetic
status:   open

### B57 · Raw internal codes shown in the transfer modal and sponsor detail
round R1 · step AD7.7 · found by OPS · shot docs/simulation-run/shots/R1/SU3-AD7.7-evidence.png
expected: Human labels.
saw:      The modal subtitle reads 'pot_topup, waiting 1 min' or 'session, waiting 0 min'. The sponsor Transfers list shows the states 'awaiting_proof' and 'confirmed'. It also lists a stray $114 cart that was opened just by pressing Pay now.
where:    evidence modal and /admin/sponsors/[id]
severity: cosmetic
status:   open

### B58 · /partner/deliveries slow with 502s on first load
round R1 · step PT4 · found by PARTNER-WEB · shot docs/simulation-run/shots/R1/D1-PT4_partner_deliveries.png
expected: under 8 s, no server errors
saw:      12.2 s to network idle with two 'Failed to load resource: 502 (Bad Gateway)' console errors; the next two loads took 3.3 s and 1.7 s and were clean
where:    /partner/deliveries
severity: cosmetic
status:   open

### B59 · /security slow on the phone
round R1 · step WB4 · found by PARTNER-WEB · shot docs/simulation-run/shots/R1/VISM-WB_security.png
expected: under 8 s
saw:      11.3 s to network idle once; 1.9 s on desktop
where:    /security (phone viewport)
severity: cosmetic
status:   open

### B60 · Booking form fields have no visible labels
round R1 · step WB7 · found by PARTNER-WEB · shot docs/simulation-run/shots/R1/VISM-WB7-form.png
expected: labelled fields
saw:      placeholder-only inputs (first name, email, phone, note). The country default is correctly Egypt +20
where:    /t/[id] booking form
severity: cosmetic
status:   open

### B61 · The session page says the whole session was captured when only one side was
round R1b · step TH8.7 · found by R1b · shot shots/R1b/T1-TH8.7.png, T2-TH8.7.png
expected: when only one recorder was captured, the page and the note say so
saw:      "The whole session was captured and this note was drafted from it", and the note reads the therapist's words as the patient's
where:    session page provenance line and the note prompt
severity: safety
status:   open

### B62 · The therapist's own microphone lines are labelled as the patient's
round R1b · step TH8.4 · found by R1b · shot shots/R1b/T1-TH8.7.png
expected: every line from the clinician's own recorder is "You"
saw:      of 32 lines from Amira's microphone, 8 were labelled Them and 9 Not sure
where:    speaker attribution for the local track
severity: wrong
status:   open

### B63 · Arabic speech is transcribed in Latin letters
round R1b · step TH8.4 · found by R1b · shot shots/R1b/T1-TH8.7.png
expected: Arabic speech comes back in Arabic script
saw:      «يعني صعب عليكي ترفضي» became "Jani, sa ba' li tirfudi."
where:    the transcription call does not pass the session's language
severity: wrong
status:   open

### B64 · A paid booking can be started nine hours early without a word
round R1b · step TH8.3 · found by R1b · shot shots/R1b/T1-TH8.3.png
expected: starting a booked session well before its hour asks for confirmation, and the booked time stays on the page
saw:      started at 00:26 for a 10:00 booking; the page then shows 00:30; the patient got "your session has started" at midnight
where:    startSession for a session with scheduled_at
severity: wrong
status:   open

### B65 · A finished session is still listed as upcoming for the patient
round R1b · step PA18.4 · found by R1b · shot shots/R1b/P1-PA18.4-past.png
expected: a completed session moves to Past
saw:      /patient and /patient/sessions show "Today, Sat 26 Sep 10:00" and Past says "No sessions yet"
where:    lib/data/patient-view.ts groupOf sorts by booked time and ignores status
severity: wrong
status:   open

### B66 · The therapist never sees the patient's yes to recording before Start
round R1b · step TH8.2 · found by R1b · shot shots/R1b/T1-TH8.2.png
expected: the consent strip updates when the patient says yes
saw:      "Waiting for {name}'s yes on their screen" stays beside "{name} is in the room" after the yes
where:    therapist room consent strip polling
severity: wrong
status:   open

### B67 · English in the Arabic room clock and feedback tags
round R1b · step PA16.3, PA18.1 · found by R1b · shot shots/R1b/P1-PA16.3.png
expected: Arabic throughout for an Arabic patient
saw:      "just started", "2 min so far", and every feedback tag ("Listened properly", "Rushed") in English
where:    room clock and rating tags
severity: cosmetic
status:   open

### B68 · The therapist's session banner names the therapist instead of the patient
round R1b · step TH8.6 · found by R1b · shot shots/R1b/T1-TH8.6.png
expected: "Session with Layla" on Amira's pages
saw:      "Session with Amira Demo · EGP 1,000 · Paid"
where:    live session banner on clinician pages
severity: cosmetic
status:   open

Not a product bug, recorded so nobody chases it: video never connected in either R1b session because this run's network proxy does not carry WebSocket upgrades (the Daily handshake fails with 404). Online sessions in this run record the therapist's side only, so from R2 the therapist's browser plays the two-voice file.
