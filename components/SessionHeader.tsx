"use client";

import { Activity, Gauge, Globe2, MapPinned, RefreshCcw, Timer } from "lucide-react";
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

  return (
    <span
      className={`inline-flex items-center gap-2 rounded-md border px-2.5 py-1 text-xs font-bold uppercase tracking-[0.14em] ${
        status === "live"
          ? "border-red-400/40 bg-red-500/15 text-red-100"
          : "border-cyan-300/30 bg-cyan-400/10 text-cyan-100"
      }`}
    >
      <span
        className={`h-2 w-2 rounded-full ${
          status === "live" ? "animate-pulse bg-red-400" : "bg-cyan-300"
        }`}
      />
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
      className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/5 p-1"
      aria-label={t(locale, "language")}
      title={t(locale, "languageTitle")}
    >
      <Globe2 className="ml-1 h-4 w-4 text-neutral-300" aria-hidden="true" />
      {LANGUAGE_OPTIONS.map((option) => {
        const active = option.locale === locale;

        return (
          <button
            key={option.locale}
            type="button"
            onClick={() => onChange(option.locale)}
            className={`h-8 rounded px-2 text-xs font-black transition ${
              active
                ? "bg-white text-neutral-950"
                : "text-neutral-300 hover:bg-white/10 hover:text-white"
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
  lapSummary,
  locale,
  onRefresh,
  onToggleDemo,
  onLocaleChange,
}: SessionHeaderProps) {
  const eventName =
    meeting?.meetingName || session?.countryName
      ? raceName(locale, meeting?.meetingName, meeting?.countryName ?? session?.countryName)
      : "F1 Live Track";
  const circuit = circuitName(locale, meeting?.circuitShortName ?? session?.circuitShortName);
  const country = countryName(locale, meeting?.countryName ?? session?.countryName);
  const lapValue = t(locale, "lapProgressValue", {
    current: lapSummary.current ? String(lapSummary.current) : "-",
    total: lapSummary.total ? String(lapSummary.total) : "-",
  });

  return (
    <header className="flex flex-col gap-4 border-b border-white/10 bg-neutral-950/95 px-4 py-4 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-xl font-black uppercase tracking-[0.18em] text-white sm:text-2xl">
              F1 Live Track
            </h1>
            <StatusChip session={session} demo={demo} locale={locale} />
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-neutral-300">
            <span className="font-semibold text-white">{eventName}</span>
            <span>{circuit}</span>
            {country ? <span>{country}</span> : null}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <LanguageSwitcher locale={locale} onChange={onLocaleChange} />
          <button
            type="button"
            onClick={onRefresh}
            title={t(locale, "refreshDataTitle")}
            className="inline-flex items-center gap-2 rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm font-semibold text-white transition hover:border-white/25 hover:bg-white/10"
          >
            <RefreshCcw className="h-4 w-4" aria-hidden="true" />
            {t(locale, "refresh")}
          </button>
          <button
            type="button"
            onClick={onToggleDemo}
            title={demo ? t(locale, "latestTitle") : t(locale, "demoTitle")}
            className="inline-flex items-center gap-2 rounded-md border border-cyan-300/30 bg-cyan-400/10 px-3 py-2 text-sm font-semibold text-cyan-50 transition hover:bg-cyan-300/15"
          >
            <Timer className="h-4 w-4" aria-hidden="true" />
            {demo ? t(locale, "latest") : t(locale, "demo")}
          </button>
        </div>
      </div>

      <div className="grid gap-2 text-xs text-neutral-400 sm:grid-cols-4">
        <div className="flex items-center gap-2">
          <Gauge className="h-4 w-4 text-red-300" aria-hidden="true" />
          <span>{sessionName(locale, session?.sessionType)}</span>
          <span className="text-neutral-600">/</span>
          <span>{session ? sessionName(locale, session.sessionName) : t(locale, "lastSession")}</span>
        </div>
        <div className="flex items-center gap-2">
          <MapPinned className="h-4 w-4 text-emerald-300" aria-hidden="true" />
          <span>
            {session ? formatShortDateTime(session.dateStart, locale) : t(locale, "waiting")}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Timer className="h-4 w-4 text-cyan-300" aria-hidden="true" />
          <span>{t(locale, "lapProgress")} {lapValue}</span>
        </div>
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-amber-300" aria-hidden="true" />
          <span>
            {t(locale, "updated")} {lastUpdated ? formatTime(lastUpdated, locale) : "\u2014"}
          </span>
        </div>
      </div>
    </header>
  );
}
