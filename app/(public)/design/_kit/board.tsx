import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { cn } from "@/lib/utils";

import type { Lang } from "./tx";

/**
 * How a flow is shown to the person approving it: the screens in the order a
 * person meets them, left to right, each with the promise it keeps and the
 * defect it replaces. The notes are for the founder and stay in English; the
 * screens themselves switch language with the toggle.
 */
export type Screen = {
  name: string;
  /** Value statements this screen is responsible for (docs/VALUE-STATEMENTS.md). */
  serves?: string[];
  /** What it replaces, from the walk or the screen assessment. */
  fixes?: string;
  /** A question only the founder can answer, shown so it is not buried. */
  decide?: string;
  node: ReactNode;
};

export function Flow({
  id,
  title,
  intro,
  taps,
  screens,
}: {
  id: string;
  title: string;
  intro: string;
  /** A count the flow is built to keep, said out loud (P1's three taps). */
  taps?: string;
  screens: Screen[];
}) {
  return (
    <section id={id} className="scroll-mt-20 border-t border-navy-100 py-10">
      <div className="mx-auto max-w-3xl px-4">
        <h2 className="text-[26px] font-bold text-navy-600">{title}</h2>
        <p className="mt-2 text-[16px] leading-relaxed text-navy-500">{intro}</p>
        {taps ? <p className="mt-2 text-[15px] font-semibold text-navy-600">{taps}</p> : null}
      </div>
      <div className="mt-6 overflow-x-auto pb-4">
        <ol className="flex w-max items-start gap-4 px-4">
          {screens.map((screen, index) => (
            <li key={screen.name} className="flex items-start gap-4">
              <div className="flex w-[390px] flex-col gap-3">
                <p className="text-[14px] font-semibold text-navy-600">
                  {index + 1}. {screen.name}
                </p>
                {screen.node}
                <div className="space-y-1.5 text-[14px] leading-relaxed text-navy-500">
                  {screen.serves?.length ? (
                    <p>
                      <span className="font-semibold text-navy-600">Keeps </span>
                      {screen.serves.join(", ")}
                    </p>
                  ) : null}
                  {screen.fixes ? (
                    <p>
                      <span className="font-semibold text-navy-600">Replaces </span>
                      {screen.fixes}
                    </p>
                  ) : null}
                  {screen.decide ? (
                    <p className="rounded-lg bg-amber-100 px-2.5 py-1.5 text-navy-600">
                      <span className="font-semibold">Your call: </span>
                      {screen.decide}
                    </p>
                  ) : null}
                </div>
              </div>
              {index < screens.length - 1 ? (
                <ArrowRight className="mt-[400px] h-6 w-6 shrink-0 text-navy-300" aria-hidden />
              ) : null}
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

export function LangSwitch({ lang, path }: { lang: Lang; path: string }) {
  const option = (value: Lang, label: string) => (
    <Link
      href={value === "en" ? path : `${path}?lang=ar`}
      className={cn(
        "rounded-full px-3.5 py-1.5 text-[14px] font-semibold",
        lang === value ? "bg-navy-600 text-white" : "text-navy-600",
      )}
    >
      {label}
    </Link>
  );
  return (
    <div className="inline-flex rounded-full border border-navy-200 bg-white p-1">
      {option("en", "English")}
      {option("ar", "العربية")}
    </div>
  );
}
