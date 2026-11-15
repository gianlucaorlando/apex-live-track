"use client";

import { Activity, Globe2, RefreshCcw, Timer } from "lucide-react";
import { formatShortDateTime, formatTime } from "@/lib/format";
import {
  LANGUAGE_OPTIONS,
  circuitName,
  countryName,
  raceName,
  sessionName,
  sessionStatus,
  t,
  type Locale,
} from "@/lib/i18n";
import type { F1Meeting, F1Session } from "@/types/f1";

interface SessionHeaderProps {
  session: F1Session | null;
  meeting: F1Meeting | null;
  demo: boolean;
  lastUpdated: string | null;
  lapSummary: {
    current: number | null;
    total: number | null;
  };
  locale: Locale;
  onRefresh: () => void;
  onToggleDemo: () => void;
  onLocaleChange: (locale: Locale) => void;
}

function StatusChip({
  session,
  demo,
  locale,
}: {
  session: F1Session | null;
  demo: boolean;
  locale: Locale;
}) {
  const status = demo ? "replay" : session?.status ?? "replay";
  const label = sessionStatus(locale, status, { demo });
  const live = status === "live";

  return (
    <span
      className={`inline-flex items-center gap-2 rounded px-2.5 py-1 text-xs font-semibold ${
        live ? "bg-f1red text-white" : "bg-white/10 text-white"
      }`}
    >
      <span className={`h-2 w-2 rounded-full ${live ? "animate-pulse bg-white" : "bg-white/70"}`} />
      {label}
    </span>
  );
}

function LanguageSwitcher({
  locale,
  onChange,
}: {
  locale: Locale;
  onChange: (locale: Locale) => void;
}) {
  return (
    <div
      className="inline-flex items-center overflow-hidden rounded border border-white/20"
      aria-label={t(locale, "language")}
      title={t(locale, "languageTitle")}
    >
      <Globe2 className="mx-1.5 h-3.5 w-3.5 text-white/50" aria-hidden="true" />
      {LANGUAGE_OPTIONS.map((option) => {
        const active = option.locale === locale;

        return (
          <button
            key={option.locale}
            type="button"
            onClick={() => onChange(option.locale)}
            className={`h-7 px-2 text-xs font-semibold transition ${
              active ? "bg-white text-ink" : "text-white/60 hover:bg-white/10 hover:text-white"
            }`}
            aria-pressed={active}
            title={option.label}
          >
            {option.shortLabel}
          </button>
        );
      })}
    </div>
  );
}

export function SessionHeader({
  session,
  meeting,
  demo,
  lastUpdated,
  locale,
  onRefresh,
  onToggleDemo,
  onLocaleChange,
}: SessionHeaderProps) {
  const eventName =
    meeting?.meetingName || session?.countryName
      ? raceName(locale, meeting?.meetingName, meeting?.countryName ?? session?.countryName)
      : "Apex Live Track";
  const circuit = circuitName(locale, meeting?.circuitShortName ?? session?.circuitShortName);
  const country = countryName(locale, meeting?.countryName ?? session?.countryName);

  return (
    <header className="flex min-h-[58px] flex-wrap items-center gap-x-7 gap-y-2 bg-ink px-4 py-2 text-white sm:px-6">
      <div className="flex items-center gap-2.5">
        <span className="block h-1.5 w-6 -skew-x-[25deg] bg-f1red" aria-hidden="true" />
        <h1 className="text-lg font-black uppercase tracking-[0.08em]">Apex Live Track</h1>
      </div>

      <div className="flex min-w-0 flex-wrap items-center gap-x-5 gap-y-1 text-xs text-white/70">
        <span className="font-semibold text-white">{eventName}</span>
        <span>
          {circuit}
          {country ? ` · ${country}` : ""}
        </span>
        {session ? (
          <span>
            <span className="font-semibold text-white">{sessionName(locale, session.sessionName)}</span>
            {" · "}
            {formatShortDateTime(session.dateStart, locale)}
          </span>
        ) : null}
      </div>

      <div className="ml-auto flex flex-wrap items-center gap-2 text-xs">
        <StatusChip session={session} demo={demo} locale={locale} />
        <span className="hidden items-center gap-1.5 text-white/55 md:inline-flex">
          <Activity className="h-3.5 w-3.5" aria-hidden="true" />
          {t(locale, "updated")} {lastUpdated ? formatTime(lastUpdated, locale) : "\u2014"}
        </span>
        <LanguageSwitcher locale={locale} onChange={onLocaleChange} />
        <button
          type="button"
          onClick={onRefresh}
          title={t(locale, "refreshDataTitle")}
          className="inline-flex h-7 items-center gap-1.5 rounded border border-white/20 px-2.5 font-semibold text-white transition hover:bg-white/10"
        >
          <RefreshCcw className="h-3.5 w-3.5" aria-hidden="true" />
          {t(locale, "refresh")}
        </button>
        <button
          type="button"
          onClick={onToggleDemo}
          title={demo ? t(locale, "latestTitle") : t(locale, "demoTitle")}
          className="inline-flex h-7 items-center gap-1.5 rounded border border-white/20 px-2.5 font-semibold text-white transition hover:bg-white/10"
        >
          <Timer className="h-3.5 w-3.5" aria-hidden="true" />
          {demo ? t(locale, "latest") : t(locale, "demo")}
        </button>
      </div>
    </header>
  );
}
