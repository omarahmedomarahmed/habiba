"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import {
  BadgeCheck,
  Bell,
  CalendarClock,
  ChevronLeft,
  CloudMoon,
  Eye,
  FileText,
  Flower2,
  Heart,
  HeartCrack,
  Home,
  Languages,
  LifeBuoy,
  Lock,
  Mic,
  MicOff,
  Minimize2,
  Phone,
  PhoneOff,
  Search,
  ShieldCheck,
  Sparkles,
  Users,
  User,
  Briefcase,
  Wind,
} from "lucide-react";

import { cn } from "@/lib/utils";

import { Count, LivePulse, Press, spring } from "../_ds/motion";
import { Avatar, Btn, Card, Chips, Glow, Ring, Rail, SearchField, SectionHead, Sheet, Toast } from "../_ds/ui";

import { COPY, type Copy, type Lang } from "./copy";

/* ------------------------------------------------------------------ data -- */

type Topic = "anxiety" | "sleep" | "relationships" | "grief" | "stress" | "family";

type Therapist = {
  id: string;
  name: string;
  nameAr: string;
  cred: string;
  credAr: string;
  langs: Array<"ar" | "en">;
  price: number;
  now: boolean;
  woman: boolean;
  years: number;
  turned: [number, number];
  topics: Topic[];
  about: string;
  aboutAr: string;
};

const THERAPISTS: Therapist[] = [
  {
    id: "sara", name: "Dr Sara Demo", nameAr: "د. سارة ديمو", cred: "Clinical psychologist", credAr: "أخصائية نفسية إكلينيكية",
    langs: ["ar", "en"], price: 75, now: true, woman: true, years: 9, turned: [7, 7], topics: ["sleep", "anxiety", "grief"],
    about: "I work with sleep, worry and loss, gently and practically. We start with what is hardest this week.",
    aboutAr: "أعمل مع النوم والقلق والفقد، بلطف وبشكل عملي. نبدأ بما هو أصعب هذا الأسبوع.",
  },
  {
    id: "omar", name: "Dr Omar Abdelgawad", nameAr: "د. عمر عبد الجواد", cred: "Psychotherapist", credAr: "معالج نفسي",
    langs: ["ar"], price: 60, now: true, woman: false, years: 12, turned: [11, 12], topics: ["stress", "anxiety", "family"],
    about: "Work stress, panic and family pressure. Straight talk, small steps, and a plan you can keep.",
    aboutAr: "ضغط العمل ونوبات الهلع وضغوط الأسرة. حديث واضح وخطوات صغيرة وخطة يمكنك الالتزام بها.",
  },
  {
    id: "yasmin", name: "Dr Yasmin Farouk", nameAr: "د. ياسمين فاروق", cred: "Counselling psychologist", credAr: "أخصائية إرشاد نفسي",
    langs: ["ar", "en"], price: 55, now: false, woman: true, years: 6, turned: [9, 9], topics: ["relationships", "family", "anxiety"],
    about: "Relationships, family and the conversations you keep putting off.",
    aboutAr: "العلاقات والأسرة والأحاديث التي تؤجلينها.",
  },
  {
    id: "kareem", name: "Dr Kareem Nabil", nameAr: "د. كريم نبيل", cred: "Clinical psychologist", credAr: "أخصائي نفسي إكلينيكي",
    langs: ["en"], price: 90, now: false, woman: false, years: 15, turned: [20, 21], topics: ["grief", "stress"],
    about: "Grief and burnout. We make room for both, then make a plan.",
    aboutAr: "الفقد والإنهاك. نفسح المجال لكليهما ثم نضع خطة.",
  },
];

const share = (price: number, minutes = 60) => {
  const full = minutes === 30 ? price * 0.6 : price;
  const covered = full * 0.6;
  const vat = (full - covered) * 0.14;
  return { full, covered, vat, total: full - covered + vat };
};
const money = (n: number) => `$${n.toFixed(2)}`;

const TOPIC_ICON: Record<Topic, ReactNode> = {
  anxiety: <Wind className="h-4 w-4" aria-hidden />,
  sleep: <CloudMoon className="h-4 w-4" aria-hidden />,
  relationships: <Heart className="h-4 w-4" aria-hidden />,
  grief: <HeartCrack className="h-4 w-4" aria-hidden />,
  stress: <Briefcase className="h-4 w-4" aria-hidden />,
  family: <Users className="h-4 w-4" aria-hidden />,
};

/* ---------------------------------------------------------------- the app -- */

type Screen = "home" | "find" | "therapist" | "session" | "summary" | "record" | "me";
const ORDER: Screen[] = ["home", "find", "therapist", "session", "summary", "record", "me"];

