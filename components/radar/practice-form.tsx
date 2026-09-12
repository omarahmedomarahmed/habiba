"use client";

import { useState, useTransition } from "react";
import { Check, DoorOpen, MapPin, Search } from "lucide-react";

import { findPracticeLocation, savePractice } from "@/app/(app)/on-call/actions";
import { Button, Card, Field, Input } from "@/components/ui";
import { countryFlag } from "@/lib/geo";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n/client";

type Hit = {
  lat: string;
  lon: string;
  displayName: string;
  country: string | null;
  region: string | null;
  city: string | null;
};

/**
 * Where the practice is, and whether people may knock.
 *
 * Search, then *confirm*. A geocoder is confidently wrong often enough that
 * publishing its first answer unseen would eventually send someone in distress
 * to the wrong building, and that is not a bug you get to fix afterwards. So
 * nothing is saved until the clinician has read back the address the machine
 * found and pressed the button next to it.
 *
 * The walk-in switch is deliberately below the address and deliberately off by
 * default. Being online this minute says nothing about whether the door is
 * open, and one control that meant both would be the kind of convenience that
 * ends with a stranger outside a locked office.
 */
export function PracticeForm(props: {
  practiceName: string | null;
  address: string | null;
  lat: string | null;
  lon: string | null;
  country: string | null;
  region: string | null;
  city: string | null;
  acceptsWalkIns: boolean;
  confirmed: boolean;
}) {
  const t = useT();
  const [pending, startTransition] = useTransition();
  const [searching, setSearching] = useState(false);

  const [name, setName] = useState(props.practiceName ?? "");
  const [query, setQuery] = useState(props.address ?? "");
  const [hits, setHits] = useState<Hit[]>([]);
  const [chosen, setChosen] = useState<Hit | null>(
    props.address && props.lat && props.lon
      ? {
          lat: props.lat,
          lon: props.lon,
          displayName: props.address,
          country: props.country,
          region: props.region,
          city: props.city,
        }
      : null,
  );
  const [walkIns, setWalkIns] = useState(props.acceptsWalkIns);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const search = () =>
    startTransition(async () => {
      setError(null);
      setSaved(false);
      setSearching(true);
      const result = await findPracticeLocation(query);
      setSearching(false);
      if (result.error) {
        setError(result.error);
        setHits([]);
        return;
      }
      setHits(result.hits ?? []);
    });

  const save = () =>
    startTransition(async () => {
      setError(null);
      const result = await savePractice({
        practiceName: name,
        address: chosen?.displayName ?? "",
        lat: chosen?.lat ?? "",
        lon: chosen?.lon ?? "",
        country: chosen?.country ?? props.country ?? "",
        region: chosen?.region ?? "",
        city: chosen?.city ?? "",
        acceptsWalkIns: walkIns && Boolean(chosen),
      });
      if (result.error) setError(result.error);
      else {
        setSaved(true);
        setHits([]);
      }
    });

  const clear = () =>
    startTransition(async () => {
      setChosen(null);
      setWalkIns(false);
      setQuery("");
      setHits([]);
      const result = await savePractice({
        practiceName: "",
        address: "",
        lat: "",
        lon: "",
        country: "",
        region: "",
        city: "",
        acceptsWalkIns: false,
      });
      if (result.error) setError(result.error);
      else setSaved(true);
    });

  return (
    <Card className="space-y-4 p-4">
      <div className="flex items-start gap-2.5">
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-600">
          <MapPin className="h-4 w-4" aria-hidden />
        </span>
        <div>
          <p className="text-sm font-semibold text-slate-900">{t("tprac.title")}</p>
          <p className="mt-0.5 text-xs leading-relaxed text-slate-500">
            {t("tprac.blurb")}
          </p>
        </div>
      </div>

      {error ? (
        <p role="alert" className="rounded-xl bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
          {error}
        </p>
      ) : null}
      {saved ? <p className="text-sm text-teal-700">{t("tset.savedDot")}</p> : null}

      <Field label={t("tprac.name")} htmlFor="practiceName" hint={t("tprac.nameHint")}>
        <Input
          id="practiceName"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t("tprac.namePlaceholder")}
        />
      </Field>

      <Field
        label={t("tprac.address")}
        htmlFor="practiceAddress"
        hint={t("tprac.addressHint")}
      >
        <div className="flex gap-2">
          <Input
            id="practiceAddress"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                search();
              }
            }}
            placeholder={t("tprac.addressPlaceholder")}
          />
          <Button variant="secondary" disabled={pending || query.trim().length < 4} onClick={search}>
            <Search className="h-4 w-4" aria-hidden />
            {searching ? t("tprac.looking") : t("tprac.find")}
          </Button>
        </div>
      </Field>

      {hits.length > 0 ? (
        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-slate-600">
            {t("tprac.whichOne")}
          </p>
          {hits.map((hit) => (
            <button
              key={`${hit.lat},${hit.lon}`}
              type="button"
              onClick={() => {
                setChosen(hit);
                setHits([]);
              }}
              className="flex w-full items-start gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-start hover:border-brand-400 hover:bg-brand-50/40"
            >
              <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden />
              <span className="min-w-0">
                <span className="block text-sm text-slate-800">{hit.displayName}</span>
                <span className="block text-[11px] text-slate-400">
                  {hit.lat}, {hit.lon}
                </span>
              </span>
            </button>
          ))}
        </div>
      ) : null}

      {chosen ? (
        <div className="rounded-2xl border border-teal-200 bg-teal-50/60 p-3">
          <p className="flex items-center gap-1.5 text-[11px] font-bold tracking-wider text-teal-700 uppercase">
            <Check className="h-3 w-3" aria-hidden />
            {t("tprac.confirmed")}
          </p>
          <p className="mt-1 text-sm leading-relaxed text-teal-900">
            {chosen.country ? `${countryFlag(chosen.country)} ` : ""}
            {chosen.displayName}
          </p>
          <a
            href={`https://www.google.com/maps/search/?api=1&query=${chosen.lat},${chosen.lon}`}
            target="_blank"
            rel="noreferrer"
            className="mt-1.5 inline-block text-xs font-semibold text-teal-700 underline"
          >
            {t("tprac.openInMaps")}
          </a>
        </div>
      ) : null}

      <label
        className={cn(
          "flex cursor-pointer items-start gap-3 rounded-2xl border p-3 transition-colors",
          walkIns && chosen
            ? "border-brand-300 bg-brand-50/60"
            : "border-slate-200 bg-white hover:bg-slate-50",
          !chosen && "cursor-not-allowed opacity-60",
        )}
      >
        <input
          type="checkbox"
          checked={walkIns && Boolean(chosen)}
          disabled={!chosen}
          onChange={(e) => setWalkIns(e.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 accent-brand-500"
        />
        <span className="min-w-0">
          <span className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
            <DoorOpen className="h-3.5 w-3.5" aria-hidden />
            {t("tprac.walkIns")}
          </span>
          <span className="mt-0.5 block text-xs leading-relaxed text-slate-500">
            {chosen ? t("tprac.walkInsOn") : t("tprac.walkInsOff")}
          </span>
        </span>
      </label>

      <div className="flex gap-2">
        <Button full disabled={pending} onClick={save}>
          {pending ? t("common.saving") : t("tprac.save")}
        </Button>
        {props.confirmed || chosen ? (
          <Button variant="secondary" disabled={pending} onClick={clear}>
            {t("tprac.remove")}
          </Button>
        ) : null}
      </div>
    </Card>
  );
}
