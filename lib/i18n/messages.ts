/**
 * Every string the product says, in both languages.
 *
 * Flat and dotted rather than nested, for one reason: `MessageKey` is derived
 * from this object and `ar` below is declared against it, so a missing Arabic
 * string is a type error. Nesting would need mapped types to get the same
 * guarantee and would still let a whole sub-tree go missing quietly.
 *
 * Conventions for anyone adding to this:
 *
 *   - Keys are `area.thing`, lower case, and describe *where it is* rather
 *     than what it says. `join.consent.question` survives a rewrite of the
 *     question; `join.mayWeRecord` does not.
 *   - Interpolation is `{name}` and is done by `format` in `server.ts`. There
 *     is no logic in the dictionary — no plural helpers, no conditionals —
 *     because a translator should never have to read code.
 *   - Arabic here is Modern Standard, addressed to a Gulf reader, and phrased
 *     for somebody in distress rather than for a legal reviewer. Where English
 *     is deliberately plain ("Do not close this tab"), Arabic is too.
 */

export const en = {
  /* ------------------------------------------------------------ generic -- */
  "common.continue": "Continue",
  "common.cancel": "Cancel",
  "common.back": "Back",
  "common.close": "Close",
  "common.saving": "Saving…",
  "common.saved": "Saved",
  "common.loading": "Loading…",
  "common.somethingWrong": "Something went wrong. Please try again.",
  "common.language": "Language",

  /* -------------------------------------------------------------- join -- */
  "join.title": "Join your session",
  "join.subtitleFree": "No account needed. Just tell us what to call you.",
  "join.subtitlePaid":
    "No account needed. Tell us what to call you, then pay to enter.",
  "join.firstName": "Your first name",
  "join.receiptEmail": "Email for your receipt",
  "join.optional": "Optional.",
  "join.thisSession": "This session",
  "join.submitFree": "Join session",
  "join.submitPaid": "Pay {amount} and join",
  "join.joining": "Joining…",
  "join.openingCheckout": "Opening checkout…",
  "join.nameRequired": "Please enter your first name.",
  "join.nameTooLong": "That name is a little long.",
  "join.linkDead":
    "This link is no longer valid. Ask your therapist for a new one.",
  "join.tooManyAttempts": "Too many attempts. Wait a moment and try again.",
  "join.privateNote":
    "Your session is private and is not shared with anyone else.",
  /*
     "goes to your therapist" is still true; "goes *straight* to your
     therapist" no longer always is, and the difference is a promise. When the
     clinician is mid-verification the platform takes the payment and passes
     their share on. The patient's card handling is unchanged either way, which
     is the part this line exists to reassure them about.
  */
  "join.privateNotePaid":
    "Payment is handled by Stripe and goes to your therapist. We never see your card. Your session is private and is not shared with anyone else.",
  "join.paymentReceived": "Payment received",
  "join.takingYouIn": "Taking you into your session…",

  /* ----------------------------------------------------------- consent -- */
  "consent.question": "May your therapist record this session?",
  "consent.point.notes":
    "The recording is turned into your therapist's clinical notes, and a plain-language summary for you.",
  "consent.point.private":
    "Only your therapist can see it. It is never sold, never used for advertising, and never shown to another patient.",
  "consent.point.changeMind":
    "You can change your mind during the session: ask your therapist to stop and the recording indicator turns amber.",
  "consent.refusal":
    "If you say no the session still happens, exactly the same. Your therapist writes their notes by hand instead.",
  "consent.grant": "Yes, you may record",
  "consent.decline": "No, please do not record",
  "consent.required":
    "Please choose whether your therapist may record the session.",
  "consent.pickOne": "Please choose one.",
  "consent.gate.title": "One question before you go in",
  "consent.gate.body":
    "Your therapist is ready. This takes a second and you can say no.",
  "consent.gate.submit": "Go in",
  "consent.gate.submitting": "Going in…",

  /* -------------------------------------------------------- the room -- */
  "room.beforeYouGo": "Before you go",
  "room.doNotClose": "Do not close this tab.",
  "room.youGetToRate":
    "You get to rate {therapist} and this session as soon as it ends, right here, on this page.",
  "room.closingCost":
    "Closing the tab is the one thing we cannot undo: the rating and your written summary both live on the other side of it, and there is no way for us to bring you back.",
  "room.anonymous":
    "Your rating is anonymous. {therapist} sees the stars and the words, never who wrote them.",
  "room.recording": "Recording",
  "room.notRecording": "Not being recorded",
  "room.recordingPaused": "Recording paused",
  "room.waitingForTherapist": "Waiting for your therapist to join",
  "room.verified": "Verified by 24Therapy",
  "room.speaks": "Speaks {languages}",
  "room.summaryTitle": "A written summary, afterwards",
  "room.summaryBody":
    "When {therapist} joins we will ask where to send it, a plain-language note of what you talked about and what you agreed.",
  "room.goodToKnow": "Good to know",
  "room.knowRecording":
    "The recording is used to write your therapist's notes. It is not shared with anyone else.",
  "room.knowSummary":
    "You get a plain-language summary. Your therapist's clinical note stays with them.",
  "room.knowEmergency":
    "This is not an emergency service. If you are in immediate danger, call your local emergency number.",
  "room.troubleTitle": "Something is wrong, tell 24Therapy",
  "room.ended": "The session has ended",
  "room.endedBody":
    "One minute of feedback and we will email you a plain-language summary of what you talked about and what you agreed.",
  "room.rateAndGet": "Rate the session and get my summary",
  "room.linkDead": "This link is no longer active",
  "room.linkDeadBody":
    "Session links expire after 12 hours and stop working once the session has finished. Ask your therapist to send you a new one.",

  /* ---------------------------------------------------------- feedback -- */
  "feedback.thanks": "Thank you",
  "feedback.rateTherapist": "How was {therapist}?",
  "feedback.rateSession": "How was the session itself?",
  "feedback.rateApp": "How easy was 24Therapy to use?",
  "feedback.comment": "Anything you want to add?",
  "feedback.commentHint":
    "Optional. Your therapist sees this, never your name.",
  "feedback.email": "Where should we send your summary?",
  "feedback.submit": "Send and get my summary",
  "feedback.expired": "This link has expired",
  "feedback.expiredBody":
    "Session links stay open for three days. If you still need your summary, ask your therapist to send it again.",
  "feedback.emergency":
    "If you are in immediate danger, call your local emergency number.",

  /* ---------------------------------------------------------- pricing -- */
  /*
   * 🔴 21R.8 — the public pages are the ones a stranger reads, and until this
   * sprint every word of them outside the CMS blocks was English.
   *
   * The Arabic pricing page rendered an English component: the row existed in
   * Arabic (C72 checked that), the *page* did not. A reader who switched
   * language and found the money page in English is being asked to trust a
   * number they cannot read the conditions of.
   */
  "pricing.free": "Joining is free. You pay per session.",
  "pricing.freeBody":
    "No subscription, no seat fee, no setup fee, and your first completed session is on us.",
  "pricing.perSession": "/ session",
  "pricing.tier.payg": "Pay as you go",
  "pricing.tier.starter": "Starter",
  "pricing.tier.growth": "Growth",
  "pricing.payg": "Pay for the sessions you actually run. Nothing up front.",
  "pricing.bundle": "Buy {count} or more at once.",
  "pricing.includes":
    "The session and {count} copilot questions about that patient, each answer citing the session and timestamp it came from.",
  "pricing.feature.transcription": "Live transcription, Arabic and English",
  "pricing.feature.note": "SOAP note in under a minute",
  "pricing.feature.report": "Patient report by email",
  "pricing.feature.video": "Video or in-person sessions",
  "pricing.feature.alerts": "Crisis-language alerts",
  "pricing.feature.getPaid":
    "Get paid by patients, through the Crisis Radar and paid session links",
  "pricing.feature.baa": "HIPAA BAA included",
  "pricing.signUp": "Sign up free",
  "pricing.orBundle": "or buy a bundle of {count}",
  "pricing.noFees":
    "Joining is free. No subscription, no seat fee, no setup fee.",
  "pricing.credits":
    "You pay per session, only when you run one, and your first completed session is free. Credits last {months} months and are always spent before anything new is billed, so moving to a smaller bundle never strands what you paid for.",
  "pricing.radarLead": "Get booked on the Crisis Radar.",
  "pricing.radarBody":
    "Patients find you and book you, and we take {percent}% of what that session paid you, and nothing else.",
  "pricing.netting":
    "When we are holding your earnings, the session fee comes out of them automatically, so there is nothing to pay by card. If your patients pay straight into your own Stripe account, we bill you for it instead.",
  "pricing.sliderLabel": "{name}: how many sessions?",
  "pricing.showEgp": "Show EGP",
  "pricing.showUsd": "Show USD",
  "pricing.sliderAt": "{count} sessions at {price} each",
  "pricing.sliderOnce": "paid once, used over {months} months",
  "pricing.sliderSaved":
    "The same {count} sessions pay-as-you-go would be {payg}. You keep {saved}.",

  /*
   * 🔴 Safety copy (21.7). The crisis block's own words come from the CMS; the
   * buttons under it did not, and an Arabic reader met two English buttons at
   * the moment they most needed to understand one. These are the fallbacks and
   * the actions, in both languages, and no bulk machine approval can publish a
   * change to them.
   */
  "crisis.headingDefault": "If you need help right now",
  "crisis.bodyDefault":
    "If you are in immediate danger, call your local emergency number now. This is not an emergency service and nobody here can reach you fast enough. If you can wait a few minutes, the radar has clinicians online this minute and you do not need an account to use it.",
  "crisis.findSomeone": "Find someone online now",
  "crisis.whatHappens": "What happens in a session",
  "crisis.noAccountLine":
    "No account, no card, no form. You give a first name and you are in a session.",

  /* --------------------------------------------------------- contact -- */
  /*
   * 21R.8 — the contact form was English on the Arabic page, including the
   * warning above it. A form somebody cannot read is a form they do not send,
   * and the people most likely to need this one are the ones least likely to
   * read English.
   */
  "contact.urgentLead": "Do not send anything urgent here.",
  "contact.urgentBody":
    "This reaches a person during working hours, not in the next ten minutes. If you need somebody now, open the radar. Clinicians are online this minute and you need no account. If you are in immediate danger, call your local emergency number.",
  "contact.radarWord": "radar",
  "contact.name": "What should we call you?",
  "contact.reply": "How should we reply?",
  "contact.replyHint":
    "An email address or a phone number, whichever you actually read. One is enough.",
  "contact.country": "Country",
  "contact.countryAria": "Country for the phone number",
  "contact.phone": "Phone number",
  "contact.topic": "What is this about?",
  "contact.topic.account": "My account or signing in",
  "contact.topic.billing": "A payment or a bill",
  "contact.topic.my_record": "My record, claiming it, or what is in it",
  "contact.topic.a_session": "Something about a session I had",
  "contact.topic.a_therapist": "A therapist on the platform",
  "contact.topic.joining_as_a_therapist": "Joining as a therapist",
  "contact.topic.something_else": "Something else",
  "contact.entity": "Who are you writing to?",
  "contact.entityHint": "Both reach the same team.",
  "contact.entityUs": "24Therapy Inc., international",
  "contact.entityEg": "24Therapy Egypt, Egypt",
  "contact.message": "Your message",
  "contact.attach": "Attach a photo or PDF",
  "contact.attachHint":
    "Optional. Up to 25 MB. Only the person answering you sees it.",
  "contact.send": "Send",
  "contact.sending": "Sending…",
  "contact.kept":
    "What you write is kept like anything else you tell a clinician here: stored, access controlled, read only by the person answering you, and never used to train anything.",
  "contact.received": "We have it.",
  "contact.reference":
    "Your reference is {reference}. A named person picks this up and answers within {hours} hours, by email or by message, whichever you left us. If it is urgent, do not wait for us: use the radar.",
  "contact.attachmentFailed":
    "Your message is safe, but the attachment did not go through: {reason}",

  /* ---------------------------------------------------------- blocks -- */
  "blocks.address": "Address",
  "blocks.email": "Email",
  "blocks.hours": "Hours",
  "blocks.phone": "Phone",

  /* ----------------------------------------------------------- radar -- */
  "radar.checking": "Checking who is on shift…",
  "radar.online": "{count} online right now",
  "radar.private": "Private and encrypted",
  "radar.noAccount": "No account needed",
  "radar.goOnRadar": "I'm a therapist: go on the radar",
  "radar.full": "Full radar",
  "radar.finding": "Finding clinicians…",
  "radar.fromPrice": "From {price} for 30 minutes",
  "radar.free": "free",
  "radar.nobody": "Nobody is on the radar this minute",
  "radar.nobodyMatching": "Nobody matching that is on shift",
  "radar.appearWhenOnline":
    "Clinicians appear the moment they go online. If you need help now, call your local emergency number.",
  "radar.othersAvailable": "{count} other clinicians are available.",
  "radar.showEveryone": "Show everyone",
  /*
   * 🔴 A safety string (21.7): `crisis.` and this line are the two places on a
   * public page where being wrong is not a typo. The Arabic names no US
   * number — 988 means nothing in Cairo, and a number that looks like help and
   * is not is worse than no number.
   */
  "crisis.notEmergency":
    "Not an emergency service. If you are in immediate danger, call your local emergency number.",

  /* -------------------------------------------------------------- nav -- */
  "nav.features": "Features",
  "nav.pricing": "Pricing",
  "nav.contact": "Contact",
  "nav.privacy": "Privacy",
  "nav.terms": "Terms",
  "nav.compliance": "Compliance",
  "nav.security": "Security",
  "nav.signIn": "Sign in",
  "nav.startFree": "Start free",
  "nav.talkNow": "Talk now",

  /*
   * The crisis line is deliberately not one number.
   *
   * 988 is the US lifeline and means nothing in Abu Dhabi; printing it to a
   * Gulf reader is worse than printing nothing, because it looks like help and
   * is not. Each language names what its readers can actually dial.
   */
  /*
   * 🔴 21R.8 / C98 — the English line no longer prints 988 either.
   *
   * English is not a country. An Egyptian clinician reading the product in
   * English got the United States lifeline, and a number that looks like help
   * and does not dial is worse than the sentence that is true everywhere.
   * `lib/crisis/line.ts` prints a real number where one is verified.
   */
  "urgent.footer":
    "If you need urgent help, call your local emergency number at any time.",

  /* ================================================================ 37L ==
   *
   * The patient app. PLAN.md 37L.1, C182.
   *
   * 🔴 Written as Arabic first where it matters, and English second.
   *
   * The order is not a formality. A sentence composed in English and then
   * translated carries English sentence shape — subordinate clauses, the
   * passive, "we will" constructions — and reads in Arabic like a form from a
   * ministry. These were written as the thing a person says, in each language,
   * and where the two are not literal translations of each other that is on
   * purpose and the Arabic is the one that was written second-guessed least.
   *
   * Keys are grouped by screen because that is how they are reviewed: a
   * translator opens one screen at a time, and a key that cannot be placed on
   * a screen cannot be checked against it.
   */

  /* ---------------------------------------------------- the patient's home */
  "home.greeting": "Hello, {name}",
  "home.recordYours": "Your record is yours",
  "home.recordUnclaimed": "Your record is not claimed yet",
  "home.yourAccount": "Your account",
  "home.searchPlaceholder": "What do you want help with?",
  "home.findNow": "Find someone now",
  "home.findNowBody": "Therapists who are online and free this minute.",
  "home.claimedTitle": "That record is yours now",
  "home.claimedKept":
    "Your therapist can still see your profile. You can change that whenever you like, under who can read your history.",
  "home.claimedDropped":
    "Your therapist keeps the notes they already wrote, and can no longer see your live profile. You can give access back at any time.",
  "home.askedTitle": "Somebody asked to read your history",
  "home.askedOne": "A therapist has asked. You decide, and you can change your mind later.",
  "home.askedMany": "{count} therapists have asked. You decide, and you can change your mind later.",
  "home.answerNow": "Answer now",
  "home.beforeNext": "To try before your next session",
  "home.openIt": "Open it",
  "home.openAndMore": "Open this and {count} more",
  "home.areas": "Areas people come here for",
  "home.ratedHighest": "Rated highest by patients",
  "home.ratedHighestBody":
    "Only therapists with at least five rated sessions. Below that there is no score to show, so they are not here.",
  "home.yourRecord": "Your record",
  "home.yours": "Yours",
  "home.notClaimed": "Not claimed yet",
  "home.filesAttached": "{count} therapist file attached.",
  "home.filesAttachedMany": "{count} therapist files attached.",
  "home.noFiles": "No therapist files are attached to your account yet.",
  "home.claimAnother": "Claim another record",
  "home.haveRecords": "Do you have records to claim?",
  "home.openProfile": "Open your profile",
  "home.journal": "Your journal",
  "home.summary": "Your clinical summary",
  "home.whoCanRead": "Who can read your history",
  "home.getCopy": "Get a copy of everything",

  /* ------------------------------------------------------------ navigation */
  "tab.sessions": "Sessions",
  "tab.steps": "Steps",
  "tab.billing": "Billing",
  "tab.you": "You",
  "tab.radar": "Find someone now",
  "tab.inSession": "You are in a session",
  "tab.sections": "Sections",
  "tab.session": "Session",
  "tab.leaveTitle": "Leave your session?",
  "tab.leaveBody":
    "Your therapist is still there. The session keeps running, and the Session tab brings you straight back.",
  "tab.stay": "Stay",
  "tab.leaveAnyway": "Leave anyway",

  /* -------------------------------------------------------------- sessions */
  "psessions.title": "Your sessions",
  "psessions.all": "All",
  "psessions.upcoming": "Upcoming",
  "psessions.past": "Past",
  "psessions.none": "No sessions yet",
  "psessions.noneBody": "When you book one, or find somebody on the radar, it appears here.",
  "psessions.radarGroup": "When you needed someone",
  "psessions.radarGroupBody": "Sessions you found on the radar, without booking.",
  "psessions.free": "Free",
  "psessions.join": "Join",

  /* --------------------------------------------------------------- journal */
  "journal.title": "Your journal",
  "journal.body":
    "Whatever you want to keep. Between sessions, a week is a long time to remember, and this is yours whether or not you ever show it to anybody.",
  "journal.whoCanOpen": "Who can open this",
  "journal.nobody":
    "Nobody. You have not given any therapist access to your history, so what you write here stays with you until you do.",
  "journal.readers": "These therapists can read your journal: {names}.",
  "journal.placeholder": "Today…",
  "journal.save": "Save this",
  "journal.dictate": "Say it instead",
  "journal.dictating": "Listening…",
  "journal.empty": "Nothing written yet.",

  /* --------------------------------------------------------------- summary */
  "psummary.title": "Your clinical summary",
  "psummary.body":
    "Written by the therapists you have seen, about the course of your therapy rather than one session. It is yours. Every version stays, with the name of whoever wrote it, and nobody can take one back.",
  "psummary.none": "Nothing has been written yet.",
  "psummary.noneBody":
    "A therapist adds a version when they finish a session. It is theirs to write and yours to keep.",
  "psummary.version": "Version {n} · {date}",

  /* ---------------------------------------------------------- whole record */
  "precord.title": "Your whole record",
  "precord.body":
    "Everything this platform holds about your therapy, in one document you can keep, print, or hand to somebody.",
  "precord.copyTitle": "A copy of everything",
  "precord.copyBody":
    "We send a record extract to an email address and nowhere else. Not WhatsApp: it is the most personal document we hold about you, and a message on a shared phone is not where it belongs.",
  "precord.addEmail": "Add an email to get your record",
  "precord.send": "Send it to {email}",
  "precord.sending": "Sending…",
  "precord.sent": "On its way. Check your email.",

  /* --------------------------------------------------------------- profile */
  "pprofile.title": "Your profile",
  "pprofile.body":
    "Letters, prescriptions, reports and anything you want a therapist to know. It travels with you, you decide who reads it.",
  "pprofile.sayInstead": "Want to say how things have been?",
  "pprofile.sayInsteadBody":
    "Write a journal instead. It is yours, a therapist you have given access to can read it, and it is a lot easier than filing paperwork about yourself.",
  "pprofile.empty":
    "Nothing here yet. Letters, prescriptions, scans and old reports all belong here, a photograph of a page is fine.",

  /* ---------------------------------------------------------------- browse */
  "browse.title": "Find a therapist",
  "browse.placeholder": "Anxiety, sleep, a language…",
  "browse.none": "Nobody has been listed yet.",
  "browse.noneBody": "The radar shows who is free right now, and it is the quickest way in.",
  "browse.openRadar": "Open the radar",

  /* -------------------------------------------------------------- homework */
  "homework.title": "What to try",
  "homework.body": "Small things you and your therapist agreed on. Do them or do not, nobody is counting.",
  "homework.none": "Nothing yet",
  "homework.noneBody": "Your therapist adds these after a session.",
  "homework.done": "Done",
  "homework.markDone": "Mark it done",

  /* --------------------------------------------------------------- billing */
  "pbilling.title": "Billing",
  "pbilling.body": "What you paid, and exactly where it went.",
  "pbilling.none": "Nothing paid yet",
  "pbilling.noneBody": "Sessions you pay for appear here with the full breakdown.",
  "pbilling.note":
    "The headline figure is what you were actually charged, in the currency you paid in, at the rate quoted at the time. The breakdown is in the currency your therapist is paid in. That is the amount a refund would return.",

  /* --------------------------------------------------------------- account */
  "paccount.title": "Your account",
  "paccount.body": "Your account and who can see your record.",
  "paccount.addPhoto": "Add a photo",
  "paccount.signOut": "Sign out",
  "paccount.language": "Language",
  "paccount.languageBody": "The app and everything we send you.",

  /* ------------------------------------------------------------- residency */
  "residency.title": "Where your record is kept",
  "residency.home": "In {country}, which is where it belongs. Nothing crosses a border, so there is nothing for you to agree to here.",

  /* ----------------------------------------------------------------- claim */
  "pclaim.title": "Have you seen a therapist before?",
  "pclaim.body": "If they already keep notes about you, you can take ownership of them, {name}.",
  "pclaim.handleTitle": "First, is this number yours?",
  "pclaim.handleBody":
    "We have not looked yet. A phone number proves a number, not a person, so we check that you can receive a message at {handle} before we say anything about any record.",
  "pclaim.sendCode": "Send me a code",
  "pclaim.codeLabel": "Six-digit code",
  "pclaim.checkCode": "Check the code",
  "pclaim.channelDown":
    "Codes over WhatsApp are not switched on yet, so one may not arrive. Ask your therapist for an invite link instead: it does the same thing.",
  "pclaim.nothingFound": "We could not find a record under that number.",
  "pclaim.nothingFoundBody":
    "That is normal. Your therapist can send you an invite link, which works straight away.",

  /* ---------------------------------------------------------------- invite */
  "pinvite.title": "Your therapist sent you this",
  "pinvite.body": "{name} has invited you to take ownership of the record they keep for you.",
  "pinvite.signedOut": "Create an account or sign in, and we will bring you straight back here.",
  "pinvite.create": "Create an account",
  "pinvite.signIn": "Sign in",
  "pinvite.takeTitle": "Take ownership of your record",
  "pinvite.takeBody":
    "Your therapist keeps notes under the name {masked}. Claiming it means the record is yours: it travels with you, and you decide who reads it.",
  "pinvite.keepAccess": "Let this therapist keep seeing my profile",
  "pinvite.keepAccessBody":
    "Off by default, even though they sent you this link. If you leave it off they keep the notes they already wrote and nothing else. You can change it whenever you like.",
  "pinvite.claimIt": "This is me, claim it",
  "pinvite.claiming": "Claiming…",
  "pinvite.dead": "This link is no longer valid.",
  "pinvite.deadBody": "Ask your therapist for a new one. They can issue another in a moment.",

  /* ------------------------------------------------- 🔴 the crisis sheet */
  "crisis.sheetTitle": "Help now",
  "crisis.sheetBody": "These are phone numbers, not a chat. They connect you to a person.",
  "crisis.yourPractice": "Your practice",
  "crisis.orbLabel": "SOS, get help now",
  "crisis.anywhereElse":
    "Anywhere else, call your local emergency number. It is free from any phone, and works with no credit and no SIM.",

  /* ------------------------------------------------ 🔴 consent, the patient's */
  "consent.pageTitle": "Who can read your history",
  "consent.pageBody":
    "Your history is yours. A therapist can ask to read it, and you can stop them at any time, they do not have to agree and you do not have to explain.",
  "consent.waiting": "Waiting for your answer",
  "consent.nobodyAsked": "Nobody has asked to read your history.",
  "consent.whoHasAccess": "Who has access",
  "consent.nobodyCanRead":
    "Nobody can read your history. Your therapists still keep their own notes about the sessions you had with them, that part is their record, not yours to remove.",
  "consent.yesDay": "Yes, for 24 hours",
  "consent.yesUntil": "Yes, until I change my mind",
  "consent.no": "No thanks",
  "consent.stop": "Stop their access",
  "consent.canRead": "Can read",
  "consent.cannotRead": "Cannot read",
  "consent.untilChange": "Until you change your mind",
  "consent.expired": "Expired",
  "consent.until": "Until {date}",
  "consent.youEnded": "You ended this on {date}",
  "consent.youDeclined": "You declined",
  "common.working": "Working…",
  "consent.askedOn": "Asked on {date}",
  "consent.stopNote":
    "Stopping access stops any further reading straight away. It does not erase what a therapist already read or the notes they wrote, those are their own clinical records, which they are required to keep.",
  "consent.newTherapist": "Seeing somebody new?",
  "consent.newTherapistBody":
    "Give them a code. They enter it, which asks you whether they may read your history, and you decide then. Nothing about you moves until you say yes, and the code on its own shows them nothing.",
  "consent.inviteTherapist": "Invite a therapist",
  "consent.goodUntil": "Good until {date}",
  "consent.cancelCode": "Cancel it",
  "consent.usedWaiting": "Used by {name}. Their request is waiting for your answer above.",
  "consent.usedAnswered": "Used by {name}. You have already answered them.",
  "consent.readItOut":
    "Read it to your therapist. It works until {date}, once, and you will be asked to approve before they can read anything.",
  "consent.askOld": "Ask a therapist you saw before to add what they hold",
  "consent.askOldBody":
    "They do not have to, and we cannot make them. What we can do is make sure you hear back: they either add it, or they say no and tell you why.",
  "consent.chooseTherapist": "Choose a therapist you have seen",
  "consent.askThem": "Ask them",
  "consent.askNote": "Anything you want to say to them (optional)",
  "consent.askWaiting": "Waiting. They have been told, and they can see it on their own screen.",
  "consent.askAdded": "They added what they hold.",
  "consent.askDeclined": "They said no. In their words: “{reason}”",
  "pprofile.diagnoses": "Diagnoses on your record",
  "pprofile.diagnosesBody":
    "Taken from the documents above, in their own words, and confirmed by a clinician.",
  "pprofile.flagNote":
    "If any of this is out of date or wrong, flag it on the document it came from. Flagging marks it for every clinician who reads it. It does not erase what was written, because a medical record has to stay as it was.",
  "browse.searchAria": "What do you need help with?",
  "browse.nothingMatched":
    "Nobody on 24Therapy has listed that yet. Try one of the areas below, or open the radar to see who is free right now.",
  "browse.areas": "What do you want help with?",
  "browse.areasBody": "Only areas a verified therapist has actually listed. The number is how many.",
  "paccount.phone": "Phone",
  "paccount.email": "Email",
  "paccount.timezone": "Time zone",
  "paccount.addEmailBody":
    "You signed up with your phone number. Adding an email lets you sign in with it too, and is the only way we can send you a copy of your record.",
  "paccount.whoCanSee": "Who can see your record",
  "paccount.whoCanSeeBody": "Give access, take it back, and see what you were asked.",
  "paccount.ownDocuments": "Your own documents",
  "paccount.ownDocumentsBody": "Anything you have uploaded or written down about yourself.",
  "paccount.notAdded": "Not added",
  "paccount.notSet": "Not set",
  "pauth.signInTitle": "Your sessions",
  "pauth.signInBody": "Sign in to see your notes, your homework and who can read your record.",
  "pauth.signUpTitle": "Create your account",
  "pauth.signUpBody": "Your record becomes yours: it travels with you, and you decide who reads it.",
  "pauth.signUpInvited":
    "{name} invited you. Your record becomes yours: it travels with you, and you decide who reads it.",
  "pauth.forgot": "Forgot your password?",
  "pauth.newHere": "New here?",
  "pauth.alreadyHaveOne": "Already have one?",
  "pauth.createAccount": "Create an account",
  "pauth.signIn": "Sign in",
  "pauth.areYouTherapist": "Are you a therapist?",
  "pauth.practiceSignIn": "Sign in to your practice",
  "pauth.practiceSignUp": "Create a practice account",
  "pauth.practiceReset": "Reset your practice password",
  "pauth.resetTitle": "Get back into your account",
  "pinvite.usedTitle": "This link is no longer valid",
  "pinvite.usedBody":
    "It may have been used already, expired, or been taken back. Ask your therapist for a new one.",
  "pclaim.noneTitle": "Nothing to claim yet",
  "pclaim.noneBody":
    "We could not find a record under your email or phone number. That is completely normal, most therapists write a name down and nothing else.",
  "pclaim.noneAsk":
    "If you know your therapist keeps notes about you, ask them for an invite link. It takes them one tap and it connects that exact record to this account.",
  "pclaim.skip": "Skip for now",
  "pclaim.doneTitle": "That record is yours now",
  "pclaim.doneKept": "Your therapist can still see your profile. You can change that at any time.",
  "pclaim.doneDropped":
    "Your therapist keeps the notes they wrote, but can no longer see your live profile. You can give access back whenever you want to.",
  "pclaim.goToSessions": "Go to my sessions",
  "pclaim.checkWhatsapp": "Check WhatsApp",
  "pclaim.checkEmail": "Check your email",
  "pclaim.codeSent": "We sent a six-digit code. It expires in thirty minutes.",
  "pclaim.fellBack": "We could not reach you on WhatsApp, so the code went to your email instead.",
  "pclaim.yourCode": "Your code",
  "pclaim.keepAccess": "Let this therapist keep seeing my profile",
  "pclaim.keepAccessBody":
    "If you leave this off, they keep the notes they already wrote and nothing else, no new sessions, no live profile. You can turn it on later, and off again, whenever you like.",
  "pclaim.notMe": "This is not me",
  "pclaim.matchedEmail": "A therapist keeps notes for someone with your email address, under the name:",
  "pclaim.matchedPhone": "A therapist keeps notes for someone with your phone number, under the name:",
  "pclaim.isThatYou": "Is that you?",
  "pclaim.yesSendCode": "Yes, send me a code",
  "pclaim.initialsOnly":
    "We only show initials until you have confirmed the code. Nobody learns anything about you from this screen that you did not already tell us.",
  "consent.sayWhy": "You can say why, or say nothing. Either is fine.",
  "pclaim.everything": "That is everything",
  "pclaim.seenBefore": "Have you seen {name} before?",
  "pclaim.seenBeforeBody":
    "Your number matched a record they keep. If you have never seen them, say no. Nothing about that record is shown to you either way.",
  "pclaim.noHaveNot": "No, I have not",
  "pclaim.typeName": "Type it as you gave it to them. We will not show it to you.",
  "pclaim.firstName": "First name",
  "pcode.title": "Enter your code",
  "pcode.body":
    "If that phone number or email has an account, a six-digit code is on its way. It expires in ten minutes.",
  "pcode.channelDown":
    "Codes over WhatsApp are not switched on yet, so one may not arrive. If you set a password, sign in with that instead.",
  "pcode.useCode": "Sign in with a code instead",
  "pcode.useCodeBody":
    "No password needed. We send a code to your phone number or your email, whichever you signed up with.",
  "pjournal.placeholder": "How has it been?",
  "psessions.writing": "Your therapist is still writing your summary.",
  "residency.withdraw": "Withdraw that",
  "pidentity.removePhoto": "Remove it",
  "pidentity.photoPrivate":
    "Your photo is not public. It is stored privately and shown only to you and to a therapist you are in a session with.",
  "pauth.invitePhoneNote": "The number your therapist sent this invite to.",
  "pauth.phonePlaceholder": "Phone or WhatsApp",
  "pauth.phoneNote": "This is how you sign in and how your therapist finds you.",
  "radar.freeNow": "Free now",
  "pexport.title": "A copy of everything",
  "pexport.body":
    "Every session, every note your therapists signed, every version of your summary, what you wrote yourself, and the dates. We email a link to {email} and nowhere else. It opens without a password and stops working after three days.",
  "pexport.onItsWay": "On its way to {email}. Nobody here read it.",
  "pexport.button": "Email me my record",
  "pexport.preparing": "Putting it together…",
  "pexport.sent": "Sent",
  "pexport.notCertificate":
    "It is a record extract, not a certificate. It says what we hold and when it was written. It does not say that a diagnosis in it is right, and nothing in it is written for a court.",
  "pidentity.photoPrivateRecord":
    "Your photo is not public. It is stored privately and shown only to you and to a therapist who already has a record for you.",
  "pcode.expires": "It expires in fifteen minutes.",
  "consent.whichTherapist": "Which therapist",
  "preset.changed": "Password changed",
  "preset.changedBody": "You have been signed out everywhere else. Sign in with your new password.",
  "preset.tellUs": "tell us",
  "preset.channelDownLead": "Codes over WhatsApp are not switched on yet. The template is still waiting for approval, so one may not arrive. If you are stuck,",
  "preset.channelDownTail": "and a person will get you back in.",
  "preset.codeLabel": "Six-digit code",
  "preset.askAnother": "Ask for another code",
  "preset.handleLabel": "Phone number or email",
  "preset.sendCode": "Send me a code",
  "preset.backToSignIn": "Back to sign in",
  "preset.title": "Get back into your account",
  "preset.body": "Tell us the phone number or email you sign in with and we will send you a code.",
  "pnumber.requested": "We have your request",
  "pnumber.requestedBody":
    "Somebody will contact the new number to check it is you, then send it a code. Enter that code here and your account moves. Nothing changes until then.",
  "pnumber.yours": "Your number",
  "pnumber.body":
    "This is how we know it is you, so changing it takes a person and a day. We call or message the new number first, then send it a code. Nobody here can move your account without that code.",
  "pnumber.locked":
    "Your number was confirmed recently, so it is locked until {date}. If you cannot wait, write to us and a person will look at it.",
  "pnumber.newNumber": "New number",
  "pnumber.country": "Country",
  "pnumber.mayCall": "You may call or message the new number to check it is me.",
  "consent.cancelIt": "Cancel it",
  "room.yourSession": "Your session",
  "room.started": "Your session has started",
  "room.waiting": "Waiting for your therapist",
  "room.audioOnly": "This is an audio session. You will hear each other.",
  "room.keepOpen": "This page updates by itself the moment they join. Keep it open.",
  "room.trouble":
    "Trouble seeing or hearing? Check your browser has permission to use your camera and microphone, then reload this page.",
  "room.endedTitle": "This session has ended",
  "room.endedAgain":
    "If you and your therapist want to carry on, they can send you a link to a new session.",
  "room.verifiedBody":
    "Verified by 24Therapy, we checked their licence and their ID before they could take a session.",
  "room.thanks": "Thank you",
  "room.howEasy": "How easy was it to find someone?",
  "room.rateApp": "Rate 24Therapy",
  "room.whereSummary": "Where shall we send your summary?",
  "room.emailPlaceholder": "you@example.com",
  "room.sentToUs": "Sent to 24Therapy",
  "room.sentToUsBody": "Someone will read this today. It did not go to your therapist.",
  "room.tellUsTitle": "Tell us what is happening",
  "room.tellUsBody": "This goes straight to 24Therapy. Your therapist does not see it.",
  "room.tellUsPlaceholder": "What is happening right now.",
  "psteps.none": "Nothing to do right now",
  "psteps.noneBody": "When you and your therapist agree on something to try, it appears here.",
  "psteps.anythingToSay": "Anything you want to say about it? You do not have to.",
  "psteps.didThis": "I did this",
  "psteps.couldNot": "I could not do this one",
  "jconsent.yourChoices": "Your choices",
  "jconsent.recordLabel": "Record this session",
  "jconsent.recordDetail": "Your therapist's notes are written from the recording.",
  "jconsent.profileLabel": "Share my profile",
  "jconsent.profileDetail": "Lets this therapist see the history you have built up elsewhere.",
  "jconsent.on": "On",
  "jconsent.turnOn": "Turn on",
  "jconsent.changeAnyTime": "You can change these at any time during the session.",
  "jconsent.cannotUndo":
    "Changed your mind about recording? It cannot be switched off part-way, anything already recorded exists. Ask your therapist to end the session, and answer no next time.",
  "radar.globeLabel": "A globe showing where therapists are online right now",
  "radar.spinningUp": "Spinning up…",
  "radar.clearFilters": "Clear all filters",
  "radar.thirtyMinutes": "30 minutes, starting now",
  "radar.walkIns": "Walk-ins",
  "radar.oneHour": "One hour",
  "radar.everyoneOnShift": "Everyone on shift",
  "radar.filtersOn": "{count} filters on",
  "radar.oneFilterOn": "1 filter on",
  "radar.othersAvailableOne": "1 other clinician is available right now.",
  "radar.othersAvailableMany": "{count} other clinicians are available right now.",
  "radar.noOne": "No one",
  "radar.onShift": "on shift",
  "radar.oneOnShift": "therapist on shift",
  "radar.manyOnShift": "therapists on shift",
  "radar.countFree": "{count} free",
  "radar.dragToSpin": "Drag to spin, tap a country to filter",
  "radar.narrowDown": "Narrow it down",
  "radar.whoIsFree": "Who is free",
  "radar.ratings": "Ratings",
  "radar.nobodyYet": "Nobody is on the radar yet",
  "radar.nobodyYetBody":
    "Clinicians appear here the moment they go online. If you need help right now, call your local emergency number.",
  "radar.nobodyMatchingTitle": "Nobody matching that is on shift",
  "prating.yourSession": "Your session",
  "prating.summaryOnWay": "Your summary is below, and a copy is on its way to your inbox.",
  "prating.stillWriting":
    "{name} is still writing up the session. Your summary will arrive by email as soon as it is approved, usually within the hour.",
  "prating.keepLink": "Your summary is below. Keep this link if you want to come back to it.",
  "prating.yourSummary": "Your summary",
  "prating.writtenForYou":
    "This is written for you. Your therapist keeps a separate clinical note, which stays with them.",
  "prating.oneMinute": "One minute, and your summary is yours",
  "prating.andSession": "And the session itself?",
  "prating.andApp": "And 24Therapy itself?",
  "prating.andAppBody": "Finding someone, connecting, the app.",
  "prating.anythingElse": "Anything else?",
  "prating.optional": "Optional",
  "prating.noName": "Your therapist sees this without your name on it.",
  "prating.commentPlaceholder": "What helped, what did not.",
  "prating.whereSummary": "Where shall we send your summary?",
  "prating.summaryBody":
    "A plain-language summary of what you talked about and what you agreed. We use this address for that and to reach you about this session, nothing else.",
  "prating.ratingsAndEmail": "The ratings and an email address, and it is yours.",
  "prating.reported": "Reported",
  "prating.neverJoined": "They never joined, I want my money back",
  "prating.reportSomething": "Report something that happened in this session",
  "prating.reportPlaceholder": "What happened, and roughly when in the session.",
  "prating.replyEmail": "Your email, so we can reply (optional)",
  "pbook.noTimes": "No times on the calendar",
  "pbook.bookSession": "Book a session",
  "pbook.firstName": "Your first name",
  "pbook.email": "Email",
  "pbook.phone": "Phone or WhatsApp",
  "pbook.oneOfThese": "Give us one of these so we can send you the link and tell you if anything changes.",
  "pbook.note": "Anything they should know before you meet? (optional)",
  "pbook.pickAnother": "Pick another time",
  "pbook.fullProfile": "See their full profile",
  "pbook.onlyYou": "You are the only one who can book them",
  "pbook.timeLeft": "Time left to complete this booking",
  "pbook.heldBody":
    "This therapist now shows as busy to everyone else. Finish your booking, or close this page so someone else can reach them.",
  "pbook.taken":
    "Someone else is on this profile right now. You can still try, if they do not go ahead, this clinician frees up within a minute.",
  "pbook.unavailable":
    "This clinician has just become unavailable. Close this and pick someone else, the board updates every few seconds.",
  "pbook.noAccount":
    "No account needed. Payment goes to your therapist through Stripe, we never see your card. If you are in immediate danger, call your local emergency number.",
  "pbook.walkIns": "Accepts walk-in visits",
  "pbook.directions": "Get directions",
  "pbook.emailAddress": "Email me the address",
  "pbook.addressSent": "Sent. Check your inbox.",
  "pbook.whereToSend": "Where to send the directions",
  "pbook.addressOnce":
    "We send the address and nothing else, once. It is not stored and you are not signed up to anything.",
  "pbook.notAnAppointment":
    "Turning up is not an appointment. Booking a session above is the only way to be certain someone is free.",
  "pbook.send": "Send",
  "pbook.sending": "Sending…",
  "psessions.which": "Which sessions",
  "psessions.today": "Today",
  "psessions.todayBlurb": "Coming up in the next day.",
  "psessions.booked": "Booked",
  "psessions.bookedBlurb": "Further ahead.",
  "psessions.pastBooked": "Past appointments",
  "psessions.pastBookedBlurb": "Sessions you booked.",
  "pclaim.nothingTitle": "Nothing to claim yet",
  "pclaim.nothingBody":
    "Nobody has written you down under this number or address. If you are seeing a therapist, ask them for an invite link, which works straight away.",
} as const;