export function PatientApp({ lang }: { lang: Lang }) {
  const c = COPY[lang];
  const [screen, setScreen] = useState<Screen>("home");
  const [dir, setDir] = useState(1);
  const [therapist, setTherapist] = useState<Therapist>(THERAPISTS[0]!);
  const [booking, setBooking] = useState(false);
  const [sos, setSos] = useState(false);
  const [recording, setRecording] = useState(true);

  const go = (next: Screen) => {
    setDir(ORDER.indexOf(next) >= ORDER.indexOf(screen) ? 1 : -1);
    setScreen(next);
  };
  const open = (t: Therapist) => {
    setTherapist(t);
    go("therapist");
  };

  const rtl = lang === "ar";
  const tab: Screen | null = ["home", "find", "record", "me"].includes(screen) ? screen : screen === "therapist" ? "find" : null;
  const inSession = screen === "session";

  return (
    <div dir={rtl ? "rtl" : "ltr"} lang={lang} className={cn("relative flex min-h-0 flex-1 flex-col", inSession ? "bg-navy-900" : "bg-navy-50")}>
      <div className="relative min-h-0 flex-1 overflow-hidden">
        <AnimatePresence initial={false} custom={dir * (rtl ? -1 : 1)} mode="popLayout">
          <motion.div
            key={screen}
            custom={dir * (rtl ? -1 : 1)}
            variants={{
              enter: (d: number) => ({ x: `${d * 30}%`, opacity: 0 }),
              center: { x: 0, opacity: 1 },
              exit: (d: number) => ({ x: `${d * -20}%`, opacity: 0 }),
            }}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ type: "spring", stiffness: 300, damping: 34 }}
            className="absolute inset-0 overflow-y-auto overscroll-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {screen === "home" && <HomeScreen c={c} lang={lang} onOpen={open} onFind={() => go("find")} onRecord={() => go("record")} />}
            {screen === "find" && <FindScreen c={c} lang={lang} onOpen={open} />}
            {screen === "therapist" && <TherapistScreen c={c} lang={lang} t={therapist} onBack={() => go("find")} onStart={() => setBooking(true)} />}
            {screen === "session" && (
              <SessionScreen c={c} lang={lang} t={therapist} recording={recording} onStop={() => setRecording(false)} onEnd={() => go("summary")} />
            )}
            {screen === "summary" && <SummaryScreen c={c} lang={lang} t={therapist} onRecord={() => go("record")} />}
            {screen === "record" && <RecordScreen c={c} lang={lang} />}
            {screen === "me" && <MeScreen c={c} />}
          </motion.div>
        </AnimatePresence>

        <BookingSheet
          c={c}
          lang={lang}
          t={therapist}
          open={booking}
          onClose={() => setBooking(false)}
          onGoIn={(record) => {
            setRecording(record);
            setBooking(false);
            go("session");
          }}
        />
        <SosSheet c={c} open={sos} onClose={() => setSos(false)} />
      </div>

      <TabBar c={c} active={tab} dark={inSession} onTab={go} onSos={() => setSos(true)} />
    </div>
  );
}

/* ------------------------------------------------------------- tab bar -- */

function TabBar({
  c,
  active,
  dark,
  onTab,
  onSos,
}: {
  c: Copy;
  active: Screen | null;
  dark: boolean;
  onTab: (s: Screen) => void;
  onSos: () => void;
}) {
  const tabs: Array<{ id: Screen; label: string; icon: ReactNode }> = [
    { id: "home", label: c.tabs.home, icon: <Home className="h-[22px] w-[22px]" aria-hidden /> },
    { id: "find", label: c.tabs.find, icon: <Search className="h-[22px] w-[22px]" aria-hidden /> },
    { id: "record", label: c.tabs.record, icon: <FileText className="h-[22px] w-[22px]" aria-hidden /> },
    { id: "me", label: c.tabs.me, icon: <User className="h-[22px] w-[22px]" aria-hidden /> },
  ];
  return (
    <nav
      className={cn(
        "relative z-50 flex shrink-0 items-center gap-1 border-t px-2 pb-[max(env(safe-area-inset-bottom),14px)] pt-2 backdrop-blur-xl",
        dark ? "border-white/10 bg-navy-900/90" : "border-navy-100 bg-white/90",
      )}
    >
      <LayoutGroup id="tabs">
        {tabs.map((tab) => {
          const on = active === tab.id;
          return (
            <Press
              key={tab.id}
              onClick={() => onTab(tab.id)}
              aria-current={on ? "page" : undefined}
              className={cn(
                "relative flex h-14 flex-1 flex-col items-center justify-center gap-0.5 rounded-2xl text-[11.5px] font-semibold outline-none focus-visible:ring-2 focus-visible:ring-brand-400",
                dark ? (on ? "text-white" : "text-white/55") : on ? "text-navy-700" : "text-navy-400",
              )}
            >
              {on ? (
                <motion.span layoutId="tab-pill" transition={spring} className={cn("absolute inset-x-1.5 inset-y-1 rounded-2xl", dark ? "bg-white/10" : "bg-navy-50")} />
              ) : null}
              <span className="relative">{tab.icon}</span>
              <span className="relative">{tab.label}</span>
            </Press>
          );
        })}
      </LayoutGroup>
      <Press
        onClick={onSos}
        className="ms-1 flex h-14 w-16 shrink-0 flex-col items-center justify-center gap-0.5 rounded-2xl bg-red-600 text-[11.5px] font-bold text-white shadow-[0_8px_20px_-6px_rgba(220,38,38,0.7)] outline-none focus-visible:ring-2 focus-visible:ring-red-300"
        aria-label={c.sosTitle}
      >
        <LifeBuoy className="h-[22px] w-[22px]" aria-hidden />
        {c.sos}
      </Press>
    </nav>
  );
}

/* ------------------------------------------------------------------ home -- */

type Mood = "calm" | "anxious" | "low" | "sleep";

