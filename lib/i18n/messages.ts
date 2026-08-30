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
  "join.subtitlePaid": "No account needed. Tell us what to call you, then pay to enter.",
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
  "join.linkDead": "This link is no longer valid. Ask your therapist for a new one.",
  "join.tooManyAttempts": "Too many attempts. Wait a moment and try again.",
  "join.privateNote": "Your session is private and is not shared with anyone else.",
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
  "consent.required": "Please choose whether your therapist may record the session.",
  "consent.pickOne": "Please choose one.",
  "consent.gate.title": "One question before you go in",
  "consent.gate.body": "Your therapist is ready. This takes a second and you can say no.",
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
  "feedback.commentHint": "Optional. Your therapist sees this, never your name.",
  "feedback.email": "Where should we send your summary?",
  "feedback.submit": "Send and get my summary",
  "feedback.expired": "This link has expired",
  "feedback.expiredBody":
    "Session links stay open for three days. If you still need your summary, ask your therapist to send it again.",
  "feedback.emergency":
    "If you are in immediate danger, call your local emergency number.",

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
  "urgent.footer": "If you need urgent help, call or text 988 at any time.",
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
  "join.subtitlePaid": "لا حاجة إلى حساب. أخبرنا بما نناديك به، ثم ادفع للدخول.",
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
  "urgent.footer": "إذا كنت بحاجة إلى مساعدة عاجلة، اتصل برقم الطوارئ في بلدك في أي وقت.",
};

export const DICTIONARIES = { en, ar } as const;