export type MessageKey = keyof typeof en;

/**
 * Arabic, and the type that makes it non-optional.
 *
 * `Record<MessageKey, string>` is the enforcement: add a key above without a
 * translation here and the build fails. It is deliberately not
 * `Partial<Record<…>>` with an English fallback — a silent fallback is how a
 * half-Arabic interface ships, and a half-Arabic interface reads as broken
 * rather than as unfinished.
 */
export const ar: Record<MessageKey, string> = {
  "common.continue": "متابعة",
  "common.cancel": "إلغاء",
  "common.back": "رجوع",
  "common.close": "إغلاق",
  "common.saving": "جارٍ الحفظ…",
  "common.saved": "تم الحفظ",
  "common.loading": "جارٍ التحميل…",
  "common.somethingWrong": "حدث خطأ ما. من فضلك حاول مرة أخرى.",
  "common.language": "اللغة",

  "join.title": "ادخل إلى جلستك",
  "join.subtitleFree": "لا حاجة إلى حساب. فقط أخبرنا بما نناديك به.",
  "join.subtitlePaid":
    "لا حاجة إلى حساب. أخبرنا بما نناديك به، ثم ادفع للدخول.",
  "join.firstName": "اسمك الأول",
  "join.receiptEmail": "بريد إلكتروني لإيصال الدفع",
  "join.optional": "اختياري.",
  "join.thisSession": "هذه الجلسة",
  "join.submitFree": "ادخل إلى الجلسة",
  "join.submitPaid": "ادفع {amount} وادخل",
  "join.joining": "جارٍ الدخول…",
  "join.openingCheckout": "جارٍ فتح صفحة الدفع…",
  "join.nameRequired": "من فضلك اكتب اسمك الأول.",
  "join.nameTooLong": "هذا الاسم طويل قليلاً.",
  "join.linkDead": "هذا الرابط لم يعد صالحًا. اطلب من معالجك رابطًا جديدًا.",
  "join.tooManyAttempts": "محاولات كثيرة. انتظر لحظة ثم حاول مرة أخرى.",
  "join.privateNote": "جلستك خاصة ولا تُشارَك مع أي شخص آخر.",
  "join.privateNotePaid":
    "الدفع يتم عبر Stripe ويذهب إلى معالجك، نحن لا نرى بطاقتك أبدًا. جلستك خاصة ولا تُشارَك مع أي شخص آخر.",
  "join.paymentReceived": "تم استلام الدفع",
  "join.takingYouIn": "جارٍ إدخالك إلى جلستك…",

  "consent.question": "هل تسمح لمعالجك بتسجيل هذه الجلسة؟",
  "consent.point.notes":
    "يتحول التسجيل إلى ملاحظات معالجك السريرية، وإلى ملخص بلغة بسيطة لك أنت.",
  "consent.point.private":
    "معالجك وحده من يستطيع الاطلاع عليه. لا يُباع أبدًا، ولا يُستخدم في الإعلانات، ولا يُعرض على مريض آخر.",
  "consent.point.changeMind":
    "يمكنك تغيير رأيك أثناء الجلسة، اطلب من معالجك التوقف وسيتحول مؤشر التسجيل إلى اللون الكهرماني.",
  "consent.refusal":
    "إذا رفضت فالجلسة تتم كما هي تمامًا. سيكتب معالجك ملاحظاته بخط يده بدلاً من ذلك.",
  "consent.grant": "نعم، يمكنك التسجيل",
  "consent.decline": "لا، من فضلك لا تسجّل",
  "consent.required": "من فضلك اختر ما إذا كان يمكن لمعالجك تسجيل الجلسة.",
  "consent.pickOne": "من فضلك اختر واحدًا.",
  "consent.gate.title": "سؤال واحد قبل أن تدخل",
  "consent.gate.body": "معالجك جاهز. لن يستغرق هذا سوى لحظة، ويمكنك أن ترفض.",
  "consent.gate.submit": "ادخل",
  "consent.gate.submitting": "جارٍ الدخول…",

  "room.beforeYouGo": "قبل أن تغادر",
  "room.doNotClose": "لا تغلق هذه الصفحة.",
  "room.youGetToRate":
    "ستتمكن من تقييم {therapist} وتقييم هذه الجلسة فور انتهائها، هنا، في هذه الصفحة.",
  "room.closingCost":
    "إغلاق الصفحة هو الشيء الوحيد الذي لا يمكننا التراجع عنه: التقييم وملخصك المكتوب كلاهما خلفها، ولا سبيل لدينا لإعادتك.",
  "room.anonymous":
    "تقييمك مجهول الهوية. يرى {therapist} النجوم والكلمات، ولا يرى أبدًا من كتبها.",
  "room.recording": "جارٍ التسجيل",
  "room.notRecording": "لا يتم التسجيل",
  "room.recordingPaused": "التسجيل متوقف مؤقتًا",
  "room.waitingForTherapist": "في انتظار انضمام معالجك",
  "room.verified": "موثّق من 24Therapy",
  "room.speaks": "يتحدث {languages}",
  "room.summaryTitle": "ملخص مكتوب، بعد الجلسة",
  "room.summaryBody":
    "عندما ينضم {therapist} سنسألك إلى أين نرسله، ملاحظة بلغة بسيطة عما تحدثتما عنه وما اتفقتما عليه.",
  "room.goodToKnow": "من الجيد أن تعرف",
  "room.knowRecording":
    "يُستخدم التسجيل لكتابة ملاحظات معالجك. ولا يُشارَك مع أي شخص آخر.",
  "room.knowSummary":
    "ستحصل على ملخص بلغة بسيطة. أما الملاحظة السريرية لمعالجك فتبقى عنده.",
  "room.knowEmergency":
    "هذه ليست خدمة طوارئ. إذا كنت في خطر مباشر، اتصل برقم الطوارئ في بلدك.",
  "room.troubleTitle": "هناك خطأ ما، أخبر 24Therapy",
  "room.ended": "انتهت الجلسة",
  "room.endedBody":
    "دقيقة واحدة من رأيك وسنرسل إليك بالبريد ملخصًا بلغة بسيطة عما تحدثتما عنه وما اتفقتما عليه.",
  "room.rateAndGet": "قيّم الجلسة واحصل على ملخصي",
  "room.linkDead": "هذا الرابط لم يعد نشطًا",
  "room.linkDeadBody":
    "روابط الجلسات تنتهي صلاحيتها بعد 12 ساعة وتتوقف عن العمل بمجرد انتهاء الجلسة. اطلب من معالجك أن يرسل لك رابطًا جديدًا.",

  "feedback.thanks": "شكرًا لك",
  "feedback.rateTherapist": "كيف كان {therapist}؟",
  "feedback.rateSession": "وكيف كانت الجلسة نفسها؟",
  "feedback.rateApp": "ما مدى سهولة استخدام 24Therapy؟",
  "feedback.comment": "هل تود إضافة شيء؟",
  "feedback.commentHint": "اختياري. يرى معالجك هذا، ولا يرى اسمك أبدًا.",
  "feedback.email": "إلى أين نرسل ملخصك؟",
  "feedback.submit": "أرسل واحصل على ملخصي",
  "feedback.expired": "انتهت صلاحية هذا الرابط",
  "feedback.expiredBody":
    "تبقى روابط الجلسات مفتوحة لثلاثة أيام. إذا كنت لا تزال بحاجة إلى ملخصك، اطلب من معالجك إرساله مرة أخرى.",
  "feedback.emergency": "إذا كنت في خطر مباشر، اتصل برقم الطوارئ في بلدك.",

  /* pricing — 21R.8. Written as Arabic, not rendered from the English. */
  "pricing.free": "الانضمام مجاني. تدفع عن كل جلسة.",
  "pricing.freeBody":
    "بلا اشتراك، وبلا رسوم مقعد، وبلا رسوم تجهيز، وأول جلسة مكتملة علينا.",
  "pricing.perSession": "/ الجلسة",
  "pricing.tier.payg": "الدفع عند الاستخدام",
  "pricing.tier.starter": "البداية",
  "pricing.tier.growth": "التوسّع",
  "pricing.payg": "ادفع عن الجلسات التي تجريها فعلًا. لا شيء مقدمًا.",
  "pricing.bundle": "اشترِ {count} جلسات أو أكثر دفعة واحدة.",
  "pricing.includes":
    "الجلسة و{count} أسئلة للمساعد عن هذا المريض، وكل إجابة تشير إلى الجلسة والدقيقة التي جاءت منها.",
  "pricing.feature.transcription": "تفريغ مباشر بالعربية والإنجليزية",
  "pricing.feature.note": "ملاحظة سريرية في أقل من دقيقة",
  "pricing.feature.report": "تقرير للمريض بالبريد",
  "pricing.feature.video": "جلسات بالفيديو أو حضوريًا",
  "pricing.feature.alerts": "تنبيهات لغة الأزمة",
  "pricing.feature.getPaid":
    "تقاضَ أجرك من المرضى، عبر رادار الأزمات وروابط الجلسات المدفوعة",
  "pricing.feature.baa": "اتفاقية HIPAA مشمولة",
  "pricing.signUp": "أنشئ حسابك مجانًا",
  "pricing.orBundle": "أو اشترِ باقة من {count} جلسة",
  "pricing.noFees":
    "الانضمام مجاني. بلا اشتراك، وبلا رسوم مقعد، وبلا رسوم تجهيز.",
  "pricing.credits":
    "تدفع عن الجلسة حين تجريها فقط، وأول جلسة مكتملة مجانية. ورصيدك يبقى {months} شهرًا ويُصرف قبل أي محاسبة جديدة، فالانتقال إلى باقة أصغر لا يضيّع ما دفعته.",
  "pricing.radarLead": "احجز مكانك على رادار الأزمات.",
  "pricing.radarBody":
    "يجدك المرضى ويحجزون معك، ونأخذ {percent}% مما دفعته تلك الجلسة لك، ولا شيء غير ذلك.",
  "pricing.netting":
    "حين نكون نحن من يحتفظ بأرباحك تُخصم قيمة الجلسة منها تلقائيًا، فلا شيء تدفعه بالبطاقة. وإن كان مرضاك يدفعون مباشرة إلى حساب Stripe الخاص بك فنرسل إليك الفاتورة بدلًا من ذلك.",
  "pricing.sliderLabel": "{name}: كم جلسة؟",
  "pricing.showEgp": "بالجنيه المصري",
  "pricing.showUsd": "بالدولار",
  "pricing.sliderAt": "{count} جلسة بسعر {price} للجلسة",
  "pricing.sliderOnce": "تُدفع مرة واحدة وتُستخدم على مدى {months} شهرًا",
  "pricing.sliderSaved":
    "السعر نفسه لـ {count} جلسة بالدفع عند الاستخدام {payg}. توفّر {saved}.",

  "crisis.headingDefault": "إن كنت تحتاج مساعدة الآن",
  "crisis.bodyDefault":
    "إن كنت في خطر مباشر فاتصل برقم الطوارئ في بلدك الآن، هذه ليست خدمة طوارئ ولا يستطيع أحد هنا الوصول إليك بالسرعة الكافية. وإن كان بإمكانك الانتظار دقائق، فعلى الرادار معالجون متاحون في هذه اللحظة ولا تحتاج حسابًا لتستخدمه.",
  "crisis.findSomeone": "ابحث عن شخص متاح الآن",
  "crisis.whatHappens": "ماذا يحدث في الجلسة",
  "crisis.noAccountLine":
    "بلا حساب، وبلا بطاقة، وبلا استمارات. تعطي اسمك الأول فتكون داخل الجلسة.",

  "contact.urgentLead": "لا ترسل شيئًا عاجلًا من هنا.",
  "contact.urgentBody":
    "هذه الرسالة تصل إلى شخص خلال ساعات العمل، لا خلال العشر دقائق القادمة. إن كنت تحتاج أحدًا الآن فافتح الرادار، هناك معالجون متاحون في هذه اللحظة ولا تحتاج حسابًا. وإن كنت في خطر مباشر فاتصل برقم الطوارئ في بلدك.",
  "contact.radarWord": "الرادار",
  "contact.name": "بماذا نناديك؟",
  "contact.reply": "كيف نردّ عليك؟",
  "contact.replyHint":
    "بريد إلكتروني أو رقم هاتف، أيّهما تقرأه فعلًا. واحد يكفي.",
  "contact.country": "الدولة",
  "contact.countryAria": "دولة رقم الهاتف",
  "contact.phone": "رقم الهاتف",
  "contact.topic": "عمّ تسأل؟",
  "contact.topic.account": "حسابي أو تسجيل الدخول",
  "contact.topic.billing": "دفعة أو فاتورة",
  "contact.topic.my_record": "ملفي، استلامه، أو ما فيه",
  "contact.topic.a_session": "شيء يخصّ جلسة أجريتها",
  "contact.topic.a_therapist": "معالج على المنصة",
  "contact.topic.joining_as_a_therapist": "الانضمام كمعالج",
  "contact.topic.something_else": "شيء آخر",
  "contact.entity": "إلى مَن تكتب؟",
  "contact.entityHint": "كلاهما يصل إلى الفريق نفسه.",
  "contact.entityUs": "‏24Therapy Inc.، الكيان الدولي",
  "contact.entityEg": "‏24Therapy Egypt، مصر",
  "contact.message": "رسالتك",
  "contact.attach": "أرفق صورة أو ملف PDF",
  "contact.attachHint":
    "اختياري. حتى 25 ميغابايت. لا يراه إلا الشخص الذي يردّ عليك.",
  "contact.send": "إرسال",
  "contact.sending": "جارٍ الإرسال…",
  "contact.kept":
    "ما تكتبه يُحفظ كأي شيء تقوله لمعالج هنا: مخزَّن، ومقيَّد الوصول، ولا يقرأه إلا من يردّ عليك، ولا يُستخدم في تدريب أي نموذج.",
  "contact.received": "وصلتنا رسالتك.",
  "contact.reference":
    "رقمك المرجعي {reference}. يتولّاها شخص باسمه ويردّ خلال {hours} ساعة، بالبريد أو برسالة، حسب ما تركته لنا. وإن كان الأمر عاجلًا فلا تنتظرنا: استخدم الرادار.",
  "contact.attachmentFailed": "رسالتك محفوظة، لكن المرفق لم يصل: {reason}",

  "blocks.address": "العنوان",
  "blocks.email": "البريد",
  "blocks.hours": "المواعيد",
  "blocks.phone": "الهاتف",

  "radar.checking": "نتحقق ممن هو على الخط الآن…",
  "radar.online": "{count} متاحون الآن",
  "radar.private": "خاص ومشفّر",
  "radar.noAccount": "بلا حساب",
  "radar.goOnRadar": "أنا معالج، أريد الظهور على الرادار",
  "radar.full": "الرادار كاملًا",
  "radar.finding": "نبحث عن المعالجين المتاحين…",
  "radar.fromPrice": "ابتداءً من {price} لثلاثين دقيقة",
  "radar.free": "مجانًا",
  "radar.nobody": "لا أحد على الرادار في هذه اللحظة",
  "radar.nobodyMatching": "لا أحد يطابق هذا الاختيار على الخط الآن",
  "radar.appearWhenOnline":
    "يظهر المعالجون فور اتصالهم. وإن كنت تحتاج مساعدة الآن فاتصل برقم الطوارئ في بلدك.",
  "radar.othersAvailable": "{count} معالجين آخرين متاحون.",
  "radar.showEveryone": "اعرض الجميع",
  "crisis.notEmergency":
    "هذه ليست خدمة طوارئ. إن كنت في خطر مباشر فاتصل برقم الطوارئ في بلدك الآن.",

  "nav.features": "المزايا",
  "nav.pricing": "الأسعار",
  "nav.contact": "تواصل معنا",
  "nav.privacy": "الخصوصية",
  "nav.terms": "الشروط",
  "nav.compliance": "الامتثال",
  "nav.security": "الأمان",
  "nav.signIn": "تسجيل الدخول",
  "nav.startFree": "ابدأ مجانًا",
  "nav.talkNow": "تحدث الآن",
  "urgent.footer":
    "إذا كنت بحاجة إلى مساعدة عاجلة، اتصل برقم الطوارئ في بلدك في أي وقت.",

  /* ================================================================ 37L ==
   *
   * تطبيق المريض. PLAN.md 37L.1
   *
   * 🔴 هذه النصوص كُتبت بالعربية، لا مترجَمة عن الإنجليزية. حيث اختلفت الصياغة
   * عن المقابل الإنجليزي فذلك مقصود: الجملة التي يقولها إنسان بالعربية ليست
   * دائمًا هي الجملة نفسها مرتَّبة بترتيب إنجليزي.
   */

  /* ------------------------------------------------------- الصفحة الرئيسية */
  "home.greeting": "أهلًا يا {name}",
  "home.recordYours": "سجلك ملكك",
  "home.recordUnclaimed": "لم تستلم سجلك بعد",
  "home.yourAccount": "حسابك",
  "home.searchPlaceholder": "ما الذي تحتاج مساعدة فيه؟",
  "home.findNow": "ابحث عن أحد الآن",
  "home.findNowBody": "معالجون متاحون في هذه اللحظة.",
  "home.claimedTitle": "أصبح هذا السجل ملكك",
  "home.claimedKept":
    "ما زال معالجك يستطيع رؤية ملفك الشخصي. يمكنك تغيير ذلك وقتما تشاء من صفحة من يمكنه قراءة تاريخك.",
  "home.claimedDropped":
    "يحتفظ معالجك بالملاحظات التي كتبها بالفعل، ولم يعد يرى ملفك الشخصي. يمكنك إعادة الإذن له في أي وقت.",
  "home.askedTitle": "أحدهم طلب قراءة تاريخك",
  "home.askedOne": "طلب معالج قراءة تاريخك. القرار قرارك، ويمكنك تغييره لاحقًا.",
  "home.askedMany": "طلب {count} معالجين قراءة تاريخك. القرار قرارك، ويمكنك تغييره لاحقًا.",
  "home.answerNow": "أجب الآن",
  "home.beforeNext": "لتجربته قبل جلستك القادمة",
  "home.openIt": "افتحه",
  "home.openAndMore": "افتح هذا و{count} غيره",
  "home.areas": "مجالات يأتي الناس إلينا من أجلها",
  "home.ratedHighest": "الأعلى تقييمًا من المرضى",
  "home.ratedHighestBody":
    "المعالجون الذين لديهم خمس جلسات مُقيَّمة على الأقل. ما دون ذلك لا يوجد تقييم يُعرض، فلا يظهرون هنا.",
  "home.yourRecord": "سجلك",
  "home.yours": "ملكك",
  "home.notClaimed": "لم يُستلَم بعد",
  "home.filesAttached": "ملف واحد من معالج مرتبط بحسابك.",
  "home.filesAttachedMany": "{count} ملفات من معالجين مرتبطة بحسابك.",
  "home.noFiles": "لا توجد ملفات من معالجين مرتبطة بحسابك بعد.",
  "home.claimAnother": "استلم سجلًا آخر",
  "home.haveRecords": "هل لديك سجلات تستلمها؟",
  "home.openProfile": "افتح ملفك الشخصي",
  "home.journal": "مذكراتك",
  "home.summary": "ملخصك السريري",
  "home.whoCanRead": "من يمكنه قراءة تاريخك",
  "home.getCopy": "احصل على نسخة من كل شيء",

  /* ------------------------------------------------------------- التنقل */
  "tab.sessions": "الجلسات",
  "tab.steps": "خطوات",
  "tab.billing": "الحساب",
  "tab.you": "أنت",
  "tab.radar": "ابحث عن أحد الآن",
  "tab.inSession": "أنت داخل جلسة",
  "tab.sections": "الأقسام",
  "tab.session": "الجلسة",
  "tab.leaveTitle": "تخرج من جلستك؟",
  "tab.leaveBody":
    "معالجك ما زال هناك. الجلسة مستمرة، وزر الجلسة يعيدك إليها مباشرة.",
  "tab.stay": "ابقَ",
  "tab.leaveAnyway": "اخرج على أي حال",

  /* ------------------------------------------------------------- الجلسات */
  "psessions.title": "جلساتك",
  "psessions.all": "الكل",
  "psessions.upcoming": "القادمة",
  "psessions.past": "السابقة",
  "psessions.none": "لا توجد جلسات بعد",
  "psessions.noneBody": "عندما تحجز جلسة، أو تجد معالجًا متاحًا الآن، ستظهر هنا.",
  "psessions.radarGroup": "حين احتجت إلى أحد",
  "psessions.radarGroupBody": "جلسات وجدتها بين المتاحين الآن، بلا حجز مسبق.",
  "psessions.free": "مجانية",
  "psessions.join": "ادخل",

  /* ------------------------------------------------------------- المذكرات */
  "journal.title": "مذكراتك",
  "journal.body":
    "اكتب ما تشاء. بين الجلسة والأخرى، الأسبوع مدة طويلة على الذاكرة، وهذه المساحة لك سواء أريتها لأحد أم لا.",
  "journal.whoCanOpen": "من يستطيع فتحها",
  "journal.nobody":
    "لا أحد. لم تمنح أي معالج إذنًا بقراءة تاريخك، فما تكتبه هنا يبقى معك وحدك حتى تفعل.",
  "journal.readers": "هؤلاء المعالجون يستطيعون قراءة مذكراتك: {names}.",
  "journal.placeholder": "اليوم…",
  "journal.save": "احفظ هذا",
  "journal.dictate": "قلها بصوتك",
  "journal.dictating": "أستمع…",
  "journal.empty": "لم تكتب شيئًا بعد.",

  /* -------------------------------------------------------------- الملخص */
  "psummary.title": "ملخصك السريري",
  "psummary.body":
    "يكتبه المعالجون الذين رأيتهم، عن مسار علاجك لا عن جلسة واحدة. وهو ملكك. كل نسخة تبقى، ومعها اسم كاتبها، ولا يستطيع أحد سحب نسخته.",
  "psummary.none": "لم يُكتب شيء بعد.",
  "psummary.noneBody":
    "يضيف المعالج نسخة عند انتهاء جلسة. كتابتها له، والاحتفاظ بها لك.",
  "psummary.version": "النسخة {n} · {date}",

  /* --------------------------------------------------------- السجل كاملًا */
  "precord.title": "سجلك كاملًا",
  "precord.body":
    "كل ما تحتفظ به هذه المنصة عن علاجك، في مستند واحد يمكنك حفظه أو طباعته أو تسليمه لمن تشاء.",
  "precord.copyTitle": "نسخة من كل شيء",
  "precord.copyBody":
    "نرسل نسخة السجل إلى بريد إلكتروني ولا نرسلها في أي مكان آخر. ليس عبر واتساب: هذا أكثر مستند خصوصية نحتفظ به عنك، ورسالة على هاتف مشترك ليست مكانه.",
  "precord.addEmail": "أضف بريدًا إلكترونيًا لتصلك نسختك",
  "precord.send": "أرسلها إلى {email}",
  "precord.sending": "جارٍ الإرسال…",
  "precord.sent": "في طريقها إليك. تفقد بريدك.",

  /* ------------------------------------------------------- الملف الشخصي */
  "pprofile.title": "ملفك الشخصي",
  "pprofile.body":
    "التقارير والروشتات والخطابات وأي شيء تريد أن يعرفه معالجك. ينتقل معك، وأنت من يقرر من يقرأه.",
  "pprofile.sayInstead": "تريد أن تحكي كيف كانت الأيام؟",
  "pprofile.sayInsteadBody":
    "اكتب في مذكراتك بدلًا من ذلك. هي ملكك، ويستطيع معالج منحته الإذن أن يقرأها، وهي أسهل كثيرًا من تجهيز أوراق عن نفسك.",
  "pprofile.empty":
    "لا شيء هنا بعد. الخطابات والروشتات والأشعة والتقارير القديمة مكانها هنا، وصورة بالهاتف لصفحة تكفي.",

  /* --------------------------------------------------------------- البحث */
  "browse.title": "ابحث عن معالج",
  "browse.placeholder": "قلق، نوم، لغة معينة…",
  "browse.none": "لم يُدرج أحد بعد.",
  "browse.noneBody": "شاشة المتاحين الآن تعرض من هو متفرغ في هذه اللحظة، وهي أسرع طريق.",
  "browse.openRadar": "افتح شاشة المتاحين",

  /* ------------------------------------------------------------- الخطوات */
  "homework.title": "ما يمكن تجربته",
  "homework.body": "أشياء صغيرة اتفقت عليها مع معالجك. افعلها أو لا تفعلها، لا أحد يحصي عليك.",
  "homework.none": "لا شيء بعد",
  "homework.noneBody": "يضيف معالجك هذه بعد الجلسة.",
  "homework.done": "تم",
  "homework.markDone": "علّمها كمنتهية",

  /* -------------------------------------------------------------- الحساب */
  "pbilling.title": "الحساب",
  "pbilling.body": "ما دفعته، وأين ذهب بالضبط.",
  "pbilling.none": "لم تدفع شيئًا بعد",
  "pbilling.noneBody": "الجلسات التي تدفع مقابلها تظهر هنا بتفصيلها الكامل.",
  "pbilling.note":
    "الرقم الأساسي هو ما خُصم منك فعلًا، بالعملة التي دفعت بها، وبالسعر المعلن وقتها. التفصيل بعملة معالجك، وهو المبلغ الذي يعود إليك عند الاسترداد.",

  /* -------------------------------------------------------------- حسابك */
  "paccount.title": "حسابك",
  "paccount.body": "حسابك ومن يستطيع رؤية سجلك.",
  "paccount.addPhoto": "أضف صورة",
  "paccount.signOut": "تسجيل الخروج",
  "paccount.language": "اللغة",
  "paccount.languageBody": "لغة التطبيق وكل ما نرسله إليك.",

  /* --------------------------------------------------- مكان حفظ السجل */
  "residency.title": "أين يُحفظ سجلك",
  "residency.home": "في {country}، وهو مكانه الطبيعي. لا شيء يعبر الحدود، فلا يوجد ما توافق عليه هنا.",

  /* ------------------------------------------------------------- الاستلام */
  "pclaim.title": "هل زرت معالجًا من قبل؟",
  "pclaim.body": "إن كان يحتفظ بملاحظات عنك، يمكنك استلامها يا {name}.",
  "pclaim.handleTitle": "أولًا، هل هذا الرقم رقمك؟",
  "pclaim.handleBody":
    "لم نبحث بعد. رقم الهاتف يثبت رقمًا لا شخصًا، فنتأكد أولًا أنك تستقبل رسالة على {handle} قبل أن نقول لك أي شيء عن أي سجل.",
  "pclaim.sendCode": "أرسل لي رمزًا",
  "pclaim.codeLabel": "رمز من ستة أرقام",
  "pclaim.checkCode": "تحقق من الرمز",
  "pclaim.channelDown":
    "إرسال الرموز عبر واتساب غير مفعّل بعد، وقد لا يصلك الرمز. اطلب من معالجك رابط دعوة بدلًا من ذلك، فهو يؤدي الغرض نفسه.",
  "pclaim.nothingFound": "لم نجد سجلًا تحت هذا الرقم.",
  "pclaim.nothingFoundBody":
    "هذا أمر طبيعي. يستطيع معالجك إرسال رابط دعوة لك، ويعمل فورًا.",

  /* -------------------------------------------------------------- الدعوة */
  "pinvite.title": "معالجك أرسل لك هذا",
  "pinvite.body": "دعاك {name} لتستلم ملكية السجل الذي يحتفظ به عنك.",
  "pinvite.signedOut": "أنشئ حسابًا أو سجّل الدخول، وسنعيدك إلى هنا مباشرة.",
  "pinvite.create": "أنشئ حسابًا",
  "pinvite.signIn": "تسجيل الدخول",
  "pinvite.takeTitle": "استلم ملكية سجلك",
  "pinvite.takeBody":
    "يحتفظ معالجك بملاحظات تحت اسم {masked}. استلامه يعني أن السجل صار ملكك: ينتقل معك، وأنت من يقرر من يقرأه.",
  "pinvite.keepAccess": "اسمح لهذا المعالج بمواصلة رؤية ملفي",
  "pinvite.keepAccessBody":
    "غير مفعّل افتراضيًا، حتى وإن كان هو من أرسل لك الرابط. إن تركته مغلقًا يحتفظ بالملاحظات التي كتبها ولا شيء غيرها. يمكنك تغيير ذلك وقتما تشاء.",
  "pinvite.claimIt": "هذا أنا، استلمه",
  "pinvite.claiming": "جارٍ الاستلام…",
  "pinvite.dead": "هذا الرابط لم يعد صالحًا.",
  "pinvite.deadBody": "اطلب من معالجك رابطًا جديدًا، ويستطيع إصدار واحد في لحظة.",

  /* ------------------------------------------------- 🔴 شاشة المساعدة الآن */
  "crisis.sheetTitle": "مساعدة الآن",
  "crisis.sheetBody": "هذه أرقام هاتف، لا محادثة. تصلك بإنسان.",
  "crisis.yourPractice": "عيادتك",
  "crisis.orbLabel": "استغاثة، اطلب المساعدة الآن",
  "crisis.anywhereElse":
    "في أي مكان آخر، اتصل برقم الطوارئ في بلدك. الاتصال مجاني من أي هاتف، ويعمل بلا رصيد وبلا شريحة.",

  /* --------------------------------------------------- 🔴 الإذن، من جهة المريض */
  "consent.pageTitle": "من يمكنه قراءة تاريخك",
  "consent.pageBody":
    "تاريخك ملكك. يستطيع المعالج أن يطلب قراءته، وتستطيع أنت إيقافه في أي وقت، لا هو مضطر للموافقة ولا أنت مضطر للشرح.",
  "consent.waiting": "في انتظار ردك",
  "consent.nobodyAsked": "لم يطلب أحد قراءة تاريخك.",
  "consent.whoHasAccess": "من لديه إذن",
  "consent.nobodyCanRead":
    "لا أحد يستطيع قراءة تاريخك. معالجوك يحتفظون بملاحظاتهم عن الجلسات التي حضرتها معهم، وهذا الجزء سجلهم هم، وليس لك إزالته.",
  "consent.yesDay": "نعم، لمدة ٢٤ ساعة",
  "consent.yesUntil": "نعم، حتى أغيّر رأيي",
  "consent.no": "لا، شكرًا",
  "consent.stop": "أوقف إذنه",
  "consent.canRead": "يستطيع القراءة",
  "consent.cannotRead": "لا يستطيع القراءة",
  "consent.untilChange": "حتى تغيّر رأيك",
  "consent.expired": "انتهت مدته",
  "consent.until": "حتى {date}",
  "consent.youEnded": "أوقفته في {date}",
  "consent.youDeclined": "رفضت",
  "common.working": "جارٍ التنفيذ…",
  "consent.askedOn": "طلب في {date}",
  "consent.stopNote":
    "إيقاف الإذن يوقف أي قراءة جديدة فورًا. ولا يمحو ما قرأه المعالج بالفعل ولا الملاحظات التي كتبها، فتلك سجلاته السريرية الملزَم بحفظها.",
  "consent.newTherapist": "تزور معالجًا جديدًا؟",
  "consent.newTherapistBody":
    "أعطه رمزًا. يدخله فيصلك سؤال عما إذا كان يُسمح له بقراءة تاريخك، وتقرر أنت عندها. لا شيء عنك يتحرك حتى توافق، والرمز وحده لا يُظهر له شيئًا.",
  "consent.inviteTherapist": "ادعُ معالجًا",
  "consent.goodUntil": "صالح حتى {date}",
  "consent.cancelCode": "ألغِه",
  "consent.usedWaiting": "استخدمه {name}. طلبه في انتظار ردك بالأعلى.",
  "consent.usedAnswered": "استخدمه {name}. وقد رددت عليه بالفعل.",
  "consent.readItOut":
    "اقرأه على معالجك. يعمل حتى {date}، مرة واحدة، وسيصلك طلب موافقة قبل أن يقرأ أي شيء.",
  "consent.askOld": "اطلب من معالج زرته سابقًا أن يضيف ما لديه",
  "consent.askOldBody":
    "ليس ملزَمًا، ولا نستطيع إجباره. ما نستطيعه هو أن نضمن وصول رد إليك: إما أن يضيف ما لديه، وإما أن يعتذر ويخبرك بالسبب.",
  "consent.chooseTherapist": "اختر معالجًا زرته",
  "consent.askThem": "اطلب منه",
  "consent.askNote": "أي شيء تحب أن تقوله له (اختياري)",
  "consent.askWaiting": "في الانتظار. أُبلغ بالطلب، وهو يراه على شاشته.",
  "consent.askAdded": "أضاف ما لديه.",
  "consent.askDeclined": "اعتذر. بكلماته: «{reason}»",
  "pprofile.diagnoses": "التشخيصات المسجلة عنك",
  "pprofile.diagnosesBody":
    "مأخوذة من المستندات أعلاه، بنصها، ومؤكَّدة من طبيب أو معالج.",
  "pprofile.flagNote":
    "إن كان أي من هذا قديمًا أو غير صحيح، ضع عليه علامة في المستند الذي جاء منه. العلامة تظهر لكل من يقرأه. وهي لا تمحو ما كُتب، لأن السجل الطبي يجب أن يبقى كما كان.",
  "browse.searchAria": "ما الذي تحتاج مساعدة فيه؟",
  "browse.nothingMatched":
    "لم يدرج أحد هذا المجال بعد. جرّب أحد المجالات بالأسفل، أو افتح شاشة المتاحين لترى من هو متفرغ الآن.",
  "browse.areas": "ما الذي تحتاج مساعدة فيه؟",
  "browse.areasBody": "المجالات التي أدرجها معالجون موثّقون فقط. الرقم هو عددهم.",
  "paccount.phone": "الهاتف",
  "paccount.email": "البريد الإلكتروني",
  "paccount.timezone": "المنطقة الزمنية",
  "paccount.addEmailBody":
    "سجّلت برقم هاتفك. إضافة بريد إلكتروني تتيح لك الدخول به أيضًا، وهي الطريقة الوحيدة لإرسال نسخة من سجلك إليك.",
  "paccount.whoCanSee": "من يستطيع رؤية سجلك",
  "paccount.whoCanSeeBody": "امنح الإذن، أو اسحبه، وشاهد ما طُلب منك.",
  "paccount.ownDocuments": "مستنداتك أنت",
  "paccount.ownDocumentsBody": "كل ما رفعته أو كتبته عن نفسك.",
  "paccount.notAdded": "غير مضاف",
  "paccount.notSet": "غير محددة",
  "pauth.signInTitle": "جلساتك",
  "pauth.signInBody": "سجّل الدخول لترى ملاحظاتك وخطواتك ومن يمكنه قراءة سجلك.",
  "pauth.signUpTitle": "أنشئ حسابك",
  "pauth.signUpBody": "سجلك يصبح ملكك: ينتقل معك، وأنت من يقرر من يقرأه.",
  "pauth.signUpInvited":
    "دعاك {name}. سجلك يصبح ملكك: ينتقل معك، وأنت من يقرر من يقرأه.",
  "pauth.forgot": "نسيت كلمة المرور؟",
  "pauth.newHere": "أول مرة هنا؟",
  "pauth.alreadyHaveOne": "لديك حساب بالفعل؟",
  "pauth.createAccount": "أنشئ حسابًا",
  "pauth.signIn": "تسجيل الدخول",
  "pauth.areYouTherapist": "هل أنت معالج؟",
  "pauth.practiceSignIn": "ادخل إلى حساب عيادتك",
  "pauth.practiceSignUp": "أنشئ حساب عيادة",
  "pauth.practiceReset": "استعد كلمة مرور عيادتك",
  "pauth.resetTitle": "استعد الدخول إلى حسابك",
  "pinvite.usedTitle": "هذا الرابط لم يعد صالحًا",
  "pinvite.usedBody":
    "ربما استُخدم من قبل، أو انتهت مدته، أو سُحب. اطلب من معالجك رابطًا جديدًا.",
  "pclaim.noneTitle": "لا يوجد ما تستلمه بعد",
  "pclaim.noneBody":
    "لم نجد سجلًا تحت بريدك أو رقم هاتفك. وهذا طبيعي تمامًا، فأغلب المعالجين يكتبون الاسم فقط ولا شيء غيره.",
  "pclaim.noneAsk":
    "إن كنت تعرف أن معالجك يحتفظ بملاحظات عنك، اطلب منه رابط دعوة. يكلفه ضغطة واحدة، ويربط ذلك السجل تحديدًا بحسابك هذا.",
  "pclaim.skip": "تخطَّ الآن",
  "pclaim.doneTitle": "أصبح هذا السجل ملكك",
  "pclaim.doneKept": "ما زال معالجك يستطيع رؤية ملفك. يمكنك تغيير ذلك في أي وقت.",
  "pclaim.doneDropped":
    "يحتفظ معالجك بالملاحظات التي كتبها، لكنه لم يعد يرى ملفك. يمكنك إعادة الإذن له متى شئت.",
  "pclaim.goToSessions": "اذهب إلى جلساتي",
  "pclaim.checkWhatsapp": "تفقد واتساب",
  "pclaim.checkEmail": "تفقد بريدك الإلكتروني",
  "pclaim.codeSent": "أرسلنا رمزًا من ستة أرقام. ينتهي خلال ثلاثين دقيقة.",
  "pclaim.fellBack": "لم نستطع الوصول إليك عبر واتساب، فأرسلنا الرمز إلى بريدك الإلكتروني.",
  "pclaim.yourCode": "رمزك",
  "pclaim.keepAccess": "اسمح لهذا المعالج بمواصلة رؤية ملفي",
  "pclaim.keepAccessBody":
    "إن تركته مغلقًا يحتفظ بالملاحظات التي كتبها ولا شيء غيرها، لا جلسات جديدة ولا ملف حي. يمكنك تشغيله لاحقًا، وإغلاقه مرة أخرى، متى شئت.",
  "pclaim.notMe": "هذا ليس أنا",
  "pclaim.matchedEmail": "يحتفظ معالج بملاحظات لشخص يحمل بريدك الإلكتروني، تحت اسم:",
  "pclaim.matchedPhone": "يحتفظ معالج بملاحظات لشخص يحمل رقم هاتفك، تحت اسم:",
  "pclaim.isThatYou": "هل هذا أنت؟",
  "pclaim.yesSendCode": "نعم، أرسل لي رمزًا",
  "pclaim.initialsOnly":
    "لا نعرض سوى الأحرف الأولى حتى تؤكد الرمز. لا أحد يعرف عنك من هذه الشاشة شيئًا لم تخبرنا به بالفعل.",
  "consent.sayWhy": "يمكنك أن تقول السبب أو لا تقول. كلاهما مقبول.",
  "pclaim.everything": "هذا كل شيء",
  "pclaim.seenBefore": "هل زرت {name} من قبل؟",
  "pclaim.seenBeforeBody":
    "رقمك طابق سجلًا لديه. إن لم تزره من قبل فقل لا. ولن يُعرض عليك شيء عن ذلك السجل في الحالتين.",
  "pclaim.noHaveNot": "لا، لم أزره",
  "pclaim.typeName": "اكتبه كما أعطيته له. لن نعرضه عليك.",
  "pclaim.firstName": "الاسم الأول",
  "pcode.title": "أدخل رمزك",
  "pcode.body":
    "إن كان لهذا الرقم أو البريد حساب، فرمز من ستة أرقام في طريقه إليك. ينتهي خلال عشر دقائق.",
  "pcode.channelDown":
    "إرسال الرموز عبر واتساب غير مفعّل بعد، وقد لا يصلك الرمز. إن كنت قد وضعت كلمة مرور، فادخل بها بدلًا من ذلك.",
  "pcode.useCode": "ادخل برمز بدلًا من ذلك",
  "pcode.useCodeBody":
    "لا حاجة إلى كلمة مرور. نرسل رمزًا إلى رقم هاتفك أو بريدك، أيهما سجّلت به.",
  "pjournal.placeholder": "كيف كانت الأيام؟",
  "psessions.writing": "معالجك ما زال يكتب ملخصك.",
  "residency.withdraw": "اسحب الموافقة",
  "pidentity.removePhoto": "احذفها",
  "pidentity.photoPrivate":
    "صورتك ليست علنية. تُحفظ بشكل خاص، ولا تظهر إلا لك ولمعالج أنت في جلسة معه.",
  "pauth.invitePhoneNote": "الرقم الذي أرسل إليه معالجك هذه الدعوة.",
  "pauth.phonePlaceholder": "هاتف أو واتساب",
  "pauth.phoneNote": "بهذا تسجّل الدخول، وبه يجدك معالجك.",
  "radar.freeNow": "متاح الآن",
  "pexport.title": "نسخة من كل شيء",
  "pexport.body":
    "كل جلسة، وكل ملاحظة وقّعها معالجوك، وكل نسخة من ملخصك، وما كتبته بنفسك، والتواريخ. نرسل رابطًا إلى {email} ولا نرسله إلى أي مكان آخر. يُفتح بلا كلمة مرور، ويتوقف بعد ثلاثة أيام.",
  "pexport.onItsWay": "في طريقها إلى {email}. لم يقرأها أحد هنا.",
  "pexport.button": "أرسل لي سجلي بالبريد",
  "pexport.preparing": "جارٍ تجهيزها…",
  "pexport.sent": "أُرسلت",
  "pexport.notCertificate":
    "هذه نسخة من السجل، وليست شهادة. تقول ما لدينا ومتى كُتب. ولا تقول إن تشخيصًا فيها صحيح، ولا شيء فيها مكتوب لمحكمة.",
  "pidentity.photoPrivateRecord":
    "صورتك ليست علنية. تُحفظ بشكل خاص، ولا تظهر إلا لك ولمعالج لديه سجل عنك بالفعل.",
  "pcode.expires": "ينتهي خلال خمس عشرة دقيقة.",
  "consent.whichTherapist": "أي معالج",
  "preset.changed": "تم تغيير كلمة المرور",
  "preset.changedBody": "خرجت من كل الأجهزة الأخرى. سجّل الدخول بكلمة مرورك الجديدة.",
  "preset.tellUs": "أخبرنا",
  "preset.channelDownLead": "إرسال الرموز عبر واتساب غير مفعّل بعد. القالب ما زال في انتظار الموافقة، وقد لا يصلك الرمز. إن تعذّر عليك الدخول،",
  "preset.channelDownTail": "وسيتولى الأمر شخص يعيدك إلى حسابك.",
  "preset.codeLabel": "رمز من ستة أرقام",
  "preset.askAnother": "اطلب رمزًا آخر",
  "preset.handleLabel": "رقم الهاتف أو البريد الإلكتروني",
  "preset.sendCode": "أرسل لي رمزًا",
  "preset.backToSignIn": "العودة إلى تسجيل الدخول",
  "preset.title": "استعد الدخول إلى حسابك",
  "preset.body": "أخبرنا برقم الهاتف أو البريد الذي تسجّل الدخول به وسنرسل لك رمزًا.",
  "pnumber.requested": "وصلنا طلبك",
  "pnumber.requestedBody":
    "سيتصل أحدهم بالرقم الجديد للتأكد أنه أنت، ثم يرسل إليه رمزًا. أدخل الرمز هنا وينتقل حسابك. ولا يتغير شيء قبل ذلك.",
  "pnumber.yours": "رقمك",
  "pnumber.body":
    "بهذا الرقم نعرف أنك أنت، ولذلك يحتاج تغييره إلى شخص ويوم. نتصل بالرقم الجديد أو نراسله أولًا، ثم نرسل إليه رمزًا. ولا يستطيع أحد هنا نقل حسابك بغير ذلك الرمز.",
  "pnumber.locked":
    "رقمك أُكِّد حديثًا، فهو مغلق حتى {date}. إن لم تستطع الانتظار فاكتب إلينا وسينظر فيه شخص.",
  "pnumber.newNumber": "الرقم الجديد",
  "pnumber.country": "الدولة",
  "pnumber.mayCall": "يمكنكم الاتصال بالرقم الجديد أو مراسلته للتأكد أنه أنا.",
  "consent.cancelIt": "ألغِه",
  "room.yourSession": "جلستك",
  "room.started": "بدأت جلستك",
  "room.waiting": "في انتظار معالجك",
  "room.audioOnly": "هذه جلسة صوتية. سيسمع كل منكما الآخر.",
  "room.keepOpen": "تتحدث هذه الصفحة تلقائيًا لحظة انضمامه. اتركها مفتوحة.",
  "room.trouble":
    "لا ترى أو لا تسمع؟ تأكد أن المتصفح لديه إذن باستخدام الكاميرا والميكروفون، ثم أعد تحميل الصفحة.",
  "room.endedTitle": "انتهت هذه الجلسة",
  "room.endedAgain":
    "إن أردت أنت ومعالجك المتابعة، يستطيع أن يرسل لك رابطًا لجلسة جديدة.",
  "room.verifiedBody":
    "موثَّق من 24Therapy، راجعنا ترخيصه وهويته قبل أن يتمكن من إجراء أي جلسة.",
  "room.thanks": "شكرًا لك",
  "room.howEasy": "ما مدى سهولة إيجاد معالج؟",
  "room.rateApp": "قيّم 24Therapy",
  "room.whereSummary": "إلى أين نرسل ملخصك؟",
  "room.emailPlaceholder": "you@example.com",
  "room.sentToUs": "أُرسلت إلى 24Therapy",
  "room.sentToUsBody": "سيقرأها أحدنا اليوم. ولم تصل إلى معالجك.",
  "room.tellUsTitle": "أخبرنا بما يحدث",
  "room.tellUsBody": "هذا يصل إلى 24Therapy مباشرة. ولا يراه معالجك.",
  "room.tellUsPlaceholder": "ما الذي يحدث الآن.",
  "psteps.none": "لا شيء الآن",
  "psteps.noneBody": "عندما تتفق مع معالجك على شيء تجربه، يظهر هنا.",
  "psteps.anythingToSay": "تحب أن تقول شيئًا عنه؟ لست مضطرًا.",
  "psteps.didThis": "فعلت هذا",
  "psteps.couldNot": "لم أستطع فعل هذا",
  "jconsent.yourChoices": "اختياراتك",
  "jconsent.recordLabel": "سجّل هذه الجلسة",
  "jconsent.recordDetail": "ملاحظات معالجك تُكتب من التسجيل.",
  "jconsent.profileLabel": "شارِك ملفي",
  "jconsent.profileDetail": "يتيح لهذا المعالج رؤية التاريخ الذي كوّنته في أماكن أخرى.",
  "jconsent.on": "مفعّل",
  "jconsent.turnOn": "فعّل",
  "jconsent.changeAnyTime": "يمكنك تغييرها في أي وقت أثناء الجلسة.",
  "jconsent.cannotUndo":
    "غيّرت رأيك في التسجيل؟ لا يمكن إيقافه في المنتصف، وما سُجّل يبقى موجودًا. اطلب من معالجك إنهاء الجلسة، وأجب بلا في المرة القادمة.",
  "radar.globeLabel": "كرة أرضية تعرض أماكن المعالجين المتاحين الآن",
  "radar.spinningUp": "جارٍ التشغيل…",
  "radar.clearFilters": "امسح كل عوامل التصفية",
  "radar.thirtyMinutes": "ثلاثون دقيقة، تبدأ الآن",
  "radar.walkIns": "زيارات بلا موعد",
  "radar.oneHour": "ساعة واحدة",
  "radar.everyoneOnShift": "كل المتاحين",
  "radar.filtersOn": "{count} عوامل تصفية",
  "radar.oneFilterOn": "عامل تصفية واحد",
  "radar.othersAvailableOne": "يوجد معالج آخر متاح الآن.",
  "radar.othersAvailableMany": "يوجد {count} معالجين آخرين متاحين الآن.",
  "radar.noOne": "لا أحد",
  "radar.onShift": "متاح الآن",
  "radar.oneOnShift": "معالج متاح الآن",
  "radar.manyOnShift": "معالجون متاحون الآن",
  "radar.countFree": "{count} متاح",
  "radar.dragToSpin": "اسحب للتدوير، واضغط على دولة للتصفية",
  "radar.narrowDown": "ضيّق البحث",
  "radar.whoIsFree": "من المتاح",
  "radar.ratings": "التقييمات",
  "radar.nobodyYet": "لا أحد على الشاشة بعد",
  "radar.nobodyYetBody":
    "يظهر المعالجون هنا لحظة اتصالهم. إن كنت تحتاج مساعدة الآن، اتصل برقم الطوارئ في بلدك.",
  "radar.nobodyMatchingTitle": "لا أحد مطابق لذلك على الشاشة الآن",
  "prating.yourSession": "جلستك",
  "prating.summaryOnWay": "ملخصك بالأسفل، ونسخة منه في طريقها إلى بريدك.",
  "prating.stillWriting":
    "{name} ما زال يكتب تقرير الجلسة. سيصلك الملخص بالبريد فور اعتماده، وغالبًا خلال ساعة.",
  "prating.keepLink": "ملخصك بالأسفل. احتفظ بهذا الرابط إن أردت العودة إليه.",
  "prating.yourSummary": "ملخصك",
  "prating.writtenForYou":
    "هذا مكتوب لك أنت. ويحتفظ معالجك بملاحظة سريرية منفصلة تبقى عنده.",
  "prating.oneMinute": "دقيقة واحدة، ويصبح ملخصك لك",
  "prating.andSession": "والجلسة نفسها؟",
  "prating.andApp": "و24Therapy نفسه؟",
  "prating.andAppBody": "إيجاد معالج، والاتصال، والتطبيق.",
  "prating.anythingElse": "أي شيء آخر؟",
  "prating.optional": "اختياري",
  "prating.noName": "يرى معالجك هذا بلا اسمك عليه.",
  "prating.commentPlaceholder": "ما الذي ساعد، وما الذي لم يساعد.",
  "prating.whereSummary": "إلى أين نرسل ملخصك؟",
  "prating.summaryBody":
    "ملخص بلغة بسيطة لما تحدثتما فيه وما اتفقتما عليه. نستخدم هذا العنوان لذلك وللتواصل معك بشأن هذه الجلسة، ولا شيء غير ذلك.",
  "prating.ratingsAndEmail": "التقييمات وعنوان بريد، ويصبح الملخص لك.",
  "prating.reported": "تم الإبلاغ",
  "prating.neverJoined": "لم يحضر، وأريد استرداد أموالي",
  "prating.reportSomething": "أبلغ عن شيء حدث في هذه الجلسة",
  "prating.reportPlaceholder": "ما الذي حدث، وفي أي وقت من الجلسة تقريبًا.",
  "prating.replyEmail": "بريدك الإلكتروني لنرد عليك (اختياري)",
  "pbook.noTimes": "لا توجد مواعيد متاحة",
  "pbook.bookSession": "احجز جلسة",
  "pbook.firstName": "اسمك الأول",
  "pbook.email": "البريد الإلكتروني",
  "pbook.phone": "هاتف أو واتساب",
  "pbook.oneOfThese": "أعطنا واحدًا منهما لنرسل لك الرابط ونخبرك إن تغير شيء.",
  "pbook.note": "أي شيء ينبغي أن يعرفه قبل اللقاء؟ (اختياري)",
  "pbook.pickAnother": "اختر موعدًا آخر",
  "pbook.fullProfile": "اطّلع على ملفه كاملًا",
  "pbook.onlyYou": "أنت الوحيد الذي يستطيع حجزه الآن",
  "pbook.timeLeft": "الوقت المتبقي لإتمام الحجز",
  "pbook.heldBody":
    "يظهر هذا المعالج الآن مشغولًا لغيرك. أتمّ حجزك، أو أغلق الصفحة ليصل إليه شخص آخر.",
  "pbook.taken":
    "شخص آخر على هذا الملف الآن. ما زال بإمكانك المحاولة، وإن لم يكمل حجزه يتفرغ هذا المعالج خلال دقيقة.",
  "pbook.unavailable":
    "أصبح هذا المعالج غير متاح للتو. أغلق هذه النافذة واختر شخصًا آخر، فالشاشة تتحدث كل بضع ثوانٍ.",
  "pbook.noAccount":
    "لا حاجة إلى حساب. الدفع يذهب إلى معالجك عبر Stripe، ولا نرى بطاقتك أبدًا. إن كنت في خطر مباشر، اتصل برقم الطوارئ في بلدك.",
  "pbook.walkIns": "يستقبل زيارات بلا موعد",
  "pbook.directions": "احصل على الاتجاهات",
  "pbook.emailAddress": "أرسل لي العنوان بالبريد",
  "pbook.addressSent": "أُرسل. تفقد بريدك.",
  "pbook.whereToSend": "إلى أين نرسل الاتجاهات",
  "pbook.addressOnce":
    "نرسل العنوان ولا شيء غيره، مرة واحدة. ولا يُحفظ، ولست مشتركًا في أي شيء.",
  "pbook.notAnAppointment":
    "الحضور بلا موعد ليس حجزًا. حجز جلسة بالأعلى هو الطريقة الوحيدة للتأكد من وجود شخص متفرغ.",
  "pbook.send": "أرسل",
  "pbook.sending": "جارٍ الإرسال…",
  "psessions.which": "أي الجلسات",
  "psessions.today": "اليوم",
  "psessions.todayBlurb": "خلال اليوم القادم.",
  "psessions.booked": "محجوزة",
  "psessions.bookedBlurb": "في وقت لاحق.",
  "psessions.pastBooked": "مواعيد سابقة",
  "psessions.pastBookedBlurb": "جلسات حجزتها.",
  "pclaim.nothingTitle": "لا يوجد ما تستلمه بعد",
  "pclaim.nothingBody":
    "لم يسجلك أحد تحت هذا الرقم أو هذا البريد. إن كنت تزور معالجًا، اطلب منه رابط دعوة، ويعمل فورًا.",
};

export const DICTIONARIES = { en, ar } as const;