function HomeScreen({
  c,
  lang,
  onOpen,
  onFind,
  onRecord,
}: {
  c: Copy;
  lang: Lang;
  onOpen: (t: Therapist) => void;
  onFind: () => void;
  onRecord: () => void;
}) {
  const [mood, setMood] = useState<Mood>("anxious");
  const [topic, setTopic] = useState<Topic>("sleep");
  const free = THERAPISTS.filter((t) => t.now);
  return (
    <div className="pb-8">
      {/* The hero: one thing to do, on a night-navy ground with the teal light behind it. */}
      <div className="relative overflow-hidden rounded-b-[36px] bg-navy-900 px-5 pb-6 pt-4 text-white">
        <Glow className="-right-24 -top-24 h-72 w-72" />
        <div className="relative flex items-center justify-between">
          <div>
            <p className="text-[14px] text-white/65">{lang === "ar" ? "الثلاثاء 23 سبتمبر" : "Tuesday 23 September"}</p>
            <p className="text-[22px] font-bold">{c.evening}</p>
          </div>
          <Press className="relative flex h-11 w-11 items-center justify-center rounded-full bg-white/10 ring-1 ring-white/15" aria-label="Inbox">
            <Bell className="h-5 w-5" aria-hidden />
            <span className="absolute end-2 top-2 h-2.5 w-2.5 rounded-full bg-amber-400 ring-2 ring-navy-900" />
          </Press>
        </div>

        <p className="relative mt-5 text-[15px] font-semibold text-white/85">{c.arriving}</p>
        <Chips
          dark
          className="relative mt-2.5"
          value={mood}
          onChange={setMood}
          options={(Object.keys(c.moods) as Mood[]).map((id) => ({ id, label: c.moods[id] }))}
        />
        <AnimatePresence mode="wait">
          <motion.p
            key={mood}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="relative mt-3 min-h-[44px] text-[14px] leading-relaxed text-white/75"
          >
            {c.moodNote[mood]}
          </motion.p>
        </AnimatePresence>

        <motion.div
          layout
          className="relative mt-3 rounded-3xl bg-white/[0.07] p-4 ring-1 ring-white/12 backdrop-blur"
        >
          <div className="flex items-center gap-2 text-[14px] font-semibold text-brand-300">
            <LivePulse /> <Count value={free.length} /> {c.freeNow}
          </div>
          <p className="mt-1 text-[20px] font-bold leading-snug">{c.heroTitle}</p>
          <div className="mt-4 flex items-center justify-between gap-3">
            <div className="flex -space-x-3 rtl:space-x-reverse">
              {free.map((t) => (
                <Avatar key={t.id} name={t.name} size={40} ring />
              ))}
            </div>
            <Btn onClick={() => onOpen(free[0]!)} className="h-11 px-4 text-[14px]">
              {c.talkNow}
            </Btn>
          </div>
        </motion.div>
      </div>

      <div className="space-y-6 px-5 pt-5">
        <button type="button" onClick={onFind} className="block w-full text-start">
          <span className="pointer-events-none block">
            <SearchField value="" onChange={() => undefined} placeholder={c.search} />
          </span>
        </button>

        <div className="space-y-3">
          <SectionHead title={c.topics} />
          <Chips
            value={topic}
            onChange={setTopic}
            options={(Object.keys(c.topicNames) as Topic[]).map((id) => ({ id, label: c.topicNames[id], icon: TOPIC_ICON[id] }))}
          />
        </div>

        <div className="space-y-3">
          <SectionHead title={c.availableNow} action={c.seeAll} />
          <Rail>
            {THERAPISTS.filter((t) => t.topics.includes(topic)).map((t) => (
              <TherapistCard key={t.id} t={t} c={c} lang={lang} onOpen={() => onOpen(t)} />
            ))}
          </Rail>
        </div>

        <Card className="flex items-center gap-4">
          <div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-2xl bg-navy-600 text-white">
            <span className="text-[11px] font-semibold uppercase text-brand-300">{lang === "ar" ? "خميس" : "Thu"}</span>
            <span className="text-[20px] font-bold leading-none">25</span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-semibold text-navy-400">{c.nextSession} · {c.inDays}</p>
            <p className="truncate text-[16px] font-bold text-navy-700">{lang === "ar" ? "د. سارة ديمو · 14:00" : "Dr Sara Demo · 14:00"}</p>
            <p className="text-[13px] text-navy-500">{c.youPay} {money(share(75).total)} · {c.covers}</p>
          </div>
          <CalendarClock className="h-5 w-5 text-navy-400" aria-hidden />
        </Card>

        <div className="space-y-3">
          <SectionHead title={c.exercises} />
          <Rail>
            <Breather c={c} />
            <div className="flex w-[200px] shrink-0 snap-start flex-col justify-between rounded-3xl bg-brand-50 p-4 ring-1 ring-brand-100">
              <Eye className="h-6 w-6 text-brand-700" aria-hidden />
              <p className="text-[16px] font-bold text-navy-700">{c.ground}</p>
              <p className="text-[13px] text-navy-500">2 min</p>
            </div>
            <div className="flex w-[200px] shrink-0 snap-start flex-col justify-between rounded-3xl bg-navy-100 p-4">
              <Flower2 className="h-6 w-6 text-navy-600" aria-hidden />
              <p className="text-[16px] font-bold text-navy-700">{lang === "ar" ? "استرخاء العضلات" : "Loosen your shoulders"}</p>
              <p className="text-[13px] text-navy-500">3 min</p>
            </div>
          </Rail>
        </div>

        <button type="button" onClick={onRecord} className="block w-full text-start">
          <Card className="relative overflow-hidden">
            <div className="flex items-start gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-navy-600 text-white">
                <Lock className="h-5 w-5" aria-hidden />
              </span>
              <div>
                <p className="text-[16px] font-bold text-navy-700">{c.yourRecord}</p>
                <p className="mt-0.5 text-[14px] leading-relaxed text-navy-500">{c.recordLine}</p>
                <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-1 text-[13px] font-semibold text-navy-700">
                  <span className="h-2 w-2 rounded-full bg-amber-400" /> {c.asking}
                </p>
              </div>
            </div>
          </Card>
        </button>
      </div>
    </div>
  );
}

