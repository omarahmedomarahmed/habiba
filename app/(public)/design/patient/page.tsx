import type { Metadata } from "next";
import Link from "next/link";
import { Check, Clock, Copy, Lock, Mic, MicOff, Minimize2, Phone as PhoneIcon, Upload } from "lucide-react";

import { Flow, LangSwitch } from "../_kit/board";
import { Avatar, Btn, Card, H, Item, Label, P, Pill, Price, Row, Small } from "../_kit/parts";
import { Phone } from "../_kit/phone";
import { langOf, money, tx } from "../_kit/tx";

/**
 * Task 174, the patient app first. docs/TAKEOVER.md s10: "a flow with screens",
 * enough that the founder can say yes or no before a line of it is built.
 *
 * Every screen here answers something the walk or the screen assessment found
 * (takeover/walk/RESULTS.md, takeover/assess/patient.md), and names the value
 * statement it keeps. The cast is the demo cast: Mariam, whose employer Habiba
 * Holdings covers 60%, Dr Sara Demo at $75, Dr Kareem at Nile Practice.
 */
export const metadata: Metadata = {
  title: "Design · Patient app",
  robots: { index: false, follow: false },
};

const EMPLOYER = "Habiba Holdings";

export default async function PatientDesign({
  searchParams,
}: {
  searchParams: Promise<{ lang?: string }>;
}) {
  const lang = langOf((await searchParams).lang);
  const t = (en: string, ar: string) => tx(lang, en, ar);

  /* The screens a sheet opens over, drawn once and reused, so a sheet never floats over nothing. */
  const freeNow = (
    <>
                <Small>{t("Verified therapists who can start in the next few minutes.", "معالجون موثّقون يمكنهم البدء خلال دقائق.")}</Small>
                <Card>
                  <Item
                    lead={<Avatar initials="SD" live />}
                    title={t("Dr Sara Demo", "د. سارة ديمو")}
                    sub={t("Clinical psychologist · Arabic, English", "أخصائية نفسية إكلينيكية · العربية، الإنجليزية")}
                  />
                  <Price lang={lang} price={75} employer={EMPLOYER} coveredPct={60} compact />
                </Card>
                <Card>
                  <Item
                    lead={<Avatar initials="OA" live />}
                    title={t("Dr Omar Abdelgawad", "د. عمر عبد الجواد")}
                    sub={t("Psychotherapist · Arabic", "معالج نفسي · العربية")}
                  />
                  <Price lang={lang} price={60} employer={EMPLOYER} coveredPct={60} compact />
                </Card>
                <Small>{t("Nobody is held for you until you press Start.", "لا نحجز أحدًا لك قبل أن تضغط ابدأ.")}</Small>
    </>
  );
  const payBody = (
    <>
                <Price lang={lang} price={75} employer={EMPLOYER} coveredPct={60} />
                <Card>
                  <Item title={t("Card", "بطاقة")} sub={t("You are in the room within seconds.", "تدخل الغرفة خلال ثوانٍ.")} end={<Pill>{t("Fastest", "الأسرع")}</Pill>} />
                </Card>
                <Card>
                  <Item
                    title={t("Bank transfer", "تحويل بنكي")}
                    sub={t(`EGP 1,755 exactly. A person checks it, usually within a few minutes.`, `1755 جنيهًا بالضبط. يراجعه شخص، عادةً خلال دقائق.`)}
                  />
                </Card>
    </>
  );
  const readers = (
    <>
                <Label>{t("Asking now", "يطلب الآن")}</Label>
                <Card className="border-amber-400">
                  <Item lead={<Avatar initials="KD" />} title={t("Dr Kareem, Nile Practice", "د. كريم، عيادة النيل")} sub={t("Wants to read your summaries", "يريد قراءة ملخّصاتك")} />
                  <div className="mt-2 flex flex-col gap-2">
                    <Btn>{t("Yes, for 24 hours", "نعم، لمدة 24 ساعة")}</Btn>
                    <Btn kind="secondary">{t("Yes, until I change my mind", "نعم، حتى أغيّر رأيي")}</Btn>
                    <Btn kind="quiet">{t("No", "لا")}</Btn>
                  </div>
                </Card>
                <Label>{t("Can read", "يمكنه القراءة")}</Label>
                <Card>
                  <Item lead={<Avatar initials="SD" />} title={t("Dr Sara Demo", "د. سارة ديمو")} sub={t("Until you change your mind", "حتى تغيّر رأيك")} end={<span className="text-[15px] font-semibold text-navy-600 underline">{t("Stop", "أوقف")}</span>} />
                </Card>
    </>
  );

  return (
    <main className="min-h-screen bg-white pb-24 text-navy-500">
      <div className="mx-auto max-w-3xl px-4 pt-10">
        <Link href="/design" className="text-[15px] font-semibold text-navy-600 underline underline-offset-4">
          All surfaces
        </Link>
        <h1 className="mt-4 text-[34px] font-bold leading-tight text-navy-600">The patient app, redrawn</h1>
        <p className="mt-3 text-[17px] leading-relaxed text-navy-500">
          Seven flows, every screen at the 390px width a phone gives it, in English and Arabic. Each
          screen says which promise it keeps and what it replaces. Nothing here is built yet: say yes,
          no, or change this, flow by flow.
        </p>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <LangSwitch lang={lang} path="/design/patient" />
          <span className="text-[14px] text-navy-400">The screens switch language; the notes stay in English.</span>
        </div>

        <div className="mt-8 rounded-2xl border border-navy-100 bg-navy-50 p-5">
          <p className="text-[17px] font-bold text-navy-600">Five decisions that hold across every screen</p>
          <ol className="mt-3 list-decimal space-y-2 ps-5 text-[15px] leading-relaxed">
            <li>
              <strong>SOS lives in the bottom bar</strong>, red, on every screen, and every sheet opens above the
              bar. Nothing can cover it, so the booking sheet can no longer sit over it (P5, the stop-level
              finding).
            </li>
            <li>
              <strong>One way to show a price</strong>: the session price, what {EMPLOYER} pays, VAT on your
              share, and the one number you actually send. The same block on the therapist list, the booking
              sheet, the payment screen and the money page (E3; tasks 208, 210).
            </li>
            <li>
              <strong>A next-step bar replaces the orb</strong>: money owed (amber) or a door open (brand), in
              words, above the bottom bar on every screen (P2).
            </li>
            <li>
              <strong>An inbox with a door</strong>: a bell with a count in every top bar. Everything we send by
              email or WhatsApp also lands there (P2; task 206).
            </li>
            <li>
              <strong>Readable text</strong>: nothing under 14px, nothing lighter than navy-400, no teal on
              anything you press, no red crosses for good news.
            </li>
          </ol>
        </div>

        <nav className="mt-6 flex flex-wrap gap-2 text-[15px]">
          {[
            ["start", "1. Start now"],
            ["money", "2. Money"],
            ["record", "3. Your record"],
            ["help", "4. Help now"],
            ["benefit", "5. Your benefit"],
            ["inbox", "6. Inbox"],
            ["journal", "7. Journal"],
          ].map(([id, label]) => (
            <a key={id} href={`#${id}`} className="rounded-full border border-navy-200 px-3 py-1.5 font-semibold text-navy-600">
              {label}
            </a>
          ))}
        </nav>
      </div>

      <Flow
        id="start"
        title="1. Start a session now"
        intro="From opening the app to talking to somebody. The price you see before you press is the price you pay, and nothing is reserved until you press Start."
        taps="Three taps to the room when the session is covered or already paid for: Find someone now, Sara, Start. Paying by card adds one. A bank transfer waits for a person to confirm it, and the screen says so before you choose it."
        screens={[
          {
            name: "Home",
            serves: ["P1", "P2"],
            fixes:
              "a 2,700px launcher: six full summaries that repeated the Sessions tab, an empty 'rated highest' section, list prices on sessions she did not pay in full, no upcoming session, no benefit.",
            node: (
              <Phone lang={lang} title={t("Hello, Mariam", "أهلًا يا مريم")} inbox={1} tab="home">
                <Card className="bg-navy-600 text-white">
                  <p className="text-[15px] font-semibold text-brand-300">{t("2 therapists free now", "معالجان متاحان الآن")}</p>
                  <p className="mt-1 text-[20px] font-bold text-white">{t("Talk to someone in minutes", "تحدّث مع أحد خلال دقائق")}</p>
                  <Btn className="mt-4">{t("Find someone now", "ابحث عن أحد الآن")}</Btn>
                </Card>
                <Card>
                  <Label>{t("Your next session", "جلستك القادمة")}</Label>
                  <Item
                    lead={<Avatar initials="SD" />}
                    title={t("Dr Sara Demo", "د. سارة ديمو")}
                    sub={t("Thursday 25 Sept, 14:00 · 60 min", "الخميس 25 سبتمبر، 14:00 · 60 دقيقة")}
                  />
                  <Price lang={lang} price={75} employer={EMPLOYER} coveredPct={60} compact />
                </Card>
                <Card>
                  <Label>{t("Your record", "سجلّك")}</Label>
                  <P>{t("2 summaries, by 2 therapists. You decide who reads them.", "ملخّصان من معالجَين. أنت من يقرر من يقرأهما.")}</P>
                </Card>
              </Phone>
            ),
          },
          {
            name: "Who is free now",
            serves: ["P1", "E3"],
            fixes:
              "a globe that spent 60% of the phone on two dots, list prices only, and opening a profile that silently held a real clinician.",
            node: (
              <Phone lang={lang} title={t("Free now", "متاح الآن")} back inbox={1} tab="therapists">
                {freeNow}
              </Phone>
            ),
          },
          {
            name: "Start with Sara",
            serves: ["P1", "E3", "P5"],
            fixes:
              "the booking sheet that was drawn over SOS with a pay button on it, and a button that said $60 and asked for $68.40.",
            node: (
              <Phone
                lang={lang}
                title={t("Free now", "متاح الآن")}
                back
                inbox={1}
                tab="therapists"
                dim
                sheet={
                  <div className="flex flex-col gap-4">
                    <Item
                      lead={<Avatar initials="SD" live />}
                      title={t("Dr Sara Demo", "د. سارة ديمو")}
                      sub={t("Can start now · 30 minutes", "يمكنها البدء الآن · 30 دقيقة")}
                    />
                    <Price lang={lang} price={75} employer={EMPLOYER} coveredPct={60} />
                    <Btn>{t(`Start and pay ${money(lang, 34.2)}`, `ابدأ وادفع ${money(lang, 34.2)}`)}</Btn>
                    <Small>{t("Sara is held for you for 60 seconds after you press Start.", "نحجز سارة لك 60 ثانية بعد أن تضغط ابدأ.")}</Small>
                  </div>
                }
              >
                {freeNow}
              </Phone>
            ),
          },
          {
            name: "Pay",
            serves: ["E3", "A1"],
            fixes: "a transfer sheet in pounds only, with no warning that a transfer waits for a person.",
            node: (
              <Phone lang={lang} title={t("Pay for your session", "ادفع ثمن جلستك")} back inbox={1}>
                {payBody}
              </Phone>
            ),
          },
          {
            name: "Before you go in",
            serves: ["T1", "T2", "P3"],
            fixes: "\"You can change these at any time\" printed beside \"Recording cannot stop part-way\".",
            node: (
              <Phone lang={lang} title={t("Before you go in", "قبل أن تدخل")} back chrome={false}>
                <H>{t("May Sara's notes be written from a recording?", "هل تُكتب ملاحظات سارة من تسجيل؟")}</H>
                <P>
                  {t(
                    "If you say yes, the session is recorded and a draft note is written from it. Sara reads and signs it before anything reaches you.",
                    "إذا وافقت، تُسجَّل الجلسة وتُكتب منها مسودة ملاحظة. تقرؤها سارة وتوقّعها قبل أن يصلك أي شيء.",
                  )}
                </P>
                <P>
                  {t(
                    "You can stop the recording at any moment with one button. What was said before you stopped stays; nothing after it is kept.",
                    "يمكنك إيقاف التسجيل في أي لحظة بزر واحد. يبقى ما قيل قبل الإيقاف، ولا يُحفظ شيء بعده.",
                  )}
                </P>
                <div className="mt-auto flex flex-col gap-2">
                  <Btn>{t("Yes, you may record", "نعم، يمكنكم التسجيل")}</Btn>
                  <Btn kind="secondary">{t("No, do not record", "لا، لا تسجّلوا")}</Btn>
                  <Small>{t("Either way, the session goes ahead.", "في الحالتين تستمر الجلسة.")}</Small>
                </div>
              </Phone>
            ),
          },
          {
            name: "In the session",
            serves: ["T2", "P5"],
            fixes: "a patient Stop that the clinician's Resume could undo (fixed and live since 23 Sept; this is how it looks).",
            node: (
              <Phone lang={lang} chrome={false}>
                <div className="-m-4 flex h-[calc(100%+2rem)] flex-col bg-navy-800">
                  <div className="flex items-center gap-2 px-4 py-3 text-white">
                    <span className="h-2.5 w-2.5 rounded-full bg-red-500" />
                    <p className="flex-1 text-[15px] font-semibold">{t("Recording", "يُسجَّل")}</p>
                    <Minimize2 className="h-5 w-5" aria-hidden />
                  </div>
                  <div className="mx-4 flex flex-1 items-center justify-center rounded-2xl bg-navy-600 text-[16px] text-navy-200">
                    {t("Dr Sara Demo", "د. سارة ديمو")}
                  </div>
                  <div className="flex gap-2 p-4">
                    <span className="flex h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-white text-[15px] font-semibold text-navy-600">
                      <MicOff className="h-4 w-4" aria-hidden /> {t("Stop recording", "أوقف التسجيل")}
                    </span>
                    <span className="flex h-12 w-24 items-center justify-center rounded-xl bg-red-600 text-[15px] font-bold text-white">
                      {t("SOS", "طوارئ")}
                    </span>
                  </div>
                </div>
              </Phone>
            ),
          },
        ]}
      />

      <Flow
        id="money"
        title="2. Money"
        intro="What you owe is on every screen until it is paid, in the same words everywhere, and a refused transfer says why and what to do next instead of disappearing."
        screens={[
          {
            name: "Owed, on any screen",
            serves: ["P2"],
            fixes: "money owed on a finished session raised no orb anywhere, so Mariam was never told she owed 40% of six sessions.",
            node: (
              <Phone
                lang={lang}
                title={t("Sessions", "الجلسات")}
                inbox={1}
                tab="home"
                next={{ kind: "owed", text: t(`You owe ${money(lang, 34.2)} for 18 Sept`, `عليك ${money(lang, 34.2)} عن جلسة 18 سبتمبر`), action: t("Pay", "ادفع") }}
              >
                <Card>
                  <Item title={t("18 Sept · Dr Sara Demo", "18 سبتمبر · د. سارة ديمو")} sub={t("60 min · summary ready", "60 دقيقة · الملخّص جاهز")} end={<Pill tone="owed">{t("Owed", "مستحق")}</Pill>} />
                </Card>
                <Card>
                  <Item title={t("11 Sept · Dr Sara Demo", "11 سبتمبر · د. سارة ديمو")} sub={t("60 min", "60 دقيقة")} end={<Pill tone="done">{t("Paid", "مدفوع")}</Pill>} />
                </Card>
              </Phone>
            ),
          },
          {
            name: "What you owe",
            serves: ["E3", "P2"],
            fixes: "a billing page that told a partly covered patient 'Covered, nothing for you to pay' on every card, dated by payment instead of session.",
            node: (
              <Phone lang={lang} title={t("Money", "المدفوعات")} back inbox={1}>
                <Label>{t("To pay", "للدفع")}</Label>
                <Card>
                  <p className="text-[16px] font-semibold text-navy-600">{t("Session on 18 Sept, Dr Sara Demo", "جلسة 18 سبتمبر، د. سارة ديمو")}</p>
                  <div className="mt-2">
                    <Price lang={lang} price={75} employer={EMPLOYER} coveredPct={60} />
                  </div>
                  <Btn kind="money" className="mt-3">{t(`Pay ${money(lang, 34.2)}`, `ادفع ${money(lang, 34.2)}`)}</Btn>
                </Card>
                <Label>{t("Paid", "مدفوع")}</Label>
                <Card>
                  <Row left={t("11 Sept · receipt", "11 سبتمبر · الإيصال")} right={money(lang, 34.2)} />
                  <Row left={t("4 Sept · receipt", "4 سبتمبر · الإيصال")} right={money(lang, 34.2)} />
                </Card>
              </Phone>
            ),
          },
          {
            name: "Pay by bank transfer",
            serves: ["E3", "A4"],
            fixes: "a form with no place to say how much was sent, so an overpayment was kept and written down nowhere.",
            node: (
              <Phone lang={lang} title={t("Bank transfer", "تحويل بنكي")} back inbox={1}>
                <Card>
                  <Row left={t("Send exactly", "أرسل بالضبط")} right="EGP 1,755" strong />
                  <Row left={t("To", "إلى")} right="24Therapy · CIB" />
                  <Row left={t("Account", "الحساب")} right={<span className="inline-flex items-center gap-1">1000 2345 6789 <Copy className="h-4 w-4" aria-hidden /></span>} />
                  <Row left={t("Reference", "المرجع")} right={<span className="inline-flex items-center gap-1">24T-4471 <Copy className="h-4 w-4" aria-hidden /></span>} />
                </Card>
                <Card>
                  <Label>{t("After you send it", "بعد الإرسال")}</Label>
                  <div className="mt-2 rounded-xl border border-navy-200 px-3 py-3 text-[16px] text-navy-400">{t("How much did you send? EGP", "كم أرسلت؟ جنيه")}</div>
                  <div className="mt-2 flex items-center gap-2 text-[15px] font-semibold text-navy-600">
                    <Upload className="h-4 w-4" aria-hidden /> {t("Add the receipt (optional)", "أرفق الإيصال (اختياري)")}
                  </div>
                </Card>
                <Btn>{t("I have sent it", "لقد أرسلته")}</Btn>
              </Phone>
            ),
          },
          {
            name: "We are checking it",
            serves: ["A1", "P2"],
            node: (
              <Phone lang={lang} title={t("Money", "المدفوعات")} back inbox={1} next={{ kind: "owed", text: t("Transfer being checked", "نراجع تحويلك"), action: t("See", "عرض") }}>
                <Card>
                  <div className="flex items-center gap-2">
                    <Clock className="h-5 w-5 text-navy-600" aria-hidden />
                    <p className="text-[16px] font-semibold text-navy-600">{t("We are checking your transfer", "نراجع تحويلك")}</p>
                  </div>
                  <P className="mt-2">
                    {t(
                      "A person matches it to your reference, usually within a few minutes. You will see the answer here and in your inbox.",
                      "يطابقه شخص مع مرجعك، عادةً خلال دقائق. سترى الرد هنا وفي صندوق رسائلك.",
                    )}
                  </P>
                  <div className="mt-3">
                    <Row left={t("You said you sent", "قلت إنك أرسلت")} right="EGP 1,755" />
                    <Row left={t("Reference", "المرجع")} right="24T-4471" />
                  </div>
                </Card>
                <Small>{t("Don't pay again while we check. If it takes over an hour, tell us.", "لا تدفع مرة أخرى أثناء المراجعة. إن تأخرنا أكثر من ساعة فأخبرنا.")}</Small>
              </Phone>
            ),
          },
          {
            name: "If we can't match it",
            serves: ["A3"],
            fixes:
              "a rejection that was never sent, made the orb vanish, was invisible to guests, and told the operator 'they have been told why' when nobody had been.",
            node: (
              <Phone
                lang={lang}
                title={t("Money", "المدفوعات")}
                back
                inbox={1}
                next={{ kind: "owed", text: t(`You still owe ${money(lang, 34.2)}`, `ما زال عليك ${money(lang, 34.2)}`), action: t("Pay", "ادفع") }}
              >
                <Card className="border-amber-400">
                  <p className="text-[16px] font-semibold text-navy-600">{t("We couldn't match your transfer", "لم نتمكن من مطابقة تحويلك")}</p>
                  <p className="mt-2 rounded-lg bg-navy-50 p-3 text-[15px] italic leading-relaxed text-navy-600">
                    {t(
                      "“No transfer with reference 24T-4471 has reached our account. If you sent it from a different bank, reply with the receipt.”",
                      "“لم يصل إلى حسابنا تحويل بالمرجع 24T-4471. إن أرسلته من بنك آخر فأرسل لنا الإيصال.”",
                    )}
                  </p>
                  <Small>{t("From the person who checked it, word for word.", "من الشخص الذي راجعه، بنصّه.")}</Small>
                </Card>
                <Btn>{t("Send the receipt", "أرسل الإيصال")}</Btn>
                <Btn kind="secondary">{t("Pay another way", "ادفع بطريقة أخرى")}</Btn>
              </Phone>
            ),
          },
        ]}
      />

      <Flow
        id="record"
        title="3. Your record"
        intro="Every summary under the name and credentials of the person who wrote it, every version kept, and who can read it decided by you, with anybody asking shown first."
        screens={[
          {
            name: "Your record",
            serves: ["P3", "P4"],
            fixes: "summaries with no 'Dr', no credentials and nothing saying who wrote them; record links buried at the bottom of home.",
            node: (
              <Phone lang={lang} title={t("Your record", "سجلّك")} inbox={1} tab="record">
                <Card className="border-amber-400">
                  <Item title={t("1 person is asking to read it", "شخص واحد يطلب قراءته")} sub={t("Dr Kareem, Nile Practice", "د. كريم، عيادة النيل")} end={<Pill tone="owed">{t("Answer", "ردّ")}</Pill>} />
                </Card>
                <Label>{t("Summaries", "الملخّصات")}</Label>
                <Card>
                  <Item title={t("Dr Sara Demo", "د. سارة ديمو")} sub={t("Clinical psychologist · version 2 · 18 Sept", "أخصائية نفسية إكلينيكية · النسخة 2 · 18 سبتمبر")} />
                  <Item title={t("Dr Omar Abdelgawad", "د. عمر عبد الجواد")} sub={t("Psychotherapist · version 1 · 2 Sept", "معالج نفسي · النسخة 1 · 2 سبتمبر")} />
                </Card>
                <Card>
                  <Item title={t("Thursday's session", "جلسة الخميس")} sub={t("Sara is still writing your summary.", "ما زالت سارة تكتب ملخّصك.")} end={<Clock className="h-5 w-5 text-navy-400" aria-hidden />} />
                </Card>
                <Btn kind="secondary">{t("Who can read it", "من يمكنه قراءته")}</Btn>
              </Phone>
            ),
          },
          {
            name: "A summary",
            serves: ["P3"],
            node: (
              <Phone lang={lang} title={t("Summary", "الملخّص")} back inbox={1} tab="record">
                <Card>
                  <p className="text-[17px] font-bold text-navy-600">{t("Dr Sara Demo", "د. سارة ديمو")}</p>
                  <Small>{t("Clinical psychologist · Egyptian Psychological Association, verified Aug 2026", "أخصائية نفسية إكلينيكية · الجمعية المصرية لعلم النفس، موثّقة أغسطس 2026")}</Small>
                  <div className="mt-2 flex gap-2">
                    <Pill tone="done">{t("Version 2 · 18 Sept", "النسخة 2 · 18 سبتمبر")}</Pill>
                    <Pill>{t("Version 1", "النسخة 1")}</Pill>
                  </div>
                </Card>
                <P>
                  {t(
                    "We talked about waking at 4am and the wind-down routine you kept on four nights. The breathing exercise helped on Tuesday. Next: keep the routine for another week.",
                    "تحدثنا عن الاستيقاظ في الرابعة فجرًا وعن روتين التهدئة الذي التزمتِ به أربع ليالٍ. ساعد تمرين التنفس يوم الثلاثاء. الخطوة التالية: استمري في الروتين أسبوعًا آخر.",
                  )}
                </P>
                <Small>{t("Drafted from the recording, then read, changed and signed by Sara on 18 Sept.", "كُتبت مسودته من التسجيل، ثم قرأتها سارة وعدّلتها ووقّعتها في 18 سبتمبر.")}</Small>
              </Phone>
            ),
          },
          {
            name: "Who can read it",
            serves: ["P4", "T5"],
            fixes: "a request from Dr Kareem that sat in the database while the screen said 'Nobody has asked'.",
            node: (
              <Phone lang={lang} title={t("Who can read it", "من يمكنه القراءة")} back inbox={1} tab="record">
                {readers}
              </Phone>
            ),
          },
          {
            name: "Stop Sara's access",
            serves: ["T5", "P4"],
            fixes: "'Take it back and it stops that second' on /for-patients, while the copilot kept answering from Sara's own session notes.",
            decide:
              "the copilot stops reading your record at once, but still answers from Sara's own notes of her sessions with you. Keep that and say it (drawn here), or stop the copilot altogether? (Report decision 3.)",
            node: (
              <Phone
                lang={lang}
                title={t("Who can read it", "من يمكنه القراءة")}
                back
                inbox={1}
                tab="record"
                dim
                sheet={
                  <div className="flex flex-col gap-3">
                    <H>{t("Stop Dr Sara Demo reading your record?", "إيقاف قراءة د. سارة ديمو لسجلّك؟")}</H>
                    <div>
                      <p className="text-[15px] font-semibold text-navy-600">{t("Stops now", "يتوقف الآن")}</p>
                      <P>{t("Her access to your summaries, your files and anything other therapists wrote.", "وصولها إلى ملخّصاتك وملفاتك وكل ما كتبه معالجون آخرون.")}</P>
                    </div>
                    <div>
                      <p className="text-[15px] font-semibold text-navy-600">{t("Stays with her", "يبقى لديها")}</p>
                      <P>{t("Her own notes of her sessions with you. Clinicians must keep these.", "ملاحظاتها هي عن جلساتها معك. يلزم المعالجين الاحتفاظ بها.")}</P>
                    </div>
                    <Btn kind="danger">{t("Stop her access", "أوقف وصولها")}</Btn>
                  </div>
                }
              >
                {readers}
              </Phone>
            ),
          },
          {
            name: "Bring a new therapist in",
            serves: ["P4"],
            node: (
              <Phone lang={lang} title={t("Share a code", "شارك رمزًا")} back inbox={1} tab="record">
                <Card className="items-center text-center">
                  <p className="text-center text-[34px] font-bold tracking-widest text-navy-600">RP8-8FT</p>
                  <Small>{t("Valid for 7 days", "صالح لمدة 7 أيام")}</Small>
                </Card>
                <P>
                  {t(
                    "Give this code to a new therapist. It lets them ask to read your record, never read it. You will be asked here, and nothing opens until you say yes.",
                    "أعطِ هذا الرمز لمعالج جديد. يتيح له أن يطلب قراءة سجلّك، لا أن يقرأه. ستُسأل هنا، ولا يُفتح شيء قبل موافقتك.",
                  )}
                </P>
                <Btn kind="secondary">
                  <Copy className="h-4 w-4" aria-hidden /> {t("Copy the code", "انسخ الرمز")}
                </Btn>
              </Phone>
            ),
          },
        ]}
      />

      <Flow
        id="help"
        title="4. Help now"
        intro="SOS is one tap from every screen, including in the middle of paying, and nothing about money appears in it. Its sheet opens above the bottom bar like every other sheet."
        screens={[
          {
            name: "Pressed while paying",
            serves: ["P5"],
            fixes: "the booking sheet at z-100 over the SOS orb at z-70, with 'Pay $75 and start now' on it (stop-level, found in code and by the assessment).",
            node: (
              <Phone
                lang={lang}
                title={t("Pay for your session", "ادفع ثمن جلستك")}
                back
                inbox={1}
                dim
                sheet={
                  <div className="flex flex-col gap-3">
                    <H>{t("Help now", "مساعدة الآن")}</H>
                    <P>{t("These are phone numbers, not a chat. They answer day and night.", "هذه أرقام هاتف، لا محادثة. يردّون ليلًا ونهارًا.")}</P>
                    <span className="flex items-center gap-3 rounded-2xl bg-red-600 p-4 text-white">
                      <PhoneIcon className="h-6 w-6 shrink-0" aria-hidden />
                      <span>
                        <span className="block text-[20px] font-bold">105</span>
                        <span className="block text-[15px]">{t("Mental health line, Egypt. Press 1 for Arabic, then 1.", "خط الصحة النفسية، مصر. اضغط 1 للعربية ثم 1.")}</span>
                      </span>
                    </span>
                    <span className="flex items-center gap-3 rounded-2xl border border-red-600 p-4 text-red-700">
                      <PhoneIcon className="h-6 w-6 shrink-0" aria-hidden />
                      <span>
                        <span className="block text-[20px] font-bold">123</span>
                        <span className="block text-[15px]">{t("Ambulance, if you are in danger now.", "الإسعاف، إن كنت في خطر الآن.")}</span>
                      </span>
                    </span>
                  </div>
                }
              >
                {payBody}
              </Phone>
            ),
          },
        ]}
      />

      <Flow
        id="benefit"
        title="5. Your benefit"
        intro="The only screen about the employer, now with a door (Me, then Your benefit), the real share, and what the employer can and can never see said in two plain lists."
        screens={[
          {
            name: "Your benefit",
            serves: ["E3", "E1", "E2"],
            fixes:
              "a page with no link to it, a heading telling an enrolled person to 'Activate', a claim of full cover for a partial one, and a can/cannot list that didn't say which was which.",
            node: (
              <Phone lang={lang} title={t("Your benefit", "ميزتك")} back inbox={1} tab="me">
                <Card>
                  <p className="text-[17px] font-bold text-navy-600">{EMPLOYER}</p>
                  <P>{t(`Pays 60% of each session until 31 Dec 2026. You pay the rest.`, `تدفع 60% من كل جلسة حتى 31 ديسمبر 2026. وتدفع أنت الباقي.`)}</P>
                  <div className="mt-2">
                    <Price lang={lang} price={75} employer={EMPLOYER} coveredPct={60} />
                  </div>
                </Card>
                <Card>
                  <p className="text-[15px] font-semibold text-navy-600">{t(`${EMPLOYER} sees`, `ترى ${EMPLOYER}`)}</p>
                  <ul className="mt-1 space-y-1 text-[15px]">
                    <li className="flex gap-2"><Check className="mt-1 h-4 w-4 shrink-0" aria-hidden />{t("Your name on their list", "اسمك في قائمتها")}</li>
                    <li className="flex gap-2"><Check className="mt-1 h-4 w-4 shrink-0" aria-hidden />{t("How much of their budget is used, in total, updated only after several sessions", "كم استُخدم من ميزانيتها إجمالًا، ولا يُحدَّث إلا بعد عدة جلسات")}</li>
                  </ul>
                  <p className="mt-3 text-[15px] font-semibold text-navy-600">{t("Never sees", "لا ترى أبدًا")}</p>
                  <ul className="mt-1 space-y-1 text-[15px]">
                    <li className="flex gap-2"><Lock className="mt-1 h-4 w-4 shrink-0" aria-hidden />{t("Whether you booked, when, or with whom", "إن كنت حجزت أو متى أو مع من")}</li>
                    <li className="flex gap-2"><Lock className="mt-1 h-4 w-4 shrink-0" aria-hidden />{t("Anything said or written in a session", "أي شيء قيل أو كُتب في جلسة")}</li>
                  </ul>
                </Card>
              </Phone>
            ),
          },
          {
            name: "Cover is changing",
            serves: ["E4", "E3"],
            node: (
              <Phone lang={lang} title={t("Your benefit", "ميزتك")} back inbox={2} tab="me">
                <Card className="border-amber-400">
                  <p className="text-[16px] font-semibold text-navy-600">{t(`From 23 Oct, ${EMPLOYER} covers 0%`, `من 23 أكتوبر، تغطي ${EMPLOYER} 0%`)}</p>
                  <P>{t("You are still on their list. Sessions you have already booked keep 60%. New bookings after 23 Oct are at the full price.", "ما زلت في قائمتها. الجلسات التي حجزتها تحتفظ بنسبة 60%. الحجوزات الجديدة بعد 23 أكتوبر بالسعر الكامل.")}</P>
                </Card>
                <Price lang={lang} price={75} employer={EMPLOYER} coveredPct={0} />
              </Phone>
            ),
          },
          {
            name: "Budget used up",
            serves: ["E5"],
            fixes: "a minus sign and '113%' with no sentence, and a benefit page telling an enrolled employee to activate it.",
            node: (
              <Phone lang={lang} title={t("Your benefit", "ميزتك")} back inbox={1} tab="me">
                <Card className="border-amber-400">
                  <p className="text-[16px] font-semibold text-navy-600">{t(`${EMPLOYER}'s budget is used up for now`, `نفدت ميزانية ${EMPLOYER} حاليًا`)}</p>
                  <P>{t("You can still book and pay the full price yourself. You could ask your HR team to top it up; we never tell them who asked.", "ما زال بإمكانك الحجز ودفع السعر كاملًا بنفسك. يمكنك أن تطلب من فريق الموارد البشرية زيادتها؛ ولا نخبرهم أبدًا بمن سأل.")}</P>
                </Card>
                <Price lang={lang} price={75} employer={EMPLOYER} coveredPct={0} />
              </Phone>
            ),
          },
        ]}
      />

      <Flow
        id="inbox"
        title="6. Inbox"
        intro="Everything we send you by email or WhatsApp is also here, newest first, each with the one thing to do about it."
        screens={[
          {
            name: "Inbox",
            serves: ["P2"],
            fixes: "/patient/notices, which held the invitation but had no link to it, and a payment confirmation that existed only in email.",
            node: (
              <Phone lang={lang} title={t("Inbox", "الرسائل")} back inbox={0}>
                <Card>
                  <Item title={t("Dr Kareem asks to read your record", "د. كريم يطلب قراءة سجلّك")} sub={t("Today, 09:12", "اليوم، 09:12")} end={<Pill tone="owed">{t("Answer", "ردّ")}</Pill>} />
                </Card>
                <Card>
                  <Item title={t("Payment received for 11 Sept", "استلمنا دفعة 11 سبتمبر")} sub={t(`${money(lang, 34.2)} · receipt inside`, `${money(lang, 34.2)} · الإيصال بالداخل`)} />
                </Card>
                <Card>
                  <Item title={t("Dr Sara invited you: Thu 25 Sept, 14:00", "دعتك د. سارة: الخميس 25 سبتمبر، 14:00")} sub={t("Yesterday", "أمس")} end={<Pill>{t("Open", "افتح")}</Pill>} />
                </Card>
                <Card>
                  <Item title={t("Your summary from 18 Sept is ready", "ملخّص 18 سبتمبر جاهز")} sub={t("Signed by Dr Sara Demo", "بتوقيع د. سارة ديمو")} />
                </Card>
              </Phone>
            ),
          },
        ]}
      />

      <Flow
        id="journal"
        title="7. Journal"
        intro="A place to write between sessions. What it says about who reads it has to be true, and today it is not quite."
        screens={[
          {
            name: "Journal",
            serves: ["P3"],
            decide:
              "journals are scanned for signs of danger and a clinician is alerted, and the page is forbidden to say so. Either say it (drawn here) or stop scanning. (Report decision 7.)",
            node: (
              <Phone lang={lang} title={t("Journal", "اليوميات")} back inbox={1} tab="me">
                <div className="h-40 rounded-2xl border border-navy-200 bg-white p-3 text-[16px] text-navy-400">
                  {t("What's on your mind?", "ما الذي يشغل بالك؟")}
                </div>
                <Card>
                  <p className="text-[15px] font-semibold text-navy-600">{t("Who reads this", "من يقرأ هذا")}</p>
                  <P>
                    {t(
                      "Only you, unless you share an entry. One exception: if something you write sounds like you may be in danger, your therapist is told so they can reach you.",
                      "أنت فقط، ما لم تشارك تدوينة. استثناء واحد: إن بدا مما تكتبه أنك قد تكون في خطر، نُبلغ معالجك ليتواصل معك.",
                    )}
                  </P>
                </Card>
                <Btn>{t("Save", "احفظ")}</Btn>
              </Phone>
            ),
          },
        ]}
      />

      <div className="mx-auto max-w-3xl border-t border-navy-100 px-4 pt-8 text-[15px] leading-relaxed text-navy-500">
        <p className="font-semibold text-navy-600">Not drawn yet, and why</p>
        <p className="mt-2">
          The therapist page with booking for later, homework, questionnaires, account and sign-in. They come
          after you have said yes or no to these seven, so the next ones are drawn on decisions rather than
          guesses. <Mic className="inline h-4 w-4" aria-hidden /> The session room itself is drawn with the
          clinician workspace, because it is one room with two sides.
        </p>
      </div>
    </main>
  );
}

