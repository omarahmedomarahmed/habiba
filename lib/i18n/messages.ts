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
    "Payment is handled by Stripe and goes to your therapist — we never see your card. Your session is private and is not shared with anyone else.",
  "join.paymentReceived": "Payment received",
  "join.takingYouIn": "Taking you into your session…",

  /* ----------------------------------------------------------- consent -- */
  "consent.question": "May your therapist record this session?",
  "consent.point.notes":
    "The recording is turned into your therapist's clinical notes, and a plain-language summary for you.",
  "consent.point.private":
    "Only your therapist can see it. It is never sold, never used for advertising, and never shown to another patient.",
  "consent.point.changeMind":
    "You can change your mind during the session — ask your therapist to stop and the recording indicator turns amber.",
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
    "You get to rate {therapist} and this session as soon as it ends — right here, on this page.",
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
    "When {therapist} joins we will ask where to send it — a plain-language note of what you talked about and what you agreed.",
  "room.goodToKnow": "Good to know",
  "room.knowRecording":
    "The recording is used to write your therapist's notes. It is not shared with anyone else.",
  "room.knowSummary":
    "You get a plain-language summary. Your therapist's clinical note stays with them.",
  "room.knowEmergency":
    "This is not an emergency service. If you are in immediate danger, call your local emergency number.",
  "room.troubleTitle": "Something is wrong — tell 24Therapy",
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
    "No subscription, no seat fee, no setup fee — and your first completed session is on us.",
  "pricing.perSession": "/ session",
  "pricing.tier.payg": "Pay as you go",
  "pricing.tier.starter": "Starter",
  "pricing.tier.growth": "Growth",
  "pricing.payg": "Pay for the sessions you actually run. Nothing up front.",
  "pricing.bundle": "Buy {count} or more at once.",
  "pricing.includes":
    "The session and {count} copilot questions about that patient — each answer citing the session and timestamp it came from.",
  "pricing.feature.transcription": "Live transcription, Arabic and English",
  "pricing.feature.note": "SOAP note in under a minute",
  "pricing.feature.report": "Patient report by email",
  "pricing.feature.video": "Video or in-person sessions",
  "pricing.feature.alerts": "Crisis-language alerts",
  "pricing.feature.getPaid":
    "Get paid by patients — Crisis Radar and paid session links",
  "pricing.feature.baa": "HIPAA BAA included",
  "pricing.signUp": "Sign up free",
  "pricing.orBundle": "or buy a bundle of {count}",
  "pricing.noFees":
    "Joining is free. No subscription, no seat fee, no setup fee.",
  "pricing.credits":
    "You pay per session, only when you run one, and your first completed session is free. Credits last {months} months and are always spent before anything new is billed, so moving to a smaller bundle never strands what you paid for.",
  "pricing.radarLead": "Get booked on the Crisis Radar.",
  "pricing.radarBody":
    "Patients find you and book you, and we take {percent}% of what that session paid you — nothing else.",
  "pricing.netting":
    "When we are holding your earnings, the session fee comes out of them automatically — nothing to pay by card. If your patients pay straight into your own Stripe account, we bill you for it instead.",
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
    "If you are in immediate danger, call your local emergency number now — this is not an emergency service and nobody here can reach you fast enough. If you can wait a few minutes, the radar has clinicians online this minute and you do not need an account to use it.",
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
    "This reaches a person during working hours, not in the next ten minutes. If you need somebody now, open the radar — clinicians are online this minute and you need no account. If you are in immediate danger, call your local emergency number.",
  "contact.radarWord": "radar",
  "contact.name": "What should we call you?",
  "contact.reply": "How should we reply?",
  "contact.replyHint":
    "An email address or a phone number — whichever you actually read. One is enough.",
  "contact.country": "Country",
  "contact.countryAria": "Country for the phone number",
  "contact.phone": "Phone number",
  "contact.topic": "What is this about?",
  "contact.topic.account": "My account or signing in",
  "contact.topic.billing": "A payment or a bill",
  "contact.topic.my_record": "My record — claiming it, or what is in it",
  "contact.topic.a_session": "Something about a session I had",
  "contact.topic.a_therapist": "A therapist on the platform",
  "contact.topic.joining_as_a_therapist": "Joining as a therapist",
  "contact.topic.something_else": "Something else",
  "contact.entity": "Who are you writing to?",
  "contact.entityHint": "Both reach the same team.",
  "contact.entityUs": "24Therapy Inc. — international",
  "contact.entityEg": "24Therapy Egypt — Egypt",
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
    "Your reference is {reference}. A named person picks this up and answers within {hours} hours — by email or by message, whichever you left us. If it is urgent, do not wait for us: use the radar.",
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
  "radar.goOnRadar": "I'm a therapist — go on the radar",
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
    "الدفع يتم عبر Stripe ويذهب إلى معالجك — نحن لا نرى بطاقتك أبدًا. جلستك خاصة ولا تُشارَك مع أي شخص آخر.",
  "join.paymentReceived": "تم استلام الدفع",
  "join.takingYouIn": "جارٍ إدخالك إلى جلستك…",

  "consent.question": "هل تسمح لمعالجك بتسجيل هذه الجلسة؟",
  "consent.point.notes":
    "يتحول التسجيل إلى ملاحظات معالجك السريرية، وإلى ملخص بلغة بسيطة لك أنت.",
  "consent.point.private":
    "معالجك وحده من يستطيع الاطلاع عليه. لا يُباع أبدًا، ولا يُستخدم في الإعلانات، ولا يُعرض على مريض آخر.",
  "consent.point.changeMind":
    "يمكنك تغيير رأيك أثناء الجلسة — اطلب من معالجك التوقف وسيتحول مؤشر التسجيل إلى اللون الكهرماني.",
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
    "ستتمكن من تقييم {therapist} وتقييم هذه الجلسة فور انتهائها — هنا، في هذه الصفحة.",
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
    "عندما ينضم {therapist} سنسألك إلى أين نرسله — ملاحظة بلغة بسيطة عما تحدثتما عنه وما اتفقتما عليه.",
  "room.goodToKnow": "من الجيد أن تعرف",
  "room.knowRecording":
    "يُستخدم التسجيل لكتابة ملاحظات معالجك. ولا يُشارَك مع أي شخص آخر.",
  "room.knowSummary":
    "ستحصل على ملخص بلغة بسيطة. أما الملاحظة السريرية لمعالجك فتبقى عنده.",
  "room.knowEmergency":
    "هذه ليست خدمة طوارئ. إذا كنت في خطر مباشر، اتصل برقم الطوارئ في بلدك.",
  "room.troubleTitle": "هناك خطأ ما — أخبر 24Therapy",
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
    "بلا اشتراك، وبلا رسوم مقعد، وبلا رسوم تجهيز — وأول جلسة مكتملة علينا.",
  "pricing.perSession": "/ الجلسة",
  "pricing.tier.payg": "الدفع عند الاستخدام",
  "pricing.tier.starter": "البداية",
  "pricing.tier.growth": "التوسّع",
  "pricing.payg": "ادفع عن الجلسات التي تجريها فعلًا. لا شيء مقدمًا.",
  "pricing.bundle": "اشترِ {count} جلسات أو أكثر دفعة واحدة.",
  "pricing.includes":
    "الجلسة و{count} أسئلة للمساعد عن هذا المريض — وكل إجابة تشير إلى الجلسة والدقيقة التي جاءت منها.",
  "pricing.feature.transcription": "تفريغ مباشر بالعربية والإنجليزية",
  "pricing.feature.note": "ملاحظة سريرية في أقل من دقيقة",
  "pricing.feature.report": "تقرير للمريض بالبريد",
  "pricing.feature.video": "جلسات بالفيديو أو حضوريًا",
  "pricing.feature.alerts": "تنبيهات لغة الأزمة",
  "pricing.feature.getPaid":
    "تقاضَ أجرك من المرضى — عبر رادار الأزمات وروابط الجلسات المدفوعة",
  "pricing.feature.baa": "اتفاقية HIPAA مشمولة",
  "pricing.signUp": "أنشئ حسابك مجانًا",
  "pricing.orBundle": "أو اشترِ باقة من {count} جلسة",
  "pricing.noFees":
    "الانضمام مجاني. بلا اشتراك، وبلا رسوم مقعد، وبلا رسوم تجهيز.",
  "pricing.credits":
    "تدفع عن الجلسة حين تجريها فقط، وأول جلسة مكتملة مجانية. ورصيدك يبقى {months} شهرًا ويُصرف قبل أي محاسبة جديدة، فالانتقال إلى باقة أصغر لا يضيّع ما دفعته.",
  "pricing.radarLead": "احجز مكانك على رادار الأزمات.",
  "pricing.radarBody":
    "يجدك المرضى ويحجزون معك، ونأخذ {percent}% مما دفعته تلك الجلسة لك — ولا شيء غير ذلك.",
  "pricing.netting":
    "حين نكون نحن من يحتفظ بأرباحك تُخصم قيمة الجلسة منها تلقائيًا — فلا شيء تدفعه بالبطاقة. وإن كان مرضاك يدفعون مباشرة إلى حساب Stripe الخاص بك فنرسل إليك الفاتورة بدلًا من ذلك.",
  "pricing.sliderLabel": "{name}: كم جلسة؟",
  "pricing.showEgp": "بالجنيه المصري",
  "pricing.showUsd": "بالدولار",
  "pricing.sliderAt": "{count} جلسة بسعر {price} للجلسة",
  "pricing.sliderOnce": "تُدفع مرة واحدة وتُستخدم على مدى {months} شهرًا",
  "pricing.sliderSaved":
    "السعر نفسه لـ {count} جلسة بالدفع عند الاستخدام {payg}. توفّر {saved}.",

  "crisis.headingDefault": "إن كنت تحتاج مساعدة الآن",
  "crisis.bodyDefault":
    "إن كنت في خطر مباشر فاتصل برقم الطوارئ في بلدك الآن — هذه ليست خدمة طوارئ ولا يستطيع أحد هنا الوصول إليك بالسرعة الكافية. وإن كان بإمكانك الانتظار دقائق، فعلى الرادار معالجون متاحون في هذه اللحظة ولا تحتاج حسابًا لتستخدمه.",
  "crisis.findSomeone": "ابحث عن شخص متاح الآن",
  "crisis.whatHappens": "ماذا يحدث في الجلسة",
  "crisis.noAccountLine":
    "بلا حساب، وبلا بطاقة، وبلا استمارات. تعطي اسمك الأول فتكون داخل الجلسة.",

  "contact.urgentLead": "لا ترسل شيئًا عاجلًا من هنا.",
  "contact.urgentBody":
    "هذه الرسالة تصل إلى شخص خلال ساعات العمل، لا خلال العشر دقائق القادمة. إن كنت تحتاج أحدًا الآن فافتح الرادار — هناك معالجون متاحون في هذه اللحظة ولا تحتاج حسابًا. وإن كنت في خطر مباشر فاتصل برقم الطوارئ في بلدك.",
  "contact.radarWord": "الرادار",
  "contact.name": "بماذا نناديك؟",
  "contact.reply": "كيف نردّ عليك؟",
  "contact.replyHint":
    "بريد إلكتروني أو رقم هاتف — أيّهما تقرأه فعلًا. واحد يكفي.",
  "contact.country": "الدولة",
  "contact.countryAria": "دولة رقم الهاتف",
  "contact.phone": "رقم الهاتف",
  "contact.topic": "عمّ تسأل؟",
  "contact.topic.account": "حسابي أو تسجيل الدخول",
  "contact.topic.billing": "دفعة أو فاتورة",
  "contact.topic.my_record": "ملفي — استلامه، أو ما فيه",
  "contact.topic.a_session": "شيء يخصّ جلسة أجريتها",
  "contact.topic.a_therapist": "معالج على المنصة",
  "contact.topic.joining_as_a_therapist": "الانضمام كمعالج",
  "contact.topic.something_else": "شيء آخر",
  "contact.entity": "إلى مَن تكتب؟",
  "contact.entityHint": "كلاهما يصل إلى الفريق نفسه.",
  "contact.entityUs": "‏24Therapy Inc. — الكيان الدولي",
  "contact.entityEg": "‏24Therapy Egypt — مصر",
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
    "رقمك المرجعي {reference}. يتولّاها شخص باسمه ويردّ خلال {hours} ساعة — بالبريد أو برسالة، حسب ما تركته لنا. وإن كان الأمر عاجلًا فلا تنتظرنا: استخدم الرادار.",
  "contact.attachmentFailed": "رسالتك محفوظة، لكن المرفق لم يصل: {reason}",

  "blocks.address": "العنوان",
  "blocks.email": "البريد",
  "blocks.hours": "المواعيد",
  "blocks.phone": "الهاتف",

  "radar.checking": "نتحقق ممن هو على الخط الآن…",
  "radar.online": "{count} متاحون الآن",
  "radar.private": "خاص ومشفّر",
  "radar.noAccount": "بلا حساب",
  "radar.goOnRadar": "أنا معالج — أريد الظهور على الرادار",
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
};

export const DICTIONARIES = { en, ar } as const;