function TherapistCard({ t, c, lang, onOpen }: { t: Therapist; c: Copy; lang: Lang; onOpen: () => void }) {
  return (
    <motion.button
      type="button"
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      whileTap={{ scale: 0.97 }}
      onClick={onOpen}
      className="w-[230px] shrink-0 snap-start rounded-3xl bg-white p-4 text-start shadow-[0_10px_30px_-18px_rgba(10,35,66,0.35)] ring-1 ring-navy-100 outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
    >
      <div className="flex items-center gap-3">
        <Avatar name={t.name} size={48} live={t.now} />
        <div className="min-w-0">
          <p className="truncate text-[15px] font-bold text-navy-700">{lang === "ar" ? t.nameAr : t.name}</p>
          <p className="truncate text-[13px] text-navy-500">{lang === "ar" ? t.credAr : t.cred}</p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {t.langs.map((l) => (
          <span key={l} className="rounded-full bg-navy-50 px-2 py-0.5 text-[12px] font-semibold text-navy-600">
            {l === "ar" ? (lang === "ar" ? "عربي" : "Arabic") : lang === "ar" ? "إنجليزي" : "English"}
          </span>
        ))}
        {t.now ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2 py-0.5 text-[12px] font-semibold text-brand-800">
            <span className="h-1.5 w-1.5 rounded-full bg-brand-500" /> {c.availableNow}
          </span>
        ) : null}
      </div>
      <p className="mt-3 text-[13px] text-navy-500">
        {c.youPay} <span className="text-[16px] font-bold text-navy-700">{money(share(t.price).total)}</span>
      </p>
    </motion.button>
  );
}

/** A breathing circle: four seconds in, four out, the only loop on the screen. */
function Breather({ c }: { c: Copy }) {
  const [phase, setPhase] = useState<"in" | "out">("in");
  useEffect(() => {
    const id = setInterval(() => setPhase((p) => (p === "in" ? "out" : "in")), 4000);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="relative flex w-[200px] shrink-0 snap-start flex-col justify-between overflow-hidden rounded-3xl bg-navy-600 p-4 text-white">
      <div className="relative flex h-20 items-center justify-center">
        <motion.span
          className="absolute h-16 w-16 rounded-full bg-brand-500/40"
          animate={{ scale: phase === "in" ? 1.35 : 0.8 }}
          transition={{ duration: 4, ease: "easeInOut" }}
        />
        <motion.span
          className="absolute h-10 w-10 rounded-full bg-brand-400"
          animate={{ scale: phase === "in" ? 1.2 : 0.85 }}
          transition={{ duration: 4, ease: "easeInOut" }}
        />
        <AnimatePresence mode="wait">
          <motion.span key={phase} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="relative text-[12px] font-bold text-navy-700">
            {phase === "in" ? c.breatheIn : c.breatheOut}
          </motion.span>
        </AnimatePresence>
      </div>
      <p className="text-[16px] font-bold">{c.breathe}</p>
      <p className="text-[13px] text-white/65">2 min</p>
    </div>
  );
}

/* ------------------------------------------------------------------ find -- */

type Filter = "now" | "arabic" | "english" | "under30" | "women";

function FindScreen({ c, lang, onOpen }: { c: Copy; lang: Lang; onOpen: (t: Therapist) => void }) {
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<Filter[]>(["now"]);
  const toggle = (f: Filter) => setFilters((all) => (all.includes(f) ? all.filter((x) => x !== f) : [...all, f]));

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return THERAPISTS.filter((t) => {
      if (filters.includes("now") && !t.now) return false;
      if (filters.includes("arabic") && !t.langs.includes("ar")) return false;
      if (filters.includes("english") && !t.langs.includes("en")) return false;
      if (filters.includes("under30") && share(t.price).total >= 35) return false;
      if (filters.includes("women") && !t.woman) return false;
      if (!q) return true;
      const hay = [t.name, t.nameAr, t.cred, t.credAr, ...t.topics.map((x) => COPY.en.topicNames[x]), ...t.topics.map((x) => COPY.ar.topicNames[x])]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [query, filters]);

  return (
    <div className="px-5 pb-8 pt-4">
      <p className="text-[26px] font-bold text-navy-700">{c.tabs.find}</p>
      <div className="mt-3">
        <SearchField value={query} onChange={setQuery} placeholder={c.search} />
      </div>
      <div className="-mx-5 mt-3 flex gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {(Object.keys(c.filters) as Filter[]).map((f) => {
          const on = filters.includes(f);
          return (
            <Press
              key={f}
              onClick={() => toggle(f)}
              aria-pressed={on}
              className={cn(
                "inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full px-4 text-[14px] font-semibold outline-none ring-1 transition-colors focus-visible:ring-2 focus-visible:ring-brand-400",
                on ? "bg-navy-600 text-white ring-navy-600" : "bg-white text-navy-600 ring-navy-100",
              )}
            >
              <AnimatePresence initial={false}>
                {on ? (
                  <motion.span initial={{ width: 0, opacity: 0 }} animate={{ width: "auto", opacity: 1 }} exit={{ width: 0, opacity: 0 }} className="overflow-hidden">
                    <BadgeCheck className="h-4 w-4" aria-hidden />
                  </motion.span>
                ) : null}
              </AnimatePresence>
              {c.filters[f]}
            </Press>
          );
        })}
      </div>
      <p className="mt-4 text-[14px] font-semibold text-navy-500">
        <Count value={list.length} /> {c.results}
      </p>
      <motion.div layout className="mt-3 space-y-3">
        <AnimatePresence mode="popLayout">
          {list.map((t) => (
            <motion.button
              key={t.id}
              layout
              type="button"
              initial={{ opacity: 0, y: 12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={spring}
              whileTap={{ scale: 0.98 }}
              onClick={() => onOpen(t)}
              className="flex w-full items-center gap-3 rounded-3xl bg-white p-4 text-start ring-1 ring-navy-100 outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
            >
              <Avatar name={t.name} size={52} live={t.now} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[16px] font-bold text-navy-700">{lang === "ar" ? t.nameAr : t.name}</p>
                <p className="truncate text-[13px] text-navy-500">
                  {lang === "ar" ? t.credAr : t.cred} · {t.topics.slice(0, 2).map((x) => c.topicNames[x]).join(lang === "ar" ? "، " : ", ")}
                </p>
                <p className="mt-1 text-[13px] text-navy-500">
                  {c.youPay} <span className="font-bold text-navy-700">{money(share(t.price).total)}</span>
                </p>
              </div>
              {t.now ? (
                <span className="rounded-full bg-brand-500 px-3 py-1.5 text-[13px] font-bold text-navy-700">{c.start}</span>
              ) : (
                <CalendarClock className="h-5 w-5 text-navy-400" aria-hidden />
              )}
            </motion.button>
          ))}
        </AnimatePresence>
        {list.length === 0 ? (
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-3xl bg-white p-6 text-center text-[15px] text-navy-500 ring-1 ring-navy-100">
            {c.noResults}
          </motion.p>
        ) : null}
      </motion.div>
    </div>
  );
}

/* ------------------------------------------------------------- therapist -- */

function TherapistScreen({ c, lang, t, onBack, onStart }: { c: Copy; lang: Lang; t: Therapist; onBack: () => void; onStart: () => void }) {
  const [day, setDay] = useState<"today" | "tomorrow">("today");
  const [slot, setSlot] = useState<string | null>(null);
  const slots = day === "today" ? ["18:00", "19:30", "21:00"] : ["10:00", "11:30", "14:00", "16:30", "18:00"];
  return (
    <div className="pb-28">
      <div className="relative overflow-hidden bg-navy-900 px-5 pb-8 pt-3 text-white">
        <Glow className="-left-20 -top-10 h-64 w-64" />
        <Press onClick={onBack} className="relative flex h-10 w-10 items-center justify-center rounded-full bg-white/10" aria-label={c.back}>
          <ChevronLeft className="h-5 w-5 rtl:rotate-180" aria-hidden />
        </Press>
        <div className="relative mt-4 flex flex-col items-center text-center">
          <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={spring}>
            <Avatar name={t.name} size={96} live={t.now} ring />
          </motion.div>
          <p className="mt-3 text-[24px] font-bold">{lang === "ar" ? t.nameAr : t.name}</p>
          <p className="inline-flex items-center gap-1.5 text-[14px] text-white/75">
            {lang === "ar" ? t.credAr : t.cred}
            <BadgeCheck className="h-4 w-4 text-brand-400" aria-hidden /> {c.verified}
          </p>
          {t.now ? (
            <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-[13px] font-semibold ring-1 ring-white/15">
              <LivePulse /> {c.availableNow}
            </p>
          ) : null}
        </div>
      </div>

      <div className="-mt-5 space-y-4 px-5">
        <Card className="grid grid-cols-3 divide-x divide-navy-100 text-center rtl:divide-x-reverse">
          <div>
            <p className="text-[22px] font-bold text-navy-700"><Count value={t.years} /></p>
            <p className="text-[12px] text-navy-500">{c.years}</p>
          </div>
          <div className="flex flex-col items-center">
            <Ring value={t.turned[0] / t.turned[1]} size={52} stroke={6}>
              <span className="text-[12px] font-bold text-navy-700">{Math.round((t.turned[0] / t.turned[1]) * 100)}%</span>
            </Ring>
            <p className="mt-1 text-[12px] text-navy-500">{c.reliability} {t.turned[0]} {c.of} {t.turned[1]}</p>
          </div>
          <div>
            <Languages className="mx-auto h-6 w-6 text-navy-600" aria-hidden />
            <p className="mt-1 text-[12px] text-navy-500">{t.langs.map((l) => (l === "ar" ? "AR" : "EN")).join(" · ")}</p>
          </div>
        </Card>

        <Card>
          <p className="text-[15px] font-bold text-navy-700">{c.about}</p>
          <p className="mt-1.5 text-[15px] leading-relaxed text-navy-600">{lang === "ar" ? t.aboutAr : t.about}</p>
          <p className="mt-4 text-[15px] font-bold text-navy-700">{c.specialities}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {t.topics.map((x) => (
              <span key={x} className="inline-flex items-center gap-1.5 rounded-full bg-navy-50 px-3 py-1.5 text-[13px] font-semibold text-navy-600">
                {TOPIC_ICON[x]} {c.topicNames[x]}
              </span>
            ))}
          </div>
        </Card>

        <Card>
          <p className="text-[15px] font-bold text-navy-700">{c.times}</p>
          <Chips
            className="mt-3"
            value={day}
            onChange={(d) => {
              setDay(d);
              setSlot(null);
            }}
            options={[
              { id: "today", label: c.today },
              { id: "tomorrow", label: c.tomorrow },
            ]}
          />
          <motion.div layout className="mt-3 grid grid-cols-3 gap-2">
            <AnimatePresence mode="popLayout">
              {slots.map((s) => (
                <motion.button
                  key={`${day}-${s}`}
                  type="button"
                  layout
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setSlot(s)}
                  className={cn(
                    "h-11 rounded-xl text-[14px] font-semibold ring-1 outline-none focus-visible:ring-2 focus-visible:ring-brand-400",
                    slot === s ? "bg-navy-600 text-white ring-navy-600" : "bg-white text-navy-600 ring-navy-100",
                  )}
                >
                  {s}
                </motion.button>
              ))}
            </AnimatePresence>
          </motion.div>
        </Card>
      </div>

      <div className="sticky bottom-0 z-20 -mb-28 mt-4 bg-gradient-to-t from-navy-50 via-navy-50/95 to-transparent px-5 pb-4 pt-6">
        <Btn onClick={onStart} className="h-14 w-full text-[16px]">
          {slot ? `${c.start} · ${slot}` : c.startNow} · {money(share(t.price).total)}
        </Btn>
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- booking -- */

function BookingSheet({
  c,
  lang,
  t,
  open,
  onClose,
  onGoIn,
}: {
  c: Copy;
  lang: Lang;
  t: Therapist;
  open: boolean;
  onClose: () => void;
  onGoIn: (record: boolean) => void;
}) {
  const [minutes, setMinutes] = useState<"30" | "60">("60");
  const [method, setMethod] = useState<"card" | "transfer">("card");
  const [step, setStep] = useState<"price" | "consent">("price");
  const [hold, setHold] = useState(60);
  const p = share(t.price, Number(minutes));

  useEffect(() => {
    if (!open) {
      setStep("price");
      setHold(60);
    }
  }, [open]);
  useEffect(() => {
    if (step !== "consent") return;
    const id = setInterval(() => setHold((h) => Math.max(0, h - 1)), 1000);
    return () => clearInterval(id);
  }, [step]);

  return (
    <Sheet open={open} onClose={onClose}>
      <AnimatePresence mode="wait" initial={false}>
        {step === "price" ? (
          <motion.div key="price" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
            <div className="flex items-center gap-3">
              <Avatar name={t.name} size={52} live={t.now} />
              <div>
                <p className="text-[13px] font-semibold text-navy-500">{c.bookingTitle}</p>
                <p className="text-[18px] font-bold text-navy-700">{lang === "ar" ? t.nameAr : t.name}</p>
              </div>
            </div>
            <div>
              <p className="mb-2 text-[14px] font-semibold text-navy-600">{c.length}</p>
              <Chips value={minutes} onChange={setMinutes} options={[{ id: "30", label: c.min30 }, { id: "60", label: c.min60 }]} />
            </div>
            <div className="rounded-2xl bg-navy-50 px-4 py-1">
              {[
                [c.session, money(p.full)],
                [c.covers, `−${money(p.covered)}`],
                [c.vat, money(p.vat)],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between border-b border-navy-100 py-2.5 text-[15px] text-navy-600 last:border-0">
                  <span>{label}</span>
                  <motion.span key={value} initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className="tabular-nums">
                    {value}
                  </motion.span>
                </div>
              ))}
              <div className="flex items-baseline justify-between border-t-2 border-navy-200 py-3">
                <span className="text-[16px] font-bold text-navy-700">{c.youPay}</span>
                <motion.span key={p.total} initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-[26px] font-bold tabular-nums text-navy-700">
                  {money(p.total)}
                </motion.span>
              </div>
            </div>
            <div>
              <p className="mb-2 text-[14px] font-semibold text-navy-600">{c.payWith}</p>
              <div className="grid grid-cols-2 gap-2">
                {(["card", "transfer"] as const).map((m) => (
                  <Press
                    key={m}
                    onClick={() => setMethod(m)}
                    aria-pressed={method === m}
                    className={cn(
                      "rounded-2xl p-3 text-start ring-1 outline-none focus-visible:ring-2 focus-visible:ring-brand-400",
                      method === m ? "bg-navy-600 text-white ring-navy-600" : "bg-white text-navy-700 ring-navy-100",
                    )}
                  >
                    <p className="text-[15px] font-bold">{m === "card" ? c.card : c.transfer}</p>
                    <p className={cn("mt-0.5 text-[12px] leading-snug", method === m ? "text-white/75" : "text-navy-500")}>
                      {m === "card" ? c.cardNote : c.transferNote}
                    </p>
                  </Press>
                ))}
              </div>
            </div>
            <Btn onClick={() => setStep("consent")} className="h-14 w-full text-[16px]">
              {c.startAndPay} {money(p.total)}
            </Btn>
          </motion.div>
        ) : (
          <motion.div key="consent" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
            <div className="flex items-center gap-3">
              <Ring value={hold / 60} size={52} stroke={5}>
                <span className="text-[13px] font-bold tabular-nums text-navy-700">{hold}</span>
              </Ring>
              <p className="text-[14px] font-semibold text-navy-600">
                {lang === "ar" ? t.nameAr : t.name} {c.held}
              </p>
            </div>
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-navy-600 text-brand-300">
              <Mic className="h-6 w-6" aria-hidden />
            </div>
            <p className="text-[21px] font-bold leading-snug text-navy-700">{c.consentTitle}</p>
            <p className="text-[15px] leading-relaxed text-navy-600">{c.consentBody}</p>
            <Btn onClick={() => onGoIn(true)} className="h-14 w-full text-[16px]">
              {c.yes}
            </Btn>
            <Btn kind="ghost" onClick={() => onGoIn(false)} className="h-14 w-full text-[16px]">
              {c.no}
            </Btn>
            <p className="text-center text-[13px] text-navy-500">{c.either}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </Sheet>
  );
}

/* --------------------------------------------------------------- session -- */

function SessionScreen({
  c,
  lang,
  t,
  recording,
  onStop,
  onEnd,
}: {
  c: Copy;
  lang: Lang;
  t: Therapist;
  recording: boolean;
  onStop: () => void;
  onEnd: () => void;
}) {
  const [seconds, setSeconds] = useState(0);
  const [toast, setToast] = useState(false);
  useEffect(() => {
    const id = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, []);
  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");
  return (
    <div className="relative flex h-full flex-col bg-navy-900 px-4 pb-4 pt-2 text-white">
      <Toast show={toast}>
        <MicOff className="h-4 w-4 text-brand-300" aria-hidden /> {c.stopped}
      </Toast>
      <div className="flex items-center justify-between py-2">
        <span className={cn("inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[13px] font-semibold", recording ? "bg-white/10" : "bg-white/5 text-white/70")}>
          <span className={cn("h-2.5 w-2.5 rounded-full", recording ? "bg-red-500" : "bg-white/40")} />
          {recording ? c.recording : c.notRecording}
        </span>
        <span className="text-[15px] font-semibold tabular-nums text-white/80">{mm}:{ss}</span>
        <Press className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10" aria-label={c.minimise}>
          <Minimize2 className="h-4 w-4" aria-hidden />
        </Press>
      </div>

      <div className="relative mt-2 flex flex-1 flex-col items-center justify-center overflow-hidden rounded-[32px] bg-gradient-to-b from-navy-700 to-navy-800 ring-1 ring-white/10">
        <Glow className="h-72 w-72 opacity-60" />
        <Avatar name={t.name} size={110} />
        <p className="relative mt-4 text-[18px] font-bold">{lang === "ar" ? t.nameAr : t.name}</p>
        <div className="relative mt-4 flex h-10 items-end gap-1" aria-hidden>
          {Array.from({ length: 14 }).map((_, i) => (
            <motion.span
              key={i}
              className="w-1.5 rounded-full bg-brand-400"
              animate={{ height: [8, 10 + ((i * 7) % 26), 8] }}
              transition={{ duration: 0.9 + (i % 4) * 0.15, repeat: Infinity, ease: "easeInOut" }}
            />
          ))}
        </div>
        <div className="absolute bottom-4 end-4 flex h-28 w-20 items-center justify-center rounded-2xl bg-navy-600 ring-2 ring-white/15">
          <User className="h-8 w-8 text-white/50" aria-hidden />
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <Btn
          kind="light"
          disabled={!recording}
          onClick={() => {
            onStop();
            setToast(true);
            setTimeout(() => setToast(false), 2600);
          }}
          className="h-14"
        >
          <MicOff className="h-4 w-4" aria-hidden /> {c.stopRecording}
        </Btn>
        <Press onClick={onEnd} className="flex h-14 items-center justify-center gap-2 rounded-2xl bg-white text-[15px] font-bold text-navy-700">
          <PhoneOff className="h-4 w-4" aria-hidden /> {c.end}
        </Press>
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- summary -- */

function SummaryScreen({ c, lang, t, onRecord }: { c: Copy; lang: Lang; t: Therapist; onRecord: () => void }) {
  const [signed, setSigned] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setSigned(true), 2600);
    return () => clearTimeout(id);
  }, []);
  return (
    <div className="space-y-4 px-5 pb-8 pt-4">
      <p className="text-[26px] font-bold text-navy-700">{c.yourRecord}</p>
      <AnimatePresence mode="wait">
        {!signed ? (
          <motion.div key="writing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, scale: 0.98 }}>
            <Card className="overflow-hidden">
              <div className="flex items-center gap-3">
                <motion.span animate={{ rotate: 360 }} transition={{ duration: 3, repeat: Infinity, ease: "linear" }}>
                  <Sparkles className="h-6 w-6 text-brand-600" aria-hidden />
                </motion.span>
                <p className="text-[16px] font-bold text-navy-700">{c.stillWriting}</p>
              </div>
              <p className="mt-2 text-[14px] leading-relaxed text-navy-500">{c.stillWritingBody}</p>
              <div className="mt-4 space-y-2">
                {[92, 80, 64].map((w) => (
                  <motion.div
                    key={w}
                    className="h-3 rounded-full bg-navy-100"
                    style={{ width: `${w}%` }}
                    animate={{ opacity: [0.5, 1, 0.5] }}
                    transition={{ duration: 1.4, repeat: Infinity }}
                  />
                ))}
              </div>
            </Card>
          </motion.div>
        ) : (
          <motion.div key="signed" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={spring} className="space-y-4">
            <Card>
              <div className="flex items-center gap-3">
                <Avatar name={t.name} size={48} />
                <div>
                  <p className="text-[16px] font-bold text-navy-700">{lang === "ar" ? t.nameAr : t.name}</p>
                  <p className="text-[13px] text-navy-500">{lang === "ar" ? t.credAr : t.cred}</p>
                </div>
                <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ ...spring, delay: 0.2 }} className="ms-auto flex h-9 w-9 items-center justify-center rounded-full bg-brand-500 text-navy-700">
                  <ShieldCheck className="h-5 w-5" aria-hidden />
                </motion.span>
              </div>
              <p className="mt-4 text-[15px] leading-relaxed text-navy-700">{c.summary}</p>
              <p className="mt-3 text-[13px] text-navy-500">
                {c.signed} {lang === "ar" ? t.nameAr : t.name} · {lang === "ar" ? "23 سبتمبر" : "23 Sept"}
              </p>
            </Card>
            <Card className="bg-navy-600 text-white ring-0">
              <p className="text-[13px] font-semibold uppercase tracking-wide text-brand-300">{c.nextStep}</p>
              <p className="mt-1 text-[17px] font-bold">{c.nextStepBody}</p>
            </Card>
            <Btn kind="ghost" onClick={onRecord} className="w-full">
              {c.whoReads}
            </Btn>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ---------------------------------------------------------------- record -- */

function RecordScreen({ c, lang }: { c: Copy; lang: Lang }) {
  const [answer, setAnswer] = useState<null | "yes" | "no">(null);
  return (
    <div className="space-y-4 px-5 pb-8 pt-4">
      <p className="text-[26px] font-bold text-navy-700">{c.whoReads}</p>
      <AnimatePresence>
        {answer === null ? (
          <motion.div key="ask" exit={{ opacity: 0, height: 0, marginBottom: 0 }} className="overflow-hidden">
            <p className="mb-2 text-[13px] font-bold uppercase tracking-wide text-navy-500">{c.askingNow}</p>
            <Card className="ring-2 ring-amber-400">
              <div className="flex items-center gap-3">
                <Avatar name="Dr Kareem Nabil" size={48} />
                <div>
                  <p className="text-[16px] font-bold text-navy-700">{lang === "ar" ? "د. كريم، عيادة النيل" : "Dr Kareem, Nile Practice"}</p>
                  <p className="text-[13px] text-navy-500">{lang === "ar" ? "يريد قراءة ملخّصاتك" : "Wants to read your summaries"}</p>
                </div>
              </div>
              <div className="mt-4 grid gap-2">
                <Btn onClick={() => setAnswer("yes")} className="w-full">{c.yes24}</Btn>
                <div className="grid grid-cols-2 gap-2">
                  <Btn kind="ghost" onClick={() => setAnswer("yes")}>{c.yesUntil}</Btn>
                  <Btn kind="ghost" onClick={() => setAnswer("no")}>{c.noThanks}</Btn>
                </div>
              </div>
            </Card>
          </motion.div>
        ) : null}
      </AnimatePresence>
      <p className="text-[13px] font-bold uppercase tracking-wide text-navy-500">{c.canRead}</p>
      <motion.div layout className="space-y-2">
        {[
          { name: "Dr Sara Demo", ar: "د. سارة ديمو", until: lang === "ar" ? "حتى تغيّري رأيك" : "Until you change your mind" },
          ...(answer === "yes" ? [{ name: "Dr Kareem Nabil", ar: "د. كريم نبيل", until: lang === "ar" ? "لمدة 24 ساعة" : "For 24 hours" }] : []),
        ].map((r) => (
          <motion.div key={r.name} layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <Card className="flex items-center gap-3">
              <Avatar name={r.name} size={44} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-bold text-navy-700">{lang === "ar" ? r.ar : r.name}</p>
                <p className="text-[13px] text-navy-500">{r.until}</p>
              </div>
              <span className="text-[14px] font-semibold text-navy-600 underline underline-offset-4">{c.stop}</span>
            </Card>
          </motion.div>
        ))}
      </motion.div>
      <Toast show={answer === "yes"}>
        <ShieldCheck className="h-4 w-4 text-brand-300" aria-hidden /> {c.granted}
      </Toast>
    </div>
  );
}

/* -------------------------------------------------------------------- me -- */

function MeScreen({ c }: { c: Copy }) {
  return (
    <div className="space-y-4 px-5 pb-8 pt-4">
      <p className="text-[26px] font-bold text-navy-700">{c.benefit}</p>
      <Card className="relative overflow-hidden bg-navy-900 text-white ring-0">
        <Glow className="-right-16 -top-16 h-56 w-56" />
        <div className="relative flex items-center gap-4">
          <Ring value={0.6} size={88} stroke={9} track="rgba(255,255,255,0.12)">
            <span className="text-[20px] font-bold">60%</span>
          </Ring>
          <div>
            <p className="text-[18px] font-bold">Habiba Holdings</p>
            <p className="mt-1 text-[14px] leading-relaxed text-white/75">{c.benefitBody}</p>
          </div>
        </div>
      </Card>
      <Card>
        <p className="text-[15px] font-bold text-navy-700">{c.companySees}</p>
        <ul className="mt-2 space-y-2">
          {c.companySeesList.map((line) => (
            <li key={line} className="flex gap-2 text-[14px] text-navy-600">
              <Eye className="mt-0.5 h-4 w-4 shrink-0 text-navy-500" aria-hidden /> {line}
            </li>
          ))}
        </ul>
        <p className="mt-4 text-[15px] font-bold text-navy-700">{c.neverSees}</p>
        <ul className="mt-2 space-y-2">
          {c.neverSeesList.map((line) => (
            <li key={line} className="flex gap-2 text-[14px] text-navy-600">
              <Lock className="mt-0.5 h-4 w-4 shrink-0 text-brand-700" aria-hidden /> {line}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------------- sos -- */

function SosSheet({ c, open, onClose }: { c: Copy; open: boolean; onClose: () => void }) {
  return (
    <Sheet open={open} onClose={onClose}>
      <div className="space-y-3">
        <p className="text-[24px] font-bold text-navy-700">{c.sosTitle}</p>
        <p className="text-[15px] leading-relaxed text-navy-600">{c.sosBody}</p>
        <motion.a
          href="tel:105"
          whileTap={{ scale: 0.97 }}
          className="flex items-center gap-4 rounded-3xl bg-red-600 p-4 text-white outline-none focus-visible:ring-2 focus-visible:ring-red-300"
        >
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/15">
            <Phone className="h-6 w-6" aria-hidden />
          </span>
          <span>
            <span className="block text-[26px] font-bold leading-none">105</span>
            <span className="mt-1 block text-[14px]">{c.line105}</span>
          </span>
        </motion.a>
        <motion.a
          href="tel:123"
          whileTap={{ scale: 0.97 }}
          className="flex items-center gap-4 rounded-3xl p-4 text-red-700 ring-2 ring-red-600 outline-none"
        >
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-red-50">
            <Phone className="h-6 w-6" aria-hidden />
          </span>
          <span>
            <span className="block text-[26px] font-bold leading-none">123</span>
            <span className="mt-1 block text-[14px]">{c.line123}</span>
          </span>
        </motion.a>
      </div>
    </Sheet>
  );
}
